import type { DemoScenario } from '../types'

type ScenarioPickerProps = {
  scenarios: DemoScenario[]
  selectedScenarioId: string
  onSelect: (scenario: DemoScenario) => void
}

export function ScenarioPicker({ scenarios, selectedScenarioId, onSelect }: ScenarioPickerProps) {
  return (
    <section className="scenario-section" aria-label="Demo scenarios">
      <div className="section-heading">
        <h2>Start here</h2>
        <p>Pick a demo, then edit any field before analyzing.</p>
      </div>
      <div className="scenario-strip">
        {scenarios.map((scenario) => (
          <button
            className={selectedScenarioId === scenario.id ? 'scenario-card active' : 'scenario-card'}
            key={scenario.id}
            onClick={() => onSelect(scenario)}
            type="button"
          >
            <span className="scenario-dot" aria-hidden="true"></span>
            <span>{scenario.name}</span>
            <small>{scenario.description}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
