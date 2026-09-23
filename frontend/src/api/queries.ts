import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { PeriodParams } from '@/features/period/period-state'
import { apiGet } from './client'
import type {
  CategoriesResponse,
  KpiResponse,
  RankingResponse,
  RankingSort,
  RecentSalesResponse,
  SaleStatus,
  TimeseriesResponse,
  TopProductsResponse,
} from './types'

// keepPreviousData: при смене периода блок показывает прежние данные (приглушённо), а не мигает скелетоном.

export function useKpi(period: PeriodParams) {
  return useQuery({
    queryKey: ['kpi', period],
    queryFn: ({ signal }) => apiGet<KpiResponse>('dashboard/kpi', { ...period }, signal),
    placeholderData: keepPreviousData,
  })
}

export function useTimeseries(period: PeriodParams, granularity: string) {
  return useQuery({
    queryKey: ['timeseries', period, granularity],
    queryFn: ({ signal }) =>
      apiGet<TimeseriesResponse>('dashboard/timeseries', { ...period, granularity }, signal),
    placeholderData: keepPreviousData,
  })
}

export function useRanking(period: PeriodParams, sortBy: RankingSort) {
  return useQuery({
    queryKey: ['ranking', period, sortBy],
    queryFn: ({ signal }) => apiGet<RankingResponse>('managers/ranking', { ...period, sortBy }, signal),
    placeholderData: keepPreviousData,
  })
}

export function useCategories(period: PeriodParams) {
  return useQuery({
    queryKey: ['categories', period],
    queryFn: ({ signal }) => apiGet<CategoriesResponse>('dashboard/categories', { ...period }, signal),
    placeholderData: keepPreviousData,
  })
}

export function useTopProducts(period: PeriodParams, limit = 8) {
  return useQuery({
    queryKey: ['topProducts', period, limit],
    queryFn: ({ signal }) =>
      apiGet<TopProductsResponse>('dashboard/products/top', { ...period, limit }, signal),
    placeholderData: keepPreviousData,
  })
}

export function useRecentSales(period: PeriodParams, filters: { status?: SaleStatus; managerId?: number }) {
  return useInfiniteQuery({
    queryKey: ['recentSales', period, filters],
    queryFn: ({ signal, pageParam }) =>
      apiGet<RecentSalesResponse>(
        'sales/recent',
        { ...period, limit: 12, cursor: pageParam, status: filters.status, managerId: filters.managerId },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  })
}
