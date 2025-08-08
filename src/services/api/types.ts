export type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
  color?: string | null;
  cost_center?: string | null;
};

export type TransactionInsert = {
  date: string; // ISO date
  description: string;
  amount: number; // positive number; category type indicates income/expense
  category_id?: string | null;
  payment_method?: string | null;
  is_paid?: boolean | null;
  source?: string | null; // "manual" | "ocr" | "card"
  card?: string | null;
};

export type Transaction = TransactionInsert & {
  id: string;
  created_at: string;
  user_id?: string | null;
};
