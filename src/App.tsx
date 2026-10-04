import React, { useMemo, useState, useRef, useEffect } from 'react';
import { initialData } from './data';
import { Filters, Turno, Profesional, Guardia, Agenda, FechaAgenda } from './types';
import Dashboard from './components/Dashboard';
import AgendaDashboard from './components/AgendaDashboard';
import { isWithinInterval, parseISO, format } from 'date-fns';
import { 
  RefreshCw, 
  FileSpreadsheet, 
  ShieldAlert, 
  AlertTriangle, 
  Check, 
  X, 
  Download 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  fetchTurnos,
  replaceTurnos,
  testConnection,
  clearAllTurnos,
  fetchProfesionales,
  replaceProfesionales,
  clearAllProfesionales,
  fetchGuardias,
  replaceGuardias,
  clearAllGuardias,
  fetchAgendas,
  replaceAgendas,
  fetchFechaAgenda,
  replaceFechaAgenda,
  fetchGoogleSheetBuffer,
  getSheetsConfig,
  saveSheetsConfig
} from './firebase';

export default function App() {
  const [turnos, setTurnos] = useState<Turno[]>(initialData);
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [fechaAgenda, setFechaAgenda] = useState<FechaAgenda | null>(null);
  const [activeTab, setActiveTab] = useState<'AMBULATORIO' | 'GUARDIA' | 'AGENDA'>('AMBULATORIO');
  const [isLoading, setIsLoading] = useState(true);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [isSavingData, setIsSavingData] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [isCleaningData, setIsCleaningData] = useState(false);
  const [cleanupScope, setCleanupScope] = useState<'older' | 'all'>('older');
  const dashboardContainerRef = useRef<HTMLDivElement>(null);

  // Google Sheets integration state
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const activeAllData = useMemo(() => {
    return activeTab === 'AMBULATORIO' ? turnos : guardias;
  }, [activeTab, turnos, guardias]);

  const data = activeAllData; // alias to minimize component down-propagation changes

  const recordsToClean = useMemo(() => {
    return activeAllData.filter(t => t.fecha && t.fecha < "2026-05-10");
  }, [activeAllData]);

  const idsToClean = useMemo(() => {
    if (cleanupScope === 'all') {
      return activeAllData.map(t => t.id);
    }
    return recordsToClean.map(t => t.id);
  }, [cleanupScope, activeAllData, recordsToClean]);

  // States for cleanup authorization and compatibility errors
  const [cleanupPassword, setCleanupPassword] = useState('');
  const [cleanupPasswordError, setCleanupPasswordError] = useState('');
  const [showCompatibilityModal, setShowCompatibilityModal] = useState(false);
  const [compatibilityErrors, setCompatibilityErrors] = useState<string[]>([]);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successRecordsCount, setSuccessRecordsCount] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [filtersAmbulatorio, setFiltersAmbulatorio] = useState<Filters>({
    dpto: [],
    caps: [],
    especialidad: [],
    profesional: [],
    tipo: [],
    anotador: [],
    urgencia: [],
    egreso: [],
    triage: [],
    diaSemana: [],
    canal: [],
    dateFrom: null,
    dateTo: null,
    conCargaHoraria: false,
  });

  const [filtersGuardia, setFiltersGuardia] = useState<Filters>({
    dpto: [],
    caps: [],
    especialidad: [],
    profesional: [],
    tipo: [],
    anotador: [],
    urgencia: [],
    egreso: [],
    triage: [],
    estado: [],
    diaSemana: [],
    canal: [],
    dateFrom: null,
    dateTo: null,
    conCargaHoraria: false,
  });

  const [filtersAgenda, setFiltersAgenda] = useState<Filters>({
    dpto: [],
    caps: [],
    especialidad: [],
    profesional: [],
    tipo: [],
    anotador: [],
    urgencia: [],
    egreso: [],
    triage: [],
    estado: [],
    diaSemana: [],
    canal: [],
    dateFrom: null,
    dateTo: null,
    conCargaHoraria: false,
  });

  const filters = useMemo(() => {
    if (activeTab === 'AMBULATORIO') return filtersAmbulatorio;
    if (activeTab === 'GUARDIA') return filtersGuardia;
    return filtersAgenda;
  }, [activeTab, filtersAmbulatorio, filtersGuardia, filtersAgenda]);

  const setFilters = (val: React.SetStateAction<Filters>) => {
    if (activeTab === 'AMBULATORIO') {
      setFiltersAmbulatorio(val);
    } else if (activeTab === 'GUARDIA') {
      setFiltersGuardia(val);
    } else {
      setFiltersAgenda(val);
    }
  };

  const handleExecuteCleanup = async () => {
    if (idsToClean.length === 0) {
      alert("No hay registros seleccionados para depurar.");
      setShowCleanupModal(false);
      return;
    }
    
    if (cleanupScope === 'all') {
      if (cleanupPassword !== '654321') {
        setCleanupPasswordError('La contraseña introducida es incorrecta.');
        return;
      }
    }
    
    setIsCleaningData(true);
    setShowCleanupModal(false);
    
    try {
      if (isLocalMode) {
        if (activeTab === 'AMBULATORIO') {
          const updatedData = turnos.filter(t => !idsToClean.includes(t.id));
          setTurnos(updatedData);
          localStorage.setItem('remixed_turnos', JSON.stringify(updatedData));
          
          if (cleanupScope === 'all') {
            setProfesionales([]);
            localStorage.setItem('remixed_profesionales', JSON.stringify([]));
          }
        } else if (activeTab === 'GUARDIA') {
          const updatedData = guardias.filter(g => !idsToClean.includes(g.id));
          setGuardias(updatedData);
          localStorage.setItem('remixed_guardias', JSON.stringify(updatedData));
        }
        
        setFilters({ dpto: [], caps: [], especialidad: [], profesional: [], tipo: [], anotador: [], urgencia: [], egreso: [], triage: [], estado: [], diaSemana: [], canal: [], dateFrom: null, dateTo: null, conCargaHoraria: false });
      } else {
        if (activeTab === 'AMBULATORIO') {
          await clearAllTurnos(idsToClean);
          if (cleanupScope === 'all') {
            const profIds = profesionales.map(p => p.id);
            if (profIds.length > 0) {
              await clearAllProfesionales(profIds);
            }
            setProfesionales([]);
          }
          setTurnos(prev => prev.filter(t => !idsToClean.includes(t.id)));
        } else if (activeTab === 'GUARDIA') {
          await clearAllGuardias(idsToClean);
          setGuardias(prev => prev.filter(g => !idsToClean.includes(g.id)));
        }
        
        setFilters({ dpto: [], caps: [], especialidad: [], profesional: [], tipo: [], anotador: [], urgencia: [], egreso: [], triage: [], estado: [], diaSemana: [], canal: [], dateFrom: null, dateTo: null, conCargaHoraria: false });
      }
    } catch (err) {
      console.error("Error al depurar registros:", err);
      alert("Ocurrió un error al intentar eliminar los documentos. Intente de nuevo.");
    } finally {
      setIsCleaningData(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const isConnected = await testConnection();
        if (isConnected) {
          setIsLocalMode(false);
          const [turnosData, rawProfs, guardiasData, agendasData, fechaAgendaData] = await Promise.all([
            fetchTurnos(),
            fetchProfesionales(),
            fetchGuardias(),
            fetchAgendas(),
            fetchFechaAgenda()
          ]);
          if (turnosData && turnosData.length > 0) setTurnos(turnosData);
          if (rawProfs && rawProfs.length > 0) setProfesionales(rawProfs);
          if (guardiasData && guardiasData.length > 0) setGuardias(guardiasData);
          if (agendasData && agendasData.length > 0) setAgendas(agendasData);
          if (fechaAgendaData) setFechaAgenda(fechaAgendaData);

          // Si aún no hay datos cargados, sincronizar inmediatamente desde link.txt
          if (!turnosData || turnosData.length === 0) {
            syncFromGoogleSheets();
          }
        } else {
          setIsLocalMode(true);
          const storedTurnos = localStorage.getItem('remixed_turnos');
          const storedProfs = localStorage.getItem('remixed_profesionales');
          const storedGuardias = localStorage.getItem('remixed_guardias');
          const storedAgendas = localStorage.getItem('remixed_agendas');
          const storedFechaAgenda = localStorage.getItem('remixed_fecha_agenda');
          
          if (storedTurnos) setTurnos(JSON.parse(storedTurnos));
          else { localStorage.setItem('remixed_turnos', JSON.stringify(initialData)); setTurnos(initialData); }
          
          if (storedProfs) setProfesionales(JSON.parse(storedProfs));
          else { localStorage.setItem('remixed_profesionales', JSON.stringify([])); setProfesionales([]); }

          if (storedGuardias) setGuardias(JSON.parse(storedGuardias));
          else { localStorage.setItem('remixed_guardias', JSON.stringify([])); setGuardias([]); }

          if (storedAgendas) setAgendas(JSON.parse(storedAgendas));
          else { localStorage.setItem('remixed_agendas', JSON.stringify([])); setAgendas([]); }

          if (storedFechaAgenda) setFechaAgenda(JSON.parse(storedFechaAgenda));
        }
      } catch (err) {
        console.error("Error al cargar datos. Usando fallback local:", err);
        setIsLocalMode(true);
        const storedTurnos = localStorage.getItem('remixed_turnos');
        const storedProfs = localStorage.getItem('remixed_profesionales');
        const storedGuardias = localStorage.getItem('remixed_guardias');
        const storedAgendas = localStorage.getItem('remixed_agendas');
        const storedFechaAgenda = localStorage.getItem('remixed_fecha_agenda');

        setTurnos(storedTurnos ? JSON.parse(storedTurnos) : initialData);
        setProfesionales(storedProfs ? JSON.parse(storedProfs) : []);
        setGuardias(storedGuardias ? JSON.parse(storedGuardias) : []);
        setAgendas(storedAgendas ? JSON.parse(storedAgendas) : []);
        if (storedFechaAgenda) setFechaAgenda(JSON.parse(storedFechaAgenda));
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const getColLetter = (idx: number) => {
    let temp = idx + 1;
    let letter = '';
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - mod) / 26);
    }
    return letter;
  };

  const processWorkbookData = (workbook: XLSX.WorkBook) => {
    const turnosSheetName = workbook.SheetNames.find(n => n.trim().toLowerCase() === 'turnos');
    const profesionalesSheetName = workbook.SheetNames.find(n => n.trim().toLowerCase() === 'profesionales');
    const guardiasSheetName = workbook.SheetNames.find(n => n.trim().toLowerCase() === 'guardias');
    const agendasSheetName = workbook.SheetNames.find(n => n.trim().toLowerCase() === 'agendas' || n.trim().toLowerCase() === 'agenda');
    const fechaAgendaSheetName = workbook.SheetNames.find(n => n.trim().toLowerCase() === 'fechaagenda' || n.trim().toLowerCase() === 'fecha agenda' || n.trim().toLowerCase() === 'fecha_agenda');

    const errors: string[] = [];

    if (!turnosSheetName && !profesionalesSheetName && !guardiasSheetName && !agendasSheetName && !fechaAgendaSheetName) {
      errors.push('La planilla de Google Sheets no contiene ninguna de las hojas esperadas ("Turnos", "Guardias", "Profesionales", "Agendas", "FechaAgenda").');
    }
    let parsedTurnos: Turno[] = [];
    let parsedGuardias: Guardia[] = [];
    let parsedProfesionales: Profesional[] = [];
    let parsedAgendas: Agenda[] = [];
    let parsedFechaAgenda: FechaAgenda | null = null;

    // 1. Validar y procesar hoja Turnos
    if (turnosSheetName) {
      const worksheet = workbook.Sheets[turnosSheetName];
      const rowsAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const headers = rowsAsArrays.length > 0 ? (rowsAsArrays[0] as any[]) : [];
      const colIHeader = headers.length > 8 ? headers[8] : undefined;

      const expectedHeaders = [
        'Tipo', 'Dpto', 'CAPS', 'Especialidad', 'Profesional', 'Fecha', 'DNI',
        'FechaNacimiento', 'Sexo', 'PacProv', 'PacDpto', 'CoberturaSocial', 'Hora', 'TURNO', 'DNI-PRO', 'Días', 'Anotador'
      ];

      const actualHeaders = headers.map(h => String(h || '').trim());
      const missingTurnos: string[] = [];

      for (let i = 0; i < 17; i++) {
        const actual = actualHeaders[i] || '';
        const expected = expectedHeaders[i];
        if (actual.trim().toLowerCase() !== expected.toLowerCase()) {
          missingTurnos.push(`Hoja "Turnos" - Columna ${getColLetter(i)}: Se esperaba "${expected}" pero se encontró "${actual || 'vacía'}"`);
        }
      }

      if (headers.length < 17 || missingTurnos.length > 0) {
        errors.push(...missingTurnos);
        if (headers.length < 17) {
          errors.push(`La hoja "Turnos" solo contiene ${headers.length} columnas con datos (deben ser 17 de la A a la Q).`);
        }
      } else {
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        if (jsonData.length > 0) {
          parsedTurnos = jsonData.map((row: any, i: number) => {
            const fechaRaw = row['Fecha'] || row['fecha'];
            let fechaStr = '';
            if (fechaRaw instanceof Date) {
              fechaStr = format(fechaRaw, 'yyyy-MM-dd');
            } else if (typeof fechaRaw === 'string') {
              if (fechaRaw.includes('/')) {
                 const parts = fechaRaw.split('/');
                 if (parts.length === 3) {
                   fechaStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                 }
              } else {
                 fechaStr = fechaRaw;
              }
            }
            if (!fechaStr) fechaStr = format(new Date(), 'yyyy-MM-dd');

            let edad = Number(row['EDAD'] || row['edad'] || row['Edad'] || 0);
            const fechaNacRaw = row['FechaNacimiento'] || row['fechaNacimiento'] || row['Fecha Nacimiento'] || row['FECHANACIMIENTO'];
            if (fechaNacRaw) {
              let birthDate: Date | null = null;
              if (fechaNacRaw instanceof Date) {
                birthDate = fechaNacRaw;
              } else if (typeof fechaNacRaw === 'string') {
                if (fechaNacRaw.includes('/')) {
                   const parts = fechaNacRaw.split('/');
                   if (parts.length === 3) {
                     birthDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                   }
                } else {
                   birthDate = new Date(fechaNacRaw);
                }
              } else if (typeof fechaNacRaw === 'number') {
                birthDate = new Date(Math.round((fechaNacRaw - 25569) * 86400 * 1000));
              }

              if (birthDate && !isNaN(birthDate.getTime())) {
                const today = new Date();
                let years = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                  years--;
                }
                edad = years;
              }
            }

            const rawSexo = (colIHeader ? row[colIHeader] : undefined) ?? row['SEXO'] ?? row['sexo'] ?? row['Sexo'];
            const finalSexo: 'F' | 'M' = rawSexo === 'M' ? 'M' : 'F';

            return {
              id: `U-${Date.now()}-${i}`,
              fecha: fechaStr,
              dpto: row['Dpto'] || row['dpto'] || 'Desconocido',
              caps: row['CAPS'] || row['caps'] || 'Desconocido',
              especialidad: row['Especialidad'] || row['especialidad'] || 'Desconocido',
              profesional: row['Profesional'] || row['profesional'] || 'Desconocido',
              tipo: row['Tipo'] || row['tipo'] || row['TipoTurno'] || 'Programado',
              dni: String(row['DNI'] || row['dni'] || `DNI-${i}`),
              pacDpto: row['PacDpto'] || row['pacDpto'] || 'Desconocido',
              coberturaSocial: row['CoberturaSocial'] || row['coberturaSocial'] || row['Cobertura Social'] || 'Sin Cobertura',
              edad,
              sexo: finalSexo,
              turno: String(row['TURNO'] || row['turno'] || 'Mañana'),
              dniPro: String(row['DNI-PRO'] || row['dni-pro'] || row['DNI_PRO'] || row['Dni-Pro'] || row['Dni_Pro'] || '-').trim(),
              dias: Number(row['Días'] || row['días'] || row['Dias'] || row['dias']) || 0,
              anotador: String(row['Anotador'] || row['anotador'] || ''),
            };
          });
        }
      }
    }

    // 2. Validar y procesar hoja Profesionales
    if (profesionalesSheetName) {
      const worksheet = workbook.Sheets[profesionalesSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        parsedProfesionales = [];
      } else {
        const rowsAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = rowsAsArrays.length > 0 ? (rowsAsArrays[0] as any[]) : [];

        const expectedProHeaders = ['DNI-PRO', 'CargaH', 'TurEsp', 'Profesional'];
        const actualHeaders = headers.map(h => String(h || '').trim());
        const missingProfs: string[] = [];

        for (let i = 0; i < 4; i++) {
          const actual = actualHeaders[i] || '';
          const expected = expectedProHeaders[i];
          if (actual.trim().toLowerCase() !== expected.toLowerCase()) {
            missingProfs.push(`Hoja "Profesionales" - Columna ${getColLetter(i)}: Se esperaba "${expected}" pero se encontró "${actual || 'vacía'}"`);
          }
        }

        if (headers.length < 4 || missingProfs.length > 0) {
          errors.push(...missingProfs);
          if (headers.length < 4) {
            errors.push(`La hoja "Profesionales" solo contiene ${headers.length} columnas con datos (deben ser mínimo 4 columnas para DNI-PRO, CargaH, TurEsp, Profesional).`);
          }
        } else {
          parsedProfesionales = jsonData.map((row: any, i: number) => {
            const dniProVal = String(row['DNI-PRO'] || row['dni-pro'] || row['DNI_PRO'] || row['Dni-Pro'] || '').trim();
            const cargaHVal = String(row['CargaH'] || row['cargah'] || row['Carga H'] || row['CARGAH'] || '').trim();
            const turEspVal = String(row['TurEsp'] || row['turesp'] || row['Tur Esp'] || row['TURESP'] || '').trim();
            const profesionalVal = String(row['Profesional'] || row['profesional'] || row['PROFESIONAL'] || '').trim();

            return {
              id: dniProVal || `P-${Date.now()}-${i}`,
              dniPro: dniProVal,
              cargaH: cargaHVal || '0',
              turEsp: turEspVal || 'General',
              profesional: profesionalVal || 'Desconocido',
            };
          });
        }
      }
    } else {
      parsedProfesionales = [];
    }

    // 3. Validar y procesar hoja Guardias
    if (guardiasSheetName) {
      const worksheet = workbook.Sheets[guardiasSheetName];
      const rowsAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const headers = rowsAsArrays.length > 0 ? (rowsAsArrays[0] as any[]) : [];

      const expectedParams = [
        'CAPS', 'Fecha', 'Hora', 'Egreso', 'Edad', 'Nivel', 'MinutosEspera',
        'Profesional', 'DPTO', 'Diagnostico', 'Cobertura', 'Urgencia', 'EstadoEgreso', 'MotivoAlta'
      ];

      const actualHeaders = headers.map(h => String(h || '').trim());
      const missingGuardias: string[] = [];

      if (headers.length > 0) {
        for (let i = 0; i < 14; i++) {
          const actual = actualHeaders[i] || '';
          const expected = expectedParams[i];
          if (actual.trim().toLowerCase() !== expected.toLowerCase()) {
            missingGuardias.push(`Hoja "Guardias" - Columna ${getColLetter(i)}: Se esperaba "${expected}" pero se encontró "${actual || 'vacía'}"`);
          }
        }

        if (headers.length < 14 || missingGuardias.length > 0) {
          errors.push(...missingGuardias);
          if (headers.length < 14) {
            errors.push(`La hoja "Guardias" solo contiene ${headers.length} columnas con datos (deben ser 14 de la A a la N).`);
          }
        } else {
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
          if (jsonData.length > 0) {
            parsedGuardias = jsonData.map((row: any, i: number) => {
              const fechaRaw = row['Fecha'] || row['fecha'] || row['FECHA'];
              let fechaStr = '';
              if (fechaRaw instanceof Date) {
                fechaStr = format(fechaRaw, 'yyyy-MM-dd');
              } else if (typeof fechaRaw === 'string') {
                if (fechaRaw.includes('/')) {
                   const parts = fechaRaw.split('/');
                   if (parts.length === 3) {
                     fechaStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                   }
                } else {
                   fechaStr = fechaRaw;
                }
              } else if (typeof fechaRaw === 'number') {
                fechaStr = format(new Date(Math.round((fechaRaw - 25569) * 86400 * 1000)), 'yyyy-MM-dd');
              }
              if (!fechaStr) fechaStr = format(new Date(), 'yyyy-MM-dd');

              const edad = Number(row['Edad'] || row['edad'] || row['EDAD'] || 0);

              return {
                id: `G-${Date.now()}-${i}`,
                caps: String(row['CAPS'] || row['caps'] || row['Caps'] || 'Desconocido'),
                fecha: fechaStr,
                hora: String(row['Hora'] || row['hora'] || row['HORA'] || '-'),
                egreso: String(row['Egreso'] || row['egreso'] || row['EGRESO'] || '-'),
                edad,
                nivel: String(row['Nivel'] || row['nivel'] || row['NIVEL'] || 'General'),
                minutosEspera: Number(row['MinutosEspera'] || row['minutosEspera'] || row['Minutos Espera'] || row['MinutosEspera'] || 0),
                profesional: String(row['Profesional'] || row['profesional'] || row['PROFESIONAL'] || 'Desconocido'),
                dpto: String(row['DPTO'] || row['dpto'] || row['Dpto'] || 'Desconocido'),
                diagnostico: String(row['Diagnostico'] || row['diagnostico'] || row['DIAGNOSTICO'] || 'Desconocido'),
                cobertura: String(row['Cobertura'] || row['cobertura'] || row['COBERTURA'] || 'Sin Cobertura'),
                urgencia: String(row['Urgencia'] || row['urgencia'] || row['URGENCIA'] || 'Normal'),
                estadoEgreso: String(row['EstadoEgreso'] || row['estadoEgreso'] || row['Estado Egreso'] || 'Alta'),
                motivoAlta: String(row['MotivoAlta'] || row['motivoAlta'] || row['Motivo Alta'] || 'Alta Médica'),
              } as Guardia;
            });
          }
        }
      }
    }

    // 4. Validar y procesar hoja Agendas
    if (agendasSheetName) {
      const worksheet = workbook.Sheets[agendasSheetName];
      const rowsAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const headers = rowsAsArrays.length > 0 ? (rowsAsArrays[0] as any[]) : [];

      const expectedAgendasHeaders = [
        'DPTO', 'CAPS', 'Especialidad', 'Profesional', 'DiaSemana', 'Ventana',
        'ProgD', 'ProgDTod', 'ProgDHos', 'ProgDBot', 'ProgDCall', 'ProgDWid',
        'ProgT', 'ProgTTod', 'ProgTHos', 'ProgTBot', 'ProgTCall', 'ProgTWid',
        'OtorgT', 'OtorgTTod', 'OtorgTHos', 'OtorgTBot', 'OtorgTCall', 'OtorgTWid',
        'DispoT', 'DispoTTod', 'DispoTHos', 'DispoTBot', 'DispoTCall', 'DispoTWid',
        'DNIPRO'
      ];

      const actualHeaders = headers.map(h => String(h || '').trim());
      const missingAgendas: string[] = [];

      if (headers.length > 0) {
        for (let i = 0; i < 31; i++) {
          const actual = actualHeaders[i] || '';
          const expected = expectedAgendasHeaders[i];
          if (actual.trim().toLowerCase() !== expected.toLowerCase()) {
            missingAgendas.push(`Hoja "Agendas" - Columna ${getColLetter(i)}: Se esperaba "${expected}" pero se encontró "${actual || 'vacía'}"`);
          }
        }

        if (headers.length < 31 || missingAgendas.length > 0) {
          errors.push(...missingAgendas);
          if (headers.length < 31) {
            errors.push(`La hoja "Agendas" solo contiene ${headers.length} columnas con datos (deben ser 31 de la A a la AE).`);
          }
        } else {
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
          if (jsonData.length > 0) {
            const toNum = (val: any) => {
              if (val === undefined || val === null || val === '') return 0;
              const num = Number(val);
              return isNaN(num) ? 0 : num;
            };

            parsedAgendas = jsonData.map((row: any, i: number) => {
              return {
                id: `AG-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
                dpto: String(row['DPTO'] || row['dpto'] || row['Dpto'] || '').trim(),
                caps: String(row['CAPS'] || row['caps'] || row['Caps'] || '').trim(),
                especialidad: String(row['Especialidad'] || row['especialidad'] || row['ESPECIALIDAD'] || '').trim(),
                profesional: String(row['Profesional'] || row['profesional'] || row['PROFESIONAL'] || '').trim(),
                diaSemana: String(row['DiaSemana'] || row['diaSemana'] || row['Dia Semana'] || row['DIASEMANA'] || row['diasemana'] || '').trim(),
                ventana: toNum(row['Ventana'] ?? row['ventana'] ?? row['VENTANA']),
                progD: toNum(row['ProgD'] ?? row['progD'] ?? row['progd'] ?? row['PROGD']),
                progDTod: toNum(row['ProgDTod'] ?? row['progDTod'] ?? row['progdtod'] ?? row['PROGDTOD']),
                progDHos: toNum(row['ProgDHos'] ?? row['progDHos'] ?? row['progdhos'] ?? row['PROGDHOS']),
                progDBot: toNum(row['ProgDBot'] ?? row['progDBot'] ?? row['progdbot'] ?? row['PROGDBOT']),
                progDCall: toNum(row['ProgDCall'] ?? row['progDCall'] ?? row['progdcall'] ?? row['PROGDCALL']),
                progDWid: toNum(row['ProgDWid'] ?? row['progDWid'] ?? row['progdwid'] ?? row['PROGDWID']),
                progT: toNum(row['ProgT'] ?? row['progT'] ?? row['progt'] ?? row['PROGT']),
                progTTod: toNum(row['ProgTTod'] ?? row['progTTod'] ?? row['progttod'] ?? row['PROGTTOD']),
                progTHos: toNum(row['ProgTHos'] ?? row['progTHos'] ?? row['progthos'] ?? row['PROGTHOS']),
                progTBot: toNum(row['ProgTBot'] ?? row['progTBot'] ?? row['progtbot'] ?? row['PROGTBOT']),
                progTCall: toNum(row['ProgTCall'] ?? row['progTCall'] ?? row['progtcall'] ?? row['PROGTCALL']),
                progTWid: toNum(row['ProgTWid'] ?? row['progTWid'] ?? row['progtwid'] ?? row['PROGTWID']),
                otorgT: toNum(row['OtorgT'] ?? row['otorgT'] ?? row['otorgt'] ?? row['OTORGT']),
                otorgTTod: toNum(row['OtorgTTod'] ?? row['otorgTTod'] ?? row['otorgttod'] ?? row['OTORGTTOD']),
                otorgTHos: toNum(row['OtorgTHos'] ?? row['otorgTHos'] ?? row['otorgthos'] ?? row['OTORGTHOS']),
                otorgTBot: toNum(row['OtorgTBot'] ?? row['otorgTBot'] ?? row['otorgtbot'] ?? row['OTORGTBOT']),
                otorgTCall: toNum(row['OtorgTCall'] ?? row['otorgTCall'] ?? row['otorgtcall'] ?? row['OTORGTCALL']),
                otorgTWid: toNum(row['OtorgTWid'] ?? row['otorgTWid'] ?? row['otorgtwid'] ?? row['OTORGTWID']),
                dispoT: toNum(row['DispoT'] ?? row['dispoT'] ?? row['dispot'] ?? row['DISPOT']),
                dispoTTod: toNum(row['DispoTTod'] ?? row['dispoTTod'] ?? row['dispottod'] ?? row['DISPOTTOD']),
                dispoTHos: toNum(row['DispoTHos'] ?? row['dispoTHos'] ?? row['dispothos'] ?? row['DISPOTHOS']),
                dispoTBot: toNum(row['DispoTBot'] ?? row['dispoTBot'] ?? row['dispotbot'] ?? row['DISPOTBOT']),
                dispoTCall: toNum(row['DispoTCall'] ?? row['dispoTCall'] ?? row['dispotcall'] ?? row['DISPOTCALL']),
                dispoTWid: toNum(row['DispoTWid'] ?? row['dispoTWid'] ?? row['dispotwid'] ?? row['DISPOTWID']),
                dniPro: String(row['DNIPRO'] || row['dnipro'] || row['DNI-PRO'] || row['dni-pro'] || row['DNI_PRO'] || row['DniPro'] || '').trim(),
              };
            });
          }
        }
      }
    }

    // 5. Validar y procesar hoja FechaAgenda
    if (fechaAgendaSheetName) {
      const worksheet = workbook.Sheets[fechaAgendaSheetName];
      const rowsAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      if (rowsAsArrays && rowsAsArrays.length > 0) {
        let rawVal: any = null;
        for (const row of rowsAsArrays) {
          if (row && row[0] !== undefined && row[0] !== null && String(row[0]).trim() !== '') {
            const str = String(row[0]).trim().toLowerCase();
            if (str === 'fecha' || str === 'fechaagenda' || str === 'fecha_agenda' || str === 'fecha de agenda' || str === 'fecha de la agenda') {
              continue;
            }
            rawVal = row[0];
            break;
          }
        }
        if (rawVal) {
          let dateStr = '';
          if (rawVal instanceof Date) {
            dateStr = format(rawVal, 'yyyy-MM-dd');
          } else {
            const num = Number(rawVal);
            if (!isNaN(num) && num > 10000 && num < 100000) {
              const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
              dateStr = format(jsDate, 'yyyy-MM-dd');
            } else {
              const str = String(rawVal).trim();
              const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
              if (ddmmyyyy) {
                const day = ddmmyyyy[1].padStart(2, '0');
                const month = ddmmyyyy[2].padStart(2, '0');
                const year = ddmmyyyy[3];
                dateStr = `${year}-${month}-${day}`;
              } else {
                const parsedDate = new Date(str);
                if (!isNaN(parsedDate.getTime())) {
                  dateStr = format(parsedDate, 'yyyy-MM-dd');
                } else {
                  dateStr = str;
                }
              }
            }
          }
          if (dateStr) {
            parsedFechaAgenda = {
              id: 'single',
              fecha: dateStr
            };
          }
        }
      }
    }

    return {
      errors,
      turnos: parsedTurnos,
      guardias: parsedGuardias,
      profesionales: parsedProfesionales,
      agendas: parsedAgendas,
      fechaAgenda: parsedFechaAgenda,
    };
  };

  const syncFromGoogleSheets = async () => {
    setIsSyncingSheets(true);
    setIsSavingData(true);

    try {
      const buffer = await fetchGoogleSheetBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const { errors, turnos: pTurnos, guardias: pGuardias, profesionales: pProfs, agendas: pAgendas, fechaAgenda: pFechaAgenda } = processWorkbookData(workbook);

      if (errors.length > 0) {
        setCompatibilityErrors(errors);
        setShowCompatibilityModal(true);
        setIsSyncingSheets(false);
        setIsSavingData(false);
        return;
      }

      const hasTurnosToSave = pTurnos.length > 0;
      const hasGuardiasToSave = pGuardias.length > 0;
      const hasProfsToSave = pProfs.length > 0;
      const hasAgendasToSave = pAgendas.length > 0;
      const hasFechaAgendaToSave = Boolean(pFechaAgenda);

      if (!hasTurnosToSave && !hasGuardiasToSave && !hasProfsToSave && !hasAgendasToSave && !hasFechaAgendaToSave) {
        alert('No se encontraron registros de datos en las hojas de la planilla.');
        setIsSyncingSheets(false);
        setIsSavingData(false);
        return;
      }

      if (isLocalMode) {
        if (hasTurnosToSave) {
          setTurnos(pTurnos);
          localStorage.setItem('remixed_turnos', JSON.stringify(pTurnos));
        }
        if (hasGuardiasToSave) {
          setGuardias(pGuardias);
          localStorage.setItem('remixed_guardias', JSON.stringify(pGuardias));
        }
        if (hasProfsToSave) {
          setProfesionales(pProfs);
          localStorage.setItem('remixed_profesionales', JSON.stringify(pProfs));
        }
        if (hasAgendasToSave) {
          setAgendas(pAgendas);
          localStorage.setItem('remixed_agendas', JSON.stringify(pAgendas));
        }
        if (hasFechaAgendaToSave && pFechaAgenda) {
          setFechaAgenda(pFechaAgenda);
          localStorage.setItem('remixed_fecha_agenda', JSON.stringify(pFechaAgenda));
        }
      } else {
        const savePromises = [];
        if (hasTurnosToSave) savePromises.push(replaceTurnos(pTurnos));
        if (hasGuardiasToSave) savePromises.push(replaceGuardias(pGuardias));
        if (hasProfsToSave) savePromises.push(replaceProfesionales(pProfs));
        if (hasAgendasToSave) savePromises.push(replaceAgendas(pAgendas));
        if (hasFechaAgendaToSave && pFechaAgenda) savePromises.push(replaceFechaAgenda(pFechaAgenda));

        await Promise.all(savePromises);

        if (hasTurnosToSave) {
          setTurnos(pTurnos);
          localStorage.setItem('remixed_turnos', JSON.stringify(pTurnos));
        }
        if (hasGuardiasToSave) {
          setGuardias(pGuardias);
          localStorage.setItem('remixed_guardias', JSON.stringify(pGuardias));
        }
        if (hasProfsToSave) {
          setProfesionales(pProfs);
          localStorage.setItem('remixed_profesionales', JSON.stringify(pProfs));
        }
        if (hasAgendasToSave) {
          setAgendas(pAgendas);
          localStorage.setItem('remixed_agendas', JSON.stringify(pAgendas));
        }
        if (hasFechaAgendaToSave && pFechaAgenda) {
          setFechaAgenda(pFechaAgenda);
          localStorage.setItem('remixed_fecha_agenda', JSON.stringify(pFechaAgenda));
        }
      }

      const totalCount = pTurnos.length + pGuardias.length + pProfs.length + pAgendas.length + (pFechaAgenda ? 1 : 0);
      setSuccessRecordsCount(totalCount);
      setShowSuccessNotification(true);
      setLastSyncTime(new Date());
      setTimeout(() => setShowSuccessNotification(false), 5000);
    } catch (err: any) {
      console.error('Error al sincronizar con DATOSTABLERO:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`No se pudo sincronizar con la planilla DATOSTABLERO:\n\n${msg}\n\nVerifique la URL configurada en link.txt.`);
    } finally {
      setIsSyncingSheets(false);
      setIsSavingData(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (activeTab === 'GUARDIA') {
        const g = item as any;
        if (filters.caps.length > 0 && !filters.caps.includes(g.caps)) return false;
        if (filters.profesional.length > 0 && !filters.profesional.includes(g.profesional)) return false;
        if (filters.urgencia && filters.urgencia.length > 0 && !filters.urgencia.includes(g.urgencia)) return false;
        if (filters.egreso && filters.egreso.length > 0 && !filters.egreso.includes(g.egreso)) return false;
        if (filters.triage && filters.triage.length > 0 && !filters.triage.includes(g.nivel)) return false;
        if (filters.estado && filters.estado.length > 0 && !filters.estado.includes(g.estadoEgreso)) return false;
      } else {
        const turno = item as Turno;
        if (filters.dpto.length > 0 && !filters.dpto.includes(turno.dpto)) return false;
        if (filters.caps.length > 0 && !filters.caps.includes(turno.caps)) return false;
        if (filters.especialidad.length > 0 && !filters.especialidad.includes(turno.especialidad)) return false;
        if (filters.profesional.length > 0 && !filters.profesional.includes(turno.profesional)) return false;
        if (filters.tipo && filters.tipo.length > 0 && !filters.tipo.includes(turno.tipo)) return false;
        if (filters.anotador && filters.anotador.length > 0 && !filters.anotador.includes(turno.anotador)) return false;
        
        if (filters.conCargaHoraria) {
          if (!turno.dniPro || turno.dniPro === '-') return false;
          const normalizedTurnoDni = String(turno.dniPro).trim().toLowerCase();
          const pro = profesionales.find(p => {
            if (!p.dniPro) return false;
            const normalizedProDni = String(p.dniPro).trim().toLowerCase();
            return normalizedProDni === normalizedTurnoDni;
          });
          if (!pro) return false;
        }
      }

      if (filters.dateFrom || filters.dateTo) {
        const itemDate = parseISO(item.fecha);
        const from = filters.dateFrom ? parseISO(filters.dateFrom) : new Date(0);
        const to = filters.dateTo ? parseISO(filters.dateTo) : new Date(8640000000000000);
        
        if (!isWithinInterval(itemDate, { start: from, end: to })) {
          return false;
        }
      }
      
      return true;
    });
  }, [data, filters, profesionales, activeTab]);

  const dateRangeString = useMemo(() => {
    if (fechaAgenda && fechaAgenda.fecha) {
      const raw = String(fechaAgenda.fecha).trim();
      const parts = raw.split('-');
      if (parts.length === 3) {
        return `Datos al ${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
      const slashParts = raw.split('/');
      if (slashParts.length === 3) {
        return `Datos al ${slashParts[0].padStart(2, '0')}/${slashParts[1].padStart(2, '0')}/${slashParts[2]}`;
      }
      return `Datos al ${raw}`;
    }

    if (!data || data.length === 0) return '';
    const dates = data
      .map(d => d.fecha)
      .filter(Boolean)
      .map(f => {
        const d = parseISO(f);
        return isNaN(d.getTime()) ? null : d;
      })
      .filter((d): d is Date => d !== null);

    if (dates.length === 0) return '';
    const maxD = new Date(Math.max(...dates.map(d => d.getTime())));
    
    return `Datos al ${format(maxD, 'dd/MM/yyyy')}`;
  }, [data, fechaAgenda]);

  const handleDownloadFullDashboard = async () => {
    if (!dashboardContainerRef.current) return;
    setIsGeneratingPdf(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      const element = dashboardContainerRef.current;
      
      const dataUrl = await toPng(element, { 
        backgroundColor: '#f8fafc',
        pixelRatio: 2,
        style: {
          overflow: 'visible',
          height: 'auto'
        }
      });
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [img.width, img.height]
      });
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
      const docName = activeTab === 'AMBULATORIO' ? 'Turnos' : activeTab === 'GUARDIA' ? 'Guardias' : 'Agendas';
      pdf.save(`Reporte-Tablero-${docName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error al generar PDF completo:', error);
      alert('Ocurrió un error al generar el PDF completo. Por favor, reintente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <header className="bg-slate-900 text-white px-4 py-2 flex flex-col sm:flex-row items-center justify-between shrink-0 relative gap-2 sm:gap-2">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex flex-wrap items-center gap-2">
            <img 
              src="https://cdn-icons-png.flaticon.com/512/2966/2966459.png" 
              alt="Icono del sistema" 
              className="w-6 h-6 object-contain filter invert brightness-0 sm:block" 
              referrerPolicy="no-referrer"
            />
            <span className="text-xs sm:text-sm font-bold tracking-tight uppercase text-slate-400">TABLERO DE CONTROL:</span>
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/60 shadow-inner">
              <button
                onClick={() => setActiveTab('AMBULATORIO')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeTab === 'AMBULATORIO'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                }`}
              >
                ATENCIONES
              </button>
              <button
                onClick={() => setActiveTab('GUARDIA')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeTab === 'GUARDIA'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                }`}
              >
                GUARDIA
              </button>
              <button
                onClick={() => setActiveTab('AGENDA')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeTab === 'AGENDA'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                }`}
              >
                AGENDA
              </button>
            </div>
            {dateRangeString && (
              <span className="text-[10px] bg-blue-600 text-white font-bold uppercase px-2 py-0.5 rounded sm:hidden mt-0 w-fit">
                {dateRangeString}
              </span>
            )}
          </div>
        </div>

        {dateRangeString && (
          <div className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-white font-bold uppercase whitespace-nowrap bg-blue-600 px-4 py-1 rounded-full shadow-sm">
            {dateRangeString}
          </div>
        )}

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button 
            onClick={handleDownloadFullDashboard}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 transition-colors px-3 py-1.5 rounded text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar PDF Completo
          </button>
          
          {/* BOTÓN ACTUALIZAR DATOS DESDE LINK.TXT */}
          <button 
            onClick={() => syncFromGoogleSheets()}
            disabled={isSyncingSheets}
            title="Actualizar datos desde Google Sheets (link.txt)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors cursor-pointer ${
              isSyncingSheets 
                ? 'bg-blue-800 text-blue-200 cursor-wait' 
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
            <span>{isSyncingSheets ? 'Actualizando...' : 'Actualizar Datos'}</span>
          </button>
        </div>
      </header>

      <div 
        ref={dashboardContainerRef} 
        className={isGeneratingPdf ? "flex flex-col h-auto overflow-visible bg-slate-50" : "flex-1 flex flex-col overflow-hidden bg-slate-50"}
      >
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-50">
            <div className="w-12 h-12 border-4 border-slate-900 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="text-center">
              <h3 className="font-bold text-sm text-slate-800">Cargando base de datos</h3>
              <p className="text-[11px] text-slate-500 mt-1 font-mono uppercase tracking-wider">Cargando registros sincronizados...</p>
            </div>
          </div>
        ) : activeTab === 'AGENDA' ? (
          <div className={isGeneratingPdf ? "flex-1 flex flex-col p-2 bg-slate-50 overflow-visible h-auto" : "flex-1 flex flex-col p-2 bg-slate-50 overflow-y-auto"}>
            <AgendaDashboard
              agendas={agendas}
              fechaAgenda={fechaAgenda ? [fechaAgenda] : []}
              profesionales={profesionales}
              filters={filtersAgenda}
              setFilters={setFilters}
              isPrinting={isGeneratingPdf}
            />
          </div>
        ) : (
          <Dashboard 
            data={filteredData} 
            allData={data} 
            profesionales={profesionales} 
            filters={filters} 
            setFilters={setFilters} 
            isPrinting={isGeneratingPdf} 
            activeTab={activeTab} 
          />
        )}
      </div>

      <footer className="bg-slate-200 px-4 py-1.5 text-[10px] flex justify-between items-center shrink-0 border-t border-slate-300">
        <div className="text-slate-600">Sistema de Gestión Hospitalaria - V 4.2.0 | Zona Sanitaria I Central</div>
        <div className="flex items-center gap-4">
          <span className="font-bold flex items-center gap-1.5">
            Fuente de Datos:{" "}
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider text-[8px] flex items-center gap-1">
              <FileSpreadsheet className="w-2.5 h-2.5 inline" /> Google Sheets (link.txt)
            </span>
          </span>
          {lastSyncTime && (
            <span className="text-slate-600 font-medium">
              Última actualización: {format(lastSyncTime, 'HH:mm:ss')}
            </span>
          )}
          <span className="font-bold text-slate-700">Estado: <span className="text-emerald-600">● Conectado</span></span>
        </div>
      </footer>

      {/* MODAL DE COMPATIBILIDAD */}
      {showCompatibilityModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-red-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 text-white rounded-lg shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Planilla No Compatible</h3>
                  <p className="text-[10px] text-red-200 font-medium">No se ha podido realizar la sincronización</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCompatibilityModal(false)} 
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[70vh]">
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                La planilla debe mantener la misma estructura de <strong>DATOS.xlsx</strong> y contener las siguientes hojas con sus respectivas columnas:
              </p>
              
              <div className="mb-4">
                <h4 className="text-xs font-bold text-slate-700 mb-1 bg-slate-100 p-1 rounded font-sans uppercase">1. Hoja "Turnos" (17 Columnas de la A a la Q)</h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 grid grid-cols-2 gap-x-4 gap-y-1 shadow-inner">
                  <div>A: <span className="font-semibold text-slate-800">Tipo</span></div>
                  <div>J: <span className="font-semibold text-slate-800">PacProv</span></div>
                  <div>B: <span className="font-semibold text-slate-800">Dpto</span></div>
                  <div>K: <span className="font-semibold text-slate-800">PacDpto</span></div>
                  <div>C: <span className="font-semibold text-slate-800">CAPS</span></div>
                  <div>L: <span className="font-semibold text-slate-800">CoberturaSocial</span></div>
                  <div>D: <span className="font-semibold text-slate-800">Especialidad</span></div>
                  <div>M: <span className="font-semibold text-slate-800">Hora</span></div>
                  <div>E: <span className="font-semibold text-slate-800">Profesional</span></div>
                  <div>N: <span className="font-semibold text-slate-800">TURNO</span></div>
                  <div>F: <span className="font-semibold text-slate-800">Fecha</span></div>
                  <div>O: <span className="font-semibold text-slate-800">DNI-PRO</span></div>
                  <div>G: <span className="font-semibold text-slate-800">DNI</span></div>
                  <div>P: <span className="font-semibold text-slate-800">Días</span></div>
                  <div>H: <span className="font-semibold text-slate-800">FechaNacimiento</span></div>
                  <div>Q: <span className="font-semibold text-slate-800">Anotador</span></div>
                  <div>I: <span className="font-semibold text-slate-800">Sexo</span></div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-xs font-bold text-slate-700 mb-1 bg-slate-100 p-1 rounded font-sans uppercase">2. Hoja "Profesionales" (4 Columnas de la A a la D)</h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 grid grid-cols-4 gap-x-2 gap-y-1 shadow-inner">
                  <div>A: <span className="font-semibold text-slate-800">DNI-PRO</span></div>
                  <div>B: <span className="font-semibold text-slate-800">CargaH</span></div>
                  <div>C: <span className="font-semibold text-slate-800">TurEsp</span></div>
                  <div>D: <span className="font-semibold text-slate-800">Profesional</span></div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-xs font-bold text-slate-700 mb-1 bg-slate-100 p-1 rounded font-sans uppercase">3. Hoja "Agendas" (31 Columnas de la A a la AE)</h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 grid grid-cols-3 gap-x-2 gap-y-1 shadow-inner">
                  <div>A: <span className="font-semibold text-slate-800">DPTO</span></div>
                  <div>B: <span className="font-semibold text-slate-800">CAPS</span></div>
                  <div>C: <span className="font-semibold text-slate-800">Especialidad</span></div>
                  <div>D: <span className="font-semibold text-slate-800">Profesional</span></div>
                  <div>E: <span className="font-semibold text-slate-800">DiaSemana</span></div>
                  <div>F: <span className="font-semibold text-slate-800">Ventana</span></div>
                  <div>G: <span className="font-semibold text-slate-800">ProgD</span></div>
                  <div>H: <span className="font-semibold text-slate-800">ProgDTod</span></div>
                  <div>I: <span className="font-semibold text-slate-800">ProgDHos</span></div>
                  <div>J: <span className="font-semibold text-slate-800">ProgDBot</span></div>
                  <div>K: <span className="font-semibold text-slate-800">ProgDCall</span></div>
                  <div>L: <span className="font-semibold text-slate-800">ProgDWid</span></div>
                  <div>M: <span className="font-semibold text-slate-800">ProgT</span></div>
                  <div>N: <span className="font-semibold text-slate-800">ProgTTod</span></div>
                  <div>O: <span className="font-semibold text-slate-800">ProgTHos</span></div>
                  <div>P: <span className="font-semibold text-slate-800">ProgTBot</span></div>
                  <div>Q: <span className="font-semibold text-slate-800">ProgTCall</span></div>
                  <div>R: <span className="font-semibold text-slate-800">ProgTWid</span></div>
                  <div>S: <span className="font-semibold text-slate-800">OtorgT</span></div>
                  <div>T: <span className="font-semibold text-slate-800">OtorgTTod</span></div>
                  <div>U: <span className="font-semibold text-slate-800">OtorgTHos</span></div>
                  <div>V: <span className="font-semibold text-slate-800">OtorgTBot</span></div>
                  <div>W: <span className="font-semibold text-slate-800">OtorgTCall</span></div>
                  <div>X: <span className="font-semibold text-slate-800">OtorgTWid</span></div>
                  <div>Y: <span className="font-semibold text-slate-800">DispoT</span></div>
                  <div>Z: <span className="font-semibold text-slate-800">DispoTTod</span></div>
                  <div>AA: <span className="font-semibold text-slate-800">DispoTHos</span></div>
                  <div>AB: <span className="font-semibold text-slate-800">DispoTBot</span></div>
                  <div>AC: <span className="font-semibold text-slate-800">DispoTCall</span></div>
                  <div>AD: <span className="font-semibold text-slate-800">DispoTWid</span></div>
                  <div>AE: <span className="font-semibold text-slate-800">DNIPRO</span></div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-xs font-bold text-slate-700 mb-1 bg-slate-100 p-1 rounded font-sans uppercase">4. Hoja "FechaAgenda" (1 Columna A)</h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 grid grid-cols-1 gap-x-2 gap-y-1 shadow-inner">
                  <div>A: <span className="font-semibold text-slate-800">Fecha</span></div>
                </div>
              </div>

              <div className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                Errores de Estructura Detectados:
              </div>

              <div className="bg-red-50/50 p-3.5 rounded-lg border border-red-100 text-xs text-red-700 space-y-1.5 leading-relaxed">
                {compatibilityErrors.map((error, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-red-400 shrink-0 mt-0.5 font-bold">•</span>
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end text-xs font-semibold">
              <button 
                onClick={() => setShowCompatibilityModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-950 text-white rounded-lg transition-colors shadow-sm"
              >
                Cerrar y Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN DE DEPURACIÓN */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="text-white p-4 flex items-center gap-3 border-b border-rose-900 bg-rose-950">
              <div className="p-2 bg-rose-500/25 text-rose-300 rounded-lg shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-300 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight text-white font-sans">
                  {cleanupScope === 'all' ? 'Vaciar Base de Datos Completa' : 'Depurar Registros de Turnos'}
                </h3>
                <p className="text-[10px] text-rose-300 font-medium font-mono">
                  GESTIÓN DE REGISTROS
                </p>
              </div>
            </div>
            
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-lg border border-rose-100 text-xs text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                {cleanupScope === 'all' ? (
                  <span>Se eliminarán permanentemente los <strong>{data.length} registros</strong> totales del sistema.</span>
                ) : (
                  <span>Se han identificado <strong>{recordsToClean.length} registros</strong> con fecha anterior al <strong>10/05/2026</strong>.</span>
                )}
              </div>

              <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3.5 rounded-lg border border-slate-150 leading-relaxed">
                <p className="font-semibold text-slate-800 uppercase tracking-wide text-[10px] text-slate-500">
                  Optimización y Persistencia de Datos
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-1">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Limpieza Rápida:</strong> Los registros se remueven de forma inmediata.</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Actualizable:</strong> Puede recuperar o actualizar los datos en cualquier momento haciendo clic en "Actualizar Datos".</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-normal">
                Esta acción es irreversible en el almacenamiento actual. Asegúrese de haber descargado su PDF de respaldo antes de confirmar.
              </p>

              {cleanupScope === 'all' && (
                <div className="mt-3 p-3 bg-rose-50/50 rounded-lg border border-rose-100/70 space-y-2">
                  <label className="block text-[10px] font-bold text-rose-950 font-sans uppercase tracking-wider">
                    Autorización Requerida
                  </label>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    Por seguridad, escriba la contraseña para autorizar el vaciado completo ({data.length} registros):
                  </p>
                  <input
                    type="password"
                    value={cleanupPassword}
                    onChange={(e) => {
                      setCleanupPassword(e.target.value);
                      setCleanupPasswordError('');
                    }}
                    placeholder="Contraseña de vaciado"
                    className="w-full px-3 py-1.5 text-xs border border-rose-200 rounded-lg bg-white text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                  />
                  {cleanupPasswordError && (
                    <p className="text-[10px] text-rose-700 font-semibold font-sans">
                      {cleanupPasswordError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2 text-xs font-semibold">
              <button 
                onClick={() => setShowCleanupModal(false)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                Cancelar
              </button>
              <button 
                onClick={handleExecuteCleanup}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                {cleanupScope === 'all' ? `Vaciar BD (${data.length} Turnos)` : `Eliminar ${recordsToClean.length} Registros`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EJECUTANDO DEPURACIÓN */}
      {isCleaningData && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 border border-slate-200 max-w-sm w-full flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">Depurando Base de Datos</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Eliminando registros seleccionados. Por favor espere...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GENERACIÓN PDF */}
      {isGeneratingPdf && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 border border-slate-200 max-w-sm w-full flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">Generando Reporte PDF</h3>
              <p className="text-[11px] text-slate-500 mt-1">Por favor espere, estamos procesando y renderizando todos los gráficos y tablas...</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SINCRONIZANDO CON GOOGLE SHEETS */}
      {isSavingData && isSyncingSheets && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 border border-slate-200 max-w-sm w-full flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">Sincronizando con Google Sheets</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Descargando y procesando hojas Turnos, Profesionales, Guardias y Agendas...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE ÉXITO */}
      {showSuccessNotification && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white rounded-xl shadow-2xl border border-emerald-500 px-4 py-3 flex items-center gap-3.5 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-2 bg-emerald-700 text-emerald-100 rounded-lg shrink-0">
            <Check className="w-4 h-4 font-bold" />
          </div>
          <div>
            <p className="text-xs font-extrabold">¡Datos Sincronizados con Éxito!</p>
            <p className="text-[10px] text-emerald-100">Se han actualizado {successRecordsCount} registros desde Google Sheets.</p>
          </div>
        </div>
      )}
    </div>
  );
}
