export type IncidentForm = {
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

export type RetrievedGuidance = {
  title: string
  path: string
  reason: string
}

export type IncidentAnalysis = {
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

export type StakeholderUpdates = {
  engineering: string
  customer: string
  executive: string
}

export type StakeholderAudience = keyof StakeholderUpdates

export type UploadedRunbookDocument = {
  documentId: string
  fileName: string
  chunkCount: number
}

export type ProblemDetails = {
  title?: string
  detail?: string | ApiValidationError[]
  status?: number
}

export type ApiValidationError = {
  loc?: Array<string | number>
  msg?: string
  type?: string
}

export type DemoScenario = IncidentForm & {
  id: string
  name: string
  description: string
}
