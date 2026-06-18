# AI Incident Copilot Service

Python FastAPI service for AI orchestration.

This service owns the AI workflow:

- Retrieves relevant runbook guidance
- Builds the structured incident prompt
- Calls Claude
- Returns the same response contract used by the React UI

## Run Locally

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY="your_real_key_here"
export ANTHROPIC_MODEL="claude-haiku-4-5"
export ALLOWED_ORIGINS="http://localhost:5173"
export CLAUDE_DAILY_LIMIT="5"
uvicorn app.main:app --reload --port 8000
```

Health check:

```text
http://localhost:8000/
```

The React app should use:

```text
VITE_API_BASE_URL=http://localhost:8000
```
