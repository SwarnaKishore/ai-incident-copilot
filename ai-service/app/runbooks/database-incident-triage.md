# Database Incident Triage

## Signals
- Query latency, replication lag, or connection errors increase.
- Deadlocks, lock waits, or blocking queries appear in database logs.
- A failover, primary/replica promotion, or unexpected connection drop occurs.
- Disk usage, IOPS, or CPU on the database host approaches its limit.
- A migration or schema change correlates with the start of the incident.

## Triage Steps
1. Identify the affected database, cluster, or shard and confirm primary versus replica role.
2. Check replication lag and confirm whether reads from replicas are serving stale data.
3. Inspect active queries for long-running transactions, lock contention, or blocking sessions.
4. Review connection pool saturation and current connection count against the configured limit.
5. Check for recent migrations, index changes, or schema modifications around the incident start time.
6. Review disk, memory, CPU, and IOPS metrics for the database host for saturation.
7. Confirm whether a failover or promotion event occurred and whether the new primary is healthy.

## Mitigation Options
- Kill or cancel long-running blocking queries or transactions if safe to do so.
- Fail over to a healthy replica if the primary is degraded and failover has not already occurred automatically.
- Pause or roll back an in-progress migration if it is the suspected cause, after assessing data consistency risk.
- Temporarily reduce connection pool size or application concurrency to relieve saturation.
- Redirect non-critical reads to replicas if the primary is overloaded.
- Engage the database or platform owning team for failover, restore, or scaling decisions outside the application's control.
