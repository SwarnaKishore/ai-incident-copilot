var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

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

app.MapPost("/api/incidents/analyze", (IncidentAnalysisRequest request) =>
{
    var response = new IncidentAnalysisResponse(
        Summary: $"{request.ServiceName} is experiencing {request.Severity.ToLower()} symptoms in {request.Environment}.",
        ProbableCause: "The most likely cause is a downstream dependency timeout or resource saturation based on the submitted symptoms and logs.",
        Confidence: "Medium",
        RecommendedSteps:
        [
            "Check recent deployments for the affected service.",
            "Review application logs around the first reported error time.",
            "Inspect database, queue, and external API latency metrics.",
            "Validate retry, timeout, and circuit breaker settings.",
            "Prepare a rollback plan if errors correlate with a recent release."
        ],
        DraftUpdate: $"Investigating {request.Severity.ToLower()} incident affecting {request.ServiceName} in {request.Environment}. Initial analysis suggests dependency latency or timeout behavior. Next update will follow after log and metrics review."
    );

    return Results.Ok(response);
});

app.Run();

record IncidentAnalysisRequest(
    string ServiceName,
    string Environment,
    string Severity,
    string Symptoms,
    string Logs
);

record IncidentAnalysisResponse(
    string Summary,
    string ProbableCause,
    string Confidence,
    string[] RecommendedSteps,
    string DraftUpdate
);