using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SalesDashboard.Api.Common.Periods;
using SalesDashboard.Api.Data;

namespace SalesDashboard.Api.Features.Analytics;

public enum Granularity
{
    Hour,
    Day,
    Week,
    Month,
}

public sealed class TimeseriesRow
{
    public DateTime BucketStart { get; init; }
    public decimal Revenue { get; init; }
    public decimal GrossProfit { get; init; }
    public int SalesCount { get; init; }
    public int RefundsCount { get; init; }
    public decimal RefundedAmount { get; init; }
}

public sealed class ProductLedgerRow
{
    public int ProductId { get; init; }
    public int CategoryId { get; init; }
    public int Quantity { get; init; }
    public decimal Revenue { get; init; }
    public decimal GrossProfit { get; init; }
}

/// <summary>
/// Аналитические агрегаты на raw SQL. Сторно требует объединить события по двум разным датам
/// (продажа и возврат), а сетка графика — generate_series в поясе пользователя; на LINQ это
/// получалось бы громоздко и с непредсказуемым SQL. Все параметры передаются через
/// FormattableString, т.е. как параметры запроса, а не конкатенацией.
/// </summary>
public sealed class AnalyticsQueries(AppDbContext db)
{
    /// <summary>Суммы по каждому менеджеру за период (включая менеджеров без активности — нулями).</summary>
    public Task<List<ManagerLedgerRow>> GetManagerLedgersAsync(ResolvedPeriod period, CancellationToken ct) =>
        db.Database.SqlQuery<ManagerLedgerRow>($"""
            with sold as (
                select s.manager_id,
                       sum(i.quantity * i.unit_price) as gross_revenue,
                       sum(i.quantity * i.unit_cost) as sold_cost,
                       count(distinct s.id)::int as sales_count,
                       (count(distinct s.id) filter (where s.status = 'refunded'))::int as refunded_sales_count
                from sales s
                join sale_items i on i.sale_id = s.id
                where s.sold_at >= {period.StartUtc} and s.sold_at < {period.EndUtc}
                  and s.status <> 'cancelled'
                group by s.manager_id
            ),
            refund_totals as (
                select s.manager_id, r.items_restocked,
                       sum(i.quantity * i.unit_price) as amount,
                       sum(i.quantity * i.unit_cost) as cost,
                       coalesce(max(extra.amount), 0) as extra
                from refunds r
                join sales s on s.id = r.sale_id
                join sale_items i on i.sale_id = r.sale_id
                left join lateral (select sum(c.amount) as amount from refund_costs c where c.refund_id = r.id) extra on true
                where r.refunded_at >= {period.StartUtc} and r.refunded_at < {period.EndUtc}
                group by r.id, s.manager_id, r.items_restocked
            ),
            refunded as (
                select manager_id,
                       sum(amount) as refunded_amount,
                       sum(case when items_restocked then cost else 0 end) as restocked_cost,
                       sum(extra) as refund_costs
                from refund_totals
                group by manager_id
            )
            select m.id as manager_id,
                   coalesce(sold.gross_revenue, 0) as gross_revenue,
                   coalesce(sold.sold_cost, 0) as sold_cost,
                   coalesce(sold.sales_count, 0) as sales_count,
                   coalesce(sold.refunded_sales_count, 0) as refunded_sales_count,
                   coalesce(refunded.refunded_amount, 0) as refunded_amount,
                   coalesce(refunded.restocked_cost, 0) as restocked_cost,
                   coalesce(refunded.refund_costs, 0) as refund_costs
            from managers m
            left join sold on sold.manager_id = m.id
            left join refunded on refunded.manager_id = m.id
            """).ToListAsync(ct);

