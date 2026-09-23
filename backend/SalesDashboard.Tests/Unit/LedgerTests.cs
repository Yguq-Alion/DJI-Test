using SalesDashboard.Api.Features.Analytics;

namespace SalesDashboard.Tests.Unit;

public sealed class LedgerTests
{
    [Fact]
    public void Formulas_FollowStornoRules()
    {
        var ledger = new Ledger
        {
            GrossRevenue = 1_000m,
            SoldCost = 600m,
            SalesCount = 4,
            RefundedSalesCount = 1,
            RefundedAmount = 200m,
            RestockedCost = 120m,
            RefundCosts = 30m,
        };

        Assert.Equal(800m, ledger.Revenue);          // 1000 − 200
        Assert.Equal(480m, ledger.Cogs);             // 600 − 120
        Assert.Equal(290m, ledger.GrossProfit);      // 800 − 480 − 30
        Assert.Equal(0.3625m, ledger.Margin);        // 290 / 800
        Assert.Equal(250m, ledger.AverageCheck);     // 1000 / 4 — по валовой выручке
        Assert.Equal(0.25m, ledger.RefundRate);
    }

    [Fact]
    public void RatiosAreNull_WhenThereIsNothingToDivideBy()
    {
        var onlyRefunds = new Ledger { RefundedAmount = 500m, RestockedCost = 300m };

        Assert.Equal(-500m, onlyRefunds.Revenue);
        Assert.Null(onlyRefunds.Margin);
        Assert.Null(onlyRefunds.AverageCheck);
        Assert.Null(onlyRefunds.RefundRate);
        Assert.True(onlyRefunds.HasActivity);
        Assert.False(new Ledger().HasActivity);
    }

    [Theory]
    [InlineData(150, 100, 50.0)]
    [InlineData(50, 100, -50.0)]
    [InlineData(-50, -100, 50.0)]   // убыток уменьшился — изменение положительное
    [InlineData(100, 0, null)]      // нет базы для сравнения
    public void PercentChange(double current, double previous, double? expected) =>
        Assert.Equal((decimal?)expected, Change.Percent((decimal)current, (decimal)previous));

    [Fact]
    public void PointsChange_IsDifferenceOfShares() =>
        Assert.Equal(-2.5m, Change.Points(0.15m, 0.175m));
}
