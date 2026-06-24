import type { FormEvent, RefObject } from 'react'
import { inputLimits } from '../constants'
import type { IncidentForm, UploadedRunbookDocument } from '../types'

type IncidentFormPanelProps = {
  error: string
  form: IncidentForm
  isLoading: boolean
  isRunbookUploading: boolean
  modeDescription: string
  runbookUploadRef: RefObject<HTMLInputElement | null>
  uploadedRunbook: UploadedRunbookDocument | null
  onAnalyze: (event: FormEvent) => void
  onClearRunbookUpload: () => void
  onRunbookUpload: (file: File | undefined) => void
  onUpdateField: (field: keyof IncidentForm, value: string) => void
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

export function IncidentFormPanel({
  error,
  form,
  isLoading,
  isRunbookUploading,
  modeDescription,
  runbookUploadRef,
  uploadedRunbook,
  onAnalyze,
  onClearRunbookUpload,
  onRunbookUpload,
  onUpdateField,
}: IncidentFormPanelProps) {
  return (
    <form className="incident-form" onSubmit={onAnalyze}>
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
          onChange={(event) => onUpdateField('serviceName', event.target.value)}
        />
      </label>

      <div className="form-row">
        <label>
          {requiredLabel('Environment')}
          <select
            value={form.environment}
            onChange={(event) => onUpdateField('environment', event.target.value)}
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
            onChange={(event) => onUpdateField('severity', event.target.value)}
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
          onChange={(event) => onUpdateField('analysisMode', event.target.value as IncidentForm['analysisMode'])}
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
          onChange={(event) => onUpdateField('symptoms', event.target.value)}
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
          onChange={(event) => onUpdateField('logs', event.target.value)}
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
          onChange={(event) => onUpdateField('companyRunbookNotes', event.target.value)}
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
          onChange={(event) => onRunbookUpload(event.target.files?.[0])}
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
          <button className="text-action" onClick={onClearRunbookUpload} type="button">
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
  )
}
