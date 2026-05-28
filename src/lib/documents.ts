import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult } from "@/lib/analyze.functions";

export type DocStatus = "queued" | "processing" | "completed" | "failed";

export interface DocumentRow {
  id: string;
  session_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  status: DocStatus;
  result: AnalysisResult | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const SESSION_KEY = "doc-analyzer-session";

export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function createDocumentRecord(file: {
  name: string;
  size: number;
  type: string;
}): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("documents")
    .insert({
      session_id: getSessionId(),
      file_name: file.name,
      file_size: file.size,
      file_type: file.type || "application/pdf",
      status: "processing",
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DocumentRow;
}

export async function completeDocumentRecord(
  id: string,
  result: AnalysisResult,
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({ status: "completed", result: result as never, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function failDocumentRecord(id: string, message: string): Promise<void> {
  await supabase
    .from("documents")
    .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function fetchHistory(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("session_id", getSessionId())
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as DocumentRow[];
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export function exportAsJson(doc: DocumentRow) {
  const payload = {
    fileName: doc.file_name,
    analyzedAt: doc.created_at,
    analysis: doc.result,
  };
  downloadBlob(
    JSON.stringify(payload, null, 2),
    `${stripExt(doc.file_name)}-analysis.json`,
    "application/json",
  );
}

export function exportAsCsv(doc: DocumentRow) {
  if (!doc.result) return;
  const r = doc.result;
  const rows: string[][] = [
    ["Field", "Value"],
    ["File", doc.file_name],
    ["Document Type", r.documentType],
    ["Confidence", r.confidence],
    ["Language", r.language],
    ["Sentiment", r.sentiment],
    ["Quality Score", String(r.qualityScore)],
    ["Word Count", String(r.wordCount)],
    ["Reading Time (min)", String(r.readingTimeMinutes)],
    ["Summary", r.summary],
    ["Key Topics", r.keyTopics.join("; ")],
    ...r.keyInformation.map((k) => [k.label, k.value]),
    ...r.entities.map((e) => [`Entity (${e.type})`, e.name]),
    ...r.actionItems.map((a, i) => [`Action ${i + 1}`, a]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(csv, `${stripExt(doc.file_name)}-analysis.csv`, "text/csv");
}

function stripExt(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
