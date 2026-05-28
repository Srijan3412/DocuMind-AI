import type { AnalysisResult } from "./analyze.functions";

const API_URL = (import.meta.env.VITE_API_URL || "https://document-processor-api-676440164041.us-central1.run.app").replace(/\/$/, "");

export async function uploadFileToBackend(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  return response.json();
}

export async function getJobStatus(jobId: string) {
  const response = await fetch(`${API_URL}/status/${jobId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch status with status ${response.status}`);
  }
  return response.json();
}

export async function getJobResult(jobId: string) {
  const response = await fetch(`${API_URL}/result/${jobId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch result with status ${response.status}`);
  }
  return response.json();
}

export function mapBackendResultToAnalysisResult(br: any): AnalysisResult {
  // Backend wraps the parsed object inside a "result" field, or it might be top-level
  const result = br?.result || br || {};

  // 1. Map keyInformation object to label/value array
  const keyInfo: { label: string; value: string }[] = [];
  if (result.keyInformation) {
    const ki = result.keyInformation;
    if (ki.name) keyInfo.push({ label: "Name", value: ki.name });
    if (ki.email) keyInfo.push({ label: "Email", value: ki.email });
    if (ki.phone) keyInfo.push({ label: "Phone", value: ki.phone });
    if (ki.organization) keyInfo.push({ label: "Organization", value: ki.organization });
    if (Array.isArray(ki.dates) && ki.dates.length > 0) {
      keyInfo.push({ label: "Dates", value: ki.dates.join(", ") });
    }
  }

  // 2. Map sections [{ title, content }] to [{ title, summary }]
  const sections = Array.isArray(result.sections)
    ? result.sections.map((s: any) => ({
        title: s.title || "Section",
        summary: s.content || "",
      }))
    : [];

  // 3. Map keyTopics [{ topic, relevance }] to string[]
  const keyTopics = Array.isArray(result.keyTopics)
    ? result.keyTopics.map((t: any) => t.topic || String(t))
    : [];

  // 4. Map entities { skills, technologies, certifications } to [{ name, type }]
  const entities: { name: string; type: string }[] = [];
  if (result.entities) {
    const ent = result.entities;
    if (Array.isArray(ent.skills)) {
      ent.skills.forEach((s: string) => entities.push({ name: s, type: "Skill" }));
    }
    if (Array.isArray(ent.technologies)) {
      ent.technologies.forEach((t: string) => entities.push({ name: t, type: "Technology" }));
    }
    if (Array.isArray(ent.certifications)) {
      ent.certifications.forEach((c: string) => entities.push({ name: c, type: "Certification" }));
    }
  }

  // 5. Parse qualityScore
  let qualityScore = 85; // default fallback
  if (result.processingQuality?.extractionConfidence) {
    const parsed = parseInt(result.processingQuality.extractionConfidence.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(parsed)) {
      qualityScore = parsed;
    }
  }

  // Calculate approximate wordCount and readingTime
  const summaryText = result.summary?.detailed || result.summary?.oneLine || result.summary || "";
  const summaryWords = typeof summaryText === "string" ? summaryText.split(/\s+/).filter(Boolean).length : 0;
  const sectionsWords = sections.reduce((acc, s) => acc + s.summary.split(/\s+/).filter(Boolean).length, 0);
  const totalWords = summaryWords + sectionsWords || 150;
  const readingTime = Math.max(1, Math.ceil(totalWords / 200));

  // Determine sentiment
  let sentiment: "positive" | "neutral" | "negative" | "mixed" = "neutral";
  if (result.sentiment === "positive" || result.sentiment === "negative" || result.sentiment === "neutral" || result.sentiment === "mixed") {
    sentiment = result.sentiment;
  }

  return {
    documentType: result.documentType || result.type || "Document",
    confidence: result.confidence === "high" || result.confidence === "medium" || result.confidence === "low" ? result.confidence : "medium",
    language: result.language || "English",
    summary: summaryText,
    keyTopics: keyTopics,
    sentiment: sentiment,
    readingTimeMinutes: readingTime,
    wordCount: totalWords,
    sections: sections,
    keyInformation: keyInfo,
    entities: entities,
    actionItems: Array.isArray(result.actionItems) ? result.actionItems : [],
    qualityScore: qualityScore,
  };
}
