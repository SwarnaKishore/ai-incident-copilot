import json
import os
import urllib.error
import urllib.request
from datetime import date

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .document_store import store_runbook_document
from .models import (
    IncidentAnalysisRequest,
    IncidentAnalysisResponse,
    RetrievedRunbookReference,
    RunbookUploadRequest,
    RunbookUploadResponse,
)
from .mock_analyzer import analyze_mock
from .runbook_retriever import retrieve_runbooks


app = FastAPI(title="AI Incident Copilot Service")
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

_usage_date = date.today()
_claude_request_count = 0


@app.exception_handler(HTTPException)
def http_exception_handler(_request: Request, exception: HTTPException) -> JSONResponse:
    detail = exception.detail if isinstance(exception.detail, str) else json.dumps(exception.detail)
    title = map_error_title(exception.status_code, detail)

    return JSONResponse(
        status_code=exception.status_code,
        content={
            "title": title,
            "detail": detail,
            "status": exception.status_code,
        },
    )


@app.get("/")
def health_check() -> dict[str, str]:
    return {"name": "AI Incident Copilot AI Service", "status": "Running"}


@app.post("/api/runbooks/upload", response_model=RunbookUploadResponse)
def upload_runbook(request: RunbookUploadRequest) -> RunbookUploadResponse:
    document_id, chunk_count = store_runbook_document(request.fileName, request.content)

    return RunbookUploadResponse(
        documentId=document_id,
        fileName=request.fileName,
        chunkCount=chunk_count,
    )


@app.post("/api/incidents/analyze", response_model=IncidentAnalysisResponse)
def analyze_incident(request: IncidentAnalysisRequest) -> IncidentAnalysisResponse:
    if request.analysisMode.lower() != "claude":
        return analyze_mock(request)

    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not configured for the AI service.",
        )

    consume_claude_request()
    model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5")
    retrieved_runbooks = retrieve_runbooks(request)
    claude_response = call_claude(request, retrieved_runbooks, api_key, model)

    return claude_response.model_copy(
        update={
            "analysisProvider": "Claude",
            "model": model,
            "retrievedRunbooks": [
                RetrievedRunbookReference(title=item.title, path=item.path, reason=item.reason)
                for item in retrieved_runbooks
            ],
        }
    )


def consume_claude_request() -> None:
    global _usage_date, _claude_request_count

    daily_limit = int(os.getenv("CLAUDE_DAILY_LIMIT", "5"))
    today = date.today()

    if today != _usage_date:
        _usage_date = today
        _claude_request_count = 0

    if _claude_request_count >= daily_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Claude mode is limited to {daily_limit} requests per day for this demo. Switch to Mock mode to continue testing.",
        )

    _claude_request_count += 1


def map_error_title(status_code: int, detail: str) -> str:
    normalized = detail.lower()

    if status_code == 429:
        return "Daily Claude demo limit reached"

    if status_code in {401, 403} or "auth" in normalized or "permission" in normalized:
        return "Claude API access failed"

    if any(term in normalized for term in ["credit", "billing", "quota", "usage", "spend", "balance"]):
        return "Claude usage limit reached"

    if status_code == 503:
        return "Claude API key is not configured"

    return "Analysis request failed"


def call_claude(
    request: IncidentAnalysisRequest,
    retrieved_runbooks,
    api_key: str,
    model: str,
) -> IncidentAnalysisResponse:
    payload = {
        "model": model,
        "max_tokens": 1200,
        "temperature": 0.2,
        "system": """
You are an AI production incident copilot for senior software engineers.
Return only valid JSON with this exact shape:
{
  "summary": "string",
  "probableCause": "string",
  "confidence": "Low | Medium | High",
  "evidence": ["string"],
  "recommendedSteps": ["string"],
  "draftUpdate": "string",
  "stakeholderUpdates": {
    "engineering": "string",
    "customer": "string",
    "executive": "string"
  }
}
Be specific, operational, and honest about uncertainty. Do not invent tools or metrics that are not implied by the input.
""".strip(),
        "messages": [
            {
                "role": "user",
                "content": build_prompt(request, retrieved_runbooks),
            }
        ],
    }

    http_request = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(http_request, timeout=45) as response:
            response_body = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8")
        raise HTTPException(status_code=error.code, detail=error_body) from error
    except urllib.error.URLError as error:
        raise HTTPException(status_code=502, detail=f"Claude request failed: {error}") from error

    claude_text = extract_claude_text(response_body)
    json_text = extract_json_object(claude_text)
    return IncidentAnalysisResponse.model_validate_json(json_text)


def build_prompt(request: IncidentAnalysisRequest, retrieved_runbooks) -> str:
    runbook_context = "\n\n".join(
        f"""{index}. {runbook.title}
   Path: {runbook.path}
   Why retrieved: {runbook.reason}
   Content:
   {runbook.content}"""
        for index, runbook in enumerate(retrieved_runbooks, start=1)
    )

    return f"""
Analyze this production incident using the retrieved runbook context.

Incident:
Service: {request.serviceName}
Environment: {request.environment}
Severity: {request.severity}
Symptoms: {request.symptoms}

Logs:
{request.logs}

Retrieved runbook context:
{runbook_context}

Instructions:
- Use the retrieved runbook context when it matches the incident evidence.
- Do not return runbook reference fields; the service returns retrieved guidance separately.
- Use the Incident Communications Template to write draftUpdate in a stakeholder-ready style.
- stakeholderUpdates.engineering should be technical and useful for engineers working the incident.
- stakeholderUpdates.customer should be plain language and avoid internal implementation details.
- stakeholderUpdates.executive should be concise and summarize impact, status, suspected cause, and risk.
""".strip()


def extract_claude_text(response_body: str) -> str:
    payload = json.loads(response_body)
    content = payload.get("content", [])

    for item in content:
        text = item.get("text")
        if text:
            return text

    raise HTTPException(status_code=502, detail="Claude response did not include text content.")


def extract_json_object(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")

    if start < 0 or end <= start:
        raise HTTPException(status_code=502, detail="Claude response did not contain a JSON object.")

    return text[start : end + 1]
