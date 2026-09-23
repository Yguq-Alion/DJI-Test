using System.ComponentModel.DataAnnotations;

namespace SalesDashboard.Api.Common.Periods;

/// <summary>
/// Параметры периода: либо <c>preset</c>, либо пара <c>from</c>/<c>to</c> (локальные календарные даты, включительно).
/// <c>tz</c> — IANA-пояс браузера, в нём считаются границы дней.
/// </summary>
public class PeriodQuery : IValidatableObject
{
    public const int MaxRangeDays = 731;

    /// <summary>today | 7d | 30d | thisMonth | lastMonth</summary>
    public string? Preset { get; set; }

    public DateOnly? From { get; set; }

    public DateOnly? To { get; set; }

    [Required(ErrorMessage = "Параметр tz (IANA-часовой пояс) обязателен.")]
    public string Tz { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!string.IsNullOrEmpty(Tz) && !TimeZoneInfo.TryFindSystemTimeZoneById(Tz, out _))
        {
            yield return new ValidationResult($"Неизвестный часовой пояс '{Tz}'.", [nameof(Tz)]);
        }

        if (Preset is not null)
        {
            if (From is not null || To is not null)
            {
                yield return new ValidationResult("Укажите либо preset, либо from/to.", [nameof(Preset)]);
            }
            else if (!PeriodPresets.All.Contains(Preset))
            {
                yield return new ValidationResult($"Неизвестный preset '{Preset}'. Допустимо: {string.Join(", ", PeriodPresets.All)}.", [nameof(Preset)]);
            }

            yield break;
        }

        if (From is null || To is null)
        {
            yield return new ValidationResult("Укажите preset или обе даты from и to.", [nameof(From), nameof(To)]);
            yield break;
        }

        if (From > To)
        {
            yield return new ValidationResult("Дата from не может быть позже to.", [nameof(From), nameof(To)]);
        }
        else if (To.Value.DayNumber - From.Value.DayNumber + 1 > MaxRangeDays)
        {
            yield return new ValidationResult($"Период не может быть длиннее {MaxRangeDays} дней.", [nameof(From), nameof(To)]);
        }
    }
}

public static class PeriodPresets
{
    public const string Today = "today";
    public const string Last7Days = "7d";
    public const string Last30Days = "30d";
    public const string ThisMonth = "thisMonth";
    public const string LastMonth = "lastMonth";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Today, Last7Days, Last30Days, ThisMonth, LastMonth,
    };
}
