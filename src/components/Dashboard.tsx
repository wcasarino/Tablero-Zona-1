import React from 'react';
import { Turno, Profesional, Filters as FiltersType } from '../types';
import KPICards from './KPICards';
import FiltersPanel from './FiltersPanel';
import LeftCharts from './LeftCharts';
import ChartsOverview from './ChartsOverview';
import DataTables from './DataTables';
import ProductividadTable from './ProductividadTable';
import { cn } from '../lib/utils';

interface Props {
  data: any[];
  allData: any[];
  profesionales?: Profesional[];
  filters: FiltersType;
  setFilters: React.Dispatch<React.SetStateAction<FiltersType>>;
  isPrinting?: boolean;
  activeTab?: 'AMBULATORIO' | 'GUARDIA';
}

export default function Dashboard({ 
  data, 
  allData, 
  profesionales = [], 
  filters, 
  setFilters, 
  isPrinting = false, 
  activeTab = 'AMBULATORIO'
}: Props) {
  return (
    <div className={cn("flex flex-col flex-1 w-full", isPrinting ? "overflow-visible h-auto" : "overflow-y-auto")}>
      <nav className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap gap-3 items-start shrink-0 sticky top-0 z-20 shadow-2xs">
        <FiltersPanel 
          allData={allData} 
          filters={filters} 
          setFilters={setFilters} 
          profesionales={profesionales} 
          activeTab={activeTab} 
        />
      </nav>

      <section className="shrink-0 bg-slate-100 p-2 pb-1">
        <KPICards 
          data={data} 
          activeTab={activeTab} 
        />
      </section>

      {/* Tabla Productividad por Profesional ocupando el ancho de la pantalla debajo de KPIs */}
      <section className="shrink-0 bg-slate-100 px-2 pb-2">
        <ProductividadTable 
          data={data}
          profesionales={profesionales}
          isPrinting={isPrinting}
          activeTab={activeTab}
          setFilters={setFilters}
        />
      </section>

      {/* Debajo el resto de las columnas */}
      <main className={cn("flex-1 flex gap-2 p-2 bg-slate-50", isPrinting ? "overflow-visible h-auto" : "min-h-[500px]")}>
        <div className={cn(isPrinting ? "w-1/4 flex flex-col gap-2" : "w-1/4 flex flex-col gap-2 pr-1")}>
          <LeftCharts 
            data={data} 
            isPrinting={isPrinting} 
            activeTab={activeTab} 
            profesionales={profesionales}
          />
        </div>
        
        <div 
          className={cn(
            isPrinting ? "flex flex-col gap-2 w-2/4" : "flex flex-col gap-2 pr-1 w-2/4"
          )}
        >
          <ChartsOverview 
            data={data} 
            profesionales={profesionales} 
            isPrinting={isPrinting} 
            activeTab={activeTab} 
            setFilters={setFilters} 
          />
        </div>

        <div className={cn(isPrinting ? "w-1/4 flex flex-col gap-2" : "w-1/4 flex flex-col gap-2 pr-1")}>
          <DataTables 
            data={data} 
            profesionales={profesionales} 
            isPrinting={isPrinting} 
            activeTab={activeTab} 
            setFilters={setFilters} 
          />
        </div>
      </main>
    </div>
  );
}
