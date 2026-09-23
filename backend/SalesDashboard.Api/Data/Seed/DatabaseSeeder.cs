using Microsoft.EntityFrameworkCore;

namespace SalesDashboard.Api.Data.Seed;

public static class DatabaseSeeder
{
    /// <summary>Заполняет пустую БД демо-данными. Повторный запуск ничего не делает.</summary>
    public static async Task<bool> SeedIfEmptyAsync(AppDbContext db, TimeProvider timeProvider, ILogger logger, CancellationToken ct = default)
    {
        if (await db.Sales.AnyAsync(ct) || await db.Managers.AnyAsync(ct))
        {
            logger.LogInformation("Database already contains data, seed skipped");
            return false;
        }

        var data = new SalesDataGenerator().Generate(timeProvider.GetUtcNow());

        var autoDetect = db.ChangeTracker.AutoDetectChangesEnabled;
        db.ChangeTracker.AutoDetectChangesEnabled = false;
        try
        {
            db.Categories.AddRange(data.Categories);
            db.Managers.AddRange(data.Managers);
            db.Customers.AddRange(data.Customers);
            db.Sales.AddRange(data.Sales);
            await db.SaveChangesAsync(ct);
        }
        finally
        {
            db.ChangeTracker.AutoDetectChangesEnabled = autoDetect;
            db.ChangeTracker.Clear();
        }

        logger.LogInformation("Seeded {Managers} managers, {Customers} customers, {Products} products, {Sales} sales",
            data.Managers.Count, data.Customers.Count, data.Products.Count, data.Sales.Count);
        return true;
    }
}
