import React, { useMemo, useRef } from "react";
import { Turno, Profesional, Filters } from "../types";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { startOfWeek, format, parseISO } from "date-fns";
import { cn } from "../lib/utils";
import DownloadPdfButton from "./DownloadPdfButton";
import DownloadExcelButton from "./DownloadExcelButton";

const COLORS = [
  "#3b82f6", // Azul
  "#10b981", // Verde
  "#f59e0b", // Amarillo/Naranja
  "#ef4444", // Rojo
  "#8b5cf6", // Violeta
  "#06b6d4", // Celeste
  "#f97316", // Naranja fuerte
  "#ec4899", // Rosado
  "#14b8a6", // Trullo
  "#6366f1"  // Indigo
];

interface ContainerProps {
  children: React.ReactElement;
  height: number;
  isPrinting: boolean;
  width?: number;
}

function PrintOptimizedContainer({
  children,
  height,
  isPrinting,
  width = 760,
}: ContainerProps) {
  if (isPrinting) {
    return (
      <div
        style={{ width: "100%", height: `${height}px` }}
        className="flex justify-center items-center bg-white overflow-visible"
      >
        {React.cloneElement(children, { width, height })}
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}

function countByProperty(data: any[], prop: string, sortDesc = true) {
  const map = new Map<string, number>();
  data.forEach((d) => {
    const val = String(d[prop] || 'Desconocido');
    map.set(val, (map.get(val) || 0) + 1);
  });
  const result = Array.from(map.entries()).map(([name, count]) => ({
    name,
    count,
  }));
  if (sortDesc) result.sort((a, b) => b.count - a.count);
  return result;
}

const normalizeToYyyyMmDd = (val: string): string | null => {
  if (!val) return null;
  const trimmed = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes('T')) return trimmed.split('T')[0];
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  const dateObj = parseISO(trimmed);
  if (!isNaN(dateObj.getTime())) {
    return format(dateObj, 'yyyy-MM-dd');
  }
  return null;
};

export default function ChartsOverview({
  data,
  profesionales = [],
  isPrinting = false,
  activeTab = "AMBULATORIO",
  setFilters,
}: {
  data: any[];
  profesionales?: Profesional[];
  isPrinting?: boolean;
  activeTab?: "AMBULATORIO" | "GUARDIA";
  setFilters?: React.Dispatch<React.SetStateAction<Filters>>;
}) {
  const handleChartDoubleClick = (stateOrData: any) => {
    if (!setFilters) return;
    let rawDate: string | null = null;
    if (stateOrData?.activePayload && stateOrData.activePayload.length > 0) {
      const payload = stateOrData.activePayload[0].payload;
      rawDate = payload?.sortKey || payload?.name || null;
    } else if (stateOrData) {
      rawDate = stateOrData.sortKey || stateOrData.payload?.sortKey || stateOrData.name || stateOrData.payload?.name || null;
    }
    if (rawDate) {
      const formatted = normalizeToYyyyMmDd(rawDate);
      if (formatted) {
        setFilters(prev => ({ ...prev, dateFrom: formatted, dateTo: formatted }));
      }
    }
  };

  const [hoveredDateKey, setHoveredDateKey] = React.useState<string | null>(null);
  const [hoveredDateLabel, setHoveredDateLabel] = React.useState<string | null>(null);

  const handleBarChartMouseMove = (state: any) => {
    if (state && state.isTooltipActive && state.activePayload && state.activePayload.length > 0) {
      const payload = state.activePayload[0].payload;
      if (payload) {
        const key = payload.sortKey || payload.name;
        const label = payload.name || payload.sortKey;
        setHoveredDateKey(key);
        setHoveredDateLabel(label);
        return;
      }
    }
    setHoveredDateKey(null);
    setHoveredDateLabel(null);
  };

  const handleBarChartMouseLeave = () => {
    setHoveredDateKey(null);
    setHoveredDateLabel(null);
  };

  const [sortProductividad, setSortProductividad] = React.useState<{
    field: 'profesional' | 'cargaH' | 'turEsp' | 'prohab' | 'conTurno' | 'sinTurno' | 'prom' | 'tot' | 'dias';
    order: 'asc' | 'desc';
  }>({ field: 'cargaH', order: 'desc' });

  const toggleSortProductividad = (field: 'profesional' | 'cargaH' | 'turEsp' | 'prohab' | 'conTurno' | 'sinTurno' | 'prom' | 'tot' | 'dias') => {
    setSortProductividad(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (field: 'profesional' | 'cargaH' | 'turEsp' | 'prohab' | 'conTurno' | 'sinTurno' | 'prom' | 'tot' | 'dias') => {
    if (sortProductividad.field !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 inline-block ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    return sortProductividad.order === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-indigo-600 inline-block ml-1" />
      : <ArrowDown className="w-3 h-3 text-indigo-600 inline-block ml-1" />;
  };

  const aggregatedData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        turnosPorDiaGrouped: [],
        levelsPorDiaGrouped: [],
        allLevels: [],
        grouping: "day" as const,
      };
    }

    // Determine grouping based on min and max dates
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    data.forEach((d) => {
      if (!d.fecha) return;
      const date = new Date(d.fecha + "T12:00:00");
      if (isNaN(date.getTime())) return;

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    });

    let grouping: "day" | "week" | "month" = "day";
    if (minDate && maxDate) {
      const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 29) {
        grouping = "day";
      } else if (diffDays >= 29 && diffDays < 60) {
        grouping = "week";
      } else {
        grouping = "month";
      }
    }

    const getGroupProps = (fechaStr: string) => {
      const date = new Date(fechaStr + "T12:00:00");
      if (grouping === "day") {
        return { sortKey: fechaStr, label: fechaStr };
      } else if (grouping === "week") {
        const mon = startOfWeek(date, { weekStartsOn: 1 });
        const sortKey = format(mon, "yyyy-MM-dd");
        const label = `Sem. ${format(mon, "dd/MM")}`;
        return { sortKey, label };
      } else {
        const sortKey = format(date, "yyyy-MM");
        const monthNames = [
          "Ene",
          "Feb",
          "Mar",
          "Abr",
          "May",
          "Jun",
          "Jul",
          "Ago",
          "Sep",
          "Oct",
          "Nov",
          "Dic",
        ];
        const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        return { sortKey, label };
      }
    };

    // a) Evolución de Guardias/Turnos por día (dynamically grouped)
    const diaMap = new Map<
      string,
      { sortKey: string; name: string; count: number; conTurno: number; sinTurno: number }
    >();

    const isConTurno = (tipo?: string) => {
      const t = String(tipo || '').trim().toLowerCase();
      if (t === 'con turno' || t === 'con_turno' || t === 'con-turno') return true;
      if (t === 'sin turno' || t === 'sin_turno' || t === 'sin-turno') return false;
      if (t === 'programado' || t === 'sobreturno' || t === 'sobre turno') return true;
      if (t === 'atención inmediata' || t === 'atencion inmediata' || t === 'inmediata' || t === 'espontánea' || t === 'espontanea') return false;
      return t.includes('con turno') || (!t.includes('sin turno') && (t.includes('program') || t.includes('sobre')));
    };

    const isSinTurno = (tipo?: string) => {
      const t = String(tipo || '').trim().toLowerCase();
      if (t === 'sin turno' || t === 'sin_turno' || t === 'sin-turno') return true;
      if (t === 'con turno' || t === 'con_turno' || t === 'con-turno') return false;
      if (t === 'atención inmediata' || t === 'atencion inmediata' || t === 'inmediata' || t === 'espontánea' || t === 'espontanea') return true;
      if (t === 'programado' || t === 'sobreturno' || t === 'sobre turno') return false;
      return t.includes('sin turno') || t.includes('inmediat') || t.includes('espont');
    };

    data.forEach((d) => {
      if (!d.fecha) return;
      const { sortKey, label } = getGroupProps(d.fecha);
      if (!diaMap.has(sortKey)) {
        diaMap.set(sortKey, { sortKey, name: label, count: 0, conTurno: 0, sinTurno: 0 });
      }
      const entry = diaMap.get(sortKey)!;
      entry.count++;
      if (isConTurno(d.tipo)) {
        entry.conTurno++;
      } else if (isSinTurno(d.tipo)) {
        entry.sinTurno++;
      } else {
        entry.sinTurno++;
      }
    });
    const turnosPorDiaGrouped = Array.from(diaMap.values()).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey),
    );

    // e) Líneas por Nivel y día
    const levelsMap = new Map<
      string,
      { sortKey: string; name: string; [level: string]: any }
    >();
    const allLevels = new Set<string>();

    data.forEach((d) => {
      if (!d.fecha) return;
      const lvl = String(d.nivel || "Sin Nivel");
      allLevels.add(lvl);
      const { sortKey, label } = getGroupProps(d.fecha);
      if (!levelsMap.has(sortKey)) {
        levelsMap.set(sortKey, { sortKey, name: label });
      }
      const bucket = levelsMap.get(sortKey)!;
      bucket[lvl] = (bucket[lvl] || 0) + 1;
    });

    const levelsPorDiaGrouped = Array.from(levelsMap.values()).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey),
    );

    return {
      turnosPorDiaGrouped,
      levelsPorDiaGrouped,
      allLevels: Array.from(allLevels).sort(),
      grouping,
    };
  }, [data]);

  const groupLabel = useMemo(() => {
    if (aggregatedData.grouping === "week") return "Semana";
    if (aggregatedData.grouping === "month") return "Mes";
    return "Día";
  }, [aggregatedData.grouping]);

  // --- AMBULATORIO PRODUCTIVIDAD TABLE CALCULATIONS ---
  const productividad = useMemo(() => {
    const profMap = new Map<
      string,
      {
        profesional: string;
        dniPro: string;
        tot: number;
        conTurno: number;
        sinTurno: number;
        fechas: Set<string>;
        totHabiles: number;
        fechasHabiles: Set<string>;
      }
    >();

    const isConTurno = (tipo?: string) => {
      const t = String(tipo || '').trim().toLowerCase();
      if (t === 'con turno' || t === 'con_turno' || t === 'con-turno') return true;
      if (t === 'sin turno' || t === 'sin_turno' || t === 'sin-turno') return false;
      if (t === 'programado' || t === 'sobreturno' || t === 'sobre turno') return true;
      if (t === 'atención inmediata' || t === 'atencion inmediata' || t === 'inmediata' || t === 'espontánea' || t === 'espontanea') return false;
      return t.includes('con turno') || (!t.includes('sin turno') && (t.includes('program') || t.includes('sobre')));
    };

    const isSinTurno = (tipo?: string) => {
      const t = String(tipo || '').trim().toLowerCase();
      if (t === 'sin turno' || t === 'sin_turno' || t === 'sin-turno') return true;
      if (t === 'con turno' || t === 'con_turno' || t === 'con-turno') return false;
      if (t === 'atención inmediata' || t === 'atencion inmediata' || t === 'inmediata' || t === 'espontánea' || t === 'espontanea') return true;
      if (t === 'programado' || t === 'sobreturno' || t === 'sobre turno') return false;
      return t.includes('sin turno') || t.includes('inmediat') || t.includes('espont');
    };

    data.forEach((t) => {
      const key = t.dniPro || t.profesional;
      if (!profMap.has(key)) {
        profMap.set(key, {
          profesional: t.profesional || "Desconocido",
          dniPro: t.dniPro || "",
          tot: 0,
          conTurno: 0,
          sinTurno: 0,
          fechas: new Set<string>(),
          totHabiles: 0,
          fechasHabiles: new Set<string>(),
        });
      }
      const p = profMap.get(key)!;
      p.tot++;
      if (activeTab === 'GUARDIA') {
        const u = String(t.urgencia || '').trim().toLowerCase();
        if (u.includes('urgencia') || u.includes('emergencia')) {
          p.conTurno++;
        } else {
          p.sinTurno++;
        }
      } else {
        if (isConTurno(t.tipo)) {
          p.conTurno++;
        } else if (isSinTurno(t.tipo)) {
          p.sinTurno++;
        }
      }

      if (t.fecha) {
        const dayOnly = t.fecha.split("T")[0];
        p.fechas.add(dayOnly);

        const dayNum = parseISO(dayOnly).getDay();
        if (dayNum >= 1 && dayNum <= 5) {
          p.totHabiles++;
          p.fechasHabiles.add(dayOnly);
        }
      }
    });

    const result = Array.from(profMap.values()).map((p) => {
      const proDb = profesionales.find((dbP) => {
        if (!dbP.dniPro || !p.dniPro) return false;
        return (
          dbP.dniPro.trim().toLowerCase() === p.dniPro.trim().toLowerCase()
        );
      });
      const resolvedName = proDb?.profesional || p.profesional;
      const dias = p.fechas.size;
      const diasHabiles = p.fechasHabiles.size;
      return {
        originalProfesional: resolvedName,
        profesional:
          resolvedName.length > 30
            ? resolvedName.substring(0, 30) + "..."
            : resolvedName,
        cargaH: proDb ? proDb.cargaH : "",
        turEsp: proDb ? proDb.turEsp : "",
        prom: dias > 0 ? (p.tot / dias).toFixed(1) : "0.0",
        prohab:
          diasHabiles > 0 ? (p.totHabiles / diasHabiles).toFixed(1) : "0.0",
        conTurno: p.conTurno,
        sinTurno: p.sinTurno,
        tot: p.tot,
        dias: dias,
      };
    });

    result.sort((a, b) => {
      let valA: any = a[sortProductividad.field];
      let valB: any = b[sortProductividad.field];

      if (sortProductividad.field === 'profesional') {
        valA = a.originalProfesional;
        valB = b.originalProfesional;
      }

      const isNumericField = ['cargaH', 'turEsp', 'prom', 'prohab', 'conTurno', 'sinTurno', 'tot', 'dias'].includes(sortProductividad.field);

      if (isNumericField) {
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        const isNaNA = isNaN(numA) || valA === "";
        const isNaNB = isNaN(numB) || valB === "";

        if (isNaNA && isNaNB) return 0;
        if (isNaNA) return 1; // Empty/NaN values always go to the bottom
        if (isNaNB) return -1; // Empty/NaN values always go to the bottom

        return sortProductividad.order === 'asc' ? numA - numB : numB - numA;
      }

      const strA = String(valA || "").toLowerCase();
      const strB = String(valB || "").toLowerCase();

      return sortProductividad.order === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
    return result;
  }, [data, profesionales, activeTab, sortProductividad]);

  // --- AMBULATORIO EXTRA CHARTS ---
  const turnosPorTipoAtencion = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data) return [];
    return countByProperty(data, 'tipo');
  }, [data, activeTab]);

  const turnosPorDepartamento = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data) return [];
    return countByProperty(data, 'dpto');
  }, [data, activeTab]);

  const turnosPorCAPS = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data) return [];
    return countByProperty(data, 'caps').slice(0, 5);
  }, [data, activeTab]);

  const turnosPorEspecialidad = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data) return [];
    return countByProperty(data, 'especialidad').slice(0, 5);
  }, [data, activeTab]);

  const turnosPorProfesional = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data) return [];
    return countByProperty(data, 'profesional').slice(0, 7);
  }, [data, activeTab]);

  const turnosPorDiasConTurno = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data || data.length === 0) return [];

    const isConTurno = (tipo?: string) => {
      const t = String(tipo || '').trim().toLowerCase();
      if (t === 'con turno' || t === 'con_turno' || t === 'con-turno') return true;
      if (t === 'sin turno' || t === 'sin_turno' || t === 'sin-turno') return false;
      if (t === 'programado' || t === 'sobreturno' || t === 'sobre turno') return true;
      if (t === 'atención inmediata' || t === 'atencion inmediata' || t === 'inmediata' || t === 'espontánea' || t === 'espontanea') return false;
      return t.includes('con turno') || (!t.includes('sin turno') && (t.includes('program') || t.includes('sobre')));
    };

    const conTurnoRecords = data.filter(d => isConTurno(d.tipo));
    const countsMap = new Map<number, number>();

    conTurnoRecords.forEach(d => {
      const rawDias = Number(d.dias);
      const diasVal = !isNaN(rawDias) ? rawDias : 0;
      countsMap.set(diasVal, (countsMap.get(diasVal) || 0) + 1);
    });

    const sortedDays = Array.from(countsMap.keys()).sort((a, b) => a - b);

    return sortedDays.map(dias => ({
      name: `${dias}`,
      fullLabel: `${dias} ${dias === 1 ? 'día' : 'días'}`,
      dias,
      count: countsMap.get(dias) || 0
    }));
  }, [data, activeTab]);

  const { turnosProfSemana, top5ProfsList } = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data || data.length === 0) {
      return { turnosProfSemana: [], top5ProfsList: [] };
    }
    
    // 1. Find globally top 5 professionals in current filtered dataset
    const profCounts = new Map<string, number>();
    data.forEach(d => {
      const prof = d.profesional || 'Desconocido';
      profCounts.set(prof, (profCounts.get(prof) || 0) + 1);
    });
    const top5 = Array.from(profCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
      
    // 2. Group by week
    const weekMap = new Map<string, { label: string, [prof: string]: any }>();
    data.forEach(d => {
      if (!d.fecha) return;
      try {
        const parsed = parseISO(d.fecha.split('T')[0]);
        if (isNaN(parsed.getTime())) return;
        const mon = startOfWeek(parsed, { weekStartsOn: 1 });
        const sortKey = format(mon, 'yyyy-MM-dd');
        const label = `Sem. ${format(mon, 'dd-MM')}`;
        
        if (!weekMap.has(sortKey)) {
          const initialMap: Record<string, number> = { Otros: 0 };
          top5.forEach(p => { initialMap[p] = 0; });
          weekMap.set(sortKey, { label, ...initialMap });
        }
        
        const bucket = weekMap.get(sortKey)!;
        const prof = d.profesional || 'Desconocido';
        if (top5.includes(prof)) {
          bucket[prof]++;
        } else {
          bucket['Otros']++;
        }
      } catch {
        // ignore parsing errors
      }
    });
    
    // Sort weeks chronologically
    const sorted = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, val]) => val);
      
    return {
      turnosProfSemana: sorted,
      top5ProfsList: [...top5, 'Otros']
    };
  }, [data, activeTab]);

  const productividadExcelData = useMemo(() => {
    return productividad.map((p) => ({
      Profesional: p.profesional,
      CargaH: p.cargaH || '',
      TurEsp: p.turEsp || '',
      ATEDIA: p.prohab || '0.0',
      'Con Turno': p.conTurno || 0,
      'Sin Turno': p.sinTurno || 0,
      Tot: p.tot || 0,
      Días: p.dias || 0,
    }));
  }, [productividad]);

  // --- AMBULATORIO VIEW (ORIGINAL RENDERING PRESERVED) ---
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        isPrinting && "h-auto overflow-visible",
      )}
    >
      {/* Tabla Productividad (Same width/height as Evolución chart) */}
      <ChartCard
        title="Productividad por Profesional"
        fullWidth
        isPrinting={isPrinting}
        excelData={productividadExcelData}
      >
        <div
          className={cn(
            "border border-slate-200 rounded-lg mx-1",
            isPrinting
              ? "h-auto overflow-visible"
              : "overflow-y-auto overflow-x-auto custom-scrollbar",
          )}
          style={{
            height: isPrinting ? "auto" : "250px",
            width: "calc(100% - 8px)",
          }}
        >
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-slate-100 text-[10px] uppercase font-semibold text-slate-600 sticky top-0 z-10 shadow-sm">
              <tr>
                <th 
                  className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors"
                  onClick={() => toggleSortProductividad('profesional')}
                >
                  <div className="flex items-center">
                    Profesional
                    {getSortIcon('profesional')}
                  </div>
                </th>
                <th 
                  className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-center"
                  onClick={() => toggleSortProductividad('cargaH')}
                >
                  <div className="flex items-center justify-center">
                    CargaH
                    {getSortIcon('cargaH')}
                  </div>
                </th>
                <th 
                  className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors"
                  onClick={() => toggleSortProductividad('turEsp')}
                >
                  <div className="flex items-center">
                    TurEsp
                    {getSortIcon('turEsp')}
                  </div>
                </th>
                <th 
                  className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right"
                  onClick={() => toggleSortProductividad('prohab')}
                >
                  <div className="flex items-center justify-end">
                    ATEDIA
                    {getSortIcon('prohab')}
                  </div>
                </th>
                <th 
                  className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right"
                  onClick={() => toggleSortProductividad('conTurno')}
                >
                  <div className="flex items-center justify-end">
                    {activeTab === 'GUARDIA' ? 'Urgencia' : 'Con Turno'}
                    {getSortIcon('conTurno')}
                  </div>
                </th>
                <th 
                  className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right"
                  onClick={() => toggleSortProductividad('sinTurno')}
                >
                  <div className="flex items-center justify-end">
                    {activeTab === 'GUARDIA' ? 'Normal' : 'Sin Turno'}
                    {getSortIcon('sinTurno')}
                  </div>
                </th>
                <th 
                  className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right"
                  onClick={() => toggleSortProductividad('tot')}
                >
                  <div className="flex items-center justify-end">
                    Tot
                    {getSortIcon('tot')}
                  </div>
                </th>
                <th 
                  className="py-2 px-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none group transition-colors text-right"
                  onClick={() => toggleSortProductividad('dias')}
                >
                  <div className="flex items-center justify-end">
                    Días
                    {getSortIcon('dias')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 bg-white">
              {productividad.map((p, idx) => {
                const getAtediaStyle = (prohab: any, turEsp: any) => {
                  if (!turEsp || String(turEsp).trim() === "") return "text-slate-600";
                  const prohabVal = parseFloat(prohab);
                  const turEspVal = parseFloat(turEsp);
                  if (isNaN(prohabVal) || isNaN(turEspVal)) return "text-slate-600";
                  if (prohabVal >= turEspVal) {
                    return "bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold";
                  } else if (prohabVal >= turEspVal * 0.75) {
                    return "bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold";
                  } else {
                    return "bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold";
                  }
                };

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td
                      className={cn(
                        "py-1.5 px-3 font-medium text-slate-800 whitespace-nowrap",
                        setFilters && "cursor-pointer select-none hover:text-indigo-600 hover:font-bold"
                      )}
                      onDoubleClick={() => {
                        if (setFilters) {
                          setFilters(prev => ({ ...prev, profesional: [p.originalProfesional] }));
                        }
                      }}
                      title={setFilters ? `Doble click para seleccionar solo ${p.originalProfesional}` : p.originalProfesional}
                    >
                      {p.profesional}
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 text-center">
                      {p.cargaH}
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 truncate max-w-[120px]">
                      {p.turEsp}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      <span className={getAtediaStyle(p.prohab, p.turEsp)}>{p.prohab}</span>
                    </td>
                    <td className="py-1.5 px-3 text-emerald-700 font-medium text-right font-mono">
                      {p.conTurno}
                    </td>
                    <td className="py-1.5 px-3 text-amber-700 font-medium text-right font-mono">
                      {p.sinTurno}
                    </td>
                    <td className="py-1.5 px-3 text-indigo-600 font-bold text-right font-mono">
                      {p.tot}
                    </td>
                    <td className="py-1.5 px-3 text-slate-500 text-right font-mono">
                      {p.dias}
                    </td>
                  </tr>
                );
              })}
              {productividad.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    No hay datos para mostrar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Turnos por día (Full Width) */}
      <ChartCard
        title="Turnos por Día"
        fullWidth
        isPrinting={isPrinting}
      >
        <PrintOptimizedContainer
          height={180}
          isPrinting={isPrinting}
          width={760}
        >
          <BarChart
            data={aggregatedData.turnosPorDiaGrouped}
            margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
            onDoubleClick={handleChartDoubleClick}
            className={setFilters ? "cursor-pointer" : undefined}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickFormatter={(val) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                  const parts = val.split("-");
                  return `${parts[2]}-${parts[1]}`;
                }
                return val;
              }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <RechartsTooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={22}
              iconType="circle"
              wrapperStyle={{ fontSize: "11px", paddingBottom: "4px" }}
            />
            <Bar
              dataKey="conTurno"
              stackId="turnos"
              fill="#10b981"
              name="Con Turno"
              onDoubleClick={handleChartDoubleClick}
              className={setFilters ? "cursor-pointer" : undefined}
            />
            <Bar
              dataKey="sinTurno"
              stackId="turnos"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
              name="Sin Turno"
              onDoubleClick={handleChartDoubleClick}
              className={setFilters ? "cursor-pointer" : undefined}
            />
          </BarChart>
        </PrintOptimizedContainer>
      </ChartCard>

      {/* Dias de anotados (Full Width) */}
      <ChartCard
        title="Dias de anotados"
        fullWidth
        isPrinting={isPrinting}
      >
        <PrintOptimizedContainer
          height={180}
          isPrinting={isPrinting}
          width={760}
        >
          <BarChart
            data={turnosPorDiasConTurno}
            margin={{ top: 5, right: 15, left: -25, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <RechartsTooltip
              cursor={{ fill: "#f1f5f9" }}
              formatter={(value: any) => [`${value} turnos`, 'Cantidad']}
              labelFormatter={(label: any) => `${label} ${Number(label) === 1 ? 'día' : 'días'}`}
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Bar
              dataKey="count"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              name="Turnos Con Turno"
            />
          </BarChart>
        </PrintOptimizedContainer>
      </ChartCard>

      {/* Turnos por Profesional por Semana (Full Width) */}
      <ChartCard
        title="Turnos por Profesional por Semana"
        fullWidth
        isPrinting={isPrinting}
      >
        <PrintOptimizedContainer
          height={180}
          isPrinting={isPrinting}
          width={760}
        >
          <BarChart
            data={turnosProfSemana}
            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
            <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
            {top5ProfsList.map((prof, idx) => (
              <Bar
                key={prof}
                dataKey={prof}
                stackId="a"
                fill={COLORS[idx % COLORS.length]}
                name={prof}
              />
            ))}
          </BarChart>
        </PrintOptimizedContainer>
      </ChartCard>

      {/* Top 5: Turnos por CAPS y Top 5: Turnos por Especialidad (Lado a Lado, Barras Verticales) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <ChartCard
          title="Top 5: Turnos por CAPS"
          isPrinting={isPrinting}
        >
          <PrintOptimizedContainer
            height={180}
            isPrinting={isPrinting}
            width={370}
          >
            <BarChart
              data={turnosPorCAPS}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <RechartsTooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: "4px", border: "none", padding: "4px" }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Turnos" />
            </BarChart>
          </PrintOptimizedContainer>
        </ChartCard>

        <ChartCard
          title="Top 5: Turnos por Especialidad"
          isPrinting={isPrinting}
        >
          <PrintOptimizedContainer
            height={180}
            isPrinting={isPrinting}
            width={370}
          >
            <BarChart
              data={turnosPorEspecialidad}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <RechartsTooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: "4px", border: "none", padding: "4px" }} />
              <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Turnos" />
            </BarChart>
          </PrintOptimizedContainer>
        </ChartCard>
      </div>

      {/* Top 7: Turnos por Profesional */}
      <ChartCard
        title="Top 7: Turnos por Profesional"
        fullWidth
        isPrinting={isPrinting}
      >
        <PrintOptimizedContainer
          height={200}
          isPrinting={isPrinting}
          width={760}
        >
          <BarChart
            data={turnosPorProfesional}
            layout="vertical"
            margin={{ top: 5, right: 10, left: 30, bottom: -5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
            <RechartsTooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: "4px", border: "none", padding: "4px" }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Turnos" />
          </BarChart>
        </PrintOptimizedContainer>
      </ChartCard>

    </div>
  );
}

function ChartCard({
  title,
  children,
  fullWidth = false,
  isPrinting = false,
  excelData,
  onDownloadExcel,
}: {
  title: string;
  children: React.ReactNode;
  fullWidth?: boolean;
  isPrinting?: boolean;
  excelData?: any[];
  onDownloadExcel?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={cardRef}
      className={cn(
        "bg-white border border-slate-200 rounded p-2 shadow-sm",
        fullWidth ? "col-span-1 lg:col-span-2" : "",
        isPrinting ? "h-auto overflow-visible block" : "flex flex-col",
      )}
    >
      <div className="flex justify-between items-center mb-2 shrink-0">
        <h3 className="text-[10px] font-bold uppercase text-slate-500">
          {title}
        </h3>
        {!isPrinting && (
          <div className="flex items-center gap-1">
            {(excelData || onDownloadExcel) && (
              <DownloadExcelButton
                data={excelData}
                onClick={onDownloadExcel}
                filename={title.replace(/\s+/g, "-").toLowerCase()}
                sheetName={title}
              />
            )}
            <DownloadPdfButton
              targetRef={cardRef}
              filename={title.replace(/\s+/g, "-").toLowerCase()}
            />
          </div>
        )}
      </div>
      <div
        className={cn(
          isPrinting
              ? "w-full overflow-visible h-auto block"
              : "flex-1 w-full bg-white relative",
        )}
      >
        {children}
      </div>
    </div>
  );
}

