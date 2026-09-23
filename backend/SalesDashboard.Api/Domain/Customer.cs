namespace SalesDashboard.Api.Domain;

public sealed class Customer
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Company { get; set; }
    public CustomerSegment Segment { get; set; }
}
