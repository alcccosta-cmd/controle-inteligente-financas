import { getSupabase } from "@/lib/supabaseClient";
import type { Transaction, TransactionInsert, Category } from "./types";

function monthRange(month: string) {
  // month format: YYYY-MM
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, (m - 1), 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function createTransaction(payload: TransactionInsert): Promise<Transaction> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function listTransactionsByMonth(month: string): Promise<Transaction[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase não configurado");
  const { start, end } = monthRange(month);
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []) as Transaction[];
}

export async function listCategories(): Promise<Category[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, type, color, cost_center");
  if (error) throw error;
  return (data || []) as Category[];
}

export async function createCategory(payload: {
  name: string;
  type: "income" | "expense";
  color?: string | null;
  cost_center?: string | null;
}): Promise<Category> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: payload.name,
      type: payload.type,
      color: payload.color ?? null,
      cost_center: payload.cost_center ?? null,
    })
    .select("id, name, type, color, cost_center")
    .single();
  if (error) throw error;
  return data as Category;
}