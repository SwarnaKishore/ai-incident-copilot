# Deployment and Release Rollback Triage

## Signals
- Error rate, latency, or crash rate increases shortly after a deployment, release, or configuration rollout.
- New exception types or stack traces appear that were not present before the latest release.
- A canary or staged rollout shows degraded metrics compared to the control group.
- Incident start time aligns closely with a deployment window, schema migration, or config push.
- A relevant feature flag or rollback has not yet been attempted.

## Triage Steps
1. Confirm the deployment timeline: exact deploy time, commit or version, and which services or configs changed.
2. Compare error rate, latency, and key business metrics immediately before and after the deploy.
3. Check canary or staged rollout dashboards to see if impact is isolated to a percentage of traffic.
4. Identify whether the change included a feature flag, config flag, or migration that can be toggled independently of a full rollback.
5. Review the diff or changelog for the release to find high-risk changes such as schema edits, dependency version bumps, or infrastructure changes.
6. Determine blast radius: how many users, tenants, or regions are affected by the deployed change.

## Mitigation Options
- Disable the responsible feature flag first if one exists; this is usually faster and safer than a full rollback.
- Roll back to the last known-good version if no flag is available or the issue persists after disabling flags.
- Halt or pause the rollout if using a canary or staged deployment strategy, before it expands further.
- Do not blindly roll back a database migration that has already run destructive operations; confirm a safe reverse path with the data owner first.
- After mitigation, validate that dashboards have returned to baseline before closing the incident.
- Document the suspected root cause and link the related commit, pull request, or change ticket.
