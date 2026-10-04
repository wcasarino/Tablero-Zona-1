import React, { useMemo, useRef } from 'react';
import { Turno, Profesional, Filters } from '../types';
import DownloadPdfButton from './DownloadPdfButton';
import DownloadExcelButton from './DownloadExcelButton';
import { cn } from '../lib/utils';
import { parseISO } from 'date-fns';

function groupByAmbulatorio(data: any[], prop: string) {
  const map = new Map<string, { count: number, fechas: Set<string>, countHabiles: number, fechasHabiles: Set<string> }>();
  data.forEach(d => {
    const val = String(d[prop] || 'Desconocido');
    if (!map.has(val)) {
      map.set(val, { count: 0, fechas: new Set(), countHabiles: 0, fechasHabiles: new Set() });
    }
    const entry = map.get(val)!;
    entry.count += 1;
    
    if (d.fecha) {
      const dateStr = d.fecha.split('T')[0];
      entry.fechas.add(dateStr);
      
      const dayVal = parseISO(dateStr).getDay();
      if (dayVal >= 1 && dayVal <= 5) {
        entry.countHabiles += 1;
        entry.fechasHabiles.add(dateStr);
      }
    }
  });
  const result = Array.from(map.entries()).map(([name, entry]) => {
    const dias = entry.fechas.size;
    const diasHabiles = entry.fechasHabiles.size;
    const prom = dias > 0 ? (entry.count / dias).toFixed(1) : '0.0';
    const prohab = diasHabiles > 0 ? (entry.countHabiles / diasHabiles).toFixed(1) : '0.0';
    return { name, count: entry.count, dias, prom, prohab };
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
  const ambPacDpto = useMemo(() => groupByAmbulatorio(data, 'pacDpto'), [data]);
  const ambCobertura = useMemo(() => groupByAmbulatorio(data, 'coberturaSocial'), [data]);

  const guardiaCaps = useMemo(() => groupByAmbulatorio(data, 'caps'), [data]);
  const guardiaProfesional = useMemo(() => groupByAmbulatorio(data, 'profesional'), [data]);
  const guardiaDiagnostico = useMemo(() => groupByAmbulatorio(data, 'diagnostico'), [data]);
  const guardiaCobertura = useMemo(() => groupByAmbulatorio(data, 'cobertura'), [data]);

  // Cross tab remaining for AMBULATORIO view
  const crossTabConfig = useMemo(() => {
    const bins = ['0-18', '18-29', '30-49', '50-64', '65+'];
    const uniqueValues = Array.from(new Set(data.map(d => String(d.sexo || '').trim()))).filter(Boolean);
    const countsOfValues = new Map<string, number>();
    data.forEach(d => {
      const v = String(d.sexo || '').trim();
      if (v) countsOfValues.set(v, (countsOfValues.get(v) || 0) + 1);
    });
    
    let categories = Array.from(countsOfValues.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 2);
      
    if (categories.length === 0) {
      categories = ['F', 'M'];
    } else if (categories.length === 1) {
      categories.push(categories[0] === 'F' ? 'M' : 'F');
    }
    
    const matrix: Record<string, Record<string, number>> = {};
    bins.forEach(b => {
      matrix[b] = {};
      categories.forEach(cat => { matrix[b][cat] = 0; });
      matrix[b].Total = 0;
    });
    
    const totals: Record<string, number> = {};
    categories.forEach(cat => { totals[cat] = 0; });
    totals.Total = 0;

    data.forEach(d => {
      let bin = '65+';
      const age = Number(d.edad || 0);
      if (age <= 18) bin = '0-18';
      else if (age <= 29) bin = '18-29';
      else if (age <= 49) bin = '30-49';
      else if (age <= 64) bin = '50-64';

      const val = String(d.sexo || '').trim();
      const matchedCat = categories.find(cat => cat.toLowerCase() === val.toLowerCase());
      
      if (matchedCat) {
        matrix[bin][matchedCat]++;
        matrix[bin].Total++;
        totals[matchedCat]++;
        totals.Total++;
      }
    });

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
        showKpis={true} 
        isPrinting={isPrinting} 
        onDoubleClickRow={setFilters ? (val) => setFilters(prev => ({ ...prev, caps: [val] })) : undefined}
      />
      <ScrollableTable 
        title="Turnos por Dpto" 
        data={ambDpto} 
        col1="Departamento" 
        showKpis={true} 
        isPrinting={isPrinting} 
        onDoubleClickRow={setFilters ? (val) => setFilters(prev => ({ ...prev, dpto: [val] })) : undefined}
      />
      <ScrollableTable 
        title="Turnos por Especialidad" 
        data={ambEspecialidad} 
        col1="Especialidad" 
        showKpis={true} 
        isPrinting={isPrinting} 
        onDoubleClickRow={setFilters ? (val) => setFilters(prev => ({ ...prev, especialidad: [val] })) : undefined}
      />
      <ScrollableTable 
        title="Turnos por Profesional" 
        data={ambProfesional} 
        col1="Profesional" 
        showKpis={true} 
        isPrinting={isPrinting} 
        onDoubleClickRow={setFilters ? (val) => setFilters(prev => ({ ...prev, profesional: [val] })) : undefined}
      />

      <ScrollableTable title="Resumen: Dpto del Paciente" data={ambPacDpto} col1="Origen (Dpto)" isPrinting={isPrinting} />
      {!isPrinting && (
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
  isPrinting = false,
  onDoubleClickRow
}: { 
  title: string, 
  data: {name: string, count: number, dias?: number, prom?: string, prohab?: string}[], 
  col1: string, 
  showKpis?: boolean, 
  isPrinting?: boolean,
  onDoubleClickRow?: (name: string) => void
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const excelData = useMemo(() => {
    return data.map(row => {
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
  }, [data, col1, showKpis]);

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
              <th className="px-2 py-1 font-bold text-slate-600 border-b border-slate-300">{col1}</th>
              {showKpis && <th className="px-2 py-1 font-bold text-slate-600 text-right border-b border-slate-300">Días</th>}
              {showKpis && <th className="px-2 py-1 font-bold text-slate-600 text-right border-b border-slate-300">ProHab</th>}
              {showKpis && <th className="px-2 py-1 font-bold text-slate-600 text-right border-b border-slate-300">Prom</th>}
              <th className="px-2 py-1 font-bold text-slate-600 text-right border-b border-slate-300">Cant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td 
                  className={cn(
                    "px-2 py-1 text-slate-700", 
                    isPrinting ? "whitespace-normal break-words font-medium" : "truncate",
                    onDoubleClickRow && "cursor-pointer select-none hover:text-indigo-600 hover:font-bold"
                  )}
                  onDoubleClick={() => onDoubleClickRow?.(row.name)}
                  title={onDoubleClickRow ? `Doble click para seleccionar solo ${row.name}` : undefined}
                >
                  {row.name}
                </td>
                {showKpis && <td className="px-2 py-1 text-slate-500 text-right">{row.dias}</td>}
                {showKpis && <td className="px-2 py-1 text-slate-500 text-right font-semibold text-slate-700">{row.prohab}</td>}
                {showKpis && <td className="px-2 py-1 text-slate-500 text-right">{row.prom}</td>}
                <td className="px-2 py-1 text-slate-600 font-bold text-right">{row.count}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={showKpis ? 5 : 2} className="px-4 py-4 text-center text-slate-400 text-xs">Sin datos</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

