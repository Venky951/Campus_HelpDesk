const crypto = require("crypto");
const { GridFSBucket, ObjectId } = require("mongodb");
const mongoose = require("mongoose");

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENTS = new Map([
  [".jpg", { contentType: "image/jpeg", signatures: ["jpeg"] }],
  [".jpeg", { contentType: "image/jpeg", signatures: ["jpeg"] }],
  [".png", { contentType: "image/png", signatures: ["png"] }],
  [".pdf", { contentType: "application/pdf", signatures: ["pdf"] }],
]);
const BUCKET_NAME = "attachments";

const getExtension = (filename) =>
  filename.slice(filename.lastIndexOf(".")).toLowerCase();

const hasSignature = (buffer, signature) => {
  if (signature === "jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (signature === "png") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
};

const validateAttachment = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    return { valid: false, message: "Invalid attachment" };
  }

  const extension = getExtension(file.originalname || "");
  const definition = ALLOWED_ATTACHMENTS.get(extension);
  if (!definition || file.size > MAX_ATTACHMENT_SIZE) {
    return { valid: false, message: "Attachments must be JPG, JPEG, PNG, or PDF files up to 5 MB" };
  }

  if (
    file.mimetype !== definition.contentType ||
    !definition.signatures.some((signature) => hasSignature(file.buffer, signature))
  ) {
    return { valid: false, message: "The attachment content does not match its file type" };
  }

  return {
    valid: true,
    extension,
    contentType: definition.contentType,
  };
};

const getBucket = () => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error("MongoDB is not connected");
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
};

const uploadAttachment = (file, ticketId) =>
  new Promise((resolve, reject) => {
    const bucket = getBucket();
    const filename = `${crypto.randomUUID()}${getExtension(file.originalname).toLowerCase()}`;
    const originalName = file.originalname
      .replace(/[^\w.\- ]/g, "_")
      .slice(0, 120);
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.mimetype,
      metadata: {
        application: "campus-helpdesk",
        ticketId: String(ticketId),
        originalName,
      },
    });

    uploadStream.once("error", (error) => {
      if (uploadStream.id) {
        bucket.delete(uploadStream.id).catch(() => {});
      }
      reject(error);
    });
    uploadStream.once("finish", () => {
      resolve({
        fileId: uploadStream.id,
        filename: originalName,
        contentType: file.mimetype,
        size: file.size,
      });
    });
    uploadStream.end(file.buffer);
  });

const deleteAttachment = async (fileId) => {
  if (!fileId) return;
  const id = fileId instanceof ObjectId ? fileId : new ObjectId(fileId);
  await getBucket().delete(id);
};

const downloadAttachment = (fileId) => {
  if (!ObjectId.isValid(fileId)) {
    return null;
  }
  return getBucket().openDownloadStream(new ObjectId(fileId));
};

const cleanupOrphanedAttachments = async (Ticket) => {
  const referenced = new Set();
  const tickets = await Ticket.find({ "attachment.fileId": { $exists: true } })
    .select("attachment.fileId")
    .lean();
  tickets.forEach((ticket) => referenced.add(String(ticket.attachment.fileId)));

  const files = await mongoose.connection.db
    .collection(`${BUCKET_NAME}.files`)
    .find({ "metadata.application": "campus-helpdesk" })
    .project({ _id: 1 })
    .toArray();

  const orphanedFileIds = files
    .filter((file) => !referenced.has(String(file._id)))
    .map((file) => file._id);
  await Promise.all(
    orphanedFileIds.map((fileId) => deleteAttachment(fileId)),
  );
  if (orphanedFileIds.length > 0) {
    await mongoose.connection.db
      .collection(`${BUCKET_NAME}.chunks`)
      .deleteMany({ files_id: { $in: orphanedFileIds } });
  }

  const allFiles = await mongoose.connection.db
    .collection(`${BUCKET_NAME}.files`)
    .find({})
    .project({ _id: 1 })
    .toArray();
  await mongoose.connection.db
    .collection(`${BUCKET_NAME}.chunks`)
    .deleteMany({ files_id: { $nin: allFiles.map((file) => file._id) } });
};

module.exports = {
  ALLOWED_ATTACHMENTS,
  MAX_ATTACHMENT_SIZE,
  cleanupOrphanedAttachments,
  deleteAttachment,
  downloadAttachment,
  uploadAttachment,
  validateAttachment,
};
