# AI Incident Copilot

AI Incident Copilot helps teams turn incident symptoms and service logs into a clear investigation brief.

The app supports a free mock mode for demos and a Claude-powered mode for real AI analysis. It is designed for production support scenarios where engineers need a quick starting point: likely cause, evidence from logs, next investigation steps, related guidance, and a draft status update.

- Works with logs from your service
- Keeps the Claude API key on the backend
- Includes input limits and daily Claude usage controls
- Deployed as a live full-stack MVP

## Live Demo

- Frontend demo: [https://ai-incident-copilot.vercel.app/](https://ai-incident-copilot.vercel.app/)
- Backend health check: [https://ai-incident-copilot-api.onrender.com/](https://ai-incident-copilot-api.onrender.com/)

Note: The backend is hosted on Render's free tier, so the first request may take a short moment if the service has been inactive.

## Screenshots

### Incident Workspace

![AI Incident Copilot workspace](docs/images/incident-copilot-workspace.png)

### Claude Analysis Result

![AI Incident Copilot Claude analysis result](docs/images/incident-copilot-analysis.png)

## Quick Demo

1. Pick a sample incident or paste logs from your service.
2. Choose Mock mode for free testing or Claude mode for real AI analysis.
3. Click Analyze incident.
4. Review the likely cause, evidence, next steps, and draft update.

## Example Input

```text
Service: Pricing API
Environment: Production
Severity: High

Symptoms:
Users are seeing 500 errors when saving price updates.

Logs:
System.TimeoutException: Timeout while connecting to PostgreSQL
ConnectionPool: Active=98 Idle=0 Waiting=42 Max=100
```

## Example Output

The app returns a readable incident brief:

- Summary
- Probable cause
- Confidence level
- Evidence found in the logs
- Recommended investigation steps
- Related runbook guidance
- Draft incident update

## Features

- Incident input form for service name, environment, severity, symptoms, and logs
- Mock mode for free repeatable demos
- Claude mode for real AI analysis
- Backend-only API key handling
- Daily Claude usage limit for cost control
- Friendly error messages when Claude is unavailable or usage limits are reached
- Generic runbook-style guidance for common production issues

## How It Works

```text
User enters symptoms and logs
        |
        v
Backend builds a structured incident prompt
        |
        +--> Adds generic runbook guidance
        |
        +--> Adds the Incident Communications Template
        |
        +--> Uses Mock mode or Claude mode
        |
        v
App displays a consistent investigation brief
```

Instead of sending raw logs directly to Claude, the backend shapes the request with incident-specific instructions and runbook context. This helps produce a more consistent response with likely cause, evidence, next steps, related guidance, and a stakeholder-ready update draft.

Project layout:

```text
ai-incident-copilot/
  backend/IncidentCopilot.Api/   .NET API and Claude integration
  frontend/                      React + TypeScript UI
  docs/runbooks/                 Generic incident triage guidance
  samples/incidents/             Sample incident payloads
```

## Built With

- Frontend: React, TypeScript, Vite
- Backend: .NET 10 Minimal API
- AI: Claude Haiku via Anthropic API
- Runbooks: Markdown-based generic triage guidance

## Running Locally

Backend:

```bash
cd backend/IncidentCopilot.Api
dotnet run
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Claude mode requires backend environment variables:

```bash
export ANTHROPIC_API_KEY="your_real_key_here"
export ANTHROPIC_MODEL="claude-haiku-4-5"
export ALLOWED_ORIGINS="http://localhost:5173"
export CLAUDE_DAILY_LIMIT="5"
```

Frontend API URL:

```bash
VITE_API_BASE_URL=http://localhost:5194
```

Mock mode works without an API key.

## Cost And Safety

- Mock mode is free and does not call Claude.
- Claude mode must be selected manually.
- API keys stay in the backend and are never exposed to the React app.
- Claude mode is limited by `CLAUDE_DAILY_LIMIT`.
- Input length limits are enforced in both the UI and backend.

## Deployment Notes

- Frontend is deployed on Vercel.
- Backend is deployed on Render.
- Claude API keys are stored only as backend environment variables.
- The frontend calls the backend through `VITE_API_BASE_URL`.

Backend environment variables:

```text
ANTHROPIC_API_KEY=your_real_key_here
ANTHROPIC_MODEL=claude-haiku-4-5
ALLOWED_ORIGINS=http://localhost:5173,https://ai-incident-copilot.vercel.app
CLAUDE_DAILY_LIMIT=5
```

Frontend environment variable:

```text
VITE_API_BASE_URL=https://ai-incident-copilot-api.onrender.com
```

## Future Enhancements

- PostgreSQL persistence for saved incidents and analysis history
- RAG over uploaded runbooks and troubleshooting documents
- Vector search for runbook retrieval
- Playwright end-to-end tests
- Evaluation cases for known incident scenarios

## License

MIT License. See [LICENSE](LICENSE).
