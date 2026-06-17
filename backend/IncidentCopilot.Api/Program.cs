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
