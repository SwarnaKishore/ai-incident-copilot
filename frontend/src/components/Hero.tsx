import { IconBolt } from '@tabler/icons-react'
import type { IncidentForm } from '../types'

type HeroProps = {
  analysisMode: IncidentForm['analysisMode']
}

export function Hero({ analysisMode }: HeroProps) {
  return (
    <section className="workspace-hero">
      <div className="workspace-header">
        <p className="eyebrow"><IconBolt size={18} stroke={2.2} aria-hidden="true" /> AI Incident Copilot</p>
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
        <strong><span aria-hidden="true"></span>{analysisMode === 'claude' ? 'Claude analysis' : 'Mock analysis'}</strong>
        <p>
          {analysisMode === 'claude'
            ? 'Real AI analysis using the backend Claude configuration'
            : 'Free demo · Deterministic results · Preview before real Claude analysis'}
        </p>
      </div>
    </section>
  )
}
