export const demoAnalysis = {
  productionName: "The Last Train",
  continuityScore: 45,
  status: "AT_RISK",
  summary:
    "A high-confidence prop continuity conflict was detected in Scene 18.",
  stats: {
    totalScenes: 24,
    completedScenes: 17,
    openIssues: 3,
    criticalIssues: 1,
  },
  issues: [
    {
      id: "ISSUE-001",
      sceneNumber: 18,
      category: "PROP",
      severity: "HIGH",
      title: "Silver necklace reappears after being lost",
      expectedState:
        "Maya should no longer possess or wear the silver necklace.",
      observedState:
        "Production footage shows Maya wearing the silver necklace.",
      confidence: 1,
      estimatedDelayHours: 2,
      estimatedCostUsd: 1200,
      recommendation:
        "Reshoot the affected Scene 18 shots without the necklace.",
    },
    {
      id: "ISSUE-002",
      sceneNumber: 20,
      category: "LIGHTING",
      severity: "MEDIUM",
      title: "Lighting does not match the preceding scene",
      expectedState: "Late-evening platform lighting.",
      observedState: "Bright daylight is visible in the footage.",
      confidence: 0.84,
      estimatedDelayHours: 1,
      estimatedCostUsd: 450,
      recommendation:
        "Attempt a grading correction before authorizing a reshoot.",
    },
    {
      id: "ISSUE-003",
      sceneNumber: 24,
      category: "SCHEDULE",
      severity: "LOW",
      title: "Lead actor availability risk",
      expectedState: "Maya is required for the planned shoot.",
      observedState: "The actor is unavailable during the current slot.",
      confidence: 0.91,
      estimatedDelayHours: 4,
      estimatedCostUsd: 900,
      recommendation:
        "Move Scene 24 to the next available evening slot.",
    },
  ],
};