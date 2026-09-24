using SalesDashboard.Api.Domain;

namespace SalesDashboard.Api.Data.Seed;

public sealed record SeedData(
    IReadOnlyList<Category> Categories,
    IReadOnlyList<Product> Products,
    IReadOnlyList<Manager> Managers,
    IReadOnlyList<Customer> Customers,
    IReadOnlyList<Sale> Sales);

/// <summary>
/// Детерминированный генератор демо-данных: одинаковый seed и одинаковая дата «сейчас» дают одинаковые данные.
/// Даты отсчитываются от «сейчас», чтобы пресеты «Сегодня» и «7 дней» всегда были заполнены.
/// </summary>
public sealed class SalesDataGenerator(int seed = SalesDataGenerator.DefaultSeed)
{
    public const int DefaultSeed = 20260923;
    public const int HistoryDays = 365;

    // Продажи генерируются в рабочие часы по Москве; хранятся в UTC.
    private static readonly TimeSpan GenerationOffset = TimeSpan.FromHours(3);
    private const double BaseDailySalesPerManager = 0.52;
    private const double CancelProbability = 0.08;
    private const double BaseRefundProbability = 0.065;
    private const double RestockProbability = 0.8;

    private readonly Random _random = new(seed);

    public SeedData Generate(DateTimeOffset now)
    {
        var (categories, products) = BuildCatalog();
        var managers = SeedCatalog.Managers.Select((p, i) => new Manager
        {
            FullName = p.FullName,
            Team = p.Team,
            Position = p.Position,
            IsActive = p.LeftMonthsAgo is null,
            AvatarColor = SeedCatalog.AvatarColors[i % SeedCatalog.AvatarColors.Length],
        }).ToList();
        var customers = BuildCustomers(80);

        var today = DateOnly.FromDateTime(now.ToOffset(GenerationOffset).DateTime);
        var sales = new List<Sale>(4000);

        for (var dayOffset = HistoryDays; dayOffset >= 0; dayOffset--)
        {
            var day = today.AddDays(-dayOffset);
            var dayFactor = SeasonFactor(day.Month) * WeekdayFactor(day.DayOfWeek) * TrendFactor(dayOffset);

            for (var m = 0; m < managers.Count; m++)
            {
                var profile = SeedCatalog.Managers[m];
                if (!IsWorking(profile, today, day, dayOffset))
                {
                    continue;
                }

                var count = Poisson(BaseDailySalesPerManager * profile.Activity * dayFactor);
                for (var i = 0; i < count; i++)
                {
                    var soldAt = RandomWorkTime(day);
                    if (soldAt > now)
                    {
                        continue;
                    }

                    sales.Add(BuildSale(managers[m], profile, customers, products, soldAt, now));
                }
            }
        }

        AddOutlierDeals(sales, managers, customers, products, today, now);
        sales.Sort((a, b) => a.SoldAt.CompareTo(b.SoldAt));

        return new SeedData(categories, products, managers, customers, sales);
    }

    private (List<Category>, List<Product>) BuildCatalog()
    {
        var categories = new List<Category>();
        var products = new List<Product>();
        var sku = 1000;
        foreach (var (name, minMarkup, maxMarkup, items) in SeedCatalog.Assortment)
        {
            var category = new Category { Name = name };
            categories.Add(category);
            foreach (var (productName, price) in items)
            {
                var markup = minMarkup + (maxMarkup - minMarkup) * (decimal)_random.NextDouble();
                var product = new Product
                {
                    Name = productName,
                    Sku = $"DJM-{++sku}",
                    Category = category,
                    ListPrice = price,
                    BaseCost = Math.Round(price / (1 + markup), 2),
                };
                category.Products.Add(product);
                products.Add(product);
            }
        }

        return (categories, products);
    }

    private List<Customer> BuildCustomers(int count)
    {
        var customers = new List<Customer>(count);
        var usedCompanies = new HashSet<string>();
        while (customers.Count < count)
        {
            var company = $"{Pick(SeedCatalog.CompanyForms)} «{Pick(SeedCatalog.CompanyPrefixes)}{Pick(SeedCatalog.CompanySuffixes)}»";
            if (!usedCompanies.Add(company))
            {
                continue;
            }

            var roll = _random.NextDouble();
            var segment = CustomerSegments.Mix[^1].Segment;
            foreach (var (s, share, _) in CustomerSegments.Mix)
            {
                if ((roll -= share) < 0)
                {
                    segment = s;
                    break;
                }
            }

            var lastName = Pick(SeedCatalog.LastNames);
            var firstName = Pick(SeedCatalog.FirstNames);
            // Фамилия в женской форме для женских имён.
            if (firstName.EndsWith('а') || firstName.EndsWith('я'))
            {
                lastName = lastName.EndsWith('й') ? lastName[..^2] + "ая" : lastName + "а";
            }

            customers.Add(new Customer { Name = $"{firstName} {lastName}", Company = company, Segment = segment });
        }

        return customers;
    }

