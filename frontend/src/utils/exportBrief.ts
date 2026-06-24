import type { IncidentAnalysis, IncidentForm, RetrievedGuidance, StakeholderAudience, StakeholderUpdates } from '../types'

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

${form.runbookDocumentIds.length > 0 ? 'Uploaded runbook document IDs were included for retrieval.' : 'None uploaded.'}
`

const createExportFileName = (serviceName: string) => {
  const date = new Date().toISOString().slice(0, 10)
  const safeServiceName = serviceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${safeServiceName || 'incident'}-brief-${date}.md`
}

export const downloadIncidentBrief = (
  form: IncidentForm,
  analysis: IncidentAnalysis,
  stakeholderUpdates: StakeholderUpdates,
) => {
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
