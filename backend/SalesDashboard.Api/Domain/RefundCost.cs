namespace SalesDashboard.Api.Domain;

/// <summary>Дополнительный расход на возврат (логистика, упаковка и т.д.). Уменьшает GP в дату возврата.</summary>
public sealed class RefundCost
{
    public long Id { get; set; }
    public long RefundId { get; set; }
    public RefundCostType Type { get; set; }
    public decimal Amount { get; set; }
}
