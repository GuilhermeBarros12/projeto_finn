import { beforeEach, describe, expect, it } from "vitest";
import { api, createCard, createUser, resetDatabase, type TestUser } from "./helpers";

let user: TestUser;

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
});

describe("cartões", () => {
  it("o primeiro cartão vira padrão e o segundo não", async () => {
    const first = await createCard(user.token, { name: "Primeiro" });
    const second = await createCard(user.token, { name: "Segundo" });

    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);
  });

  it("criar com isDefault troca o padrão e mantém um só", async () => {
    const first = await createCard(user.token, { name: "Primeiro" });
    const second = await createCard(user.token, { name: "Segundo", isDefault: true });
    const list = await api(user.token).get("/api/cards");

    expect(second.isDefault).toBe(true);
    expect(list.body.cards.filter((card: { isDefault: boolean }) => card.isDefault)).toHaveLength(
      1,
    );
    expect(list.body.cards[0].id).toBe(second.id);
    expect(list.body.cards[1].id).toBe(first.id);
  });

  it("PATCH /default troca o padrão e recusa cartão desativado", async () => {
    await createCard(user.token, { name: "Primeiro" });
    const second = await createCard(user.token, { name: "Segundo" });

    const swap = await api(user.token).patch(`/api/cards/${second.id}/default`);
    expect(swap.status).toBe(200);
    expect(swap.body.card.isDefault).toBe(true);

    const third = await createCard(user.token, { name: "Terceiro" });
    await api(user.token).patch(`/api/cards/${third.id}/deactivate`);
    const refused = await api(user.token).patch(`/api/cards/${third.id}/default`);
    expect(refused.status).toBe(422);
  });

  it("desativar o padrão passa o padrão ao cartão ativo mais antigo", async () => {
    const first = await createCard(user.token, { name: "Primeiro" });
    const second = await createCard(user.token, { name: "Segundo" });
    await createCard(user.token, { name: "Terceiro" });

    const response = await api(user.token).patch(`/api/cards/${first.id}/deactivate`);
    const list = await api(user.token).get("/api/cards");

    expect(response.status).toBe(200);
    expect(response.body.card.status).toBe(false);
    expect(response.body.transactionsCount).toBe(0);
    expect(list.body.cards[0].id).toBe(second.id);
    expect(list.body.cards[0].isDefault).toBe(true);
  });

  it("desativar o último cartão deixa sem padrão e recusa repetir", async () => {
    const only = await createCard(user.token);

    await api(user.token).patch(`/api/cards/${only.id}/deactivate`);
    const again = await api(user.token).patch(`/api/cards/${only.id}/deactivate`);
    const all = await api(user.token).get("/api/cards?includeInactive=true");

    expect(again.status).toBe(409);
    expect(all.body.cards).toHaveLength(1);
    expect(all.body.cards[0].isDefault).toBe(false);
  });

  it("fechamento igual ao vencimento devolve 400 no POST e 422 no PUT parcial", async () => {
    const invalid = await api(user.token)
      .post("/api/cards")
      .send({ name: "X", closingDay: 10, dueDay: 10 });
    const card = await createCard(user.token, { closingDay: 25, dueDay: 5 });
    const partial = await api(user.token).put(`/api/cards/${card.id}`).send({ closingDay: 5 });

    expect(invalid.status).toBe(400);
    expect(partial.status).toBe(422);
  });

  it("PUT com dias preenche datesConfirmedAt e aceita só o nome", async () => {
    const card = await createCard(user.token);
    const renamed = await api(user.token).put(`/api/cards/${card.id}`).send({ name: "Novo" });
    const moved = await api(user.token).put(`/api/cards/${card.id}`).send({ closingDay: 20 });
    const empty = await api(user.token).put(`/api/cards/${card.id}`).send({});

    expect(renamed.body.card.name).toBe("Novo");
    expect(moved.body.card.closingDay).toBe(20);
    expect(moved.body.card.datesConfirmedAt).toEqual(expect.any(String));
    expect(empty.status).toBe(400);
  });

  it("GET sem includeInactive esconde os desativados", async () => {
    await createCard(user.token, { name: "Ativo" });
    const off = await createCard(user.token, { name: "Inativo" });
    await api(user.token).patch(`/api/cards/${off.id}/deactivate`);

    const active = await api(user.token).get("/api/cards");
    const all = await api(user.token).get("/api/cards?includeInactive=true");

    expect(active.body.cards).toHaveLength(1);
    expect(all.body.cards).toHaveLength(2);
  });
});
