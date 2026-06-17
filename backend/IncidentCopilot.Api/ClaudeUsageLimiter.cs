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
