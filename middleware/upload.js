const multer = require("multer");
const path = require("path");
const fs = require("fs");

function slugify(name) {
  return (name || "misc")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "misc";
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // The frontend sends project_name as a field BEFORE the image field,
    // so multer will already have parsed req.body.project_name by the
    // time this runs (multipart fields are parsed in stream order).
    const folder = slugify(req.body.project_name);
    const dir = path.join(__dirname, "..", "uploads", folder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpg, png, webp, heic) are allowed"));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = upload;