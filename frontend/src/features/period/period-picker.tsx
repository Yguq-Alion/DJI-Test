import { ru } from 'date-fns/locale'
import { CalendarRange } from 'lucide-react'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatDateRange, parseIsoDate, toIsoDate } from '@/lib/format'
import { PRESETS, type Preset, usePeriod } from './period-state'

export function PeriodPicker() {
  const { params, isCustom, setPreset, setRange } = usePeriod()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()

  const openCalendar = (next: boolean) => {
    setOpen(next)
    if (next) {
      setDraft(
        isCustom && params.from && params.to
          ? { from: parseIsoDate(params.from), to: parseIsoDate(params.to) }
          : undefined,
      )
    }
  }

  const apply = () => {
    if (draft?.from) {
      setRange(draft.from, draft.to ?? draft.from)
      setOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
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
        <PopoverContent align="end" className="w-auto p-3">
          <Calendar
            mode="range"
            locale={ru}
            numberOfMonths={2}
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft?.from ?? new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)}
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
    </div>
  )
}
