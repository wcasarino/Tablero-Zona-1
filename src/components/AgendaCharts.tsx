import React, { useMemo, useRef, useState } from 'react';
import { Agenda } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { cn } from '../lib/utils';
import DownloadPdfButton from './DownloadPdfButton';
import DownloadExcelButton from './DownloadExcelButton';

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

interface Props {
  data: Agenda[];
  isPrinting?: boolean;
}

export default function AgendaCharts({ data, isPrinting = false }: Props) {
  const chartDiaRef = useRef<HTMLDivElement>(null);
  const chartCanalesRef = useRef<HTMLDivElement>(null);
  const chartDistribucionCanalRef = useRef<HTMLDivElement>(null);
  const chartProgDByDiaRef = useRef<HTMLDivElement>(null);
  const chartKpisLibresRef = useRef<HTMLDivElement>(null);
  const chartDispoOtorgRef = useRef<HTMLDivElement>(null);
  const chartEspecialidadesRef = useRef<HTMLDivElement>(null);
  const chartCapsRef = useRef<HTMLDivElement>(null);
  const chartVentanaRef = useRef<HTMLDivElement>(null);

  const [canalFiltro, setCanalFiltro] = useState<'TODOS' | 'HOSPITAL' | 'BOT' | 'CALL'>('TODOS');

  // 1. Data por Día de la Semana con desglose por canales T, H, B, C
  const diaSemanaData = useMemo(() => {
    const order = ['LUNES', 'MARTES', 'MIERCOLES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'SÁBADO', 'DOMINGO'];
    const map = new Map<string, {
      dia: string;
      progT: number;
      otorgT: number;
      dispoT: number;
      // Canal T (Tod)
      progTTod: number;
      otorgTTod: number;
      dispoTTod: number;
      // Canal H (Hos)
      progTHos: number;
      otorgTHos: number;
      dispoTHos: number;
      // Canal B (Bot)
      progTBot: number;
      otorgTBot: number;
      dispoTBot: number;
      // Canal C (Call)
      progTCall: number;
      otorgTCall: number;
      dispoTCall: number;
      count: number;
    }>();

    order.forEach(d => {
      const normalized = d.replace('É', 'E').replace('Á', 'A');
      if (!map.has(normalized)) {
        map.set(normalized, {
          dia: normalized,
          progT: 0,
          otorgT: 0,
          dispoT: 0,
          progTTod: 0,
          otorgTTod: 0,
          dispoTTod: 0,
          progTHos: 0,
          otorgTHos: 0,
          dispoTHos: 0,
          progTBot: 0,
          otorgTBot: 0,
          dispoTBot: 0,
          progTCall: 0,
          otorgTCall: 0,
          dispoTCall: 0,
          count: 0
        });
      }
    });

    data.forEach(item => {
      const raw = String(item.diaSemana || '').trim().toUpperCase();
      const clean = raw.replace('É', 'E').replace('Á', 'A') || 'OTRO';
      let entry = map.get(clean);
      if (!entry) {
        entry = {
          dia: clean,
          progT: 0,
          otorgT: 0,
          dispoT: 0,
          progTTod: 0,
          otorgTTod: 0,
          dispoTTod: 0,
          progTHos: 0,
          otorgTHos: 0,
          dispoTHos: 0,
          progTBot: 0,
          otorgTBot: 0,
          dispoTBot: 0,
          progTCall: 0,
          otorgTCall: 0,
          dispoTCall: 0,
          count: 0
        };
        map.set(clean, entry);
      }
      entry.progT += item.progT || 0;
      entry.otorgT += item.otorgT || 0;
      entry.dispoT += item.dispoT || 0;

      entry.progTTod += item.progTTod || 0;
      entry.otorgTTod += item.otorgTTod || 0;
      entry.dispoTTod += item.dispoTTod || 0;

      entry.progTHos += item.progTHos || 0;
      entry.otorgTHos += item.otorgTHos || 0;
      entry.dispoTHos += item.dispoTHos || 0;

      entry.progTBot += item.progTBot || 0;
      entry.otorgTBot += item.otorgTBot || 0;
      entry.dispoTBot += item.dispoTBot || 0;

      entry.progTCall += item.progTCall || 0;
      entry.otorgTCall += item.otorgTCall || 0;
      entry.dispoTCall += item.dispoTCall || 0;

      entry.count += 1;
    });

    return Array.from(map.values()).filter(d => d.progT > 0 || d.otorgT > 0 || d.dispoT > 0 || d.count > 0);
  }, [data]);

  // 2. Data por Canal (Hospital, BOT, CALL)
  const canalData = useMemo(() => {
    let progHos = 0, otorgHos = 0, dispoHos = 0;
    let progBot = 0, otorgBot = 0, dispoBot = 0;
    let progCall = 0, otorgCall = 0, dispoCall = 0;

    data.forEach(item => {
      progHos += item.progTHos || 0;
      otorgHos += item.otorgTHos || 0;
      dispoHos += item.dispoTHos || 0;

      progBot += item.progTBot || 0;
      otorgBot += item.otorgTBot || 0;
      dispoBot += item.dispoTBot || 0;

      progCall += item.progTCall || 0;
      otorgCall += item.otorgTCall || 0;
      dispoCall += item.dispoTCall || 0;
    });

    return [
      { canal: 'Hospital', progT: progHos, otorgT: otorgHos, dispoT: dispoHos, ocupacion: progHos > 0 ? ((otorgHos / progHos) * 100).toFixed(1) : 0 },
      { canal: 'BOT', progT: progBot, otorgT: otorgBot, dispoT: dispoBot, ocupacion: progBot > 0 ? ((otorgBot / progBot) * 100).toFixed(1) : 0 },
      { canal: 'CALL', progT: progCall, otorgT: otorgCall, dispoT: dispoCall, ocupacion: progCall > 0 ? ((otorgCall / progCall) * 100).toFixed(1) : 0 },
    ];
  }, [data]);

  // 3. Distribución por Canal (ProgD de Hospital, BOT, CALL)
  const distribucionProgDData = useMemo(() => {
    let progDHos = 0;
    let progDBot = 0;
    let progDCall = 0;

    data.forEach(item => {
      progDHos += Number(item.progDHos) || 0;
      progDBot += Number(item.progDBot) || 0;
      progDCall += Number(item.progDCall) || 0;
    });

    const total = progDHos + progDBot + progDCall;

    return [
      { name: 'Hospital', canalKey: 'progDHos', value: progDHos, color: '#059669', pct: total > 0 ? ((progDHos / total) * 100).toFixed(1) : '0' },
      { name: 'Bot', canalKey: 'progDBot', value: progDBot, color: '#d97706', pct: total > 0 ? ((progDBot / total) * 100).toFixed(1) : '0' },
      { name: 'Call Center', canalKey: 'progDCall', value: progDCall, color: '#7c3aed', pct: total > 0 ? ((progDCall / total) * 100).toFixed(1) : '0' },
    ];
  }, [data]);

  // 4. Programación Diaria por Canal y Día de la Semana (ProgDHos, ProgDBot, ProgDCall)
  const progDByDiaData = useMemo(() => {
    const order = ['LUNES', 'MARTES', 'MIERCOLES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'SÁBADO', 'DOMINGO'];
    const map = new Map<string, {
      dia: string;
      progDHos: number;
      progDBot: number;
      progDCall: number;
      totalProgD: number;
      count: number;
    }>();

    order.forEach(d => {
      const normalized = d.replace('É', 'E').replace('Á', 'A');
      if (!map.has(normalized)) {
        map.set(normalized, {
          dia: normalized,
          progDHos: 0,
          progDBot: 0,
          progDCall: 0,
          totalProgD: 0,
          count: 0
        });
      }
    });

    data.forEach(item => {
      const raw = String(item.diaSemana || '').trim().toUpperCase();
      const clean = raw.replace('É', 'E').replace('Á', 'A') || 'OTRO';
      let entry = map.get(clean);
      if (!entry) {
        entry = {
          dia: clean,
          progDHos: 0,
          progDBot: 0,
          progDCall: 0,
          totalProgD: 0,
          count: 0
        };
        map.set(clean, entry);
      }
      const pHos = Number(item.progDHos) || 0;
      const pBot = Number(item.progDBot) || 0;
      const pCall = Number(item.progDCall) || 0;

      entry.progDHos += pHos;
      entry.progDBot += pBot;
      entry.progDCall += pCall;
      entry.totalProgD += (pHos + pBot + pCall);
      entry.count += 1;
    });

    return Array.from(map.values()).filter(d => d.totalProgD > 0 || d.count > 0);
  }, [data]);

  // 5. Cálculos para los 4 KPIs de % Libre por Canal
  const kpisLibresData = useMemo(() => {
    let dispoTodos = 0, progTodos = 0;
    let dispoHos = 0, progHos = 0;
    let dispoBot = 0, progBot = 0;
    let dispoCall = 0, progCall = 0;

    data.forEach(item => {
      dispoTodos += Number(item.dispoTTod) || 0;
      progTodos += Number(item.progTTod) || 0;

      dispoHos += Number(item.dispoTHos) || 0;
      progHos += Number(item.progTHos) || 0;

      dispoBot += Number(item.dispoTBot) || 0;
      progBot += Number(item.progTBot) || 0;

      dispoCall += Number(item.dispoTCall) || 0;
      progCall += Number(item.progTCall) || 0;
    });

    return {
      dispoTodos,
      progTodos,
      pctTodos: progTodos > 0 ? ((dispoTodos / progTodos) * 100).toFixed(1) : '0',
      dispoHos,
      progHos,
      pctHos: progHos > 0 ? ((dispoHos / progHos) * 100).toFixed(1) : '0',
      dispoBot,
      progBot,
      pctBot: progBot > 0 ? ((dispoBot / progBot) * 100).toFixed(1) : '0',
      dispoCall,
      progCall,
      pctCall: progCall > 0 ? ((dispoCall / progCall) * 100).toFixed(1) : '0',
    };
  }, [data]);

  // 6. Data para el gráfico circular de Disponibles vs Otorgados con filtro por canal
  const dispoOtorgData = useMemo(() => {
    let otorgados = 0;
    let disponibles = 0;

    data.forEach(item => {
      if (canalFiltro === 'TODOS') {
        otorgados += Number(item.otorgTTod) || 0;
        disponibles += Number(item.dispoTTod) || 0;
      } else if (canalFiltro === 'HOSPITAL') {
        otorgados += Number(item.otorgTHos) || 0;
        disponibles += Number(item.dispoTHos) || 0;
      } else if (canalFiltro === 'BOT') {
        otorgados += Number(item.otorgTBot) || 0;
        disponibles += Number(item.dispoTBot) || 0;
      } else if (canalFiltro === 'CALL') {
        otorgados += Number(item.otorgTCall) || 0;
        disponibles += Number(item.dispoTCall) || 0;
      }
    });

    const total = otorgados + disponibles;
    const pctDispo = total > 0 ? ((disponibles / total) * 100).toFixed(1) : '0';
    const pctOtorg = total > 0 ? ((otorgados / total) * 100).toFixed(1) : '0';

    return {
      otorgados,
      disponibles,
      total,
      pctDispo,
      pctOtorg,
      items: [
        { name: 'Disponibles', value: disponibles, color: '#f59e0b', pct: pctDispo },
        { name: 'Otorgados', value: otorgados, color: '#10b981', pct: pctOtorg }
      ]
    };
  }, [data, canalFiltro]);

  // 7. Top Especialidades
  const topEspecialidades = useMemo(() => {
    const map = new Map<string, { name: string; progT: number; otorgT: number; dispoT: number; count: number }>();
    data.forEach(item => {
      const esp = String(item.especialidad || 'Sin Especialidad').trim();
      const current = map.get(esp) || { name: esp, progT: 0, otorgT: 0, dispoT: 0, count: 0 };
      current.progT += item.progT || 0;
      current.otorgT += item.otorgT || 0;
      current.dispoT += item.dispoT || 0;
      current.count += 1;
      map.set(esp, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.progT - a.progT)
      .slice(0, 10);
  }, [data]);

  // 8. Top CAPS
  const topCaps = useMemo(() => {
    const map = new Map<string, { name: string; progT: number; otorgT: number; dispoT: number; dpto: string }>();
    data.forEach(item => {
      const caps = String(item.caps || 'Sin CAPS').trim();
      const current = map.get(caps) || { name: caps, progT: 0, otorgT: 0, dispoT: 0, dpto: item.dpto || '' };
      current.progT += item.progT || 0;
      current.otorgT += item.otorgT || 0;
      current.dispoT += item.dispoT || 0;
      map.set(caps, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.progT - a.progT)
      .slice(0, 10);
  }, [data]);

  // 9. Ventana distribución
  const ventanaData = useMemo(() => {
    const bins = {
      '0 a 7 días': 0,
      '8 a 14 días': 0,
      '15 a 30 días': 0,
      '> 30 días': 0
    };

    data.forEach(item => {
      const v = Number(item.ventana || 0);
      if (v <= 7) bins['0 a 7 días']++;
      else if (v <= 14) bins['8 a 14 días']++;
      else if (v <= 30) bins['15 a 30 días']++;
      else bins['> 30 días']++;
    });

    return Object.entries(bins).map(([name, value]) => ({ name, value }));
  }, [data]);

  return (
    <div className="flex flex-col gap-3">
      {/* Fila 1: Turnos por Día de la Semana y Distribución por Canal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Gráfico 1: Turnos por Día */}
        <div ref={chartDiaRef} className="bg-white p-3 rounded shadow-xs border border-slate-200 flex flex-col">
          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Turnos por Día de la Semana</h3>
              <p className="text-[10px] text-slate-400">Todos (azul), Hospital (verde), Bot (ámbar), Call Center (púrpura)</p>
            </div>
            <div className="flex items-center gap-1">
              <DownloadExcelButton
                title="Descargar Días de Semana XLSX"
                data={diaSemanaData.map(d => ({
                  'Día': d.dia,
                  'Todos - Otorgados': d.otorgTTod,
                  'Todos - Disponibles': d.dispoTTod,
                  'Hospital - Otorgados': d.otorgTHos,
                  'Hospital - Disponibles': d.dispoTHos,
                  'Bot - Otorgados': d.otorgTBot,
                  'Bot - Disponibles': d.dispoTBot,
                  'Call Center - Otorgados': d.otorgTCall,
                  'Call Center - Disponibles': d.dispoTCall,
                  'Total Otorgados': d.otorgT,
                  'Total Disponibles': d.dispoT,
                  'Total Programados': d.progT,
                  '% Ocupación': d.progT > 0 ? `${((d.otorgT / d.progT) * 100).toFixed(1)}%` : '0%'
                }))}
                filename="turnos-dia-semana-canales"
              />
              <DownloadPdfButton
                targetRef={chartDiaRef}
                filename="turnos-dia-semana-canales"
              />
            </div>
          </div>
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diaSemanaData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="dia" 
                  tick={{ fontSize: 9, fill: '#64748b' }} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                <RechartsTooltip 
                  formatter={(value: any, name: any) => [Number(value || 0).toLocaleString(), name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                />
                <Legend 
                  payload={[
                    { value: 'Todos', type: 'square', color: '#2563eb', id: 'tod' },
                    { value: 'Hospital', type: 'square', color: '#059669', id: 'hos' },
                    { value: 'Bot', type: 'square', color: '#d97706', id: 'bot' },
                    { value: 'Call Center', type: 'square', color: '#7c3aed', id: 'call' }
                  ]}
                  wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} 
                />
                
                {/* Canal T (Todos - Azul) */}
                <Bar dataKey="otorgTTod" name="Todos (Otorgados)" fill="#2563eb" stackId="tod" />
                <Bar dataKey="dispoTTod" name="Todos (Disponibles)" fill="#93c5fd" stackId="tod" radius={[2, 2, 0, 0]} />

                {/* Canal H (Hospital - Verde) */}
                <Bar dataKey="otorgTHos" name="Hospital (Otorgados)" fill="#059669" stackId="hos" />
                <Bar dataKey="dispoTHos" name="Hospital (Disponibles)" fill="#86efac" stackId="hos" radius={[2, 2, 0, 0]} />

                {/* Canal B (Bot - Ámbar) */}
                <Bar dataKey="otorgTBot" name="Bot (Otorgados)" fill="#d97706" stackId="bot" />
                <Bar dataKey="dispoTBot" name="Bot (Disponibles)" fill="#fde047" stackId="bot" radius={[2, 2, 0, 0]} />

                {/* Canal C (Call Center - Púrpura) */}
                <Bar dataKey="otorgTCall" name="Call Center (Otorgados)" fill="#7c3aed" stackId="call" />
                <Bar dataKey="dispoTCall" name="Call Center (Disponibles)" fill="#c4b5fd" stackId="call" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contenedor Fila 1 Derecho: 4 KPIs Cuadrados (% Libre por Canal) y Donut Disp vs Otorgados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 4 KPIs de % Libre por Canal en formato cuadrado */}
          <div ref={chartKpisLibresRef} className="bg-white p-3 rounded shadow-xs border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">% Libre por Canal</h3>
                <p className="text-[10px] text-slate-400">Disponibles / Programados</p>
              </div>
              <div className="flex items-center gap-1">
                <DownloadExcelButton
                  title="Descargar % Libre por Canal XLSX"
                  data={[
                    { Canal: 'Todos', '% Libre': `${kpisLibresData.pctTodos}%`, Disponibles: kpisLibresData.dispoTodos, Programados: kpisLibresData.progTodos, 'Detalle': `${kpisLibresData.dispoTodos} de ${kpisLibresData.progTodos} turnos.` },
                    { Canal: 'Hospital', '% Libre': `${kpisLibresData.pctHos}%`, Disponibles: kpisLibresData.dispoHos, Programados: kpisLibresData.progHos, 'Detalle': `${kpisLibresData.dispoHos} de ${kpisLibresData.progHos} turnos.` },
                    { Canal: 'Bot', '% Libre': `${kpisLibresData.pctBot}%`, Disponibles: kpisLibresData.dispoBot, Programados: kpisLibresData.progBot, 'Detalle': `${kpisLibresData.dispoBot} de ${kpisLibresData.progBot} turnos.` },
                    { Canal: 'Call Center', '% Libre': `${kpisLibresData.pctCall}%`, Disponibles: kpisLibresData.dispoCall, Programados: kpisLibresData.progCall, 'Detalle': `${kpisLibresData.dispoCall} de ${kpisLibresData.progCall} turnos.` }
                  ]}
                  filename="porcentaje-libre-canales"
                />
                <DownloadPdfButton
                  targetRef={chartKpisLibresRef}
                  filename="porcentaje-libre-canales"
                />
              </div>
            </div>
            
            {/* Cuadrícula 2x2 de KPIs */}
            <div className="grid grid-cols-2 gap-2 h-[200px]">
              {/* % Libre Todos */}
              <div className="bg-blue-50/60 border border-blue-100 rounded-md p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-tight">% Libre Todos</span>
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                </div>
                <div className="my-0.5">
                  <span className="text-xl font-black text-blue-950 leading-none">{kpisLibresData.pctTodos}%</span>
                </div>
                <span className="text-[9px] text-slate-500 font-medium leading-tight">
                  {kpisLibresData.dispoTodos.toLocaleString()} de {kpisLibresData.progTodos.toLocaleString()} turnos.
                </span>
              </div>

              {/* % Libre Hospital */}
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-md p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight">% Libre Hospital</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                </div>
                <div className="my-0.5">
                  <span className="text-xl font-black text-emerald-950 leading-none">{kpisLibresData.pctHos}%</span>
                </div>
                <span className="text-[9px] text-slate-500 font-medium leading-tight">
                  {kpisLibresData.dispoHos.toLocaleString()} de {kpisLibresData.progHos.toLocaleString()} turnos.
                </span>
              </div>

              {/* % Libre Bot */}
              <div className="bg-amber-50/60 border border-amber-100 rounded-md p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">% Libre Bot</span>
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                </div>
                <div className="my-0.5">
                  <span className="text-xl font-black text-amber-950 leading-none">{kpisLibresData.pctBot}%</span>
                </div>
                <span className="text-[9px] text-slate-500 font-medium leading-tight">
                  {kpisLibresData.dispoBot.toLocaleString()} de {kpisLibresData.progBot.toLocaleString()} turnos.
                </span>
              </div>

              {/* % Libre Call */}
              <div className="bg-purple-50/60 border border-purple-100 rounded-md p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-800 uppercase tracking-tight">% Libre Call</span>
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                </div>
                <div className="my-0.5">
                  <span className="text-xl font-black text-purple-950 leading-none">{kpisLibresData.pctCall}%</span>
                </div>
                <span className="text-[9px] text-slate-500 font-medium leading-tight">
                  {kpisLibresData.dispoCall.toLocaleString()} de {kpisLibresData.progCall.toLocaleString()} turnos.
                </span>
              </div>
            </div>
          </div>

          {/* Gráfico circular de Disponibles y Otorgados con filtro por canal */}
          <div ref={chartDispoOtorgRef} className="bg-white p-3 rounded shadow-xs border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Disp. vs Otorgados</h3>
                <p className="text-[10px] text-slate-400">Total y % Libre por Canal</p>
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={canalFiltro}
                  onChange={(e) => setCanalFiltro(e.target.value as any)}
                  className="text-[10px] font-semibold py-0.5 px-1 border border-slate-200 rounded bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  title="Filtrar por canal"
                >
                  <option value="TODOS">TODOS</option>
                  <option value="HOSPITAL">HOSPITAL</option>
                  <option value="BOT">BOT</option>
                  <option value="CALL">CALL</option>
                </select>
                <DownloadExcelButton
                  title="Descargar Disponibles vs Otorgados XLSX"
                  data={dispoOtorgData.items.map(i => ({
                    'Canal Filtrado': canalFiltro,
                    'Estado': i.name,
                    'Cantidad': i.value,
                    '% del Total': `${i.pct}%`
                  }))}
                  filename={`disponibles-otorgados-${canalFiltro.toLowerCase()}`}
                />
                <DownloadPdfButton
                  targetRef={chartDispoOtorgRef}
                  filename={`disponibles-otorgados-${canalFiltro.toLowerCase()}`}
                />
              </div>
            </div>
            
            <div className="h-[200px] w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dispoOtorgData.items}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={38}
                    outerRadius={62}
                    paddingAngle={3}
                  >
                    {dispoOtorgData.items.map((entry, index) => (
                      <Cell key={`cell-do-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  {/* Porcentaje en el centro del Donut */}
                  <text x="50%" y="41%" textAnchor="middle" dominantBaseline="middle" className="text-base font-black fill-slate-800">
                    {dispoOtorgData.pctDispo}%
                  </text>
                  <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" className="text-[9px] font-bold fill-amber-600">
                    Libre
                  </text>
                  <RechartsTooltip
                    formatter={(value: any, name: any) => [
                      `${Number(value || 0).toLocaleString()} turnos`,
                      name
                    ]}
                    contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  />
                  <Legend
                    formatter={(value) => {
                      const item = dispoOtorgData.items.find(d => d.name === value);
                      return `${value}: ${item ? item.value.toLocaleString() : 0} (${item ? item.pct : '0'}%)`;
                    }}
                    wrapperStyle={{ fontSize: '9px', paddingTop: '2px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Fila 2: Programación Diaria por Canal y Contenedor Canales (Capacidad + Distribución) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Gráfico 3: Programación Diaria por Canal (ProgD) */}
        <div ref={chartProgDByDiaRef} className="bg-white p-3 rounded shadow-xs border border-slate-200 flex flex-col">
          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Programación Diaria por Canal</h3>
              <p className="text-[10px] text-slate-400">ProgD por Día: Hospital, Bot y Call Center (Barra Apilada)</p>
            </div>
            <div className="flex items-center gap-1">
              <DownloadExcelButton
                title="Descargar ProgD por Día XLSX"
                data={progDByDiaData.map(d => ({
                  'Día': d.dia,
                  'Hospital (ProgDHos)': d.progDHos,
                  'Bot (ProgDBot)': d.progDBot,
                  'Call Center (ProgDCall)': d.progDCall,
                  'Total ProgD': d.totalProgD
                }))}
                filename="progd-canal-por-dia"
              />
              <DownloadPdfButton
                targetRef={chartProgDByDiaRef}
                filename="progd-canal-por-dia"
              />
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progDByDiaData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="dia" 
                  tick={{ fontSize: 9, fill: '#64748b' }} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                <RechartsTooltip 
                  formatter={(value: any, name: any) => [Number(value || 0).toLocaleString(), name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                <Bar dataKey="progDHos" name="Hospital" fill="#059669" stackId="progD" />
                <Bar dataKey="progDBot" name="Bot" fill="#d97706" stackId="progD" />
                <Bar dataKey="progDCall" name="Call Center" fill="#7c3aed" stackId="progD" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contenedor Canales: Capacidad (apilada) y Distribución ProgD (circular) que comparten el mismo espacio */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Gráfico 2A: Capacidad por Canal de Atención (Barra Apilada Otorgados + Disponibles) */}
          <div ref={chartCanalesRef} className="bg-white p-3 rounded shadow-xs border border-slate-200 flex flex-col">
            <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Capacidad por Canal</h3>
                <p className="text-[10px] text-slate-400">Otorgados y Disponibles (apilada)</p>
              </div>
              <div className="flex items-center gap-1">
                <DownloadExcelButton
                  title="Descargar Canales de Atención XLSX"
                  data={canalData.map(c => ({
                    'Canal': c.canal,
                    'Otorgados': c.otorgT,
                    'Disponibles': c.dispoT,
                    'Total Programados': c.progT,
                    '% Ocupación': `${c.ocupacion}%`
                  }))}
                  filename="capacidad-por-canal"
                />
                <DownloadPdfButton
                  targetRef={chartCanalesRef}
                  filename="capacidad-por-canal"
                />
              </div>
            </div>
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={canalData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="canal" tick={{ fontSize: 10, fill: '#334155', fontWeight: 'bold' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                  <RechartsTooltip 
                    formatter={(value: any, name: any) => [Number(value || 0).toLocaleString(), name]}
                    contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                  <Bar dataKey="otorgT" name="Otorgados" fill="#10b981" stackId="canal" />
                  <Bar dataKey="dispoT" name="Disponibles" fill="#f59e0b" stackId="canal" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2B: Distribución por Canal (ProgD Circular) */}
          <div ref={chartDistribucionCanalRef} className="bg-white p-3 rounded shadow-xs border border-slate-200 flex flex-col">
            <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Distribución por Canal</h3>
                <p className="text-[10px] text-slate-400">ProgD (Hospital, Bot, Call)</p>
              </div>
              <div className="flex items-center gap-1">
                <DownloadExcelButton
                  title="Descargar Distribución por Canal XLSX"
                  data={distribucionProgDData.map(c => ({
                    'Canal': c.name,
                    'ProgD (Diario)': c.value,
                    '% del Total': `${c.pct}%`
                  }))}
                  filename="distribucion-progd-canal"
                />
                <DownloadPdfButton
                  targetRef={chartDistribucionCanalRef}
                  filename="distribucion-progd-canal"
                />
              </div>
            </div>
            <div className="h-[210px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribucionProgDData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={36}
                    outerRadius={62}
                    paddingAngle={3}
                  >
                    {distribucionProgDData.map((entry, index) => (
                      <Cell key={`cell-canal-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: any, name: any) => [
                      `${Number(value || 0).toLocaleString()} turnos diarios`,
                      name
                    ]}
                    contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  />
                  <Legend 
                    formatter={(value) => {
                      const item = distribucionProgDData.find(d => d.name === value);
                      return `${value} (${item ? item.pct : '0'}%)`;
                    }}
                    wrapperStyle={{ fontSize: '9px', paddingTop: '2px' }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Fila 3: Top Especialidades y Top CAPS (lado a lado) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Gráfico 4: Top Especialidades */}
        <div ref={chartEspecialidadesRef} className="bg-white p-3 rounded shadow-xs border border-slate-200 flex flex-col">
          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Top Especialidades con Mayor Oferta</h3>
              <p className="text-[10px] text-slate-400">Turnos Programados vs Otorgados</p>
            </div>
            <div className="flex items-center gap-1">
              <DownloadExcelButton
                title="Descargar Top Especialidades XLSX"
                data={topEspecialidades.map(e => ({
                  'Especialidad': e.name,
                  'Programados': e.progT,
                  'Otorgados': e.otorgT,
                  'Disponibles': e.dispoT,
                  '% Ocupación': e.progT > 0 ? `${((e.otorgT / e.progT) * 100).toFixed(1)}%` : '0%'
                }))}
                filename="top-especialidades-agenda"
              />
              <DownloadPdfButton
                targetRef={chartEspecialidadesRef}
                filename="top-especialidades-agenda"
              />
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topEspecialidades}
                margin={{ top: 5, right: 20, left: 35, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 9, fill: '#475569' }}
                  width={100}
                />
                <RechartsTooltip contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="progT" name="Programados" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                <Bar dataKey="otorgT" name="Otorgados" fill="#10b981" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 5: Top CAPS */}
        <div ref={chartCapsRef} className="bg-white p-3 rounded shadow-xs border border-slate-200 flex flex-col">
          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Top CAPS por Capacidad de Agenda</h3>
              <p className="text-[10px] text-slate-400">Centros de Salud con más turnos ofertados</p>
            </div>
            <div className="flex items-center gap-1">
              <DownloadExcelButton
                title="Descargar Top CAPS XLSX"
                data={topCaps.map(c => ({
                  'CAPS': c.name,
                  'Departamento': c.dpto,
                  'Programados': c.progT,
                  'Otorgados': c.otorgT,
                  'Disponibles': c.dispoT,
                  '% Ocupación': c.progT > 0 ? `${((c.otorgT / c.progT) * 100).toFixed(1)}%` : '0%'
                }))}
                filename="top-caps-agenda"
              />
              <DownloadPdfButton
                targetRef={chartCapsRef}
                filename="top-caps-agenda"
              />
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topCaps}
                margin={{ top: 5, right: 20, left: 35, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 9, fill: '#475569' }}
                  width={120}
                />
                <RechartsTooltip contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="progT" name="Programados" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                <Bar dataKey="otorgT" name="Otorgados" fill="#06b6d4" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
