import React, { useMemo, useRef } from 'react';
import { Turno, Profesional, Filters } from '../types';
import DownloadPdfButton from './DownloadPdfButton';
import DownloadExcelButton from './DownloadExcelButton';
import { cn } from '../lib/utils';
import { parseISO } from 'date-fns';

function groupByAmbulatorio(data: any[], prop: string) {
  const map = new Map<string, { 
    count: number; 
    fechas: Set<string>; 
    countHabiles: number; 
    fechasHabiles: Set<string>;
    conTurno: number;
    bot: number;
    call: number;
  }>();

  data.forEach(d => {
    const val = String(d[prop] || 'Desconocido');
    if (!map.has(val)) {
      map.set(val, { 
        count: 0, 
        fechas: new Set(), 
        countHabiles: 0, 
        fechasHabiles: new Set(),
        conTurno: 0,
        bot: 0,
        call: 0
      });
    }
    const entry = map.get(val)!;
    const atenciones = Number(d.atenciones) || 1;
    entry.count += atenciones;

    // Con Turno
    if (d.conTurno !== undefined && d.conTurno !== null && !isNaN(Number(d.conTurno)) && String(d.conTurno).trim() !== '') {
      entry.conTurno += Number(d.conTurno) || 0;
    } else {
      const t = String(d.tipo || '').trim().toLowerCase();
      if (
        t === 'con turno' ||
        t === 'con_turno' ||
        t === 'con-turno' ||
        t === 'programado' ||
        t === 'sobreturno' ||
        t === 'sobre turno' ||
        (t.includes('con turno') || (!t.includes('sin turno') && (t.includes('program') || t.includes('sobre'))))
      ) {
        entry.conTurno += atenciones;
      }
    }

    // BOT
    if (d.canalBot !== undefined && d.canalBot !== null && !isNaN(Number(d.canalBot)) && String(d.canalBot).trim() !== '') {
      entry.bot += Number(d.canalBot) || 0;
    } else if (String(d.anotador || '').toUpperCase().includes('BOT')) {
      entry.bot += atenciones;
    }

    // CALL
    if (d.canalCall !== undefined && d.canalCall !== null && !isNaN(Number(d.canalCall)) && String(d.canalCall).trim() !== '') {
      entry.call += Number(d.canalCall) || 0;
    } else if (String(d.anotador || '').toUpperCase().includes('CALL')) {
      entry.call += atenciones;
    }
    
    if (d.fecha) {
      const dateStr = d.fecha.split('T')[0];
      entry.fechas.add(dateStr);
      
      const dayVal = parseISO(dateStr).getDay();
      if (dayVal >= 1 && dayVal <= 5) {
        entry.countHabiles += atenciones;
        entry.fechasHabiles.add(dateStr);
      }
    }
  });

  const result = Array.from(map.entries()).map(([name, entry]) => {
    const dias = entry.fechas.size;
    const diasHabiles = entry.fechasHabiles.size;
    const prom = dias > 0 ? (entry.count / dias).toFixed(1) : '0.0';
    const prohab = diasHabiles > 0 ? (entry.countHabiles / diasHabiles).toFixed(1) : '0.0';

    // CAPS = Con Turno - BOT - CALL
    const caps = Math.max(0, entry.conTurno - entry.bot - entry.call);

    // Porcentajes calculados con respecto a Con Turno
    const pctCaps = entry.conTurno > 0 ? ((caps / entry.conTurno) * 100).toFixed(1) + '%' : '0.0%';
    const pctBot = entry.conTurno > 0 ? ((entry.bot / entry.conTurno) * 100).toFixed(1) + '%' : '0.0%';
    const pctCall = entry.conTurno > 0 ? ((entry.call / entry.conTurno) * 100).toFixed(1) + '%' : '0.0%';

    return { 
      name, 
      count: entry.count, 
      dias, 
      prom, 
      prohab,
      conTurno: entry.conTurno,
      bot: entry.bot,
      call: entry.call,
      caps,
      pctCaps,
      pctBot,
      pctCall
    };
  });

  result.sort((a, b) => b.count - a.count); // sort desc
  return result;
}

