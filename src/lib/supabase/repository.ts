/**
 * Repositório genérico para Supabase
 * Fornece operações CRUD para qualquer tabela
 */

import { supabase } from './client';

export class SupabaseRepository<T extends { id: string }> {
  private table: string;

  constructor(table: string) {
    this.table = table;
  }

  /**
   * Busca todos os registros da tabela
   */
  async findAll(): Promise<T[]> {
    if (!supabase) {
      console.warn('Supabase não configurado, retornando array vazio');
      return [];
    }

    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Erro ao buscar ${this.table}:`, error);
      throw new Error(`Falha ao carregar ${this.table}: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Busca um registro por ID
   */
  async findById(id: string): Promise<T | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      console.error(`Erro ao buscar ${this.table} por id:`, error);
      throw new Error(`Falha ao buscar registro: ${error.message}`);
    }

    return data;
  }

  /**
   * Insere um novo registro
   */
  async insert(record: T): Promise<T> {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }

    const { data, error } = await supabase
      .from(this.table)
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao inserir em ${this.table}:`, error);
      throw new Error(`Falha ao salvar: ${error.message}`);
    }

    return data;
  }

  /**
   * Atualiza um registro existente
   */
  async update(id: string, updates: Partial<T>): Promise<T> {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }

    const { data, error } = await supabase
      .from(this.table)
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao atualizar ${this.table}:`, error);
      throw new Error(`Falha ao atualizar: ${error.message}`);
    }

    return data;
  }

  /**
   * Upsert (insert ou update) de um registro
   */
  async upsert(record: T): Promise<T> {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }

    const { data, error } = await supabase
      .from(this.table)
      .upsert(record)
      .select()
      .single();

    if (error) {
      console.error(`Erro no upsert de ${this.table}:`, error);
      throw new Error(`Falha ao salvar: ${error.message}`);
    }

    return data;
  }

  /**
   * Deleta um registro por ID
   */
  async delete(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }

    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Erro ao deletar de ${this.table}:`, error);
      throw new Error(`Falha ao deletar: ${error.message}`);
    }
  }

  /**
   * Deleta múltiplos registros por IDs
   */
  async deleteMany(ids: string[]): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }

    const { error } = await supabase
      .from(this.table)
      .delete()
      .in('id', ids);

    if (error) {
      console.error(`Erro ao deletar múltiplos de ${this.table}:`, error);
      throw new Error(`Falha ao deletar: ${error.message}`);
    }
  }

  /**
   * Insere múltiplos registros
   */
  async insertMany(records: T[]): Promise<T[]> {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }

    if (records.length === 0) return [];

    const { data, error } = await supabase
      .from(this.table)
      .insert(records)
      .select();

    if (error) {
      console.error(`Erro ao inserir múltiplos em ${this.table}:`, error);
      throw new Error(`Falha ao salvar: ${error.message}`);
    }

    return data || [];
  }
}

// Instâncias dos repositórios para cada tabela
export const produtosRepo = new SupabaseRepository<any>('produtos');
export const lotesRepo = new SupabaseRepository<any>('lotes');
export const transacoesRepo = new SupabaseRepository<any>('transacoes');
export const fornecedoresRepo = new SupabaseRepository<any>('fornecedores');
export const fichasTecnicasRepo = new SupabaseRepository<any>('fichas_tecnicas');
export const fichaItensRepo = new SupabaseRepository<any>('ficha_tecnica_itens');
export const orcamentosRepo = new SupabaseRepository<any>('orcamentos');
export const alocacoesRepo = new SupabaseRepository<any>('alocacoes');
export const funcionariosRepo = new SupabaseRepository<any>('funcionarios');
export const sessoesRepo = new SupabaseRepository<any>('sessoes_aplicacao');
export const termosRepo = new SupabaseRepository<any>('termos_consentimento');
export const anamnesesRepo = new SupabaseRepository<any>('anamneses');
export const avaliacoesRepo = new SupabaseRepository<any>('avaliacoes_fisicas');
