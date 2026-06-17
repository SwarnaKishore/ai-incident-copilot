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
    string DraftUpdate,
    string AnalysisProvider = "Claude",
    string Model = "claude-haiku-4-5"
)
{
    public RetrievedRunbookReference[] RetrievedRunbooks { get; init; } = [];
}

record RetrievedRunbookReference(
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
