const multer = require("multer");

/**
 * Files are held in memory (as a Buffer on req.file.buffer) instead of
 * being written to local disk. The controller uploads that buffer
 * directly to Cloudflare R2 — nothing ever touches the filesystem.
 */
function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpg, png, webp, heic) are allowed"));
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = upload;