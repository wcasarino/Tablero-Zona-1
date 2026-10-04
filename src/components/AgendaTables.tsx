import React, { useState, useMemo } from 'react';
import { Agenda, Profesional } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Search, Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  data: Agenda[];
  profesionales?: Profesional[];
  isPrinting?: boolean;
}

const fmt5 = (t: number = 0, h: number = 0, b: number = 0, c: number = 0, w: number = 0) =>
  `${t || 0}/${h || 0}/${b || 0}/${c || 0}/${w || 0}`;

const DAY_ORDER: Record<string, number> = {
  'LUNES': 1,
  'LUN': 1,
  'MARTES': 2,
  'MAR': 2,
  'MIERCOLES': 3,
  'MIÉRCOLES': 3,
  'MIE': 3,
  'MIÉ': 3,
  'JUEVES': 4,
  'JUE': 4,
  'VIERNES': 5,
  'VIE': 5,
  'SABADO': 6,
  'SÁBADO': 6,
  'SAB': 6,
  'SÁB': 6,
  'DOMINGO': 7,
  'DOM': 7
};

function getDayOrder(dia: string): number {
  const clean = String(dia || '').trim().toUpperCase();
  const normalized = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return DAY_ORDER[clean] || DAY_ORDER[normalized] || 99;
}

function createEmptyAccumulator() {
  return {
    agendas: 0,
    progD: 0,
    progDTod: 0,
    progDHos: 0,
    progDBot: 0,
    progDCall: 0,
    progDWid: 0,
    progT: 0,
    otorgT: 0,
    dispoT: 0,
    progTTod: 0,
    progTHos: 0,
    progTBot: 0,
    progTCall: 0,
    progTWid: 0,
    otorgTTod: 0,
    otorgTHos: 0,
    otorgTBot: 0,
    otorgTCall: 0,
    otorgTWid: 0,
    dispoTTod: 0,
    dispoTHos: 0,
    dispoTBot: 0,
    dispoTCall: 0,
    dispoTWid: 0,
  };
}

function accumulateAgenda(target: ReturnType<typeof createEmptyAccumulator>, item: Agenda) {
  target.agendas += 1;
  target.progD += item.progD || 0;
  target.progDTod += item.progDTod || 0;
  target.progDHos += item.progDHos || 0;
  target.progDBot += item.progDBot || 0;
  target.progDCall += item.progDCall || 0;
  target.progDWid += item.progDWid || 0;

  target.progT += item.progT || 0;
  target.otorgT += item.otorgT || 0;
  target.dispoT += item.dispoT || 0;

  target.progTTod += item.progTTod || 0;
  target.progTHos += item.progTHos || 0;
  target.progTBot += item.progTBot || 0;
  target.progTCall += item.progTCall || 0;
  target.progTWid += item.progTWid || 0;

  target.otorgTTod += item.otorgTTod || 0;
  target.otorgTHos += item.otorgTHos || 0;
  target.otorgTBot += item.otorgTBot || 0;
  target.otorgTCall += item.otorgTCall || 0;
  target.otorgTWid += item.otorgTWid || 0;

  target.dispoTTod += item.dispoTTod || 0;
  target.dispoTHos += item.dispoTHos || 0;
  target.dispoTBot += item.dispoTBot || 0;
  target.dispoTCall += item.dispoTCall || 0;
  target.dispoTWid += item.dispoTWid || 0;
}

