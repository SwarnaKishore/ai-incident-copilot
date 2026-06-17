using System.Text.RegularExpressions;

static class RunbookRetriever
{
    private const int MaxRelevantRunbooks = 2;
    private const int MinimumRelevantScore = 2;
    private const int MaxSnippetLength = 1400;
    private static readonly Regex TokenRegex = new("[a-z0-9]{3,}", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly string[] StopWords =
    [
        "the", "and", "for", "with", "this", "that", "from", "while", "when", "into", "your",
        "service", "services", "logs", "error", "errors", "issue", "incident", "production"
    ];

    public static RetrievedRunbook[] Retrieve(IncidentAnalysisRequest request)
    {
        var query = $"{request.ServiceName} {request.Environment} {request.Severity} {request.Symptoms} {request.Logs}";
        var queryTerms = Tokenize(query).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var runbooks = LoadRunbooks();

        var rankedRunbooks = runbooks
            .Select(runbook => Score(runbook, queryTerms))
            .Where(result =>
                !result.Path.Contains("incident-communications", StringComparison.OrdinalIgnoreCase) &&
                result.Score >= MinimumRelevantScore)
            .OrderByDescending(result => result.Score)
            .Take(MaxRelevantRunbooks)
            .ToList();

        var communicationsRunbook = runbooks.FirstOrDefault(
            runbook => runbook.Path.Contains("incident-communications", StringComparison.OrdinalIgnoreCase));

        if (communicationsRunbook is not null && rankedRunbooks.All(result => result.Path != communicationsRunbook.Path))
        {
            rankedRunbooks.Add(new RetrievedRunbook(
                communicationsRunbook.Title,
                communicationsRunbook.Path,
                "Used to shape the draft incident update with impact, suspected cause, mitigation, and next-update wording.",
                TrimSnippet(communicationsRunbook.Content),
                0));
        }

        return rankedRunbooks.ToArray();
    }

    private static RetrievedRunbook Score(RunbookDocument runbook, HashSet<string> queryTerms)
    {
        var runbookTerms = Tokenize($"{runbook.Title} {runbook.Content}").ToHashSet(StringComparer.OrdinalIgnoreCase);
        var matchedTerms = queryTerms
            .Where(runbookTerms.Contains)
            .Take(8)
            .ToArray();

        var reason = BuildReason(runbook.Title, matchedTerms);

        return new RetrievedRunbook(
            runbook.Title,
            runbook.Path,
            reason,
            TrimSnippet(runbook.Content),
            matchedTerms.Length);
    }

    private static RunbookDocument[] LoadRunbooks()
    {
        var runbookDirectory = ResolveRunbookDirectory();

        if (!Directory.Exists(runbookDirectory))
        {
            return [];
        }

        return Directory
            .GetFiles(runbookDirectory, "*.md", SearchOption.TopDirectoryOnly)
            .Select(path =>
            {
                var content = File.ReadAllText(path);
                return new RunbookDocument(
                    Title: ExtractTitle(content),
                    Path: $"backend/IncidentCopilot.Api/Runbooks/{Path.GetFileName(path)}",
                    Content: content);
            })
            .ToArray();
    }

    private static string ResolveRunbookDirectory()
    {
        var publishedRunbooks = Path.Combine(AppContext.BaseDirectory, "Runbooks");

        if (Directory.Exists(publishedRunbooks))
        {
            return publishedRunbooks;
        }

        return Path.Combine(Directory.GetCurrentDirectory(), "Runbooks");
    }

    private static string ExtractTitle(string content)
    {
        var firstLine = content
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault(line => line.StartsWith("# ", StringComparison.Ordinal));

        return firstLine?.TrimStart('#', ' ') ?? "Untitled Runbook";
    }

    private static IEnumerable<string> Tokenize(string value)
    {
        var stopWords = StopWords.ToHashSet(StringComparer.OrdinalIgnoreCase);

        return TokenRegex
            .Matches(value.ToLowerInvariant())
            .Select(match => match.Value)
            .Where(token => !stopWords.Contains(token));
    }

    private static string BuildReason(string title, string[] matchedTerms)
    {
        if (matchedTerms.Length == 0)
        {
            return "Used as general incident guidance for the generated response.";
        }

        var readableTerms = matchedTerms
            .Select(FormatTerm)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(5);
        var focus = GetGuidanceFocus(title);

        return $"Selected because the incident mentions {string.Join(", ", readableTerms)}. {focus}";
    }

    private static string GetGuidanceFocus(string title)
    {
        if (title.Contains("API Error", StringComparison.OrdinalIgnoreCase))
        {
            return "Use this to review error rates, latency, timeout settings, retries, and dependency health.";
        }

        if (title.Contains("Async", StringComparison.OrdinalIgnoreCase))
        {
            return "Use this to review queue depth, consumer throughput, dead-letter volume, throttling, and replay decisions.";
        }

        if (title.Contains("Dependency", StringComparison.OrdinalIgnoreCase))
        {
            return "Use this to review connection pools, resource saturation, dependency latency, and deployment correlation.";
        }

        return "Use this guidance to keep the investigation focused and repeatable.";
    }

    private static string FormatTerm(string term)
    {
        return term switch
        {
            "connectionpool" => "connection pool",
            "postgresql" => "PostgreSQL",
            "sqs" => "SQS",
            "dlq" => "DLQ",
            _ => term
        };
    }

    private static string TrimSnippet(string content)
    {
        return content.Length <= MaxSnippetLength
            ? content
            : $"{content[..MaxSnippetLength]}...";
    }
}

record RunbookDocument(
    string Title,
    string Path,
    string Content
);

record RetrievedRunbook(
    string Title,
    string Path,
    string Reason,
    string Content,
    int Score
);
