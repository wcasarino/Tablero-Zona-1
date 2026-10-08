export interface Turno {
  id: string;
  dpto: string;
  caps: string;
  especialidad: string;
  profesional: string;
  fecha: string;
  dniPro: string;
  atenciones: number;
  fem: number;
  masc: number;
  f_0_18: number;
  f_18_29: number;
  f_30_49: number;
  f_50_64: number;
  f_65_plus: number;
  m_0_18: number;
  m_18_29: number;
  m_30_49: number;
  m_50_64: number;
  m_65_plus: number;
  turnoM: number;
  turnoT: number;
  turnoN: number;
  sinTurno: number;
  conTurno: number;
  canalCaps: number;
  canalBot: number;
  canalCall: number;
  enElDia: number;
  diaAnterior: number;
  enLaSemana: number;
  resto: number;

  // Optional/compatibility fields
  tipo?: 'Atención Inmediata' | 'Programado' | 'SobreTurno' | 'Con Turno' | 'Sin Turno' | string;
  dni?: string;
  pacDpto?: string;
  coberturaSocial?: string;
  edad?: number;
  sexo?: 'F' | 'M' | string;
  turno?: string;
  dias?: number;
  anotador?: string;
  diaSemana?: string;
}

export interface Profesional {
  id: string;
  dniPro: string;
  cargaH: string;
  turEsp: string;
  profesional: string;
}

export interface Agenda {
  id: string;
  dpto: string;
  caps: string;
  especialidad: string;
  profesional: string;
  diaSemana: string;
  ventana: number;
  progD: number;
  progDTod: number;
  progDHos: number;
  progDBot: number;
  progDCall: number;
  progDWid: number;
  progT: number;
  progTTod: number;
  progTHos: number;
  progTBot: number;
  progTCall: number;
  progTWid: number;
  otorgT: number;
  otorgTTod: number;
  otorgTHos: number;
  otorgTBot: number;
  otorgTCall: number;
  otorgTWid: number;
  dispoT: number;
  dispoTTod: number;
  dispoTHos: number;
  dispoTBot: number;
  dispoTCall: number;
  dispoTWid: number;
  dniPro: string;
}

export interface FechaAgenda {
  id: string;
  fecha: string;
}

export interface Guardia {
  id: string;
  caps: string;
  fecha: string;
  hora: string;
  egreso: string;
  edad: number;
  nivel: string;
  minutosEspera: number;
  profesional: string;
  dpto: string;
  diagnostico: string;
  cobertura: string;
  urgencia: string;
  estadoEgreso: string;
  motivoAlta: string;
}

export interface Filters {
  dpto: string[];
  caps: string[];
  especialidad: string[];
  profesional: string[];
  tipo: string[];
  anotador: string[];
  diaSemana?: string[];
  canal?: string[];
  urgencia?: string[];
  egreso?: string[];
  triage?: string[];
  estado?: string[];
  dateFrom: string | null;
  dateTo: string | null;
  conCargaHoraria: boolean;
}
