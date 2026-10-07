import React, { useMemo, useState, useEffect } from 'react';
import { Turno } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export default function CalendarView({ data }: { data: Turno[] }) {
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  useEffect(() => {
    if (data && data.length > 0) {
      const dates = data.map(d => parseISO(d.fecha).getTime());
      const maxTime = Math.max(...dates);
      if (!isNaN(maxTime)) {
        setCurrentMonth(startOfMonth(new Date(maxTime)));
      }
    }
  }, [data]);

  const { minDate, maxDate, turnosByDate } = useMemo(() => {
    const dates = data.map(d => parseISO(d.fecha).getTime());
    let minD = new Date();
    let maxD = new Date();
    if (dates.length > 0) {
      minD = new Date(Math.min(...dates));
      maxD = new Date(Math.max(...dates));
    }
    
    // Group turnos by date
    const map = new Map<string, number>();
    data.forEach(d => {
      const atenciones = Number(d.atenciones) || 1;
      const count = map.get(d.fecha) || 0;
      map.set(d.fecha, count + atenciones);
    });

    return { minDate: minD, maxDate: maxD, turnosByDate: map };
  }, [data]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // simple grid alignment (assuming Sunday is 0)
  const startDay = days[0].getDay();
  const emptyDays = Array(startDay).fill(null);

  const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="bg-white border flex-1 border-slate-200 rounded shadow-sm p-2 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h3>
        </div>
        <div className="flex bg-slate-100 rounded border border-slate-200">
          <button onClick={prevMonth} className="px-1 hover:bg-slate-200 rounded-l transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={nextMonth} className="px-1 hover:bg-slate-200 rounded-r border-l border-slate-200 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded overflow-hidden flex-1 text-[10px]">
        {WEEKDAYS.map(day => (
          <div key={day} className="bg-slate-50 py-1 text-center font-bold text-slate-600">
            {day.charAt(0)}
          </div>
        ))}
        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} className="bg-white min-h-[30px]" />
        ))}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const turnosCount = turnosByDate.get(dateStr) || 0;
          const hasTurnos = turnosCount > 0;
          
          return (
            <div 
              key={dateStr} 
              className={cn(
                "bg-white min-h-[30px] p-0.5 border-slate-100 relative group flex flex-col items-center justify-start",
                hasTurnos && "bg-blue-50/50"
              )}
            >
              <span className={cn(
                "font-bold w-4 h-4 flex items-center justify-center rounded mt-0.5",
                hasTurnos ? "text-blue-700 bg-blue-200" : "text-slate-400"
              )}>
                {format(day, 'd')}
              </span>
              {hasTurnos && (
                <div className="mt-auto px-1 w-full text-center font-bold text-blue-800 truncate">
                  {turnosCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
