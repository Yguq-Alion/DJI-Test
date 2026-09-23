using System.Text.Json;
using System.Text.Json.Serialization;
using SalesDashboard.Api.Common;
using SalesDashboard.Api.Common.Periods;
using SalesDashboard.Api.Data;
using SalesDashboard.Api.Features.Analytics;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<PeriodResolver>();
builder.Services.AddScoped<AnalyticsQueries>();

builder.Services.AddAppDatabase(builder.Configuration);
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();
app.MapHealthChecks("/health");

await app.InitializeDatabaseAsync();

app.Run();

// Точка входа для WebApplicationFactory в интеграционных тестах.
public partial class Program;
