import { test } from "node:test";
import assert from "node:assert/strict";
import {
  caminhoSeguro,
  humanizarTamanho,
  lerAnexos,
  linkValido,
  nomeDoLink,
  tipoDeArquivoAceito,
  type AnexoDemanda,
} from "../src/lib/anexos-demanda.ts";

test("link aceita só http e https", () => {
  assert.ok(linkValido("https://drive.google.com/drive/folders/abc"));
  assert.ok(linkValido("http://exemplo.com.br/arquivo.pdf"));
  assert.ok(!linkValido(""));
  assert.ok(!linkValido("   "));
  assert.ok(!linkValido("drive.google.com/abc"), "sem esquema não é URL");
});

test("javascript: não vira link clicável", () => {
  // A lista é escrita por uma pessoa e lida por outra — href com
  // javascript: seria XSS a um clique de distância.
  assert.ok(!linkValido("javascript:alert(1)"));
  assert.ok(!linkValido("JavaScript:alert(1)"));
  assert.ok(!linkValido("data:text/html,<script>alert(1)</script>"));
  assert.ok(!linkValido("mailto:alguem@fysi.com"));
});

test("o nome do link sai do arquivo, e sem arquivo sai do domínio", () => {
  assert.equal(nomeDoLink("https://exemplo.com/pasta/Briefing%20final.pdf"), "Briefing final.pdf");
  // O caso do Drive: termina em id, não em nome de arquivo.
  assert.equal(nomeDoLink("https://drive.google.com/drive/folders/1a2b3c"), "drive.google.com");
  assert.equal(nomeDoLink("https://www.canva.com/design/XYZ"), "canva.com");
  assert.equal(nomeDoLink("nem é url"), "link");
});

test("tipo de arquivo: passa o que a equipe anexa, barra executável", () => {
  assert.ok(tipoDeArquivoAceito("image/png"));
  assert.ok(tipoDeArquivoAceito("application/pdf"));
  assert.ok(
    tipoDeArquivoAceito(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  );
  assert.ok(!tipoDeArquivoAceito("application/x-msdownload"));
  assert.ok(!tipoDeArquivoAceito("application/x-sh"));
  assert.ok(!tipoDeArquivoAceito(""));
});

test("caminho do arquivo não carrega nada que quebre a storage", () => {
  assert.equal(caminhoSeguro("Proposta final (v2).pdf"), "Proposta-final--v2-.pdf");
  assert.equal(caminhoSeguro("../../etc/passwd"), "..-..-etc-passwd");
  // O que importa é não sobrar barra: sem barra não há travessia de pasta.
  assert.ok(!caminhoSeguro("../../etc/passwd").includes("/"));
  assert.equal(caminhoSeguro(""), "arquivo");
  assert.ok(caminhoSeguro("a".repeat(300)).length <= 120);
});

test("coluna torta ou vazia não quebra a tela", () => {
  assert.deepEqual(lerAnexos(null), []);
  assert.deepEqual(lerAnexos(undefined), []);
  assert.deepEqual(lerAnexos("[]"), [], "string não é lista");
  assert.deepEqual(lerAnexos([{ nada: 1 }]), [], "item sem id/tipo é descartado");
  assert.deepEqual(lerAnexos([{ id: "a", tipo: "outro" }]), []);
});

test("lerAnexos mantém os itens válidos e descarta só o resto", () => {
  const bom: AnexoDemanda = {
    id: "1",
    tipo: "link",
    url: "https://x.com/a.pdf",
    nome: "a.pdf",
    criado_em: "2026-09-30T00:00:00.000Z",
  };
  assert.deepEqual(lerAnexos([bom, null, { id: "2" }]), [bom]);
});

test("tamanho em texto de gente", () => {
  assert.equal(humanizarTamanho(undefined), "");
  assert.equal(humanizarTamanho(0), "");
  assert.equal(humanizarTamanho(900), "900 B");
  assert.equal(humanizarTamanho(2048), "2 KB");
  assert.equal(humanizarTamanho(3 * 1024 * 1024), "3.0 MB");
});
