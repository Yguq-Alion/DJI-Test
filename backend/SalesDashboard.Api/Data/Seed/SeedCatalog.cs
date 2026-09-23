using SalesDashboard.Api.Domain;

namespace SalesDashboard.Api.Data.Seed;

/// <summary>Статические справочники для генератора: ассортимент, команда продаж, клиенты.</summary>
internal static class SeedCatalog
{
    /// <summary>Категория, диапазон наценки над себестоимостью и товары (название, прайсовая цена).</summary>
    public static readonly (string Category, decimal MinMarkup, decimal MaxMarkup, (string Name, decimal Price)[] Products)[] Assortment =
    [
        ("Потребительские дроны", 0.14m, 0.22m,
        [
            ("DJI Mini 4 Pro", 89_990m), ("DJI Mini 4K", 39_990m), ("DJI Air 3S", 139_990m), ("DJI Mavic 4 Pro", 279_990m),
            ("DJI Avata 2 Fly More", 119_990m), ("DJI Neo", 24_990m), ("DJI Flip", 49_990m),
        ]),
        ("Промышленные решения", 0.22m, 0.34m,
        [
            ("DJI Matrice 4E", 749_990m), ("DJI Matrice 4T", 1_049_990m), ("DJI Matrice 350 RTK", 1_390_000m),
            ("Zenmuse H30T", 1_290_000m), ("Zenmuse L2 LiDAR", 1_690_000m), ("DJI Dock 3", 2_490_000m),
        ]),
        ("Агродроны", 0.18m, 0.26m,
        [
            ("DJI Agras T50", 1_890_000m), ("DJI Agras T25", 1_190_000m), ("DJI Mavic 3M Multispectral", 489_990m),
            ("Агро-комплект батарей DB1560", 159_990m),
        ]),
        ("Камеры и стабилизаторы", 0.20m, 0.30m,
        [
            ("DJI Osmo Pocket 3", 54_990m), ("DJI Osmo 360", 49_990m), ("DJI Osmo Action 5 Pro", 44_990m),
            ("DJI RS 4 Pro", 89_990m), ("DJI RS 4 Mini", 39_990m), ("DJI Ronin 4D-6K", 899_990m), ("DJI Mic 2", 32_990m),
        ]),
        ("Аксессуары", 0.40m, 0.65m,
        [
            ("Аккумулятор Mini 4 Intelligent Flight", 8_990m), ("Зарядный хаб Air 3", 7_490m), ("ND-фильтры Mavic 4 (набор)", 9_990m),
            ("Пропеллеры Matrice 350 (пара)", 6_490m), ("Кейс защитный Agras", 24_990m), ("Карта памяти 256 ГБ V30", 4_990m),
            ("Пульт DJI RC 2", 42_990m), ("Очки DJI Goggles 3", 64_990m),
        ]),
        ("Сервис и обучение", 0.55m, 0.80m,
        [
            ("DJI Care Refresh 1 год", 12_990m), ("DJI Care Enterprise Plus", 149_990m), ("Курс «Пилот БВС» (1 чел.)", 59_990m),
            ("Выездное обучение экипажа", 189_990m), ("Регистрация и настройка парка", 79_990m), ("Годовое ТО промышленного дрона", 119_990m),
        ]),
    ];

