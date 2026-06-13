# Inventory Queue Backlog Runbook

## Signals
- SQS visible message count and age of oldest message increase.
- Inventory updates appear late in downstream systems.
- Worker errors, Lambda throttles, or dead-letter queue messages increase.

## Triage Steps
1. Check visible message count, in-flight count, and age of oldest message.
2. Review worker success rate, duration, throttles, and concurrency limits.
3. Inspect the dead-letter queue for poison messages.
4. Confirm whether a producer started publishing unusually high volume.
5. Scale consumers or pause producers if the queue continues to grow.

## Mitigation Options
- Increase worker concurrency after confirming downstream dependencies can handle it.
- Replay DLQ messages after fixing handler failures.
- Temporarily disable non-critical producers during severe backlog growth.
