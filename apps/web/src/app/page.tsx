"use client";

import {
  ChangeEvent,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  Clapperboard,
  Database,
  FileSearch,
  FileText,
  Film,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  Upload,
  UserRoundCog,
  X,
  XCircle,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type AgentName =
  | "script_agent"
  | "continuity_agent"
  | "history_agent"
  | "producer_agent";

type AgentStatus =
  | "waiting"
  | "running"
  | "completed"
  | "failed";

type AgentStep = {
  agent: AgentName;
  title: string;
  description: string;
  status: AgentStatus;
  message: string;
};

type StreamEvent = {
  type:
    | "agent_started"
    | "agent_completed"
    | "agent_failed"
    | "pipeline_completed"
    | "pipeline_failed";

  agent?: AgentName;
  message?: string;
  error?: string;
  output?: unknown;
  producer_decision?: unknown;
};

type ActivityItem = {
  id: string;
  time: string;
  agent: string;
  message: string;
  type:
    | "info"
    | "success"
    | "error";
};

type HistoryCase = {
  run_id: string;
  production_name: string;
  continuity_score: number;
  status: string;
  producer_decision: string;
  scene_number: number;
  category: string;
  severity: string;
  title: string;
  expected_state: string;
  observed_state: string;
  confidence: number;
};

type HistoryAgentOutput = {
  similar_cases: number;
  historical_context: HistoryCase[];
  historical_signal: "LOW" | "MEDIUM" | "HIGH";
  insight: string;
  data_quality_note: string;
  mcp_verified?: boolean;
};

type ContinuityAgentIssue = {
  scene_number: number;
  category: string;
  severity: string;
  title: string;
  expected_state: string;
  observed_state: string;
  confidence: number;
  evidence?: Array<{
    source: string;
    detail: string;
  }>;
};

type ContinuityAgentOutput = {
  production_name: string;
  issues: ContinuityAgentIssue[];
};


type ScriptAgentScene = {
  scene_number: number;
  characters: unknown[];
  props: unknown[];
  wardrobe: unknown[];
  location?: string | null;
  events: string[];
};

type ScriptAgentOutput = {
  production_name: string;
  scenes: ScriptAgentScene[];
};

type ProducerAgentOutput = {
  executive_summary: string;
  decision: string;
  priority: string;
  reason: string;
  historical_basis: string;
  recommended_plan: string;
  next_action: string;
};

/* =========================================================
   DEMO INPUT
========================================================= */

const DEFAULT_PRODUCTION_TEXT = `Production name: Broken Signal

Scene 4:
Lena enters the control room wearing a white jacket and carrying a black radio.

Scene 6:
The black radio is destroyed.

Scene 9:
This scene occurs later in story order.
Production footage shows Lena carrying the same black radio, completely intact.

Analyze the production continuity.`;

const ALLOWED_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
];

/* =========================================================
   AGENT DEFINITIONS
========================================================= */

function createInitialAgentSteps(): AgentStep[] {
  return [
    {
      agent: "script_agent",
      title: "Script Agent",
      description:
        "Extract scenes, characters, props and story state",
      status: "waiting",
      message: "Waiting for production input",
    },
    {
      agent: "continuity_agent",
      title: "Continuity Agent",
      description:
        "Compare scene states and detect conflicts",
      status: "waiting",
      message: "Waiting for Script Agent",
    },
    {
      agent: "history_agent",
      title: "Production Memory Agent",
      description:
        "Search historical production intelligence through ClickHouse MCP",
      status: "waiting",
      message: "Waiting for continuity findings",
    },
    {
      agent: "producer_agent",
      title: "Producer Agent",
      description:
        "Evaluate production impact and decide next action",
      status: "waiting",
      message: "Waiting for continuity analysis",
    },
  ];
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {label}
        </p>

        <Icon className="h-5 w-5 text-slate-400" />
      </div>

      <p className="mt-3 text-3xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function AgentStatusIcon({
  status,
}: {
  status: AgentStatus;
}) {
  if (status === "running") {
    return (
      <LoaderCircle className="h-5 w-5 animate-spin text-violet-300" />
    );
  }

  if (status === "completed") {
    return (
      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
    );
  }

  if (status === "failed") {
    return (
      <XCircle className="h-5 w-5 text-rose-300" />
    );
  }

  return (
    <Circle className="h-5 w-5 text-slate-600" />
  );
}

