import React, { useMemo, useState } from 'react';
import { Turno, Filters, Profesional, Agenda } from '../types';
import { Filter, Calendar, Users, Building, Stethoscope, Eraser, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  allData: any[];
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  profesionales?: Profesional[];
  activeTab?: 'AMBULATORIO' | 'GUARDIA' | 'AGENDA';
}

export default function FiltersPanel({ 
  allData, 
  filters, 
  setFilters, 
  profesionales = [], 
  activeTab = 'AMBULATORIO'
}: Props) {
  const options = useMemo(() => {
    const isWithinDate = (dateRaw: string) => {
      if (!filters.dateFrom && !filters.dateTo) return true;
      const d = new Date(dateRaw);
      const from = filters.dateFrom ? new Date(filters.dateFrom) : new Date(0);
      const to = filters.dateTo ? new Date(filters.dateTo) : new Date(8640000000000000);
      return d >= from && d <= to;
    };

    if (activeTab === 'AGENDA') {
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

      const matchesSelectedCanales = (a: Agenda, selectedCanales?: string[]) => {
        if (!selectedCanales || selectedCanales.length === 0) return true;
        return selectedCanales.some(canal => matchesCanal(a, canal));
      };

      const getAgendaAvailable = (field: 'dpto' | 'caps' | 'especialidad' | 'profesional' | 'diaSemana') => {
        return Array.from(new Set(allData.filter(item => {
          const a = item as Agenda;
          if (field !== 'dpto' && filters.dpto && filters.dpto.length > 0 && !filters.dpto.includes(a.dpto)) return false;
          if (field !== 'caps' && filters.caps && filters.caps.length > 0 && !filters.caps.includes(a.caps)) return false;
          if (field !== 'especialidad' && filters.especialidad && filters.especialidad.length > 0 && !filters.especialidad.includes(a.especialidad)) return false;
          if (field !== 'profesional' && filters.profesional && filters.profesional.length > 0 && !filters.profesional.includes(a.profesional)) return false;
          if (field !== 'diaSemana' && filters.diaSemana && filters.diaSemana.length > 0 && !filters.diaSemana.includes(a.diaSemana)) return false;
          if (filters.canal && filters.canal.length > 0 && !matchesSelectedCanales(a, filters.canal)) return false;
          return true;
        }).map(item => String(item[field] || ''))))
        .filter(Boolean)
        .sort((a, b) => {
          if (field === 'diaSemana') {
            const order = ['LUNES', 'MARTES', 'MIERCOLES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'SÁBADO', 'DOMINGO'];
            const idxA = order.indexOf(a.toUpperCase());
            const idxB = order.indexOf(b.toUpperCase());
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          }
          return a.localeCompare(b);
        });
      };

      const baseCanales = ['H-B-C', 'Hospital', 'BOT', 'CALL'];
      const getAvailableCanales = () => {
        const matchingRecords = allData.filter(item => {
          const a = item as Agenda;
          if (filters.dpto && filters.dpto.length > 0 && !filters.dpto.includes(a.dpto)) return false;
          if (filters.caps && filters.caps.length > 0 && !filters.caps.includes(a.caps)) return false;
          if (filters.especialidad && filters.especialidad.length > 0 && !filters.especialidad.includes(a.especialidad)) return false;
          if (filters.profesional && filters.profesional.length > 0 && !filters.profesional.includes(a.profesional)) return false;
          if (filters.diaSemana && filters.diaSemana.length > 0 && !filters.diaSemana.includes(a.diaSemana)) return false;
          return true;
        }) as Agenda[];

        if (matchingRecords.length === 0) return baseCanales;
        return baseCanales.filter(c => matchingRecords.some(a => matchesCanal(a, c)));
      };

      return {
        dptos: getAgendaAvailable('dpto'),
        caps: getAgendaAvailable('caps'),
        especialidades: getAgendaAvailable('especialidad'),
        profesionales: getAgendaAvailable('profesional'),
        diasSemana: getAgendaAvailable('diaSemana'),
        canales: getAvailableCanales(),
        tipos: [] as string[],
        anotadores: [] as string[],
        urgencias: [] as string[],
        egresos: [] as string[],
        triages: [] as string[],
        estados: [] as string[]
      };
    }

    if (activeTab === 'GUARDIA') {
      const getGuardiaAvailable = (field: keyof Filters, dataField: string) => {
        return Array.from(new Set(allData.filter(g => {
          if (!isWithinDate(g.fecha)) return false;
          if (field !== 'caps' && filters.caps.length > 0 && !filters.caps.includes(g.caps)) return false;
          if (field !== 'profesional' && filters.profesional.length > 0 && !filters.profesional.includes(g.profesional)) return false;
          if (field !== 'urgencia' && filters.urgencia && filters.urgencia.length > 0 && !filters.urgencia.includes(g.urgencia)) return false;
          if (field !== 'egreso' && filters.egreso && filters.egreso.length > 0 && !filters.egreso.includes(g.egreso)) return false;
          if (field !== 'triage' && filters.triage && filters.triage.length > 0 && !filters.triage.includes(g.nivel)) return false;
          if (field !== 'estado' && filters.estado && filters.estado.length > 0 && !filters.estado.includes(g.estadoEgreso)) return false;
          return true;
        }).map(g => String(g[dataField] || ''))))
        .filter(Boolean)
        .sort();
      };
      
      return {
        dptos: [] as string[],
        caps: getGuardiaAvailable('caps', 'caps'),
        especialidades: [] as string[],
        profesionales: getGuardiaAvailable('profesional', 'profesional'),
        tipos: [] as string[],
        anotadores: [] as string[],
        diasSemana: [] as string[],
        canales: [] as string[],
        urgencias: getGuardiaAvailable('urgencia', 'urgencia'),
        egresos: getGuardiaAvailable('egreso', 'egreso'),
        triages: getGuardiaAvailable('triage', 'nivel'),
        estados: getGuardiaAvailable('estado', 'estadoEgreso')
      };
    }

    const getAvailable = (field: keyof Filters, dataField: string) => {
      return Array.from(new Set(allData.filter(t => {
        if (!isWithinDate(t.fecha)) return false;
        if (field !== 'dpto' && filters.dpto.length > 0 && !filters.dpto.includes(t.dpto)) return false;
        if (field !== 'caps' && filters.caps.length > 0 && !filters.caps.includes(t.caps)) return false;
        if (field !== 'especialidad' && filters.especialidad.length > 0 && !filters.especialidad.includes(t.especialidad)) return false;
        if (field !== 'profesional' && filters.profesional.length > 0 && !filters.profesional.includes(t.profesional)) return false;
        if (field !== 'tipo' && filters.tipo && filters.tipo.length > 0 && !filters.tipo.includes(t.tipo)) return false;
        if (field !== 'anotador' && filters.anotador && filters.anotador.length > 0 && !filters.anotador.includes(t.anotador)) return false;
        return true;
      }).map(t => String(t[dataField] || ''))))
      .filter(Boolean)
      .sort();
    };

    const availableTipos = (() => {
      const fromData = getAvailable('tipo', 'tipo');
      if (fromData.length > 0 && !fromData.includes('Sin Anotador')) return fromData;
      return ['Con Turno', 'Sin Turno'];
    })();

    const availableAnotadores = (() => {
      const fromData = getAvailable('anotador', 'anotador');
      if (fromData.length > 0 && !fromData.every(x => x === 'Desconocido' || !x)) return fromData;
      return ['CAPS', 'BOT', 'CALL'];
    })();

    return {
      dptos: getAvailable('dpto', 'dpto'),
      caps: getAvailable('caps', 'caps'),
      especialidades: getAvailable('especialidad', 'especialidad'),
      profesionales: getAvailable('profesional', 'profesional'),
      tipos: availableTipos,
      anotadores: availableAnotadores,
      diasSemana: [] as string[],
      canales: [] as string[],
      urgencias: [] as string[],
      egresos: [] as string[],
      triages: [] as string[],
      estados: [] as string[]
    };
  }, [allData, filters, activeTab]);

  const handleToggle = (field: keyof Filters, value: string) => {
    setFilters(prev => {
      const current = (prev[field] as string[]) || [];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(v => v !== value) };
      }
      return { ...prev, [field]: [...current, value] };
    });
  };

  const clearFilters = () => {
    setFilters({ 
      dpto: [], 
      caps: [], 
      especialidad: [], 
      profesional: [], 
      tipo: [],
      anotador: [],
      diaSemana: [],
      canal: [],
      dateFrom: null, 
      dateTo: null, 
      conCargaHoraria: false,
    });
  };

  const handleDownloadProfesionales = () => {
    const tableData: any[] = [];
    
    profesionales.forEach(pro => {
      const turnosPro = allData.filter(t => {
        if (!t.dniPro || !pro.dniPro) return false;
        return t.dniPro.trim().toLowerCase() === pro.dniPro.trim().toLowerCase();
      });
      if (turnosPro.length > 0) {
        const combos = new Set<string>();
        turnosPro.forEach(t => {
          const name = t.profesional || pro.profesional || '';
          const esp = t.especialidad || '';
          const combo = `${name}|${esp}`;
          if (!combos.has(combo)) {
            combos.add(combo);
            tableData.push({ profesional: name, especialidad: esp, cargaH: pro.cargaH || '', turEsp: pro.turEsp || '' });
          }
        });
      } else {
         tableData.push({ profesional: pro.profesional || `DNI-${pro.dniPro}`, especialidad: '-', cargaH: pro.cargaH || '', turEsp: pro.turEsp || '' });
      }
    });

    tableData.sort((a, b) => {
      const cmpNombre = (a.profesional || '').localeCompare(b.profesional || '');
      if (cmpNombre !== 0) return cmpNombre;
      const cmpEsp = (a.especialidad || '').localeCompare(b.especialidad || '');
      return cmpEsp;
    });

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Listado de Profesionales", 14, 15);
    doc.setFontSize(10);
    doc.text(`Total: ${tableData.length}`, 14, 21);

    autoTable(doc, {
      startY: 25,
      head: [['Profesional', 'Especialidad', 'CargaH', 'TurEsp']],
      body: tableData.map(r => [r.profesional, r.especialidad, r.cargaH, r.turEsp]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save("listado-profesionales.pdf");
  };

  const { minAvailableDate, maxAvailableDate } = useMemo(() => {
    if (!allData || allData.length === 0) return { minAvailableDate: undefined, maxAvailableDate: undefined };
    const dates = allData
      .map(d => d.fecha)
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0);
    if (dates.length === 0) return { minAvailableDate: undefined, maxAvailableDate: undefined };
    const sorted = [...dates].sort();
    return {
      minAvailableDate: sorted[0],
      maxAvailableDate: sorted[sorted.length - 1]
    };
  }, [allData]);

  return (
    <div className="flex w-full gap-2.5 items-start flex-wrap">
      {activeTab !== 'AGENDA' && (
        <div className="flex flex-col min-w-[200px]">
          <div className="flex gap-1.5 items-center text-xs mt-1">
            <div className="flex flex-col flex-1">
              <span className="text-[9px] text-slate-500 font-bold mb-0.5 uppercase">DESDE</span>
              <input 
                type="date" 
                min={minAvailableDate}
                max={filters.dateTo || maxAvailableDate}
                className="border rounded p-1 bg-slate-50 text-[10px] text-slate-700 w-full" 
                value={filters.dateFrom || ''} 
                onChange={(e) => setFilters(p => ({...p, dateFrom: e.target.value || null}))}
              />
            </div>
            <span className="text-slate-400 font-bold self-end mb-1.5">-</span>
            <div className="flex flex-col flex-1">
              <span className="text-[9px] text-slate-500 font-bold mb-0.5 uppercase">HASTA</span>
              <input 
                type="date" 
                min={filters.dateFrom || minAvailableDate}
                max={maxAvailableDate}
                className="border rounded p-1 bg-slate-50 text-[10px] text-slate-700 w-full" 
                value={filters.dateTo || ''} 
                onChange={(e) => setFilters(p => ({...p, dateTo: e.target.value || null}))}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'AGENDA' ? (
        <>
          <FilterSelect title="DPTO" field="dpto" options={options.dptos} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
          <FilterSelect title="CAPS" field="caps" options={options.caps} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
          <FilterSelect title="Especialidad" field="especialidad" options={options.especialidades} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
          <FilterSelect title="Profesional" field="profesional" options={options.profesionales} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
          <FilterSelect title="Día Semana" field="diaSemana" options={options.diasSemana} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
        </>
      ) : activeTab === 'GUARDIA' ? (
        <>
          <FilterSelect title="CAPS" field="caps" options={options.caps} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
          <FilterSelect title="Urgencia" field="urgencia" options={options.urgencias} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
          <FilterSelect title="Egreso" field="egreso" options={options.egresos} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
          <FilterSelect title="Estado" field="estado" options={options.estados} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
          <FilterSelect title="Profesional" field="profesional" options={options.profesionales} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
        </>
      ) : (
        <>
          <FilterSelect title="Departamento" field="dpto" options={options.dptos} filters={filters} setFilters={setFilters} onToggle={handleToggle} />
          <FilterSelect title="CAPS" field="caps" options={options.caps} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
          <FilterSelect title="Especialidad" field="especialidad" options={options.especialidades} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
          <FilterSelect title="Profesional" field="profesional" options={options.profesionales} filters={filters} setFilters={setFilters} onToggle={handleToggle} showSearch={true} />
        </>
      )}

      {activeTab === 'AMBULATORIO' && (
        <div className="flex items-center gap-1.5 self-center mt-6 pr-2 border-l border-slate-200 pl-4">
          <input 
            type="checkbox" 
            id="conCargaHoraria" 
            checked={filters.conCargaHoraria}
            onChange={(e) => setFilters(p => ({ ...p, conCargaHoraria: e.target.checked }))}
            className="w-3.5 h-3.5 shrink-0 accent-blue-600"
          />
          <label htmlFor="conCargaHoraria" className="text-[11px] font-semibold text-slate-700 whitespace-nowrap cursor-pointer select-none">
            Con Carga Horaria
          </label>
        </div>
      )}

      <div className="flex-1" />
      
      <div className="flex flex-col gap-1 mt-[2px] shrink-0 justify-end h-full">
        <button onClick={clearFilters} className="text-xs bg-slate-200 text-slate-600 hover:bg-slate-300 font-semibold px-3 py-1 tracking-tight rounded transition-colors w-full text-center" title="Limpiar Filtros">
          Limpiar Filtros
        </button>
        {activeTab === 'AMBULATORIO' && (
          <button onClick={handleDownloadProfesionales} className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold px-2 py-0.5 tracking-tight rounded border border-indigo-200 transition-colors w-full text-center flex items-center justify-center gap-1 mt-0.5" title="Descargar Profesionales">
            <Download className="w-3 h-3" /> Descargar Pro
          </button>
        )}
      </div>
    </div>
  );
}

export function FilterSelect({ 
  title, 
  field, 
  options, 
  filters, 
  setFilters,
  onToggle, 
  showSearch = false,
  icon
}: { 
  title: string, 
  field: keyof Filters, 
  options: string[], 
  filters: Filters, 
  setFilters: React.Dispatch<React.SetStateAction<Filters>>,
  onToggle: (field: keyof Filters, value: string) => void,
  showSearch?: boolean,
  icon?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const selected = (filters[field] as string[]) || [];
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setSearchTerm('');
    }
  }, [open]);

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [options, searchTerm]);

  // Check if ALL filtered options are currently selected
  const areAllFilteredSelected = React.useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.every(opt => selected.includes(opt));
  }, [filteredOptions, selected]);

  const handleSelectAllToggle = () => {
    if (areAllFilteredSelected) {
      // Deselect all currently filtered options
      setFilters(prev => ({
        ...prev,
        [field]: ((prev[field] as string[]) || []).filter(v => !filteredOptions.includes(v))
      }));
    } else {
      // Select all currently filtered options (union with already selected options)
      setFilters(prev => {
        const current = (prev[field] as string[]) || [];
        const union = Array.from(new Set([...current, ...filteredOptions]));
        return {
          ...prev,
          [field]: union
        };
      });
    }
  };

  return (
    <div className="flex flex-col flex-1 min-w-[120px] max-w-[170px] relative" ref={wrapperRef}>
      <label className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">{title}</label>
      <div 
        className="text-[11px] border rounded p-1.5 bg-slate-50 text-slate-700 cursor-pointer flex justify-between items-center h-8"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate pr-2 flex items-center gap-1.5">
          {icon}
          {selected.length === 0 ? 'Todos' : selected.length === 1 ? selected[0] : `Seleccionados (${selected.length})`}
        </span>
        <span className="text-[8px] text-slate-400">▼</span>
      </div>
      
      {open && (
        <div className="absolute top-full left-0 mt-1 w-[240px] max-h-72 bg-white border border-slate-200 shadow-md rounded-md z-50 text-xs text-slate-700 flex flex-col overflow-hidden">
          {showSearch && (
            <div className="p-1.5 border-b border-slate-100 bg-slate-50 flex items-center gap-1 shrink-0">
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Buscar ${title.toLowerCase()}...`}
                className="w-full text-[11px] border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 text-[10px] font-bold shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {showSearch && (
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 bg-slate-50 text-[10px] text-slate-500 select-none shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectAllToggle();
                }}
                className="text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={areAllFilteredSelected}
                  readOnly
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 w-3 h-3 cursor-pointer"
                />
                <span>{areAllFilteredSelected ? 'Deseleccionar Todos' : 'Seleccionar Todos'}</span>
              </button>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilters(prev => ({ ...prev, [field]: [] }));
                  }}
                  className="hover:text-red-600 font-semibold uppercase tracking-wider text-[9px]"
                >
                  Limpiar ({selected.length})
                </button>
              )}
            </div>
          )}

          <div className="overflow-y-auto flex-1 max-h-48 py-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-slate-400 italic text-center text-[11px]">No se encontraron resultados</div>
            ) : (
              filteredOptions.map(opt => {
                const isChecked = selected.includes(opt);
                return (
                  <label 
                    key={opt} 
                    className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer text-[11px] transition-colors ${isChecked ? 'bg-slate-50/50 font-medium text-slate-900' : 'text-slate-600'}`}
                  >
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={() => onToggle(field, opt)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 w-3.5 h-3.5"
                    />
                    <span className="truncate" title={opt}>{opt}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

