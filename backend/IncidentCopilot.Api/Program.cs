using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddHttpClient("Anthropic", client =>
{
    client.BaseAddress = new Uri("https://api.anthropic.com");
    client.Timeout = TimeSpan.FromSeconds(45);
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Frontend");

app.MapGet("/", () => Results.Ok(new
{
    name = "AI Incident Copilot API",
    status = "Running"
}));

app.MapPost("/api/incidents/analyze", async (
    IncidentAnalysisRequest request,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration) =>
{
    var validationErrors = IncidentRequestValidator.Validate(request);

    if (validationErrors.Count > 0)
    {
        return Results.ValidationProblem(validationErrors);
    }

    if (request.AnalysisMode.Equals("claude", StringComparison.OrdinalIgnoreCase))
    {
        var apiKey = configuration["ANTHROPIC_API_KEY"];

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Results.Problem(
                title: "Claude API key is not configured",
                detail: "Set ANTHROPIC_API_KEY in your backend terminal, then restart dotnet run. You can keep using Mock mode without a key.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        try
        {
            var response = await ClaudeIncidentAnalyzer.AnalyzeAsync(
                request,
                httpClientFactory.CreateClient("Anthropic"),
                apiKey,
                configuration["ANTHROPIC_MODEL"] ?? "claude-haiku-4-5");

            return Results.Ok(response);
        }
        catch (Exception ex)
        {
            var error = ClaudeErrorMapper.ToProblem(ex.Message);

            return Results.Problem(
                title: error.Title,
                detail: error.Detail,
                statusCode: error.StatusCode);
        }
    }

    return Results.Ok(IncidentAnalyzer.Analyze(request));
});

app.Run();

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

record ClaudeProblem(string Title, string Detail, int StatusCode);

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

static class ClaudeIncidentAnalyzer
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static async Task<IncidentAnalysisResponse> AnalyzeAsync(
        IncidentAnalysisRequest request,
        HttpClient httpClient,
        string apiKey,
        string model)
    {
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/v1/messages");
        httpRequest.Headers.Add("x-api-key", apiKey);
        httpRequest.Headers.Add("anthropic-version", "2023-06-01");
        httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var payload = new
        {
            model,
            max_tokens = 1200,
            temperature = 0.2,
            system = """
                You are an AI production incident copilot for senior software engineers.
                Return only valid JSON with this exact shape:
                {
                  "summary": "string",
                  "probableCause": "string",
                  "confidence": "Low | Medium | High",
                  "evidence": ["string"],
                  "recommendedSteps": ["string"],
                  "runbookReferences": [{"title":"string","path":"string","reason":"string"}],
                  "draftUpdate": "string"
                }
                Be specific, operational, and honest about uncertainty. Do not invent tools or metrics that are not implied by the input.
                """,
            messages = new[]
            {
                new
                {
                    role = "user",
                    content = BuildPrompt(request)
                }
            }
        };

        httpRequest.Content = new StringContent(
            JsonSerializer.Serialize(payload, JsonOptions),
            Encoding.UTF8,
            "application/json");

        using var httpResponse = await httpClient.SendAsync(httpRequest);
        var responseBody = await httpResponse.Content.ReadAsStringAsync();

        if (!httpResponse.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Anthropic API returned {(int)httpResponse.StatusCode}: {responseBody}");
        }

        var claudeText = ExtractClaudeText(responseBody);
        var jsonText = ExtractJsonObject(claudeText);
        var analysis = JsonSerializer.Deserialize<IncidentAnalysisResponse>(jsonText, JsonOptions);

        return analysis ?? throw new InvalidOperationException("Claude returned an empty analysis payload.");
    }

    private static string BuildPrompt(IncidentAnalysisRequest request)
    {
        return $$"""
            Analyze this production incident and use the available runbook context when relevant.

            Incident:
            Service: {{request.ServiceName}}
            Environment: {{request.Environment}}
            Severity: {{request.Severity}}
            Symptoms: {{request.Symptoms}}

            Logs:
            {{request.Logs}}

            Available runbook context:
            1. docs/runbooks/pricing-api-database-timeouts.md
               Signals: HTTP 500 errors on price-save workflows, PostgreSQL/Npgsql timeout exceptions, connection pool waits.
               Triage: check API latency, PostgreSQL connections, slow queries, lock waits, deployment correlation, endpoint traffic concentration.

            2. docs/runbooks/inventory-queue-backlog.md
               Signals: SQS visible message count and age of oldest message increase, delayed downstream inventory updates, worker throttles, DLQ growth.
               Triage: check queue depth, in-flight count, oldest message age, worker duration/errors/throttles, DLQ poison messages, producer volume.

            3. docs/runbooks/incident-communications.md
               Guidance: create concise stakeholder updates with current impact, suspected cause, mitigation steps, and next update timing.
            """;
    }

    private static string ExtractClaudeText(string responseBody)
    {
        var root = JsonNode.Parse(responseBody);
        var text = root?["content"]?.AsArray()
            .Select(node => node?["text"]?.GetValue<string>())
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

        return text ?? throw new InvalidOperationException("Claude response did not include text content.");
    }

    private static string ExtractJsonObject(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');

        if (start < 0 || end <= start)
        {
            throw new InvalidOperationException("Claude response did not contain a JSON object.");
        }

        return text[start..(end + 1)];
    }
}

static class IncidentAnalyzer
{
    public static IncidentAnalysisResponse Analyze(IncidentAnalysisRequest request)
    {
        var normalizedInput = $"{request.ServiceName} {request.Symptoms} {request.Logs}".ToLowerInvariant();

        if (normalizedInput.Contains("postgres") || normalizedInput.Contains("timeout") || normalizedInput.Contains("pricing"))
        {
            return new IncidentAnalysisResponse(
                Summary: $"{request.ServiceName} is showing {request.Severity.ToLowerInvariant()} database timeout behavior in {request.Environment}.",
                ProbableCause: "Application requests are likely waiting on PostgreSQL connections or slow price-save queries, causing API calls to exceed timeout limits.",
                Confidence: "High",
                Evidence:
                [
                    "Logs include a PostgreSQL timeout exception.",
                    "User impact is tied to saving price updates, which is a database-backed workflow.",
                    "The failure mode is consistent with connection pool saturation or a slow query regression."
                ],
                RecommendedSteps:
                [
                    "Check PostgreSQL connection pool usage for the Pricing API.",
                    "Review slow query logs for price update statements during the incident window.",
                    "Compare error rate and database latency against the latest deployment time.",
                    "Temporarily increase command timeout only if rollback is not immediately available.",
                    "Prepare rollback if the issue correlates with a recent release."
                ],
                RunbookReferences:
                [
                    new RunbookReference("Pricing API Database Timeout Runbook", "docs/runbooks/pricing-api-database-timeouts.md", "Database connection saturation and slow query triage"),
                    new RunbookReference("Incident Comms Template", "docs/runbooks/incident-communications.md", "Customer and stakeholder update guidance")
                ],
                DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} errors affecting {request.ServiceName} in {request.Environment}. Current evidence points to PostgreSQL timeout behavior during price-save operations. The team is reviewing connection pool usage, slow queries, and recent deployment timing.",
                AnalysisProvider: "Mock",
                Model: "deterministic-rules"
            );
        }

        if (normalizedInput.Contains("queue") || normalizedInput.Contains("sqs") || normalizedInput.Contains("inventory") || normalizedInput.Contains("backlog"))
        {
            return new IncidentAnalysisResponse(
                Summary: $"{request.ServiceName} is experiencing {request.Severity.ToLowerInvariant()} queue backlog symptoms in {request.Environment}.",
                ProbableCause: "Message processing is likely slower than message ingestion, causing SQS backlog growth and delayed downstream updates.",
                Confidence: "Medium",
                Evidence:
                [
                    "Symptoms mention delayed updates and growing backlog.",
                    "Queue-based systems fail this way when consumers are throttled, unhealthy, or under-scaled.",
                    "No direct database exception was found, so consumer throughput should be checked first."
                ],
                RecommendedSteps:
                [
                    "Check SQS visible message count and age of oldest message.",
                    "Review Lambda or worker error rates, throttles, and concurrency limits.",
                    "Inspect dead-letter queue volume for poison messages.",
                    "Scale consumers or pause producers if backlog continues to grow.",
                    "Replay failed messages after confirming the handler is healthy."
                ],
                RunbookReferences:
                [
                    new RunbookReference("Inventory Queue Backlog Runbook", "docs/runbooks/inventory-queue-backlog.md", "SQS backlog and consumer throughput triage"),
                    new RunbookReference("Incident Comms Template", "docs/runbooks/incident-communications.md", "Customer and stakeholder update guidance")
                ],
                DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} processing delays affecting {request.ServiceName} in {request.Environment}. Current evidence suggests queue backlog growth and reduced consumer throughput. The team is checking SQS age, worker errors, throttles, and DLQ volume.",
                AnalysisProvider: "Mock",
                Model: "deterministic-rules"
            );
        }

        return new IncidentAnalysisResponse(
            Summary: $"{request.ServiceName} is experiencing {request.Severity.ToLowerInvariant()} symptoms in {request.Environment}.",
            ProbableCause: "The most likely cause is a downstream dependency timeout, recent deployment regression, or resource saturation pattern.",
            Confidence: "Medium",
            Evidence:
            [
                "The submitted symptoms indicate user-facing impact.",
                "Logs contain operational signals that should be correlated with metrics and deployments.",
                "More specific runbook evidence is needed to improve confidence."
            ],
            RecommendedSteps:
            [
                "Check recent deployments for the affected service.",
                "Review application logs around the first reported error time.",
                "Inspect database, queue, and external API latency metrics.",
                "Validate retry, timeout, and circuit breaker settings.",
                "Prepare a rollback plan if errors correlate with a recent release."
            ],
            RunbookReferences:
            [
                new RunbookReference("Incident Comms Template", "docs/runbooks/incident-communications.md", "General incident update guidance")
            ],
            DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} incident affecting {request.ServiceName} in {request.Environment}. Initial analysis suggests dependency latency or timeout behavior. Next update will follow after log and metrics review.",
            AnalysisProvider: "Mock",
            Model: "deterministic-rules"
        );
    }
}

record IncidentAnalysisRequest(
    string ServiceName,
    string Environment,
    string Severity,
    string Symptoms,
    string Logs,
    string AnalysisMode = "mock"
);

record IncidentAnalysisResponse(
    string Summary,
    string ProbableCause,
    string Confidence,
    string[] Evidence,
    string[] RecommendedSteps,
    RunbookReference[] RunbookReferences,
    string DraftUpdate,
    string AnalysisProvider = "Claude",
    string Model = "claude-haiku-4-5"
);

record RunbookReference(
    string Title,
    string Path,
    string Reason
);
