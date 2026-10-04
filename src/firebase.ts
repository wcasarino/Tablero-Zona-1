import { Turno, Profesional, Guardia, Agenda, FechaAgenda } from './types';

// Operation types matching previous schema to preserve compatibility
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface MongoErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

function handleMongoError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: MongoErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('MongoDB API Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate database connection
export async function testConnection(): Promise<boolean> {
  try {
    const res = await fetch('/api/test-connection');
    if (!res.ok) return false;
    const data = await res.json();
    return data.connected;
  } catch (error) {
    console.error("MongoDB Connection test failed:", error);
    return false;
  }
}

// Fetch all turnos from MongoDB / API
export async function fetchTurnos(): Promise<Turno[]> {
  const apiPath = '/api/turnos';
  try {
    const res = await fetch(apiPath);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    handleMongoError(error, OperationType.LIST, apiPath);
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
    handleMongoError(error, OperationType.WRITE, apiPath);
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
    handleMongoError(error, OperationType.WRITE, apiPath);
  }
}

// Clear specific turnos by ID in MongoDB
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
    handleMongoError(error, OperationType.DELETE, apiPath);
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
    handleMongoError(error, OperationType.LIST, apiPath);
  }
}

// Save list of profesionales in MongoDB / API in bulk
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
    handleMongoError(error, OperationType.WRITE, apiPath);
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
    handleMongoError(error, OperationType.WRITE, apiPath);
  }
}

// Clear specific profesionales in MongoDB
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
    handleMongoError(error, OperationType.DELETE, apiPath);
  }
}

// Fetch agendas
export async function fetchGuardias(): Promise<Guardia[]> {
  const apiPath = '/api/guardias';
  try {
    const res = await fetch(apiPath);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    handleMongoError(error, OperationType.LIST, apiPath);
  }
}

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
    handleMongoError(error, OperationType.WRITE, apiPath);
  }
}

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
    handleMongoError(error, OperationType.DELETE, apiPath);
  }
}

export async function fetchAgendas(): Promise<Agenda[]> {
  const apiPath = '/api/agendas';
  try {
    const res = await fetch(apiPath);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    handleMongoError(error, OperationType.LIST, apiPath);
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
    handleMongoError(error, OperationType.WRITE, apiPath);
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
    handleMongoError(error, OperationType.LIST, apiPath);
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
    handleMongoError(error, OperationType.WRITE, apiPath);
  }
}



