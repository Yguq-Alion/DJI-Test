namespace SalesDashboard.Api.Domain;

public sealed class Manager
{
    public int Id { get; set; }
    public required string FullName { get; set; }
    public required string Team { get; set; }
    public required string Position { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Цвет фона аватара (hex). Инициалы считаются из имени на клиенте.</summary>
    public required string AvatarColor { get; set; }

    public List<Sale> Sales { get; set; } = [];
}
