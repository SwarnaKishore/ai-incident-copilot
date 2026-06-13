import { FormEvent, useState } from 'react'
import './App.css'

type IncidentForm = {
  serviceName: string
  environment: string
  severity: string
  symptoms: string
  logs: string
}

type IncidentAnalysis = {
  summary: string
  probableCause: string
  confidence: string
  recommendedSteps: string[]
  draftUpdate: string
}

const initialForm: IncidentForm = {
  serviceName: 'Pricing API',
  environment: 'Production',
  severity: 'High',
  symptoms: 'Users are seeing 500 errors when saving price updates.',
  logs: 'System.TimeoutException: Timeout while connecting to PostgreSQL',
}

function App() {
  const [form, setForm] = useState<IncidentForm>(initialForm)
  const [analysis, setAnalysis] = useState<IncidentAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const updateField = (field: keyof IncidentForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
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
            Paste incident symptoms and logs to generate a structured investigation plan.
          </p>
        </div>
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

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Analyzing...' : 'Analyze incident'}
          </button>

          {error && <p className="error-message">{error}</p>}
        </form>

        <section className="analysis-panel">
          {!analysis && (
            <div className="empty-state">
              <h2>Analysis will appear here</h2>
              <p>Start with the sample incident, then try your own logs.</p>
            </div>
          )}

          {analysis && (
            <div className="analysis-result">
              <div className="result-header">
                <div>
                  <p className="eyebrow">Mock AI Analysis</p>
                  <h2>{analysis.summary}</h2>
                </div>
                <span>{analysis.confidence}</span>
              </div>

              <article>
                <h3>Probable cause</h3>
                <p>{analysis.probableCause}</p>
              </article>

              <article>
                <h3>Recommended steps</h3>
                <ol>
                  {analysis.recommendedSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>

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