    private Sale BuildSale(Manager manager, ManagerProfile profile, List<Customer> customers, List<Product> products, DateTimeOffset soldAt, DateTimeOffset now)
    {
        var customer = PickCustomer(customers, profile.Team);
        // Корень сглаживает разрыв между сегментами: крупный клиент берёт больше, но не на порядок.
        var volume = Math.Sqrt(CustomerSegments.Mix.First(x => x.Segment == customer.Segment).VolumeFactor * profile.CheckFactor);

        var sale = new Sale { Manager = manager, Customer = customer, SoldAt = soldAt };
        var lines = 1 + Math.Min(3, Geometric(0.55));
        var usedProducts = new HashSet<Product>();
        for (var line = 0; line < lines; line++)
        {
            var category = line == 0 ? PickMainCategory(profile.Team) : PickAddOnCategory();
            var candidates = products.Where(p => p.Category.Name == category && !usedProducts.Contains(p)).ToList();
            if (candidates.Count == 0)
            {
                continue;
            }

            var product = candidates[_random.Next(candidates.Count)];
            usedProducts.Add(product);
            sale.Items.Add(BuildItem(product, volume, profile.Discount, soldAt));
        }

        var statusRoll = _random.NextDouble();
        if (statusRoll < CancelProbability)
        {
            sale.Cancel();
        }
        else if (statusRoll < CancelProbability + BaseRefundProbability * profile.RefundRisk)
        {
            TryRefund(sale, now);
        }

        return sale;
    }

    private SaleItem BuildItem(Product product, double volume, double managerDiscount, DateTimeOffset soldAt)
    {
        var baseQuantity = product.ListPrice switch
        {
            >= 500_000m => 1 + Geometric(0.7),
            >= 60_000m => 1 + Geometric(0.5),
            >= 15_000m => 1 + Geometric(0.35),
            _ => 2 + Geometric(0.15),
        };
        var quantity = Math.Max(1, (int)Math.Round(baseQuantity * volume * (0.7 + 0.6 * _random.NextDouble())));

        // Скидка растёт с объёмом; у «уступчивых» менеджеров она выше — отсюда разная маржинальность.
        var discount = Math.Clamp(managerDiscount + Gaussian() * 0.03 + Math.Min(0.06, quantity * 0.004), 0, 0.3);
        var unitPrice = Math.Round(product.ListPrice * (decimal)(1 - discount), 0);

        // Себестоимость «плавает» в течение года (курс, закупочные условия).
        var drift = 1 + 0.04 * Math.Sin(soldAt.DayOfYear / 58.0) + Gaussian() * 0.01;
        var unitCost = Math.Round(product.BaseCost * (decimal)drift, 2);

        return new SaleItem { Product = product, Quantity = quantity, UnitPrice = unitPrice, UnitCost = unitCost };
    }

