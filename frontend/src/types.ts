export type TransactionType = "INCOME" | "EXPENSE";

export interface Category {
  id: string;
  userId?: string | null;
  code: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  status: boolean;
}

export interface Transaction {
  id: string;
  categoryId: string;
  type: TransactionType;
  description: string;
  value: string | number;
  date: string;
  paymentMethod: string;
  category: Pick<Category, "id" | "name" | "icon" | "color">;
}

export interface Summary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

export interface CategoryTotal {
  category: Pick<Category, "id" | "name" | "icon" | "color">;
  total: number;
  transactionsCount: number;
}

export interface OriginTotals {
  account: number;
  creditCard: number;
}

export type GoalType = "SAVINGS" | "SPENDING_LIMIT";
export type GoalStatus = "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  targetValue: string | number;
  dueDate: string;
  status: GoalStatus;
  categoryId: string | null;
  category: { id: string; name: string; status: boolean } | null;
  currentValue: number;
  progress: number;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
