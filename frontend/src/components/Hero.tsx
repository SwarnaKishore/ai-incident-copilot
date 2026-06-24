import type { IncidentForm } from '../types'

type HeroProps = {
  analysisMode: IncidentForm['analysisMode']
}

export function Hero({ analysisMode }: HeroProps) {
  return (
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
          <strong>{analysisMode === 'claude' ? 'Claude analysis' : 'Mock analysis'}</strong>
        </div>
        <p>
          Mock is free for demos. Claude uses the backend AI configuration for real analysis.
        </p>
      </div>
    </section>
  )
}
