# Async Processing Backlog Triage

## Signals
- Queue depth, job backlog, or age of oldest message increases.
- Downstream systems receive delayed updates.
- Worker errors, throttles, retries, or dead-letter volume increase.
- Processing duration rises while producer volume stays steady or increases.
- One message type, tenant, partition, or handler appears to dominate failures.

## Triage Steps
1. Check backlog size, in-flight work, oldest item age, and consumer throughput.
2. Compare producer volume with consumer success rate and processing duration.
3. Inspect worker logs for poison messages, schema changes, dependency errors, or throttling.
4. Review dead-letter queue volume and the most common failure reasons.
5. Confirm whether the bottleneck is worker capacity, downstream dependency latency, or bad input data.
6. Check recent deployments and configuration changes for consumers and producers.

## Mitigation Options
- Scale consumers when downstream dependencies can safely absorb more load.
- Pause or throttle producers if backlog is growing faster than it can drain.
- Isolate poison messages and replay them only after the handler is fixed.
- Temporarily route non-critical jobs to a lower-priority queue.
- Communicate expected delay and recovery progress to affected stakeholders.
