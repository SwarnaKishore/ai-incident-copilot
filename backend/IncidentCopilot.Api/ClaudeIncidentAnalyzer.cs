using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

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
