/* ============================================================
   Repositório de Pacientes/Clientes — operações assíncronas
   diretas na tabela `pacientes` do Supabase (SELECT / INSERT /
   UPDATE / DELETE). Substitui o localStorage como fonte de
   verdade quando o modo nuvem está ativo.
   ============================================================ */
import type { Client } from "../../types";
import { supabase, isSupabaseConfigured } from "./client";

export const PATIENTS_TABLE = "pacientes";

export class CloudError extends Error {}

const requireCloud = () => {
  if (!isSupabaseConfigured || !supabase)
    throw new CloudError("Supabase não configurado — defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  return supabase;
};

/* ---------- mapeamento camelCase (app) <-> snake_case (banco) ---------- */

type PatientRow = {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  contato_emergencia: string | null;
  profissao: string | null;
  ficha_tecnica_id: string | null;
  product_id: string;
  frequency_days: number;
  last_application: string;
  notes: string | null;
  active: boolean;
  since: string;
};

const toRow = (c: Client): PatientRow => ({
  id: c.id,
  name: c.name,
  phone: c.phone ?? "",
  cpf: c.cpf ?? null,
  data_nascimento: c.dataNascimento ?? null,
  contato_emergencia: c.contatoEmergencia ?? null,
  profissao: c.profissao ?? null,
  ficha_tecnica_id: c.fichaTecnicaId ?? null,
  product_id: c.productId,
  frequency_days: c.frequencyDays,
  last_application: c.lastApplication,
  notes: c.notes ?? "",
  active: c.active,
  since: c.since,
});

const fromRow = (r: PatientRow): Client => ({
  id: r.id,
  name: r.name,
  phone: r.phone ?? "",
  cpf: r.cpf ?? undefined,
  dataNascimento: r.data_nascimento ?? undefined,
  contatoEmergencia: r.contato_emergencia ?? undefined,
  profissao: r.profissao ?? undefined,
  fichaTecnicaId: r.ficha_tecnica_id ?? undefined,
  productId: r.product_id,
  frequencyDays: r.frequency_days ?? 7,
  lastApplication: r.last_application,
  notes: r.notes ?? "",
  active: r.active ?? true,
  since: r.since,
});

/* ---------- operações assíncronas (async/await direto na tabela) ---------- */

/** SELECT — lista todos os pacientes da nuvem, ordenados por cadastro. */
export async function fetchPatients(): Promise<Client[]> {
  const db = requireCloud();
  const { data, error } = await db
    .from(PATIENTS_TABLE)
    .select("*")
    .order("since", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new CloudError(`Falha ao listar pacientes: ${error.message}`);
  return (data as PatientRow[]).map(fromRow);
}

/** INSERT — cadastra um novo paciente no banco. */
export async function insertPatient(c: Client): Promise<void> {
  const db = requireCloud();
  const { error } = await db.from(PATIENTS_TABLE).insert(toRow(c));
  if (error) throw new CloudError(`Falha ao cadastrar paciente: ${error.message}`);
}

/** UPDATE — edita um paciente existente no banco. */
export async function updatePatient(c: Client): Promise<void> {
  const db = requireCloud();
  const { error } = await db.from(PATIENTS_TABLE).update(toRow(c)).eq("id", c.id);
  if (error) throw new CloudError(`Falha ao atualizar paciente: ${error.message}`);
}

/** INSERT ou UPDATE — decide pelo flag de novidade. */
export async function upsertPatient(c: Client, isNew: boolean): Promise<void> {
  if (isNew) await insertPatient(c);
  else await updatePatient(c);
}

/** DELETE — remove um paciente do banco pelo id. */
export async function deletePatient(id: string): Promise<void> {
  const db = requireCloud();
  const { error } = await db.from(PATIENTS_TABLE).delete().eq("id", id);
  if (error) throw new CloudError(`Falha ao excluir paciente: ${error.message}`);
}
