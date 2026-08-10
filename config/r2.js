const { S3Client } = require("@aws-sdk/client-s3");
require("dotenv").config();

/**
 * Cloudflare R2 is S3-compatible, so the standard AWS SDK works against it —
 * we just point `endpoint` at the R2 account endpoint instead of AWS, and
 * use region "auto" (R2 doesn't use AWS regions).
 */
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

module.exports = r2Client;