export default function AgendaTables({ data, profesionales = [], isPrinting = false }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'detalle' | 'especialidad' | 'caps' | 'dia'>('detalle');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Build lookup map: dniPro -> cargaH from profesionales collection
  const profMap = useMemo(() => {
    const map = new Map<string, string>();
    profesionales.forEach(p => {
      const key = String(p.dniPro || p.id || '').trim();
      if (key) {
        const val = String(p.cargaH ?? '-').trim();
        map.set(key, val);
        map.set(key.toLowerCase(), val);
      }
    });
    return map;
  }, [profesionales]);

  const getCargaH = (dniPro?: string): string => {
    if (!dniPro) return '-';
    const clean = String(dniPro).trim();
    return profMap.get(clean) || profMap.get(clean.toLowerCase()) || '-';
  };

  // Sorting state
  const [sortField, setSortField] = useState<string>('progT');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="w-2.5 h-2.5 opacity-40 ml-1 inline" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-2.5 h-2.5 text-blue-600 ml-1 inline" /> 
      : <ArrowDown className="w-2.5 h-2.5 text-blue-600 ml-1 inline" />;
  };

  // 1. Detalle Data
  const filteredDetalle = useMemo(() => {
    let result = [...data];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item =>
        item.dpto.toLowerCase().includes(q) ||
        item.caps.toLowerCase().includes(q) ||
        item.especialidad.toLowerCase().includes(q) ||
        item.profesional.toLowerCase().includes(q) ||
        item.diaSemana.toLowerCase().includes(q) ||
        (item.dniPro && item.dniPro.toLowerCase().includes(q)) ||
        getCargaH(item.dniPro).toLowerCase().includes(q)
      );
    }

    result.sort((a: any, b: any) => {
      if (sortField === 'ocupPct') {
        const pctA = a.progT > 0 ? a.otorgT / a.progT : 0;
        const pctB = b.progT > 0 ? b.otorgT / b.progT : 0;
        return sortDirection === 'asc' ? pctA - pctB : pctB - pctA;
      }
      if (sortField === 'diaSemana') {
        const orderA = getDayOrder(a.diaSemana);
        const orderB = getDayOrder(b.diaSemana);
        return sortDirection === 'asc' ? orderA - orderB : orderB - orderA;
      }
      if (sortField === 'cargaH') {
        const valAStr = getCargaH(a.dniPro);
        const valBStr = getCargaH(b.dniPro);
        const numA = parseFloat(valAStr);
        const numB = parseFloat(valBStr);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        return sortDirection === 'asc' ? valAStr.localeCompare(valBStr) : valBStr.localeCompare(valAStr);
      }
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return result;
  }, [data, searchQuery, sortField, sortDirection, profMap]);

  // 2. Resumen por Especialidad
  const especialidadSummary = useMemo(() => {
    const map = new Map<string, { especialidad: string } & ReturnType<typeof createEmptyAccumulator>>();

    data.forEach(item => {
      const esp = String(item.especialidad || 'Sin Especialidad').trim();
      let current = map.get(esp);
      if (!current) {
        current = {
          especialidad: esp,
          ...createEmptyAccumulator()
        };
        map.set(esp, current);
      }
      accumulateAgenda(current, item);
    });

    return Array.from(map.values()).sort((a, b) => b.progT - a.progT);
  }, [data]);

  // 3. Resumen por CAPS
  const capsSummary = useMemo(() => {
    const map = new Map<string, {
      caps: string;
      dpto: string;
      profesionales: Set<string>;
    } & ReturnType<typeof createEmptyAccumulator>>();

    data.forEach(item => {
      const c = String(item.caps || 'Sin CAPS').trim();
      let current = map.get(c);
      if (!current) {
        current = {
          caps: c,
          dpto: item.dpto || '',
          profesionales: new Set<string>(),
          ...createEmptyAccumulator()
        };
        map.set(c, current);
      }
      if (item.profesional) current.profesionales.add(item.profesional);
      accumulateAgenda(current, item);
    });

    return Array.from(map.values())
      .map(item => ({
        ...item,
        totalProfesionales: item.profesionales.size
      }))
      .sort((a, b) => b.progT - a.progT);
  }, [data]);

  // 4. Resumen por Día
  const diaSummary = useMemo(() => {
    const map = new Map<string, { dia: string } & ReturnType<typeof createEmptyAccumulator>>();

    data.forEach(item => {
      const d = String(item.diaSemana || 'Sin Día').trim().toUpperCase();
      let current = map.get(d);
      if (!current) {
        current = {
          dia: d,
          ...createEmptyAccumulator()
        };
        map.set(d, current);
      }
      accumulateAgenda(current, item);
    });

    return Array.from(map.values()).sort((a, b) => {
      const orderA = getDayOrder(a.dia);
      const orderB = getDayOrder(b.dia);
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return b.progT - a.progT;
    });
  }, [data]);

  // Pagination for detalle
  const totalPages = Math.ceil(filteredDetalle.length / pageSize) || 1;
  const paginatedDetalle = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDetalle.slice(start, start + pageSize);
  }, [filteredDetalle, currentPage, pageSize]);

  // Export handlers
  const exportDetalleExcel = () => {
    const rows = filteredDetalle.map(item => ({
      'DPTO': item.dpto,
      'CAPS': item.caps,
      'Especialidad': item.especialidad,
      'Profesional': item.profesional,
      'DNI Profesional': item.dniPro,
      'Día Semana': item.diaSemana,
      'CargaH': getCargaH(item.dniPro),
      'Ventana (días)': item.ventana,
      // Grupo Diario
      'Diario PROG': item.progD,
      'Diario PROG (T/H/B/C/W)': fmt5(item.progDTod, item.progDHos, item.progDBot, item.progDCall, item.progDWid),
      // Grupo Total
      'Total PROG': item.progT,
      'Total OTORG': item.otorgT,
      'Total DISPO': item.dispoT,
      'Total %OCUP': item.progT > 0 ? `${((item.otorgT / item.progT) * 100).toFixed(1)}%` : '0%',
      'Total PROG (T/H/B/C/W)': fmt5(item.progTTod, item.progTHos, item.progTBot, item.progTCall, item.progTWid),
      'Total OTORG (T/H/B/C/W)': fmt5(item.otorgTTod, item.otorgTHos, item.otorgTBot, item.otorgTCall, item.otorgTWid),
      'Total DISPO (T/H/B/C/W)': fmt5(item.dispoTTod, item.dispoTHos, item.dispoTBot, item.dispoTCall, item.dispoTWid),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle Agendas');
    XLSX.writeFile(wb, `detalle-agendas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportDetallePDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(13);
    doc.text('Detalle de Agendas Programadas', 14, 14);
    doc.setFontSize(8);
    doc.text(`Total registros: ${filteredDetalle.length}`, 14, 19);

    autoTable(doc, {
      startY: 23,
      head: [
        [
          { content: 'DPTO', rowSpan: 2 },
          { content: 'CAPS', rowSpan: 2 },
          { content: 'Especialidad', rowSpan: 2 },
          { content: 'Profesional', rowSpan: 2 },
          { content: 'Día', rowSpan: 2 },
          { content: 'CargaH', rowSpan: 2 },
          { content: 'Vent.', rowSpan: 2 },
          { content: 'DIARIO', colSpan: 2, styles: { halign: 'center', fillColor: [245, 158, 11] } },
          { content: 'TOTAL', colSpan: 7, styles: { halign: 'center', fillColor: [37, 99, 235] } }
        ],
        [
          'PROG', 'PROG(T/H/B/C/W)',
          'PROG', 'OTORG', 'DISPO', '%OCUP',
          'PROG(T/H/B/C/W)', 'OTORG(T/H/B/C/W)', 'DISPO(T/H/B/C/W)'
        ]
      ],
      body: filteredDetalle.slice(0, 150).map(item => [
        item.dpto,
        item.caps,
        item.especialidad,
        item.profesional,
        item.diaSemana,
        getCargaH(item.dniPro),
        `${item.ventana}d`,
        item.progD,
        fmt5(item.progDTod, item.progDHos, item.progDBot, item.progDCall, item.progDWid),
        item.progT,
        item.otorgT,
        item.dispoT,
        item.progT > 0 ? `${((item.otorgT / item.progT) * 100).toFixed(0)}%` : '0%',
        fmt5(item.progTTod, item.progTHos, item.progTBot, item.progTCall, item.progTWid),
        fmt5(item.otorgTTod, item.otorgTHos, item.otorgTBot, item.otorgTCall, item.otorgTWid),
        fmt5(item.dispoTTod, item.dispoTHos, item.dispoTBot, item.dispoTCall, item.dispoTWid)
      ]),
      styles: { fontSize: 6, cellPadding: 1 },
      headStyles: { fillColor: [51, 65, 85] },
    });

    doc.save(`detalle-agendas-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportCurrentSummaryExcel = () => {
    let rows: any[] = [];
    let sheetName = 'Resumen';

    if (activeSubTab === 'especialidad') {
      sheetName = 'Por Especialidad';
      rows = especialidadSummary.map(e => ({
        'Especialidad': e.especialidad,
        'Agendas': e.agendas,
        'Diario PROG': e.progD,
        'Diario PROG (T/H/B/C/W)': fmt5(e.progDTod, e.progDHos, e.progDBot, e.progDCall, e.progDWid),
        'Total PROG': e.progT,
        'Total OTORG': e.otorgT,
        'Total DISPO': e.dispoT,
        'Total %OCUP': e.progT > 0 ? `${((e.otorgT / e.progT) * 100).toFixed(1)}%` : '0%',
        'Total PROG (T/H/B/C/W)': fmt5(e.progTTod, e.progTHos, e.progTBot, e.progTCall, e.progTWid),
        'Total OTORG (T/H/B/C/W)': fmt5(e.otorgTTod, e.otorgTHos, e.otorgTBot, e.otorgTCall, e.otorgTWid),
        'Total DISPO (T/H/B/C/W)': fmt5(e.dispoTTod, e.dispoTHos, e.dispoTBot, e.dispoTCall, e.dispoTWid),
      }));
    } else if (activeSubTab === 'caps') {
      sheetName = 'Por CAPS';
      rows = capsSummary.map(c => ({
        'CAPS': c.caps,
        'DPTO': c.dpto,
        'Médicos': c.totalProfesionales,
        'Agendas': c.agendas,
        'Diario PROG': c.progD,
        'Diario PROG (T/H/B/C/W)': fmt5(c.progDTod, c.progDHos, c.progDBot, c.progDCall, c.progDWid),
        'Total PROG': c.progT,
        'Total OTORG': c.otorgT,
        'Total DISPO': c.dispoT,
        'Total %OCUP': c.progT > 0 ? `${((c.otorgT / c.progT) * 100).toFixed(1)}%` : '0%',
        'Total PROG (T/H/B/C/W)': fmt5(c.progTTod, c.progTHos, c.progTBot, c.progTCall, c.progTWid),
        'Total OTORG (T/H/B/C/W)': fmt5(c.otorgTTod, c.otorgTHos, c.otorgTBot, c.otorgTCall, c.otorgTWid),
        'Total DISPO (T/H/B/C/W)': fmt5(c.dispoTTod, c.dispoTHos, c.dispoTBot, c.dispoTCall, c.dispoTWid),
      }));
    } else if (activeSubTab === 'dia') {
      sheetName = 'Por Día Semana';
      rows = diaSummary.map(d => ({
        'Día Semana': d.dia,
        'Agendas': d.agendas,
        'Diario PROG': d.progD,
        'Diario PROG (T/H/B/C/W)': fmt5(d.progDTod, d.progDHos, d.progDBot, d.progDCall, d.progDWid),
        'Total PROG': d.progT,
        'Total OTORG': d.otorgT,
        'Total DISPO': d.dispoT,
        'Total %OCUP': d.progT > 0 ? `${((d.otorgT / d.progT) * 100).toFixed(1)}%` : '0%',
        'Total PROG (T/H/B/C/W)': fmt5(d.progTTod, d.progTHos, d.progTBot, d.progTCall, d.progTWid),
        'Total OTORG (T/H/B/C/W)': fmt5(d.otorgTTod, d.otorgTHos, d.otorgTBot, d.otorgTCall, d.otorgTWid),
        'Total DISPO (T/H/B/C/W)': fmt5(d.dispoTTod, d.dispoTHos, d.dispoTBot, d.dispoTCall, d.dispoTWid),
      }));
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `resumen-${sheetName.toLowerCase().replace(/\s+/g, '-')}.xlsx`);
  };

  return (
    <div className="bg-white rounded border border-slate-200 shadow-xs flex flex-col overflow-hidden">
      {/* Header con Sub-Pestañas */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-slate-200/80 p-0.5 rounded">
          <button
            onClick={() => { setActiveSubTab('detalle'); setCurrentPage(1); }}
            className={cn(
              "px-2.5 py-1 text-xs font-bold rounded transition-all",
              activeSubTab === 'detalle'
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Detalle Agendas ({filteredDetalle.length})
          </button>
          <button
            onClick={() => { setActiveSubTab('especialidad'); setCurrentPage(1); }}
            className={cn(
              "px-2.5 py-1 text-xs font-bold rounded transition-all",
              activeSubTab === 'especialidad'
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Por Especialidad ({especialidadSummary.length})
          </button>
          <button
            onClick={() => { setActiveSubTab('caps'); setCurrentPage(1); }}
            className={cn(
              "px-2.5 py-1 text-xs font-bold rounded transition-all",
              activeSubTab === 'caps'
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Por CAPS ({capsSummary.length})
          </button>
          <button
            onClick={() => { setActiveSubTab('dia'); setCurrentPage(1); }}
            className={cn(
              "px-2.5 py-1 text-xs font-bold rounded transition-all",
              activeSubTab === 'dia'
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Por Día Semana ({diaSummary.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'detalle' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar médico, CAPS, esp..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-8 pr-2.5 py-1 text-[11px] border border-slate-200 rounded bg-white w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          <button
            onClick={activeSubTab === 'detalle' ? exportDetalleExcel : exportCurrentSummaryExcel}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-2.5 py-1 rounded transition-colors"
            title="Exportar a Excel"
          >
            <Download className="w-3 h-3" /> Excel
          </button>

          {activeSubTab === 'detalle' && (
            <button
              onClick={exportDetallePDF}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold px-2.5 py-1 rounded transition-colors"
              title="Exportar a PDF"
            >
              <Download className="w-3 h-3" /> PDF
            </button>
          )}
        </div>
      </div>

      {/* Contenido según la subpestaña */}
      <div className="overflow-x-auto">
        {activeSubTab === 'detalle' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {/* Nivel 1: Agrupación */}
              <tr className="bg-slate-100/90 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                <th rowSpan={2} onClick={() => handleSort('dpto')} className="p-2 cursor-pointer hover:bg-slate-200/60 border-r border-slate-200 align-bottom">
                  DPTO {renderSortIcon('dpto')}
                </th>
                <th rowSpan={2} onClick={() => handleSort('caps')} className="p-2 cursor-pointer hover:bg-slate-200/60 border-r border-slate-200 align-bottom">
                  CAPS {renderSortIcon('caps')}
                </th>
                <th rowSpan={2} onClick={() => handleSort('especialidad')} className="p-2 cursor-pointer hover:bg-slate-200/60 border-r border-slate-200 align-bottom">
                  Especialidad {renderSortIcon('especialidad')}
                </th>
                <th rowSpan={2} onClick={() => handleSort('profesional')} className="p-2 cursor-pointer hover:bg-slate-200/60 border-r border-slate-200 align-bottom">
                  Profesional {renderSortIcon('profesional')}
                </th>
                <th rowSpan={2} onClick={() => handleSort('diaSemana')} className="p-2 cursor-pointer hover:bg-slate-200/60 text-center border-r border-slate-200 align-bottom">
                  Día {renderSortIcon('diaSemana')}
                </th>
                <th rowSpan={2} onClick={() => handleSort('cargaH')} className="p-2 cursor-pointer hover:bg-slate-200/60 text-center border-r border-slate-200 align-bottom" title="Carga Horaria">
                  CargaH {renderSortIcon('cargaH')}
                </th>
                <th rowSpan={2} onClick={() => handleSort('ventana')} className="p-2 cursor-pointer hover:bg-slate-200/60 text-center border-r border-slate-200 align-bottom">
                  Ventana {renderSortIcon('ventana')}
                </th>
                
                {/* Grupo: Diario */}
                <th colSpan={2} className="p-1.5 text-center bg-amber-100/80 text-amber-900 border-r border-amber-200 font-extrabold tracking-wider">
                  GRUPO: DIARIO
                </th>

                {/* Grupo: Total */}
                <th colSpan={7} className="p-1.5 text-center bg-blue-100/80 text-blue-900 font-extrabold tracking-wider">
                  GRUPO: TOTAL
                </th>
              </tr>

              {/* Nivel 2: Columnas de cada Grupo */}
              <tr className="bg-slate-50 text-[9px] uppercase font-bold tracking-wider border-b border-slate-200">
                {/* Diario subcolumnas */}
                <th onClick={() => handleSort('progD')} className="p-2 cursor-pointer hover:bg-amber-50 text-right text-amber-950">
                  PROG {renderSortIcon('progD')}
                </th>
                <th className="p-2 text-center text-amber-950 border-r border-amber-200" title="ProgDTod / ProgDHos / ProgDBot / ProgDCall / ProgDWid">
                  PROG (T/H/B/C/W)
                </th>

                {/* Total subcolumnas */}
                <th onClick={() => handleSort('progT')} className="p-2 cursor-pointer hover:bg-blue-50 text-right text-blue-950">
                  PROG {renderSortIcon('progT')}
                </th>
                <th onClick={() => handleSort('otorgT')} className="p-2 cursor-pointer hover:bg-emerald-50 text-right text-emerald-950">
                  OTORG {renderSortIcon('otorgT')}
                </th>
                <th onClick={() => handleSort('dispoT')} className="p-2 cursor-pointer hover:bg-amber-50 text-right text-amber-950">
                  DISPO {renderSortIcon('dispoT')}
                </th>
                <th onClick={() => handleSort('ocupPct')} className="p-2 cursor-pointer hover:bg-slate-200 text-center text-slate-900">
                  %OCUP {renderSortIcon('ocupPct')}
                </th>
                <th className="p-2 text-center text-slate-700" title="ProgTTod / ProgTHos / ProgTBot / ProgTCall / ProgTWid">
                  PROG (T/H/B/C/W)
                </th>
                <th className="p-2 text-center text-slate-700" title="OtorgTTod / OtorgTHos / OtorgTBot / OtorgTCall / OtorgTWid">
                  OTORG (T/H/B/C/W)
                </th>
                <th className="p-2 text-center text-slate-700" title="DispoTTod / DispoTHos / DispoTBot / DispoTCall / DispoTWid">
                  DISPO (T/H/B/C/W)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {paginatedDetalle.length === 0 ? (
                <tr>
                  <td colSpan={16} className="p-6 text-center text-slate-400 italic">
                    No se encontraron registros de agenda para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedDetalle.map(item => {
                  const ocupPct = item.progT > 0 ? (item.otorgT / item.progT) * 100 : 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 font-medium text-slate-900 border-r border-slate-100">{item.dpto}</td>
                      <td className="p-2 text-slate-700 border-r border-slate-100">{item.caps}</td>
                      <td className="p-2 font-medium text-blue-900 border-r border-slate-100">{item.especialidad}</td>
                      <td className="p-2 text-slate-800 border-r border-slate-100">{item.profesional || item.dniPro}</td>
                      <td className="p-2 text-center border-r border-slate-100">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-700">
                          {item.diaSemana}
                        </span>
                      </td>
                      <td className="p-2 text-center font-mono text-slate-700 font-semibold border-r border-slate-100">
                        {getCargaH(item.dniPro)}
                      </td>
                      <td className="p-2 text-center font-mono text-slate-600 border-r border-slate-200">{item.ventana}d</td>
                      
                      {/* Diario Data */}
                      <td className="p-2 text-right font-bold text-amber-700 bg-amber-50/20">{item.progD}</td>
                      <td className="p-2 text-center text-[10px] text-amber-900 font-mono bg-amber-50/20 border-r border-amber-200">
                        {fmt5(item.progDTod, item.progDHos, item.progDBot, item.progDCall, item.progDWid)}
                      </td>

                      {/* Total Data */}
                      <td className="p-2 text-right font-bold text-blue-600">{item.progT}</td>
                      <td className="p-2 text-right font-bold text-emerald-600">{item.otorgT}</td>
                      <td className="p-2 text-right font-bold text-amber-600">{item.dispoT}</td>
                      <td className="p-2 text-center font-bold">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px]",
                          ocupPct >= 80 ? "bg-emerald-100 text-emerald-800" :
                          ocupPct >= 50 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                        )}>
                          {ocupPct.toFixed(0)}%
                        </span>
                      </td>
                      <td className="p-2 text-center text-[10px] text-slate-600 font-mono">
                        {fmt5(item.progTTod, item.progTHos, item.progTBot, item.progTCall, item.progTWid)}
                      </td>
                      <td className="p-2 text-center text-[10px] text-slate-600 font-mono">
                        {fmt5(item.otorgTTod, item.otorgTHos, item.otorgTBot, item.otorgTCall, item.otorgTWid)}
                      </td>
                      <td className="p-2 text-center text-[10px] text-slate-600 font-mono">
                        {fmt5(item.dispoTTod, item.dispoTHos, item.dispoTBot, item.dispoTCall, item.dispoTWid)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeSubTab === 'especialidad' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                <th rowSpan={2} className="p-2 border-r border-slate-200 align-bottom">Especialidad</th>
                <th rowSpan={2} className="p-2 text-center border-r border-slate-200 align-bottom">Agendas</th>
                <th colSpan={2} className="p-1.5 text-center bg-amber-100/80 text-amber-900 border-r border-amber-200 font-extrabold tracking-wider">
                  GRUPO: DIARIO
                </th>
                <th colSpan={7} className="p-1.5 text-center bg-blue-100/80 text-blue-900 font-extrabold tracking-wider">
                  GRUPO: TOTAL
                </th>
              </tr>
              <tr className="bg-slate-50 text-[9px] uppercase font-bold tracking-wider border-b border-slate-200">
                <th className="p-2 text-right text-amber-950">PROG</th>
                <th className="p-2 text-center text-amber-950 border-r border-amber-200">PROG (T/H/B/C/W)</th>
                <th className="p-2 text-right text-blue-950">PROG</th>
                <th className="p-2 text-right text-emerald-950">OTORG</th>
                <th className="p-2 text-right text-amber-950">DISPO</th>
                <th className="p-2 text-center text-slate-900">%OCUP</th>
                <th className="p-2 text-center text-slate-700">PROG (T/H/B/C/W)</th>
                <th className="p-2 text-center text-slate-700">OTORG (T/H/B/C/W)</th>
                <th className="p-2 text-center text-slate-700">DISPO (T/H/B/C/W)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {especialidadSummary.map((e, idx) => {
                const ocup = e.progT > 0 ? (e.otorgT / e.progT) * 100 : 0;
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 font-bold text-slate-900 border-r border-slate-100">{e.especialidad}</td>
                    <td className="p-2 text-center font-mono text-slate-600 border-r border-slate-200">{e.agendas}</td>
                    <td className="p-2 text-right font-mono font-bold text-amber-700 bg-amber-50/20">{e.progD.toLocaleString()}</td>
                    <td className="p-2 text-center font-mono text-[10px] text-amber-900 bg-amber-50/20 border-r border-amber-200">
                      {fmt5(e.progDTod, e.progDHos, e.progDBot, e.progDCall, e.progDWid)}
                    </td>
                    <td className="p-2 text-right font-bold text-blue-600">{e.progT.toLocaleString()}</td>
                    <td className="p-2 text-right font-bold text-emerald-600">{e.otorgT.toLocaleString()}</td>
                    <td className="p-2 text-right font-bold text-amber-600">{e.dispoT.toLocaleString()}</td>
                    <td className="p-2 text-center">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                        ocup >= 80 ? "bg-emerald-100 text-emerald-800" :
                        ocup >= 50 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                      )}>
                        {ocup.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                      {fmt5(e.progTTod, e.progTHos, e.progTBot, e.progTCall, e.progTWid)}
                    </td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                      {fmt5(e.otorgTTod, e.otorgTHos, e.otorgTBot, e.otorgTCall, e.otorgTWid)}
                    </td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                      {fmt5(e.dispoTTod, e.dispoTHos, e.dispoTBot, e.dispoTCall, e.dispoTWid)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeSubTab === 'caps' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                <th rowSpan={2} className="p-2 border-r border-slate-200 align-bottom">CAPS</th>
                <th rowSpan={2} className="p-2 border-r border-slate-200 align-bottom">DPTO</th>
                <th rowSpan={2} className="p-2 text-center border-r border-slate-200 align-bottom">Médicos</th>
                <th rowSpan={2} className="p-2 text-center border-r border-slate-200 align-bottom">Agendas</th>
                <th colSpan={2} className="p-1.5 text-center bg-amber-100/80 text-amber-900 border-r border-amber-200 font-extrabold tracking-wider">
                  GRUPO: DIARIO
                </th>
                <th colSpan={7} className="p-1.5 text-center bg-blue-100/80 text-blue-900 font-extrabold tracking-wider">
                  GRUPO: TOTAL
                </th>
              </tr>
              <tr className="bg-slate-50 text-[9px] uppercase font-bold tracking-wider border-b border-slate-200">
                <th className="p-2 text-right text-amber-950">PROG</th>
                <th className="p-2 text-center text-amber-950 border-r border-amber-200">PROG (T/H/B/C/W)</th>
                <th className="p-2 text-right text-blue-950">PROG</th>
                <th className="p-2 text-right text-emerald-950">OTORG</th>
                <th className="p-2 text-right text-amber-950">DISPO</th>
                <th className="p-2 text-center text-slate-900">%OCUP</th>
                <th className="p-2 text-center text-slate-700">PROG (T/H/B/C/W)</th>
                <th className="p-2 text-center text-slate-700">OTORG (T/H/B/C/W)</th>
                <th className="p-2 text-center text-slate-700">DISPO (T/H/B/C/W)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {capsSummary.map((c, idx) => {
                const ocup = c.progT > 0 ? (c.otorgT / c.progT) * 100 : 0;
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 font-bold text-slate-900 border-r border-slate-100">{c.caps}</td>
                    <td className="p-2 text-slate-600 border-r border-slate-100">{c.dpto}</td>
                    <td className="p-2 text-center font-mono border-r border-slate-100">{c.totalProfesionales}</td>
                    <td className="p-2 text-center font-mono text-slate-600 border-r border-slate-200">{c.agendas}</td>
                    <td className="p-2 text-right font-mono font-bold text-amber-700 bg-amber-50/20">{c.progD.toLocaleString()}</td>
                    <td className="p-2 text-center font-mono text-[10px] text-amber-900 bg-amber-50/20 border-r border-amber-200">
                      {fmt5(c.progDTod, c.progDHos, c.progDBot, c.progDCall, c.progDWid)}
                    </td>
                    <td className="p-2 text-right font-bold text-blue-600">{c.progT.toLocaleString()}</td>
                    <td className="p-2 text-right font-bold text-emerald-600">{c.otorgT.toLocaleString()}</td>
                    <td className="p-2 text-right font-bold text-amber-600">{c.dispoT.toLocaleString()}</td>
                    <td className="p-2 text-center">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                        ocup >= 80 ? "bg-emerald-100 text-emerald-800" :
                        ocup >= 50 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                      )}>
                        {ocup.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                      {fmt5(c.progTTod, c.progTHos, c.progTBot, c.progTCall, c.progTWid)}
                    </td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                      {fmt5(c.otorgTTod, c.otorgTHos, c.otorgTBot, c.otorgTCall, c.otorgTWid)}
                    </td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                      {fmt5(c.dispoTTod, c.dispoTHos, c.dispoTBot, c.dispoTCall, c.dispoTWid)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeSubTab === 'dia' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                <th rowSpan={2} className="p-2 border-r border-slate-200 align-bottom">Día de la Semana</th>
                <th rowSpan={2} className="p-2 text-center border-r border-slate-200 align-bottom">Agendas</th>
                <th colSpan={2} className="p-1.5 text-center bg-amber-100/80 text-amber-900 border-r border-amber-200 font-extrabold tracking-wider">
                  GRUPO: DIARIO
                </th>
                <th colSpan={7} className="p-1.5 text-center bg-blue-100/80 text-blue-900 font-extrabold tracking-wider">
                  GRUPO: TOTAL
                </th>
              </tr>
              <tr className="bg-slate-50 text-[9px] uppercase font-bold tracking-wider border-b border-slate-200">
                <th className="p-2 text-right text-amber-950">PROG</th>
                <th className="p-2 text-center text-amber-950 border-r border-amber-200">PROG (T/H/B/C/W)</th>
                <th className="p-2 text-right text-blue-950">PROG</th>
                <th className="p-2 text-right text-emerald-950">OTORG</th>
                <th className="p-2 text-right text-amber-950">DISPO</th>
                <th className="p-2 text-center text-slate-900">%OCUP</th>
                <th className="p-2 text-center text-slate-700">PROG (T/H/B/C/W)</th>
                <th className="p-2 text-center text-slate-700">OTORG (T/H/B/C/W)</th>
                <th className="p-2 text-center text-slate-700">DISPO (T/H/B/C/W)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {diaSummary.map((d, idx) => {
                const ocup = d.progT > 0 ? (d.otorgT / d.progT) * 100 : 0;
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 font-bold text-slate-900 border-r border-slate-100">{d.dia}</td>
                    <td className="p-2 text-center font-mono text-slate-600 border-r border-slate-200">{d.agendas}</td>
                    <td className="p-2 text-right font-mono font-bold text-amber-700 bg-amber-50/20">{d.progD.toLocaleString()}</td>
                    <td className="p-2 text-center font-mono text-[10px] text-amber-900 bg-amber-50/20 border-r border-amber-200">
                      {fmt5(d.progDTod, d.progDHos, d.progDBot, d.progDCall, d.progDWid)}
                    </td>
                    <td className="p-2 text-right font-bold text-blue-600">{d.progT.toLocaleString()}</td>
                    <td className="p-2 text-right font-bold text-emerald-600">{d.otorgT.toLocaleString()}</td>
                    <td className="p-2 text-right font-bold text-amber-600">{d.dispoT.toLocaleString()}</td>
                    <td className="p-2 text-center">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                        ocup >= 80 ? "bg-emerald-100 text-emerald-800" :
                        ocup >= 50 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                      )}>
                        {ocup.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                      {fmt5(d.progTTod, d.progTHos, d.progTBot, d.progTCall, d.progTWid)}
                    </td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                      {fmt5(d.otorgTTod, d.otorgTHos, d.otorgTBot, d.otorgTCall, d.otorgTWid)}
                    </td>
                    <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                      {fmt5(d.dispoTTod, d.dispoTHos, d.dispoTBot, d.dispoTCall, d.dispoTWid)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación para detalle */}
      {activeSubTab === 'detalle' && totalPages > 1 && (
        <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Página <span className="font-bold">{currentPage}</span> de <span className="font-bold">{totalPages}</span> ({filteredDetalle.length} registros)
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
