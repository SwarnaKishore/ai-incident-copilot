# Pricing API Database Timeout Runbook

## Signals
- HTTP 500 errors increase on price-save workflows.
- Logs include PostgreSQL or Npgsql timeout exceptions.
- Connection pool waits increase while idle connections approach zero.

## Triage Steps
1. Check API error rate, latency, and request volume.
2. Review PostgreSQL active connections, lock waits, and slow query logs.
3. Compare the incident start time with recent deployments.
4. Identify whether one endpoint or tenant is driving most traffic.
5. Roll back the latest pricing deployment if timeout spikes align with release timing.

## Mitigation Options
- Scale API instances if thread or request queues are saturated.
- Reduce traffic from the failing workflow if a single job is creating pressure.
- Tune query indexes after confirming the slow statement.
- Increase timeout only as a temporary mitigation while root cause is validated.
