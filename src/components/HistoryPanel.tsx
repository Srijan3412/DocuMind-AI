import { FileText, Trash2, Clock, History } from "lucide-react";
import type { DocumentRow } from "@/lib/documents";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  completed: "bg-primary/15 text-primary",
  processing: "bg-accent/15 text-accent",
  queued: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function HistoryPanel({
  items,
  activeId,
  onSelect,
  onDelete,
}: {
  items: DocumentRow[];
  activeId?: string;
  onSelect: (doc: DocumentRow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-4 flex items-center gap-2 px-1">
        <History className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Document history</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-muted-foreground">
          Analyzed documents will appear here.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((doc) => (
            <li key={doc.id}>
              <button
                onClick={() => doc.status === "completed" && onSelect(doc)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  activeId === doc.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-background/40 hover:border-primary/40",
                  doc.status !== "completed" && "cursor-default",
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {doc.file_name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 capitalize",
                        statusStyles[doc.status],
                      )}
                    >
                      {doc.result?.documentType ?? doc.status}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" /> {timeAgo(doc.created_at)}
                    </span>
                  </div>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(doc.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      onDelete(doc.id);
                    }
                  }}
                  className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
