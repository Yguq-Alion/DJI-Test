using System.ComponentModel.DataAnnotations;
using SalesDashboard.Api.Common.Periods;

namespace SalesDashboard.Tests.Unit;

public sealed class PeriodQueryValidationTests
{
    private static List<string> Errors(PeriodQuery query)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(query, new ValidationContext(query), results, validateAllProperties: true);
        return results.Select(r => r.ErrorMessage!).ToList();
    }

    [Fact]
    public void ValidPreset_HasNoErrors() =>
        Assert.Empty(Errors(new PeriodQuery { Preset = "30d", Tz = "Europe/Moscow" }));

    [Fact]
    public void ValidRange_HasNoErrors() =>
        Assert.Empty(Errors(new PeriodQuery { From = new(2026, 1, 1), To = new(2026, 1, 1), Tz = "UTC" }));

    [Theory]
    [InlineData(null, "2026-01-01", null, "Europe/Moscow")]   // нет to
    [InlineData(null, "2026-02-01", "2026-01-01", "Europe/Moscow")] // from > to
    [InlineData(null, "2023-01-01", "2026-01-01", "Europe/Moscow")] // слишком длинный период
    [InlineData("yesterday", null, null, "Europe/Moscow")]     // неизвестный пресет
    [InlineData("7d", "2026-01-01", "2026-01-02", "Europe/Moscow")] // пресет и даты одновременно
    [InlineData("7d", null, null, "Not/AZone")]                // неизвестный пояс
    [InlineData("7d", null, null, "")]                         // пояс не передан
    public void InvalidInput_IsRejected(string? preset, string? from, string? to, string tz)
    {
        var query = new PeriodQuery
        {
            Preset = preset,
            From = from is null ? null : DateOnly.Parse(from),
            To = to is null ? null : DateOnly.Parse(to),
            Tz = tz,
        };

        Assert.NotEmpty(Errors(query));
    }
}
