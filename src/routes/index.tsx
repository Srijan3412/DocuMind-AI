import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useRef } from "react";
import { Toaster, toast } from "sonner";
import {
  ScanText,
  Sparkles,
  Zap,
  ShieldCheck,
  RotateCcw,
  ArrowRight,
  Database,
  Terminal,
  Cpu,
  History,
  FileCode,
  LayoutDashboard
} from "lucide-react";
import {
  uploadFileToBackend,
  getJobStatus,
  getJobResult,
  mapBackendResultToAnalysisResult,
} from "@/lib/api";
import {
  completeDocumentRecord,
  createDocumentRecord,
  deleteDocument,
  fetchHistory,
  type DocumentRow,
} from "@/lib/documents";
import { Dropzone } from "@/components/Dropzone";
import { ProcessingTimeline, type Step } from "@/components/ProcessingTimeline";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";
import { HistoryPanel } from "@/components/HistoryPanel";
import { Button } from "@/components/ui/button";

import caseResume from "@/assets/case-resume.jpg";
import caseInvoice from "@/assets/case-invoice.jpg";
import caseLegal from "@/assets/case-legal.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DocIntel AI — Raw papers to structured signals" },
      {
        name: "description",
        content:
          "Industrial-grade document intelligence. Async PDF processing with Gemini AI, Pub/Sub, Cloud Run, and Firestore.",
      },
      { property: "og:title", content: "DocIntel AI — Raw papers to structured signals" },
      {
        property: "og:description",
        content: "Async AI pipeline that turns documents into structured insights.",
      },
    ],
  }),
  component: Index,
});

const INITIAL_STEPS: Step[] = [
  { key: "upload", label: "File Upload & Verification", detail: "Uploading file to AI pipeline", state: "pending" },
  { key: "layout", label: "Document Layout Recognition", detail: "Extracting text and identifying structure", state: "pending" },
  { key: "analyze", label: "Gemini AI Extracting Insights", detail: "Classifying and parsing insights", state: "pending" },
  { key: "store", label: "Structuring Response JSON", detail: "Finalizing response object", state: "pending" },
];

type View = "idle" | "processing" | "result";

