const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const test = require("node:test");
const {
  APPLICATION_NAME,
  detectGridFsOrphans,
  getGridFsCleanupConfig,
  verifyCandidateStillOrphaned,
} = require("../utils/gridfs-orphan-report");

const now = new Date("2026-01-03T00:00:00.000Z");
const oldDate = new Date("2025-12-31T00:00:00.000Z");
const recentDate = new Date("2026-01-02T12:00:00.000Z");
const makeId = () => new ObjectId();

const createDatabase = ({ files, chunks }) => {
  const state = {
    files: [...files],
    chunks: [...chunks],
  };
  const cursor = (documents) => ({
    project: () => cursor(documents),
    toArray: async () => documents.map((document) => ({ ...document })),
  });
  const collection = (name) => {
    if (name.endsWith(".files")) {
      return {
        find: () => cursor(state.files),
        findOne: async ({ _id }) =>
          state.files.find((file) => String(file._id) === String(_id)) || null,
      };
    }
    return {
      find: ({ files_id: fileId } = {}) =>
        cursor(
          fileId
            ? state.chunks.filter((chunk) => String(chunk.files_id) === String(fileId))
            : state.chunks,
        ),
      aggregate: () =>
        cursor(
          [...new Set(state.chunks.map((chunk) => String(chunk.files_id)))].map(
            (fileId) => ({
              _id: fileId,
              chunkCount: state.chunks.filter(
                (chunk) => String(chunk.files_id) === fileId,
              ).length,
            }),
          ),
        ),
    };
  };
  return {
    collection,
    state,
  };
};

const createTicketModel = (references) => ({
  find: () => ({
    select: () => ({
      lean: async () =>
        references.map((fileId) => ({ attachment: { fileId } })),
    }),
  }),
});

const file = (id, uploadDate, overrides = {}) => ({
  _id: id,
  length: 10,
  chunkSize: 5,
  uploadDate,
  metadata: { application: APPLICATION_NAME },
  ...overrides,
});

const completeChunks = (id) => [
  { files_id: id, n: 0 },
  { files_id: id, n: 1 },
];

test("referenced attachment is protected and old unreferenced file is reported", async () => {
  const referencedId = makeId();
  const candidateId = makeId();
  const recentId = makeId();
  const database = createDatabase({
    files: [
      file(referencedId, oldDate),
      file(candidateId, oldDate),
      file(recentId, recentDate),
    ],
    chunks: [
      ...completeChunks(referencedId),
      ...completeChunks(candidateId),
      ...completeChunks(recentId),
    ],
  });
  const report = await detectGridFsOrphans({
    db: database,
    TicketModel: createTicketModel([referencedId]),
    now,
    minAgeMs: 24 * 60 * 60 * 1000,
  });

  assert.equal(report.dryRun, true);
  assert.equal(report.deletionSupported, false);
  assert.deepEqual(report.eligibleForReview.map((entry) => entry.fileId), [
    String(candidateId),
  ]);
  assert.deepEqual(report.candidates, report.eligibleForReview);
  assert.deepEqual(
    report.protectedFiles.map((entry) => entry.reason).sort(),
    ["referenced-by-ticket", "younger-than-minimum-age"],
  );
  assert.equal(database.state.files.length, 3);
  assert.equal(database.state.chunks.length, 6);
});

