namespace SalesDashboard.Api.Domain;

public sealed class Refund
{
    public long Id { get; set; }
    public long SaleId { get; set; }

    /// <summary>Момент возврата (UTC). По нему выручка и себестоимость сторнируются.</summary>
    public DateTimeOffset RefundedAt { get; set; }

    /// <summary>true — товар вернулся на склад (себестоимость сторнируется); false — товар потерян.</summary>
    public bool ItemsRestocked { get; set; } = true;

    public string? Reason { get; set; }

    public List<RefundCost> Costs { get; set; } = [];
}