function Index() {
  const [view, setView] = useState<View>("idle");
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [currentName, setCurrentName] = useState("");
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [history, setHistory] = useState<DocumentRow[]>([]);
  const [activeHeroTab, setActiveHeroTab] = useState<"dropzone" | "schema">("dropzone");
  
  const consoleRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await fetchHistory());
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const setStep = (key: string, state: Step["state"]) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, state } : s)));

  const scrollToConsole = () => {
    setTimeout(() => {
      consoleRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  const handleFile = useCallback(
    async (file: File) => {
      setCurrentName(file.name);
      setSteps(INITIAL_STEPS.map((s) => ({ ...s, state: "pending" })));
      setView("processing");
      let recordId: string | null = null;

      try {
        setStep("upload", "active");
        const record = await createDocumentRecord({
          name: file.name,
          size: file.size,
          type: file.type,
        });
        recordId = record.id;

        // Upload file to backend
        const uploadData = await uploadFileToBackend(file);
        if (!uploadData.success) {
          throw new Error(uploadData.message || "Upload failed");
        }
        const jobId = uploadData.jobId;
        setStep("upload", "done");

        // Polling loop
        setStep("layout", "active");
        let attempts = 0;
        let completedResult = null;
        let lastProgress = 0;

        while (attempts < 60) {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 4000));

          const statusData = await getJobStatus(jobId);
          const progress = statusData.progress || 0;

          if (progress >= 25 && lastProgress < 25) {
            setStep("layout", "done");
            setStep("analyze", "active");
          }
          if (progress >= 50 && lastProgress < 50) {
            setStep("analyze", "done");
            setStep("store", "active");
          }
          lastProgress = progress;

          if (statusData.status === "completed") {
            setStep("layout", "done");
            setStep("analyze", "done");
            setStep("store", "done");
            completedResult = await getJobResult(jobId);
            break;
          }

          if (statusData.status === "failed") {
            throw new Error(statusData.error || "Parsing failed. Please check your document.");
          }
        }

        if (!completedResult) {
          throw new Error("AI parsing request timed out.");
        }

        const result = mapBackendResultToAnalysisResult(completedResult);

        await completeDocumentRecord(record.id, result);

        const finished: DocumentRow = { ...record, status: "completed", result };
        setSelected(finished);
        setView("result");
        toast.success("Analysis complete", { description: `${result.documentType} · ${result.confidence} confidence` });
        loadHistory();
        scrollToConsole();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Something went wrong.";
        if (recordId) await failDocumentRecord(recordId, message).catch(() => {});
        toast.error("Analysis failed", { description: message });
        setView("idle");
        loadHistory();
      }
    },
    [loadHistory],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDocument(id).catch(() => {});
      if (selected?.id === id) {
        setSelected(null);
        setView("idle");
      }
      loadHistory();
    },
    [selected, loadHistory],
  );

  const handleUploadClick = () => {
    setActiveHeroTab("dropzone");
    workspaceRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const renderLiveJson = () => {
    if (!selected || !selected.result) return null;
    const r = selected.result;
    return (
      <div className="bg-background rounded-lg p-6 font-mono text-sm leading-relaxed overflow-hidden">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              <div className="size-2.5 rounded-full bg-secondary" />
              <div className="size-2.5 rounded-full bg-secondary" />
              <div className="size-2.5 rounded-full bg-secondary" />
            </div>
            <div className="text-muted-foreground text-xs truncate max-w-[200px]">{selected.file_name}</div>
          </div>
          <span className="text-[10px] text-accent font-mono uppercase bg-accent/10 px-2 py-0.5 rounded">Processed</span>
        </div>
        <div className="text-muted-foreground text-xs leading-relaxed">
          <span className="text-accent">{"{"}</span><br />
          &nbsp;&nbsp;"id": <span className="text-accent/90">"{selected.id.slice(0, 8)}"</span>,<br />
          &nbsp;&nbsp;"type": <span className="text-accent/90">"{r.documentType}"</span>,<br />
          &nbsp;&nbsp;"confidence": <span className="text-accent/90">"{r.confidence}"</span>,<br />
          &nbsp;&nbsp;"language": <span className="text-accent/90">"{r.language}"</span>,<br />
          &nbsp;&nbsp;"entities": <span className="text-accent">[</span><br />
          {r.entities.slice(0, 2).map((e, index) => (
            <span key={index}>
              &nbsp;&nbsp;&nbsp;&nbsp;{"{ "}"name": <span className="text-accent/90">"{e.name}"</span>, "type": <span className="text-accent/90">"{e.type}"</span>{" }"}{index < Math.min(r.entities.length, 2) - 1 ? "," : ""}<br />
            </span>
          ))}
          &nbsp;&nbsp;<span className="text-accent">]</span>,<br />
          &nbsp;&nbsp;"summary": <span className="text-accent/90">"{r.summary.slice(0, 45)}..."</span>,<br />
          &nbsp;&nbsp;"quality_score": <span className="text-accent">{r.qualityScore}</span><br />
          <span className="text-accent">{"}"}</span>
        </div>
        <div className="mt-6 flex gap-3 items-center">
          <button 
            onClick={scrollToConsole}
            className="flex-1 py-2 px-3 border border-accent bg-accent/10 text-accent text-xs font-semibold rounded hover:bg-accent/20 transition-all flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="size-3.5" /> View Dashboard
          </button>
          <button 
            onClick={() => {
              setView("idle");
              setSelected(null);
            }}
            className="py-2 px-3 border border-border text-muted-foreground hover:text-foreground text-xs font-semibold rounded hover:bg-secondary transition-all"
          >
            Reset
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-6 bg-accent rounded-sm" />
            <span className="font-display font-bold text-xl tracking-tight italic">DOCINTEL</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <button onClick={handleUploadClick} className="hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer">
              Workspace
            </button>
            <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#pipeline" className="hover:text-foreground transition-colors">Pipeline</a>
            <a href="#cases" className="hover:text-foreground transition-colors">Use Cases</a>
            <button 
              onClick={scrollToConsole} 
              className="px-4 py-2 bg-foreground text-background rounded-full font-semibold hover:bg-accent hover:text-accent-foreground transition-colors border-0"
            >
              Dashboard
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-28 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-mono mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              v2.4 GA RELEASED
            </div>
            <h1 className="font-display text-6xl md:text-7xl font-extrabold tracking-tighter mb-6 text-balance leading-[0.9]">
              RAW PAPERS TO <span className="text-accent">STRUCTURED</span> SIGNALS.
            </h1>
            <p className="text-lg text-muted-foreground max-w-[50ch] mb-10 text-pretty leading-relaxed">
              Deploy industrial-grade document intelligence pipelines. Extract, classify, and summarize PDFs with Gemini AI through a scalable Cloud Run architecture.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleUploadClick}
                className="px-8 py-4 bg-accent text-accent-foreground rounded-lg font-bold flex items-center justify-center gap-3 hover:shadow-[0_0_30px_color-mix(in_oklab,var(--accent)_40%,transparent)] transition-all border-0 cursor-pointer"
              >
                Upload Document
                <span className="opacity-60">→</span>
              </button>
              <button 
                onClick={scrollToConsole}
                className="px-8 py-4 border border-border bg-transparent rounded-lg font-bold hover:bg-secondary transition-all text-sm uppercase tracking-widest font-mono cursor-pointer"
              >
                View History & Console
              </button>
            </div>
          </div>

          {/* Interactive Workspace Panel / JSON Preview */}
          <div ref={workspaceRef} className="relative animate-fade-up [animation-delay:200ms] scroll-mt-24">
            <div className="bg-card border border-border rounded-xl p-1 overflow-hidden shadow-2xl">
              
              {/* Tab Header */}
              {view === "idle" && (
                <div className="flex items-center justify-between border-b border-border bg-background/40 px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveHeroTab("dropzone")}
                      className={`px-3 py-1 text-xs font-mono rounded transition-all ${
                        activeHeroTab === "dropzone"
                          ? "bg-accent/15 text-accent border border-accent/20"
                          : "text-muted-foreground hover:text-foreground bg-transparent border border-transparent"
                      }`}
                    >
                      Terminal Dropzone
                    </button>
                    <button
                      onClick={() => setActiveHeroTab("schema")}
                      className={`px-3 py-1 text-xs font-mono rounded transition-all ${
                        activeHeroTab === "schema"
                          ? "bg-accent/15 text-accent border border-accent/20"
                          : "text-muted-foreground hover:text-foreground bg-transparent border border-transparent"
                      }`}
                    >
                      Mock Schema
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="size-2 rounded-full bg-border" />
                    <div className="size-2 rounded-full bg-border" />
                    <div className="size-2 rounded-full bg-border" />
                  </div>
                </div>
              )}

              {view === "processing" && (
                <div className="border-b border-border bg-background/40 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-mono text-accent animate-pulse">PIPELINE RUNNING</span>
                  <div className="flex gap-1">
                    <div className="size-2 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
                    <div className="size-2 rounded-full bg-accent animate-bounce [animation-delay:-0.15s]" />
                    <div className="size-2 rounded-full bg-accent animate-bounce" />
                  </div>
                </div>
              )}

              {view === "result" && (
                <div className="border-b border-border bg-background/40 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-mono text-accent">SUCCESSFULLY PERSISTED</span>
                  <div className="flex gap-1.5">
                    <div className="size-2.5 rounded-full bg-accent/20" />
                    <div className="size-2.5 rounded-full bg-accent/40" />
                    <div className="size-2.5 rounded-full bg-accent" />
                  </div>
                </div>
              )}

              {/* Workspace Content */}
              <div className="p-1">
                {view === "idle" && (
                  activeHeroTab === "dropzone" ? (
                    <div className="bg-background rounded-lg p-2">
                      <Dropzone onFile={handleFile} />
                    </div>
                  ) : (
                    <div className="bg-background rounded-lg p-6 font-mono text-sm leading-relaxed overflow-hidden">
                      <div className="flex items-center gap-4 border-b border-border pb-4 mb-4">
                        <div className="flex gap-1.5">
                          <div className="size-2.5 rounded-full bg-secondary" />
                          <div className="size-2.5 rounded-full bg-secondary" />
                          <div className="size-2.5 rounded-full bg-secondary" />
                        </div>
                        <div className="text-muted-foreground text-xs">job_84229_processed.json</div>
                      </div>
                      <div className="text-muted-foreground text-xs leading-relaxed">
                        <span className="text-accent">{"{"}</span><br />
                        &nbsp;&nbsp;"id": <span className="text-accent/90">"doc_7y2p"</span>,<br />
                        &nbsp;&nbsp;"type": <span className="text-accent/90">"Invoice"</span>,<br />
                        &nbsp;&nbsp;"entities": <span className="text-accent">[</span><br />
                        &nbsp;&nbsp;&nbsp;&nbsp;{"{ "}"vendor": <span className="text-accent/90">"Acme Corp"</span>, "total": <span className="text-accent/90">2400.00</span>{" }"},<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;{"{ "}"tax": <span className="text-accent/90">192.00</span>, "currency": <span className="text-accent/90">"USD"</span>{" }"}<br />
                        &nbsp;&nbsp;<span className="text-accent">]</span>,<br />
                        &nbsp;&nbsp;"summary": <span className="text-accent/90">"Quarterly hardware maintenance fee..."</span>,<br />
                        &nbsp;&nbsp;"ai_confidence": <span className="text-accent">0.9942</span><br />
                        <span className="text-accent">{"}"}</span>
                      </div>
                      <div className="mt-8 h-px bg-border relative overflow-hidden">
                        <div className="scan-line absolute inset-0 bg-gradient-to-r from-transparent via-accent/60 to-transparent w-24 h-full" />
                      </div>
                    </div>
                  )
                )}

                {view === "processing" && (
                  <div className="bg-background rounded-lg p-6">
                    <ProcessingTimeline steps={steps} fileName={currentName} />
                  </div>
                )}

                {view === "result" && (
                  renderLiveJson()
                )}
              </div>
            </div>
            
            <div className="absolute -top-6 -right-6 bg-card border border-border backdrop-blur-xl p-4 rounded-lg hidden md:block shadow-lg">
              <div className="text-[10px] text-accent font-mono mb-1">LATENCY</div>
              <div className="text-xl font-display font-bold">1.2s</div>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Analysis Console & History Panel */}
      <section ref={consoleRef} id="dashboard" className="py-20 px-6 border-t border-border bg-card/30 scroll-mt-16">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="font-mono text-xs text-accent mb-2">SYSTEM_CONSOLE</div>
              <h2 className="font-display text-3xl font-bold tracking-tight">Visual Intelligence Console</h2>
              <p className="text-muted-foreground text-sm mt-1">Explore detailed summaries, layout analysis, entities, and export options.</p>
            </div>
            {selected && (
              <Button variant="outline" size="sm" onClick={() => { setView("idle"); setSelected(null); }} className="self-start md:self-auto gap-2">
                <RotateCcw className="size-4" /> Analyze Another
              </Button>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Left: Interactive visual dashboard */}
            <div className="space-y-6">
              {selected ? (
                <AnalysisDashboard doc={selected} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-background/50 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                  <div className="size-14 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground mb-4">
                    <LayoutDashboard className="size-7" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">No Document Selected</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-6">
                    Select an item from the history panel on the right, or drop a new document in the hero workspace to parse it.
                  </p>
                  <button 
                    onClick={handleUploadClick}
                    className="px-5 py-2.5 bg-accent text-accent-foreground text-sm font-semibold rounded-lg hover:shadow-lg transition-all border-0 cursor-pointer"
                  >
                    Open Upload Dropzone
                  </button>
                </div>
              )}
            </div>

            {/* Right: Document History Panel */}
            <div className="space-y-4">
              <HistoryPanel
                items={history}
                activeId={selected?.id}
                onSelect={(doc) => {
                  setSelected(doc);
                  setView("result");
                  scrollToConsole();
                }}
                onDelete={handleDelete}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="py-24 bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight mb-16 text-center">
            Industrial Pipeline Architecture
          </h2>
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative">
            {[
              { n: "01", label: "Frontend UI", sub: "Vite + React App" },
              { n: "02", label: "Express API Gateway", sub: "Async Queue Router" },
            ].map((s) => (
              <PipelineStep key={s.n} {...s} />
            ))}
            <PipelineConnector />
            <div className="flex flex-col items-center gap-4 text-center ring-2 ring-accent/20 p-4 rounded-xl bg-accent/5">
              <div className="size-12 bg-accent text-accent-foreground rounded-lg flex items-center justify-center font-mono font-bold">
                AI
              </div>
              <div className="text-sm font-medium">Cloud Run Worker</div>
              <div className="text-xs text-accent">Gemini Pro 1.5</div>
            </div>
            <PipelineConnector />
            <PipelineStep n="04" label="Supabase Firestore" sub="Persistent State & History" />
          </div>
        </div>
      </section>

      {/* Pipeline detail */}
      <section id="pipeline" className="py-32 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div>
            <div className="font-mono text-xs text-accent mb-4">PROCESS_FLOW</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tighter mb-6">
              Six steps. <span className="text-accent">Zero blocking.</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Every upload becomes a job in a queue. Workers pull, parse, analyze, and persist asynchronously — so the API stays responsive even at scale.
            </p>
          </div>
          <ol className="space-y-4">
            {[
              ["Upload", "User drops a PDF through the dashboard."],
              ["API Receive", "Express assigns a job ID and pushes to Pub/Sub."],
              ["Worker Pull", "Cloud Run worker decodes and extracts text with pdf-parse."],
              ["Gemini Analyze", "AI returns type, summary, topics, entities, sentiment."],
              ["Persist", "Firestore stores the result and status timeline."],
              ["Poll", "Frontend retrieves /result/:jobId and renders insight."],
            ].map(([title, body], i) => (
              <li
                key={title}
                className="flex gap-4 p-5 border border-border rounded-xl hover:border-accent/40 transition-colors"
              >
                <div className="size-8 shrink-0 rounded-md bg-background border border-border flex items-center justify-center font-mono text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <div className="font-semibold text-sm mb-1">{title}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{body}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Use cases */}
      <section id="cases" className="py-24 px-6 max-w-7xl mx-auto">
        <h2 className="font-display text-3xl font-bold tracking-tight mb-12">Case Studies</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              n: "01",
              title: "Automated Resumes",
              body: "Extract skills, contact info, and experience history into standardized JSON schemas for ATS integration.",
              img: caseResume,
              alt: "Resume document with neon highlighted sections",
            },
            {
              n: "02",
              title: "Invoice Parsing",
              body: "Multi-lingual extraction of line items, tax IDs, and totals from scanned physical invoice documents.",
              img: caseInvoice,
              alt: "Technical x-ray view of invoice with data nodes",
            },
            {
              n: "03",
              title: "Legal Discovery",
              body: "Classify and tag thousands of legal documents for sentiment, entities, and critical risk factors.",
              img: caseLegal,
              alt: "Legal folders scanned by green laser",
            },
          ].map((c) => (
            <article
              key={c.n}
              className="p-8 border border-border rounded-2xl hover:border-accent/50 transition-colors bg-card/50"
            >
              <div className="font-mono text-xs text-accent mb-4">CASE STUDY_{c.n}</div>
              <h3 className="font-display text-2xl font-bold mb-4">{c.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{c.body}</p>
              <img
                src={c.img}
                alt={c.alt}
                loading="lazy"
                width={800}
                height={512}
                className="w-full aspect-[16/10] object-cover rounded-lg border border-border"
              />
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="size-4 bg-accent/50 rounded-sm" />
            <span className="font-display font-bold tracking-tight opacity-60">DOCINTEL AI</span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
            © 2026 PRECISION SYSTEMS INC // CLOUD-NATIVE
          </div>
          <div className="flex gap-6 text-xs font-mono text-muted-foreground">
            <a href="#" className="hover:text-accent transition-colors">STATUS_OK</a>
            <a href="#" className="hover:text-accent transition-colors">GITHUB</a>
            <a href="#" className="hover:text-accent transition-colors">PRIVACY</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PipelineStep({ n, label, sub }: { n: string; label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="size-12 border border-border bg-background rounded-lg flex items-center justify-center font-mono text-accent">
        {n}
      </div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function PipelineConnector() {
  return (
    <div className="hidden lg:block h-px flex-1 bg-border relative">
      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full bg-accent ring-4 ring-accent/20" />
    </div>
  );
}
