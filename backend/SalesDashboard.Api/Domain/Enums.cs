namespace SalesDashboard.Api.Domain;

// Все enum-ы хранятся как нативные PostgreSQL enum (см. DatabaseSetup.MapEnum).

public enum SaleStatus
{
    Paid,
    Cancelled,
    Refunded,
}

public enum CustomerSegment
{
    Smb,
    MidMarket,
    Enterprise,
}

public enum RefundCostType
{
    Logistics,
    Packaging,
    Inspection,
    Other,
}
