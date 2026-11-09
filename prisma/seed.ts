import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type CategoryType } from "../generated/prisma/client";

interface GlobalCategory {
  code: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}

export const globalCategories: GlobalCategory[] = [
  {
    code: "GLOBAL-ALIMENTACAO",
    name: "Alimentação",
    type: "EXPENSE",
    icon: "Utensils",
    color: "#ea580c",
  },
  { code: "GLOBAL-MORADIA", name: "Moradia", type: "EXPENSE", icon: "House", color: "#1458d4" },
  { code: "GLOBAL-TRANSPORTE", name: "Transporte", type: "EXPENSE", icon: "Car", color: "#0891b2" },
  { code: "GLOBAL-SAUDE", name: "Saúde", type: "EXPENSE", icon: "HeartPulse", color: "#dc2626" },
  {
    code: "GLOBAL-EDUCACAO",
    name: "Educação",
    type: "EXPENSE",
    icon: "GraduationCap",
    color: "#7c3aed",
  },
  { code: "GLOBAL-LAZER", name: "Lazer", type: "EXPENSE", icon: "Gamepad2", color: "#db2777" },
  {
    code: "GLOBAL-COMPRAS",
    name: "Compras",
    type: "EXPENSE",
    icon: "ShoppingBag",
    color: "#ca8a04",
  },
  {
    code: "GLOBAL-SALARIO",
    name: "Salário",
    type: "INCOME",
    icon: "CircleDollarSign",
    color: "#16a34a",
  },
  {
    code: "GLOBAL-INVESTIMENTOS",
    name: "Investimentos",
    type: "INCOME",
    icon: "Landmark",
    color: "#163300",
  },
  {
    code: "GLOBAL-OUTRAS-RECEITAS",
    name: "Outras receitas",
    type: "INCOME",
    icon: "WalletCards",
    color: "#0891b2",
  },
];

/** Idempotente: `@@unique([userId, code])` não protege linhas com userId nulo, por isso a busca manual. */
export const seedGlobalCategories = async (client: PrismaClient): Promise<void> => {
  for (const category of globalCategories) {
    const existing = await client.category.findFirst({
      where: { userId: null, code: category.code },
      select: { id: true },
    });

    if (existing) {
      await client.category.update({ where: { id: existing.id }, data: category });
    } else {
      await client.category.create({ data: category });
    }
  }
};

const main = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não definida.");

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await seedGlobalCategories(client);
    console.log(`Seed concluído: ${globalCategories.length} categorias globais.`);
  } finally {
    await client.$disconnect();
  }
};

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
