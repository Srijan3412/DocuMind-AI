import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFile: (file: File) => void;
  busy?: boolean;
}

const ACCEPT = ".pdf,.txt,.md,.markdown,text/plain";
const MAX_BYTES = 20 * 1024 * 1024;

export function Dropzone({ onFile, busy }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = useCallback(
    (file?: File | null) => {
      if (!file) return;
      if (file.size > MAX_BYTES) {
        setErr("File is larger than 20MB.");
        return;
      }
      setErr(null);
      onFile(file);
    },
    [onFile],
  );

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) handle(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-gradient-surface px-6 py-14 text-center transition-all",
          dragging
            ? "border-primary glow-ring scale-[1.01]"
            : "border-border hover:border-primary/60",
          busy && "pointer-events-none opacity-70",
        )}
      >
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary transition-transform group-hover:scale-110">
          {busy ? (
            <Loader2 className="size-7 animate-spin" />
          ) : (
            <UploadCloud className="size-7" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">
            {busy ? "Analyzing your document…" : "Drop a document to analyze"}
          </p>
          <p className="text-sm text-muted-foreground">
            PDF, TXT or Markdown · up to 20MB · click or drag & drop
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          {["Resume", "Invoice", "Report", "Research", "Legal"].map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1"
            >
              <FileText className="size-3 text-primary" />
              {t}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    </div>
  );
}
