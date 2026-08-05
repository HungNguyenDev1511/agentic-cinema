"use client";

import { ChangeEvent, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Clapperboard,
  DollarSign,
  FileText,
  Film,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

import { demoAnalysis } from "@/data/demo-analysis";

type AgentIssue = {
  scene_number: number;
  category: string;
  severity: string;
  title: string;
  expected_state: string;
  observed_state: string;
  confidence: number;
  recommended_action: {
    action: string;
    priority: string;
    estimated_delay_hours: number;
    estimated_cost_usd: number;
  };
};

type AgentAnalysis = {
  production_name: string;
  continuity_score: number;
  status: string;
  summary: string;
  issues: AgentIssue[];
};

const DEFAULT_PRODUCTION_TEXT = `Production name: The Last Train

Scene 12: Maya wears a blue coat and a silver necklace at a train station.
At the end of the scene, she loses the necklace on the platform.

Scene 18 occurs later in story order.
Maya still wears the blue coat.
Production footage shows that she is also wearing the silver necklace.

Analyze the production continuity.
Estimate a reshoot delay of around 2 hours and a cost between 800 and 1500 USD when appropriate.`;

const ALLOWED_EXTENSIONS = [".txt", ".md", ".csv"];

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>

      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analysis, setAnalysis] = useState(demoAnalysis);
  const [productionText, setProductionText] = useState(
    DEFAULT_PRODUCTION_TEXT,
  );
  const [selectedFileName, setSelectedFileName] = useState<string | null>(
    null,
  );
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDelay = analysis.issues.reduce(
    (sum, issue) => sum + issue.estimatedDelayHours,
    0,
  );

  const totalCost = analysis.issues.reduce(
    (sum, issue) => sum + issue.estimatedCostUsd,
    0,
  );

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);

    const extension = getFileExtension(file.name);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError("Only .txt, .md, and .csv files are currently supported.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("The selected file must be smaller than 2 MB.");
      event.target.value = "";
      return;
    }

    setIsReadingFile(true);

    try {
      const content = await file.text();

      if (content.trim().length < 20) {
        throw new Error(
          "The selected file does not contain enough readable content.",
        );
      }

      setSelectedFileName(file.name);
      setProductionText(content);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to read the selected file.",
      );

      event.target.value = "";
    } finally {
      setIsReadingFile(false);
    }
  }

  function clearSelectedFile() {
    setSelectedFileName(null);
    setProductionText("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function loadDemoData() {
    setError(null);
    setSelectedFileName(null);
    setProductionText(DEFAULT_PRODUCTION_TEXT);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function analyzeProduction() {
    if (productionText.trim().length < 20) {
      setError("Production description must contain at least 20 characters.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productionText,
        }),
      });

      const result = (await response.json()) as
        | AgentAnalysis
        | {
            error?: string;
            detail?: string;
          };

      if (!response.ok) {
        const message =
          "error" in result && result.error
            ? result.error
            : "Analysis failed.";

        const detail =
          "detail" in result && result.detail
            ? ` ${result.detail}`
            : "";

        throw new Error(`${message}${detail}`);
      }

      const agentResult = result as AgentAnalysis;

      setAnalysis({
        productionName: agentResult.production_name,
        continuityScore: agentResult.continuity_score,
        status: agentResult.status,
        summary: agentResult.summary,
        stats: {
          totalScenes: 24,
          completedScenes: 17,
          openIssues: agentResult.issues.length,
          criticalIssues: agentResult.issues.filter(
            (issue) =>
              issue.severity === "CRITICAL" ||
              issue.severity === "HIGH",
          ).length,
        },
        issues: agentResult.issues.map((issue, index) => ({
          id: `ISSUE-${String(index + 1).padStart(3, "0")}`,
          sceneNumber: issue.scene_number,
          category: issue.category,
          severity: issue.severity,
          title: issue.title,
          expectedState: issue.expected_state,
          observedState: issue.observed_state,
          confidence: issue.confidence,
          estimatedDelayHours:
            issue.recommended_action.estimated_delay_hours,
          estimatedCostUsd:
            issue.recommended_action.estimated_cost_usd,
          recommendation: issue.recommended_action.action,
        })),
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to analyze production.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-violet-300">
              <Sparkles className="h-4 w-4" />
              Gemini Production Intelligence
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Agentic Cinema Mission Control
            </h1>

            <p className="mt-2 text-slate-400">
              {analysis.productionName} · Production continuity overview
            </p>
          </div>

          <button
            type="button"
            onClick={analyzeProduction}
            disabled={isAnalyzing || isReadingFile}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAnalyzing ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze production
              </>
            )}
          </button>
        </header>

        {error && (
          <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Production package
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Upload a text-based production file or paste script notes,
                production logs, and continuity observations.
              </p>
            </div>

            <span className="w-fit rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">
              Live ADK analysis input
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-violet-500/15 p-3">
                  <Upload className="h-5 w-5 text-violet-300" />
                </div>

                <div>
                  <p className="font-medium text-slate-200">
                    Upload production data
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Supported formats: TXT, Markdown, CSV · Maximum 2 MB
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isReadingFile || isAnalyzing}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isReadingFile ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}

                  {isReadingFile ? "Reading file…" : "Choose file"}
                </button>

                <button
                  type="button"
                  onClick={loadDemoData}
                  disabled={isAnalyzing}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Load demo
                </button>
              </div>
            </div>

            {selectedFileName && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-emerald-300" />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {selectedFileName}
                    </p>

                    <p className="text-xs text-emerald-300">
                      File loaded successfully
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearSelectedFile}
                  disabled={isAnalyzing}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Remove selected file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <textarea
            value={productionText}
            onChange={(event) => {
              setProductionText(event.target.value);

              if (selectedFileName) {
                setSelectedFileName(null);

                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }
            }}
            rows={10}
            disabled={isAnalyzing || isReadingFile}
            className="mt-5 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-violet-400/50 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="Upload a file or paste production data here..."
          />

          <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{productionText.length} characters</span>

            <span>
              Input is sent to ContinuityOS through Google ADK
            </span>
          </div>
        </section>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total scenes"
            value={analysis.stats.totalScenes}
            icon={Clapperboard}
          />

          <StatCard
            label="Completed"
            value={analysis.stats.completedScenes}
            icon={CheckCircle2}
          />

          <StatCard
            label="Open issues"
            value={analysis.stats.openIssues}
            icon={AlertTriangle}
          />

          <StatCard
            label="Critical issues"
            value={analysis.stats.criticalIssues}
            icon={ShieldAlert}
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-gradient-to-b from-violet-500/15 to-white/5 p-6">
            <p className="text-sm text-slate-400">
              Continuity score
            </p>

            <div className="mt-5 flex items-end gap-2">
              <span className="text-7xl font-semibold">
                {analysis.continuityScore}
              </span>

              <span className="pb-2 text-xl text-slate-400">
                /100
              </span>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-400 transition-all duration-500"
                style={{
                  width: `${analysis.continuityScore}%`,
                }}
              />
            </div>

            <div className="mt-5 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm text-amber-300">
              {analysis.status.replaceAll("_", " ")}
            </div>

            <p className="mt-5 leading-7 text-slate-300">
              {analysis.summary}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/20 p-4">
                <Clock3 className="h-5 w-5 text-slate-400" />

                <p className="mt-3 text-2xl font-semibold">
                  {totalDelay}h
                </p>

                <p className="text-xs text-slate-400">
                  Estimated delay
                </p>
              </div>

              <div className="rounded-2xl bg-black/20 p-4">
                <DollarSign className="h-5 w-5 text-slate-400" />

                <p className="mt-3 text-2xl font-semibold">
                  ${totalCost.toLocaleString()}
                </p>

                <p className="text-xs text-slate-400">
                  Estimated exposure
                </p>
              </div>
            </div>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Production risks
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Issues detected by the continuity intelligence agent
                </p>
              </div>

              <Film className="h-6 w-6 text-slate-500" />
            </div>

            <div className="mt-6 space-y-4">
              {analysis.issues.length === 0 ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6">
                  <p className="font-medium text-emerald-300">
                    No continuity issues detected
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    The production package currently appears healthy.
                  </p>
                </div>
              ) : (
                analysis.issues.map((issue) => (
                  <article
                    key={issue.id}
                    className="rounded-2xl border border-white/10 bg-slate-900/80 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                            Scene {issue.sceneNumber}
                          </span>

                          <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">
                            {issue.category}
                          </span>

                          <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-300">
                            {issue.severity}
                          </span>
                        </div>

                        <h3 className="mt-4 text-lg font-medium">
                          {issue.title}
                        </h3>

                        <p className="mt-2 text-sm text-slate-400">
                          Confidence:{" "}
                          {Math.round(issue.confidence * 100)}%
                        </p>
                      </div>

                      <button
                        type="button"
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:bg-white/10"
                      >
                        Review issue
                      </button>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Expected
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {issue.expectedState}
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Observed
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {issue.observedState}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                      <p className="text-xs uppercase tracking-wide text-emerald-300">
                        Recommended action
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {issue.recommendation}
                      </p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}