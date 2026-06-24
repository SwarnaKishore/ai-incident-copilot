import type { IncidentAnalysis, IncidentForm, StakeholderAudience, StakeholderUpdates } from '../types'

type AnalysisPanelProps = {
  analysis: IncidentAnalysis | null
  checkedSteps: Record<number, boolean>
  copiedAudience: StakeholderAudience | null
  form: IncidentForm
  selectedAudience: StakeholderAudience
  stakeholderUpdates: StakeholderUpdates
  onCopyStakeholderUpdate: () => void
  onDownloadBrief: () => void
  onSelectAudience: (audience: StakeholderAudience) => void
  onToggleStep: (index: number, checked: boolean) => void
}

const audienceLabels: Record<StakeholderAudience, string> = {
  engineering: 'Engineering',
  customer: 'Customer',
  executive: 'Executive',
}

export function AnalysisPanel({
  analysis,
  checkedSteps,
  copiedAudience,
  form,
  selectedAudience,
  stakeholderUpdates,
  onCopyStakeholderUpdate,
  onDownloadBrief,
  onSelectAudience,
  onToggleStep,
}: AnalysisPanelProps) {
  const completedStepCount = analysis
    ? analysis.recommendedSteps.filter((_, index) => checkedSteps[index]).length
    : 0

  return (
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
              <button className="copy-button" onClick={onDownloadBrief} type="button">
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
                    onChange={(event) => onToggleStep(index, event.target.checked)}
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
                  <div className="reference-item retrieved-item" key={`${reference.path}-${reference.title}`}>
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
              <button className="copy-button" onClick={onCopyStakeholderUpdate} type="button">
                {copiedAudience === selectedAudience ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="update-tabs" aria-label="Stakeholder update audiences">
              {(Object.keys(audienceLabels) as StakeholderAudience[]).map((audience) => (
                <button
                  className={selectedAudience === audience ? 'active' : ''}
                  key={audience}
                  onClick={() => onSelectAudience(audience)}
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
  )
}
