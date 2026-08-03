/**
 * Summarizes a project's daily updates (text notes + site photos) using a
 * free, open-source vision-language model via Hugging Face's Inference
 * Providers router — no payment, no card, just a free HF access token.
 *
 * Default model: meta-llama/Llama-3.2-11B-Vision-Instruct — confirmed live
 * on Hugging Face's Inference Providers router (served by Novita/SambaNova)
 * at time of writing. Providers rotate which models they host, so if this
 * ever stops working, check a model's "Inference Providers" panel on its
 * Hugging Face page before swapping HF_MODEL in .env.
 *
 * NOTE: Llama 3.2 is a gated model — you must accept Meta's license once at
 * https://huggingface.co/meta-llama/Llama-3.2-11B-Vision-Instruct before
 * your token can use it (click "Agree and access repository").
 *
 * Docs: https://huggingface.co/docs/inference-providers/tasks/image-text-to-text
 * Endpoint: POST https://router.huggingface.co/v1/chat/completions (OpenAI-compatible)
 */
const fs = require("fs");
const path = require("path");

const HF_TOKEN = process.env.HF_TOKEN;
const HF_ROUTER_URL = process.env.HF_ROUTER_URL || "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL = process.env.HF_MODEL || "meta-llama/Llama-3.2-11B-Vision-Instruct";
const MAX_IMAGES = 6; // keep payload size / latency reasonable on the free tier

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic" || ext === ".heif") return "image/heic";
  return "image/jpeg";
}

function imageToDataUrl(relativeImagePath) {
  try {
    const fullPath = path.join(__dirname, "..", relativeImagePath);
    const buffer = fs.readFileSync(fullPath);
    return `data:${mimeTypeFor(relativeImagePath)};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.warn(`Could not read image for summary: ${relativeImagePath}`);
    return null;
  }
}

function buildLogText(project, reports) {
  const lines = reports
    .slice()
    .reverse() // oldest first, reads like a log
    .map((r) => {
      const date = new Date(r.entry_date).toLocaleDateString();
      if (r.entry_type === "text") return `[${date}] ${r.content}`;
      return `[${date}] Photo update${r.content ? `: ${r.content}` : " (no caption)"}`;
    });

  return (
    `Project: "${project.name}"` +
    (project.location ? ` (${project.location})` : "") +
    `\n\nDaily log entries, oldest first:\n${lines.join("\n")}`
  );
}

async function summarizeProject(project, reports) {
  if (!HF_TOKEN) {
    throw new Error("AI summary is not configured. Set HF_TOKEN in the backend .env.");
  }

  const logText = buildLogText(project, reports);

  const imageUrls = reports
    .filter((r) => r.entry_type === "image" && r.image_path)
    .slice(0, MAX_IMAGES)
    .map((r) => imageToDataUrl(r.image_path))
    .filter(Boolean);

  const content = [
    {
      type: "text",
      text:
        "You are summarizing daily site-progress updates for a construction project. " +
        "Write a concise, professional progress summary (4-8 sentences) covering what work was " +
        "completed, any notable issues, delays, or safety concerns mentioned or visible in the " +
        "photos, and the overall progress trend. Do not just repeat every line; synthesize.\n\n" +
        logText,
    },
    ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const response = await fetch(HF_ROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages: [{ role: "user", content }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`AI summary request failed (${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Unexpected response format from the Hugging Face router.");
  }
  return text;
}

module.exports = { summarizeProject };