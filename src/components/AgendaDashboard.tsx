import React, { useMemo } from 'react';
import { Agenda, Filters, FechaAgenda, Profesional } from '../types';
import FiltersPanel from './FiltersPanel';
import AgendaKPICards from './AgendaKPICards';
import AgendaCharts from './AgendaCharts';
import AgendaTables from './AgendaTables';
import { CalendarRange, Info } from 'lucide-react';

interface Props {
  agendas: Agenda[];
  fechaAgenda?: FechaAgenda[];
  profesionales?: Profesional[];
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  isPrinting?: boolean;
}

export default function AgendaDashboard({
  agendas,
  fechaAgenda = [],
  profesionales = [],
  filters,
  setFilters,
  isPrinting = false
}: Props) {
  // Helper to match canal filter
  const matchesCanal = (a: Agenda, canal: string) => {
    if (canal === 'Hospital') return (a.progTHos > 0 || a.otorgTHos > 0 || a.dispoTHos > 0 || a.progDHos > 0);
    if (canal === 'BOT') return (a.progTBot > 0 || a.otorgTBot > 0 || a.dispoTBot > 0 || a.progDBot > 0);
    if (canal === 'CALL') return (a.progTCall > 0 || a.otorgTCall > 0 || a.dispoTCall > 0 || a.progDCall > 0);
    if (canal === 'H-B-C') {
      return (
        a.progTHos > 0 || a.otorgTHos > 0 || a.dispoTHos > 0 || a.progDHos > 0 ||
        a.progTBot > 0 || a.otorgTBot > 0 || a.dispoTBot > 0 || a.progDBot > 0 ||
        a.progTCall > 0 || a.otorgTCall > 0 || a.dispoTCall > 0 || a.progDCall > 0
      );
    }
    return true;
  };

  const filteredAgendas = useMemo(() => {
    return agendas.filter(item => {
      if (filters.dpto && filters.dpto.length > 0 && !filters.dpto.includes(item.dpto)) return false;
      if (filters.caps && filters.caps.length > 0 && !filters.caps.includes(item.caps)) return false;
      if (filters.especialidad && filters.especialidad.length > 0 && !filters.especialidad.includes(item.especialidad)) return false;
      if (filters.profesional && filters.profesional.length > 0 && !filters.profesional.includes(item.profesional)) return false;
      if (filters.diaSemana && filters.diaSemana.length > 0 && !filters.diaSemana.includes(item.diaSemana)) return false;
      if (filters.canal && filters.canal.length > 0 && !filters.canal.some(c => matchesCanal(item, c))) return false;
      return true;
    });
  }, [agendas, filters]);

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de Filtros */}
      <div className="bg-white p-2.5 rounded shadow-xs border border-slate-200">
        <FiltersPanel
          allData={agendas}
          filters={filters}
          setFilters={setFilters}
          activeTab="AGENDA"
        />
      </div>

      {/* Tarjetas KPI */}
      <AgendaKPICards
        data={filteredAgendas}
        selectedCanales={filters.canal}
      />

      {/* Tablas Detalladas y Resúmenes */}
      <AgendaTables
        data={filteredAgendas}
        profesionales={profesionales}
        isPrinting={isPrinting}
      />

      {/* Gráficos Analíticos */}
      <AgendaCharts
        data={filteredAgendas}
        isPrinting={isPrinting}
      />
    </div>
  );
}
