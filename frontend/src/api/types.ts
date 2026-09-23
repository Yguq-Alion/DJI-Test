// Контракт API (см. docs/decisions.md §5). Деньги — рубли, доли — 0..1.

export type SaleStatus = 'paid' | 'cancelled' | 'refunded'
export type RankingSort = 'grossProfit' | 'averageCheck'
export type Granularity = 'hour' | 'day' | 'week' | 'month'
export type ChangeKind = 'percent' | 'points'

export interface Period {
  from: string
  to: string
  tz: string
}

export interface Manager {
  id: number
  fullName: string
  team: string
  position: string
  avatarColor: string
  isActive: boolean
}

export interface KpiValue {
  value: number | null
  previous: number | null
  change: number | null
  changeKind: ChangeKind
}

export interface KpiResponse {
  period: Period
  previousPeriod: Period
  revenue: KpiValue
  grossRevenue: KpiValue
  grossProfit: KpiValue
  margin: KpiValue
  salesCount: KpiValue
  averageCheck: KpiValue
  refundRate: KpiValue
  refundedAmount: KpiValue
  refundCosts: KpiValue
  bestManager: {
    manager: Manager
    grossProfit: number
    revenue: number
    refundRate: number | null
    salesCount: number
  } | null
}

export interface TimeseriesPoint {
  bucketStart: string
  revenue: number
  grossProfit: number
  salesCount: number
}

export interface TimeseriesResponse {
  period: Period
  granularity: Granularity
  points: TimeseriesPoint[]
}

export interface RankingItem {
  rank: number | null
  previousRank: number | null
  manager: Manager
  salesCount: number
  revenue: number
  grossProfit: number
  averageCheck: number | null
  margin: number | null
  refundRate: number | null
  change: number | null
}

export interface RankingResponse {
  period: Period
  previousPeriod: Period
  sortBy: RankingSort
  items: RankingItem[]
}

export interface CategoryItem {
  categoryId: number
  category: string
  revenue: number
  grossProfit: number
  margin: number | null
  share: number | null
}

export interface CategoriesResponse {
  period: Period
  items: CategoryItem[]
}

export interface TopProductItem {
  productId: number
  product: string
  category: string
  quantity: number
  revenue: number
  grossProfit: number
  margin: number | null
}

export interface TopProductsResponse {
  period: Period
  items: TopProductItem[]
}

export interface RecentSale {
  id: number
  soldAt: string
  status: SaleStatus
  manager: Manager
  customer: string
  company: string
  items: { product: string; quantity: number; unitPrice: number }[]
  amount: number
  grossProfit: number
  refund: { refundedAt: string; itemsRestocked: boolean; reason: string | null; extraCosts: number } | null
}

export interface RecentSalesResponse {
  period: Period
  items: RecentSale[]
  nextCursor: string | null
}
