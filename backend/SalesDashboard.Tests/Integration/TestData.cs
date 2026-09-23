using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SalesDashboard.Api.Data;
using SalesDashboard.Api.Domain;

namespace SalesDashboard.Tests.Integration;

/// <summary>Минимальный каталог и конструктор продаж для сценарных тестов.</summary>
public sealed class TestData
{
    public static readonly TimeSpan Msk = TimeSpan.FromHours(3);

    public Category Drones { get; } = new() { Name = "Дроны" };
    public Category Services { get; } = new() { Name = "Сервис" };
    public Product Drone { get; private set; } = null!;
    public Product Service { get; private set; } = null!;
    public Customer Customer { get; } = new() { Name = "Иван Петров", Company = "ООО «Тест»", Segment = CustomerSegment.Smb };
    public List<Manager> Managers { get; } = [];
    public List<Sale> Sales { get; } = [];

    public TestData()
    {
        Drone = new Product { Name = "Дрон", Sku = "T-1", Category = Drones, ListPrice = 100, BaseCost = 60 };
        Service = new Product { Name = "Обучение", Sku = "T-2", Category = Services, ListPrice = 500, BaseCost = 300 };
    }

    public Manager AddManager(string name, bool isActive = true)
    {
        var manager = new Manager { FullName = name, Team = "Тест", Position = "Менеджер", AvatarColor = "#000000", IsActive = isActive };
        Managers.Add(manager);
        return manager;
    }

    /// <summary>Продажа в момент <paramref name="soldAtMsk"/> по Москве.</summary>
    public Sale AddSale(Manager manager, DateTime soldAtMsk, params (Product Product, int Qty, decimal Price, decimal Cost)[] lines)
    {
        var sale = new Sale { Manager = manager, Customer = Customer, SoldAt = new DateTimeOffset(soldAtMsk, Msk).ToUniversalTime() };
        foreach (var (product, qty, price, cost) in lines)
        {
            sale.Items.Add(new SaleItem { Product = product, Quantity = qty, UnitPrice = price, UnitCost = cost });
        }

        Sales.Add(sale);
        return sale;
    }

    public static void Refund(Sale sale, DateTime refundedAtMsk, bool restocked, params (RefundCostType Type, decimal Amount)[] costs) =>
        sale.MarkRefunded(
            new DateTimeOffset(refundedAtMsk, Msk).ToUniversalTime(),
            restocked,
            "test",
            costs.Select(c => new RefundCost { Type = c.Type, Amount = c.Amount }));

    public async Task SaveAsync(ApiFactory factory)
    {
        _ = factory.Server; // гарантирует, что хост запущен и миграции применены
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.ExecuteSqlRawAsync(
            "truncate refund_costs, refunds, sale_items, sales, products, categories, customers, managers restart identity cascade");
        db.AddRange(Drones, Services);
        db.Managers.AddRange(Managers);
        db.Sales.AddRange(Sales);
        await db.SaveChangesAsync();
    }
}
