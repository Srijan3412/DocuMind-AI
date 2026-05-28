import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "pending" | "active" | "done";

export interface Step {
  key: string;
  label: string;
  detail: string;
  state: StepState;
}

export function ProcessingTimeline({
  steps,
  fileName,
}: {
  steps: Step[];
  fileName: string;
}) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-gradient-surface p-6 shadow-card animate-float-up">
      <p className="mb-1 text-sm text-muted-foreground">Processing pipeline</p>
      <h3 className="mb-6 truncate text-lg font-semibold text-foreground">{fileName}</h3>
      <ol className="space-y-5">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-4">
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                step.state === "done" && "border-primary bg-primary text-primary-foreground",
                step.state === "active" && "border-primary text-primary animate-pulse-glow",
                step.state === "pending" && "border-border text-muted-foreground",
              )}
            >
              {step.state === "done" ? (
                <Check className="size-4" />
              ) : step.state === "active" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <span className="size-2 rounded-full bg-current" />
              )}
            </span>
            <div>
              <p
                className={cn(
                  "font-medium",
                  step.state === "pending" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.label}
              </p>
              <p className="text-sm text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
