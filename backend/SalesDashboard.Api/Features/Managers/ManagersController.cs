using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SalesDashboard.Api.Common.Periods;
using SalesDashboard.Api.Data;
using SalesDashboard.Api.Features.Analytics;

namespace SalesDashboard.Api.Features.Managers;

public enum RankingSort
{
    GrossProfit,
    AverageCheck,
}

public sealed class RankingQuery : PeriodQuery
{
    [Required]
    public RankingSort SortBy { get; set; } = RankingSort.GrossProfit;
}

public sealed record RankingItem(
    int? Rank,
    int? PreviousRank,
    ManagerDto Manager,
    int SalesCount,
    decimal Revenue,
    decimal GrossProfit,
    decimal? AverageCheck,
    decimal? Margin,
    decimal? RefundRate,
    decimal? Change);

public sealed record RankingResponse(PeriodDto Period, PeriodDto PreviousPeriod, RankingSort SortBy, IReadOnlyList<RankingItem> Items);

[ApiController]
[Route("api/managers")]
public sealed class ManagersController(AppDbContext db, AnalyticsQueries analytics, PeriodResolver periods) : ControllerBase
{
    [HttpGet("ranking")]
    public async Task<RankingResponse> GetRanking([FromQuery] RankingQuery query, CancellationToken ct)
    {
        var (current, previous) = periods.Resolve(query);
        var currentRows = await analytics.GetManagerLedgersAsync(current, ct);
        var previousRows = (await analytics.GetManagerLedgersAsync(previous, ct)).ToDictionary(r => r.ManagerId);
        var managers = await db.Managers.AsNoTracking()
            .Select(m => new ManagerDto(m.Id, m.FullName, m.Team, m.Position, m.AvatarColor, m.IsActive))
            .ToDictionaryAsync(m => m.Id, ct);

        var previousRanks = Rank(previousRows.Values, query.SortBy, managers);
        var currentRanks = Rank(currentRows, query.SortBy, managers);

        var items = currentRows
            // Уволенные без активности в периоде не показываются; активные без продаж — в конце с нулями.
            .Where(r => r.HasActivity || managers[r.ManagerId].IsActive)
            .Select(r => new RankingItem(
                currentRanks.GetValueOrDefault(r.ManagerId),
                previousRanks.GetValueOrDefault(r.ManagerId),
                managers[r.ManagerId],
                r.SalesCount,
                r.Revenue,
                r.GrossProfit,
                r.AverageCheck,
                r.Margin,
                r.RefundRate,
                Change.Percent(SortValue(r, query.SortBy), previousRows.TryGetValue(r.ManagerId, out var p) ? SortValue(p, query.SortBy) : null)))
            .OrderBy(i => i.Rank ?? int.MaxValue)
            .ThenBy(i => i.Manager.FullName, StringComparer.Ordinal)
            .ToList();

        return new RankingResponse(PeriodDto.Of(current), PeriodDto.Of(previous), query.SortBy, items);
    }

    /// <summary>
    /// Места 1..N среди менеджеров с продажами в периоде. Tie-break: метрика ↓, выручка ↓, имя ↑ —
    /// порядок детерминирован даже при полностью одинаковых результатах.
    /// </summary>
    internal static Dictionary<int, int?> Rank(IEnumerable<ManagerLedgerRow> rows, RankingSort sortBy, IReadOnlyDictionary<int, ManagerDto> managers) =>
        rows
            .Where(r => r.SalesCount > 0 || (sortBy == RankingSort.GrossProfit && r.HasActivity))
            .OrderByDescending(r => SortValue(r, sortBy) ?? decimal.MinValue)
            .ThenByDescending(r => r.Revenue)
            .ThenBy(r => managers[r.ManagerId].FullName, StringComparer.Ordinal)
            .Select((r, index) => (r.ManagerId, Rank: index + 1))
            .ToDictionary(x => x.ManagerId, x => (int?)x.Rank);

    private static decimal? SortValue(Ledger ledger, RankingSort sortBy) => sortBy switch
    {
        RankingSort.GrossProfit => ledger.GrossProfit,
        RankingSort.AverageCheck => ledger.AverageCheck,
        _ => throw new ArgumentOutOfRangeException(nameof(sortBy)),
    };
}
