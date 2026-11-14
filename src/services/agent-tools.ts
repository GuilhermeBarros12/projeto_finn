import { ZodError, z } from "zod";
import { AppError } from "../lib/app-error";
import type { AgentTool } from "../lib/agent-model";
import { dashboardPeriodSchema } from "../schemas/dashboard.schema";
import { goalListSchema } from "../schemas/goal.schema";
import { transactionListSchema } from "../schemas/transaction.schema";
import { CategoryService } from "./category.service";
import { DashboardService } from "./dashboard.service";
import { GoalService } from "./goal.service";
import { TransactionService } from "./transaction.service";

const categoryService = new CategoryService();
const dashboardService = new DashboardService();
const goalService = new GoalService();
const transactionService = new TransactionService();

const MAX_TRANSACTIONS_PER_PAGE = 50;

const nullableInteger = { type: ["integer", "null"] };

/** Todas as ferramentas são de leitura. O usuário nunca é parâmetro: vem sempre do token. */
export const agentTools: AgentTool[] = [
  {
    name: "listar_categorias",
    description: "Lista as categorias ativas disponíveis para a pessoa, com id, nome e tipo.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "consultar_resumo_mes",
    description:
      "Devolve os totais de um mês: receitas, despesas, resultado, valores por categoria e despesas por origem (conta ou cartão).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        month: { type: "integer", description: "Mês de 1 a 12." },
        year: { type: "integer", description: "Ano com quatro dígitos." },
      },
      required: ["month", "year"],
      additionalProperties: false,
    },
  },
  {
    name: "buscar_lancamentos",
    description: `Busca lançamentos, do mais recente ao mais antigo, com até ${MAX_TRANSACTIONS_PER_PAGE} por página. Quem informa month também precisa informar year. Use null nos filtros que não se aplicam.`,
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        month: nullableInteger,
        year: nullableInteger,
        type: { type: ["string", "null"], enum: ["INCOME", "EXPENSE", null] },
        categoryId: { type: ["string", "null"], description: "Id vindo de listar_categorias." },
        page: nullableInteger,
      },
      required: ["month", "year", "type", "categoryId", "page"],
      additionalProperties: false,
    },
  },
  {
    name: "listar_metas",
    description:
      "Lista as metas da pessoa com valor-alvo, valor atual, progresso em porcentagem, prazo e situação.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["IN_PROGRESS", "COMPLETED", "EXPIRED", null],
        },
      },
      required: ["status"],
      additionalProperties: false,
    },
  },
];

const inputSchema = z.record(z.string(), z.unknown());

const withoutNulls = (input: unknown): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(inputSchema.parse(input)).filter(([, value]) => value !== null),
  );

const toCalendarDate = (date: Date): string => date.toISOString().slice(0, 10);

type Executor = (userId: string, input: unknown) => Promise<unknown>;

const executors = new Map<string, Executor>([
  [
    "listar_categorias",
    async (userId) =>
      (await categoryService.list(userId)).map(({ id, name, type }) => ({ id, name, type })),
  ],
  [
    "consultar_resumo_mes",
    async (userId, input) => {
      const period = dashboardPeriodSchema.parse(withoutNulls(input));
      const [summary, expenses, incomes, origins] = await Promise.all([
        dashboardService.summary(userId, period),
        dashboardService.totalsByCategory(userId, { ...period, type: "EXPENSE" }),
        dashboardService.totalsByCategory(userId, { ...period, type: "INCOME" }),
        dashboardService.totalsByOrigin(userId, { ...period, type: "EXPENSE" }),
      ]);
      const byName = ({ category, total }: (typeof expenses)[number]) => ({
        categoria: category.name,
        total,
      });

      return {
        receitas: summary.totalIncome,
        despesas: summary.totalExpense,
        resultado: summary.netBalance,
        despesasPorCategoria: expenses.map(byName),
        receitasPorCategoria: incomes.map(byName),
        despesasPorOrigem: { conta: origins.account, cartao: origins.creditCard },
      };
    },
  ],
  [
    "buscar_lancamentos",
    async (userId, input) => {
      const filters = transactionListSchema.parse({
        ...withoutNulls(input),
        limit: MAX_TRANSACTIONS_PER_PAGE,
      });
      const { data, meta } = await transactionService.list(userId, filters);

      return {
        total: meta.total,
        pagina: meta.page,
        totalPaginas: meta.totalPages,
        lancamentos: data.map((transaction) => ({
          data: toCalendarDate(transaction.date),
          descricao: transaction.description,
          valor: transaction.value.toNumber(),
          tipo: transaction.type,
          categoria: transaction.category.name,
          formaDePagamento: transaction.paymentMethod,
        })),
      };
    },
  ],
  [
    "listar_metas",
    async (userId, input) => {
      const filters = goalListSchema.parse({ ...withoutNulls(input), limit: 100 });
      const { data } = await goalService.list(userId, filters);

      return data.map((goal) => ({
        titulo: goal.title,
        tipo: goal.type,
        valorAlvo: goal.targetValue.toNumber(),
        valorAtual: goal.currentValue,
        progressoPorcentagem: goal.progress,
        prazo: toCalendarDate(goal.dueDate),
        situacao: goal.status,
      }));
    },
  ],
]);

export interface AgentToolResult {
  content: string;
  isError: boolean;
}

export const runAgentTool = async (
  userId: string,
  name: string,
  input: unknown,
): Promise<AgentToolResult> => {
  const executor = executors.get(name);
  if (!executor) return { content: `Ferramenta desconhecida: ${name}.`, isError: true };

  try {
    return { content: JSON.stringify(await executor(userId, input)), isError: false };
  } catch (error) {
    // Erro de filtro volta ao modelo, que pode corrigir a chamada; falha de sistema sobe.
    if (error instanceof ZodError) {
      const details = error.issues.map(({ path, message }) => `${path.join(".")}: ${message}`);
      return { content: `Filtros inválidos. ${details.join("; ")}`, isError: true };
    }

    if (error instanceof AppError && error.statusCode < 500) {
      return { content: error.message, isError: true };
    }

    throw error;
  }
};
