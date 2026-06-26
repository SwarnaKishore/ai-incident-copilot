import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AnalysisPanel } from './components/AnalysisPanel'
import { Hero } from './components/Hero'
import { IncidentFormPanel } from './components/IncidentFormPanel'
import { ScenarioPicker } from './components/ScenarioPicker'
import { apiBaseUrl, demoScenarios, maxRunbookUploadBytes } from './constants'
import type { DemoScenario, IncidentAnalysis, IncidentForm, StakeholderAudience, UploadedRunbookDocument } from './types'
import { getErrorMessage, validateForm } from './utils/errors'
import { downloadIncidentBrief } from './utils/exportBrief'
import './App.css'

const initialForm: IncidentForm = demoScenarios[0]

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

  const stakeholderUpdates = analysis?.stakeholderUpdates ?? {
    engineering: analysis?.draftUpdate ?? '',
    customer: analysis?.draftUpdate ?? '',
    executive: analysis?.draftUpdate ?? '',
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

  const handleDownloadIncidentBrief = () => {
    if (!analysis) {
      return
    }

    downloadIncidentBrief(form, analysis, stakeholderUpdates)
  }

  const handleRunbookUpload = async (file: File | undefined) => {
    if (!file) {
      return
    }

    const normalizedFileName = file.name.toLowerCase()
    const isSupportedFile =
      normalizedFileName.endsWith('.md') ||
      normalizedFileName.endsWith('.txt') ||
      normalizedFileName.endsWith('.pdf') ||
      file.type === 'text/plain' ||
      file.type === 'application/pdf'

    if (!isSupportedFile) {
      setError('Upload a Markdown, text, or PDF runbook file.')
      return
    }

    if (file.size > maxRunbookUploadBytes) {
      setError('Runbook file is too large. Upload a .md, .txt, or .pdf file under 2 MB.')
      return
    }

    setIsRunbookUploading(true)
    setError('')

    try {
      const uploadForm = new FormData()
      uploadForm.append('file', file)

      const response = await fetch(`${apiBaseUrl}/api/runbooks/upload`, {
        method: 'POST',
        body: uploadForm,
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
      setError('')
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
      <Hero analysisMode={form.analysisMode} />

      <ScenarioPicker
        scenarios={demoScenarios}
        selectedScenarioId={selectedScenarioId}
        onSelect={loadScenario}
      />

      <section className="workspace-grid">
        <IncidentFormPanel
          error={error}
          form={form}
          isLoading={isLoading}
          isRunbookUploading={isRunbookUploading}
          modeDescription={modeDescription}
          runbookUploadRef={runbookUploadRef}
          uploadedRunbook={uploadedRunbook}
          onAnalyze={analyzeIncident}
          onClearRunbookUpload={clearRunbookUpload}
          onRunbookUpload={handleRunbookUpload}
          onUpdateField={updateField}
        />

        <AnalysisPanel
          analysis={analysis}
          checkedSteps={checkedSteps}
          copiedAudience={copiedAudience}
          form={form}
          selectedAudience={selectedAudience}
          stakeholderUpdates={stakeholderUpdates}
          onCopyStakeholderUpdate={copyStakeholderUpdate}
          onDownloadBrief={handleDownloadIncidentBrief}
          onSelectAudience={setSelectedAudience}
          onToggleStep={(index, checked) =>
            setCheckedSteps((current) => ({
              ...current,
              [index]: checked,
            }))
          }
        />
      </section>
    </main>
  )
}

export default App
