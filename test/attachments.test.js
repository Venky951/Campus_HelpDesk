const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MAX_ATTACHMENT_SIZE,
  downloadAttachment,
  validateAttachment,
} = require("../utils/attachments");
const {
  adminAttachmentQuery,
  studentAttachmentQuery,
} = require("../utils/attachment-access");

const file = (name, mimetype, buffer) => ({
  originalname: name,
  mimetype,
  size: buffer.length,
  buffer,
});

test("accepts valid JPEG, PNG, and PDF signatures", () => {
  assert.equal(
    validateAttachment(file("photo.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00]))).valid,
    true,
  );
  assert.equal(
    validateAttachment(
      file(
        "image.png",
        "image/png",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).valid,
    true,
  );
  assert.equal(
    validateAttachment(file("document.pdf", "application/pdf", Buffer.from("%PDF-1.7"))).valid,
    true,
  );
});

test("rejects spoofed MIME types, extensions, and signatures", () => {
  assert.equal(
    validateAttachment(file("photo.jpg", "image/jpeg", Buffer.from("not a jpeg"))).valid,
    false,
  );
  assert.equal(
    validateAttachment(file("script.exe", "application/octet-stream", Buffer.from("MZ"))).valid,
    false,
  );
  assert.equal(
    validateAttachment(file("photo.jpg", "image/png", Buffer.from([0xff, 0xd8, 0xff]))).valid,
    false,
  );
});

test("rejects files larger than 5 MB", () => {
  const oversized = file(
    "large.pdf",
    "application/pdf",
    Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(MAX_ATTACHMENT_SIZE)]),
  );
  assert.equal(validateAttachment(oversized).valid, false);
});

test("does not open GridFS streams for invalid download identifiers", () => {
  assert.equal(downloadAttachment("../attachments/../../file"), null);
  assert.equal(downloadAttachment("not-an-object-id"), null);
});

test("download authorization queries are scoped to the ticket owner or department", () => {
  assert.deepEqual(studentAttachmentQuery("ticket-1", "student-1"), {
    _id: "ticket-1",
    student: "student-1",
  });
  assert.deepEqual(adminAttachmentQuery("ticket-1", "IT"), {
    _id: "ticket-1",
    category: "IT",
  });
});
