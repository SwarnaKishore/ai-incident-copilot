# Dependency and Resource Saturation

## Signals
- Database, API, cache, object storage, or third-party dependency latency increases.
- Connection pools, worker pools, or thread pools approach limits.
- CPU, memory, disk, network, or lock contention increases.
- Timeouts appear without a clear application exception.
- Error spikes correlate with increased traffic or a recent release.

## Triage Steps
1. Identify the dependency or resource with the strongest latency/error correlation.
2. Check saturation metrics: active connections, queue length, CPU, memory, locks, throttles, and rate limits.
3. Compare current load against normal baselines for the same time window.
4. Review recent code, configuration, schema, index, or infrastructure changes.
5. Determine whether one workflow, query, route, tenant, or region is creating disproportionate load.
6. Validate whether retries, batch size, or concurrency settings are worsening saturation.

## Mitigation Options
- Roll back or disable a change that introduced excessive dependency load.
- Reduce concurrency, batch size, or retry aggressiveness when retries amplify pressure.
- Add capacity only when saturation is confirmed and safe.
- Degrade non-critical features to protect core workflows.
- Engage the dependency owner with evidence, timelines, and correlated metrics.
