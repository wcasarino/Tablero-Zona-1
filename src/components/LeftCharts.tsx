import React, { useMemo, useRef } from 'react';
import { Turno, Profesional } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { cn, getDiaSemanaName } from '../lib/utils';
import DownloadPdfButton from './DownloadPdfButton';
import { parseISO, format } from 'date-fns';

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

const PROGRAMADOS_COLORS: Record<string, string> = {
  CAPS: '#6366f1', // Indigo
  BOT: '#3b82f6',  // Azul
  CALL: '#8b5cf6', // Violeta
};

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

function countByProperty(data: any[], prop: string, sortDesc = true, weightProp = 'atenciones') {
  const map = new Map<string, number>();
  data.forEach(d => {
    const val = String(d[prop] || 'Desconocido');
    const weight = Number(d[weightProp]) || 1;
    map.set(val, (map.get(val) || 0) + weight);
  });
  const result = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  if (sortDesc) result.sort((a, b) => b.count - a.count);
  return result;
}

function groupAges(data: any[]) {
  // Check if new aggregated age columns exist
  let b0_18 = 0, b18_29 = 0, b30_49 = 0, b50_64 = 0, b65 = 0;
  let hasNewAge = false;
  data.forEach(d => {
    if (d.f_0_18 !== undefined || d.m_0_18 !== undefined) {
      hasNewAge = true;
      b0_18 += (Number(d.f_0_18) || 0) + (Number(d.m_0_18) || 0);
      b18_29 += (Number(d.f_18_29) || 0) + (Number(d.m_18_29) || 0);
      b30_49 += (Number(d.f_30_49) || 0) + (Number(d.m_30_49) || 0);
      b50_64 += (Number(d.f_50_64) || 0) + (Number(d.m_50_64) || 0);
      b65 += (Number(d.f_65_plus) || 0) + (Number(d.m_65_plus) || 0);
    }
  });

  if (hasNewAge) {
    return [
      { name: '0-18 años', count: b0_18 },
      { name: '18-29 años', count: b18_29 },
      { name: '30-49 años', count: b30_49 },
      { name: '50-64 años', count: b50_64 },
      { name: '65+ años', count: b65 },
    ];
  }

  const bins = { '0-18': 0, '18-29': 0, '30-49': 0, '50-64': 0, '65+': 0 };
  data.forEach(d => {
    const age = Number(d.edad || 0);
    const weight = Number(d.atenciones) || 1;
    if (age <= 18) bins['0-18'] += weight;
    else if (age <= 29) bins['18-29'] += weight;
    else if (age <= 49) bins['30-49'] += weight;
    else if (age <= 64) bins['50-64'] += weight;
    else bins['65+'] += weight;
  });
  return Object.entries(bins).map(([name, count]) => ({ name: `${name} años`, count }));
}

function DiaSemanaTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const atenciones = data?.count ?? 0;
    const dias = data?.diasTrabajados ?? 0;
    return (
      <div className="bg-slate-800 text-white text-xs rounded px-2.5 py-1.5 shadow-md border border-slate-700">
        <p className="font-semibold text-slate-200">{label}</p>
        <p className="text-white mt-0.5">
          <span className="text-slate-300">Atenciones: </span>
          <span className="font-bold">{atenciones}</span>
          <span className="text-slate-400"> (Días: {dias})</span>
        </p>
      </div>
    );
  }
  return null;
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
  const ambPorTurno = useMemo(() => {
    let m = 0, t = 0, n = 0;
    let hasNew = false;
    data.forEach(d => {
      if (d.turnoM !== undefined || d.turnoT !== undefined || d.turnoN !== undefined) {
        hasNew = true;
        m += Number(d.turnoM) || 0;
        t += Number(d.turnoT) || 0;
        n += Number(d.turnoN) || 0;
      }
    });
    if (hasNew) {
      return [
        { name: 'Mañana (M)', count: m },
        { name: 'Tarde (T)', count: t },
        { name: 'Noche (N)', count: n },
      ].filter(x => x.count > 0);
    }
    return countByProperty(data, 'turno');
  }, [data]);

  const ambTopPacDpto = useMemo(() => countByProperty(data, 'pacDpto').filter(x => x.name !== 'Desconocido').slice(0, 5), [data]);
  const ambTopCobertura = useMemo(() => countByProperty(data, 'coberturaSocial').filter(x => x.name !== 'Desconocido' && x.name !== 'Sin Cobertura').slice(0, 5), [data]);
  const ambEdades = useMemo(() => groupAges(data), [data]);

  const ambDiasSemana = useMemo(() => {
    const days = [
      { name: 'Lunes', total: 0, dates: new Set<string>() },
      { name: 'Martes', total: 0, dates: new Set<string>() },
      { name: 'Miércoles', total: 0, dates: new Set<string>() },
      { name: 'Jueves', total: 0, dates: new Set<string>() },
      { name: 'Viernes', total: 0, dates: new Set<string>() },
      { name: 'Sábado', total: 0, dates: new Set<string>() },
      { name: 'Domingo', total: 0, dates: new Set<string>() },
    ];

    data.forEach(d => {
      if (!d.fecha) return;
      const weight = Number(d.atenciones) || 1;
      const diaName = getDiaSemanaName(d.diaSemana, d.fecha);
      const targetDay = days.find(day => day.name === diaName);
      if (targetDay) {
        targetDay.total += weight;
        const dateKey = typeof d.fecha === 'string' ? d.fecha.trim() : format(d.fecha, 'yyyy-MM-dd');
        targetDay.dates.add(dateKey);
      }
    });

    return days.map(d => {
      const diasTrabajados = d.dates.size;
      const promedio = diasTrabajados > 0 ? Math.round(d.total / diasTrabajados) : 0;
      return {
        name: d.name,
        count: promedio,
        promedio: promedio,
        total: d.total,
        diasTrabajados: diasTrabajados,
      };
    });
  }, [data]);

  const ambSexos = useMemo(() => {
    let fem = 0, masc = 0;
    let hasNew = false;
    data.forEach(d => {
      if (d.fem !== undefined || d.masc !== undefined) {
        hasNew = true;
        fem += Number(d.fem) || 0;
        masc += Number(d.masc) || 0;
      }
    });
    if (hasNew) {
      return [
        { name: 'F', count: fem },
        { name: 'M', count: masc },
      ].filter(x => x.count > 0);
    }
    return countByProperty(data, 'sexo');
  }, [data]);

  const turnosPorProfesional = useMemo(() => {
    if (activeTab !== 'AMBULATORIO' || !data) return [];
    return countByProperty(data, 'profesional').slice(0, 7);
  }, [data, activeTab]);
  
  const ambPorTipoAtencion = useMemo(() => {
    let conTurno = 0, sinTurno = 0;
    let hasNew = false;
    data.forEach(d => {
      if (d.conTurno !== undefined || d.sinTurno !== undefined) {
        hasNew = true;
        conTurno += Number(d.conTurno) || 0;
        sinTurno += Number(d.sinTurno) || 0;
      }
    });
    if (hasNew) {
      return [
        { name: 'Con Turno', count: conTurno },
        { name: 'Sin Turno', count: sinTurno },
      ].filter(x => x.count > 0);
    }
    return countByProperty(data, 'tipo');
  }, [data]);

  const ambPorAnotador = useMemo(() => {
    let caps = 0, bot = 0, call = 0;
    let hasNew = false;
    data.forEach(d => {
      if (d.canalCaps !== undefined || d.canalBot !== undefined || d.canalCall !== undefined) {
        hasNew = true;
        caps += Number(d.canalCaps) || 0;
        bot += Number(d.canalBot) || 0;
        call += Number(d.canalCall) || 0;
      }
    });
    if (hasNew) {
      return [
        { name: 'CAPS', count: caps },
        { name: 'BOT', count: bot },
        { name: 'CALL', count: call },
      ].filter(x => x.count > 0);
    }
    const raw = countByProperty(data, 'anotador');
    return raw.map(entry => ({
      name: entry.name === 'Desconocido' || !entry.name.trim() ? 'Sin Anotador' : entry.name,
      count: entry.count
    }));
  }, [data]);

  const ambProgramados = useMemo(() => {
    let conTurnoTotal = 0;
    let botTotal = 0;
    let callTotal = 0;

    data.forEach(d => {
      if (typeof d.conTurno === 'number') {
        conTurnoTotal += Number(d.conTurno) || 0;
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
          conTurnoTotal += Number(d.atenciones) || 1;
        }
      }

      if (d.canalBot !== undefined) {
        botTotal += Number(d.canalBot) || 0;
      } else if (String(d.anotador || '').toUpperCase().includes('BOT')) {
        botTotal += Number(d.atenciones) || 1;
      }

      if (d.canalCall !== undefined) {
        callTotal += Number(d.canalCall) || 0;
      } else if (String(d.anotador || '').toUpperCase().includes('CALL')) {
        callTotal += Number(d.atenciones) || 1;
      }
    });

    const capsTotal = Math.max(0, conTurnoTotal - botTotal - callTotal);

    return [
      { name: 'CAPS', count: capsTotal },
      { name: 'BOT', count: botTotal },
      { name: 'CALL', count: callTotal },
    ].filter(x => x.count > 0);
  }, [data]);

  const ambPorCAPS = useMemo(() => countByProperty(data, 'caps').slice(0, 10), [data]);

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
      {/* 0. Por Anotador y PROGRAMADOS (Lado a Lado) */}
      <div className="grid grid-cols-2 gap-2">
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

        <ChartCard title="PROGRAMADOS" isPrinting={isPrinting}>
          <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={180}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie data={ambProgramados} innerRadius={15} outerRadius={35} paddingAngle={2} dataKey="count">
                {ambProgramados.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={PROGRAMADOS_COLORS[entry.name] || COLORS[(index + 5) % COLORS.length]} 
                  />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', padding: '4px', fontSize: '10px' }} />
              <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
            </PieChart>
          </PrintOptimizedContainer>
        </ChartCard>
      </div>

      {/* 0.b Por Atención y Por Turno (Lado a Lado abajo de la fila anterior) */}
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

      {/* 1. Atenciones por Día de la Semana */}
      <ChartCard title="Atenciones por Día de la Semana" isPrinting={isPrinting}>
        <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={370}>
          <BarChart data={ambDiasSemana} margin={{ top: 5, right: 10, left: -25, bottom: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <RechartsTooltip 
              cursor={{ fill: '#f1f5f9' }} 
              content={<DiaSemanaTooltip />} 
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Atenciones" />
          </BarChart>
        </PrintOptimizedContainer>
      </ChartCard>

      {/* 1.b Distribución por Rango Etario */}
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

      {/* 2. Distribución por Sexo */}
      <ChartCard title="Por Sexo" isPrinting={isPrinting}>
        <PrintOptimizedContainer height={140} isPrinting={isPrinting} width={370}>
          <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Pie data={ambSexos} innerRadius={20} outerRadius={45} paddingAngle={4} dataKey="count">
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

      {/* Top 7: Turnos por Profesional */}
      <ChartCard title="Top 7: Turnos por Profesional" isPrinting={isPrinting}>
        <PrintOptimizedContainer height={200} isPrinting={isPrinting} width={370}>
          <BarChart
            data={turnosPorProfesional}
            layout="vertical"
            margin={{ top: 5, right: 10, left: 10, bottom: -5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={110} 
              tick={{ fontSize: 9 }} 
              tickFormatter={(val) => typeof val === 'string' && val.length > 20 ? val.slice(0, 18) + '...' : val} 
            />
            <RechartsTooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: "4px", border: "none", padding: "4px" }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Turnos" />
          </BarChart>
        </PrintOptimizedContainer>
      </ChartCard>

      {/* Top 5: Origen del Paciente (Dpto) (si existe en los datos) */}
      {ambTopPacDpto.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
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
      )}

      {/* Top 5: Cobertura Social (si existe en los datos) */}
      {ambTopCobertura.length > 0 && (
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
      )}

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
