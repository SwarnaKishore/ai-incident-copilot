import re
from pathlib import Path

from .models import IncidentAnalysisRequest, RetrievedRunbook


MAX_RELEVANT_RUNBOOKS = 2
MINIMUM_RELEVANT_SCORE = 2
MAX_SNIPPET_LENGTH = 2200
TOKEN_PATTERN = re.compile(r"[a-z0-9]{3,}", re.IGNORECASE)
STOP_WORDS = {
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "while",
    "when",
    "into",
    "your",
    "service",
    "services",
    "logs",
    "error",
    "errors",
    "issue",
    "incident",
    "production",
}


def retrieve_runbooks(request: IncidentAnalysisRequest) -> list[RetrievedRunbook]:
    query = f"{request.serviceName} {request.environment} {request.severity} {request.symptoms} {request.logs}"
    query_terms = set(tokenize(query))
    runbooks = load_runbooks()

    ranked = [
        score_runbook(title, path, content, query_terms)
        for title, path, content in runbooks
        if "incident-communications" not in path
    ]
    selected = [
        runbook
        for runbook in sorted(ranked, key=lambda item: item.score, reverse=True)
        if runbook.score >= MINIMUM_RELEVANT_SCORE
    ][:MAX_RELEVANT_RUNBOOKS]

    communications = next(
        ((title, path, content) for title, path, content in runbooks if "incident-communications" in path),
        None,
    )

    if communications:
        title, path, content = communications
        selected.append(
            RetrievedRunbook(
                title=title,
                path=path,
                reason="Used to shape the draft incident update with impact, suspected cause, mitigation, and next-update wording.",
                content=trim_snippet(content),
                score=0,
            )
        )

    return selected


def load_runbooks() -> list[tuple[str, str, str]]:
    runbook_dir = Path(__file__).parent / "runbooks"
    runbooks: list[tuple[str, str, str]] = []

    for path in sorted(runbook_dir.glob("*.md")):
        content = path.read_text(encoding="utf-8")
        runbooks.append((extract_title(content), f"ai-service/app/runbooks/{path.name}", content))

    return runbooks


def score_runbook(title: str, path: str, content: str, query_terms: set[str]) -> RetrievedRunbook:
    runbook_terms = set(tokenize(f"{title} {content}"))
    matched_terms = [term for term in query_terms if term in runbook_terms][:8]

    return RetrievedRunbook(
        title=title,
        path=path,
        reason=build_reason(title, matched_terms),
        content=trim_snippet(content),
        score=len(matched_terms),
    )


def extract_title(content: str) -> str:
    for line in content.splitlines():
        if line.startswith("# "):
            return line.removeprefix("# ").strip()

    return "Untitled Runbook"


def tokenize(value: str) -> list[str]:
    return [
        match.group(0).lower()
        for match in TOKEN_PATTERN.finditer(value)
        if match.group(0).lower() not in STOP_WORDS
    ]


def build_reason(title: str, matched_terms: list[str]) -> str:
    if not matched_terms:
        return "Used as general incident guidance for the generated response."

    readable_terms = []
    for term in matched_terms:
        formatted = format_term(term)
        if formatted.lower() not in [existing.lower() for existing in readable_terms]:
            readable_terms.append(formatted)

    focus = get_guidance_focus(title)
    return f"Selected because the incident mentions {', '.join(readable_terms[:5])}. {focus}"


def get_guidance_focus(title: str) -> str:
    normalized = title.lower()

    if "api error" in normalized:
        return "Use this to review error rates, latency, timeout settings, retries, and dependency health."

    if "async" in normalized:
        return "Use this to review queue depth, consumer throughput, dead-letter volume, throttling, and replay decisions."

    if "dependency" in normalized:
        return "Use this to review connection pools, resource saturation, dependency latency, and deployment correlation."

    if "deployment" in normalized or "rollback" in normalized:
        return "Use this to review release timing, canary impact, feature flags, rollback options, and post-rollback validation."

    if "database" in normalized:
        return "Use this to review replication lag, blocking queries, failover state, migrations, and database resource pressure."

    return "Use this guidance to keep the investigation focused and repeatable."


def format_term(term: str) -> str:
    replacements = {
        "connectionpool": "connection pool",
        "postgresql": "PostgreSQL",
        "sqs": "SQS",
        "dlq": "DLQ",
    }

    return replacements.get(term, term)


def trim_snippet(content: str) -> str:
    if len(content) <= MAX_SNIPPET_LENGTH:
        return content

    return f"{content[:MAX_SNIPPET_LENGTH]}..."
