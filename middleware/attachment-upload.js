const multer = require("multer");
const { MAX_ATTACHMENT_SIZE } = require("../utils/attachments");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 1 },
  fileFilter: (req, file, callback) => {
    const extension = file.originalname
      .slice(file.originalname.lastIndexOf("."))
      .toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".pdf"];
    if (!allowed.includes(extension)) {
      const error = new Error("Unsupported attachment type");
      error.code = "ATTACHMENT_TYPE";
      return callback(error);
    }
    callback(null, true);
  },
});

module.exports = (req, res, next) => {
  upload.single("attachment")(req, res, (error) => {
    if (error) {
      req.attachmentUploadError = error;
    }
    next();
  });
};
