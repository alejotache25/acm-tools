export type UserRole = 'admin' | 'jefe';

export interface AuthUser {
  id: string;
  nombre: string;
  rol: UserRole;
}

export interface Usuario {
  id: string;
  nombre: string;
  pin: string;
  rol: UserRole;
  created_at: string;
}

export interface Operario {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  created_at: string;
}

export interface JefeOperario {
  id: string;
  jefe_id: string;
  operario_nombre: string;
}

export interface Config {
  id: string;
  webhook_url: string;
  nombre_empresa: string;
  logo_url: string;
}

export interface Incidencia {
  id: string;
  operario: string;
  año: number;
  fecha: string;
  id_incidencia?: number | null;
  ot?: number | null;
  incidencia: string;
  puntos: number;
  observaciones?: string;
  jefe_id: string;
  sync_pending?: boolean;
  created_at: string;
}

export interface ControlCalidad {
  id: string;
  numero?: number;
  fecha: string;
  ot?: number | null;
  operario: string;
  cliente: string;
  descripcion: string;
  resolucion?: string;
  marca?: string;
  tipo_cq: string;
  horas: number;
  importe_h: number;
  materiales: number;
  total_cq: number;
  jefe_id: string;
  sync_pending?: boolean;
  created_at: string;
}

export interface Visita {
  id: string;
  fecha: string;
  operario: string;
  inspeccion: string;
  ot?: number | null;
  tipo_visita: string;
  ok_visita: string;
  cliente?: string;
  observaciones?: string;
  jefe_id: string;
  sync_pending?: boolean;
  created_at: string;
}

export interface Limpieza {
  id: string;
  fecha: string;
  operario: string;
  vestuario_h: number;
  limpieza_vh: number;
  limpieza_vh_sorpresa: number;
  seguridad_t: number;
  herramientas: number;
  observaciones?: string;
  jefe_id: string;
  sync_pending?: boolean;
  created_at: string;
}

export interface HorasImproductivas {
  id: string;
  fecha: string;
  operario: string;
  h_recg_mat: number;
  h_reunion: number;
  h_mant_furgos: number;
  h_mant_instalaciones: number;
  h_formacion: number;
  consumibles_e: number;
  observaciones?: string;
  jefe_id: string;
  sync_pending?: boolean;
  created_at: string;
}

export interface Issus {
  id: string;
  fecha: string;
  operario: string;
  id_issus?: number | null;
  tipo: string;
  descripcion: string;
  estado?: string;
  jefe_id: string;
  sync_pending?: boolean;
  created_at: string;
}

export interface KpiResumen {
  id: string;
  agente: string;
  mes: number;
  año: number;
  importe: number;
  acumulado: number;
  a_cobrar: number;
  objetivo: number;
  dietas: number;
  h_extras: number;
  jefe_id: string;
  created_at: string;
}

export interface KpiDetalle {
  id: string;
  agente: string;
  mes: number;
  año: number;
  prod_pct: number;
  prod_imp: number;
  prod_acum: number;
  calidad_doc_pct: number;
  calidad_doc_imp: number;
  calidad_doc_acum: number;
  visitas_pct: number;
  visitas_imp: number;
  visitas_acum: number;
  retorno_pct: number;
  retorno_obj: number;
  retorno_imp: number;
  retorno_acum: number;
  herramientas_pct: number;
  herramientas_imp: number;
  herramientas_acum: number;
  vehiculo_pct: number;
  vehiculo_imp: number;
  vehiculo_acum: number;
  aseo_pct: number;
  aseo_imp: number;
  aseo_acum: number;
  horas_obj: number;
  horas_inv: number;
  horas_dif: number;
  horas_pct: number;
  penalizacion: number;
  total: number;
  jefe_id: string;
  created_at: string;
}
