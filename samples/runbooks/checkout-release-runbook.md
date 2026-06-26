# Checkout Release Runbook

Use this runbook when checkout failures increase after a release, feature flag change, or promotion logic update.

## Signals

- Checkout error rate increases shortly after a deployment.
- Failures are isolated to orders with discounts, coupons, promotions, or feature-flagged checkout logic.
- Logs include validation failures after pricing, promotion, tax, payment, or order calculation steps.
- A feature flag was recently enabled for a subset of checkout traffic.
- Business metrics such as order completion rate or payment authorization rate drop after release.

## Triage Steps

1. Confirm the release version, deployment time, and enabled feature flags.
2. Compare checkout success rate before and after the release.
3. Check whether failures affect all orders or only promotional checkout paths.
4. Review logs for validation failures, missing pricing fields, or unexpected response shapes.
5. Compare failed checkout payloads with successful non-promotion orders.
6. Check whether pricing, promotion, tax, or payment services changed contracts recently.
7. Identify whether disabling a feature flag is safer than rolling back the full release.

## Mitigation Options

- Disable the affected checkout feature flag if failures are isolated to that path.
- Pause the rollout if the release is still in canary or staged deployment.
- Roll back to the last known-good checkout version if the issue affects normal checkout traffic.
- Escalate to the pricing or promotions owner if response contract changes are suspected.
- Monitor checkout success rate and order completion rate for at least 15 minutes after mitigation.

## Stakeholder Update Notes

- Include customer impact in simple terms, such as promotional checkout failures.
- Mention the active mitigation, such as disabling a feature flag or rolling back a release.
- Include the next validation step and when the next update will be shared.
