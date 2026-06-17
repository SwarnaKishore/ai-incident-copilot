using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddSingleton<ClaudeUsageLimiter>();
builder.Services.AddHttpClient("Anthropic", client =>
{
    client.BaseAddress = new Uri("https://api.anthropic.com");
    client.Timeout = TimeSpan.FromSeconds(45);
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var allowedOrigins = builder.Configuration["ALLOWED_ORIGINS"]?
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            ?? ["http://localhost:5173"];

        policy
            .WithOrigins(allowedOrigins)
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
    IConfiguration configuration,
    ClaudeUsageLimiter usageLimiter) =>
{
    var validationErrors = IncidentRequestValidator.Validate(request);

    if (validationErrors.Count > 0)
    {
        return Results.ValidationProblem(validationErrors);
    }

    if (request.AnalysisMode.Equals("claude", StringComparison.OrdinalIgnoreCase))
    {
        var dailyLimit = int.TryParse(configuration["CLAUDE_DAILY_LIMIT"], out var configuredLimit)
            ? configuredLimit
            : 5;
        var usageCheck = usageLimiter.TryConsume(dailyLimit);

        if (!usageCheck.IsAllowed)
        {
            return Results.Problem(
                title: "Daily Claude demo limit reached",
                detail: $"Claude mode is limited to {dailyLimit} requests per day for this demo. Switch to Mock mode to continue testing.",
                statusCode: StatusCodes.Status429TooManyRequests);
        }

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

sealed class ClaudeUsageLimiter
{
    private readonly Lock _lock = new();
    private DateOnly _usageDate = DateOnly.FromDateTime(DateTime.UtcNow);
    private int _count;

    public ClaudeUsageResult TryConsume(int dailyLimit)
    {
        lock (_lock)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            if (today != _usageDate)
            {
                _usageDate = today;
                _count = 0;
            }

            if (_count >= dailyLimit)
            {
                return new ClaudeUsageResult(false, _count, dailyLimit);
            }

            _count++;
            return new ClaudeUsageResult(true, _count, dailyLimit);
        }
    }
}

record ClaudeUsageResult(bool IsAllowed, int Used, int Limit);

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

        return analysis is null
            ? throw new InvalidOperationException("Claude returned an empty analysis payload.")
            : analysis with { AnalysisProvider = "Claude + RAG", Model = model };
    }

    private static string BuildPrompt(IncidentAnalysisRequest request)
    {
        var retrievedRunbooks = RunbookRetriever.Retrieve(request);
        var runbookContext = string.Join(
            "\n\n",
            retrievedRunbooks.Select((runbook, index) => $$"""
                {{index + 1}}. {{runbook.Title}}
                   Path: {{runbook.Path}}
                   Why retrieved: {{runbook.Reason}}
                   Content:
                   {{runbook.Content}}
                """));

        return $$"""
            Analyze this production incident using the retrieved runbook context.

            Incident:
            Service: {{request.ServiceName}}
            Environment: {{request.Environment}}
            Severity: {{request.Severity}}
            Symptoms: {{request.Symptoms}}

            Logs:
            {{request.Logs}}

            Retrieved runbook context:
            {{runbookContext}}

            Instructions:
            - Use the retrieved runbook context when it matches the incident evidence.
            - In runbookReferences, include only runbooks that materially influenced the answer.
            - Explain why each runbook matched the submitted symptoms or logs.
            - Use the Incident Communications Template to write draftUpdate in a stakeholder-ready style.
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
                Summary: $"{request.ServiceName} is showing {request.Severity.ToLowerInvariant()} timeout behavior in {request.Environment}.",
                ProbableCause: "Application requests are likely waiting on a slow or saturated downstream dependency, causing operations to exceed timeout limits.",
                Confidence: "High",
                Evidence:
                [
                    "Logs include timeout or connection-related exceptions.",
                    "User impact is tied to a specific workflow, which helps narrow the blast radius.",
                    "The failure mode is consistent with dependency latency, connection saturation, or a recent regression."
                ],
                RecommendedSteps:
                [
                    "Check connection pool, thread pool, and request queue pressure for the affected service.",
                    "Review slow dependency calls during the incident window.",
                    "Compare error rate and database latency against the latest deployment time.",
                    "Temporarily increase command timeout only if rollback is not immediately available.",
                    "Prepare rollback if the issue correlates with a recent release."
                ],
                RunbookReferences:
                [
                    new RunbookReference("API Error and Timeout Triage", "docs/runbooks/api-error-and-timeout-triage.md", "Timeout and 5xx investigation guidance"),
                    new RunbookReference("Dependency and Resource Saturation", "docs/runbooks/dependency-and-resource-saturation.md", "Downstream dependency and saturation triage"),
                    new RunbookReference("Incident Comms Template", "docs/runbooks/incident-communications.md", "Customer and stakeholder update guidance")
                ],
                DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} errors affecting {request.ServiceName} in {request.Environment}. Current evidence points to timeout behavior in a specific workflow. The team is reviewing dependency latency, resource saturation, and recent deployment timing.",
                AnalysisProvider: "Mock",
                Model: "deterministic-rules"
            );
        }

        if (normalizedInput.Contains("queue") || normalizedInput.Contains("sqs") || normalizedInput.Contains("inventory") || normalizedInput.Contains("backlog"))
        {
            return new IncidentAnalysisResponse(
                Summary: $"{request.ServiceName} is experiencing {request.Severity.ToLowerInvariant()} asynchronous processing backlog symptoms in {request.Environment}.",
                ProbableCause: "Message or job processing is likely slower than ingestion, causing backlog growth and delayed downstream updates.",
                Confidence: "Medium",
                Evidence:
                [
                    "Symptoms mention delayed updates and growing backlog.",
                    "Queue-based systems fail this way when consumers are throttled, unhealthy, or under-scaled.",
                    "No direct dependency exception was found, so consumer throughput and retry behavior should be checked first."
                ],
                RecommendedSteps:
                [
                    "Check queue depth, in-flight work, and age of oldest message or job.",
                    "Review worker error rates, throttles, duration, and concurrency limits.",
                    "Inspect dead-letter queue volume for poison messages.",
                    "Scale consumers or pause producers if backlog continues to grow.",
                    "Replay failed messages after confirming the handler is healthy."
                ],
                RunbookReferences:
                [
                    new RunbookReference("Async Processing Backlog Triage", "docs/runbooks/async-processing-backlog-triage.md", "Queue and worker backlog investigation guidance"),
                    new RunbookReference("Dependency and Resource Saturation", "docs/runbooks/dependency-and-resource-saturation.md", "Dependency bottleneck and resource pressure triage"),
                    new RunbookReference("Incident Comms Template", "docs/runbooks/incident-communications.md", "Customer and stakeholder update guidance")
                ],
                DraftUpdate: $"Investigating {request.Severity.ToLowerInvariant()} processing delays affecting {request.ServiceName} in {request.Environment}. Current evidence suggests backlog growth and reduced consumer throughput. The team is checking queue age, worker errors, throttles, and failed message volume.",
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
