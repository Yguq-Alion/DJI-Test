import { ru } from 'date-fns/locale'
import { CalendarRange } from 'lucide-react'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { useKpi } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatDateRange, parseIsoDate, toIsoDate } from '@/lib/format'
import { PRESETS, type Preset, usePeriod } from './period-state'

/** Диапазон «от первой выбранной даты до даты под курсором» — подсветка ещё не завершённого выбора. */
export function previewRange(draft: DateRange | undefined, hovered: Date | undefined): DateRange | undefined {
  if (!draft?.from || draft.to || !hovered) return undefined
  return hovered < draft.from ? { from: hovered, to: draft.from } : { from: draft.from, to: hovered }
}

export function PeriodPicker() {
  const { params, isCustom, setPreset, setRange } = usePeriod()
  // Даты пресета считает сервер — берём их из уже загруженных KPI (тот же запрос, из кэша).
  const resolved = useKpi(params).data?.period
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()
  const [hovered, setHovered] = useState<Date | undefined>()
  const preview = previewRange(draft, hovered)

  const openCalendar = (next: boolean) => {
    setOpen(next)
    setHovered(undefined)
    if (next) {
      // Календарь открывается с подсвеченными датами текущего периода — и для пресета, и для произвольного.
      setDraft(resolved ? { from: parseIsoDate(resolved.from), to: parseIsoDate(resolved.to) } : undefined)
    }
  }

  const apply = () => {
    if (draft?.from) {
      setRange(draft.from, draft.to ?? draft.from)
      setOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Период"
        value={isCustom ? '' : params.preset}
        onValueChange={(value) => value && setPreset(value as Preset)}
      >
        {PRESETS.map((preset) => (
          <ToggleGroupItem key={preset.value} value={preset.value} className="px-3">
            {preset.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Popover open={open} onOpenChange={openCalendar}>
        <PopoverTrigger asChild>
          <Button variant={isCustom ? 'default' : 'outline'} size="sm" aria-label="Произвольный период">
            <CalendarRange aria-hidden />
            {isCustom && params.from && params.to ? formatDateRange(params.from, params.to) : 'Период…'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <Calendar
            mode="range"
            locale={ru}
            numberOfMonths={2}
            selected={draft}
            onSelect={(range, day) => {
              // Если диапазон уже выбран целиком, клик начинает новый выбор, а не растягивает старый.
              setDraft(draft?.from && draft.to ? { from: day, to: undefined } : range)
              setHovered(undefined)
            }}
            onDayMouseEnter={(day) => setHovered(day)}
            onDayMouseLeave={() => setHovered(undefined)}
            modifiers={preview ? { preview } : undefined}
            modifiersClassNames={{ preview: 'bg-primary/10' }}
            defaultMonth={
              draft?.to
                ? new Date(draft.to.getFullYear(), draft.to.getMonth() - 1, 1)
                : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
            }
            disabled={{ after: new Date() }}
          />
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {draft?.from
                ? formatDateRange(toIsoDate(draft.from), toIsoDate(draft.to ?? draft.from))
                : 'Выберите даты from — to'}
            </span>
            <Button size="sm" onClick={apply} disabled={!draft?.from}>
              Применить
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {resolved && (
        <span className="text-sm text-muted-foreground tabular" aria-live="polite">
          {formatDateRange(resolved.from, resolved.to)}
        </span>
      )}
    </div>
  )
}
