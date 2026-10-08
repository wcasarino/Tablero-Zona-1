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

function countByProperty(data: any[], prop: string, sortDesc = true, weightProp = 'atenciones') {
  const map = new Map<string, number>();
  data.forEach((d) => {
    const val = String(d[prop] || 'Desconocido');
    const weight = Number(d[weightProp]) || 1;
    map.set(val, (map.get(val) || 0) + weight);
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
      const atenciones = Number(d.atenciones) || 1;
      entry.count += atenciones;
      if (d.conTurno !== undefined || d.sinTurno !== undefined) {
        entry.conTurno += Number(d.conTurno || 0);
        entry.sinTurno += Number(d.sinTurno || 0);
      } else if (isConTurno(d.tipo)) {
        entry.conTurno += atenciones;
      } else if (isSinTurno(d.tipo)) {
        entry.sinTurno += atenciones;
      } else {
        entry.sinTurno += atenciones;
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

  // --- AMBULATORIO EXTRA CHARTS ---
  const turnosPorTipoAtencion = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data) return [];
    return countByProperty(data, 'tipo');
  }, [data, activeTab]);

  const turnosPorCAPS = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data) return [];
    return countByProperty(data, 'caps').slice(0, 5);
  }, [data, activeTab]);

  const turnosPorDiasConTurno = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data || data.length === 0) return [];

    let enElDia = 0, diaAnterior = 0, enLaSemana = 0, resto = 0;
    let hasNewAnticipacion = false;
    data.forEach(d => {
      if (d.enElDia !== undefined || d.diaAnterior !== undefined || d.enLaSemana !== undefined || d.resto !== undefined) {
        hasNewAnticipacion = true;
        enElDia += Number(d.enElDia) || 0;
        diaAnterior += Number(d.diaAnterior) || 0;
        enLaSemana += Number(d.enLaSemana) || 0;
        resto += Number(d.resto) || 0;
      }
    });

    if (hasNewAnticipacion) {
      return [
        { name: 'En el Día', fullLabel: 'En el Día (0 días)', dias: 0, count: enElDia },
        { name: 'Día Anterior', fullLabel: 'El día anterior (1 día)', dias: 1, count: diaAnterior },
        { name: 'En la Semana', fullLabel: 'En la Semana (2-7 días)', dias: 2, count: enLaSemana },
        { name: 'Resto (>7 d)', fullLabel: 'Resto (> 7 días)', dias: 3, count: resto },
      ];
    }

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
      countsMap.set(diasVal, (countsMap.get(diasVal) || 0) + (Number(d.atenciones) || 1));
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
      profCounts.set(prof, (profCounts.get(prof) || 0) + (Number(d.atenciones) || 1));
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
        const atenciones = Number(d.atenciones) || 1;
        if (top5.includes(prof)) {
          bucket[prof] += atenciones;
        } else {
          bucket['Otros'] += atenciones;
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

  // --- AMBULATORIO VIEW (ORIGINAL RENDERING PRESERVED) ---
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        isPrinting && "h-auto overflow-visible",
      )}
    >
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

      {/* Top 5: Turnos por CAPS (Barras Verticales) */}
      <ChartCard
        title="Top 5: Turnos por CAPS"
        fullWidth
        isPrinting={isPrinting}
      >
        <PrintOptimizedContainer
          height={180}
          isPrinting={isPrinting}
          width={760}
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

