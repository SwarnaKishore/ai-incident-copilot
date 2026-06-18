import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type IncidentForm = {
  serviceName: string
  environment: string
  severity: string
  symptoms: string
  logs: string
  analysisMode: 'mock' | 'claude'
}

type RetrievedGuidance = {
  title: string
  path: string
  reason: string
}

type IncidentAnalysis = {
  summary: string
  probableCause: string
  confidence: string
  evidence: string[]
  recommendedSteps: string[]
  retrievedRunbooks?: RetrievedGuidance[]
  draftUpdate: string
  analysisProvider: string
  model: string
}

type ProblemDetails = {
  title?: string
  detail?: string
  status?: number
}

type DemoScenario = IncidentForm & {
  id: string
  name: string
  description: string
}

const inputLimits = {
  serviceName: 80,
  symptoms: 1000,
  logs: 4000,
} as const

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const demoScenarios: DemoScenario[] = [
  {
    id: 'pricing-timeout',
    name: 'Pricing API timeout',
    description: 'PostgreSQL timeout during price-save workflow',
    serviceName: 'Pricing API',
    environment: 'Production',
    severity: 'High',
    analysisMode: 'mock',
    symptoms: 'Users are seeing 500 errors when saving price updates. The issue started shortly after the morning deployment and appears limited to price maintenance workflows.',
    logs: `2026-06-13T14:08:22Z ERR Pricing.Api.PriceUpdateController Save failed
System.TimeoutException: Timeout while connecting to PostgreSQL
Npgsql.NpgsqlException: Exception while reading from stream
ConnectionPool: Active=98 Idle=0 Waiting=42 Max=100
TraceId=prd-price-7f21`,
  },
  {
    id: 'inventory-backlog',
    name: 'Inventory queue backlog',
    description: 'SQS backlog delaying inventory availability updates',
    serviceName: 'Inventory Sync Worker',
    environment: 'Production',
    severity: 'Critical',
    analysisMode: 'mock',
    symptoms: 'Inventory availability is delayed across multiple downstream systems. Operations reports that purchase order updates are not appearing for stores.',
    logs: `2026-06-13T15:42:10Z WARN InventorySyncWorker Queue depth rising
Queue=inventory-events VisibleMessages=18432 AgeOfOldestMessage=00:27:14
AWS.Lambda.ThrottlingException: Rate exceeded
DLQ messages increased from 12 to 438 in 15 minutes
ConsumerSuccessRate=71%`,
  },
]

const initialForm: IncidentForm = demoScenarios[0]

const getErrorMessage = async (response: Response) => {
  try {
    const problem = (await response.json()) as ProblemDetails
    const title = problem.title ?? 'Analysis request failed'
    const detail = problem.detail ? ` ${problem.detail}` : ''

    return `${title}.${detail}`
  } catch {
    return 'Analysis request failed. Please try again or switch to Mock mode.'
  }
}

