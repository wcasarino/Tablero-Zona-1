import React, { useMemo } from 'react';
import { cn } from '../lib/utils';
import { parseISO } from 'date-fns';

export default function KPICards({ 
  data, 
  activeTab = 'AMBULATORIO',
}: { 
  data: any[]; 
  activeTab?: 'AMBULATORIO' | 'GUARDIA';
}) {
  const kpis = useMemo(() => {
    const totalRecords = data.length;

    const diasTotal = new Set(data.filter(d => d.fecha).map(d => d.fecha)).size;
    const promedioDiario = diasTotal > 0 ? (totalRecords / diasTotal) : 0;
    
    if (activeTab === 'GUARDIA') {
      const urgenciaCount = data.filter(d => {
        const u = String(d.urgencia || '').trim().toLowerCase();
        return u.includes('urgencia') || u.includes('emergencia');
      }).length;

      const derivacionCount = data.filter(d => {
        const e = String(d.egreso || '').trim().toLowerCase();
        return e.includes('derivación') || e.includes('derivacion') || e.includes('derivado');
      }).length;

      return [
        { label: 'TOTAL GUARDIAS', value: totalRecords, border: 'border-blue-500 font-extrabold' },
        { label: 'ATE x DÍA', value: promedioDiario.toFixed(1), border: 'border-teal-500 font-extrabold' },
        { label: 'TOTAL DÍAS', value: diasTotal, border: 'border-purple-500 font-extrabold' },
        { label: 'URGENCIAS', value: urgenciaCount, border: 'border-rose-500 font-extrabold' },
        { label: 'DERIVACIONES', value: derivacionCount, border: 'border-amber-500 font-extrabold' },
      ];
    }

    const habilesData = data.filter(d => {
      if (!d.fecha) return false;
      const day = parseISO(d.fecha).getDay();
      return day >= 1 && day <= 5;
    });
    const totalHabiles = habilesData.length;
    const diasHabiles = new Set(habilesData.map(d => d.fecha)).size;
    const promedioHabiles = diasHabiles > 0 ? (totalHabiles / diasHabiles) : 0;

    const uniqueDni = new Set(data.map(d => d.dni)).size;

    const conTurnoCount = data.filter(d => {
      const t = String(d.tipo || '').trim().toLowerCase();
      if (t === 'con turno' || t === 'con_turno' || t === 'con-turno') return true;
      if (t === 'sin turno' || t === 'sin_turno' || t === 'sin-turno') return false;
      if (t === 'programado' || t === 'sobreturno' || t === 'sobre turno') return true;
      if (t === 'atención inmediata' || t === 'atencion inmediata' || t === 'inmediata' || t === 'espontánea' || t === 'espontanea') return false;
      return t.includes('con turno') || (!t.includes('sin turno') && (t.includes('program') || t.includes('sobre')));
    }).length;

    const sinTurnoCount = data.filter(d => {
      const t = String(d.tipo || '').trim().toLowerCase();
      if (t === 'sin turno' || t === 'sin_turno' || t === 'sin-turno') return true;
      if (t === 'con turno' || t === 'con_turno' || t === 'con-turno') return false;
      if (t === 'atención inmediata' || t === 'atencion inmediata' || t === 'inmediata' || t === 'espontánea' || t === 'espontanea') return true;
      if (t === 'programado' || t === 'sobreturno' || t === 'sobre turno') return false;
      return t.includes('sin turno') || t.includes('inmediat') || t.includes('espont');
    }).length;

    return [
      { label: 'TOTAL TURNOS', value: totalRecords, border: 'border-blue-500 font-extrabold' },
      { label: 'CON TURNO', value: conTurnoCount, border: 'border-emerald-500 font-extrabold' },
      { label: 'SIN TURNO', value: sinTurnoCount, border: 'border-orange-500 font-extrabold' },
      { label: 'ATE x DÍA', value: promedioHabiles.toFixed(1), border: 'border-teal-500 font-extrabold' },
      { label: 'TOTAL DÍAS', value: diasTotal, border: 'border-purple-500 font-extrabold' },
      { label: 'PAC. ÚNICOS', value: uniqueDni, border: 'border-amber-500 font-extrabold' },
    ];
  }, [data, activeTab]);

  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi, idx) => (
        <div key={idx} className={cn("bg-white border-l-4 p-3 shadow-sm rounded flex flex-col justify-center", kpi.border)}>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{kpi.label}</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{kpi.value}</div>
        </div>
      ))}
    </div>
  );
}