function AgentIcon({
  agent,
}: {
  agent: AgentName;
}) {
  if (agent === "script_agent") {
    return (
      <FileSearch className="h-5 w-5" />
    );
  }
  if (agent === "history_agent") {
    return (
      <Database className="h-5 w-5" />
    );
  }
  if (agent === "continuity_agent") {
    return (
      <Bot className="h-5 w-5" />
    );
  }

  return (
    <UserRoundCog className="h-5 w-5" />
  );
}

function getFileExtension(
  fileName: string,
) {
  const index =
    fileName.lastIndexOf(".");

  return index >= 0
    ? fileName
        .slice(index)
        .toLowerCase()
    : "";
}

/* =========================================================
   PAGE
========================================================= */

export default function Home() {
  
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [
    productionText,
    setProductionText,
  ] = useState("");

  const [
    selectedFileName,
    setSelectedFileName,
  ] = useState<string | null>(null);

  const [
    isReadingFile,
    setIsReadingFile,
  ] = useState(false);

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    agentSteps,
    setAgentSteps,
  ] = useState<AgentStep[]>(
    createInitialAgentSteps(),
  );

  const [
    activities,
    setActivities,
  ] = useState<ActivityItem[]>([]);

  const [
    pipelineCompleted,
    setPipelineCompleted,
  ] = useState(false);

  const [
    scriptOutput,
    setScriptOutput,
  ] = useState<ScriptAgentOutput | null>(null);

  const [
    historyOutput,
    setHistoryOutput,
  ] = useState<HistoryAgentOutput | null>(null);

  const [
    continuityOutput,
    setContinuityOutput,
  ] = useState<ContinuityAgentOutput | null>(null);

  const [
    producerOutput,
    setProducerOutput,
  ] = useState<ProducerAgentOutput | null>(null);

  /* =======================================================
     CALCULATED VALUES
  ======================================================= */

  const renderedIssues =
    continuityOutput?.issues ?? [];

  const completedAgents =
    agentSteps.filter(
      (step) =>
        step.status === "completed",
    ).length;

  const totalScenes =
    scriptOutput?.scenes?.length ?? 0;

  const criticalIssues =
    renderedIssues.filter(
      (issue) =>
        issue.severity === "CRITICAL" ||
        issue.severity === "HIGH",
    ).length;

  function getContinuityScore() {
    if (!continuityOutput) {
      return 100;
    }

    if (renderedIssues.length === 0) {
      return 100;
    }

    const rank: Record<string, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    const highestSeverity =
      renderedIssues.reduce(
        (highest, issue) => {
          const current =
            issue.severity?.toUpperCase() ??
            "LOW";

          return (
            (rank[current] ?? 1) >
            (rank[highest] ?? 1)
          )
            ? current
            : highest;
        },
        "LOW",
      );

    if (highestSeverity === "CRITICAL") {
      return 35;
    }

    if (highestSeverity === "HIGH") {
      return 60;
    }

    if (highestSeverity === "MEDIUM") {
      return 80;
    }

    return 90;
  }

  const liveContinuityScore =
    getContinuityScore();

  const liveStatus =
    !continuityOutput
      ? "READY"
      : renderedIssues.length === 0
        ? "OK"
        : liveContinuityScore <= 35
          ? "CRITICAL"
          : liveContinuityScore <= 60
            ? "AT_RISK"
            : liveContinuityScore <= 80
              ? "REVIEW"
              : "WATCH";

  const liveSummary =
    producerOutput?.executive_summary ??
    (renderedIssues.length > 0
      ? `${renderedIssues.length} continuity ${
          renderedIssues.length === 1
            ? "issue was"
            : "issues were"
        } detected by the AI production crew.`
      : continuityOutput
        ? "No continuity issues were detected in the submitted production context."
        : "Load a production package and run the AI crew to generate live continuity intelligence.");

  /* =======================================================
     UTILITIES
  ======================================================= */

  function addActivity(
    agent: string,
    message: string,
    type: ActivityItem["type"] = "info",
  ) {
    const now = new Date();

    const time =
      now.toLocaleTimeString(
        undefined,
        {
          hour12: false,
        },
      );

    setActivities(
      (current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          time,
          agent,
          message,
          type,
        },
      ],
    );
  }

  function updateAgent(
    agent: AgentName,
    status: AgentStatus,
    message?: string,
  ) {
    setAgentSteps(
      (current) =>
        current.map((step) =>
          step.agent === agent
            ? {
                ...step,
                status,
                message:
                  message ??
                  step.message,
              }
            : step,
        ),
    );
  }

  /* =======================================================
     FILE INPUT
  ======================================================= */

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);

    const extension =
      getFileExtension(file.name);

    if (
      !ALLOWED_EXTENSIONS.includes(
        extension,
      )
    ) {
      setError(
        "Only TXT, Markdown and CSV files are currently supported.",
      );

      event.target.value = "";

      return;
    }

    if (
      file.size >
      2 * 1024 * 1024
    ) {
      setError(
        "The selected file must be smaller than 2 MB.",
      );

      event.target.value = "";

      return;
    }

    setIsReadingFile(true);

    try {
      const content =
        await file.text();

      if (
        content.trim().length < 20
      ) {
        throw new Error(
          "The selected file does not contain enough readable content.",
        );
      }

      setSelectedFileName(
        file.name,
      );

      setProductionText(
        content,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to read file.",
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
      fileInputRef.current.value =
        "";
    }
  }

  function loadDemoData() {
    setError(null);

    setSelectedFileName(null);

    setProductionText(
      DEFAULT_PRODUCTION_TEXT,
    );

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  }

  /* =======================================================
     SSE PARSER
  ======================================================= */

  function processStreamEvent(
    event: StreamEvent,
  ) {
    if (
      event.type ===
        "agent_started" &&
      event.agent
    ) {
      updateAgent(
        event.agent,
        "running",
        event.message ??
          "Agent started",
      );

      addActivity(
        event.agent,
        event.message ??
          "Agent started",
      );

      return;
    }

    if (
      event.type ===
        "agent_completed" &&
      event.agent
    ) {
      updateAgent(
        event.agent,
        "completed",
        event.message ??
          "Completed",
      );

      addActivity(
        event.agent,
        event.message ??
          "Completed",
        "success",
      );

      if (
        event.agent === "script_agent" &&
        event.output &&
        typeof event.output === "object"
      ) {
        setScriptOutput(
          event.output as ScriptAgentOutput,
        );
      }

      if (
        event.agent === "continuity_agent" &&
        event.output &&
        typeof event.output === "object"
      ) {
        setContinuityOutput(
          event.output as ContinuityAgentOutput,
        );
      }

      if (
        event.agent === "history_agent" &&
        event.output &&
        typeof event.output === "object"
      ) {
        setHistoryOutput(
          event.output as HistoryAgentOutput,
        );
      }

      if (
        event.agent === "producer_agent" &&
        event.output &&
        typeof event.output === "object"
      ) {
        setProducerOutput(
          event.output as ProducerAgentOutput,
        );
      }

      return;
    }

    if (
      event.type ===
        "agent_failed" &&
      event.agent
    ) {
      updateAgent(
        event.agent,
        "failed",
        event.error ??
          "Agent failed",
      );

      addActivity(
        event.agent,
        event.error ??
          "Agent failed",
        "error",
      );

      return;
    }

    if (
      event.type ===
      "pipeline_completed"
    ) {
      setPipelineCompleted(true);

      addActivity(
        "orchestrator",
        "AI production crew completed the workflow.",
        "success",
      );

      if (
        event.producer_decision &&
        typeof event.producer_decision === "object"
      ) {
        setProducerOutput(
          event.producer_decision as ProducerAgentOutput,
        );
      }

      return;
    }

    if (
      event.type ===
      "pipeline_failed"
    ) {
      addActivity(
        "orchestrator",
        event.error ??
          "Pipeline failed",
        "error",
      );

      setError(
        event.error ??
          "Agent pipeline failed.",
      );
    }
  }

  /* =======================================================
     ANALYZE
  ======================================================= */

  async function analyzeProduction() {
    if (
      productionText.trim().length <
      20
    ) {
      setError(
        "Production description must contain at least 20 characters.",
      );

      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setPipelineCompleted(false);
    setScriptOutput(null);
    setHistoryOutput(null);
    setContinuityOutput(null);
    setProducerOutput(null);

    setActivities([]);

    setAgentSteps(
      createInitialAgentSteps(),
    );

    addActivity(
      "orchestrator",
      "Production analysis requested.",
    );

    try {
      const response =
        await fetch(
          "/api/analyze?stream=1",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              productionText,
            }),
          },
        );

      if (!response.ok) {
        const result =
          await response.json();

        throw new Error(
          result.error ??
            "Unable to start agent pipeline.",
        );
      }

      if (!response.body) {
        throw new Error(
          "Agent pipeline returned no stream.",
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(
          value,
          {
            stream: true,
          },
        );

        const blocks =
          buffer.split("\n\n");

        buffer =
          blocks.pop() ?? "";

        for (const block of blocks) {
          const lines =
            block.split("\n");

          for (const line of lines) {
            if (
              !line.startsWith(
                "data:",
              )
            ) {
              continue;
            }

            const raw =
              line
                .slice(5)
                .trim();

            if (!raw) {
              continue;
            }

            try {
              const event =
                JSON.parse(
                  raw,
                ) as StreamEvent;

              processStreamEvent(
                event,
              );
            } catch {
              console.warn(
                "Invalid SSE event:",
                raw,
              );
            }
          }
        }
      }

    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to analyze production.";

      setError(message);

      addActivity(
        "system",
        message,
        "error",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* HEADER */}

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
              {continuityOutput?.production_name ??
                scriptOutput?.production_name ??
                "Production Intelligence"}
              {" · "}
              AI Production Crew
            </p>
          </div>

          <button
            type="button"
            onClick={
              analyzeProduction
            }
            disabled={
              isAnalyzing ||
              isReadingFile
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAnalyzing ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                AI crew working…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze production
              </>
            )}
          </button>
        </header>

        {/* ERROR */}

        {error && (
          <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* INPUT */}

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Production package
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Upload production notes
                or paste screenplay
                context.
              </p>
            </div>

            <span className="w-fit rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">
              Google ADK Multi-Agent
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv"
            onChange={
              handleFileChange
            }
            className="hidden"
          />

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() =>
                fileInputRef.current?.click()
              }
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
            >
              <Upload className="h-4 w-4" />
              Choose file
            </button>

            <button
              onClick={
                loadDemoData
              }
              className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
            >
              Load demo
            </button>

            {selectedFileName && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-sm">
                <FileText className="h-4 w-4 text-emerald-300" />

                {selectedFileName}

                <button
                  onClick={
                    clearSelectedFile
                  }
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <textarea
            value={
              productionText
            }
            onChange={(event) =>
              setProductionText(
                event.target.value,
              )
            }
            rows={9}
            disabled={
              isAnalyzing
            }
            className="mt-5 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-6 text-slate-200 outline-none focus:border-violet-400/50"
          />
        </section>

        {/* AI CREW */}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  AI Production Crew
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Live execution of
                  Google ADK agents
                </p>
              </div>

              <span className="text-sm text-slate-400">
                {completedAgents}/
                {agentSteps.length}
                {" "}
                completed
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {agentSteps.map(
                (step) => (
                  <div
                    key={step.agent}
                    className="flex gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="mt-1 text-violet-300">
                      <AgentIcon
                        agent={
                          step.agent
                        }
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium">
                          {step.title}
                        </p>

                        <AgentStatusIcon
                          status={
                            step.status
                          }
                        />
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {step.description}
                      </p>

                      <p className="mt-3 text-sm text-slate-300">
                        {step.message}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>

            {pipelineCompleted && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
                <Check className="h-4 w-4" />
                AI production workflow completed.
              </div>
            )}
          </div>

          {/* ACTIVITY */}

          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-violet-300" />

              <h2 className="font-semibold">
                Agent Activity
              </h2>
            </div>

            <div className="mt-5 max-h-[430px] space-y-4 overflow-y-auto pr-2">
              {activities.length ===
              0 ? (
                <p className="text-sm text-slate-500">
                  Activity will
                  appear when analysis
                  starts.
                </p>
              ) : (
                activities.map(
                  (item) => (
                    <div
                      key={
                        item.id
                      }
                      className="border-l border-white/10 pl-4"
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>
                          {item.time}
                        </span>

                        <span>
                          {item.agent}
                        </span>
                      </div>

                      <p
                        className={`mt-1 text-sm ${
                          item.type ===
                          "error"
                            ? "text-rose-300"
                            : item.type ===
                                "success"
                              ? "text-emerald-300"
                              : "text-slate-300"
                        }`}
                      >
                        {
                          item.message
                        }
                      </p>
                    </div>
                  ),
                )
              )}
            </div>
          </div>
        </section>

        {/* PRODUCTION MEMORY */}

        {historyOutput && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-violet-300" />
                  <h2 className="text-xl font-semibold">
                    Production Memory
                  </h2>
                </div>

                <p className="mt-1 text-sm text-slate-400">
                  Historical evidence retrieved through ClickHouse MCP
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {historyOutput.mcp_verified && (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                    MCP verified
                  </span>
                )}

                <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-300">
                  {historyOutput.similar_cases} similar cases
                </span>

                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
                  Signal: {historyOutput.historical_signal}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Historical insight
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                {historyOutput.insight}
              </p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {historyOutput.historical_context.map(
                (item, index) => (
                  <article
                    key={`${item.run_id}-${index}`}
                    className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-white">
                          {item.production_name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Historical production evidence
                        </p>
                      </div>

                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                        Score {item.continuity_score}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          item.status === "CRITICAL"
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {item.status.replaceAll("_", " ")}
                      </span>

                      <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">
                        {item.producer_decision.replaceAll("_", " ")}
                      </span>

                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                        Scene {item.scene_number}
                      </span>

                      <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-300">
                        {item.severity}
                      </span>
                    </div>

                    <p className="mt-4 font-medium text-slate-200">
                      {item.title}
                    </p>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-xs uppercase text-slate-500">
                          Expected
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">
                          {item.expected_state}
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-xs uppercase text-slate-500">
                          Observed
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">
                          {item.observed_state}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      Confidence {Math.round(item.confidence * 100)}% · Run {item.run_id.slice(0, 8)}
                    </p>
                  </article>
                ),
              )}
            </div>

            {historyOutput.data_quality_note && (
              <div className="mt-5 rounded-2xl border border-sky-400/10 bg-sky-400/5 p-4">
                <p className="text-xs uppercase tracking-wide text-sky-300">
                  Data quality note
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {historyOutput.data_quality_note}
                </p>
              </div>
            )}
          </section>
        )}

        {/* PRODUCER DECISION */}

        {producerOutput && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-white/[0.03] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <UserRoundCog className="h-5 w-5 text-violet-300" />
                  <h2 className="text-xl font-semibold">
                    Producer Decision
                  </h2>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  Final decision from the multi-agent production workflow
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs text-rose-300">
                  {producerOutput.decision.replaceAll("_", " ")}
                </span>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
                  {producerOutput.priority}
                </span>
              </div>
            </div>

            <p className="mt-5 leading-7 text-slate-200">
              {producerOutput.executive_summary}
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Reason
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {producerOutput.reason}
                </p>
              </div>

              <div className="rounded-2xl border border-violet-400/15 bg-violet-400/5 p-5">
                <p className="text-xs uppercase tracking-wide text-violet-300">
                  Historical basis
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {producerOutput.historical_basis}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5">
              <p className="text-xs uppercase tracking-wide text-emerald-300">
                Recommended plan
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">
                {producerOutput.recommended_plan}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Next action
              </p>
              <p className="mt-2 text-sm leading-6 text-white">
                {producerOutput.next_action}
              </p>
            </div>
          </section>
        )}

        {/* STATS */}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Scenes parsed"
            value={totalScenes}
            icon={Clapperboard}
          />

          <StatCard
            label="Agents completed"
            value={`${completedAgents}/${agentSteps.length}`}
            icon={CheckCircle2}
          />

          <StatCard
            label="Open issues"
            value={renderedIssues.length}
            icon={AlertTriangle}
          />

          <StatCard
            label="Critical issues"
            value={criticalIssues}
            icon={ShieldAlert}
          />
        </section>

        {/* RESULTS */}

        <section className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">

          <aside className="rounded-3xl border border-white/10 bg-gradient-to-b from-violet-500/15 to-white/5 p-6">
            <p className="text-sm text-slate-400">
              Continuity score
            </p>

            <div className="mt-5 flex items-end gap-2">
              <span className="text-7xl font-semibold">
                {
                  liveContinuityScore
                }
              </span>

              <span className="pb-2 text-xl text-slate-400">
                /100
              </span>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-400 transition-all duration-500"
                style={{
                  width: `${liveContinuityScore}%`,
                }}
              />
            </div>

            <div className="mt-5 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm text-amber-300">
              {liveStatus.replaceAll(
                "_",
                " ",
              )}
            </div>

            <p className="mt-5 leading-7 text-slate-300">
              {liveSummary}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/20 p-4">
                <Database className="h-5 w-5 text-slate-400" />

                <p className="mt-3 text-2xl font-semibold">
                  {historyOutput?.similar_cases ?? 0}
                </p>

                <p className="text-xs text-slate-400">
                  Historical matches
                </p>
              </div>

              <div className="rounded-2xl bg-black/20 p-4">
                <UserRoundCog className="h-5 w-5 text-slate-400" />

                <p className="mt-3 text-lg font-semibold">
                  {producerOutput?.priority ?? "PENDING"}
                </p>

                <p className="text-xs text-slate-400">
                  Producer priority
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
                  Issues identified by
                  the AI production crew
                </p>
              </div>

              <Film className="h-6 w-6 text-slate-500" />
            </div>

            <div className="mt-6 space-y-4">
              {renderedIssues.length ===
              0 ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6">
                  <p className="font-medium text-emerald-300">
                    No continuity
                    issues detected
                  </p>
                </div>
              ) : (
                renderedIssues.map(
                  (issue, index) => (
                    <article
                      key={`${issue.scene_number}-${issue.category}-${index}`}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 p-5"
                    >
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                          Scene {issue.scene_number}
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
                        Confidence: {Math.round(issue.confidence * 100)}%
                      </p>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl bg-black/20 p-4">
                          <p className="text-xs uppercase text-slate-500">
                            Expected
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {issue.expected_state}
                          </p>
                        </div>

                        <div className="rounded-xl bg-black/20 p-4">
                          <p className="text-xs uppercase text-slate-500">
                            Observed
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {issue.observed_state}
                          </p>
                        </div>
                      </div>

                      {issue.evidence && issue.evidence.length > 0 && (
                        <div className="mt-4 rounded-xl border border-sky-400/15 bg-sky-400/5 p-4">
                          <p className="text-xs uppercase text-sky-300">
                            Evidence
                          </p>
                          <div className="mt-3 space-y-2">
                            {issue.evidence.map((evidence, evidenceIndex) => (
                              <div
                                key={`${evidence.source}-${evidenceIndex}`}
                                className="text-sm leading-6 text-slate-300"
                              >
                                <span className="font-medium text-slate-200">
                                  {evidence.source}:
                                </span>{" "}
                                {evidence.detail}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  ),
                )
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}