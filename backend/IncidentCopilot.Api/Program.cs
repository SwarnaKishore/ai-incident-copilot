var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Frontend");

app.MapGet("/", () => Results.Ok(new
{
    name = "AI Incident Copilot API",
    status = "Running"
}));

app.MapPost("/api/incidents/analyze", (IncidentAnalysisRequest request) =>
{
    var response = IncidentAnalyzer.Analyze(request);
    return Results.Ok(response);
});

app.Run();

static class IncidentAnalyzer
{
    public static IncidentAnalysisResponse Analyze(IncidentAnalysisRequest request)
    {
        var normalizedInput = $"{request.ServiceName} {request.Symptoms} {request.Logs}".ToLowerInvariant();

        if (normalizedInput.Contains("postgres") || normalizedInput.Contains("timeout") || normalizedInput.Contains("pricing"))
        {
            return new IncidentAnalysisResponse(
                Summary: $"{request.ServiceName} is showing {request.Severity.ToLowerInvariant()} database timeout behavior in {request.Environment}.",
                ProbableCause: "Application requests are likely waiting on PostgreSQL connections or slow price-save queries, causing API calls to exceed timeout limits.",
                Confidence: "High",
                Evidence:
                [
                    "Logs include a PostgreSQL timeout exception.",
                    "User impact is tied to saving price updates, which is a database-backed workflow.",
                    "The failure mode is consistent with connection pool saturation or a slow query regression."
                ],
                RecommendedSteps:
                [
                    "Check PostgreSQL connection pool usage for the Pricing API.",
                    "Review slow query logs for price update statements during the incident window.",
                    "Compare error rate and database latency against the latest deployment time.",
                    "Temporarily increase command timeout only if rollback is not immediately available.",
                    "Prepare rollback if the issue correlates with a recent release."
                ],
                RunbookReferences:
                [
                    new RunbookReference("Pricing API Database Timeout Runbook", "docs/runbooks/pricing-api-database-timeouts.md", "Database connection saturation and slow query triage"),
                    new RunbookReference("Incident Comms Template", "docs/runbooks/incident-communications.md", "Customer and stakeholder update guidance")
                ],
                DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} errors affecting {request.ServiceName} in {request.Environment}. Current evidence points to PostgreSQL timeout behavior during price-save operations. The team is reviewing connection pool usage, slow queries, and recent deployment timing."
            );
        }

        if (normalizedInput.Contains("queue") || normalizedInput.Contains("sqs") || normalizedInput.Contains("inventory") || normalizedInput.Contains("backlog"))
        {
            return new IncidentAnalysisResponse(
                Summary: $"{request.ServiceName} is experiencing {request.Severity.ToLowerInvariant()} queue backlog symptoms in {request.Environment}.",
                ProbableCause: "Message processing is likely slower than message ingestion, causing SQS backlog growth and delayed downstream updates.",
                Confidence: "Medium",
                Evidence:
                [
                    "Symptoms mention delayed updates and growing backlog.",
                    "Queue-based systems fail this way when consumers are throttled, unhealthy, or under-scaled.",
                    "No direct database exception was found, so consumer throughput should be checked first."
                ],
                RecommendedSteps:
                [
                    "Check SQS visible message count and age of oldest message.",
                    "Review Lambda or worker error rates, throttles, and concurrency limits.",
                    "Inspect dead-letter queue volume for poison messages.",
                    "Scale consumers or pause producers if backlog continues to grow.",
                    "Replay failed messages after confirming the handler is healthy."
                ],
                RunbookReferences:
                [
                    new RunbookReference("Inventory Queue Backlog Runbook", "docs/runbooks/inventory-queue-backlog.md", "SQS backlog and consumer throughput triage"),
                    new RunbookReference("Incident Comms Template", "docs/runbooks/incident-communications.md", "Customer and stakeholder update guidance")
                ],
                DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} processing delays affecting {request.ServiceName} in {request.Environment}. Current evidence suggests queue backlog growth and reduced consumer throughput. The team is checking SQS age, worker errors, throttles, and DLQ volume."
            );
        }

        return new IncidentAnalysisResponse(
            Summary: $"{request.ServiceName} is experiencing {request.Severity.ToLowerInvariant()} symptoms in {request.Environment}.",
            ProbableCause: "The most likely cause is a downstream dependency timeout, recent deployment regression, or resource saturation pattern.",
            Confidence: "Medium",
            Evidence:
            [
                "The submitted symptoms indicate user-facing impact.",
                "Logs contain operational signals that should be correlated with metrics and deployments.",
                "More specific runbook evidence is needed to improve confidence."
            ],
            RecommendedSteps:
            [
                "Check recent deployments for the affected service.",
                "Review application logs around the first reported error time.",
                "Inspect database, queue, and external API latency metrics.",
                "Validate retry, timeout, and circuit breaker settings.",
                "Prepare a rollback plan if errors correlate with a recent release."
            ],
            RunbookReferences:
            [
                new RunbookReference("Incident Comms Template", "docs/runbooks/incident-communications.md", "General incident update guidance")
            ],
            DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} incident affecting {request.ServiceName} in {request.Environment}. Initial analysis suggests dependency latency or timeout behavior. Next update will follow after log and metrics review."
        );
    }
}

record IncidentAnalysisRequest(
    string ServiceName,
    string Environment,
    string Severity,
    string Symptoms,
    string Logs
);

record IncidentAnalysisResponse(
    string Summary,
    string ProbableCause,
    string Confidence,
    string[] Evidence,
    string[] RecommendedSteps,
    RunbookReference[] RunbookReferences,
    string DraftUpdate
);

record RunbookReference(
    string Title,
    string Path,
    string Reason
);
