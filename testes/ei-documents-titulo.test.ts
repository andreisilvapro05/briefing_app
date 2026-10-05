import { test } from "node:test";
import assert from "node:assert/strict";
import { eiDocumentTitle, nomeDaCopia } from "../src/lib/ei-documents.ts";

const cli = (empresa: string | null, nome: string | null = null) => ({
  id: "c1",
  nome,
  empresa,
});

test("o nome escrito à mão ganha do nome do cliente", () => {
  // Era o contrário: `if (doc.client)` vinha primeiro e o nome próprio era
  // ignorado, então os três briefings do mesmo cliente apareciam na lista
  // com o MESMO título. Karine (04/10): "está bagunçado".
  assert.equal(
    eiDocumentTitle({
      isTemplate: false,
      nome: "Briefing da LP de setembro",
      client: cli("Serigy"),
    }),
    "Briefing da LP de setembro"
  );
});

test("sem nome próprio, segue valendo o nome do cliente", () => {
  assert.equal(
    eiDocumentTitle({ isTemplate: false, nome: null, client: cli("Serigy") }),
    "Serigy"
  );
  // Espaço em branco não conta como nome.
  assert.equal(
    eiDocumentTitle({ isTemplate: false, nome: "   ", client: cli("Serigy") }),
    "Serigy"
  );
});

test("empresa vazia cai no nome da pessoa", () => {
  assert.equal(
    eiDocumentTitle({ isTemplate: false, nome: null, client: cli("", "Javier") }),
    "Javier"
  );
});

test("o Modelo continua se chamando Modelo", () => {
  assert.equal(
    eiDocumentTitle({ isTemplate: true, nome: null, client: null }),
    "Modelo"
  );
  // Mas um modelo nomeado mostra o nome — são 4 modelos desde 01/10.
  assert.equal(
    eiDocumentTitle({
      isTemplate: true,
      nome: "Modelo de landing de produto",
      client: null,
    }),
    "Modelo de landing de produto"
  );
});

test("documento avulso sem nome nenhum", () => {
  assert.equal(
    eiDocumentTitle({ isTemplate: false, nome: null, client: null }),
    "Sem título"
  );
});

test("a cópia numera quando o nome já existe", () => {
  assert.equal(nomeDaCopia("Serigy", []), "Serigy (cópia)");
  assert.equal(nomeDaCopia("Serigy", ["Serigy (cópia)"]), "Serigy (cópia 2)");
  assert.equal(
    nomeDaCopia("Serigy", ["Serigy (cópia)", "Serigy (cópia 2)"]),
    "Serigy (cópia 3)"
  );
});

test("copiar uma cópia não vira '(cópia) (cópia)'", () => {
  assert.equal(nomeDaCopia("Serigy (cópia)", []), "Serigy (cópia)");
  assert.equal(
    nomeDaCopia("Serigy (cópia)", ["Serigy (cópia)"]),
    "Serigy (cópia 2)"
  );
  assert.equal(
    nomeDaCopia("Serigy (cópia 2)", ["Serigy (cópia)", "Serigy (cópia 2)"]),
    "Serigy (cópia 3)"
  );
});

test("a comparação ignora maiúscula e espaço sobrando", () => {
  assert.equal(nomeDaCopia("Serigy", ["  serigy (CÓPIA)  "]), "Serigy (cópia 2)");
});
