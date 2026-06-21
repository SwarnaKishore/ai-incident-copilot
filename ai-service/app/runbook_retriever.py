import re
from pathlib import Path

from .models import IncidentAnalysisRequest, RetrievedRunbook


MAX_RELEVANT_RUNBOOKS = 2
MINIMUM_RELEVANT_SCORE = 2
MAX_SNIPPET_LENGTH = 2200
MAX_UPLOADED_RUNBOOK_CHUNKS = 4
UPLOADED_CHUNK_SIZE = 1800
UPLOADED_CHUNK_OVERLAP = 250
TOKEN_PATTERN = re.compile(r"[a-z0-9]{3,}", re.IGNORECASE)
STOP_WORDS = {
    "the",
    "and",
    "are",
    "was",
    "were",
    "been",
    "being",
    "for",
    "with",
    "this",
    "that",
    "from",
    "after",
    "before",
    "during",
    "while",
    "when",
    "into",
    "than",
    "your",
    "using",
    "users",
    "seeing",
    "appears",
    "latest",
    "disable",
    "compare",
    "impact",
    "back",
    "against",
    "sessions",
    "non",
    "high",
    "critical",
    "medium",
    "low",
    "service",
    "services",
    "logs",
    "error",
    "errors",
    "failed",
    "failure",
    "failures",
    "promotion",
    "promotional",
    "issue",
    "incident",
    "production",
}

RUNBOOK_SIGNAL_TERMS = {
    "api-error-and-timeout-triage": {
        "5xx",
        "api",
        "exception",
        "http",
        "latency",
        "operation",
        "request",
        "retry",
        "rate",
        "timeout",
        "workflow",
    },
    "async-processing-backlog-triage": {
        "backlog",
        "consumer",
        "dead",
        "dlq",
        "lambda",
        "message",
        "queue",
        "sqs",
        "throttling",
        "worker",
    },
    "database-incident-triage": {
        "blocking",
        "connection",
        "database",
        "deadlock",
        "failover",
        "iops",
        "lock",
        "postgresql",
        "query",
        "replica",
        "replication",
    },
    "dependency-and-resource-saturation": {
        "connection",
        "cpu",
        "dependency",
        "disk",
        "memory",
        "pool",
        "rate",
        "resource",
        "saturation",
        "throttle",
    },
    "deployment-and-release-rollback": {
        "canary",
        "commit",
        "config",
        "deploy",
        "deployment",
        "feature",
        "flag",
        "release",
        "rollback",
        "rollout",
        "version",
    },
}


def retrieve_runbooks(request: IncidentAnalysisRequest) -> list[RetrievedRunbook]:
    query = f"{request.serviceName} {request.symptoms} {request.logs} {request.companyRunbookNotes}"
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

    if request.companyRunbookNotes.strip():
        selected.append(
            RetrievedRunbook(
                title="Company runbook notes",
                path="company-runbook-notes",
                reason="Included because company-specific runbook notes were provided with this incident.",
                content=trim_snippet(request.companyRunbookNotes.strip()),
                score=0,
            )
        )

    selected.extend(retrieve_uploaded_runbook_chunks(request.uploadedRunbookText, query_terms))

    return selected


def retrieve_uploaded_runbook_chunks(uploaded_text: str, query_terms: set[str]) -> list[RetrievedRunbook]:
    if not uploaded_text.strip():
        return []

    chunks = chunk_text(uploaded_text.strip())
    ranked_chunks = [
        score_uploaded_chunk(chunk, index, query_terms)
        for index, chunk in enumerate(chunks, start=1)
    ]

    return [
        chunk
        for chunk in sorted(ranked_chunks, key=lambda item: item.score, reverse=True)
        if chunk.score >= MINIMUM_RELEVANT_SCORE
    ][:MAX_UPLOADED_RUNBOOK_CHUNKS]


def chunk_text(text: str) -> list[str]:
    paragraphs = [paragraph.strip() for paragraph in re.split(r"\n\s*\n", text) if paragraph.strip()]
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        next_chunk = f"{current}\n\n{paragraph}".strip() if current else paragraph

        if len(next_chunk) <= UPLOADED_CHUNK_SIZE:
            current = next_chunk
            continue

        if current:
            chunks.append(current)

        if len(paragraph) <= UPLOADED_CHUNK_SIZE:
            current = paragraph
        else:
            chunks.extend(split_long_text(paragraph))
            current = ""

    if current:
        chunks.append(current)

    return chunks


def split_long_text(text: str) -> list[str]:
    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = min(start + UPLOADED_CHUNK_SIZE, len(text))
        chunks.append(text[start:end])
        start = max(end - UPLOADED_CHUNK_OVERLAP, end)

    return chunks


def score_uploaded_chunk(content: str, index: int, query_terms: set[str]) -> RetrievedRunbook:
    chunk_terms = set(tokenize(content))
    matched_terms = sorted(term for term in query_terms if term in chunk_terms)

    return RetrievedRunbook(
        title=f"Uploaded runbook excerpt {index}",
        path=f"uploaded-runbook#chunk-{index}",
        reason=build_uploaded_reason(matched_terms),
        content=trim_snippet(content),
        score=len(matched_terms),
    )


def build_uploaded_reason(matched_terms: list[str]) -> str:
    if not matched_terms:
        return "Selected from the uploaded runbook document."

    readable_terms = []
    for term in matched_terms:
        formatted = format_term(term)
        if formatted.lower() not in [existing.lower() for existing in readable_terms]:
            readable_terms.append(formatted)

    return f"Selected from the uploaded runbook because it mentions {', '.join(readable_terms[:5])}."


def load_runbooks() -> list[tuple[str, str, str]]:
    runbook_dir = Path(__file__).parent / "runbooks"
    runbooks: list[tuple[str, str, str]] = []

    for path in sorted(runbook_dir.glob("*.md")):
        content = path.read_text(encoding="utf-8")
        runbooks.append((extract_title(content), f"ai-service/app/runbooks/{path.name}", content))

    return runbooks


def score_runbook(title: str, path: str, content: str, query_terms: set[str]) -> RetrievedRunbook:
    runbook_terms = set(tokenize(f"{title} {content}"))
    matched_terms = sorted(term for term in query_terms if term in runbook_terms)
    score = len(matched_terms)

    signal_terms = RUNBOOK_SIGNAL_TERMS.get(Path(path).stem, set())
    signal_matches = [term for term in matched_terms if term in signal_terms]
    score += len(signal_matches) * 3

    if Path(path).stem == "deployment-and-release-rollback" and {"feature", "flag", "release"} & query_terms:
        score += 4

    return RetrievedRunbook(
        title=title,
        path=path,
        reason=build_reason(title, signal_matches or matched_terms),
        content=trim_snippet(content),
        score=score,
    )


def extract_title(content: str) -> str:
    for line in content.splitlines():
        if line.startswith("# "):
            return line.removeprefix("# ").strip()

    return "Untitled Runbook"


def tokenize(value: str) -> list[str]:
    normalized = normalize_text(value)
    tokens: list[str] = []

    for match in TOKEN_PATTERN.finditer(normalized):
        token = match.group(0).lower()

        if token in STOP_WORDS:
            continue

        tokens.append(token)

        if token.endswith("s") and len(token) > 4:
            tokens.append(token[:-1])

    return tokens


def normalize_text(value: str) -> str:
    normalized = re.sub(r"([a-z])([A-Z])", r"\1 \2", value)
    normalized = re.sub(r"feature\s*flag", "feature flag", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"release\s*version", "release version", normalized, flags=re.IGNORECASE)
    return normalized


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
