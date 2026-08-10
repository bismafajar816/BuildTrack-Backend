const fs = require("fs");
const path = require("path");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions";

// Use the working text model as primary
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Currently working text models (as of 2026)
const WORKING_MODELS = [
  "llama-3.3-70b-versatile",   // Primary - confirmed working
  "llama-3.1-8b-instant",      // Faster alternative
  "gemma2-9b-it",              // Google's model
  "deepseek-r1-distill-llama-70b", // Reasoning model
];

function buildLogText(project, reports) {
  const lines = reports
    .slice()
    .reverse()
    .map((r) => {
      const date = new Date(r.entry_date).toLocaleDateString();
      if (r.entry_type === "text") return `[${date}] ${r.content}`;
      
      // Include photo metadata in text for text-only models
      const caption = r.content ? ` Caption: "${r.content}"` : " No caption provided";
      const hasImage = r.image_path ? " [Photo attached]" : "";
      return `[${date}] Photo update${hasImage}${caption}`;
    });

  return (
    `Project: "${project.name}"` +
    (project.location ? ` (${project.location})` : "") +
    `\n\nDaily log entries, oldest first:\n${lines.join("\n")}`
  );
}

function buildPrompt(logText, hasPhotos, language = "en") {
  let photoContext = "";
  if (hasPhotos) {
    photoContext = 
      "Note: Photos were also submitted but cannot be directly analyzed. " +
      "Reference the photo captions and mention that visual inspection would be " +
      "beneficial for a complete assessment. ";
  }

  // Language-specific instructions
  const languageInstructions = {
    en: "Write a concise, professional progress summary (4-8 sentences) in English.",
    ur: "Write a concise, professional progress summary (4-8 sentences) in Urdu (اردو). Use the Noto Nastaliq Urdu script. Include a mix of formal construction terminology and clear, readable Urdu.",
    both: "Provide the summary in BOTH English and Urdu. Structure it as:\n\n=== ENGLISH SUMMARY ===\n[English summary here]\n\n=== اردو خلاصہ ===\n[Urdu summary here]\n\nMake both versions equally detailed and professional."
  };

  const instruction = languageInstructions[language] || languageInstructions.en;

  return (
    "You are summarizing daily site-progress updates for a construction project. " +
    `${instruction} ` +
    "Cover what work was completed, any notable issues, delays, or safety concerns mentioned. " +
    "Highlight the overall progress trend and any recurring themes. " +
    "Do not just repeat every line; synthesize and identify patterns.\n\n" +
    photoContext +
    logText
  );
}

async function summarizeWithModel(model, logText, hasPhotos, language = "en") {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: language === "ur" || language === "both" 
            ? "You are an experienced construction project manager providing concise progress summaries. You are fluent in both English and Urdu (اردو)."
            : "You are an experienced construction project manager providing concise progress summaries."
        },
        {
          role: "user",
          content: buildPrompt(logText, hasPhotos, language)
        }
      ],
      temperature: 0.3,
      max_tokens: language === "both" ? 800 : 500, // More tokens for bilingual
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Model ${model} failed (${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content;
}

async function summarizeProject(project, reports, language = "en") {
  if (!GROQ_API_KEY) {
    throw new Error("AI summary is not configured. Set GROQ_API_KEY in the backend .env.");
  }

  const logText = buildLogText(project, reports);
  const hasPhotos = reports.some((r) => r.entry_type === "image" && r.image_path);
  
  // Use working text models with fallbacks
  const modelsToTry = [GROQ_MODEL, ...WORKING_MODELS.filter(m => m !== GROQ_MODEL)];

  let lastError;
  
  for (const model of modelsToTry) {
    try {
      console.log(`Attempting summary with model: ${model}, language: ${language}`);
      const summary = await summarizeWithModel(model, logText, hasPhotos, language);
      if (summary) {
        console.log(`Successfully generated summary with ${model}`);
        return summary;
      }
    } catch (error) {
      console.warn(`Model ${model} failed:`, error.message);
      lastError = error;
      
      // If it's a model not found/decommissioned error, try next model
      if (error.message.includes("decommissioned") || error.message.includes("does not exist")) {
        continue;
      }
      
      // For other errors, still try next model
      continue;
    }
  }

  throw new Error(`All models failed. Last error: ${lastError?.message || "Unknown error"}`);
}

async function translateToUrdu(text) {
  if (!GROQ_API_KEY) {
    throw new Error("AI summary is not configured. Set GROQ_API_KEY in the backend .env.");
  }

  if (!text || !text.trim()) {
    return "";
  }

  const modelsToTry = [GROQ_MODEL, ...WORKING_MODELS.filter(m => m !== GROQ_MODEL)];
  let lastError;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "You translate English text into fluent Urdu while preserving the meaning and tone. Return only the Urdu translation."
            },
            {
              role: "user",
              content: text
            }
          ],
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Translation model ${model} failed (${response.status}): ${errText.slice(0, 300)}`);
      }

      const data = await response.json();
      const translated = data?.choices?.[0]?.message?.content?.trim();
      if (translated) {
        return translated;
      }
    } catch (error) {
      console.warn(`Urdu translation failed with ${model}:`, error.message);
      lastError = error;
    }
  }

  throw new Error(`Urdu translation failed. Last error: ${lastError?.message || "Unknown error"}`);
}

// Helper function to get summary in both languages
async function summarizeProjectBilingual(project, reports) {
  const englishSummary = await summarizeProject(project, reports, "en");
  const urduSummary = await translateToUrdu(englishSummary);
  return { english: englishSummary, urdu: urduSummary };
}

// Helper function to get Urdu summary only
async function summarizeProjectUrdu(project, reports) {
  return await summarizeProject(project, reports, "ur");
}

module.exports = { 
  summarizeProject,
  translateToUrdu,
  summarizeProjectBilingual,
  summarizeProjectUrdu
};