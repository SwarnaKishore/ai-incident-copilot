import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type IncidentForm = {
  serviceName: string
  environment: string
  severity: string
  symptoms: string
  logs: string
  companyRunbookNotes: string
  uploadedRunbookText: string
  runbookDocumentIds: string[]
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
  stakeholderUpdates?: StakeholderUpdates
  analysisProvider: string
  model: string
}

type StakeholderUpdates = {
  engineering: string
  customer: string
  executive: string
}

type StakeholderAudience = keyof StakeholderUpdates

type UploadedRunbookDocument = {
  documentId: string
  fileName: string
  chunkCount: number
}

type ProblemDetails = {
  title?: string
  detail?: string | ApiValidationError[]
  status?: number
}

type ApiValidationError = {
  loc?: Array<string | number>
  msg?: string
  type?: string
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
  companyRunbookNotes: 3000,
  uploadedRunbookText: 25000,
} as const

const fieldLabels: Partial<Record<keyof IncidentForm, string>> = {
  serviceName: 'Service name',
  environment: 'Environment',
  severity: 'Severity',
  symptoms: 'Symptoms',
  logs: 'Logs',
  analysisMode: 'Analysis mode',
  companyRunbookNotes: 'Company runbook notes',
  uploadedRunbookText: 'Uploaded runbook',
}

const maxRunbookUploadBytes = 100 * 1024

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
    companyRunbookNotes: '',
    uploadedRunbookText: '',
    runbookDocumentIds: [],
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
    companyRunbookNotes: '',
    uploadedRunbookText: '',
    runbookDocumentIds: [],
  },
  {
    id: 'checkout-promo-failure',
    name: 'Checkout promo failure',
    description: 'Feature flag regression after release',
    serviceName: 'Checkout API',
    environment: 'Production',
    severity: 'High',
    analysisMode: 'mock',
    symptoms: 'Customers are seeing intermittent checkout failures when applying promotional discounts. The issue started after the latest checkout release and appears limited to orders using promo codes.',
    logs: `2026-06-18T14:22:11Z ERR Checkout.Api.OrderController SubmitOrder failed
System.InvalidOperationException: Promotion validation failed after pricing response
FeatureFlag=promo-discount-v2 Enabled=true
ReleaseVersion=checkout-api-2026.06.18.3
ErrorRate=12%
TraceId=checkout-prd-91af`,
    companyRunbookNotes: `Checkout service owner: Payments Platform team.
Feature flags are managed in LaunchDarkly.
For promo-related checkout failures, disable promo-discount-v2 before rolling back the full checkout service.
Monitor checkout_success_rate, payment_authorization_rate, and order_creation_latency for 15 minutes after mitigation.
Escalate to the Pricing team if promotion validation errors continue after the flag is disabled.`,
    uploadedRunbookText: '',
    runbookDocumentIds: [],
  },
]

const initialForm: IncidentForm = demoScenarios[0]

const getErrorMessage = async (response: Response) => {
  try {
    const problem = (await response.json()) as ProblemDetails
    const title = problem.title ?? 'Analysis request failed'

    if (Array.isArray(problem.detail)) {
      const messages = problem.detail.map(formatValidationError).join(' ')

      return messages ? `Please check the form. ${messages}` : `${title}. Please check the required fields.`
    }

    const detail = problem.detail ? ` ${problem.detail}` : ''

    return `${title}.${detail}`
  } catch {
    return 'Analysis request failed. Please try again or switch to Mock mode.'
  }
}

const formatValidationError = (error: ApiValidationError) => {
  const fieldName = error.loc?.at(-1)
  const label =
    typeof fieldName === 'string' && fieldName in fieldLabels
      ? fieldLabels[fieldName as keyof IncidentForm]
      : 'This field'

  if (error.type === 'string_too_short') {
    return `${label} is required.`
  }

  return `${label}: ${error.msg ?? 'Invalid value.'}`
}

const validateForm = (form: IncidentForm) => {
  const missingFields = (['serviceName', 'symptoms', 'logs'] as const).filter(
    (field) => form[field].trim().length === 0,
  )

  if (missingFields.length === 0) {
    return ''
  }

  const missingLabels = missingFields.map((field) => fieldLabels[field]).join(', ')

  return `Please complete required fields before analyzing: ${missingLabels}.`
}

const formatMarkdownList = (items: string[]) =>
  items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- None'

const formatRetrievedGuidance = (items: RetrievedGuidance[] = []) =>
  items.length > 0
    ? items
        .map((item) => `- **${item.title}**\n  - Source: \`${item.path}\`\n  - Reason: ${item.reason}`)
        .join('\n')
    : '- None'

const formatStakeholderUpdates = (updates: StakeholderUpdates) =>
  (Object.keys(updates) as StakeholderAudience[])
    .map((audience) => `### ${audience.charAt(0).toUpperCase()}${audience.slice(1)}\n\n${updates[audience]}`)
    .join('\n\n')

