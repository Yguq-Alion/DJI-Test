using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SalesDashboard.Api.Domain;

namespace SalesDashboard.Tests.Integration;

/// <summary>
/// Сценарий с вручную посчитанными ожиданиями. Период: 1–10 июня 2026 (МСК), предыдущий: 22–31 мая.
///
/// Продажи (цена/себестоимость):
///   S1 Alice  2 июня     Paid       2 × 100 / 60                      → 200 / 120
///   S2 Alice  3 июня     Refunded   1 × 500 / 300, возврат 5 июня, на склад, расходы 20 + 10
///   S3 Boris  25 мая     Refunded   3 × 100 / 60, возврат 4 июня, товар потерян
///   S4 Boris  6 июня     Cancelled  1 × 1000 / 600                    → не учитывается
///   S5 Boris  7 июня     Paid       1 × 400 / 250
///   S6 Alice  1 июня 00:00:00 МСК  (ровно на начале периода)          → входит
///   S7 Boris  11 июня 00:00:00 МСК (ровно на конце периода)          → не входит
///   S8 Alice  31 мая 23:59:59 МСК                                     → предыдущий период
///
/// Текущий период: GrossRevenue = 200 + 500 + 400 + 100 = 1200, SoldCost = 120 + 300 + 250 + 60 = 730, 4 продажи;
/// возвраты: 500 (S2) + 300 (S3) = 800, сторно себестоимости 300 (только S2), доп. расходы 30.
/// Revenue = 400, COGS = 430, GP = 400 − 430 − 30 = −60, Margin = −0.15, AvgCheck = 300, RefundRate = 1/4.
/// Alice: Revenue 800 − 500 = 300, GP = 300 − (480 − 300) − 30 = 90. Boris: Revenue 400 − 300 = 100, GP = 100 − 250 = −150.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class AnalyticsScenarioTests(ApiFactory factory) : IAsyncLifetime
{
    private const string Period = "from=2026-06-01&to=2026-06-10&tz=Europe/Moscow";
    private readonly HttpClient _client = factory.CreateClient();

    public async Task InitializeAsync()
    {
        var data = new TestData();
        var alice = data.AddManager("Alice");
        var boris = data.AddManager("Boris");
        data.AddManager("Clara");
        data.AddManager("Dmitry", isActive: false);

        data.AddSale(alice, new DateTime(2026, 6, 2, 10, 0, 0), (data.Drone, 2, 100, 60));
        var s2 = data.AddSale(alice, new DateTime(2026, 6, 3, 11, 0, 0), (data.Service, 1, 500, 300));
        TestData.Refund(s2, new DateTime(2026, 6, 5, 15, 0, 0), restocked: true, (RefundCostType.Logistics, 20), (RefundCostType.Packaging, 10));
        var s3 = data.AddSale(boris, new DateTime(2026, 5, 25, 12, 0, 0), (data.Drone, 3, 100, 60));
        TestData.Refund(s3, new DateTime(2026, 6, 4, 9, 30, 0), restocked: false);
        data.AddSale(boris, new DateTime(2026, 6, 6, 13, 0, 0), (data.Service, 1, 1000, 600)).Cancel();
        data.AddSale(boris, new DateTime(2026, 6, 7, 14, 0, 0), (data.Service, 1, 400, 250));
        data.AddSale(alice, new DateTime(2026, 6, 1, 0, 0, 0), (data.Drone, 1, 100, 60));
        data.AddSale(boris, new DateTime(2026, 6, 11, 0, 0, 0), (data.Drone, 1, 150, 60));
        data.AddSale(alice, new DateTime(2026, 5, 31, 23, 59, 59), (data.Drone, 1, 100, 60));

        await data.SaveAsync(factory);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Kpi_AppliesStornoRules()
    {
        var kpi = await GetJson($"/api/dashboard/kpi?{Period}");

        Assert.Equal(400m, Value(kpi, "revenue"));
        Assert.Equal(1200m, Value(kpi, "grossRevenue"));
        Assert.Equal(-60m, Value(kpi, "grossProfit"));
        Assert.Equal(-0.15m, Value(kpi, "margin"));
        Assert.Equal(4m, Value(kpi, "salesCount"));
        Assert.Equal(300m, Value(kpi, "averageCheck"));
        Assert.Equal(0.25m, Value(kpi, "refundRate"));
        Assert.Equal(800m, Value(kpi, "refundedAmount"));
        Assert.Equal(30m, Value(kpi, "refundCosts"));
    }

    [Fact]
    public async Task Kpi_ComparesWithPreviousPeriodOfSameLength()
    {
        var kpi = await GetJson($"/api/dashboard/kpi?{Period}");

        Assert.Equal("2026-05-22", kpi.GetProperty("previousPeriod").GetProperty("from").GetString());
        Assert.Equal("2026-05-31", kpi.GetProperty("previousPeriod").GetProperty("to").GetString());
        // Предыдущий: S3 (300) и S8 (100) по дате продажи, возвратов не было.
        Assert.Equal(400m, kpi.GetProperty("revenue").GetProperty("previous").GetDecimal());
        Assert.Equal(0m, kpi.GetProperty("revenue").GetProperty("change").GetDecimal());
        Assert.Equal(-60m - 160m, Value(kpi, "grossProfit") - kpi.GetProperty("grossProfit").GetProperty("previous").GetDecimal());
    }

    [Fact]
    public async Task Kpi_BestManagerIsByNetGrossProfit()
    {
        var best = (await GetJson($"/api/dashboard/kpi?{Period}")).GetProperty("bestManager");

        Assert.Equal("Alice", best.GetProperty("manager").GetProperty("fullName").GetString());
        Assert.Equal(90m, best.GetProperty("grossProfit").GetDecimal());
        Assert.Equal(300m, best.GetProperty("revenue").GetDecimal());
    }

    [Fact]
    public async Task Kpi_UsesUserTimeZoneForDayBoundaries()
    {
        // В UTC граница сдвигается на 3 часа: S6 (31 мая 21:00Z) выпадает, S7 (10 июня 21:00Z) попадает.
        var kpi = await GetJson("/api/dashboard/kpi?from=2026-06-01&to=2026-06-10&tz=UTC");

        Assert.Equal(1200m - 100m + 150m, Value(kpi, "grossRevenue"));
    }

    [Fact]
    public async Task Kpi_EmptyPeriod_ReturnsZerosAndNullRatios()
    {
        var kpi = await GetJson("/api/dashboard/kpi?from=2025-01-01&to=2025-01-31&tz=Europe/Moscow");

        Assert.Equal(0m, Value(kpi, "revenue"));
        Assert.Equal(JsonValueKind.Null, kpi.GetProperty("margin").GetProperty("value").ValueKind);
        Assert.Equal(JsonValueKind.Null, kpi.GetProperty("averageCheck").GetProperty("value").ValueKind);
        Assert.Equal(JsonValueKind.Null, kpi.GetProperty("bestManager").ValueKind);
    }

    [Fact]
    public async Task Ranking_ByGrossProfit_IncludesActiveManagersWithoutSalesAtTheEnd()
    {
        var items = (await GetJson($"/api/managers/ranking?{Period}&sortBy=grossProfit")).GetProperty("items").EnumerateArray().ToList();

        Assert.Equal(["Alice", "Boris", "Clara"], items.Select(Name));
        Assert.Equal(1, items[0].GetProperty("rank").GetInt32());
        Assert.Equal(2, items[1].GetProperty("rank").GetInt32());
        Assert.Equal(JsonValueKind.Null, items[2].GetProperty("rank").ValueKind);
        Assert.Equal(0, items[2].GetProperty("salesCount").GetInt32());
        Assert.Equal(-150m, items[1].GetProperty("grossProfit").GetDecimal());
        // В прошлом периоде Boris был первым (GP 120 против 40 у Alice).
        Assert.Equal(2, items[0].GetProperty("previousRank").GetInt32());
        Assert.Equal(1, items[1].GetProperty("previousRank").GetInt32());
    }

    [Fact]
    public async Task Ranking_ByAverageCheck_ReordersManagers()
    {
        var items = (await GetJson($"/api/managers/ranking?{Period}&sortBy=averageCheck")).GetProperty("items").EnumerateArray().ToList();

        Assert.Equal("Boris", Name(items[0]));
        Assert.Equal(400m, items[0].GetProperty("averageCheck").GetDecimal());
        Assert.Equal(266.67m, items[1].GetProperty("averageCheck").GetDecimal());
    }

    [Fact]
    public async Task Timeseries_SumsMatchKpi_AndRefundHitsItsOwnDay()
    {
        var response = await GetJson($"/api/dashboard/timeseries?{Period}");
        var points = response.GetProperty("points").EnumerateArray().ToList();

        Assert.Equal("day", response.GetProperty("granularity").GetString());
        Assert.Equal(10, points.Count);
        Assert.Equal(400m, points.Sum(p => p.GetProperty("revenue").GetDecimal()));
        Assert.Equal(-60m, points.Sum(p => p.GetProperty("grossProfit").GetDecimal()));
        Assert.Equal(4, points.Sum(p => p.GetProperty("salesCount").GetInt32()));

        var june5 = points.Single(p => p.GetProperty("bucketStart").GetString() == "2026-06-05T00:00:00");
        Assert.Equal(-500m, june5.GetProperty("revenue").GetDecimal());
        Assert.Equal(-(500m - 300m + 30m), june5.GetProperty("grossProfit").GetDecimal());

        var june9 = points.Single(p => p.GetProperty("bucketStart").GetString() == "2026-06-09T00:00:00");
        Assert.Equal(0m, june9.GetProperty("revenue").GetDecimal());
    }

    [Fact]
    public async Task Categories_SumToKpiTotals()
    {
        var items = (await GetJson($"/api/dashboard/categories?{Period}")).GetProperty("items").EnumerateArray().ToList();

        Assert.Equal(400m, items.Sum(i => i.GetProperty("revenue").GetDecimal()));
        Assert.Equal(-60m, items.Sum(i => i.GetProperty("grossProfit").GetDecimal()));
    }

    [Fact]
    public async Task RecentSales_PagesWithoutGapsOrDuplicates()
    {
        var ids = new List<long>();
        string? cursor = null;
        var pages = 0;
        do
        {
            var page = await GetJson($"/api/sales/recent?{Period}&limit=2" + (cursor is null ? "" : $"&cursor={cursor}"));
            ids.AddRange(page.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt64()));
            cursor = page.GetProperty("nextCursor").GetString();
            pages++;
        }
        while (cursor is not null && pages < 10);

        // S1, S2, S4 (отменённая тоже видна в списке), S5, S6 — от новых к старым.
        Assert.Equal(3, pages);
        Assert.Equal([5L, 4, 2, 1, 6], ids);
    }

    [Fact]
    public async Task RecentSales_FiltersByStatus()
    {
        var items = (await GetJson($"/api/sales/recent?{Period}&status=cancelled")).GetProperty("items").EnumerateArray().ToList();

        var sale = Assert.Single(items);
        Assert.Equal("cancelled", sale.GetProperty("status").GetString());
    }

    [Theory]
    [InlineData("/api/dashboard/kpi?preset=30d")]
    [InlineData("/api/dashboard/kpi?from=2026-06-10&to=2026-06-01&tz=Europe/Moscow")]
    [InlineData("/api/dashboard/timeseries?from=2025-06-01&to=2026-06-01&granularity=hour&tz=Europe/Moscow")]
    [InlineData("/api/managers/ranking?preset=30d&tz=Europe/Moscow&sortBy=revenue")]
    [InlineData("/api/sales/recent?preset=30d&tz=Europe/Moscow&cursor=broken")]
    public async Task InvalidRequests_Return400ProblemDetails(string url)
    {
        var response = await _client.GetAsync(url);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    private async Task<JsonElement> GetJson(string url)
    {
        var response = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static decimal Value(JsonElement kpi, string metric) => kpi.GetProperty(metric).GetProperty("value").GetDecimal();

    private static string Name(JsonElement item) => item.GetProperty("manager").GetProperty("fullName").GetString()!;
}
