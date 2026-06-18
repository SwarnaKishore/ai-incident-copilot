from .models import IncidentAnalysisRequest, IncidentAnalysisResponse, RetrievedRunbookReference
from .runbook_retriever import retrieve_runbooks


def analyze_mock(request: IncidentAnalysisRequest) -> IncidentAnalysisResponse:
    normalized_input = f"{request.serviceName} {request.symptoms} {request.logs}".lower()
    retrieved_runbooks = [
        RetrievedRunbookReference(title=item.title, path=item.path, reason=item.reason)
        for item in retrieve_runbooks(request)
    ]

    if any(signal in normalized_input for signal in ["postgres", "timeout", "pricing"]):
        return IncidentAnalysisResponse(
            summary=f"{request.serviceName} is showing {request.severity.lower()} timeout behavior in {request.environment}.",
            probableCause="Application requests are likely waiting on a slow or saturated downstream dependency, causing operations to exceed timeout limits.",
            confidence="High",
            evidence=[
                "Logs include timeout or connection-related exceptions.",
                "User impact is tied to a specific workflow, which helps narrow the blast radius.",
                "The failure mode is consistent with dependency latency, connection saturation, or a recent regression.",
            ],
            recommendedSteps=[
                "Check connection pool, thread pool, and request queue pressure for the affected service.",
                "Review slow dependency calls during the incident window.",
                "Compare error rate and database latency against the latest deployment time.",
                "Temporarily increase command timeout only if rollback is not immediately available.",
                "Prepare rollback if the issue correlates with a recent release.",
            ],
            draftUpdate=f"Investigating {request.severity.lower()} errors affecting {request.serviceName} in {request.environment}. Current evidence points to timeout behavior in a specific workflow. The team is reviewing dependency latency, resource saturation, and recent deployment timing.",
            analysisProvider="Mock",
            model="deterministic-rules",
            retrievedRunbooks=retrieved_runbooks,
        )

    if any(signal in normalized_input for signal in ["queue", "sqs", "inventory", "backlog"]):
        return IncidentAnalysisResponse(
            summary=f"{request.serviceName} is experiencing {request.severity.lower()} asynchronous processing backlog symptoms in {request.environment}.",
            probableCause="Message or job processing is likely slower than ingestion, causing backlog growth and delayed downstream updates.",
            confidence="Medium",
            evidence=[
                "Symptoms mention delayed updates and growing backlog.",
                "Queue-based systems fail this way when consumers are throttled, unhealthy, or under-scaled.",
                "No direct dependency exception was found, so consumer throughput and retry behavior should be checked first.",
            ],
            recommendedSteps=[
                "Check queue depth, in-flight work, and age of oldest message or job.",
                "Review worker error rates, throttles, duration, and concurrency limits.",
                "Inspect dead-letter queue volume for poison messages.",
                "Scale consumers or pause producers if backlog continues to grow.",
                "Replay failed messages after confirming the handler is healthy.",
            ],
            draftUpdate=f"Investigating {request.severity.lower()} processing delays affecting {request.serviceName} in {request.environment}. Current evidence suggests backlog growth and reduced consumer throughput. The team is checking queue age, worker errors, throttles, and failed message volume.",
            analysisProvider="Mock",
            model="deterministic-rules",
            retrievedRunbooks=retrieved_runbooks,
        )

    return IncidentAnalysisResponse(
        summary=f"{request.serviceName} is experiencing {request.severity.lower()} symptoms in {request.environment}.",
        probableCause="The most likely cause is a downstream dependency timeout, recent deployment regression, or resource saturation pattern.",
        confidence="Medium",
        evidence=[
            "The submitted symptoms indicate user-facing impact.",
            "Logs contain operational signals that should be correlated with metrics and deployments.",
            "More specific runbook evidence is needed to improve confidence.",
        ],
        recommendedSteps=[
            "Check recent deployments for the affected service.",
            "Review application logs around the first reported error time.",
            "Inspect database, queue, and external API latency metrics.",
            "Validate retry, timeout, and circuit breaker settings.",
            "Prepare a rollback plan if errors correlate with a recent release.",
        ],
        draftUpdate=f"Investigating {request.severity.lower()} incident affecting {request.serviceName} in {request.environment}. Initial analysis suggests dependency latency or timeout behavior. Next update will follow after log and metrics review.",
        analysisProvider="Mock",
        model="deterministic-rules",
        retrievedRunbooks=retrieved_runbooks,
    )
