# API Error and Timeout Triage

## Signals
- Elevated HTTP 5xx errors or failed operations.
- Request latency or timeout exceptions increase.
- Retry volume rises sharply.
- Connection pool waits, thread pool pressure, or request queueing appears in logs or metrics.
- Impact is concentrated around one endpoint, workflow, tenant, region, or deployment window.

## Triage Steps
1. Identify the first error time, affected service, environment, and user-facing workflow.
2. Compare error rate, latency percentiles, and traffic volume before and after the first alert.
3. Check whether failures are concentrated by endpoint, dependency, tenant, region, or release version.
4. Review recent deployments, feature flags, configuration changes, and dependency updates.
5. Inspect downstream dependency latency, timeout settings, retry policies, and connection pool usage.
6. Confirm whether retries are helping recovery or amplifying load.

## Mitigation Options
- Roll back or disable a recent change if timing strongly correlates.
- Reduce traffic to the failing workflow if a single operation is saturating dependencies.
- Increase capacity only after confirming the bottleneck is capacity-related.
- Temporarily adjust timeout or retry settings only with clear monitoring.
- Escalate to the owning dependency team when evidence points outside the service.
