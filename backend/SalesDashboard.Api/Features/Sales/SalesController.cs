using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SalesDashboard.Api.Common.Periods;
using SalesDashboard.Api.Data;
using SalesDashboard.Api.Domain;
using SalesDashboard.Api.Features.Analytics;

namespace SalesDashboard.Api.Features.Sales;

public enum RecentSalesSort
{
    SoldAt,
    Manager,
    Customer,
    Items,
    Status,
    Amount,
    GrossProfit,
}

public enum SortDirection
{
    Asc,
    Desc,
}

public sealed class RecentSalesQuery : PeriodQuery
{
    [Range(1, 100)]
    public int Limit { get; set; } = 20;

    /// <summary>Номер страницы, с 1.</summary>
    [Range(1, 100_000)]
    public int Page { get; set; } = 1;

    public RecentSalesSort SortBy { get; set; } = RecentSalesSort.SoldAt;

    public SortDirection SortDir { get; set; } = SortDirection.Desc;

    public SaleStatus? Status { get; set; }

    public int? ManagerId { get; set; }
}

public sealed record SaleLineDto(string Product, int Quantity, decimal UnitPrice);

public sealed record RefundDto(DateTimeOffset RefundedAt, bool ItemsRestocked, string? Reason, decimal ExtraCosts);

public sealed record RecentSaleDto(
    long Id,
    DateTimeOffset SoldAt,
    SaleStatus Status,
    ManagerDto Manager,
    string Customer,
    string Company,
    IReadOnlyList<SaleLineDto> Items,
    decimal Amount,
    decimal GrossProfit,
    RefundDto? Refund);

public sealed record RecentSalesResponse(
    PeriodDto Period,
    IReadOnlyList<RecentSaleDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);

[ApiController]
[Route("api/sales")]
public sealed class SalesController(AppDbContext db, PeriodResolver periods) : ControllerBase
{
    /// <summary>
    /// Продажи периода с сортировкой по любой колонке таблицы и постраничной выдачей.
    /// OFFSET вместо keyset: сортировка идёт и по вычисляемым полям (сумма, прибыль), а в периоде
    /// не больше нескольких тысяч продаж — глубина страниц здесь не проблема, зато есть общее число страниц.
    /// </summary>
    [HttpGet("recent")]
    public async Task<ActionResult<RecentSalesResponse>> GetRecent([FromQuery] RecentSalesQuery query, CancellationToken ct)
    {
        var (current, _) = periods.Resolve(query);

        var sales = db.Sales.AsNoTracking()
            .Where(s => s.SoldAt >= current.StartUtc && s.SoldAt < current.EndUtc);

        if (query.Status is { } status)
        {
            sales = sales.Where(s => s.Status == status);
        }

        if (query.ManagerId is { } managerId)
        {
            sales = sales.Where(s => s.ManagerId == managerId);
        }

        var totalCount = await sales.CountAsync(ct);

        var page = await Sort(sales, query.SortBy, query.SortDir)
            .Skip((query.Page - 1) * query.Limit)
            .Take(query.Limit)
            .Select(s => new
            {
                s.Id,
                s.SoldAt,
                s.Status,
                Manager = new ManagerDto(s.Manager.Id, s.Manager.FullName, s.Manager.Team, s.Manager.Position, s.Manager.AvatarColor, s.Manager.IsActive),
                Customer = s.Customer.Name,
                s.Customer.Company,
                Items = s.Items.OrderByDescending(i => i.Quantity * i.UnitPrice)
                    .Select(i => new { Product = i.Product.Name, i.Quantity, i.UnitPrice, i.UnitCost })
                    .ToList(),
                Refund = s.Refund == null
                    ? null
                    : new RefundDto(s.Refund.RefundedAt, s.Refund.ItemsRestocked, s.Refund.Reason, s.Refund.Costs.Sum(c => c.Amount)),
            })
            .AsSplitQuery()
            .ToListAsync(ct);

        var items = page.Select(s => new RecentSaleDto(
                s.Id,
                s.SoldAt,
                s.Status,
                s.Manager,
                s.Customer,
                s.Company,
                s.Items.Select(i => new SaleLineDto(i.Product, i.Quantity, i.UnitPrice)).ToList(),
                s.Items.Sum(i => i.Quantity * i.UnitPrice),
                s.Items.Sum(i => i.Quantity * (i.UnitPrice - i.UnitCost)),
                s.Refund))
            .ToList();

        var totalPages = (totalCount + query.Limit - 1) / query.Limit;
        return new RecentSalesResponse(PeriodDto.Of(current), items, query.Page, query.Limit, totalCount, totalPages);
    }

    /// <summary>
    /// Сортировка по выбранной колонке; (sold_at, id) в конце — детерминированный порядок
    /// при равных значениях, иначе строки «переезжали» бы между страницами.
    /// </summary>
    private static IOrderedQueryable<Sale> Sort(IQueryable<Sale> sales, RecentSalesSort sortBy, SortDirection dir)
    {
        var desc = dir == SortDirection.Desc;
        IOrderedQueryable<Sale> ordered = sortBy switch
        {
            RecentSalesSort.Manager => desc ? sales.OrderByDescending(s => s.Manager.FullName) : sales.OrderBy(s => s.Manager.FullName),
            RecentSalesSort.Customer => desc ? sales.OrderByDescending(s => s.Customer.Company) : sales.OrderBy(s => s.Customer.Company),
            // «Товары» в таблице начинаются с самой крупной позиции — по ней и сортируем.
            RecentSalesSort.Items => desc
                ? sales.OrderByDescending(s => s.Items.OrderByDescending(i => i.Quantity * i.UnitPrice).Select(i => i.Product.Name).FirstOrDefault())
                : sales.OrderBy(s => s.Items.OrderByDescending(i => i.Quantity * i.UnitPrice).Select(i => i.Product.Name).FirstOrDefault()),
            RecentSalesSort.Status => desc ? sales.OrderByDescending(s => s.Status) : sales.OrderBy(s => s.Status),
            RecentSalesSort.Amount => desc
                ? sales.OrderByDescending(s => s.Items.Sum(i => i.Quantity * i.UnitPrice))
                : sales.OrderBy(s => s.Items.Sum(i => i.Quantity * i.UnitPrice)),
            RecentSalesSort.GrossProfit => desc
                ? sales.OrderByDescending(s => s.Items.Sum(i => i.Quantity * (i.UnitPrice - i.UnitCost)))
                : sales.OrderBy(s => s.Items.Sum(i => i.Quantity * (i.UnitPrice - i.UnitCost))),
            _ => desc ? sales.OrderByDescending(s => s.SoldAt) : sales.OrderBy(s => s.SoldAt),
        };

        return desc
            ? ordered.ThenByDescending(s => s.SoldAt).ThenByDescending(s => s.Id)
            : ordered.ThenBy(s => s.SoldAt).ThenBy(s => s.Id);
    }
}
