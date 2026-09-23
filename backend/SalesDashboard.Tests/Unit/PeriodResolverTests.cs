using Microsoft.Extensions.Time.Testing;
using SalesDashboard.Api.Common.Periods;

namespace SalesDashboard.Tests.Unit;

public sealed class PeriodResolverTests
{
    private const string Moscow = "Europe/Moscow";

    private static PeriodPair Resolve(DateTimeOffset utcNow, string? preset = null, DateOnly? from = null, DateOnly? to = null, string tz = Moscow) =>
        new PeriodResolver(new FakeTimeProvider(utcNow)).Resolve(new PeriodQuery { Preset = preset, From = from, To = to, Tz = tz });

    private static DateOnly D(int year, int month, int day) => new(year, month, day);

    [Fact]
    public void Today_UsesUserTimeZone_NotUtc()
    {
        // 22:30 UTC 23 сентября — в Москве уже 24 сентября.
        var pair = Resolve(new DateTimeOffset(2026, 9, 23, 22, 30, 0, TimeSpan.Zero), PeriodPresets.Today);

        Assert.Equal(D(2026, 9, 24), pair.Current.From);
        Assert.Equal(D(2026, 9, 24), pair.Current.To);
        Assert.Equal(new DateTimeOffset(2026, 9, 23, 21, 0, 0, TimeSpan.Zero), pair.Current.StartUtc);
        Assert.Equal(new DateTimeOffset(2026, 9, 24, 21, 0, 0, TimeSpan.Zero), pair.Current.EndUtc);
        Assert.Equal(D(2026, 9, 23), pair.Previous.From);
        Assert.Equal(D(2026, 9, 23), pair.Previous.To);
    }

    [Theory]
    [InlineData(PeriodPresets.Last7Days, 7)]
    [InlineData(PeriodPresets.Last30Days, 30)]
    public void LastNDays_IncludesToday_AndPreviousHasSameLength(string preset, int days)
    {
        var pair = Resolve(new DateTimeOffset(2026, 9, 23, 12, 0, 0, TimeSpan.Zero), preset);

        Assert.Equal(D(2026, 9, 23), pair.Current.To);
        Assert.Equal(days, pair.Current.Days);
        Assert.Equal(days, pair.Previous.Days);
        Assert.Equal(pair.Current.From.AddDays(-1), pair.Previous.To);
        Assert.Equal(pair.Current.StartUtc, pair.Previous.EndUtc);
    }

    [Fact]
    public void ThisMonth_ComparesWithSamePartOfPreviousMonth()
    {
        var pair = Resolve(new DateTimeOffset(2026, 9, 23, 12, 0, 0, TimeSpan.Zero), PeriodPresets.ThisMonth);

        Assert.Equal((D(2026, 9, 1), D(2026, 9, 23)), (pair.Current.From, pair.Current.To));
        Assert.Equal((D(2026, 8, 1), D(2026, 8, 23)), (pair.Previous.From, pair.Previous.To));
    }

    [Fact]
    public void ThisMonth_ClampsPreviousRangeToShorterMonth()
    {
        var pair = Resolve(new DateTimeOffset(2026, 3, 31, 12, 0, 0, TimeSpan.Zero), PeriodPresets.ThisMonth);

        Assert.Equal((D(2026, 2, 1), D(2026, 2, 28)), (pair.Previous.From, pair.Previous.To));
    }

    [Fact]
    public void LastMonth_IsWholeMonth_ComparedWithTheMonthBefore()
    {
        var pair = Resolve(new DateTimeOffset(2026, 1, 10, 12, 0, 0, TimeSpan.Zero), PeriodPresets.LastMonth);

        Assert.Equal((D(2025, 12, 1), D(2025, 12, 31)), (pair.Current.From, pair.Current.To));
        Assert.Equal((D(2025, 11, 1), D(2025, 11, 30)), (pair.Previous.From, pair.Previous.To));
    }

    [Fact]
    public void CustomRange_IsInclusive_AndPreviousIsImmediatelyBefore()
    {
        var pair = Resolve(DateTimeOffset.UtcNow, from: D(2026, 9, 1), to: D(2026, 9, 10));

        Assert.Equal(10, pair.Current.Days);
        Assert.Equal((D(2026, 8, 22), D(2026, 8, 31)), (pair.Previous.From, pair.Previous.To));
        Assert.Equal(new DateTimeOffset(2026, 8, 31, 21, 0, 0, TimeSpan.Zero), pair.Current.StartUtc);
        Assert.Equal(new DateTimeOffset(2026, 9, 10, 21, 0, 0, TimeSpan.Zero), pair.Current.EndUtc);
    }

    [Fact]
    public void DaylightSavingTime_ProducesCorrectUtcBounds()
    {
        // Нью-Йорк: 8 марта 2026 переход на летнее время (UTC-5 → UTC-4).
        var pair = Resolve(DateTimeOffset.UtcNow, from: D(2026, 3, 8), to: D(2026, 3, 8), tz: "America/New_York");

        Assert.Equal(new DateTimeOffset(2026, 3, 8, 5, 0, 0, TimeSpan.Zero), pair.Current.StartUtc);
        Assert.Equal(new DateTimeOffset(2026, 3, 9, 4, 0, 0, TimeSpan.Zero), pair.Current.EndUtc);
    }

    [Fact]
    public void MidnightInsideDstGap_IsShiftedToFirstValidInstant()
    {
        // Сантьяго (Чили): 7 сентября 2025 часы переводятся с 00:00 на 01:00 — полночи не существует.
        var start = PeriodResolver.LocalMidnightToUtc(D(2025, 9, 7), TimeZoneInfo.FindSystemTimeZoneById("America/Santiago"));

        Assert.Equal(new DateTimeOffset(2025, 9, 7, 4, 0, 0, TimeSpan.Zero), start);
    }
}