export default function DataTables({ 
  data, 
  profesionales = [], 
  isPrinting = false, 
  activeTab = 'AMBULATORIO',
  setFilters,
}: { 
  data: any[], 
  profesionales?: Profesional[], 
  isPrinting?: boolean, 
  activeTab?: 'AMBULATORIO' | 'GUARDIA',
  setFilters?: React.Dispatch<React.SetStateAction<Filters>>,
}) {
  // --- AMBULATORIO MEMOIZED DATA ---
  const ambCaps = useMemo(() => groupByAmbulatorio(data, 'caps'), [data]);
  const ambDpto = useMemo(() => groupByAmbulatorio(data, 'dpto'), [data]);
  const ambEspecialidad = useMemo(() => groupByAmbulatorio(data, 'especialidad'), [data]);
  const ambProfesional = useMemo(() => groupByAmbulatorio(data, 'profesional'), [data]);
  const ambPacDpto = useMemo(() => groupByAmbulatorio(data, 'pacDpto').filter(x => x.name !== 'Desconocido'), [data]);
  const ambCobertura = useMemo(() => groupByAmbulatorio(data, 'coberturaSocial').filter(x => x.name !== 'Desconocido' && x.name !== 'Sin Cobertura'), [data]);

  const ambAnticipacion = useMemo(() => {
    let enElDia = 0, diaAnterior = 0, enLaSemana = 0, resto = 0;
    let hasNew = false;
    data.forEach(d => {
      if (d.enElDia !== undefined || d.diaAnterior !== undefined || d.enLaSemana !== undefined || d.resto !== undefined) {
        hasNew = true;
        enElDia += Number(d.enElDia) || 0;
        diaAnterior += Number(d.diaAnterior) || 0;
        enLaSemana += Number(d.enLaSemana) || 0;
        resto += Number(d.resto) || 0;
      }
    });
    if (hasNew) {
      const total = enElDia + diaAnterior + enLaSemana + resto;
      return [
        { name: 'En el Día', count: enElDia, pct: total > 0 ? ((enElDia / total) * 100).toFixed(1) + '%' : '0.0%' },
        { name: 'El día anterior', count: diaAnterior, pct: total > 0 ? ((diaAnterior / total) * 100).toFixed(1) + '%' : '0.0%' },
        { name: 'En la Semana', count: enLaSemana, pct: total > 0 ? ((enLaSemana / total) * 100).toFixed(1) + '%' : '0.0%' },
        { name: 'Resto (> 7 días)', count: resto, pct: total > 0 ? ((resto / total) * 100).toFixed(1) + '%' : '0.0%' },
      ];
    }

    const bins = { 'En el Día': 0, 'El día anterior': 0, 'En la Semana': 0, 'Resto (> 7 días)': 0 };
    let hasLegacy = false;
    data.forEach(d => {
      if (d.dias !== undefined && d.dias !== null) {
        hasLegacy = true;
        const dias = Number(d.dias);
        const weight = Number(d.atenciones) || 1;
        if (dias === 0) bins['En el Día'] += weight;
        else if (dias === 1) bins['El día anterior'] += weight;
        else if (dias <= 7) bins['En la Semana'] += weight;
        else bins['Resto (> 7 días)'] += weight;
      }
    });
    if (hasLegacy) {
      const total = Object.values(bins).reduce((a, b) => a + b, 0);
      return Object.entries(bins).map(([name, count]) => ({
        name,
        count,
        pct: total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0.0%'
      }));
    }
    return [];
  }, [data]);

  const guardiaCaps = useMemo(() => groupByAmbulatorio(data, 'caps'), [data]);
  const guardiaProfesional = useMemo(() => groupByAmbulatorio(data, 'profesional'), [data]);
  const guardiaDiagnostico = useMemo(() => groupByAmbulatorio(data, 'diagnostico'), [data]);
  const guardiaCobertura = useMemo(() => groupByAmbulatorio(data, 'cobertura'), [data]);

  // Cross tab remaining for AMBULATORIO view
  const crossTabConfig = useMemo(() => {
    const bins = ['0-18', '18-29', '30-49', '50-64', '65+'];
    const categories = ['F', 'M'];
    
    const matrix: Record<string, Record<string, number>> = {
      '0-18': { F: 0, M: 0, Total: 0 },
      '18-29': { F: 0, M: 0, Total: 0 },
      '30-49': { F: 0, M: 0, Total: 0 },
      '50-64': { F: 0, M: 0, Total: 0 },
      '65+': { F: 0, M: 0, Total: 0 },
    };
    
    const totals: Record<string, number> = { F: 0, M: 0, Total: 0 };

    let hasNewAgeGender = false;
    data.forEach(d => {
      if (d.f_0_18 !== undefined || d.m_0_18 !== undefined) {
        hasNewAgeGender = true;
        const f0 = Number(d.f_0_18) || 0;
        const m0 = Number(d.m_0_18) || 0;
        matrix['0-18'].F += f0;
        matrix['0-18'].M += m0;
        matrix['0-18'].Total += (f0 + m0);

        const f18 = Number(d.f_18_29) || 0;
        const m18 = Number(d.m_18_29) || 0;
        matrix['18-29'].F += f18;
        matrix['18-29'].M += m18;
        matrix['18-29'].Total += (f18 + m18);

        const f30 = Number(d.f_30_49) || 0;
        const m30 = Number(d.m_30_49) || 0;
        matrix['30-49'].F += f30;
        matrix['30-49'].M += m30;
        matrix['30-49'].Total += (f30 + m30);

        const f50 = Number(d.f_50_64) || 0;
        const m50 = Number(d.m_50_64) || 0;
        matrix['50-64'].F += f50;
        matrix['50-64'].M += m50;
        matrix['50-64'].Total += (f50 + m50);

        const f65 = Number(d.f_65_plus) || 0;
        const m65 = Number(d.m_65_plus) || 0;
        matrix['65+'].F += f65;
        matrix['65+'].M += m65;
        matrix['65+'].Total += (f65 + m65);

        totals.F += (f0 + f18 + f30 + f50 + f65);
        totals.M += (m0 + m18 + m30 + m50 + m65);
        totals.Total += (f0 + m0 + f18 + m18 + f30 + m30 + f50 + m50 + f65 + m65);
      }
    });

    if (!hasNewAgeGender) {
      data.forEach(d => {
        let bin = '65+';
        const age = Number(d.edad || 0);
        if (age <= 18) bin = '0-18';
        else if (age <= 29) bin = '18-29';
        else if (age <= 49) bin = '30-49';
        else if (age <= 64) bin = '50-64';

        const val = String(d.sexo || '').trim().toUpperCase();
        const cat = val === 'M' ? 'M' : 'F';
        const weight = Number(d.atenciones) || 1;
        matrix[bin][cat] += weight;
        matrix[bin].Total += weight;
        totals[cat] += weight;
        totals.Total += weight;
      });
    }

    return { 
      matrix, 
      categories, 
      totals, 
      title: "Distribución Edad y Sexo"
    };
  }, [data]);

  if (activeTab === 'GUARDIA') {
    return (
      <div className={cn("flex flex-col gap-2", isPrinting && "h-auto overflow-visible")}>
        <ScrollableTable 
          title="Guardias por CAPS" 
          data={guardiaCaps} 
          col1="CAPS" 
          showKpis={true} 
          isPrinting={isPrinting} 
          onDoubleClickRow={setFilters ? (val) => setFilters(prev => ({ ...prev, caps: [val] })) : undefined}
        />
        <ScrollableTable 
          title="Guardias por Profesional" 
          data={guardiaProfesional} 
          col1="Profesional" 
          showKpis={true} 
          isPrinting={isPrinting} 
          onDoubleClickRow={setFilters ? (val) => setFilters(prev => ({ ...prev, profesional: [val] })) : undefined}
        />
        <ScrollableTable title="Resumen: Diagnóstico" data={guardiaDiagnostico} col1="Diagnóstico" isPrinting={isPrinting} />
        {!isPrinting && (
          <ScrollableTable title="Resumen: Cobertura Social" data={guardiaCobertura} col1="Cobertura" isPrinting={isPrinting} />
        )}
      </div>
    );
  }

  // --- AMBULATORIO LAYOUT (ORIGINAL PRESERVED) ---
  return (
    <div className={cn("flex flex-col gap-2", isPrinting && "h-auto overflow-visible")}>
      <ScrollableTable 
        title="Turnos por CAPS" 
        data={ambCaps} 
        col1="CAPS" 
        showCanales={true} 
        isPrinting={isPrinting} 
        onDoubleClickRow={setFilters ? (val) => setFilters(prev => ({ ...prev, caps: [val] })) : undefined}
      />
      <ScrollableTable 
        title="Turnos por Dpto" 
        data={ambDpto} 
        col1="Departamento" 
        showCanales={true} 
        isPrinting={isPrinting} 
        onDoubleClickRow={setFilters ? (val) => setFilters(prev => ({ ...prev, dpto: [val] })) : undefined}
      />
      <ScrollableTable 
        title="Turnos por Especialidad" 
        data={ambEspecialidad} 
        col1="Especialidad" 
        showCanales={true} 
        isPrinting={isPrinting} 
        maxCharsCol1={20}
        onDoubleClickRow={setFilters ? (val) => setFilters(prev => ({ ...prev, especialidad: [val] })) : undefined}
      />
      <ScrollableTable 
        title="Turnos por Profesional" 
        data={ambProfesional} 
        col1="Profesional" 
        showCanales={true} 
        isPrinting={isPrinting} 
        maxCharsCol1={20}
        onDoubleClickRow={setFilters ? (val) => setFilters(prev => ({ ...prev, profesional: [val] })) : undefined}
      />

      {ambPacDpto.length > 0 && (
        <ScrollableTable title="Resumen: Dpto del Paciente" data={ambPacDpto} col1="Origen (Dpto)" isPrinting={isPrinting} />
      )}
      {ambAnticipacion.length > 0 && (
        <ScrollableTable 
          title="Resumen: Por Anticipación" 
          data={ambAnticipacion} 
          col1="Anticipación" 
          showPct={true} 
          isPrinting={isPrinting} 
        />
      )}
      {!isPrinting && ambCobertura.length > 0 && (
        <ScrollableTable title="Resumen: Cobertura Social" data={ambCobertura} col1="Cobertura" isPrinting={isPrinting} />
      )}
      
      <CrossTabTable crossTabConfig={crossTabConfig} isPrinting={isPrinting} activeTab={activeTab} />
    </div>
  );
}

