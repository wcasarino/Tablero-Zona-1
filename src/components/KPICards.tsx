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
  const metrics = useMemo(() => {
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

      return {
        guardiaKpis: [
          { label: 'TOTAL GUARDIAS', value: totalRecords, border: 'border-blue-500 font-extrabold' },
          { label: 'ATE x DÍA', value: promedioDiario.toFixed(1), border: 'border-teal-500 font-extrabold' },
          { label: 'TOTAL DÍAS', value: diasTotal, border: 'border-purple-500 font-extrabold' },
          { label: 'URGENCIAS', value: urgenciaCount, border: 'border-rose-500 font-extrabold' },
          { label: 'DERIVACIONES', value: derivacionCount, border: 'border-amber-500 font-extrabold' },
        ],
      };
    }

    const habilesData = data.filter(d => {
      if (!d.fecha) return false;
      const day = parseISO(d.fecha).getDay();
      return day >= 1 && day <= 5;
    });
    const totalHabiles = habilesData.reduce((acc, d) => acc + (Number(d.atenciones) || 1), 0);
    const diasHabiles = new Set(habilesData.map(d => d.fecha)).size;
    const promedioHabiles = diasHabiles > 0 ? (totalHabiles / diasHabiles) : 0;

    const totalAtenciones = data.reduce((acc, d) => acc + (Number(d.atenciones) || 1), 0);

    const conTurnoCountRaw = data.reduce((acc, d) => {
      if (typeof d.conTurno === 'number') return acc + (Number(d.conTurno) || 0);
      const t = String(d.tipo || '').trim().toLowerCase();
      if (t === 'con turno' || t === 'con_turno' || t === 'con-turno') return acc + 1;
      if (t === 'sin turno' || t === 'sin_turno' || t === 'sin-turno') return acc;
      if (t === 'programado' || t === 'sobreturno' || t === 'sobre turno') return acc + 1;
      if (t === 'atención inmediata' || t === 'atencion inmediata' || t === 'inmediata' || t === 'espontánea' || t === 'espontanea') return acc;
      return acc + (t.includes('con turno') || (!t.includes('sin turno') && (t.includes('program') || t.includes('sobre'))) ? 1 : 0);
    }, 0);

    const sinTurnoCountRaw = data.reduce((acc, d) => {
      if (typeof d.sinTurno === 'number') return acc + (Number(d.sinTurno) || 0);
      const t = String(d.tipo || '').trim().toLowerCase();
      if (t === 'sin turno' || t === 'sin_turno' || t === 'sin-turno') return acc + 1;
      if (t === 'con turno' || t === 'con_turno' || t === 'con-turno') return acc;
      if (t === 'atención inmediata' || t === 'atencion inmediata' || t === 'inmediata' || t === 'espontánea' || t === 'espontanea') return acc + 1;
      if (t === 'programado' || t === 'sobreturno' || t === 'sobre turno') return acc;
      return acc + (t.includes('sin turno') || t.includes('inmediat') || t.includes('espont') ? 1 : 0);
    }, 0);

    const conTurnoPct = totalAtenciones > 0 ? ((conTurnoCountRaw / totalAtenciones) * 100).toFixed(1) + '%' : '0.0%';
    const sinTurnoPct = totalAtenciones > 0 ? ((sinTurnoCountRaw / totalAtenciones) * 100).toFixed(1) + '%' : '0.0%';

    // Canales BOT y CALL
    const botCountRaw = data.reduce((acc, d) => {
      if (d.canalBot !== undefined) return acc + (Number(d.canalBot) || 0);
      if (String(d.anotador || '').toUpperCase().includes('BOT')) return acc + (Number(d.atenciones) || 1);
      return acc;
    }, 0);

    const callCountRaw = data.reduce((acc, d) => {
      if (d.canalCall !== undefined) return acc + (Number(d.canalCall) || 0);
      if (String(d.anotador || '').toUpperCase().includes('CALL')) return acc + (Number(d.atenciones) || 1);
      return acc;
    }, 0);

    // CAPS es la diferencia de las CON TURNO menos BOT y CALL
    const capsCountRaw = Math.max(0, conTurnoCountRaw - botCountRaw - callCountRaw);

    // Porcentajes de canales con respecto al total de CON TURNOS
    const capsPct = conTurnoCountRaw > 0 ? ((capsCountRaw / conTurnoCountRaw) * 100).toFixed(1) + '%' : '0.0%';
    const botPct = conTurnoCountRaw > 0 ? ((botCountRaw / conTurnoCountRaw) * 100).toFixed(1) + '%' : '0.0%';
    const callPct = conTurnoCountRaw > 0 ? ((callCountRaw / conTurnoCountRaw) * 100).toFixed(1) + '%' : '0.0%';

    return {
      totalAtenciones: totalAtenciones.toLocaleString('es-AR'),
      conTurnoCount: conTurnoCountRaw.toLocaleString('es-AR'),
      conTurnoPct,
      sinTurnoCount: sinTurnoCountRaw.toLocaleString('es-AR'),
      sinTurnoPct,
      capsCount: capsCountRaw.toLocaleString('es-AR'),
      capsPct,
      botCount: botCountRaw.toLocaleString('es-AR'),
      botPct,
      callCount: callCountRaw.toLocaleString('es-AR'),
      callPct,
      promedioHabiles: promedioHabiles.toFixed(1),
      diasTotal,
    };
  }, [data, activeTab]);

  if (activeTab === 'GUARDIA') {
    return (
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.guardiaKpis?.map((kpi, idx) => (
          <div key={idx} className={cn("bg-white border-l-4 p-3 shadow-xs rounded flex flex-col justify-center min-h-[78px]", kpi.border)}>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{kpi.label}</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{kpi.value}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. TOTAL ATENCIONES */}
      <div className="bg-white border-l-4 border-blue-500 p-3 shadow-xs rounded flex flex-col justify-center min-h-[78px]">
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">TOTAL ATENCIONES</div>
        <div className="text-2xl font-black text-slate-900 mt-1">{metrics.totalAtenciones}</div>
      </div>

      {/* 2. TABLA CON TURNO / SIN TURNO */}
      <div className="bg-white border-l-4 border-emerald-500 px-3 py-1.5 shadow-xs rounded flex flex-col justify-between min-h-[78px]">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">CON / SIN TURNO</span>
          <span className="text-[8.5px] text-slate-400 font-semibold">% S/ TOTAL</span>
        </div>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-0.5 text-emerald-800 font-bold text-[10.5px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                Con Turno
              </td>
              <td className="py-0.5 text-right font-mono font-bold text-slate-800 text-[10.5px] pr-2">
                {metrics.conTurnoCount}
              </td>
              <td className="py-0.5 text-right font-mono font-semibold text-emerald-700 text-[10.5px] w-12">
                {metrics.conTurnoPct}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 text-amber-800 font-bold text-[10.5px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block shrink-0"></span>
                Sin Turno
              </td>
              <td className="py-0.5 text-right font-mono font-bold text-slate-800 text-[10.5px] pr-2">
                {metrics.sinTurnoCount}
              </td>
              <td className="py-0.5 text-right font-mono font-semibold text-amber-700 text-[10.5px] w-12">
                {metrics.sinTurnoPct}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 3. TABLA PROGRAMADOS */}
      <div className="bg-white border-l-4 border-indigo-500 px-3 py-1.5 shadow-xs rounded flex flex-col justify-between min-h-[78px]">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">PROGRAMADOS</span>
          <span className="text-[8.5px] text-slate-400 font-semibold">% S/ C.TURNO</span>
        </div>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-0.5 text-indigo-900 font-bold text-[10px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block shrink-0"></span>
                CAPS
              </td>
              <td className="py-0.5 text-right font-mono font-bold text-slate-800 text-[10px] pr-2">
                {metrics.capsCount}
              </td>
              <td className="py-0.5 text-right font-mono font-semibold text-indigo-700 text-[10px] w-12">
                {metrics.capsPct}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 text-blue-900 font-bold text-[10px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0"></span>
                BOT
              </td>
              <td className="py-0.5 text-right font-mono font-bold text-slate-800 text-[10px] pr-2">
                {metrics.botCount}
              </td>
              <td className="py-0.5 text-right font-mono font-semibold text-blue-700 text-[10px] w-12">
                {metrics.botPct}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 text-purple-900 font-bold text-[10px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block shrink-0"></span>
                CALL
              </td>
              <td className="py-0.5 text-right font-mono font-bold text-slate-800 text-[10px] pr-2">
                {metrics.callCount}
              </td>
              <td className="py-0.5 text-right font-mono font-semibold text-purple-700 text-[10px] w-12">
                {metrics.callPct}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 4. TOTAL DÍAS */}
      <div className="bg-white border-l-4 border-purple-500 p-3 shadow-xs rounded flex flex-col justify-center min-h-[78px]">
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">TOTAL DÍAS</div>
        <div className="text-2xl font-black text-slate-900 mt-1">{metrics.diasTotal}</div>
      </div>
    </div>
  );
}
