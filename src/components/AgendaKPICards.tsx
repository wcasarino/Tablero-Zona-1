import React, { useMemo } from 'react';
import { Agenda } from '../types';
import { cn } from '../lib/utils';
import { Calendar, CheckCircle2, Clock, Activity, Users } from 'lucide-react';

interface Props {
  data: Agenda[];
  selectedCanales?: string[];
}

export default function AgendaKPICards({ data, selectedCanales = [] }: Props) {
  const kpis = useMemo(() => {
    let totalProg = 0;
    let totalOtorg = 0;
    let totalDispo = 0;
    let sumVentana = 0;

    let progTod = 0, progHos = 0, progBot = 0, progCall = 0, progWid = 0;
    let otorgTod = 0, otorgHos = 0, otorgBot = 0, otorgCall = 0, otorgWid = 0;
    let dispoTod = 0, dispoHos = 0, dispoBot = 0, dispoCall = 0, dispoWid = 0;

    data.forEach(item => {
      progTod += item.progTTod || 0;
      progHos += item.progTHos || 0;
      progBot += item.progTBot || 0;
      progCall += item.progTCall || 0;
      progWid += item.progTWid || 0;

      otorgTod += item.otorgTTod || 0;
      otorgHos += item.otorgTHos || 0;
      otorgBot += item.otorgTBot || 0;
      otorgCall += item.otorgTCall || 0;
      otorgWid += item.otorgTWid || 0;

      dispoTod += item.dispoTTod || 0;
      dispoHos += item.dispoTHos || 0;
      dispoBot += item.dispoTBot || 0;
      dispoCall += item.dispoTCall || 0;
      dispoWid += item.dispoTWid || 0;

      totalProg += item.progT || 0;
      totalOtorg += item.otorgT || 0;
      totalDispo += item.dispoT || 0;
      sumVentana += item.ventana || 0;
    });

    const ocupacionPct = totalProg > 0 ? (totalOtorg / totalProg) * 100 : 0;
    const avgVentana = data.length > 0 ? (sumVentana / data.length) : 0;
    const totalAgendas = data.length;

    return [
      {
        label: 'TURNOS PROGRAMADOS',
        value: totalProg.toLocaleString(),
        sub: `Tod: ${progTod.toLocaleString()} | Hos: ${progHos.toLocaleString()} | Bot: ${progBot.toLocaleString()} | Call: ${progCall.toLocaleString()} | Wid: ${progWid.toLocaleString()}`,
        border: 'border-blue-500',
        textColor: 'text-blue-600',
        icon: <Calendar className="w-4 h-4 text-blue-500" />
      },
      {
        label: 'TURNOS OTORGADOS',
        value: totalOtorg.toLocaleString(),
        sub: `Tod: ${otorgTod.toLocaleString()} | Hos: ${otorgHos.toLocaleString()} | Bot: ${otorgBot.toLocaleString()} | Call: ${otorgCall.toLocaleString()} | Wid: ${otorgWid.toLocaleString()}`,
        border: 'border-emerald-500',
        textColor: 'text-emerald-600',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      },
      {
        label: 'TURNOS DISPONIBLES',
        value: totalDispo.toLocaleString(),
        sub: `Tod: ${dispoTod.toLocaleString()} | Hos: ${dispoHos.toLocaleString()} | Bot: ${dispoBot.toLocaleString()} | Call: ${dispoCall.toLocaleString()} | Wid: ${dispoWid.toLocaleString()}`,
        border: 'border-amber-500',
        textColor: 'text-amber-600',
        icon: <Clock className="w-4 h-4 text-amber-500" />
      },
      {
        label: '% OCUPACIÓN',
        value: `${ocupacionPct.toFixed(1)}%`,
        sub: `${totalOtorg.toLocaleString()} de ${totalProg.toLocaleString()} turnos`,
        border: ocupacionPct >= 80 ? 'border-teal-500' : ocupacionPct >= 50 ? 'border-indigo-500' : 'border-slate-500',
        textColor: ocupacionPct >= 80 ? 'text-teal-600' : 'text-indigo-600',
        icon: <Activity className="w-4 h-4 text-indigo-500" />
      },
      {
        label: 'VENTANA PROMEDIO',
        value: `${avgVentana.toFixed(1)} días`,
        sub: `${totalAgendas.toLocaleString()} configuraciones de agenda`,
        border: 'border-cyan-500',
        textColor: 'text-cyan-600',
        icon: <Users className="w-4 h-4 text-cyan-500" />
      }
    ];
  }, [data]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {kpis.map((kpi, idx) => (
        <div 
          key={idx} 
          className={cn(
            "bg-white border-l-4 p-2.5 shadow-xs rounded flex flex-col justify-between transition-all hover:shadow-sm", 
            kpi.border
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight truncate">
              {kpi.label}
            </span>
            {kpi.icon}
          </div>
          <div className={cn("text-xl font-black mt-1", kpi.textColor)}>
            {kpi.value}
          </div>
          <div className="text-[8.5px] text-slate-500 font-medium leading-tight mt-1" title={kpi.sub}>
            {kpi.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
