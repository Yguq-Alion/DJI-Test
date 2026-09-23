using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SalesDashboard.Api.Common.Periods;
using SalesDashboard.Api.Data;
using SalesDashboard.Api.Features.Analytics;

namespace SalesDashboard.Api.Features.Dashboard;

[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController(AppDbContext db, AnalyticsQueries analytics, PeriodResolver periods) : ControllerBase
{
    private const int MaxTimeseriesPoints = 800;

    [HttpGet("kpi")]
    public async Task<KpiResponse> GetKpi([FromQuery] PeriodQuery query, CancellationToken ct)
    {
        var (current, previous) = periods.Resolve(query);
        var currentRows = await analytics.GetManagerLedgersAsync(current, ct);
        var previousRows = await analytics.GetManagerLedgersAsync(previous, ct);
        var cur = Ledger.Sum(currentRows);
        var prev = Ledger.Sum(previousRows);

        return new KpiResponse(
            PeriodDto.Of(current),
            PeriodDto.Of(previous),
            KpiValue.Money(cur.Revenue, prev.Revenue),
            KpiValue.Money(cur.GrossRevenue, prev.GrossRevenue),
            KpiValue.Money(cur.GrossProfit, prev.GrossProfit),
            KpiValue.Ratio(cur.Margin, prev.Margin),
            KpiValue.Money(cur.SalesCount, prev.SalesCount),
            KpiValue.Money(cur.AverageCheck, prev.AverageCheck),
            KpiValue.Ratio(cur.RefundRate, prev.RefundRate),
            KpiValue.Money(cur.RefundedAmount, prev.RefundedAmount),
            KpiValue.Money(cur.RefundCosts, prev.RefundCosts),
            await GetBestManagerAsync(currentRows, ct));
    }

    [HttpGet("timeseries")]
    public async Task<ActionResult<TimeseriesResponse>> GetTimeseries([FromQuery] TimeseriesQuery query, CancellationToken ct)
    {
        var (current, _) = periods.Resolve(query);

        Granularity granularity;
        if (query.Granularity.Equals("auto", StringComparison.OrdinalIgnoreCase))
        {
            granularity = AutoGranularity(current.Days);
        }
        else if (!Enum.TryParse(query.Granularity, ignoreCase: true, out granularity))
        {
            return ValidationError(nameof(query.Granularity), "Допустимо: auto, hour, day, week, month.");
        }
        else if (EstimatePoints(current.Days, granularity) > MaxTimeseriesPoints)
        {
            return ValidationError(nameof(query.Granularity), "Слишком мелкий шаг для выбранного периода.");
        }

        var rows = await analytics.GetTimeseriesAsync(current, granularity, ct);
        var points = rows.Select(r => new TimeseriesPoint(r.BucketStart, r.Revenue, r.GrossProfit, r.SalesCount)).ToList();
        return new TimeseriesResponse(PeriodDto.Of(current), granularity, points);
    }

    [HttpGet("categories")]
    public async Task<CategoriesResponse> GetCategories([FromQuery] PeriodQuery query, CancellationToken ct)
    {
        var (current, _) = periods.Resolve(query);
        var rows = await analytics.GetProductLedgersAsync(current, ct);
        var categories = await db.Categories.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        var byCategory = rows
            .GroupBy(r => r.CategoryId)
            .Select(g => (Id: g.Key, Revenue: g.Sum(r => r.Revenue), GrossProfit: g.Sum(r => r.GrossProfit)))
            .ToList();
        var totalRevenue = byCategory.Where(c => c.Revenue > 0).Sum(c => c.Revenue);

        var items = byCategory
            .Select(c => new CategoryItem(
                c.Id,
                categories[c.Id],
                c.Revenue,
                c.GrossProfit,
                c.Revenue > 0 ? Math.Round(c.GrossProfit / c.Revenue, 4) : null,
                totalRevenue > 0 && c.Revenue > 0 ? Math.Round(c.Revenue / totalRevenue, 4) : null))
            .OrderByDescending(c => c.Revenue)
            .ThenBy(c => c.Category)
            .ToList();
        return new CategoriesResponse(PeriodDto.Of(current), items);
    }

    [HttpGet("products/top")]
    public async Task<TopProductsResponse> GetTopProducts([FromQuery] TopProductsQuery query, CancellationToken ct)
    {
        var (current, _) = periods.Resolve(query);
        var rows = await analytics.GetProductLedgersAsync(current, ct);
        var top = rows
            .Where(r => r.Revenue > 0)
            .OrderByDescending(r => r.Revenue)
            .ThenBy(r => r.ProductId)
            .Take(query.Limit)
            .ToList();

        var ids = top.Select(r => r.ProductId).ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, Category = p.Category.Name })
            .ToDictionaryAsync(p => p.Id, ct);

        var items = top.Select(r => new TopProductItem(
                r.ProductId,
                products[r.ProductId].Name,
                products[r.ProductId].Category,
                r.Quantity,
                r.Revenue,
                r.GrossProfit,
                Math.Round(r.GrossProfit / r.Revenue, 4)))
            .ToList();
        return new TopProductsResponse(PeriodDto.Of(current), items);
    }

    /// <summary>
    /// Лучший менеджер — максимум чистого GP; при равенстве — больше выручка, затем имя (docs/decisions.md §1.4).
    /// </summary>
    private async Task<BestManagerDto?> GetBestManagerAsync(List<ManagerLedgerRow> rows, CancellationToken ct)
    {
        var active = rows.Where(r => r.HasActivity).ToList();
        if (active.Count == 0)
        {
            return null;
        }

        var managers = await db.Managers.AsNoTracking()
            .Select(m => new ManagerDto(m.Id, m.FullName, m.Team, m.Position, m.AvatarColor, m.IsActive))
            .ToDictionaryAsync(m => m.Id, ct);

        var best = active
            .OrderByDescending(r => r.GrossProfit)
            .ThenByDescending(r => r.Revenue)
            .ThenBy(r => managers[r.ManagerId].FullName, StringComparer.Ordinal)
            .First();
        return new BestManagerDto(managers[best.ManagerId], best.GrossProfit, best.Revenue, best.RefundRate, best.SalesCount);
    }

    /// <summary>≤ 1 дня — по часам, ≤ 62 дней — по дням, ≤ 26 недель — по неделям, иначе по месяцам.</summary>
    internal static Granularity AutoGranularity(int days) => days switch
    {
        <= 1 => Granularity.Hour,
        <= 62 => Granularity.Day,
        <= 26 * 7 => Granularity.Week,
        _ => Granularity.Month,
    };

    private static int EstimatePoints(int days, Granularity granularity) => granularity switch
    {
        Granularity.Hour => days * 24,
        Granularity.Day => days,
        Granularity.Week => days / 7 + 2,
        _ => days / 28 + 2,
    };

    private ActionResult ValidationError(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }
}
