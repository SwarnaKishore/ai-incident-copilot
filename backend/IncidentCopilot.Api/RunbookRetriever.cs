using System.Text.RegularExpressions;

static class RunbookRetriever
{
    private const int MaxRunbooks = 3;
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
            .Where(result => result.Score > 0 || result.Path.Contains("incident-communications", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(result => result.Path.Contains("incident-communications", StringComparison.OrdinalIgnoreCase) ? -1 : result.Score)
            .Take(MaxRunbooks - 1)
            .ToList();

        var communicationsRunbook = runbooks.FirstOrDefault(
            runbook => runbook.Path.Contains("incident-communications", StringComparison.OrdinalIgnoreCase));

        if (communicationsRunbook is not null && rankedRunbooks.All(result => result.Path != communicationsRunbook.Path))
        {
            rankedRunbooks.Add(new RetrievedRunbook(
                communicationsRunbook.Title,
                communicationsRunbook.Path,
                "Always included to format the stakeholder update draft.",
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

        var score = matchedTerms.Length;
        var reason = matchedTerms.Length == 0
            ? "Included as general incident guidance."
            : $"Matched terms: {string.Join(", ", matchedTerms)}.";

        return new RetrievedRunbook(
            runbook.Title,
            runbook.Path,
            reason,
            TrimSnippet(runbook.Content),
            score);
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