    /// <summary>
    /// Динамика по бакетам в поясе пользователя. Пустые бакеты возвращаются нулями (generate_series),
    /// возвраты уменьшают выручку и прибыль в бакете даты возврата.
    /// </summary>
    public Task<List<TimeseriesRow>> GetTimeseriesAsync(ResolvedPeriod period, Granularity granularity, CancellationToken ct)
    {
        var tz = period.TimeZone.Id;
        var unit = granularity.ToString().ToLowerInvariant();
        var step = $"1 {unit}";
        // Локальные границы передаются строкой: DateTime-параметр Npgsql трактует как timestamptz (UTC).
        var startLocal = period.StartLocal.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);
        var endLocal = period.EndLocal.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);

        return db.Database.SqlQuery<TimeseriesRow>($"""
            with sold as (
                select date_trunc({unit}, s.sold_at at time zone {tz}) as bucket,
                       sum(i.quantity * i.unit_price) as revenue,
                       sum(i.quantity * (i.unit_price - i.unit_cost)) as gross_profit,
                       count(distinct s.id)::int as sales_count
                from sales s
                join sale_items i on i.sale_id = s.id
                where s.sold_at >= {period.StartUtc} and s.sold_at < {period.EndUtc}
                  and s.status <> 'cancelled'
                group by 1
            ),
            refund_totals as (
                select date_trunc({unit}, r.refunded_at at time zone {tz}) as bucket,
                       sum(i.quantity * i.unit_price) as amount,
                       case when r.items_restocked then sum(i.quantity * i.unit_cost) else 0 end as restocked_cost,
                       coalesce(max(extra.amount), 0) as extra
                from refunds r
                join sale_items i on i.sale_id = r.sale_id
                left join lateral (select sum(c.amount) as amount from refund_costs c where c.refund_id = r.id) extra on true
                where r.refunded_at >= {period.StartUtc} and r.refunded_at < {period.EndUtc}
                group by r.id, 1, r.items_restocked
            ),
            refunded as (
                select bucket,
                       sum(amount) as amount,
                       sum(amount - restocked_cost + extra) as gross_profit_loss,
                       count(*)::int as refunds_count
                from refund_totals
                group by bucket
            )
            select b.bucket as bucket_start,
                   coalesce(sold.revenue, 0) - coalesce(refunded.amount, 0) as revenue,
                   coalesce(sold.gross_profit, 0) - coalesce(refunded.gross_profit_loss, 0) as gross_profit,
                   coalesce(sold.sales_count, 0) as sales_count,
                   coalesce(refunded.refunds_count, 0) as refunds_count,
                   coalesce(refunded.amount, 0) as refunded_amount
            from generate_series(
                     date_trunc({unit}, {startLocal}::timestamp),
                     {endLocal}::timestamp - interval '1 microsecond',
                     {step}::interval) as b(bucket)
            left join sold on sold.bucket = b.bucket
            left join refunded on refunded.bucket = b.bucket
            order by b.bucket
            """).ToListAsync(ct);
    }

    /// <summary>
    /// Выручка, прибыль и количество по товарам. Доп. расходы на возврат распределяются по позициям
    /// пропорционально их сумме, чтобы сумма по товарам (и категориям) совпадала с KPI.
    /// </summary>
    public Task<List<ProductLedgerRow>> GetProductLedgersAsync(ResolvedPeriod period, CancellationToken ct) =>
        db.Database.SqlQuery<ProductLedgerRow>($"""
            with sold as (
                select i.product_id,
                       sum(i.quantity)::int as quantity,
                       sum(i.quantity * i.unit_price) as revenue,
                       sum(i.quantity * i.unit_cost) as cost
                from sales s
                join sale_items i on i.sale_id = s.id
                where s.sold_at >= {period.StartUtc} and s.sold_at < {period.EndUtc}
                  and s.status <> 'cancelled'
                group by i.product_id
            ),
            refund_lines as (
                select i.product_id,
                       i.quantity,
                       i.quantity * i.unit_price as amount,
                       case when r.items_restocked then i.quantity * i.unit_cost else 0 end as restocked_cost,
                       coalesce(extra.amount, 0) * (i.quantity * i.unit_price) / nullif(total.amount, 0) as extra_share
                from refunds r
                join sale_items i on i.sale_id = r.sale_id
                join lateral (select sum(t.quantity * t.unit_price) as amount from sale_items t where t.sale_id = r.sale_id) total on true
                left join lateral (select sum(c.amount) as amount from refund_costs c where c.refund_id = r.id) extra on true
                where r.refunded_at >= {period.StartUtc} and r.refunded_at < {period.EndUtc}
            ),
            refunded as (
                select product_id,
                       sum(quantity)::int as quantity,
                       sum(amount) as amount,
                       sum(restocked_cost) as restocked_cost,
                       sum(coalesce(extra_share, 0)) as extra
                from refund_lines
                group by product_id
            )
            select p.id as product_id,
                   p.category_id,
                   coalesce(sold.quantity, 0) - coalesce(refunded.quantity, 0) as quantity,
                   coalesce(sold.revenue, 0) - coalesce(refunded.amount, 0) as revenue,
                   round(coalesce(sold.revenue, 0) - coalesce(refunded.amount, 0)
                         - (coalesce(sold.cost, 0) - coalesce(refunded.restocked_cost, 0))
                         - coalesce(refunded.extra, 0), 2) as gross_profit
            from products p
            left join sold on sold.product_id = p.id
            left join refunded on refunded.product_id = p.id
            """).ToListAsync(ct);
}
