static class IncidentAnalyzer
{
    public static IncidentAnalysisResponse Analyze(IncidentAnalysisRequest request)
    {
        var normalizedInput = $"{request.ServiceName} {request.Symptoms} {request.Logs}".ToLowerInvariant();

        if (normalizedInput.Contains("postgres") || normalizedInput.Contains("timeout") || normalizedInput.Contains("pricing"))
        {
            return new IncidentAnalysisResponse(
                Summary: $"{request.ServiceName} is showing {request.Severity.ToLowerInvariant()} timeout behavior in {request.Environment}.",
                ProbableCause: "Application requests are likely waiting on a slow or saturated downstream dependency, causing operations to exceed timeout limits.",
                Confidence: "High",
                Evidence:
                [
                    "Logs include timeout or connection-related exceptions.",
                    "User impact is tied to a specific workflow, which helps narrow the blast radius.",
                    "The failure mode is consistent with dependency latency, connection saturation, or a recent regression."
                ],
                RecommendedSteps:
                [
                    "Check connection pool, thread pool, and request queue pressure for the affected service.",
                    "Review slow dependency calls during the incident window.",
                    "Compare error rate and database latency against the latest deployment time.",
                    "Temporarily increase command timeout only if rollback is not immediately available.",
                    "Prepare rollback if the issue correlates with a recent release."
                ],
                RunbookReferences:
                [
                    new RunbookReference("API Error and Timeout Triage", "docs/runbooks/api-error-and-timeout-triage.md", "Timeout and 5xx investigation guidance"),
                    new RunbookReference("Dependency and Resource Saturation", "docs/runbooks/dependency-and-resource-saturation.md", "Downstream dependency and saturation triage"),
                    new RunbookReference("Incident Comms Template", "docs/runbooks/incident-communications.md", "Customer and stakeholder update guidance")
                ],
                DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} errors affecting {request.ServiceName} in {request.Environment}. Current evidence points to timeout behavior in a specific workflow. The team is reviewing dependency latency, resource saturation, and recent deployment timing.",
                AnalysisProvider: "Mock",
                Model: "deterministic-rules"
            );
        }

        if (normalizedInput.Contains("queue") || normalizedInput.Contains("sqs") || normalizedInput.Contains("inventory") || normalizedInput.Contains("backlog"))
        {
            return new IncidentAnalysisResponse(
                Summary: $"{request.ServiceName} is experiencing {request.Severity.ToLowerInvariant()} asynchronous processing backlog symptoms in {request.Environment}.",
                ProbableCause: "Message or job processing is likely slower than ingestion, causing backlog growth and delayed downstream updates.",
                Confidence: "Medium",
                Evidence:
                [
                    "Symptoms mention delayed updates and growing backlog.",
                    "Queue-based systems fail this way when consumers are throttled, unhealthy, or under-scaled.",
                    "No direct dependency exception was found, so consumer throughput and retry behavior should be checked first."
                ],
                RecommendedSteps:
                [
                    "Check queue depth, in-flight work, and age of oldest message or job.",
                    "Review worker error rates, throttles, duration, and concurrency limits.",
                    "Inspect dead-letter queue volume for poison messages.",
                    "Scale consumers or pause producers if backlog continues to grow.",
                    "Replay failed messages after confirming the handler is healthy."
                ],
                RunbookReferences:
                [
                    new RunbookReference("Async Processing Backlog Triage", "docs/runbooks/async-processing-backlog-triage.md", "Queue and worker backlog investigation guidance"),
                    new RunbookReference("Dependency and Resource Saturation", "docs/runbooks/dependency-and-resource-saturation.md", "Dependency bottleneck and resource pressure triage"),
                    new RunbookReference("Incident Comms Template", "docs/runbooks/incident-communications.md", "Customer and stakeholder update guidance")
                ],
                DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} processing delays affecting {request.ServiceName} in {request.Environment}. Current evidence suggests backlog growth and reduced consumer throughput. The team is checking queue age, worker errors, throttles, and failed message volume.",
                AnalysisProvider: "Mock",
                Model: "deterministic-rules"
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
            DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} incident affecting {request.ServiceName} in {request.Environment}. Initial analysis suggests dependency latency or timeout behavior. Next update will follow after log and metrics review.",
            AnalysisProvider: "Mock",
            Model: "deterministic-rules"
        );
    }
}
