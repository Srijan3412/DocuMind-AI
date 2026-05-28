import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  text: z.string().min(1).max(120000),
  fileName: z.string().min(1).max(300),
});

export type AnalysisResult = {
  documentType: string;
  confidence: "high" | "medium" | "low";
  language: string;
  summary: string;
  keyTopics: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  readingTimeMinutes: number;
  wordCount: number;
  sections: { title: string; summary: string }[];
  keyInformation: { label: string; value: string }[];
  entities: { name: string; type: string }[];
  actionItems: string[];
  qualityScore: number;
};

const SYSTEM_PROMPT = `You are an expert document analysis engine, similar to ChatPDF or Humata.
You receive raw extracted text from a document and must return a single, rich, structured JSON analysis.
Be precise, infer the real document type (Resume, Invoice, Report, Research Paper, Legal Document, Letter, Contract, etc.),
and extract genuinely useful structured information. Never invent facts that are not supported by the text.
Return ONLY valid JSON matching the requested schema. No markdown, no commentary.`;

function buildUserPrompt(text: string, fileName: string) {
  return `File name: ${fileName}

Return JSON with EXACTLY this shape:
{
  "documentType": string,                 // e.g. "Resume", "Invoice", "Research Paper"
  "confidence": "high" | "medium" | "low",
  "language": string,                      // e.g. "English"
  "summary": string,                       // 2-4 sentence executive summary
  "keyTopics": string[],                   // 4-8 concise topic tags
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "readingTimeMinutes": number,
  "wordCount": number,
  "sections": [{ "title": string, "summary": string }],   // 3-6 logical sections
  "keyInformation": [{ "label": string, "value": string }], // 4-8 most important extracted facts
  "entities": [{ "name": string, "type": string }],       // people, orgs, dates, money, locations, skills
  "actionItems": string[],                 // next steps / important callouts (can be empty)
  "qualityScore": number                   // 0-100 estimate of document clarity & completeness
}

Document text:
"""
${text.slice(0, 110000)}
"""`;
}

export const analyzeDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Missing LOVABLE_API_KEY.");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(data.text, data.fileName) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (response.status === 429) {
      throw new Error("Rate limit reached. Please wait a moment and try again.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`AI analysis failed (${response.status}). ${detail.slice(0, 200)}`);
    }

    const json = await response.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";

    let parsed: AnalysisResult;
    try {
      const cleaned = content.trim().replace(/^```json/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse AI response.");
      parsed = JSON.parse(match[0]);
    }

    // Normalize / guard
    return {
      documentType: parsed.documentType ?? "Unknown",
      confidence: parsed.confidence ?? "medium",
      language: parsed.language ?? "Unknown",
      summary: parsed.summary ?? "",
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.slice(0, 10) : [],
      sentiment: parsed.sentiment ?? "neutral",
      readingTimeMinutes: Number(parsed.readingTimeMinutes) || 0,
      wordCount: Number(parsed.wordCount) || 0,
      sections: Array.isArray(parsed.sections) ? parsed.sections.slice(0, 8) : [],
      keyInformation: Array.isArray(parsed.keyInformation) ? parsed.keyInformation.slice(0, 12) : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities.slice(0, 24) : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 10) : [],
      qualityScore: Math.max(0, Math.min(100, Number(parsed.qualityScore) || 0)),
    };
  });
