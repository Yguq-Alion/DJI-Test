using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;
using SalesDashboard.Api.Data.Seed;
using SalesDashboard.Api.Domain;

namespace SalesDashboard.Api.Data;

public static class DatabaseSetup
{
    public static IServiceCollection AddAppDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<AppDbContext>(options => options
            .UseNpgsql(connectionString, MapEnums)
            .UseSnakeCaseNamingConvention());

        return services;
    }

    /// <summary>C# enum ↔ нативные PostgreSQL enum (EF 9+: маппинг в UseNpgsql создаёт и тип в миграции).</summary>
    public static void MapEnums(NpgsqlDbContextOptionsBuilder npgsql) => npgsql
        .MapEnum<SaleStatus>("sale_status")
        .MapEnum<CustomerSegment>("customer_segment")
        .MapEnum<RefundCostType>("refund_cost_type");

    /// <summary>
    /// Применяет миграции и наполняет пустую БД при старте. Для тестового стенда это позволяет поднять всё
    /// одной командой; в production миграции выполнялись бы отдельным шагом деплоя, а seed не запускался бы.
    /// </summary>
    public static async Task InitializeDatabaseAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
        {
            await db.Database.MigrateAsync();
        }

        if (app.Configuration.GetValue("Database:SeedOnStartup", false))
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DatabaseSeeder));
            await DatabaseSeeder.SeedIfEmptyAsync(db, scope.ServiceProvider.GetRequiredService<TimeProvider>(), logger);
        }
    }
}