    private void TryRefund(Sale sale, DateTimeOffset now)
    {
        var kind = Weighted(
            (RefundKind.Quick, 0.30),
            (RefundKind.Standard, 0.35),
            (RefundKind.Warranty, 0.15),
            (RefundKind.Damaged, 0.12),
            (RefundKind.Disputed, 0.08));

        // Срок возврата зависит от сценария: от нескольких часов до трёх месяцев.
        var delay = kind switch
        {
            RefundKind.Quick => TimeSpan.FromHours(2 + _random.Next(70)),
            RefundKind.Standard => TimeSpan.FromDays(4 + _random.Next(27)),
            RefundKind.Warranty => TimeSpan.FromDays(31 + _random.Next(60)),
            RefundKind.Damaged => TimeSpan.FromDays(1 + _random.Next(10)),
            _ => TimeSpan.FromDays(10 + _random.Next(35)),
        };
        var refundedAt = sale.SoldAt.Add(delay).AddMinutes(_random.Next(0, 120));
        if (refundedAt > now)
        {
            // Возврат «ещё не случился» — продажа остаётся оплаченной.
            return;
        }

        var total = sale.Items.Sum(i => i.UnitPrice * i.Quantity);
        var restocked = kind switch
        {
            RefundKind.Quick => _random.NextDouble() < 0.97,
            RefundKind.Standard => _random.NextDouble() < RestockProbability,
            RefundKind.Warranty => _random.NextDouble() < 0.45,
            RefundKind.Damaged => false,
            _ => _random.NextDouble() < 0.6,
        };

        var costs = new List<RefundCost>();
        void Add(RefundCostType type, decimal amount) => costs.Add(new RefundCost { Type = type, Amount = Math.Round(amount, 0) });
        decimal Share(double min, double max) => total * (decimal)(min + (max - min) * _random.NextDouble());

        switch (kind)
        {
            case RefundKind.Quick:
                // Отказ в первые дни: товар не распакован, расходы минимальны или отсутствуют.
                if (_random.NextDouble() < 0.35)
                {
                    Add(RefundCostType.Packaging, 300 + _random.Next(6) * 100);
                }

                break;
            case RefundKind.Standard:
                if (_random.NextDouble() < 0.7)
                {
                    Add(RefundCostType.Logistics, Math.Max(500m, Share(0.005, 0.02)));
                }

                if (_random.NextDouble() < 0.4)
                {
                    Add(RefundCostType.Packaging, 300 + _random.Next(12) * 100);
                }

                break;
            case RefundKind.Warranty:
                // Гарантийный случай: обязательная экспертиза, логистика в сервис и обратно.
                Add(RefundCostType.Inspection, 3_000 + _random.Next(20) * 500);
                Add(RefundCostType.Logistics, Math.Max(1_500m, Share(0.01, 0.03)));
                break;
            case RefundKind.Damaged:
                // Повреждение при доставке: товар списан, дорогая обратная логистика.
                Add(RefundCostType.Logistics, Math.Max(2_000m, Share(0.02, 0.05)));
                if (_random.NextDouble() < 0.5)
                {
                    Add(RefundCostType.Other, Math.Max(1_000m, Share(0.005, 0.02)));
                }

                break;
            default:
                // Спорный возврат: экспертиза, юридические и прочие расходы.
                Add(RefundCostType.Inspection, 5_000 + _random.Next(20) * 1_000);
                Add(RefundCostType.Logistics, Math.Max(1_000m, Share(0.01, 0.025)));
                Add(RefundCostType.Other, Math.Max(3_000m, Share(0.01, 0.04)));
                Add(RefundCostType.Packaging, 500 + _random.Next(10) * 100);
                break;
        }

        var reason = kind switch
        {
            RefundKind.Quick => Pick(SeedCatalog.QuickRefundReasons),
            RefundKind.Warranty => Pick(SeedCatalog.WarrantyRefundReasons),
            RefundKind.Damaged => "Повреждение при доставке",
            RefundKind.Disputed => Pick(SeedCatalog.DisputedRefundReasons),
            _ => Pick(SeedCatalog.RefundReasons),
        };

        sale.MarkRefunded(refundedAt, restocked, reason, costs);
    }

    /// <summary>Сценарии возврата: разные сроки, судьба товара и уровень доп. расходов.</summary>
    private enum RefundKind
    {
        Quick,
        Standard,
        Warranty,
        Damaged,
        Disputed,
    }

    /// <summary>Несколько крупных сделок-выбросов для проверки устойчивости графиков и рейтинга.</summary>
    private void AddOutlierDeals(List<Sale> sales, List<Manager> managers, List<Customer> customers, List<Product> products, DateOnly today, DateTimeOffset now)
    {
        var enterpriseCustomers = customers.Where(c => c.Segment == CustomerSegment.Enterprise).ToList();
        // RefundAfterDays: крупная сделка, которую клиент вернул целиком, — проверка сторно на выбросе.
        (int DaysAgo, int ManagerIndex, (string Product, int Qty)[] Items, int? RefundAfterDays)[] deals =
        [
            (210, 1, [("DJI Dock 3", 12), ("DJI Matrice 4T", 12), ("DJI Care Enterprise Plus", 12)], null),
            (96, 17, [("DJI Agras T50", 18), ("Агро-комплект батарей DB1560", 40), ("Выездное обучение экипажа", 3)], null),
            (58, 4, [("DJI Matrice 350 RTK", 6), ("Zenmuse H30T", 6)], 17),
            (19, 0, [("DJI Matrice 350 RTK", 15), ("Zenmuse L2 LiDAR", 15), ("Годовое ТО промышленного дрона", 15)], null),
        ];

        foreach (var (daysAgo, managerIndex, items, refundAfterDays) in deals)
        {
            var soldAt = RandomWorkTime(today.AddDays(-daysAgo));
            if (soldAt > now)
            {
                continue;
            }

            var sale = new Sale
            {
                Manager = managers[managerIndex],
                Customer = enterpriseCustomers[_random.Next(enterpriseCustomers.Count)],
                SoldAt = soldAt,
            };
            foreach (var (name, qty) in items)
            {
                var product = products.First(p => p.Name == name);
                sale.Items.Add(new SaleItem
                {
                    Product = product,
                    Quantity = qty,
                    UnitPrice = Math.Round(product.ListPrice * 0.88m, 0),
                    UnitCost = product.BaseCost,
                });
            }

            if (refundAfterDays is { } days && sale.SoldAt.AddDays(days) <= now)
            {
                var total = sale.Items.Sum(i => i.UnitPrice * i.Quantity);
                sale.MarkRefunded(sale.SoldAt.AddDays(days), itemsRestocked: true, "Расторжение договора поставки",
                [
                    new RefundCost { Type = RefundCostType.Logistics, Amount = Math.Round(total * 0.012m, 0) },
                    new RefundCost { Type = RefundCostType.Inspection, Amount = 45_000 },
                ]);
            }

            sales.Add(sale);
        }
    }

