import { useMemo, useState } from "react";
import {
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  FileText,
  Download,
  Code2,
  Sparkles,
  Tags,
  ListChecks,
  Languages,
  Clock,
  Gauge,
  Users,
  CheckCircle2,
} from "lucide-react";
import type { DocumentRow } from "@/lib/documents";
import { exportAsCsv, exportAsJson } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sentimentColor: Record<string, string> = {
  positive: "text-primary",
  neutral: "text-muted-foreground",
  negative: "text-destructive",
  mixed: "text-accent",
};

const confidenceColor: Record<string, string> = {
  high: "bg-primary/15 text-primary border-primary/30",
  medium: "bg-accent/15 text-accent border-accent/30",
  low: "bg-destructive/15 text-destructive border-destructive/30",
};

export function AnalysisDashboard({ doc }: { doc: DocumentRow }) {
  const r = doc.result;
  const [showJson, setShowJson] = useState(false);
  if (!r) return null;

  const entityData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of r.entities) {
      const key = (e.type || "Other").toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([type, count]) => ({ type: type.charAt(0).toUpperCase() + type.slice(1), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [r.entities]);

  const barColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
    "var(--color-chart-1)",
  ];

  return (
    <div className="space-y-6 animate-float-up">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-surface p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <FileText className="size-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{r.documentType}</h2>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                  confidenceColor[r.confidence],
                )}
              >
                {r.confidence} confidence
              </span>
            </div>
            <p className="mt-0.5 max-w-xl truncate text-sm text-muted-foreground">
              {doc.file_name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportAsJson(doc)}>
            <Download className="size-4" /> JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportAsCsv(doc)}>
            <Download className="size-4" /> CSV
          </Button>
          <Button
            variant={showJson ? "default" : "outline"}
            size="sm"
            onClick={() => setShowJson((v) => !v)}
          >
            <Code2 className="size-4" /> JSON view
          </Button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Languages} label="Language" value={r.language} />
        <Stat
          icon={Gauge}
          label="Sentiment"
          value={r.sentiment}
          valueClass={cn("capitalize", sentimentColor[r.sentiment])}
        />
        <Stat icon={Clock} label="Reading time" value={`${r.readingTimeMinutes} min`} />
        <Stat icon={FileText} label="Word count" value={r.wordCount.toLocaleString()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Summary */}
        <Card className="lg:col-span-2">
          <CardTitle icon={Sparkles}>Executive summary</CardTitle>
          <p className="text-[15px] leading-relaxed text-foreground/90">{r.summary}</p>

          {r.keyTopics.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Tags className="size-4 text-primary" /> Key topics
              </div>
              <div className="flex flex-wrap gap-2">
                {r.keyTopics.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm text-primary"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Quality gauge */}
        <Card className="flex flex-col items-center justify-center">
          <CardTitle icon={Gauge}>Quality score</CardTitle>
          <div className="relative h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="72%"
                outerRadius="100%"
                data={[{ value: r.qualityScore }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  dataKey="value"
                  cornerRadius={20}
                  fill="var(--color-primary)"
                  background={{ fill: "var(--color-muted)" }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-foreground">{r.qualityScore}</span>
              <span className="text-xs text-muted-foreground">out of 100</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Key information */}
        {r.keyInformation.length > 0 && (
          <Card>
            <CardTitle icon={ListChecks}>Key information</CardTitle>
            <dl className="divide-y divide-border">
              {r.keyInformation.map((k, i) => (
                <div key={i} className="flex items-start justify-between gap-4 py-2.5">
                  <dt className="text-sm text-muted-foreground">{k.label}</dt>
                  <dd className="max-w-[60%] text-right text-sm font-medium text-foreground">
                    {k.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {/* Entities chart */}
        {entityData.length > 0 && (
          <Card>
            <CardTitle icon={Users}>Entity breakdown</CardTitle>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={entityData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <XAxis
                    dataKey="type"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {entityData.map((_, i) => (
                      <Cell key={i} fill={barColors[i % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.entities.slice(0, 12).map((e, i) => (
                <span
                  key={i}
                  className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground"
                >
                  {e.name}
                  <span className="ml-1 text-muted-foreground">· {e.type}</span>
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Sections */}
      {r.sections.length > 0 && (
        <Card>
          <CardTitle icon={FileText}>Document sections</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {r.sections.map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-background/40 p-4"
              >
                <p className="mb-1 font-semibold text-foreground">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.summary}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action items */}
      {r.actionItems.length > 0 && (
        <Card>
          <CardTitle icon={CheckCircle2}>Action items & callouts</CardTitle>
          <ul className="space-y-2">
            {r.actionItems.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                {a}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Raw JSON */}
      {showJson && (
        <Card>
          <CardTitle icon={Code2}>Structured JSON output</CardTitle>
          <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-background/60 p-4 text-xs leading-relaxed text-foreground/90">
            {JSON.stringify(r, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardTitle({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h3>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 text-primary" /> {label}
      </div>
      <p className={cn("truncate text-lg font-semibold text-foreground", valueClass)}>
        {value}
      </p>
    </div>
  );
}
