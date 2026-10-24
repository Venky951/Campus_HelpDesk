const { ObjectId } = require("mongodb");
const mongoose = require("mongoose");
const { getIntegrationMongoUri } = require("./integration-config");
const Ticket = require("../models/raisetickect");

const BUCKET_NAME = "attachments";
const APPLICATION_NAME = "campus-helpdesk";
const DEFAULT_MIN_AGE_HOURS = 24;
const MIN_AGE_HOURS = 1;

const getGridFsCleanupConfig = (environment = process.env) => {
  const uri = environment.GRIDFS_CLEANUP_MONGO_URI;
  if (typeof uri !== "string" || uri.trim() === "") {
    throw new Error(
      "GRIDFS_CLEANUP_MONGO_URI must explicitly target a disposable integration database",
    );
  }

  const integration = getIntegrationMongoUri({
    INTEGRATION_MONGO_URI: uri,
  });
  const configuredHours =
    environment.GRIDFS_ORPHAN_MIN_AGE_HOURS === undefined
      ? DEFAULT_MIN_AGE_HOURS
      : Number(environment.GRIDFS_ORPHAN_MIN_AGE_HOURS);

  if (
    !Number.isInteger(configuredHours) ||
    configuredHours < MIN_AGE_HOURS
  ) {
    throw new Error(
      `GRIDFS_ORPHAN_MIN_AGE_HOURS must be an integer of at least ${MIN_AGE_HOURS}`,
    );
  }

  return {
    uri: integration.uri,
    databaseName: integration.databaseName,
    minAgeMs: configuredHours * 60 * 60 * 1000,
  };
};

const getCollection = (db, suffix) => db.collection(`${BUCKET_NAME}.${suffix}`);

const getDocuments = async (cursor) => cursor.toArray();

const getTicketReferences = async (TicketModel) => {
  const tickets = await TicketModel.find({ "attachment.fileId": { $exists: true } })
    .select("attachment.fileId")
    .lean();
  return new Set(
    tickets
      .map((ticket) => ticket.attachment?.fileId)
      .filter(Boolean)
      .map(String),
  );
};

const describeFile = (file, reason) => ({
  fileId: String(file._id),
  uploadDate: file.uploadDate,
  length: file.length,
  reason,
});

const inspectFileCompleteness = async (chunksCollection, file) => {
  if (
    !(file.uploadDate instanceof Date) ||
    !Number.isInteger(file.length) ||
    file.length < 0 ||
    !Number.isInteger(file.chunkSize) ||
    file.chunkSize <= 0
  ) {
    return { complete: false, reason: "invalid-file-metadata" };
  }

  const chunks = await getDocuments(
    chunksCollection
      .find({ files_id: file._id })
      .project({ _id: 0, n: 1 }),
  );
  const expectedCount = Math.ceil(file.length / file.chunkSize);
  const chunkNumbers = chunks.map((chunk) => chunk.n).sort((a, b) => a - b);
  const complete =
    chunks.length === expectedCount &&
    chunkNumbers.every((number, index) => number === index);

  return {
    complete,
    reason: complete ? null : "missing-or-inconsistent-chunks",
  };
};

