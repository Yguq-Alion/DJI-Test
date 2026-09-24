using SalesDashboard.Api.Data.Seed;
using SalesDashboard.Api.Domain;

namespace SalesDashboard.Tests.Unit;

public sealed class SalesDataGeneratorTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 23, 14, 30, 0, TimeSpan.Zero);

    [Fact]
    public void Generate_IsDeterministic_ForSameSeedAndDate()
    {
        var first = new SalesDataGenerator().Generate(Now);
        var second = new SalesDataGenerator().Generate(Now);

        Assert.Equal(first.Sales.Count, second.Sales.Count);
        Assert.Equal(
            first.Sales.Select(s => (s.SoldAt, s.Status, s.Manager.FullName, Total: s.Items.Sum(i => i.UnitPrice * i.Quantity))),
            second.Sales.Select(s => (s.SoldAt, s.Status, s.Manager.FullName, Total: s.Items.Sum(i => i.UnitPrice * i.Quantity))));
    }

    [Fact]
    public void Generate_ProducesVolumesRequiredByTask()
    {
        var data = new SalesDataGenerator().Generate(Now);

        Assert.InRange(data.Managers.Count, 15, 25);
        Assert.InRange(data.Customers.Count, 50, 100);
        Assert.InRange(data.Categories.Count, 3, 10);
        Assert.InRange(data.Products.Count, 20, 60);
        Assert.InRange(data.Sales.Count, 2_000, 5_000);
        Assert.True(data.Sales.Min(s => s.SoldAt) <= Now.AddMonths(-11), "history should cover about 12 months");
    }

    [Fact]
    public void Generate_RespectsDomainInvariants()
    {
        var data = new SalesDataGenerator().Generate(Now);

        Assert.All(data.Sales, sale =>
        {
            Assert.True(sale.SoldAt <= Now);
            Assert.NotEmpty(sale.Items);
            Assert.All(sale.Items, i => Assert.True(i.Quantity > 0 && i.UnitPrice > 0 && i.UnitCost > 0));
            Assert.Equal(sale.Status == SaleStatus.Refunded, sale.Refund is not null);
            if (sale.Refund is { } refund)
            {
                Assert.InRange(refund.RefundedAt, sale.SoldAt, Now);
            }
        });
    }

    [Fact]
    public void Generate_ContainsEdgeCasesForTheDashboard()
    {
        var data = new SalesDataGenerator().Generate(Now);
        var byStatus = data.Sales.GroupBy(s => s.Status).ToDictionary(g => g.Key, g => g.Count());

        Assert.InRange(byStatus[SaleStatus.Cancelled] / (double)data.Sales.Count, 0.04, 0.12);
        Assert.InRange(byStatus[SaleStatus.Refunded] / (double)data.Sales.Count, 0.03, 0.12);
        Assert.Contains(data.Sales, s => s.Refund is { ItemsRestocked: false });
        Assert.Contains(data.Sales, s => s.Refund is { Costs.Count: > 0 });
        Assert.Contains(data.Sales, s => s.SoldAt >= Now.AddDays(-1));

        // Менеджер в отпуске последние дни и уволившийся менеджер — «пустые» строки рейтинга.
        var lastWeek = data.Sales.Where(s => s.SoldAt >= Now.AddDays(-7)).Select(s => s.Manager).ToHashSet();
        Assert.Contains(data.Managers, m => !lastWeek.Contains(m));
        Assert.Contains(data.Managers, m => !m.IsActive);
    }

    [Fact]
    public void Generate_ProducesRefundsOfDifferentGrades()
    {
        var refunded = new SalesDataGenerator().Generate(Now).Sales
            .Where(s => s.Refund is not null)
            .Select(s => (Sale: s, Refund: s.Refund!, Total: s.Items.Sum(i => i.UnitPrice * i.Quantity)))
            .ToList();

        // Сроки: от возврата в первые сутки до гарантийных через 1–3 месяца.
        Assert.Contains(refunded, r => r.Refund.RefundedAt - r.Sale.SoldAt < TimeSpan.FromDays(1));
        Assert.Contains(refunded, r => r.Refund.RefundedAt - r.Sale.SoldAt > TimeSpan.FromDays(30));
        // Судьба товара и уровень доп. расходов: без расходов, с экспертизой, с 3+ видами расходов.
        Assert.Contains(refunded, r => r.Refund.ItemsRestocked && r.Refund.Costs.Count == 0);
        Assert.Contains(refunded, r => !r.Refund.ItemsRestocked);
        Assert.Contains(refunded, r => r.Refund.Costs.Any(c => c.Type == RefundCostType.Inspection));
        Assert.Contains(refunded, r => r.Refund.Costs.Count >= 3);
        // Размер: мелкие возвраты и возврат крупной сделки.
        Assert.Contains(refunded, r => r.Total < 50_000m);
        Assert.Contains(refunded, r => r.Total > 10_000_000m);
    }
}
