using SalesDashboard.Api.Common.Periods;

namespace SalesDashboard.Api.Features.Analytics;

public sealed record PeriodDto(DateOnly From, DateOnly To, string Tz)
{
    public static PeriodDto Of(ResolvedPeriod period) => new(period.From, period.To, period.TimeZone.Id);
}

public sealed record ManagerDto(int Id, string FullName, string Team, string Position, string AvatarColor, bool IsActive);