const createIncidentBriefMarkdown = (
  form: IncidentForm,
  analysis: IncidentAnalysis,
  stakeholderUpdates: StakeholderUpdates,
) => `# Incident Brief: ${form.serviceName}

## Incident Details

- Service: ${form.serviceName}
- Environment: ${form.environment}
- Severity: ${form.severity}
- Analysis provider: ${analysis.analysisProvider}
- Model: ${analysis.model}

## Summary

${analysis.summary}

## Probable Cause

${analysis.probableCause}

## Evidence

${formatMarkdownList(analysis.evidence)}

## Investigation Checklist

${formatMarkdownList(analysis.recommendedSteps)}

## Retrieved Guidance

${formatRetrievedGuidance(analysis.retrievedRunbooks)}

## Stakeholder Updates

${formatStakeholderUpdates(stakeholderUpdates)}

## Submitted Symptoms

${form.symptoms}

## Submitted Logs

\`\`\`text
${form.logs}
\`\`\`

## Company Runbook Notes

${form.companyRunbookNotes.trim() || 'None provided.'}

## Uploaded Runbook Excerpts

${form.uploadedRunbookText.trim() ? 'Uploaded runbook text was included for retrieval.' : 'None uploaded.'}
`

const createExportFileName = (serviceName: string) => {
  const date = new Date().toISOString().slice(0, 10)
  const safeServiceName = serviceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${safeServiceName || 'incident'}-brief-${date}.md`
}

function App() {
  const [form, setForm] = useState<IncidentForm>(initialForm)
  const [selectedScenarioId, setSelectedScenarioId] = useState(demoScenarios[0].id)
  const [analysis, setAnalysis] = useState<IncidentAnalysis | null>(null)
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({})
  const [selectedAudience, setSelectedAudience] = useState<StakeholderAudience>('engineering')
  const [copiedAudience, setCopiedAudience] = useState<StakeholderAudience | null>(null)
  const [uploadedRunbook, setUploadedRunbook] = useState<UploadedRunbookDocument | null>(null)
  const [isRunbookUploading, setIsRunbookUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const runbookUploadRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setCheckedSteps({})
    setSelectedAudience('engineering')
    setCopiedAudience(null)
  }, [analysis])

  const updateField = (field: keyof IncidentForm, value: string) => {
    setSelectedScenarioId('custom')
    setForm((current) => ({ ...current, [field]: value }))

    if (field === 'analysisMode') {
      setAnalysis(null)
      setError('')
    }
  }

  const renderCounter = (value: string, limit: number) => (
    <span className={value.length >= limit ? 'char-count at-limit' : 'char-count'}>
      {value.length.toLocaleString()} / {limit.toLocaleString()}
    </span>
  )

  const requiredLabel = (label: string) => (
    <span className="required-label">
      {label} <span className="required-mark">*</span>
    </span>
  )

  const completedStepCount = analysis
    ? analysis.recommendedSteps.filter((_, index) => checkedSteps[index]).length
    : 0
  const stakeholderUpdates = analysis?.stakeholderUpdates ?? {
    engineering: analysis?.draftUpdate ?? '',
    customer: analysis?.draftUpdate ?? '',
    executive: analysis?.draftUpdate ?? '',
  }
  const audienceLabels: Record<StakeholderAudience, string> = {
    engineering: 'Engineering',
    customer: 'Customer',
    executive: 'Executive',
  }

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
      companyRunbookNotes: scenario.companyRunbookNotes,
      uploadedRunbookText: scenario.uploadedRunbookText,
      runbookDocumentIds: scenario.runbookDocumentIds,
    })
    setUploadedRunbook(null)
    setAnalysis(null)
    setError('')
  }

  const copyStakeholderUpdate = async () => {
    const update = stakeholderUpdates[selectedAudience]

    if (!update) {
      return
    }

    try {
      await navigator.clipboard.writeText(update)
      setCopiedAudience(selectedAudience)
      window.setTimeout(() => setCopiedAudience(null), 1800)
    } catch {
      setError('Unable to copy the update. Please select the text and copy it manually.')
    }
  }

  const downloadIncidentBrief = () => {
    if (!analysis) {
      return
    }

    const markdown = createIncidentBriefMarkdown(form, analysis, stakeholderUpdates)
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = createExportFileName(form.serviceName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleRunbookUpload = async (file: File | undefined) => {
    if (!file) {
      return
    }

    const isSupportedFile = file.name.endsWith('.md') || file.name.endsWith('.txt') || file.type === 'text/plain'

    if (!isSupportedFile) {
      setError('Upload a Markdown or text runbook file.')
      return
    }

    if (file.size > maxRunbookUploadBytes) {
      setError('Runbook file is too large. Upload a .md or .txt file under 100 KB.')
      return
    }

    setIsRunbookUploading(true)
    setError('')

    try {
      const text = await file.text()
      const trimmedText = text.slice(0, inputLimits.uploadedRunbookText)
      const response = await fetch(`${apiBaseUrl}/api/runbooks/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          content: trimmedText,
        }),
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const uploadedDocument = (await response.json()) as UploadedRunbookDocument

      setUploadedRunbook(uploadedDocument)
      setForm((current) => ({
        ...current,
        uploadedRunbookText: '',
        runbookDocumentIds: [uploadedDocument.documentId],
      }))
      setError(
        text.length > inputLimits.uploadedRunbookText
          ? 'Runbook was uploaded and trimmed to the first 25,000 characters for this demo.'
          : '',
      )
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to upload the runbook. Confirm the FastAPI backend is running.',
      )
    } finally {
      setIsRunbookUploading(false)
    }
  }

  const clearRunbookUpload = () => {
    setUploadedRunbook(null)
    setForm((current) => ({ ...current, uploadedRunbookText: '', runbookDocumentIds: [] }))

    if (runbookUploadRef.current) {
      runbookUploadRef.current.value = ''
    }
  }

  const analyzeIncident = async (event: FormEvent) => {
    event.preventDefault()
    const validationError = validateForm(form)

    if (validationError) {
      setError(validationError)
      setAnalysis(null)
      return
    }

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

      <section className="scenario-section" aria-label="Demo scenarios">
        <div className="section-heading">
          <h2>Start here</h2>
          <p>Pick a demo, then edit any field before analyzing.</p>
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
              {requiredLabel('Service name')}
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
              {requiredLabel('Environment')}
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
              {requiredLabel('Severity')}
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
            {requiredLabel('Analysis mode')}
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
              {requiredLabel('Symptoms')}
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
              {requiredLabel('Logs')}
              {renderCounter(form.logs, inputLimits.logs)}
            </span>
            <textarea
              maxLength={inputLimits.logs}
              value={form.logs}
              onChange={(event) => updateField('logs', event.target.value)}
              rows={8}
            />
          </label>

          <label>
            <span className="label-row">
              Company runbook notes optional
              {renderCounter(form.companyRunbookNotes, inputLimits.companyRunbookNotes)}
            </span>
            <textarea
              maxLength={inputLimits.companyRunbookNotes}
              placeholder="Paste company-specific runbook steps, escalation notes, feature flags, service owners, or mitigation guidance."
              value={form.companyRunbookNotes}
              onChange={(event) => updateField('companyRunbookNotes', event.target.value)}
              rows={5}
            />
          </label>

          <label>
            <span className="label-row">
              Uploaded runbook optional
              {uploadedRunbook && <span className="char-count">{uploadedRunbook.chunkCount} chunks stored</span>}
            </span>
            <input
              accept=".md,.txt,text/plain"
              disabled={isRunbookUploading}
              onChange={(event) => handleRunbookUpload(event.target.files?.[0])}
              ref={runbookUploadRef}
              type="file"
            />
            <span className="field-help">
              {isRunbookUploading
                ? 'Uploading and chunking runbook...'
                : 'Upload a .md or .txt file under 100 KB. The backend stores chunks and retrieves only relevant excerpts.'}
            </span>
            {uploadedRunbook && (
              <span className="upload-status">
                Stored {uploadedRunbook.fileName}
              </span>
            )}
            {uploadedRunbook && (
              <button className="text-action" onClick={clearRunbookUpload} type="button">
                Clear uploaded runbook
              </button>
            )}
          </label>

          <button className="primary-action" type="submit" disabled={isLoading}>
            {isLoading ? 'Analyzing...' : 'Analyze incident'}
          </button>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
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
                <div className="result-actions">
                  <span>{analysis.confidence}</span>
                  <button className="copy-button" onClick={downloadIncidentBrief} type="button">
                    Download brief
                  </button>
                </div>
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
                <div className="article-heading checklist-heading">
                  <div>
                    <h3>Investigation checklist</h3>
                    <p>Track the next actions while you work through the incident.</p>
                  </div>
                  <span>
                    {completedStepCount} / {analysis.recommendedSteps.length} done
                  </span>
                </div>
                <div className="checklist">
                  {analysis.recommendedSteps.map((step, index) => (
                    <label
                      className={checkedSteps[index] ? 'checklist-item completed' : 'checklist-item'}
                      key={step}
                    >
                      <input
                        checked={checkedSteps[index] ?? false}
                        onChange={(event) =>
                          setCheckedSteps((current) => ({
                            ...current,
                            [index]: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <span>{step}</span>
                    </label>
                  ))}
                </div>
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
                <div className="article-heading update-heading">
                  <div>
                    <h3>Stakeholder updates</h3>
                    <p>Role-specific updates generated from the same incident analysis.</p>
                  </div>
                  <button className="copy-button" onClick={copyStakeholderUpdate} type="button">
                    {copiedAudience === selectedAudience ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="update-tabs" aria-label="Stakeholder update audiences">
                  {(Object.keys(audienceLabels) as StakeholderAudience[]).map((audience) => (
                    <button
                      className={selectedAudience === audience ? 'active' : ''}
                      key={audience}
                      onClick={() => setSelectedAudience(audience)}
                      type="button"
                    >
                      {audienceLabels[audience]}
                    </button>
                  ))}
                </div>
                <div className="stakeholder-update">
                  <p>{stakeholderUpdates[selectedAudience]}</p>
                </div>
              </article>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
