import { fieldLabels } from '../constants'
import type { ApiValidationError, IncidentForm, ProblemDetails } from '../types'

export const getErrorMessage = async (response: Response) => {
  try {
    const problem = (await response.json()) as ProblemDetails
    const title = problem.title ?? 'Analysis request failed'

    if (Array.isArray(problem.detail)) {
      const messages = problem.detail.map(formatValidationError).join(' ')

      return messages ? `Please check the form. ${messages}` : `${title}. Please check the required fields.`
    }

    const detail = problem.detail ? ` ${problem.detail}` : ''

    return `${title}.${detail}`
  } catch {
    return 'Analysis request failed. Please try again or switch to Mock mode.'
  }
}

const formatValidationError = (error: ApiValidationError) => {
  const fieldName = error.loc?.at(-1)
  const label =
    typeof fieldName === 'string' && fieldName in fieldLabels
      ? fieldLabels[fieldName as keyof IncidentForm]
      : 'This field'

  if (error.type === 'string_too_short') {
    return `${label} is required.`
  }

  return `${label}: ${error.msg ?? 'Invalid value.'}`
}

export const validateForm = (form: IncidentForm) => {
  const missingFields = (['serviceName', 'symptoms', 'logs'] as const).filter(
    (field) => form[field].trim().length === 0,
  )

  if (missingFields.length === 0) {
    return ''
  }

  const missingLabels = missingFields.map((field) => fieldLabels[field]).join(', ')

  return `Please complete required fields before analyzing: ${missingLabels}.`
}
