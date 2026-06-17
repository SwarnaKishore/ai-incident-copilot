record IncidentAnalysisRequest(
    string ServiceName,
    string Environment,
    string Severity,
    string Symptoms,
    string Logs,
    string AnalysisMode = "mock"
);

record IncidentAnalysisResponse(
    string Summary,
    string ProbableCause,
    string Confidence,
    string[] Evidence,
    string[] RecommendedSteps,
    RunbookReference[] RunbookReferences,
    string DraftUpdate,
    string AnalysisProvider = "Claude",
    string Model = "claude-haiku-4-5"
);

record RunbookReference(
    string Title,
    string Path,
    string Reason
);

record ClaudeProblem(
    string Title,
    string Detail,
    int StatusCode
);

record ClaudeUsageResult(
    bool IsAllowed,
    int Used,
    int Limit
);
