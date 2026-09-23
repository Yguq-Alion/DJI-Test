namespace SalesDashboard.Api.Domain;

public sealed class Product
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Sku { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    /// <summary>Прайсовая цена. Фактическая цена продажи хранится в SaleItem.</summary>
    public decimal ListPrice { get; set; }

    /// <summary>Базовая себестоимость. Фактическая себестоимость на момент продажи — в SaleItem.</summary>
    public decimal BaseCost { get; set; }
}
