import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ehTrabalhoAtivo,
  projetoFechado,
  soTrabalhoAtivo,
  type TarefaComProjeto,
} from "../src/lib/trabalho-ativo.ts";
import type { TaskStatus } from "../src/lib/project-tasks.ts";

const t = (
  status: TaskStatus,
  clientStatus?: string | null
): TarefaComProjeto => ({
  status,
  client: clientStatus === undefined ? null : { status: clientStatus },
});

test("tarefa aberta de projeto ENTREGUE sai das telas de trabalho", () => {
  // O caso da Marplast: projeto completo-entregue com 11 tarefas abertas.
  assert.equal(ehTrabalhoAtivo(t("a-iniciar", "completo-entregue")), false);
  assert.equal(ehTrabalhoAtivo(t("design-pagina", "concluido")), false);
});

test("tarefa aberta de projeto em andamento FICA", () => {
  assert.equal(ehTrabalhoAtivo(t("a-iniciar", "design-pagina")), true);
  assert.equal(ehTrabalhoAtivo(t("implementacao", "onboarding")), true);
  assert.equal(ehTrabalhoAtivo(t("a-iniciar", "parado")), true);
});

test("demanda INTERNA nunca é descartada — não tem projeto", () => {
  // `client: null`. Era o buraco que já tinha engolido a demanda interna
  // da Karine uma vez; a regra nova não pode repetir isso.
  assert.equal(ehTrabalhoAtivo(t("a-iniciar")), true);
  assert.equal(ehTrabalhoAtivo(t("a-iniciar", null)), true);
  assert.equal(projetoFechado(t("a-iniciar", null)), false);
});

test("tarefa JÁ FECHADA passa, mesmo em projeto fechado", () => {
  // Quem filtra concluída é cada tela. Descartar aqui também esconderia o
  // histórico de quem quer ver o que terminou.
  assert.equal(ehTrabalhoAtivo(t("concluido", "completo-entregue")), true);
  assert.equal(ehTrabalhoAtivo(t("completo-entregue", "concluido")), true);
});

test("status de projeto desconhecido não descarta nada", () => {
  // Errar pro lado de MOSTRAR: esconder trabalho real é o pior defeito que
  // este app pode ter.
  assert.equal(ehTrabalhoAtivo(t("a-iniciar", "status-que-nao-existe")), true);
  assert.equal(ehTrabalhoAtivo(t("a-iniciar", "")), true);
});

test("soTrabalhoAtivo filtra a lista inteira", () => {
  const lista = [
    t("a-iniciar", "completo-entregue"),
    t("a-iniciar", "design-pagina"),
    t("a-iniciar"),
    t("concluido", "concluido"),
  ];
  assert.equal(soTrabalhoAtivo(lista).length, 3);
});

test("projeto ARQUIVADO também sai, mesmo com status aberto", () => {
  // A Balen Susin está arquivada (desistiu) com 11 tarefas abertas, e o
  // status dela é "parado" — que NÃO é um status fechado. Sem olhar
  // `arquivado_em`, as 11 continuavam no trabalho de todo mundo.
  const arquivada: TarefaComProjeto = {
    status: "a-iniciar",
    client: { status: "parado", arquivado_em: "2026-09-30T12:00:00Z" },
  };
  assert.equal(projetoFechado(arquivada), true);
  assert.equal(ehTrabalhoAtivo(arquivada), false);
});

test("não arquivado e em andamento continua passando", () => {
  assert.equal(
    ehTrabalhoAtivo({
      status: "a-iniciar",
      client: { status: "parado", arquivado_em: null },
    }),
    true
  );
});
