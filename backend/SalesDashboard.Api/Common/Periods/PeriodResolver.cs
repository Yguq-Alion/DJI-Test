namespace SalesDashboard.Api.Common.Periods;

/// <summary>Календарный период [From; To], даты включительно.</summary>
public sealed record DateRange(DateOnly From, DateOnly To)
{
    public int Days => To.DayNumber - From.DayNumber + 1;
}

/// <summary>
/// Разрешённый период: локальные даты + полуоткрытый интервал [StartUtc; EndUtc) для SQL.
/// </summary>
public sealed record ResolvedPeriod(DateRange Range, TimeZoneInfo TimeZone, DateTimeOffset StartUtc, DateTimeOffset EndUtc)
{
    public DateOnly From => Range.From;
    public DateOnly To => Range.To;
    public int Days => Range.Days;

    /// <summary>Локальная полночь начала периода (для сетки графика в SQL).</summary>
    public DateTime StartLocal => From.ToDateTime(TimeOnly.MinValue);

    /// <summary>Локальная полночь дня, следующего за последним днём периода.</summary>
    public DateTime EndLocal => To.AddDays(1).ToDateTime(TimeOnly.MinValue);
}

public sealed record PeriodPair(ResolvedPeriod Current, ResolvedPeriod Previous);

/// <summary>
/// Единственное место логики периодов: пресеты, часовой пояс, предыдущий период.
/// Предыдущий период — отрезок той же длины сразу перед текущим; для «этого месяца» — та же часть
/// прошлого месяца, для «прошлого месяца» — позапрошлый месяц целиком (docs/decisions.md §1.2).
/// </summary>
public sealed class PeriodResolver(TimeProvider timeProvider)
{
    public PeriodPair Resolve(PeriodQuery query)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(query.Tz);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), tz).DateTime);

        var (current, previous) = query.Preset switch
        {
            PeriodPresets.Today => (new DateRange(today, today), Shift(new DateRange(today, today))),
            PeriodPresets.Last7Days => LastDays(today, 7),
            PeriodPresets.Last30Days => LastDays(today, 30),
            PeriodPresets.ThisMonth => ThisMonth(today),
            PeriodPresets.LastMonth => LastMonth(today),
            null => Custom(query.From!.Value, query.To!.Value),
            _ => throw new ArgumentOutOfRangeException(nameof(query), query.Preset, "Unknown preset"),
        };

        return new PeriodPair(ToResolved(current, tz), ToResolved(previous, tz));
    }

    private static (DateRange, DateRange) LastDays(DateOnly today, int days)
    {
        var current = new DateRange(today.AddDays(-(days - 1)), today);
        return (current, Shift(current));
    }

    private static (DateRange, DateRange) Custom(DateOnly from, DateOnly to)
    {
        var current = new DateRange(from, to);
        return (current, Shift(current));
    }

    private static (DateRange, DateRange) ThisMonth(DateOnly today)
    {
        var start = new DateOnly(today.Year, today.Month, 1);
        var previousStart = start.AddMonths(-1);
        // 1–31 марта ↔ 1–28 февраля: день обрезается по длине прошлого месяца.
        var previousEnd = previousStart.AddDays(Math.Min(today.Day, DateTime.DaysInMonth(previousStart.Year, previousStart.Month)) - 1);
        return (new DateRange(start, today), new DateRange(previousStart, previousEnd));
    }

    private static (DateRange, DateRange) LastMonth(DateOnly today)
    {
        var start = new DateOnly(today.Year, today.Month, 1).AddMonths(-1);
        var current = new DateRange(start, start.AddMonths(1).AddDays(-1));
        var previousStart = start.AddMonths(-1);
        return (current, new DateRange(previousStart, start.AddDays(-1)));
    }

    /// <summary>Отрезок той же длины, заканчивающийся накануне начала <paramref name="range"/>.</summary>
    private static DateRange Shift(DateRange range) =>
        new(range.From.AddDays(-range.Days), range.From.AddDays(-1));

    private static ResolvedPeriod ToResolved(DateRange range, TimeZoneInfo tz) =>
        new(range, tz, LocalMidnightToUtc(range.From, tz), LocalMidnightToUtc(range.To.AddDays(1), tz));

    /// <summary>
    /// Локальная полночь → UTC. Если полночь попала в «дыру» перехода на летнее время,
    /// берём первый существующий момент после неё.
    /// </summary>
    internal static DateTimeOffset LocalMidnightToUtc(DateOnly date, TimeZoneInfo tz)
    {
        var local = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        while (tz.IsInvalidTime(local))
        {
            local = local.AddMinutes(15);
        }

        return new DateTimeOffset(local, tz.GetUtcOffset(local)).ToUniversalTime();
    }
}
