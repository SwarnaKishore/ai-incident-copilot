import { IconBolt, IconDatabase, IconFlag } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { DemoScenario } from '../types'

type ScenarioPickerProps = {
  scenarios: DemoScenario[]
  selectedScenarioId: string
  onSelect: (scenario: DemoScenario) => void
}

const scenarioIcons: Record<string, ReactNode> = {
  'pricing-timeout': <IconDatabase size={28} stroke={2} aria-hidden="true" />,
  'inventory-backlog': <IconBolt size={28} stroke={2} aria-hidden="true" />,
  'checkout-promo-failure': <IconFlag size={28} stroke={2} aria-hidden="true" />,
}

export function ScenarioPicker({ scenarios, selectedScenarioId, onSelect }: ScenarioPickerProps) {
  return (
    <section className="scenario-section" aria-label="Demo scenarios">
      <div className="section-heading">
        <h2>Start with a demo</h2>
      </div>
      <div className="scenario-strip">
        {scenarios.map((scenario) => (
          <button
            className={selectedScenarioId === scenario.id ? 'scenario-card active' : 'scenario-card'}
            key={scenario.id}
            onClick={() => onSelect(scenario)}
            type="button"
          >
            <span className="scenario-icon">{scenarioIcons[scenario.id] ?? <IconBolt size={28} stroke={2} aria-hidden="true" />}</span>
            <span>{scenario.name}</span>
            <small>{scenario.description}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