test("incomplete and unknown GridFS files are never reported as candidates", async () => {
  const incompleteId = makeId();
  const recentIncompleteId = makeId();
  const unknownId = makeId();
  const chunkOnlyId = makeId();
  const database = createDatabase({
    files: [
      file(incompleteId, oldDate),
      file(recentIncompleteId, recentDate),
      file(unknownId, oldDate, { metadata: { application: "other-app" } }),
    ],
    chunks: [
      { files_id: incompleteId, n: 0 },
      { files_id: recentIncompleteId, n: 0 },
      ...completeChunks(unknownId),
      { files_id: chunkOnlyId, n: 0 },
    ],
  });
  const report = await detectGridFsOrphans({
    db: database,
    TicketModel: createTicketModel([]),
    now,
  });

  assert.equal(report.candidates.length, 0);
  assert.equal(report.recentIncompleteFiles.length, 1);
  assert.equal(report.olderIncompleteFiles.length, 1);
  assert.equal(
    [...report.recentIncompleteFiles, ...report.olderIncompleteFiles].every(
      (entry) => entry.completenessReason === "missing-or-inconsistent-chunks",
    ),
    true,
  );
  assert.equal(report.recentIncompleteFiles[0].reason, "recent-incomplete-file");
  assert.equal(report.olderIncompleteFiles[0].reason, "older-incomplete-file");
  assert.equal(report.incompleteFiles.length, 2);
  assert.equal(report.uncertainFiles[0].reason, "unknown-application-owner");
  assert.deepEqual(report.chunksWithoutFiles, [
    {
      fileId: String(chunkOnlyId),
      chunkCount: 1,
      reason: "chunk-has-no-file-record",
    },
  ]);
});

test("cleanup configuration requires a disposable database and conservative age", () => {
  assert.throws(
    () => getGridFsCleanupConfig({}),
    /GRIDFS_CLEANUP_MONGO_URI/,
  );
  assert.throws(
    () =>
      getGridFsCleanupConfig({
        GRIDFS_CLEANUP_MONGO_URI:
          "mongodb://127.0.0.1:27017/ordinary-development-db",
      }),
    /must match campus_helpdesk_test/,
  );
  assert.throws(
    () =>
      getGridFsCleanupConfig({
        GRIDFS_CLEANUP_MONGO_URI:
          "mongodb://127.0.0.1:27017/campus_helpdesk_test_local",
        GRIDFS_ORPHAN_MIN_AGE_HOURS: "0",
      }),
    /at least 1/,
  );
});

test("repeated dry-runs are consistent and do not modify storage", async () => {
  const candidateId = makeId();
  const database = createDatabase({
    files: [file(candidateId, oldDate)],
    chunks: completeChunks(candidateId),
  });
  const options = {
    db: database,
    TicketModel: createTicketModel([]),
    now,
  };
  const first = await detectGridFsOrphans(options);
  const before = JSON.stringify(database.state);
  const second = await detectGridFsOrphans(options);

  assert.deepEqual(second.candidates, first.candidates);
  assert.equal(JSON.stringify(database.state), before);
});

test("verification rechecks age and fails safely when a ticket reference changes", async () => {
  const candidateId = makeId();
  const database = createDatabase({
    files: [file(candidateId, oldDate)],
    chunks: completeChunks(candidateId),
  });
  const references = [];
  const TicketModel = createTicketModel(references);
  const initial = await verifyCandidateStillOrphaned({
    db: database,
    TicketModel,
    fileId: candidateId,
    now,
    minAgeMs: 24 * 60 * 60 * 1000,
  });
  const tooRecent = await verifyCandidateStillOrphaned({
    db: database,
    TicketModel,
    fileId: candidateId,
    now: new Date("2025-12-31T12:00:00.000Z"),
    minAgeMs: 24 * 60 * 60 * 1000,
  });
  references.push(candidateId);
  const changed = await verifyCandidateStillOrphaned({
    db: database,
    TicketModel,
    fileId: candidateId,
    now,
    minAgeMs: 24 * 60 * 60 * 1000,
  });

  assert.deepEqual(initial, {
    eligibleForReview: true,
    reason: "still-unreferenced-complete-and-older-than-minimum-age",
  });
  assert.deepEqual(tooRecent, {
    eligibleForReview: false,
    reason: "younger-than-minimum-age",
  });
  assert.deepEqual(changed, {
    eligibleForReview: false,
    reason: "ticket-reference-added",
  });
});
