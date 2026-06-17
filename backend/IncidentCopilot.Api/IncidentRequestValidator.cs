static class IncidentRequestValidator
{
    public const int ServiceNameMaxLength = 80;
    public const int SymptomsMaxLength = 1000;
    public const int LogsMaxLength = 4000;

    public static Dictionary<string, string[]> Validate(IncidentAnalysisRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        AddRequiredError(errors, nameof(request.ServiceName), request.ServiceName);
        AddRequiredError(errors, nameof(request.Environment), request.Environment);
        AddRequiredError(errors, nameof(request.Severity), request.Severity);
        AddRequiredError(errors, nameof(request.Symptoms), request.Symptoms);
        AddRequiredError(errors, nameof(request.Logs), request.Logs);

        AddMaxLengthError(errors, nameof(request.ServiceName), request.ServiceName, ServiceNameMaxLength);
        AddMaxLengthError(errors, nameof(request.Symptoms), request.Symptoms, SymptomsMaxLength);
        AddMaxLengthError(errors, nameof(request.Logs), request.Logs, LogsMaxLength);

        return errors;
    }

    private static void AddRequiredError(Dictionary<string, string[]> errors, string field, string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[field] = [$"{field} is required."];
        }
    }

    private static void AddMaxLengthError(Dictionary<string, string[]> errors, string field, string value, int maxLength)
    {
        if (!string.IsNullOrEmpty(value) && value.Length > maxLength)
        {
            errors[field] = [$"{field} must be {maxLength} characters or fewer."];
        }
    }
}
