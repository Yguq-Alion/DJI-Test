using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SalesDashboard.Api.Common.Periods;
using SalesDashboard.Api.Data;
using SalesDashboard.Api.Domain;
using SalesDashboard.Api.Features.Analytics;

namespace SalesDashboard.Api.Features.Sales;

public sealed class RecentSalesQuery : PeriodQuery
{
    [Range(1, 100)]
    public int Limit { get; set; } = 20;

    /// <summary>Непрозрачный курсор из nextCursor предыдущей страницы.</summary>
    public string? Cursor { get; set; }

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

public sealed record RecentSalesResponse(PeriodDto Period, IReadOnlyList<RecentSaleDto> Items, string? NextCursor);

[ApiController]
[Route("api/sales")]
public sealed class SalesController(AppDbContext db, PeriodResolver periods) : ControllerBase
{
    /// <summary>
    /// Продажи периода от новых к старым. Keyset-пагинация по (sold_at, id): стабильна при вставках
    /// и не деградирует на глубоких страницах, в отличие от OFFSET.
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

        if (query.Cursor is not null)
        {
            if (!TryDecodeCursor(query.Cursor, out var soldAt, out var id))
            {
                ModelState.AddModelError(nameof(query.Cursor), "Некорректный курсор.");
                return ValidationProblem(ModelState);
            }

            sales = sales.Where(s => s.SoldAt < soldAt || (s.SoldAt == soldAt && s.Id < id));
        }

        var page = await sales
            .OrderByDescending(s => s.SoldAt)
            .ThenByDescending(s => s.Id)
            .Take(query.Limit + 1)
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

        var hasMore = page.Count > query.Limit;
        var items = page.Take(query.Limit).Select(s => new RecentSaleDto(
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

        var next = hasMore ? EncodeCursor(items[^1].SoldAt, items[^1].Id) : null;
        return new RecentSalesResponse(PeriodDto.Of(current), items, next);
    }

    private static string EncodeCursor(DateTimeOffset soldAt, long id) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes($"{soldAt.UtcTicks}:{id}")).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static bool TryDecodeCursor(string cursor, out DateTimeOffset soldAt, out long id)
    {
        soldAt = default;
        id = 0;
        try
        {
            var base64 = cursor.Replace('-', '+').Replace('_', '/');
            base64 = base64.PadRight(base64.Length + (4 - base64.Length % 4) % 4, '=');
            var parts = Encoding.UTF8.GetString(Convert.FromBase64String(base64)).Split(':');
            if (parts.Length != 2
                || !long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
                || !long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out id)
                || ticks < DateTimeOffset.MinValue.UtcTicks || ticks > DateTimeOffset.MaxValue.UtcTicks)
            {
                return false;
            }

            soldAt = new DateTimeOffset(ticks, TimeSpan.Zero);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
