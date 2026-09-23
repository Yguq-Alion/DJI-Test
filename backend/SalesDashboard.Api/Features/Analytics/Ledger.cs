namespace SalesDashboard.Api.Features.Analytics;

/// <summary>
/// Финансовые суммы за период по правилу сторно (docs/decisions.md §1):
/// продажа учитывается в дату продажи, возврат вычитает её в дату возврата.
/// </summary>
public class Ledger
{
    /// <summary>Выручка продаж (Paid + Refunded) с датой продажи в периоде.</summary>
    public decimal GrossRevenue { get; init; }

    /// <summary>Себестоимость тех же продаж.</summary>
    public decimal SoldCost { get; init; }

    /// <summary>Количество продаж (Paid + Refunded) с датой продажи в периоде.</summary>
    public int SalesCount { get; init; }

    /// <summary>Из них позже возвращены.</summary>
    public int RefundedSalesCount { get; init; }

    /// <summary>Сумма возвратов с датой возврата в периоде (сторно выручки).</summary>
    public decimal RefundedAmount { get; init; }

    /// <summary>Себестоимость возвращённого на склад товара (сторно себестоимости).</summary>
    public decimal RestockedCost { get; init; }

    /// <summary>Дополнительные расходы на возвраты в периоде.</summary>
    public decimal RefundCosts { get; init; }

    public decimal Revenue => GrossRevenue - RefundedAmount;
    public decimal Cogs => SoldCost - RestockedCost;
    public decimal GrossProfit => Revenue - Cogs - RefundCosts;

    public decimal? Margin => Revenue > 0 ? Math.Round(GrossProfit / Revenue, 4) : null;
    public decimal? AverageCheck => SalesCount > 0 ? Math.Round(GrossRevenue / SalesCount, 2) : null;
    public decimal? RefundRate => SalesCount > 0 ? Math.Round((decimal)RefundedSalesCount / SalesCount, 4) : null;

    public bool HasActivity => SalesCount > 0 || RefundedAmount != 0 || RefundCosts != 0;

    public static Ledger Sum(IEnumerable<Ledger> items)
    {
        var list = items as IReadOnlyCollection<Ledger> ?? items.ToList();
        return new Ledger
        {
            GrossRevenue = list.Sum(x => x.GrossRevenue),
            SoldCost = list.Sum(x => x.SoldCost),
            SalesCount = list.Sum(x => x.SalesCount),
            RefundedSalesCount = list.Sum(x => x.RefundedSalesCount),
            RefundedAmount = list.Sum(x => x.RefundedAmount),
            RestockedCost = list.Sum(x => x.RestockedCost),
            RefundCosts = list.Sum(x => x.RefundCosts),
        };
    }
}

/// <summary>Строка SQL-запроса: суммы по одному менеджеру.</summary>
public sealed class ManagerLedgerRow : Ledger
{
    public int ManagerId { get; init; }
}

public static class Change
{
    /// <summary>Относительное изменение, %. Нет базы для сравнения — null.</summary>
    public static decimal? Percent(decimal? current, decimal? previous) =>
        current is null || previous is null or 0 ? null : Math.Round((current.Value - previous.Value) / Math.Abs(previous.Value) * 100, 1);

    /// <summary>Изменение доли в процентных пунктах (для маржи и доли возвратов).</summary>
    public static decimal? Points(decimal? current, decimal? previous) =>
        current is null || previous is null ? null : Math.Round((current.Value - previous.Value) * 100, 1);
}
