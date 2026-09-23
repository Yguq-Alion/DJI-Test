namespace SalesDashboard.Api.Domain;

public sealed class Sale
{
    public long Id { get; set; }
    public int ManagerId { get; set; }
    public Manager Manager { get; set; } = null!;
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    /// <summary>Момент продажи (UTC). По нему продажа попадает в Revenue и в количество продаж.</summary>
    public DateTimeOffset SoldAt { get; set; }

    public SaleStatus Status { get; private set; } = SaleStatus.Paid;

    public List<SaleItem> Items { get; set; } = [];

    /// <summary>Есть только у продаж со статусом Refunded (инвариант поддерживается методом <see cref="MarkRefunded"/>).</summary>
    public Refund? Refund { get; private set; }

    public void Cancel()
    {
        if (Status != SaleStatus.Paid)
        {
            throw new InvalidOperationException($"Only a paid sale can be cancelled (sale {Id} is {Status}).");
        }

        Status = SaleStatus.Cancelled;
    }

    /// <summary>
    /// Полный возврат. Выручка сторнируется в дату возврата; себестоимость сторнируется,
    /// только если товар вернулся на склад (<paramref name="itemsRestocked"/>).
    /// </summary>
    public Refund MarkRefunded(DateTimeOffset refundedAt, bool itemsRestocked, string? reason = null, IEnumerable<RefundCost>? costs = null)
    {
        if (Status != SaleStatus.Paid)
        {
            throw new InvalidOperationException($"Only a paid sale can be refunded (sale {Id} is {Status}).");
        }

        if (refundedAt < SoldAt)
        {
            throw new ArgumentOutOfRangeException(nameof(refundedAt), "Refund cannot happen before the sale.");
        }

        Status = SaleStatus.Refunded;
        Refund = new Refund
        {
            RefundedAt = refundedAt,
            ItemsRestocked = itemsRestocked,
            Reason = reason,
            Costs = costs?.ToList() ?? [],
        };
        return Refund;
    }
}
