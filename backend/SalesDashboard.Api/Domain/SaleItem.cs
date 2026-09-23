namespace SalesDashboard.Api.Domain;

public sealed class SaleItem
{
    public long Id { get; set; }
    public long SaleId { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Quantity { get; set; }

    /// <summary>Цена продажи за единицу на момент сделки (со скидкой).</summary>
    public decimal UnitPrice { get; set; }

    /// <summary>Себестоимость единицы на момент сделки.</summary>
    public decimal UnitCost { get; set; }
}
