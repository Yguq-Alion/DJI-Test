using System.ComponentModel.DataAnnotations;
using SalesDashboard.Api.Common.Periods;
using SalesDashboard.Api.Features.Analytics;

namespace SalesDashboard.Api.Features.Dashboard;

public enum ChangeKind
{
    /// <summary>Относительное изменение, %.</summary>
    Percent,

    /// <summary>Разница долей в процентных пунктах.</summary>
    Points,
}

public sealed record KpiValue(decimal? Value, decimal? Previous, decimal? Change, ChangeKind ChangeKind)
{
    public static KpiValue Money(decimal? current, decimal? previous) =>
        new(current, previous, Analytics.Change.Percent(current, previous), ChangeKind.Percent);

    public static KpiValue Ratio(decimal? current, decimal? previous) =>
        new(current, previous, Analytics.Change.Points(current, previous), ChangeKind.Points);
}

public sealed record BestManagerDto(ManagerDto Manager, decimal GrossProfit, decimal Revenue, decimal? RefundRate, int SalesCount);

public sealed record KpiResponse(
    PeriodDto Period,
    PeriodDto PreviousPeriod,
    KpiValue Revenue,
    KpiValue GrossRevenue,
    KpiValue GrossProfit,
    KpiValue Margin,
    KpiValue SalesCount,
    KpiValue AverageCheck,
    KpiValue RefundRate,
    KpiValue RefundedAmount,
    KpiValue RefundCosts,
    BestManagerDto? BestManager);

public sealed class TimeseriesQuery : PeriodQuery
{
    /// <summary>auto | hour | day | week | month</summary>
    public string Granularity { get; set; } = "auto";
}

public sealed record TimeseriesPoint(DateTime BucketStart, decimal Revenue, decimal GrossProfit, int SalesCount, int RefundsCount, decimal RefundedAmount);

public sealed record TimeseriesResponse(PeriodDto Period, Granularity Granularity, IReadOnlyList<TimeseriesPoint> Points);

public sealed record CategoryItem(int CategoryId, string Category, decimal Revenue, decimal GrossProfit, decimal? Margin, decimal? Share);

public sealed record CategoriesResponse(PeriodDto Period, IReadOnlyList<CategoryItem> Items);

public sealed class TopProductsQuery : PeriodQuery
{
    [Range(1, 50)]
    public int Limit { get; set; } = 10;
}

public sealed record TopProductItem(int ProductId, string Product, string Category, int Quantity, decimal Revenue, decimal GrossProfit, decimal? Margin);

public sealed record TopProductsResponse(PeriodDto Period, IReadOnlyList<TopProductItem> Items);
