using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SalesDashboard.Api.Domain;

namespace SalesDashboard.Api.Data.Configurations;

internal sealed class SaleConfiguration : IEntityTypeConfiguration<Sale>
{
    public void Configure(EntityTypeBuilder<Sale> builder)
    {
        builder.Property(s => s.Status);
        builder.HasOne(s => s.Manager).WithMany(m => m.Sales).HasForeignKey(s => s.ManagerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(s => s.Customer).WithMany().HasForeignKey(s => s.CustomerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(s => s.Items).WithOne().HasForeignKey(i => i.SaleId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(s => s.Refund).WithOne().HasForeignKey<Refund>(r => r.SaleId).OnDelete(DeleteBehavior.Cascade);

        // Диапазонные выборки по периоду + keyset-пагинация «последних продаж» (sold_at, id).
        builder.HasIndex(s => new { s.SoldAt, s.Id });
        // Рейтинг и фильтр по менеджеру.
        builder.HasIndex(s => new { s.ManagerId, s.SoldAt });
    }
}

internal sealed class SaleItemConfiguration : IEntityTypeConfiguration<SaleItem>
{
    public void Configure(EntityTypeBuilder<SaleItem> builder)
    {
        builder.Property(i => i.UnitPrice).HasPrecision(18, 2);
        builder.Property(i => i.UnitCost).HasPrecision(18, 2);
        builder.HasOne(i => i.Product).WithMany().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(t =>
        {
            t.HasCheckConstraint("ck_sale_items_quantity", "quantity > 0");
            t.HasCheckConstraint("ck_sale_items_unit_price", "unit_price >= 0");
            t.HasCheckConstraint("ck_sale_items_unit_cost", "unit_cost >= 0");
        });
    }
}

internal sealed class RefundConfiguration : IEntityTypeConfiguration<Refund>
{
    public void Configure(EntityTypeBuilder<Refund> builder)
    {
        builder.Property(r => r.Reason).HasMaxLength(500);
        builder.Property(r => r.ItemsRestocked).HasDefaultValue(true);
        builder.HasIndex(r => r.RefundedAt);
        builder.HasMany(r => r.Costs).WithOne().HasForeignKey(c => c.RefundId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class RefundCostConfiguration : IEntityTypeConfiguration<RefundCost>
{
    public void Configure(EntityTypeBuilder<RefundCost> builder)
    {
        builder.Property(c => c.Amount).HasPrecision(18, 2);
        builder.ToTable(t => t.HasCheckConstraint("ck_refund_costs_amount", "amount >= 0"));
    }
}