    /// <summary>
    /// Профили менеджеров. Activity — относительная частота сделок, CheckFactor — множитель размера сделки,
    /// Discount — средняя скидка (ниже маржа), RefundRisk — множитель вероятности возврата,
    /// StartMonthsAgo / LeftMonthsAgo — период работы, VacationDays — пропуск в продажах (дни назад: начало, длина).
    /// </summary>
    public static readonly ManagerProfile[] Managers =
    [
        new("Анна Соколова", "Enterprise", "Ведущий менеджер", 1.25, 1.9, 0.05, 0.6),
        new("Дмитрий Орлов", "Enterprise", "Ключевой менеджер", 0.9, 2.4, 0.07, 0.8),
        new("Екатерина Волкова", "Enterprise", "Менеджер", 0.75, 1.6, 0.10, 1.0, VacationDays: (40, 21)),
        new("Игорь Лебедев", "Enterprise", "Старший менеджер", 1.05, 1.7, 0.12, 1.3),
        new("Мария Козлова", "Москва", "Ведущий менеджер", 1.6, 1.0, 0.04, 0.7),
        new("Алексей Новиков", "Москва", "Менеджер", 1.3, 0.9, 0.08, 1.0),
        new("Ольга Морозова", "Москва", "Менеджер", 1.1, 0.95, 0.06, 0.9, VacationDays: (130, 18)),
        new("Сергей Павлов", "Москва", "Младший менеджер", 0.8, 0.7, 0.11, 1.6),
        new("Наталья Семёнова", "Москва", "Менеджер", 1.2, 1.05, 0.05, 0.8),
        new("Павел Голубев", "Санкт-Петербург", "Старший менеджер", 1.35, 1.1, 0.06, 0.9),
        new("Юлия Виноградова", "Санкт-Петербург", "Менеджер", 1.0, 0.85, 0.09, 1.1),
        new("Артём Богданов", "Санкт-Петербург", "Младший менеджер", 0.6, 0.75, 0.13, 1.9, StartMonthsAgo: 4),
        new("Ирина Воробьёва", "Санкт-Петербург", "Менеджер", 1.15, 1.0, 0.07, 0.9, VacationDays: (8, 14)),
        new("Максим Фёдоров", "Регионы", "Старший менеджер", 1.2, 1.25, 0.08, 1.0),
        new("Татьяна Михайлова", "Регионы", "Менеджер", 0.95, 1.15, 0.10, 1.2),
        new("Роман Беляев", "Регионы", "Менеджер", 0.85, 1.35, 0.14, 1.4),
        new("Светлана Тарасова", "Регионы", "Младший менеджер", 0.55, 0.8, 0.12, 2.2),
        new("Кирилл Белов", "Агро", "Ключевой менеджер", 0.8, 2.1, 0.06, 0.7),
        new("Елена Комарова", "Агро", "Менеджер", 0.7, 1.8, 0.09, 1.0, StartMonthsAgo: 7),
        new("Владимир Киселёв", "Агро", "Менеджер", 0.65, 1.7, 0.10, 1.2, LeftMonthsAgo: 2),
    ];

    public static readonly string[] AvatarColors =
    [
        "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#4f46e5", "#ca8a04", "#dc2626", "#0d9488",
    ];

    public static readonly string[] CompanyPrefixes =
    [
        "Гео", "Агро", "Строй", "Энерго", "Транс", "Нефте", "Медиа", "Урал", "Сибирь", "Волга", "Север", "Балт", "Тех", "Мега", "Про",
    ];

    public static readonly string[] CompanySuffixes =
    [
        "Сервис", "Проект", "Контроль", "Инвест", "Холдинг", "Технологии", "Систем", "Мониторинг", "Геодезия", "Продакшн", "Логистик", "Групп",
    ];

    public static readonly string[] CompanyForms = ["ООО", "АО", "ООО", "ПАО", "ООО", "ИП"];

    public static readonly string[] FirstNames =
    [
        "Андрей", "Виктор", "Николай", "Евгений", "Михаил", "Олег", "Григорий", "Константин", "Людмила", "Вера", "Галина", "Полина",
        "Ксения", "Дарья", "Антон", "Станислав", "Василий", "Тимур", "Руслан", "Алина",
    ];

    public static readonly string[] LastNames =
    [
        "Кузнецов", "Попов", "Васильев", "Петров", "Смирнов", "Зайцев", "Соловьёв", "Борисов", "Яковлев", "Григорьев", "Романов",
        "Воронцов", "Жуков", "Николаев", "Орехов", "Макаров", "Андреев", "Ковалёв", "Ильин", "Гусев",
    ];

    public static readonly string[] RefundReasons =
    [
        "Брак при приёмке", "Не подошла комплектация", "Отказ клиента в период возврата", "Повреждение при доставке",
        "Ошибка в заказе", "Проект клиента отменён",
    ];
}

internal sealed record ManagerProfile(
    string FullName,
    string Team,
    string Position,
    double Activity,
    double CheckFactor,
    double Discount,
    double RefundRisk,
    int StartMonthsAgo = 13,
    int? LeftMonthsAgo = null,
    (int StartDaysAgo, int Length)? VacationDays = null);

internal static class CustomerSegments
{
    /// <summary>Доля сегмента среди клиентов и его влияние на объём сделки.</summary>
    public static readonly (CustomerSegment Segment, double Share, double VolumeFactor)[] Mix =
    [
        (CustomerSegment.Smb, 0.55, 0.7),
        (CustomerSegment.MidMarket, 0.30, 1.3),
        (CustomerSegment.Enterprise, 0.15, 2.4),
    ];
}
