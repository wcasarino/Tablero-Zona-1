import React, { useMemo, useRef } from 'react';
import { Turno, Profesional } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { cn } from '../lib/utils';
import DownloadPdfButton from './DownloadPdfButton';
import { parseISO } from 'date-fns';

const COLORS = [
  '#3b82f6', // Azul
  '#10b981', // Verde
  '#f59e0b', // Amarillo/Naranja
  '#ef4444', // Rojo
  '#8b5cf6', // Violeta
  '#06b6d4', // Celeste
  '#f97316', // Naranja fuerte
  '#ec4899', // Rosado
  '#14b8a6', // Trullo
  '#6366f1'  // Indigo
];

interface ContainerProps {
  children: React.ReactElement;
  height: number;
  isPrinting: boolean;
  width?: number;
}

function PrintOptimizedContainer({ children, height, isPrinting, width = 360 }: ContainerProps) {
  if (isPrinting) {
    return (
      <div style={{ width: '100%', height: `${height}px` }} className="flex justify-center items-center bg-white overflow-visible">
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
  data.forEach(d => {
    const val = String(d[prop] || 'Desconocido');
    map.set(val, (map.get(val) || 0) + 1);
  });
  const result = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  if (sortDesc) result.sort((a, b) => b.count - a.count);
  return result;
}

function groupAges(data: any[]) {
  const bins = { '0-18': 0, '18-29': 0, '30-49': 0, '50-64': 0, '65+': 0 };
  data.forEach(d => {
    const age = Number(d.edad || 0);
    if (age <= 18) bins['0-18']++;
    else if (age <= 29) bins['18-29']++;
    else if (age <= 49) bins['30-49']++;
    else if (age <= 64) bins['50-64']++;
    else bins['65+']++;
  });
  return Object.entries(bins).map(([name, count]) => ({ name: `${name} años`, count }));
}

interface LeftChartsProps {
  data: any[];
  isPrinting?: boolean;
  activeTab?: 'AMBULATORIO' | 'GUARDIA';
  profesionales?: Profesional[];
}

export default function LeftCharts({ 
  data, 
  isPrinting = false, 
  activeTab = 'AMBULATORIO',
  profesionales = []
}: LeftChartsProps) {
  // --- AMBULATORIO CHARTS ---
  const ambPorTurno = useMemo(() => countByProperty(data, 'turno'), [data]);
  const ambTopPacDpto = useMemo(() => countByProperty(data, 'pacDpto').slice(0, 5), [data]);
  const ambTopCobertura = useMemo(() => countByProperty(data, 'coberturaSocial').slice(0, 5), [data]);
  const ambEdades = useMemo(() => groupAges(data), [data]);
  const ambDiasSemana = useMemo(() => {
    const days = [
      { name: 'Lunes', count: 0 },
      { name: 'Martes', count: 0 },
      { name: 'Miércoles', count: 0 },
      { name: 'Jueves', count: 0 },
      { name: 'Viernes', count: 0 },
      { name: 'Sábado', count: 0 },
      { name: 'Domingo', count: 0 },
    ];
    data.forEach(d => {
      if (!d.fecha) return;
      let dateObj: Date | null = null;
      if (typeof d.fecha === 'string') {
        if (d.fecha.includes('-')) {
          dateObj = parseISO(d.fecha);
        } else if (d.fecha.includes('/')) {
          const parts = d.fecha.split('/');
          if (parts.length === 3) {
            dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          }
        } else {
          dateObj = new Date(d.fecha);
        }
      } else if (d.fecha instanceof Date) {
        dateObj = d.fecha;
      }

      if (dateObj && !isNaN(dateObj.getTime())) {
        const dayIdx = dateObj.getDay();
        const mappedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
        if (days[mappedIdx]) {
          days[mappedIdx].count++;
        }
      }
    });
    return days;
  }, [data]);
  const ambSexos = useMemo(() => countByProperty(data, 'sexo'), [data]);
  const ambPorProfesional = useMemo(() => countByProperty(data, 'profesional').slice(0, 10), [data]);
  const ambPorTipoAtencion = useMemo(() => countByProperty(data, 'tipo'), [data]);
  const ambPorAnotador = useMemo(() => {
    const raw = countByProperty(data, 'anotador');
    return raw.map(entry => ({
      name: entry.name === 'Desconocido' || !entry.name.trim() ? 'Sin Anotador' : entry.name,
      count: entry.count
    }));
  }, [data]);
  const ambPorDpto = useMemo(() => countByProperty(data, 'dpto'), [data]);
  const ambPorCAPS = useMemo(() => countByProperty(data, 'caps').slice(0, 10), [data]);
  const ambPorEspecialidad = useMemo(() => countByProperty(data, 'especialidad').slice(0, 10), [data]);

  // --- GUARDIA CHARTS ---
  const guardiaEdades = useMemo(() => groupAges(data), [data]);
  const guardiaDiasSemana = ambDiasSemana; // Same logic as ambulatoy
  const guardiaPorCAPS = useMemo(() => countByProperty(data, 'caps').slice(0, 10), [data]);
  const guardiaPorUrgencia = useMemo(() => countByProperty(data, 'urgencia'), [data]);
  const guardiaPorTriage = useMemo(() => countByProperty(data, 'nivel'), [data]);
  const guardiaPorEgreso = useMemo(() => countByProperty(data, 'egreso'), [data]);

  if (activeTab === 'GUARDIA') {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <ChartCard title="Por Urgencia" isPrinting={isPrinting}>
            <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={180}>
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Pie data={guardiaPorUrgencia} innerRadius={15} outerRadius={35} paddingAngle={2} dataKey="count">
                  {guardiaPorUrgencia.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
                <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
              </PieChart>
            </PrintOptimizedContainer>
          </ChartCard>

          <ChartCard title="Por Nivel (Triage)" isPrinting={isPrinting}>
            <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={180}>
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Pie data={guardiaPorTriage} innerRadius={15} outerRadius={35} paddingAngle={2} dataKey="count">
                  {guardiaPorTriage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
                <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
              </PieChart>
            </PrintOptimizedContainer>
          </ChartCard>
        </div>

        <ChartCard title="Distribución por Rango Etario" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={370}>
            <BarChart data={guardiaEdades} margin={{ top: 5, right: 10, left: -25, bottom: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px' }} />
              <Bar dataKey="count" fill="#4f46e5" radius={[2, 2, 0, 0]} name="Pacientes" />
            </BarChart>
          </PrintOptimizedContainer>
        </ChartCard>

        <ChartCard title="Cantidad por Día de la Semana" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={370}>
            <BarChart data={guardiaDiasSemana} margin={{ top: 5, right: 10, left: -25, bottom: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Atenciones" />
            </BarChart>
          </PrintOptimizedContainer>
        </ChartCard>

        <ChartCard title="Por CAPS (Top 10)" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={370}>
            <BarChart data={guardiaPorCAPS} margin={{ top: 5, right: 10, left: -25, bottom: -10 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
              <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px' }} />
              <Bar dataKey="count" fill="#14b8a6" radius={[0, 2, 2, 0]} name="Atenciones" />
            </BarChart>
          </PrintOptimizedContainer>
        </ChartCard>

        <ChartCard title="Por Egreso" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={370}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie data={guardiaPorEgreso} innerRadius={25} outerRadius={50} paddingAngle={2} dataKey="count">
                {guardiaPorEgreso.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
              <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
            </PieChart>
          </PrintOptimizedContainer>
        </ChartCard>
      </div>
    );
  }

  // --- AMBULATORIO VIEW (ORIGINAL RENDERING PRESERVED) ---
  return (
    <div className="flex flex-col gap-2">
      {/* 0. Por Atención y Por Anotador (Lado a Lado arriba de Rango Etario) */}
      <div className="grid grid-cols-2 gap-2">
        <ChartCard title="Por Atención" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={180}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie data={ambPorTipoAtencion} innerRadius={15} outerRadius={35} paddingAngle={2} dataKey="count">
                {ambPorTipoAtencion.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
              <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
            </PieChart>
          </PrintOptimizedContainer>
        </ChartCard>

        <ChartCard title="Por Anotador" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={180}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie data={ambPorAnotador} innerRadius={15} outerRadius={35} paddingAngle={2} dataKey="count">
                {ambPorAnotador.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
              <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
            </PieChart>
          </PrintOptimizedContainer>
        </ChartCard>
      </div>

      {/* 1. Distribución por Rango Etario */}
      <ChartCard title="Distribución por Rango Etario" isPrinting={isPrinting}>
        <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={370}>
          <BarChart data={ambEdades} margin={{ top: 5, right: 10, left: -25, bottom: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px' }} />
            <Bar dataKey="count" fill="#4f46e5" radius={[2, 2, 0, 0]} name="Pacientes" />
          </BarChart>
        </PrintOptimizedContainer>
      </ChartCard>

      {/* 1.b Cantidad por Día de la Semana */}
      <ChartCard title="Cantidad por Día de la Semana" isPrinting={isPrinting}>
        <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={370}>
          <BarChart data={ambDiasSemana} margin={{ top: 5, right: 10, left: -25, bottom: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px' }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Atenciones" />
          </BarChart>
        </PrintOptimizedContainer>
      </ChartCard>

      {/* 2. Distribución por Sexo y Totales por TURNO (Lado a Lado) */}
      <div className="grid grid-cols-2 gap-2">
        <ChartCard title="Por Sexo" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={180}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie data={ambSexos} innerRadius={15} outerRadius={35} paddingAngle={4} dataKey="count">
                {ambSexos.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === 'F' ? '#ec4899' : '#3b82f6'} 
                  />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
              <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: "9px" }} formatter={(val) => val === 'F' ? 'Fem' : 'Masc'} />
            </PieChart>
          </PrintOptimizedContainer>
        </ChartCard>

        <ChartCard title="Por Turno" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={180}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie data={ambPorTurno} innerRadius={15} outerRadius={35} paddingAngle={4} dataKey="count">
                {ambPorTurno.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
              <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
            </PieChart>
          </PrintOptimizedContainer>
        </ChartCard>
      </div>

      {/* Por Departamento y Top 5: Origen del Paciente (Dpto) (Lado a Lado) */}
      <div className="grid grid-cols-2 gap-2">
        <ChartCard title="Por Departamento" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={180}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie data={ambPorDpto} innerRadius={15} outerRadius={35} paddingAngle={2} dataKey="count">
                {ambPorDpto.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 6) % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
              <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
            </PieChart>
          </PrintOptimizedContainer>
        </ChartCard>

        <ChartCard title="Top 5 Dpto Pac." isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={180}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie data={ambTopPacDpto} innerRadius={15} outerRadius={35} paddingAngle={2} dataKey="count">
                {ambTopPacDpto.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
              <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
            </PieChart>
          </PrintOptimizedContainer>
        </ChartCard>
      </div>

      {/* Top 5: Cobertura Social */}
      <div className="grid grid-cols-2 gap-2">
        <ChartCard title="Top 5 OS" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={180}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie data={ambTopCobertura} innerRadius={15} outerRadius={35} paddingAngle={2} dataKey="count">
                {ambTopCobertura.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
              <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
            </PieChart>
          </PrintOptimizedContainer>
        </ChartCard>
      </div>

    </div>
  );
}

function ChartCard({ title, children, isPrinting = false }: { title: string; children: React.ReactNode; isPrinting?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={cardRef} className={cn(
      "bg-white border border-slate-200 rounded p-2 shadow-sm",
      isPrinting ? "h-auto overflow-visible block" : "flex flex-col shrink-0"
    )}>
      <div className="flex justify-between items-center mb-2 shrink-0">
        <h3 className="text-[10px] font-bold uppercase text-slate-500">{title}</h3>
        {!isPrinting && <DownloadPdfButton targetRef={cardRef} filename={title.replace(/\s+/g, '-').toLowerCase()} />}
      </div>
      <div className={cn(isPrinting ? "w-full overflow-visible h-auto block" : "flex-1 w-full bg-white relative")}>
        {children}
      </div>
    </div>
  );
}