function App() {
  const [form, setForm] = useState<IncidentForm>(initialForm)
  const [selectedScenarioId, setSelectedScenarioId] = useState(demoScenarios[0].id)
  const [analysis, setAnalysis] = useState<IncidentAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const updateField = (field: keyof IncidentForm, value: string) => {
    setSelectedScenarioId('custom')
    setForm((current) => ({ ...current, [field]: value }))
  }

  const renderCounter = (value: string, limit: number) => (
    <span className={value.length >= limit ? 'char-count at-limit' : 'char-count'}>
      {value.length.toLocaleString()} / {limit.toLocaleString()}
    </span>
  )

  const modeDescription =
    form.analysisMode === 'claude'
      ? 'Claude mode uses the backend API key and is limited to 5 demo requests per day.'
      : 'Mock mode is free and returns deterministic sample analysis.'

  const loadScenario = (scenario: DemoScenario) => {
    setSelectedScenarioId(scenario.id)
    setForm({
      serviceName: scenario.serviceName,
      environment: scenario.environment,
      severity: scenario.severity,
      analysisMode: form.analysisMode,
      symptoms: scenario.symptoms,
      logs: scenario.logs,
    })
    setAnalysis(null)
    setError('')
  }

  const analyzeIncident = async (event: FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setAnalysis(null)

    try {
      const response = await fetch(`${apiBaseUrl}/api/incidents/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const data = (await response.json()) as IncidentAnalysis
      setAnalysis(data)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to analyze the incident. Confirm the FastAPI backend is running on port 8000.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace-hero">
        <div className="workspace-header">
          <p className="eyebrow">AI Incident Copilot</p>
          <h1>Production incident analysis workspace</h1>
          <p className="intro">
            Turn incident symptoms and logs into an investigation brief your team can act on.
          </p>
          <div className="hero-chips" aria-label="Analysis outputs">
            <span>Likely cause</span>
            <span>Next steps</span>
            <span>Runbook guidance</span>
            <span>Status draft</span>
          </div>
        </div>

        <div className="hero-summary">
          <div className="hero-status">
            <span>Active mode</span>
            <strong>{form.analysisMode === 'claude' ? 'Claude analysis' : 'Mock analysis'}</strong>
          </div>
          <p>
            Mock is free for demos. Claude uses the backend AI configuration for real analysis.
          </p>
        </div>
      </section>

      <section className="mode-guide" aria-label="How to use AI Incident Copilot">
        <div>
          <span className="step-index">01</span>
          <strong>Start with logs</strong>
          <span>Pick a demo below or paste logs from your service.</span>
        </div>
        <div>
          <span className="step-index">02</span>
          <strong>Choose a mode</strong>
          <span>Use Mock for demos. Use Claude when analyzing your own logs.</span>
        </div>
        <div>
          <span className="step-index">03</span>
          <strong>Use the results</strong>
          <span>See likely cause, investigation steps, related guidance, and a status update draft.</span>
        </div>
      </section>

      <section className="scenario-section" aria-label="Demo scenarios">
        <div className="section-heading">
          <h2>Try a demo</h2>
          <p>Start with a realistic sample or customize the form for your own case.</p>
        </div>
        <div className="scenario-strip">
          {demoScenarios.map((scenario) => (
            <button
              className={selectedScenarioId === scenario.id ? 'scenario-card active' : 'scenario-card'}
            key={scenario.id}
            onClick={() => loadScenario(scenario)}
            type="button"
          >
            <span className="scenario-dot" aria-hidden="true"></span>
            <span>{scenario.name}</span>
            <small>{scenario.description}</small>
          </button>
          ))}
        </div>
      </section>

      <section className="workspace-grid">
        <form className="incident-form" onSubmit={analyzeIncident}>
          <div className="panel-heading">
            <h2>Incident input</h2>
            <p>{modeDescription}</p>
          </div>

          <label>
            <span className="label-row">
              Service name
              {renderCounter(form.serviceName, inputLimits.serviceName)}
            </span>
            <input
              maxLength={inputLimits.serviceName}
              value={form.serviceName}
              onChange={(event) => updateField('serviceName', event.target.value)}
            />
          </label>

          <div className="form-row">
            <label>
              Environment
              <select
                value={form.environment}
                onChange={(event) => updateField('environment', event.target.value)}
              >
                <option>Production</option>
                <option>Staging</option>
                <option>Development</option>
              </select>
            </label>

            <label>
              Severity
              <select
                value={form.severity}
                onChange={(event) => updateField('severity', event.target.value)}
              >
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>
          </div>

          <label>
            Analysis mode
            <select
              value={form.analysisMode}
              onChange={(event) => updateField('analysisMode', event.target.value as IncidentForm['analysisMode'])}
            >
              <option value="mock">Mock - free local demo</option>
              <option value="claude">Claude - real AI analysis</option>
            </select>
          </label>

          <label>
            <span className="label-row">
              Symptoms
              {renderCounter(form.symptoms, inputLimits.symptoms)}
            </span>
            <textarea
              maxLength={inputLimits.symptoms}
              value={form.symptoms}
              onChange={(event) => updateField('symptoms', event.target.value)}
              rows={5}
            />
          </label>

          <label>
            <span className="label-row">
              Logs
              {renderCounter(form.logs, inputLimits.logs)}
            </span>
            <textarea
              maxLength={inputLimits.logs}
              value={form.logs}
              onChange={(event) => updateField('logs', event.target.value)}
              rows={8}
            />
          </label>

          <button className="primary-action" type="submit" disabled={isLoading}>
            {isLoading ? 'Analyzing...' : 'Analyze incident'}
          </button>

          {error && <p className="error-message">{error}</p>}
        </form>

        <section className="analysis-panel">
          {!analysis && (
            <div className="empty-state">
              <div className="empty-preview" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <h2>Analysis will appear here</h2>
              <p>Select an analysis mode, choose or edit an incident, then run the analysis.</p>
            </div>
          )}

          {analysis && (
            <div className="analysis-result">
              <div className="result-header">
                <div>
                  <p className="eyebrow">
                    {analysis.analysisProvider ?? (form.analysisMode === 'claude' ? 'Claude' : 'Mock')} analysis
                  </p>
                  <h2>{analysis.summary}</h2>
                </div>
                <span>{analysis.confidence}</span>
              </div>

              {analysis.model && (
                <p className="model-note">Generated with {analysis.model}</p>
              )}

              <article>
                <h3>Probable cause</h3>
                <p>{analysis.probableCause}</p>
              </article>

              {analysis.evidence?.length > 0 && (
                <article>
                  <h3>Evidence found</h3>
                  <ul className="insight-list">
                    {analysis.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}

              <article>
                <h3>Recommended steps</h3>
                <ol>
                  {analysis.recommendedSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>

              {analysis.retrievedRunbooks && analysis.retrievedRunbooks.length > 0 && (
                <article>
                  <div className="article-heading">
                    <h3>Retrieved guidance</h3>
                    <p>RAG-selected runbook guidance used by the backend before generating the incident brief.</p>
                  </div>
                  <div className="reference-list retrieved-list">
                    {analysis.retrievedRunbooks.map((reference) => (
                      <div className="reference-item retrieved-item" key={reference.path}>
                        <strong>{reference.title}</strong>
                        <code>{reference.path}</code>
                        <p>{reference.reason}</p>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              <article>
                <h3>Draft incident update</h3>
                <p>{analysis.draftUpdate}</p>
              </article>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