const detectGridFsOrphans = async ({
  db = mongoose.connection.db,
  TicketModel = Ticket,
  minAgeMs = DEFAULT_MIN_AGE_HOURS * 60 * 60 * 1000,
  now = new Date(),
} = {}) => {
  if (!db) throw new Error("MongoDB database handle is required");
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("A valid detection timestamp is required");
  }
  if (!Number.isFinite(minAgeMs) || minAgeMs < MIN_AGE_HOURS * 60 * 60 * 1000) {
    throw new Error("The orphan minimum age must be at least one hour");
  }

  const filesCollection = getCollection(db, "files");
  const chunksCollection = getCollection(db, "chunks");
  const referenced = await getTicketReferences(TicketModel);
  const files = await getDocuments(
    filesCollection.find({}).project({
      _id: 1,
      length: 1,
      chunkSize: 1,
      uploadDate: 1,
      metadata: 1,
    }),
  );
  const fileIds = new Set(files.map((file) => String(file._id)));
  const cutoff = new Date(now.getTime() - minAgeMs);
  const candidates = [];
  const recentIncompleteFiles = [];
  const olderIncompleteFiles = [];
  const protectedFiles = [];
  const uncertainFiles = [];

  for (const file of files) {
    const fileId = String(file._id);
    const isReferenced = referenced.has(fileId);
    const isOwnedByApplication = file.metadata?.application === APPLICATION_NAME;
    const completeness = await inspectFileCompleteness(chunksCollection, file);

    if (isReferenced) {
      protectedFiles.push(describeFile(file, "referenced-by-ticket"));
    } else if (!isOwnedByApplication) {
      uncertainFiles.push(describeFile(file, "unknown-application-owner"));
    } else if (!completeness.complete) {
      const incompleteFile = describeFile(
        file,
        file.uploadDate < cutoff
          ? "older-incomplete-file"
          : "recent-incomplete-file",
      );
      incompleteFile.completenessReason = completeness.reason;
      (file.uploadDate < cutoff
        ? olderIncompleteFiles
        : recentIncompleteFiles
      ).push(incompleteFile);
    } else if (!(file.uploadDate < cutoff)) {
      protectedFiles.push(describeFile(file, "younger-than-minimum-age"));
    } else {
      candidates.push(describeFile(file, "completed-unreferenced-older-than-minimum-age"));
    }
  }

  const chunksWithoutFiles = [];
  const chunkOwners = await getDocuments(
    chunksCollection.aggregate([
      { $group: { _id: "$files_id", chunkCount: { $sum: 1 } } },
    ]),
  );
  for (const chunkOwner of chunkOwners) {
    if (!fileIds.has(String(chunkOwner._id))) {
      chunksWithoutFiles.push({
        fileId: String(chunkOwner._id),
        chunkCount: chunkOwner.chunkCount,
        reason: "chunk-has-no-file-record",
      });
    }
  }

  return {
    dryRun: true,
    deletionSupported: false,
    bucketName: BUCKET_NAME,
    minimumAgeMs: minAgeMs,
    cutoff,
    filesScanned: files.length,
    referencedFileCount: referenced.size,
    candidates,
    eligibleForReview: candidates,
    protectedFiles,
    recentIncompleteFiles,
    olderIncompleteFiles,
    incompleteFiles: [...recentIncompleteFiles, ...olderIncompleteFiles],
    uncertainFiles,
    chunksWithoutFiles,
    counts: {
      candidates: candidates.length,
      eligibleForReview: candidates.length,
      protectedFiles: protectedFiles.length,
      recentIncompleteFiles: recentIncompleteFiles.length,
      olderIncompleteFiles: olderIncompleteFiles.length,
      incompleteFiles:
        recentIncompleteFiles.length + olderIncompleteFiles.length,
      uncertainFiles: uncertainFiles.length,
      chunksWithoutFiles: chunksWithoutFiles.length,
    },
  };
};

const verifyCandidateStillOrphaned = async ({
  db = mongoose.connection.db,
  TicketModel = Ticket,
  fileId,
  minAgeMs = DEFAULT_MIN_AGE_HOURS * 60 * 60 * 1000,
  now = new Date(),
} = {}) => {
  if (!db) throw new Error("MongoDB database handle is required");
  if (!ObjectId.isValid(fileId)) {
    return { eligibleForReview: false, reason: "invalid-file-id" };
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("A valid verification timestamp is required");
  }
  if (!Number.isFinite(minAgeMs) || minAgeMs < MIN_AGE_HOURS * 60 * 60 * 1000) {
    throw new Error("The orphan minimum age must be at least one hour");
  }

  const id = new ObjectId(fileId);
  const file = await getCollection(db, "files").findOne({ _id: id });
  if (!file) {
    return {
      eligibleForReview: false,
      reason: "file-record-changed-or-removed",
    };
  }
  if (file.metadata?.application !== APPLICATION_NAME) {
    return { eligibleForReview: false, reason: "unknown-application-owner" };
  }

  const referenced = await getTicketReferences(TicketModel);
  if (referenced.has(String(id))) {
    return { eligibleForReview: false, reason: "ticket-reference-added" };
  }

  const cutoff = new Date(now.getTime() - minAgeMs);
  if (!(file.uploadDate instanceof Date) || !(file.uploadDate < cutoff)) {
    return { eligibleForReview: false, reason: "younger-than-minimum-age" };
  }

  const completeness = await inspectFileCompleteness(getCollection(db, "chunks"), file);
  if (!completeness.complete) {
    return { eligibleForReview: false, reason: completeness.reason };
  }

  return {
    eligibleForReview: true,
    reason: "still-unreferenced-complete-and-older-than-minimum-age",
  };
};

const runDryRun = async () => {
  const config = getGridFsCleanupConfig();
  await mongoose.connect(config.uri);
  try {
    const report = await detectGridFsOrphans({ minAgeMs: config.minAgeMs });
    console.log(JSON.stringify({ ...report, databaseName: config.databaseName }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  runDryRun().catch((error) => {
    console.error(`GridFS orphan report failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  APPLICATION_NAME,
  BUCKET_NAME,
  DEFAULT_MIN_AGE_HOURS,
  detectGridFsOrphans,
  getGridFsCleanupConfig,
  verifyCandidateStillOrphaned,
};