    private static bool IsWorking(ManagerProfile profile, DateOnly today, DateOnly day, int dayOffset)
    {
        if (day < today.AddMonths(-profile.StartMonthsAgo))
        {
            return false;
        }

        if (profile.LeftMonthsAgo is { } left && day > today.AddMonths(-left))
        {
            return false;
        }

        return profile.VacationDays is not { } vacation
            || dayOffset > vacation.StartDaysAgo
            || dayOffset <= vacation.StartDaysAgo - vacation.Length;
    }

    private string PickMainCategory(string team) => team switch
    {
        "Enterprise" => Weighted(("Промышленные решения", 0.6), ("Сервис и обучение", 0.2), ("Камеры и стабилизаторы", 0.1), ("Потребительские дроны", 0.1)),
        "Агро" => Weighted(("Агродроны", 0.75), ("Сервис и обучение", 0.15), ("Промышленные решения", 0.1)),
        _ => Weighted(("Потребительские дроны", 0.42), ("Камеры и стабилизаторы", 0.3), ("Аксессуары", 0.18), ("Промышленные решения", 0.06), ("Сервис и обучение", 0.04)),
    };

    private string PickAddOnCategory() =>
        Weighted(("Аксессуары", 0.6), ("Сервис и обучение", 0.3), ("Камеры и стабилизаторы", 0.1));

    private Customer PickCustomer(List<Customer> customers, string team)
    {
        var preferred = team is "Enterprise" or "Агро"
            ? Weighted((CustomerSegment.Enterprise, 0.5), (CustomerSegment.MidMarket, 0.4), (CustomerSegment.Smb, 0.1))
            : Weighted((CustomerSegment.Smb, 0.6), (CustomerSegment.MidMarket, 0.3), (CustomerSegment.Enterprise, 0.1));
        var pool = customers.Where(c => c.Segment == preferred).ToList();
        return pool.Count > 0 ? pool[_random.Next(pool.Count)] : customers[_random.Next(customers.Count)];
    }

    /// <summary>Пик перед Новым годом, провал в январе, лёгкий летний подъём (сезон съёмок и агро).</summary>
    private static double SeasonFactor(int month) => month switch
    {
        1 => 0.6, 2 => 0.8, 3 => 0.95, 4 => 1.05, 5 => 1.15, 6 => 1.2,
        7 => 1.1, 8 => 1.0, 9 => 1.05, 10 => 1.1, 11 => 1.3, 12 => 1.45,
        _ => 1,
    };

    private static double WeekdayFactor(DayOfWeek day) => day switch
    {
        DayOfWeek.Saturday => 0.25,
        DayOfWeek.Sunday => 0.1,
        DayOfWeek.Monday => 0.9,
        DayOfWeek.Friday => 1.1,
        _ => 1.0,
    };

    /// <summary>Лёгкий рост бизнеса за год: от 0.85 год назад до 1.1 сегодня.</summary>
    private static double TrendFactor(int dayOffset) => 1.1 - 0.25 * dayOffset / HistoryDays;

    private DateTimeOffset RandomWorkTime(DateOnly day)
    {
        var minutes = 9 * 60 + _random.Next(11 * 60);
        return new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), GenerationOffset).AddMinutes(minutes).AddSeconds(_random.Next(60)).ToUniversalTime();
    }

    private T Pick<T>(IReadOnlyList<T> items) => items[_random.Next(items.Count)];

    private T Weighted<T>(params (T Value, double Weight)[] options)
    {
        var roll = _random.NextDouble() * options.Sum(o => o.Weight);
        foreach (var (value, weight) in options)
        {
            if ((roll -= weight) < 0)
            {
                return value;
            }
        }

        return options[^1].Value;
    }

    private int Poisson(double lambda)
    {
        var limit = Math.Exp(-lambda);
        var k = 0;
        var p = _random.NextDouble();
        while (p > limit)
        {
            k++;
            p *= _random.NextDouble();
        }

        return k;
    }

    /// <summary>Число «неудач» до первого успеха с вероятностью успеха <paramref name="p"/>.</summary>
    private int Geometric(double p)
    {
        var k = 0;
        while (_random.NextDouble() > p && k < 50)
        {
            k++;
        }

        return k;
    }

    private double Gaussian()
    {
        var u1 = 1.0 - _random.NextDouble();
        var u2 = _random.NextDouble();
        return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
    }
}
