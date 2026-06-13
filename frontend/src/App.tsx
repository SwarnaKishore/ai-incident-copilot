import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type IncidentForm = {
  serviceName: string
  environment: string
  severity: string
  symptoms: string
  logs: string
}

type RunbookReference = {
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
  runbookReferences: RunbookReference[]
  draftUpdate: string
}

type DemoScenario = IncidentForm & {
  id: string
  name: string
  description: string
}

const demoScenarios: DemoScenario[] = [
  {
    id: 'pricing-timeout',
    name: 'Pricing API timeout',
    description: 'PostgreSQL timeout during price-save workflow',
    serviceName: 'Pricing API',
    environment: 'Production',
    severity: 'High',
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
    symptoms: 'Inventory availability is delayed across multiple downstream systems. Operations reports that purchase order updates are not appearing for stores.',
    logs: `2026-06-13T15:42:10Z WARN InventorySyncWorker Queue depth rising
Queue=inventory-events VisibleMessages=18432 AgeOfOldestMessage=00:27:14
AWS.Lambda.ThrottlingException: Rate exceeded
DLQ messages increased from 12 to 438 in 15 minutes
ConsumerSuccessRate=71%`,
  },
]

const initialForm: IncidentForm = demoScenarios[0]

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

  const loadScenario = (scenario: DemoScenario) => {
    setSelectedScenarioId(scenario.id)
    setForm({
      serviceName: scenario.serviceName,
      environment: scenario.environment,
      severity: scenario.severity,
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
      const response = await fetch('http://localhost:5194/api/incidents/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        throw new Error('Analysis request failed')
      }

      const data = (await response.json()) as IncidentAnalysis
      setAnalysis(data)
    } catch {
      setError('Unable to analyze the incident. Confirm the .NET API is running on port 5194.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">AI Incident Copilot</p>
          <h1>Production incident analysis workspace</h1>
          <p className="intro">
            Load a demo incident or paste your own logs to generate a structured investigation plan with runbook references.
          </p>
        </div>
      </section>

      <section className="scenario-strip" aria-label="Demo scenarios">
        {demoScenarios.map((scenario) => (
          <button
            className={selectedScenarioId === scenario.id ? 'scenario-card active' : 'scenario-card'}
            key={scenario.id}
            onClick={() => loadScenario(scenario)}
            type="button"
          >
            <span>{scenario.name}</span>
            <small>{scenario.description}</small>
          </button>
        ))}
      </section>

      <section className="workspace-grid">
        <form className="incident-form" onSubmit={analyzeIncident}>
          <label>
            Service name
            <input
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
            Symptoms
            <textarea
              value={form.symptoms}
              onChange={(event) => updateField('symptoms', event.target.value)}
              rows={5}
            />
          </label>

          <label>
            Logs
            <textarea
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
              <h2>Analysis will appear here</h2>
              <p>Choose a demo scenario, review the inputs, then run the analysis.</p>
            </div>
          )}

          {analysis && (
            <div className="analysis-result">
              <div className="result-header">
                <div>
                  <p className="eyebrow">Runbook-backed mock analysis</p>
                  <h2>{analysis.summary}</h2>
                </div>
                <span>{analysis.confidence}</span>
              </div>

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

              {analysis.runbookReferences?.length > 0 && (
                <article>
                  <h3>Runbook references</h3>
                  <div className="reference-list">
                    {analysis.runbookReferences.map((reference) => (
                      <div className="reference-item" key={reference.path}>
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
