import React, { useMemo, useState, useRef } from 'react';
import { Profesional, Filters } from '../types';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import DownloadPdfButton from './DownloadPdfButton';
import DownloadExcelButton from './DownloadExcelButton';

interface Props {
  data: any[];
  profesionales?: Profesional[];
  isPrinting?: boolean;
  activeTab?: string;
  setFilters?: React.Dispatch<React.SetStateAction<Filters>>;
}

export default function ProductividadTable({
  data,
  profesionales = [],
  isPrinting = false,
  activeTab = 'AMBULATORIO',
  setFilters,
}: Props) {
  const isGuardia = activeTab === 'GUARDIA';
  const cardRef = useRef<HTMLDivElement>(null);
  const [sortProductividad, setSortProductividad] = useState<{
    field: string;
    order: 'asc' | 'desc';
  }>({ field: 'tot', order: 'desc' });

  const productividad = useMemo(() => {
    if (!data || data.length === 0) return [];

    const profMap = new Map<
      string,
      {
        profesional: string;
        dniPro: string;
        tot: number;
        totHabiles: number;
        conTurno: number;
        sinTurno: number;
        canalCaps: number;
        canalBot: number;
        canalCall: number;
        triageSinAsignar: number;
        triageResucitacion: number;
        triageEmergencia: number;
        triageUrgencia: number;
        triageUrgenciaMenor: number;
        triageSinUrgencia: number;
        triageObito: number;
        fechas: Set<string>;
        fechasHabiles: Set<string>;
      }
    >();

    data.forEach((t) => {
      const name = String(t.profesional || 'Desconocido').trim();
      const dni = String(t.dniPro || '-').trim();
      const key = `${dni}_${name}`;

      if (!profMap.has(key)) {
        profMap.set(key, {
          profesional: name,
          dniPro: dni,
          tot: 0,
          totHabiles: 0,
          conTurno: 0,
          sinTurno: 0,
          canalCaps: 0,
          canalBot: 0,
          canalCall: 0,
          triageSinAsignar: 0,
          triageResucitacion: 0,
          triageEmergencia: 0,
          triageUrgencia: 0,
          triageUrgenciaMenor: 0,
          triageSinUrgencia: 0,
          triageObito: 0,
          fechas: new Set<string>(),
          fechasHabiles: new Set<string>(),
        });
      }

      const p = profMap.get(key)!;
      const atenciones = Number(t.atenciones) || 1;
      p.tot += atenciones;

      if (activeTab === 'GUARDIA') {
        const u = String(t.urgencia || '').trim().toLowerCase();
        if (u.includes('urgencia') || u.includes('emergencia')) {
          p.conTurno += atenciones;
        } else {
          p.sinTurno += atenciones;
        }

        const raw = String(t.nivel || '').trim();
        const lower = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!raw || lower.includes('sin asignar') || lower === 'sin nivel' || lower === 'desconocido' || lower === '-') {
          p.triageSinAsignar += atenciones;
        } else if (lower.includes('resucita')) {
          p.triageResucitacion += atenciones;
        } else if (lower.includes('emergencia')) {
          p.triageEmergencia += atenciones;
        } else if (lower.includes('urgencia menor') || lower.includes('menor')) {
          p.triageUrgenciaMenor += atenciones;
        } else if (lower.includes('sin urgencia') || lower.includes('no urgente')) {
          p.triageSinUrgencia += atenciones;
        } else if (lower === 'urgencia' || lower.includes('urgencia')) {
          p.triageUrgencia += atenciones;
        } else if (lower.includes('obito')) {
          p.triageObito += atenciones;
        } else {
          p.triageSinAsignar += atenciones;
        }
      } else {
        if (t.conTurno !== undefined || t.sinTurno !== undefined) {
          p.conTurno += Number(t.conTurno) || 0;
          p.sinTurno += Number(t.sinTurno) || 0;
        } else {
          const tipo = String(t.tipo || '').toLowerCase();
          if (
            tipo.includes('con turno') ||
            (!tipo.includes('sin turno') && (tipo.includes('program') || tipo.includes('sobre')))
          ) {
            p.conTurno += atenciones;
          } else {
            p.sinTurno += atenciones;
          }
        }

        // Canales BOT, CALL
        if (t.canalBot !== undefined && t.canalBot !== null && !isNaN(Number(t.canalBot)) && String(t.canalBot).trim() !== '') {
          p.canalBot += Number(t.canalBot) || 0;
        } else if (String(t.anotador || '').toUpperCase().includes('BOT')) {
          p.canalBot += atenciones;
        }

        if (t.canalCall !== undefined && t.canalCall !== null && !isNaN(Number(t.canalCall)) && String(t.canalCall).trim() !== '') {
          p.canalCall += Number(t.canalCall) || 0;
        } else if (String(t.anotador || '').toUpperCase().includes('CALL')) {
          p.canalCall += atenciones;
        }
      }

      if (t.fecha) {
        const dayOnly = t.fecha.split('T')[0];
        p.fechas.add(dayOnly);

        try {
          const dayNum = parseISO(dayOnly).getDay();
          if (dayNum >= 1 && dayNum <= 5) {
            p.totHabiles += atenciones;
            p.fechasHabiles.add(dayOnly);
          }
        } catch {}
      }
    });

    const result = Array.from(profMap.values()).map((p) => {
      const proDb = profesionales.find((dbP) => {
        if (!dbP.dniPro || !p.dniPro) return false;
        return dbP.dniPro.trim().toLowerCase() === p.dniPro.trim().toLowerCase();
      });
      const resolvedName = proDb?.profesional || p.profesional;
      const dias = p.fechas.size;
      const diasHabiles = p.fechasHabiles.size;

      // CAPS = Con Turno menos BOT y CALL
      const canalCaps = Math.max(0, p.conTurno - p.canalBot - p.canalCall);
      const pctCaps = p.conTurno > 0 ? Math.round((canalCaps / p.conTurno) * 100) + '%' : '0%';
      const pctBot = p.conTurno > 0 ? Math.round((p.canalBot / p.conTurno) * 100) + '%' : '0%';
      const pctCall = p.conTurno > 0 ? Math.round((p.canalCall / p.conTurno) * 100) + '%' : '0%';

      // Porcentajes de Triage respecto a TOT de cada profesional
      const pctSinAsignar = p.tot > 0 ? Math.round((p.triageSinAsignar / p.tot) * 100) + '%' : '0%';
      const pctResucitacion = p.tot > 0 ? Math.round((p.triageResucitacion / p.tot) * 100) + '%' : '0%';
      const pctEmergencia = p.tot > 0 ? Math.round((p.triageEmergencia / p.tot) * 100) + '%' : '0%';
      const pctUrgencia = p.tot > 0 ? Math.round((p.triageUrgencia / p.tot) * 100) + '%' : '0%';
      const pctUrgenciaMenor = p.tot > 0 ? Math.round((p.triageUrgenciaMenor / p.tot) * 100) + '%' : '0%';
      const pctSinUrgencia = p.tot > 0 ? Math.round((p.triageSinUrgencia / p.tot) * 100) + '%' : '0%';
      const pctObito = p.tot > 0 ? Math.round((p.triageObito / p.tot) * 100) + '%' : '0%';

      return {
        originalProfesional: resolvedName,
        profesional:
          resolvedName.length > 30 ? resolvedName.substring(0, 30) + '...' : resolvedName,
        cargaH: proDb ? proDb.cargaH : '',
        turEsp: proDb ? proDb.turEsp : '',
        prom: dias > 0 ? (p.tot / dias).toFixed(1) : '0.0',
        prohab: isGuardia
          ? (dias > 0 ? String(Math.round(p.tot / dias)) : '0')
          : (diasHabiles > 0 ? (p.totHabiles / diasHabiles).toFixed(1) : '0.0'),
        tot: p.tot,
        canalCaps,
        canalBot: p.canalBot,
        canalCall: p.canalCall,
        pctCaps,
        pctBot,
        pctCall,
        conTurno: p.conTurno,
        sinTurno: p.sinTurno,
        triageSinAsignar: p.triageSinAsignar,
        triageResucitacion: p.triageResucitacion,
        triageEmergencia: p.triageEmergencia,
        triageUrgencia: p.triageUrgencia,
        triageUrgenciaMenor: p.triageUrgenciaMenor,
        triageSinUrgencia: p.triageSinUrgencia,
        triageObito: p.triageObito,
        pctSinAsignar,
        pctResucitacion,
        pctEmergencia,
        pctUrgencia,
        pctUrgenciaMenor,
        pctSinUrgencia,
        pctObito,
        dias: dias,
        diasHabiles: diasHabiles,
      };
    });

    result.sort((a, b) => {
      let valA: any = (a as any)[sortProductividad.field];
      let valB: any = (b as any)[sortProductividad.field];

      if (sortProductividad.field === 'profesional') {
        valA = a.originalProfesional;
        valB = b.originalProfesional;
      }

      const isNumericField = [
        'cargaH',
        'turEsp',
        'prom',
        'prohab',
        'tot',
        'canalCaps',
        'canalBot',
        'canalCall',
        'conTurno',
        'sinTurno',
        'triageSinAsignar',
        'triageResucitacion',
        'triageEmergencia',
        'triageUrgencia',
        'triageUrgenciaMenor',
        'triageSinUrgencia',
        'triageObito',
        'dias',
      ].includes(sortProductividad.field);

      if (isNumericField) {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortProductividad.order === 'asc' ? -1 : 1;
      if (valA > valB) return sortProductividad.order === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, profesionales, sortProductividad, activeTab, isGuardia]);

  const totals = useMemo(() => {
    let tot = 0;
    let canalCaps = 0;
    let canalBot = 0;
    let canalCall = 0;
    let conTurno = 0;
    let sinTurno = 0;
    let sumProhab = 0;
    let countProhab = 0;
    let triageSinAsignar = 0;
    let triageResucitacion = 0;
    let triageEmergencia = 0;
    let triageUrgencia = 0;
    let triageUrgenciaMenor = 0;
    let triageSinUrgencia = 0;
    let triageObito = 0;

    productividad.forEach((p) => {
      tot += p.tot;
      canalCaps += p.canalCaps;
      canalBot += p.canalBot;
      canalCall += p.canalCall;
      conTurno += p.conTurno;
      sinTurno += p.sinTurno;
      triageSinAsignar += p.triageSinAsignar || 0;
      triageResucitacion += p.triageResucitacion || 0;
      triageEmergencia += p.triageEmergencia || 0;
      triageUrgencia += p.triageUrgencia || 0;
      triageUrgenciaMenor += p.triageUrgenciaMenor || 0;
      triageSinUrgencia += p.triageSinUrgencia || 0;
      triageObito += p.triageObito || 0;
      const numProhab = parseFloat(p.prohab);
      if (!isNaN(numProhab) && numProhab > 0) {
        sumProhab += numProhab;
        countProhab++;
      }
    });

    const avgProhab = countProhab > 0
      ? (isGuardia ? String(Math.round(sumProhab / countProhab)) : (sumProhab / countProhab).toFixed(1))
      : (isGuardia ? '0' : '0.0');
    const pctCaps = conTurno > 0 ? Math.round((canalCaps / conTurno) * 100) + '%' : '0%';
    const pctBot = conTurno > 0 ? Math.round((canalBot / conTurno) * 100) + '%' : '0%';
    const pctCall = conTurno > 0 ? Math.round((canalCall / conTurno) * 100) + '%' : '0%';
    const pctTotSinAsignar = tot > 0 ? Math.round((triageSinAsignar / tot) * 100) + '%' : '0%';
    const pctTotResucitacion = tot > 0 ? Math.round((triageResucitacion / tot) * 100) + '%' : '0%';
    const pctTotEmergencia = tot > 0 ? Math.round((triageEmergencia / tot) * 100) + '%' : '0%';
    const pctTotUrgencia = tot > 0 ? Math.round((triageUrgencia / tot) * 100) + '%' : '0%';
    const pctTotUrgenciaMenor = tot > 0 ? Math.round((triageUrgenciaMenor / tot) * 100) + '%' : '0%';
    const pctTotSinUrgencia = tot > 0 ? Math.round((triageSinUrgencia / tot) * 100) + '%' : '0%';
    const pctTotObito = tot > 0 ? Math.round((triageObito / tot) * 100) + '%' : '0%';

    return {
      count: productividad.length,
      tot,
      canalCaps,
      canalBot,
      canalCall,
      pctCaps,
      pctBot,
      pctCall,
      conTurno,
      sinTurno,
      avgProhab,
      triageSinAsignar,
      triageResucitacion,
      triageEmergencia,
      triageUrgencia,
      triageUrgenciaMenor,
      triageSinUrgencia,
      triageObito,
      pctSinAsignar: pctTotSinAsignar,
      pctResucitacion: pctTotResucitacion,
      pctEmergencia: pctTotEmergencia,
      pctUrgencia: pctTotUrgencia,
      pctUrgenciaMenor: pctTotUrgenciaMenor,
      pctSinUrgencia: pctTotSinUrgencia,
      pctObito: pctTotObito,
    };
  }, [productividad, isGuardia]);

  const productividadExcelData = useMemo(() => {
    if (isGuardia) {
      return productividad.map((p) => ({
        Profesional: p.originalProfesional,
        ATEDIA: p.prohab || '0',
        Tot: p.tot || 0,
        'Sin Asi.': `${p.triageSinAsignar} (${p.pctSinAsignar})`,
        'Resu.': `${p.triageResucitacion} (${p.pctResucitacion})`,
        'Emer.': `${p.triageEmergencia} (${p.pctEmergencia})`,
        'Urg.': `${p.triageUrgencia} (${p.pctUrgencia})`,
        'Urg. M.': `${p.triageUrgenciaMenor} (${p.pctUrgenciaMenor})`,
        'Sin Urg.': `${p.triageSinUrgencia} (${p.pctSinUrgencia})`,
        Obito: `${p.triageObito} (${p.pctObito})`,
        Días: p.dias || 0,
      }));
    }
    return productividad.map((p) => ({
      Profesional: p.originalProfesional,
      CargaH: p.cargaH || '',
      TurEsp: p.turEsp || '',
      ATEDIA: p.prohab || '0.0',
      Tot: p.tot || 0,
      CAPS: `${p.canalCaps} (${p.pctCaps})`,
      BOT: `${p.canalBot} (${p.pctBot})`,
      CALL: `${p.canalCall} (${p.pctCall})`,
      'Con Turno': p.conTurno || 0,
      'Sin Turno': p.sinTurno || 0,
      Días: p.dias || 0,
    }));
  }, [productividad, isGuardia]);

  const toggleSort = (field: string) => {
    setSortProductividad((prev) => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (field: string) => {
    if (sortProductividad.field !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-400 group-hover:text-slate-600 inline" />;
    }
    return sortProductividad.order === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 text-blue-600 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-blue-600 inline" />
    );
  };

  const getAtediaStyle = (prohab: any, turEsp: any) => {
    if (!turEsp || String(turEsp).trim() === '') return 'text-slate-700';
    const prohabVal = parseFloat(prohab);
    const turEspVal = parseFloat(turEsp);
    if (isNaN(prohabVal) || isNaN(turEspVal)) return 'text-slate-700';
    if (prohabVal >= turEspVal) {
      return 'bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold';
    } else if (prohabVal >= turEspVal * 0.75) {
      return 'bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold';
    } else {
      return 'bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold';
    }
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'w-full bg-white border border-slate-200 rounded p-2.5 shadow-xs',
        isPrinting ? 'h-auto overflow-visible block' : 'flex flex-col'
      )}
    >
      <div className="flex justify-between items-center mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wide">
            {isGuardia ? 'Atenciones por profesional' : 'Productividad por Profesional'}
          </h3>
          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
            {totals.count} profesionales
          </span>
        </div>
        {!isPrinting && (
          <div className="flex items-center gap-1.5">
            <DownloadExcelButton
              data={productividadExcelData}
              filename={isGuardia ? 'atenciones-por-profesional' : 'productividad-por-profesional'}
              sheetName={isGuardia ? 'Atenciones' : 'Productividad'}
            />
            <DownloadPdfButton
              targetRef={cardRef}
              filename={isGuardia ? 'atenciones-por-profesional' : 'productividad-por-profesional'}
            />
          </div>
        )}
      </div>

      <div
        className={cn(
          'w-full border border-slate-200 rounded-md overflow-x-auto',
          isPrinting ? 'h-auto overflow-visible' : 'max-h-[260px] overflow-y-auto custom-scrollbar'
        )}
      >
        <table className={cn('w-full text-left border-collapse', isGuardia ? 'min-w-[920px]' : 'min-w-[850px]')}>
          <thead className="bg-slate-100 text-[10px] uppercase font-semibold text-slate-600 sticky top-0 z-10 shadow-xs">
            {isGuardia ? (
              <>
                <tr>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors align-bottom"
                    onClick={() => toggleSort('profesional')}
                  >
                    <div className="flex items-center">
                      Profesional
                      {getSortIcon('profesional')}
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right w-20 align-bottom"
                    onClick={() => toggleSort('prohab')}
                  >
                    <div className="flex items-center justify-end">
                      ATEDIA
                      {getSortIcon('prohab')}
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-indigo-100 bg-indigo-50/50 select-none group transition-colors text-right w-20 font-bold text-indigo-900 align-bottom"
                    onClick={() => toggleSort('tot')}
                  >
                    <div className="flex items-center justify-end">
                      TOT
                      {getSortIcon('tot')}
                    </div>
                  </th>
                  <th
                    colSpan={7}
                    className="py-1 px-2 border-b border-indigo-200 bg-indigo-100/70 text-center text-[10px] font-bold text-indigo-900 tracking-wider"
                  >
                    Nivel de Triage
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right w-16 align-bottom"
                    onClick={() => toggleSort('dias')}
                  >
                    <div className="flex items-center justify-end">
                      Días
                      {getSortIcon('dias')}
                    </div>
                  </th>
                </tr>
                <tr>
                  <th
                    className="py-1.5 px-2 border-b border-slate-200 cursor-pointer hover:bg-slate-200 bg-slate-50 select-none group transition-colors text-right min-w-[70px] text-slate-700"
                    onClick={() => toggleSort('triageSinAsignar')}
                  >
                    <div className="flex items-center justify-end">
                      Sin Asi.
                      {getSortIcon('triageSinAsignar')}
                    </div>
                  </th>
                  <th
                    className="py-1.5 px-2 border-b border-slate-200 cursor-pointer hover:bg-rose-100 bg-rose-50/40 select-none group transition-colors text-right min-w-[70px] text-rose-900"
                    onClick={() => toggleSort('triageResucitacion')}
                  >
                    <div className="flex items-center justify-end">
                      Resu.
                      {getSortIcon('triageResucitacion')}
                    </div>
                  </th>
                  <th
                    className="py-1.5 px-2 border-b border-slate-200 cursor-pointer hover:bg-amber-100 bg-amber-50/40 select-none group transition-colors text-right min-w-[70px] text-amber-900"
                    onClick={() => toggleSort('triageEmergencia')}
                  >
                    <div className="flex items-center justify-end">
                      Emer.
                      {getSortIcon('triageEmergencia')}
                    </div>
                  </th>
                  <th
                    className="py-1.5 px-2 border-b border-slate-200 cursor-pointer hover:bg-yellow-100 bg-yellow-50/40 select-none group transition-colors text-right min-w-[70px] text-yellow-900"
                    onClick={() => toggleSort('triageUrgencia')}
                  >
                    <div className="flex items-center justify-end">
                      Urg.
                      {getSortIcon('triageUrgencia')}
                    </div>
                  </th>
                  <th
                    className="py-1.5 px-2 border-b border-slate-200 cursor-pointer hover:bg-emerald-100 bg-emerald-50/40 select-none group transition-colors text-right min-w-[75px] text-emerald-900"
                    onClick={() => toggleSort('triageUrgenciaMenor')}
                  >
                    <div className="flex items-center justify-end">
                      Urg. M.
                      {getSortIcon('triageUrgenciaMenor')}
                    </div>
                  </th>
                  <th
                    className="py-1.5 px-2 border-b border-slate-200 cursor-pointer hover:bg-blue-100 bg-blue-50/40 select-none group transition-colors text-right min-w-[75px] text-blue-900"
                    onClick={() => toggleSort('triageSinUrgencia')}
                  >
                    <div className="flex items-center justify-end">
                      Sin Urg.
                      {getSortIcon('triageSinUrgencia')}
                    </div>
                  </th>
                  <th
                    className="py-1.5 px-2 border-b border-slate-200 cursor-pointer hover:bg-slate-200 bg-slate-100/50 select-none group transition-colors text-right min-w-[70px] text-slate-800"
                    onClick={() => toggleSort('triageObito')}
                  >
                    <div className="flex items-center justify-end">
                      Obito
                      {getSortIcon('triageObito')}
                    </div>
                  </th>
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors align-bottom"
                    onClick={() => toggleSort('profesional')}
                  >
                    <div className="flex items-center">
                      Profesional
                      {getSortIcon('profesional')}
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-center w-16 align-bottom"
                    onClick={() => toggleSort('cargaH')}
                  >
                    <div className="flex items-center justify-center">
                      CargaH
                      {getSortIcon('cargaH')}
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-center w-20 align-bottom"
                    onClick={() => toggleSort('turEsp')}
                  >
                    <div className="flex items-center justify-center">
                      TurEsp
                      {getSortIcon('turEsp')}
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right w-20 align-bottom"
                    onClick={() => toggleSort('prohab')}
                  >
                    <div className="flex items-center justify-end">
                      ATEDIA
                      {getSortIcon('prohab')}
                    </div>
                  </th>
                  {/* TOT MOVIDO LUEGO DE ATEDIA */}
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-indigo-100 bg-indigo-50/50 select-none group transition-colors text-right w-20 font-bold text-indigo-900 align-bottom"
                    onClick={() => toggleSort('tot')}
                  >
                    <div className="flex items-center justify-end">
                      TOT
                      {getSortIcon('tot')}
                    </div>
                  </th>
                  {/* TITULO ARRIBA QUE ABARCA LAS TRES CON LABEL PROGRAMADOS */}
                  <th
                    colSpan={3}
                    className="py-1 px-2 border-b border-indigo-200 bg-indigo-100/70 text-center text-[10px] font-bold text-indigo-900 tracking-wider"
                  >
                    Programados
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right w-24 align-bottom"
                    onClick={() => toggleSort('conTurno')}
                  >
                    <div className="flex items-center justify-end">
                      Con Turno
                      {getSortIcon('conTurno')}
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right w-24 align-bottom"
                    onClick={() => toggleSort('sinTurno')}
                  >
                    <div className="flex items-center justify-end">
                      Sin Turno
                      {getSortIcon('sinTurno')}
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right w-16 align-bottom"
                    onClick={() => toggleSort('dias')}
                  >
                    <div className="flex items-center justify-end">
                      Días
                      {getSortIcon('dias')}
                    </div>
                  </th>
                </tr>
                <tr>
                  <th
                    className="py-1.5 px-2 border-b border-slate-200 cursor-pointer hover:bg-emerald-100 bg-emerald-50/40 select-none group transition-colors text-right min-w-[76px] text-emerald-900"
                    onClick={() => toggleSort('canalCaps')}
                  >
                    <div className="flex items-center justify-end">
                      CAPS
                      {getSortIcon('canalCaps')}
                    </div>
                  </th>
                  <th
                    className="py-1.5 px-2 border-b border-slate-200 cursor-pointer hover:bg-blue-100 bg-blue-50/40 select-none group transition-colors text-right min-w-[76px] text-blue-900"
                    onClick={() => toggleSort('canalBot')}
                  >
                    <div className="flex items-center justify-end">
                      BOT
                      {getSortIcon('canalBot')}
                    </div>
                  </th>
                  <th
                    className="py-1.5 px-2 border-b border-slate-200 cursor-pointer hover:bg-purple-100 bg-purple-50/40 select-none group transition-colors text-right min-w-[76px] text-purple-900"
                    onClick={() => toggleSort('canalCall')}
                  >
                    <div className="flex items-center justify-end">
                      CALL
                      {getSortIcon('canalCall')}
                    </div>
                  </th>
                </tr>
              </>
            )}
          </thead>
          <tbody className="text-xs divide-y divide-slate-100 bg-white">
            {productividad.map((p, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td
                  className={cn(
                    'py-1.5 px-3 font-medium text-slate-800 whitespace-nowrap',
                    setFilters && 'cursor-pointer select-none hover:text-indigo-600 hover:font-bold'
                  )}
                  onDoubleClick={() => {
                    if (setFilters) {
                      setFilters((prev) => ({ ...prev, profesional: [p.originalProfesional] }));
                    }
                  }}
                  title={
                    setFilters
                      ? `Doble click para filtrar solo ${p.originalProfesional}`
                      : p.originalProfesional
                  }
                >
                  {p.profesional}
                </td>
                {!isGuardia && (
                  <>
                    <td className="py-1.5 px-3 text-slate-600 text-center font-mono">
                      {p.cargaH || '-'}
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 text-center font-mono truncate max-w-[120px]">
                      {p.turEsp || '-'}
                    </td>
                  </>
                )}
                <td className="py-1.5 px-3 text-right font-mono">
                  <span className={getAtediaStyle(p.prohab, p.turEsp)}>{p.prohab}</span>
                </td>
                {/* TOT LUEGO DE ATEDIA */}
                <td className="py-1.5 px-3 text-indigo-700 font-bold text-right font-mono bg-indigo-50/20">
                  {p.tot}
                </td>
                {isGuardia ? (
                  <>
                    {/* 7 Columnas de Triage luego de TOT */}
                    <td className="py-1.5 px-2 text-slate-700 font-medium text-right font-mono bg-slate-50/30 whitespace-nowrap">
                      <span>{p.triageSinAsignar}</span>
                      <span className="text-[10px] text-slate-500 font-semibold ml-1">({p.pctSinAsignar})</span>
                    </td>
                    <td className="py-1.5 px-2 text-rose-800 font-medium text-right font-mono bg-rose-50/20 whitespace-nowrap">
                      <span className="font-bold">{p.triageResucitacion}</span>
                      <span className="text-[10px] text-rose-600 font-semibold ml-1">({p.pctResucitacion})</span>
                    </td>
                    <td className="py-1.5 px-2 text-amber-800 font-medium text-right font-mono bg-amber-50/20 whitespace-nowrap">
                      <span className="font-bold">{p.triageEmergencia}</span>
                      <span className="text-[10px] text-amber-600 font-semibold ml-1">({p.pctEmergencia})</span>
                    </td>
                    <td className="py-1.5 px-2 text-yellow-800 font-medium text-right font-mono bg-yellow-50/20 whitespace-nowrap">
                      <span className="font-bold">{p.triageUrgencia}</span>
                      <span className="text-[10px] text-yellow-600 font-semibold ml-1">({p.pctUrgencia})</span>
                    </td>
                    <td className="py-1.5 px-2 text-emerald-800 font-medium text-right font-mono bg-emerald-50/20 whitespace-nowrap">
                      <span className="font-bold">{p.triageUrgenciaMenor}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold ml-1">({p.pctUrgenciaMenor})</span>
                    </td>
                    <td className="py-1.5 px-2 text-blue-800 font-medium text-right font-mono bg-blue-50/20 whitespace-nowrap">
                      <span className="font-bold">{p.triageSinUrgencia}</span>
                      <span className="text-[10px] text-blue-600 font-semibold ml-1">({p.pctSinUrgencia})</span>
                    </td>
                    <td className="py-1.5 px-2 text-slate-800 font-medium text-right font-mono bg-slate-50/50 whitespace-nowrap">
                      <span className="font-bold">{p.triageObito}</span>
                      <span className="text-[10px] text-slate-600 font-semibold ml-1">({p.pctObito})</span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-1.5 px-2.5 text-emerald-800 font-medium text-right font-mono bg-emerald-50/20 whitespace-nowrap">
                      <span className="font-bold">{p.canalCaps}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold ml-1">({p.pctCaps})</span>
                    </td>
                    <td className="py-1.5 px-2.5 text-blue-800 font-medium text-right font-mono bg-blue-50/20 whitespace-nowrap">
                      <span className="font-bold">{p.canalBot}</span>
                      <span className="text-[10px] text-blue-600 font-semibold ml-1">({p.pctBot})</span>
                    </td>
                    <td className="py-1.5 px-2.5 text-purple-800 font-medium text-right font-mono bg-purple-50/20 whitespace-nowrap">
                      <span className="font-bold">{p.canalCall}</span>
                      <span className="text-[10px] text-purple-600 font-semibold ml-1">({p.pctCall})</span>
                    </td>
                    <td className="py-1.5 px-3 text-teal-700 font-medium text-right font-mono">
                      {p.conTurno}
                    </td>
                    <td className="py-1.5 px-3 text-amber-700 font-medium text-right font-mono">
                      {p.sinTurno}
                    </td>
                  </>
                )}
                <td className="py-1.5 px-3 text-slate-500 text-right font-mono">
                  {p.dias}
                </td>
              </tr>
            ))}
            {productividad.length === 0 && (
              <tr>
                <td colSpan={11} className="py-6 text-center text-slate-400">
                  No hay datos para mostrar
                </td>
              </tr>
            )}
          </tbody>
          {productividad.length > 0 && (
            <tfoot className="bg-slate-100/90 text-xs font-semibold text-slate-700 border-t-2 border-slate-300 sticky bottom-0">
              <tr>
                <td className="py-2 px-3 font-bold">TOTAL ({totals.count} Pro)</td>
                {!isGuardia && (
                  <>
                    <td className="py-2 px-3 text-center">-</td>
                    <td className="py-2 px-3 text-center">-</td>
                  </>
                )}
                <td className="py-2 px-3 text-right font-mono text-slate-600 font-bold" title="Promedio ATEDIA">
                  {totals.avgProhab}
                </td>
                <td className="py-2 px-3 text-right font-mono text-indigo-700 font-bold bg-indigo-100/40">
                  {totals.tot}
                </td>
                {isGuardia ? (
                  <>
                    <td className="py-2 px-2 text-right font-mono text-slate-700 font-bold bg-slate-100/40 whitespace-nowrap">
                      <span>{totals.triageSinAsignar}</span>
                      <span className="text-[10px] font-semibold ml-1">({totals.pctSinAsignar})</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-rose-800 font-bold bg-rose-100/40 whitespace-nowrap">
                      <span>{totals.triageResucitacion}</span>
                      <span className="text-[10px] font-semibold ml-1">({totals.pctResucitacion})</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-amber-800 font-bold bg-amber-100/40 whitespace-nowrap">
                      <span>{totals.triageEmergencia}</span>
                      <span className="text-[10px] font-semibold ml-1">({totals.pctEmergencia})</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-yellow-800 font-bold bg-yellow-100/40 whitespace-nowrap">
                      <span>{totals.triageUrgencia}</span>
                      <span className="text-[10px] font-semibold ml-1">({totals.pctUrgencia})</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-800 font-bold bg-emerald-100/40 whitespace-nowrap">
                      <span>{totals.triageUrgenciaMenor}</span>
                      <span className="text-[10px] font-semibold ml-1">({totals.pctUrgenciaMenor})</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-blue-800 font-bold bg-blue-100/40 whitespace-nowrap">
                      <span>{totals.triageSinUrgencia}</span>
                      <span className="text-[10px] font-semibold ml-1">({totals.pctSinUrgencia})</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-800 font-bold bg-slate-100/60 whitespace-nowrap">
                      <span>{totals.triageObito}</span>
                      <span className="text-[10px] font-semibold ml-1">({totals.pctObito})</span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-2.5 text-right font-mono text-emerald-800 font-bold bg-emerald-100/40 whitespace-nowrap">
                      <span>{totals.canalCaps}</span>
                      <span className="text-[10px] font-semibold ml-1">({totals.pctCaps})</span>
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-blue-800 font-bold bg-blue-100/40 whitespace-nowrap">
                      <span>{totals.canalBot}</span>
                      <span className="text-[10px] font-semibold ml-1">({totals.pctBot})</span>
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-purple-800 font-bold bg-purple-100/40 whitespace-nowrap">
                      <span>{totals.canalCall}</span>
                      <span className="text-[10px] font-semibold ml-1">({totals.pctCall})</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-teal-800 font-bold">
                      {totals.conTurno}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-amber-800 font-bold">
                      {totals.sinTurno}
                    </td>
                  </>
                )}
                <td className="py-2 px-3 text-right font-mono text-slate-600">-</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
