import type {
  CategoriesResponse,
  KpiResponse,
  KpiValue,
  Manager,
  RankingResponse,
  RecentSalesResponse,
} from '@/api/types'

const period = { from: '2026-08-25', to: '2026-09-23', tz: 'Europe/Moscow' }
const previousPeriod = { from: '2026-07-26', to: '2026-08-24', tz: 'Europe/Moscow' }

const money = (value: number | null, previous: number | null, change: number | null): KpiValue => ({
  value,
  previous,
  change,
  changeKind: 'percent',
})
const ratio = (value: number | null, previous: number | null, change: number | null): KpiValue => ({
  value,
  previous,
  change,
  changeKind: 'points',
})

export const anna: Manager = {
  id: 1,
  fullName: 'Анна Соколова',
  team: 'Enterprise',
  position: 'Ведущий менеджер',
  avatarColor: '#2563eb',
  isActive: true,
}
export const boris: Manager = {
  id: 2,
  fullName: 'Борис Орлов',
  team: 'Москва',
  position: 'Менеджер',
  avatarColor: '#7c3aed',
  isActive: true,
}
export const clara: Manager = {
  id: 3,
  fullName: 'Клара Волкова',
  team: 'Москва',
  position: 'Менеджер',
  avatarColor: '#db2777',
  isActive: true,
}

export const kpi: KpiResponse = {
  period,
  previousPeriod,
  revenue: money(252_352_290, 195_930_068, 28.8),
  grossRevenue: money(267_995_852, 202_058_629, 32.6),
  grossProfit: money(46_627_899, 37_115_668, 25.6),
  margin: ratio(0.1848, 0.1894, -0.5),
  salesCount: money(243, 221, 10),
  averageCheck: money(1_102_863, 914_292, 20.6),
  refundRate: ratio(0.0412, 0.0724, -3.1),
  refundedAmount: money(15_643_562, 6_128_561, 155.3),
  refundCosts: money(120_000, 80_000, 50),
  bestManager: {
    manager: anna,
    grossProfit: 14_496_588,
    revenue: 81_464_778,
    refundRate: 0.0588,
    salesCount: 17,
  },
}

export const emptyKpi: KpiResponse = {
  ...kpi,
  revenue: money(0, 0, null),
  grossRevenue: money(0, 0, null),
  grossProfit: money(0, 0, null),
  margin: ratio(null, null, null),
  salesCount: money(0, 0, null),
  averageCheck: money(null, null, null),
  refundRate: ratio(null, null, null),
  refundedAmount: money(0, 0, null),
  refundCosts: money(0, 0, null),
  bestManager: null,
}

const rankingItem = (
  rank: number | null,
  manager: Manager,
  grossProfit: number,
  averageCheck: number | null,
  salesCount = 10,
) => ({
  rank,
  previousRank: rank,
  manager,
  salesCount,
  revenue: grossProfit * 5,
  grossProfit,
  averageCheck,
  margin: 0.2,
  refundRate: 0.05,
  change: 12.5,
})

export const rankingByProfit: RankingResponse = {
  period,
  previousPeriod,
  sortBy: 'grossProfit',
  items: [
    rankingItem(1, anna, 14_000_000, 800_000),
    rankingItem(2, boris, 9_000_000, 2_400_000),
    rankingItem(null, clara, 0, null, 0),
  ],
}

export const rankingByCheck: RankingResponse = {
  ...rankingByProfit,
  sortBy: 'averageCheck',
  items: [
    rankingItem(1, boris, 9_000_000, 2_400_000),
    rankingItem(2, anna, 14_000_000, 800_000),
    rankingItem(null, clara, 0, null, 0),
  ],
}

export const categories: CategoriesResponse = {
  period,
  items: [
    {
      categoryId: 1,
      category: 'Промышленные решения',
      revenue: 165_000_000,
      grossProfit: 28_000_000,
      margin: 0.17,
      share: 0.65,
    },
    {
      categoryId: 2,
      category: 'Аксессуары',
      revenue: 11_800_000,
      grossProfit: 3_800_000,
      margin: 0.325,
      share: 0.047,
    },
  ],
}

export const emptyCategories: CategoriesResponse = {
  period,
  items: categories.items.map((c) => ({ ...c, revenue: 0, grossProfit: 0, margin: null, share: null })),
}

export const recentSales: RecentSalesResponse = {
  period,
  nextCursor: null,
  items: [
    {
      id: 10,
      soldAt: '2026-09-23T16:07:44Z',
      status: 'refunded',
      manager: anna,
      customer: 'Иван Петров',
      company: 'ООО «ГеоСервис»',
      items: [{ product: 'DJI Matrice 4T', quantity: 1, unitPrice: 904_908 }],
      amount: 904_908,
      grossProfit: 109_598,
      refund: { refundedAt: '2026-09-25T10:00:00Z', itemsRestocked: false, reason: 'Брак', extraCosts: 5000 },
    },
  ],
}
