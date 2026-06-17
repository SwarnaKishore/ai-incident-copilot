static class ClaudeErrorMapper
{
    public static ClaudeProblem ToProblem(string message)
    {
        var normalized = message.ToLowerInvariant();

        if (normalized.Contains("credit") ||
            normalized.Contains("billing") ||
            normalized.Contains("quota") ||
            normalized.Contains("usage") ||
            normalized.Contains("spend") ||
            normalized.Contains("balance"))
        {
            return new ClaudeProblem(
                "Claude usage limit reached",
                "Claude analysis is temporarily unavailable because the configured API billing or usage limit was reached. Switch to Mock mode to continue testing.",
                StatusCodes.Status402PaymentRequired);
        }

        if (normalized.Contains("rate") || normalized.Contains("429"))
        {
            return new ClaudeProblem(
                "Claude is rate limited",
                "Claude is temporarily rate limited. Wait a moment and try again, or switch to Mock mode.",
                StatusCodes.Status429TooManyRequests);
        }

        if (normalized.Contains("401") || normalized.Contains("403") || normalized.Contains("auth") || normalized.Contains("permission"))
        {
            return new ClaudeProblem(
                "Claude API access failed",
                "The backend Claude API key is missing, invalid, or not allowed to use the configured model. Check backend configuration or switch to Mock mode.",
                StatusCodes.Status503ServiceUnavailable);
        }

        return new ClaudeProblem(
            "Claude analysis failed",
            "Claude analysis is temporarily unavailable. Switch to Mock mode to continue testing, then try Claude again later.",
            StatusCodes.Status502BadGateway);
    }
}
