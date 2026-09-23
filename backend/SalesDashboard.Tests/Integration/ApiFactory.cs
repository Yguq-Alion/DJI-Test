using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;
using Testcontainers.PostgreSql;

namespace SalesDashboard.Tests.Integration;

/// <summary>
/// Поднимает настоящий PostgreSQL в контейнере и приложение поверх него.
/// Один контейнер на тестовую коллекцию; каждый тест сам готовит нужные данные.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public string ConnectionString => _postgres.GetConnectionString();

    /// <summary>«Сейчас» для всех тестов: 15 июня 2026, 12:00 по Москве.</summary>
    public FakeTimeProvider Clock { get; } = new(new DateTimeOffset(2026, 6, 15, 9, 0, 0, TimeSpan.Zero));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "true");
        builder.UseSetting("Database:SeedOnStartup", "false");
        builder.ConfigureTestServices(services => services.Replace(ServiceDescriptor.Singleton<TimeProvider>(Clock)));
    }

    public Task InitializeAsync() => _postgres.StartAsync();

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}
