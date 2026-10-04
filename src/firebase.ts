import { Turno, Profesional, Guardia, Agenda, FechaAgenda } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface ApiErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

function handleApiError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: ApiErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('API Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate backend connection
export async function testConnection(): Promise<boolean> {
  try {
    const res = await fetch('/api/test-connection');
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.connected);
  } catch (error) {
    console.error("Connection test failed:", error);
    return false;
  }
}

// Get Google Sheets configuration
export async function getSheetsConfig(): Promise<{ sheetUrl: string }> {
  try {
    const res = await fetch('/api/sheets/config');
    if (!res.ok) return { sheetUrl: '' };
    return await res.json();
  } catch {
    return { sheetUrl: '' };
  }
}

// Save Google Sheets configuration
export async function saveSheetsConfig(sheetUrl: string): Promise<void> {
  const apiPath = '/api/sheets/config';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetUrl })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.WRITE, apiPath);
  }
}

// Fetch Google Sheet binary XLSX through backend proxy
export async function fetchGoogleSheetBuffer(url?: string): Promise<ArrayBuffer> {
  const apiPath = '/api/sheets/fetch';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!res.ok) {
      let errMessage = 'Error al descargar la planilla de Google Sheets';
      try {
        const errJson = await res.json();
        if (errJson.error) errMessage = errJson.error;
      } catch {
        errMessage = `Error de conexión con Google Sheets (${res.status}: ${res.statusText})`;
      }
      throw new Error(errMessage);
    }

    return await res.arrayBuffer();
  } catch (error) {
    handleApiError(error, OperationType.GET, apiPath);
  }
}

// Fetch all turnos
export async function fetchTurnos(): Promise<Turno[]> {
  const apiPath = '/api/turnos';
  try {
    const res = await fetch(apiPath);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    handleApiError(error, OperationType.LIST, apiPath);
  }
}

// Save list of turnos in bulk
export async function saveTurnos(newTurnos: Turno[]): Promise<void> {
  const apiPath = '/api/turnos/bulk';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnos: newTurnos })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.WRITE, apiPath);
  }
}

// Replace all turnos (deletes existing and sets new)
export async function replaceTurnos(newTurnos: Turno[]): Promise<void> {
  const apiPath = '/api/turnos/replace';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnos: newTurnos })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.WRITE, apiPath);
  }
}

// Clear specific turnos by ID
export async function clearAllTurnos(existingIds: string[]): Promise<void> {
  const apiPath = '/api/turnos/clear';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: existingIds })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.DELETE, apiPath);
  }
}

// Fetch all profesionales
export async function fetchProfesionales(): Promise<Profesional[]> {
  const apiPath = '/api/profesionales';
  try {
    const res = await fetch(apiPath);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    handleApiError(error, OperationType.LIST, apiPath);
  }
}

// Save list of profesionales in bulk
export async function saveProfesionales(newProf: Profesional[]): Promise<void> {
  const apiPath = '/api/profesionales/bulk';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profesionales: newProf })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.WRITE, apiPath);
  }
}

// Replace all profesionales (deletes existing and sets new)
export async function replaceProfesionales(newProf: Profesional[]): Promise<void> {
  const apiPath = '/api/profesionales/replace';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profesionales: newProf })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.WRITE, apiPath);
  }
}

// Clear specific profesionales
export async function clearAllProfesionales(existingIds: string[]): Promise<void> {
  const apiPath = '/api/profesionales/clear';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: existingIds })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.DELETE, apiPath);
  }
}

// Fetch guardias
export async function fetchGuardias(): Promise<Guardia[]> {
  const apiPath = '/api/guardias';
  try {
    const res = await fetch(apiPath);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    handleApiError(error, OperationType.LIST, apiPath);
  }
}

// Replace guardias
export async function replaceGuardias(newGuardias: Guardia[]): Promise<void> {
  const apiPath = '/api/guardias/replace';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guardias: newGuardias })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.WRITE, apiPath);
  }
}

// Clear specific guardias
export async function clearAllGuardias(existingIds: string[]): Promise<void> {
  const apiPath = '/api/guardias/clear';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: existingIds })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.DELETE, apiPath);
  }
}

// Fetch agendas
export async function fetchAgendas(): Promise<Agenda[]> {
  const apiPath = '/api/agendas';
  try {
    const res = await fetch(apiPath);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    handleApiError(error, OperationType.LIST, apiPath);
  }
}

// Replace agendas
export async function replaceAgendas(data: Agenda[]): Promise<void> {
  const apiPath = '/api/agendas/replace';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.WRITE, apiPath);
  }
}

// Fetch fecha-agenda
export async function fetchFechaAgenda(): Promise<FechaAgenda | null> {
  const apiPath = '/api/fecha-agenda';
  try {
    const res = await fetch(apiPath);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    handleApiError(error, OperationType.LIST, apiPath);
  }
}

// Replace fecha-agenda
export async function replaceFechaAgenda(data: FechaAgenda): Promise<void> {
  const apiPath = '/api/fecha-agenda/replace';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  } catch (error) {
    handleApiError(error, OperationType.WRITE, apiPath);
  }
}
