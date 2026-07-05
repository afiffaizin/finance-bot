export interface Transaction {
  id: string;
  wa_number: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  transaction_date: string;
  created_at: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface DailyData {
  date: string;
  income: number;
  expense: number;
}

export interface CategoryData {
  category: string;
  type: string;
  total: number;
}

export interface SummaryResponse {
  month: string;
  total_income: number;
  total_expense: number;
  balance: number;
  categories: CategoryData[];
  daily: DailyData[];
}