// Reusable components for AMBULATORIO view
function CrossTabTable({ crossTabConfig, isPrinting = false, activeTab = 'AMBULATORIO' }: { crossTabConfig: any, isPrinting?: boolean, activeTab?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const categories = crossTabConfig.categories;

  const excelData = useMemo(() => {
    const rows: any[] = [];
    Object.entries(crossTabConfig.matrix).forEach(([bin, counts]: [string, any]) => {
      const rowObj: any = { 'Rango de Edad': `${bin} años` };
      categories.forEach((cat: string) => {
        const header = cat === 'F' ? 'Fem' : cat === 'M' ? 'Masc' : cat;
        rowObj[header] = counts[cat] || 0;
      });
      rowObj['Total'] = counts.Total || 0;
      rows.push(rowObj);
    });
    
    // Fila de Totales
    const totalsObj: any = { 'Rango de Edad': 'Totales' };
    categories.forEach((cat: string) => {
      const header = cat === 'F' ? 'Fem' : cat === 'M' ? 'Masc' : cat;
      totalsObj[header] = crossTabConfig.totals[cat] || 0;
    });
    totalsObj['Total'] = crossTabConfig.totals.Total || 0;
    rows.push(totalsObj);

    return rows;
  }, [crossTabConfig, categories]);

  return (
    <div ref={containerRef} className={cn(
      "bg-white border border-slate-200 rounded shadow-sm", 
      isPrinting ? "h-auto overflow-visible mb-1 block" : "flex flex-col h-56 overflow-hidden"
    )}>
      <div className="bg-slate-50 px-2 py-1.5 border-b border-slate-200 flex justify-between items-center shrink-0">
        <h3 className="font-bold uppercase text-[10px] text-slate-500">{crossTabConfig.title}</h3>
        {!isPrinting && (
          <div className="flex items-center gap-1">
            <DownloadExcelButton 
              data={excelData} 
              filename="distribucion-edad-y-sexo" 
              sheetName={crossTabConfig.title || 'Distribución'} 
            />
            <DownloadPdfButton targetRef={containerRef} filename="distribucion-edad-y-sexo" />
          </div>
        )}
      </div>
      <div className={cn(isPrinting ? "w-full overflow-visible h-auto block" : "flex-1 bg-white relative overflow-y-auto custom-scrollbar")}>
        <table className="w-full text-[10px] text-left border-collapse">
          <thead className="sticky top-0 bg-slate-200">
            <tr>
              <th className="px-2 py-1 text-slate-600 font-bold border-b border-slate-300">Rango</th>
              {categories.map((cat: string) => (
                <th key={cat} className="px-2 py-1 text-slate-600 font-bold border-b border-slate-300 text-right truncate max-w-[80px]" title={cat}>
                  {cat === 'F' ? 'Fem' : 'Masc'}
                </th>
              ))}
              <th className="px-2 py-1 text-indigo-700 font-bold border-b border-slate-300 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.entries(crossTabConfig.matrix).map(([bin, counts]) => {
              const c = counts as any;
              return (
                <tr key={bin} className="hover:bg-slate-50">
                  <td className="px-2 py-1 font-medium text-slate-700">{bin} años</td>
                  {categories.map((cat: string) => (
                    <td key={cat} className="px-2 py-1 text-right text-slate-600">
                      {c[cat] || 0}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-bold text-indigo-600">{c.Total}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-100 sticky bottom-0">
            <tr>
              <td className="px-1.5 py-0.5 font-bold text-slate-700">Totales</td>
              {categories.map((cat: string) => (
                <td key={cat} className="px-1.5 py-0.5 text-right font-bold text-slate-700">
                  {crossTabConfig.totals[cat] || 0}
                </td>
              ))}
              <td className="px-1.5 py-0.5 text-right font-bold text-indigo-700">{crossTabConfig.totals.Total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ScrollableTable({ 
  title, 
  data, 
  col1, 
  showKpis = false, 
  showCanales = false,
  showPct = false,
  isPrinting = false,
  onDoubleClickRow,
  maxCharsCol1
}: { 
  title: string, 
  data: {
    name: string, 
    count: number, 
    dias?: number, 
    prom?: string, 
    prohab?: string,
    pctCaps?: string,
    pctBot?: string,
    pctCall?: string,
    conTurno?: number,
    bot?: number,
    call?: number,
    caps?: number,
    pct?: string
  }[], 
  col1: string, 
  showKpis?: boolean, 
  showCanales?: boolean,
  showPct?: boolean,
  isPrinting?: boolean,
  onDoubleClickRow?: (name: string) => void,
  maxCharsCol1?: number
}) {
  const tableRef = useRef<HTMLDivElement>(null);

  const totals = useMemo(() => {
    let count = 0;
    let conTurno = 0;
    let bot = 0;
    let call = 0;
    data.forEach(r => {
      count += Number(r.count) || 0;
      conTurno += Number(r.conTurno) || 0;
      bot += Number(r.bot) || 0;
      call += Number(r.call) || 0;
    });
    const caps = Math.max(0, conTurno - bot - call);
    const pctCaps = conTurno > 0 ? ((caps / conTurno) * 100).toFixed(1) + '%' : '0.0%';
    const pctBot = conTurno > 0 ? ((bot / conTurno) * 100).toFixed(1) + '%' : '0.0%';
    const pctCall = conTurno > 0 ? ((call / conTurno) * 100).toFixed(1) + '%' : '0.0%';
    return { count, conTurno, caps, bot, call, pctCaps, pctBot, pctCall };
  }, [data]);

  const excelData = useMemo(() => {
    return data.map(row => {
      if (showPct) {
        return {
          [col1]: row.name,
          '%': row.pct ?? '0.0%',
          'Cant': row.count
        };
      }
      if (showCanales) {
        return {
          [col1]: row.name,
          'Días': row.dias ?? 0,
          'CAPS': row.pctCaps ?? '0.0%',
          'BOT': row.pctBot ?? '0.0%',
          'CALL': row.pctCall ?? '0.0%',
          'Cant': row.count
        };
      }
      if (showKpis) {
        return {
          [col1]: row.name,
          'Días': row.dias ?? 0,
          'ProHab': row.prohab ?? '0.0',
          'Prom': row.prom ?? '0.0',
          'Cant': row.count
        };
      }
      return {
        [col1]: row.name,
        'Cant': row.count
      };
    });
  }, [data, col1, showKpis, showCanales, showPct]);

  return (
    <div ref={tableRef} className={cn(
      "bg-white border border-slate-200 rounded shadow-sm", 
      isPrinting ? "h-auto overflow-visible mb-1 block" : "flex flex-col h-40 overflow-hidden"
    )}>
      <div className="bg-slate-50 px-2 py-1.5 border-b border-slate-200 flex justify-between items-center shrink-0">
        <h3 className="font-bold uppercase text-[10px] text-slate-500">{title}</h3>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full mr-1">{data.length} filas</span>
          {!isPrinting && (
            <>
              <DownloadExcelButton data={excelData} filename={title.replace(/\s+/g, '-').toLowerCase()} sheetName={title} />
              <DownloadPdfButton targetRef={tableRef} filename={title.replace(/\s+/g, '-').toLowerCase()} />
            </>
          )}
        </div>
      </div>
      <div className={cn(isPrinting ? "w-full overflow-visible h-auto block" : "flex-1 bg-white relative overflow-y-auto custom-scrollbar")}>
        <table className="w-full text-[10px] text-left">
          <thead className="sticky top-0 bg-slate-200 z-10">
            <tr>
              <th className="px-1.5 py-1 font-bold text-slate-600 border-b border-slate-300">{col1}</th>
              {showCanales && <th className="px-1 py-1 font-bold text-slate-600 text-right border-b border-slate-300 w-8">Días</th>}
              {showCanales && <th className="px-1 py-1 font-bold text-indigo-700 text-right border-b border-slate-300 w-12" title="% CAPS sobre Con Turno">CAPS</th>}
              {showCanales && <th className="px-1 py-1 font-bold text-blue-700 text-right border-b border-slate-300 w-12" title="% BOT sobre Con Turno">BOT</th>}
              {showCanales && <th className="px-1 py-1 font-bold text-purple-700 text-right border-b border-slate-300 w-12" title="% CALL sobre Con Turno">CALL</th>}
              {showKpis && !showCanales && <th className="px-2 py-1 font-bold text-slate-600 text-right border-b border-slate-300">Días</th>}
              {showKpis && !showCanales && <th className="px-2 py-1 font-bold text-slate-600 text-right border-b border-slate-300">ProHab</th>}
              {showKpis && !showCanales && <th className="px-2 py-1 font-bold text-slate-600 text-right border-b border-slate-300">Prom</th>}
              {showPct && <th className="px-1.5 py-1 font-bold text-blue-700 text-right border-b border-slate-300 w-14">%</th>}
              <th className="px-1.5 py-1 font-bold text-slate-700 text-right border-b border-slate-300 w-10">Cant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td 
                  className={cn(
                    "px-1.5 py-1 text-slate-700", 
                    isPrinting ? "whitespace-normal break-words font-medium" : "truncate",
                    onDoubleClickRow && "cursor-pointer select-none hover:text-indigo-600 hover:font-bold"
                  )}
                  onDoubleClick={() => onDoubleClickRow?.(row.name)}
                  title={row.name}
                >
                  {maxCharsCol1 && row.name.length > maxCharsCol1 ? row.name.slice(0, maxCharsCol1) : row.name}
                </td>
                {showCanales && <td className="px-1 py-1 text-slate-500 text-right font-mono">{row.dias}</td>}
                {showCanales && <td className="px-1 py-1 text-indigo-700 font-semibold text-right font-mono">{row.pctCaps}</td>}
                {showCanales && <td className="px-1 py-1 text-blue-700 font-semibold text-right font-mono">{row.pctBot}</td>}
                {showCanales && <td className="px-1 py-1 text-purple-700 font-semibold text-right font-mono">{row.pctCall}</td>}
                {showKpis && !showCanales && <td className="px-2 py-1 text-slate-500 text-right">{row.dias}</td>}
                {showKpis && !showCanales && <td className="px-2 py-1 text-slate-500 text-right font-semibold text-slate-700">{row.prohab}</td>}
                {showKpis && !showCanales && <td className="px-2 py-1 text-slate-500 text-right">{row.prom}</td>}
                {showPct && <td className="px-1.5 py-1 text-blue-700 font-semibold text-right font-mono">{row.pct}</td>}
                <td className="px-1.5 py-1 text-slate-700 font-bold text-right font-mono">{row.count}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={showCanales ? 6 : showKpis ? 5 : showPct ? 3 : 2} className="px-4 py-4 text-center text-slate-400 text-xs">Sin datos</td>
              </tr>
            )}
          </tbody>
          {data.length > 0 && (
            <tfoot className="sticky bottom-0 bg-slate-100 font-bold border-t border-slate-300">
              <tr>
                <td className="px-1.5 py-1 text-slate-700 font-bold">Totales</td>
                {showCanales && <td className="px-1 py-1 text-slate-400 text-right font-mono">-</td>}
                {showCanales && <td className="px-1 py-1 text-indigo-700 font-bold text-right font-mono">{totals.pctCaps}</td>}
                {showCanales && <td className="px-1 py-1 text-blue-700 font-bold text-right font-mono">{totals.pctBot}</td>}
                {showCanales && <td className="px-1 py-1 text-purple-700 font-bold text-right font-mono">{totals.pctCall}</td>}
                {showKpis && !showCanales && <td className="px-2 py-1 text-slate-400 text-right font-mono">-</td>}
                {showKpis && !showCanales && <td className="px-2 py-1 text-slate-400 text-right font-mono">-</td>}
                {showKpis && !showCanales && <td className="px-2 py-1 text-slate-400 text-right font-mono">-</td>}
                {showPct && <td className="px-1.5 py-1 text-blue-700 font-bold text-right font-mono">{totals.count > 0 ? '100.0%' : '0.0%'}</td>}
                <td className="px-1.5 py-1 text-slate-900 font-bold text-right font-mono">{totals.count}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

