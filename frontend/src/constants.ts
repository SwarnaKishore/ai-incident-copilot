import type { DemoScenario, IncidentForm } from './types'

export const inputLimits = {
  serviceName: 80,
  symptoms: 1000,
  logs: 4000,
  companyRunbookNotes: 3000,
  uploadedRunbookText: 25000,
} as const

export const fieldLabels: Partial<Record<keyof IncidentForm, string>> = {
  serviceName: 'Service name',
  environment: 'Environment',
  severity: 'Severity',
  symptoms: 'Symptoms',
  logs: 'Logs',
  analysisMode: 'Analysis mode',
  companyRunbookNotes: 'Company runbook notes',
  uploadedRunbookText: 'Uploaded runbook',
}

export const maxRunbookUploadBytes = 100 * 1024

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const demoScenarios: DemoScenario[] = [
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
