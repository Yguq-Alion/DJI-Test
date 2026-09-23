import { useEffect, useState } from 'react'

export interface ChartColors {
  series1: string
  series2: string
  series3: string
  grid: string
  axis: string
  text: string
  muted: string
  surface: string
}

function read(): ChartColors {
  const style = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    series1: v('--series-1', '#2a78d6'),
    series2: v('--series-2', '#eb6834'),
    series3: v('--series-3', '#1baf7a'),
    grid: v('--grid', '#e1e0d9'),
    axis: v('--border', '#c3c2b7'),
    text: v('--foreground', '#0b0b0b'),
    muted: v('--muted-foreground', '#898781'),
    surface: v('--card', '#ffffff'),
  }
}

/**
 * Nivo работает с конкретными цветами (а не с var(--…)), поэтому читаем токены темы
 * и перечитываем их при переключении класса .dark на <html>.
 */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState(read)

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return colors
}
