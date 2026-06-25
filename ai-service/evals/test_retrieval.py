import sys
from pathlib import Path

import pytest


sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.document_store import store_runbook_document  # noqa: E402
from app.models import IncidentAnalysisRequest  # noqa: E402
from app.runbook_retriever import retrieve_runbooks  # noqa: E402


def create_checkout_runbook() -> str:
    document_id, _chunk_count = store_runbook_document(
        "checkout-runbook.md",
        """
# Checkout Promo Runbook

If promo-discount-v2 causes checkout failures, disable the LaunchDarkly feature flag before rolling back checkout-api.
Monitor checkout success rate, payment authorization rate, and order creation latency for 15 minutes.
Escalate to Pricing if promotion validation errors continue after disabling the flag.

# Inventory Notes

For inventory delays, check SQS queue depth, worker throttling, and DLQ volume.
""".strip(),
    )

    return document_id


CHECKOUT_DOCUMENT_ID = create_checkout_runbook()

RETRIEVAL_CASES = [
    {
        "id": "checkout-deploy-failure",
        "incident": {
            "serviceName": "checkout-service",
            "environment": "production",
            "severity": "P1",
            "symptoms": "Error rate spiked immediately after deploy. New NullPointerException in order processor.",
            "logs": "NullPointerException at OrderProcessor.java",
            "analysisMode": "mock",
        },
        "expected_runbooks": ["Deployment and Release Rollback Triage"],
        "must_not_retrieve": ["Async Processing Backlog Triage"],
    },
    {
        "id": "inventory-backlog",
        "incident": {
            "serviceName": "inventory-service",
            "environment": "production",
            "severity": "P2",
            "symptoms": "SQS queue depth growing. Workers processing slowly. DLQ receiving messages.",
            "logs": "Consumer timeout after 30s. Dead letter queue count elevated.",
            "analysisMode": "mock",
        },
        "expected_runbooks": ["Async Processing Backlog Triage"],
        "must_not_retrieve": ["Deployment and Release Rollback Triage"],
    },
    {
        "id": "pricing-timeout",
        "incident": {
            "serviceName": "pricing-service",
            "environment": "production",
            "severity": "P1",
            "symptoms": "p99 latency at 8s. Connection pool exhausted. PostgreSQL query times elevated.",
            "logs": "Connection pool timeout. Waiting for available connection.",
            "analysisMode": "mock",
        },
        "expected_runbooks": [
            "API Error and Timeout Triage",
            "Dependency and Resource Saturation",
        ],
        "must_not_retrieve": [],
    },
    {
        "id": "uploaded-checkout-runbook",
        "incident": {
            "serviceName": "checkout-service",
            "environment": "production",
            "severity": "P1",
            "symptoms": "Checkout failures for promo code orders after release.",
            "logs": "FeatureFlag=promo-discount-v2 Enabled=true. Promotion validation failed.",
            "runbookDocumentIds": [CHECKOUT_DOCUMENT_ID],
            "analysisMode": "mock",
        },
        "expected_runbooks": ["Stored runbook excerpt 1"],
        "must_not_retrieve": [],
    },
]


@pytest.mark.parametrize("case", RETRIEVAL_CASES, ids=[case["id"] for case in RETRIEVAL_CASES])
def test_retrieval(case):
    request = IncidentAnalysisRequest(**case["incident"])
    results = retrieve_runbooks(request)
    retrieved_titles = [result.title for result in results]

    for expected in case["expected_runbooks"]:
        assert expected in retrieved_titles, (
            f"[{case['id']}] Expected '{expected}' but got: {retrieved_titles}"
        )

    for excluded in case["must_not_retrieve"]:
        assert excluded not in retrieved_titles, (
            f"[{case['id']}] '{excluded}' should not have been retrieved: {retrieved_titles}"
        )
