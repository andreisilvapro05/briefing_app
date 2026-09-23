import { test } from "node:test";
import assert from "node:assert/strict";
import { extrairCredenciais } from "../src/lib/briefing-credenciais.ts";
import { blockPlainText } from "../src/lib/markdown-to-blocks.ts";

/**
 * A regra: senha de cliente NUNCA fica no corpo do documento.
 *
 * O corpo pode ganhar link público (/b/[token]), então uma senha que
 * escapa pra lá não tem volta. O contrapeso é a régua ser deliberadamente
 * frouxa dentro de um bloco de acesso: mandar um apelido inocente pro
 * cofre incomoda — a equipe continua vendo —, deixar senha no corpo não.
 *
 * TODOS os valores aqui são FALSOS, escritos à mão. Nenhuma senha real
 * entra num arquivo deste repositório, que é público.
 */
const p = (text: string, type = "paragraph") => ({
  type,
  content: [{ type: "text", text, styles: {} }],
});

function corpoTem(blocos: unknown[], agulha: string) {
  return blocos.some((b) => blockPlainText(b as never).includes(agulha));
}

test("senha dentro de um título vai pro cofre", () => {
  const r = extrairCredenciais([
    p("Dados de acesso wordpress:", "heading"),
    p("Senha: SenhaFalsa123", "heading"),
  ] as never);
  assert.ok(r.credenciais.some((c) => c.valor === "SenhaFalsa123"));
  assert.ok(!corpoTem(r.blocks as never[], "SenhaFalsa123"));
});

test("marcador de lista antes do rótulo não esconde a credencial", () => {
  // É como o bullet do ClickUp chega quando a página vira markdown.
  const r = extrairCredenciais([
    p("Dados de acesso hospedagem:"),
    p("* Senha: OutraFalsa456"),
    p("- Login: usuario.fake"),
  ] as never);
  assert.equal(r.credenciais.length, 2);
  assert.ok(!corpoTem(r.blocks as never[], "OutraFalsa456"));
});

test("negrito em volta do rótulo e do valor sai limpo", () => {
  const r = extrairCredenciais([
    p("Acessos do domínio:", "heading"),
    p("**Senha:** **TerceiraFalsa789**"),
  ] as never);
  assert.ok(r.credenciais.some((c) => c.valor === "TerceiraFalsa789"));
});

test("credencial em bloco de código multilinha não escapa", () => {
  // É como se cola um par login/senha — e a regex não atravessa "\n".
  const r = extrairCredenciais([
    p("Acessos", "heading"),
    p("Login: joaozinho.fake\nSenha: Xyz!2024falsa", "codeBlock"),
    p("Site no ar em https://exemplo.fake"),
  ] as never);
  assert.equal(r.credenciais.length, 2);
  assert.ok(!corpoTem(r.blocks as never[], "Xyz!2024falsa"));
  assert.ok(corpoTem(r.blocks as never[], "exemplo.fake"), "o resto fica");
});

test("bloco de código sem credencial fica intacto", () => {
  const r = extrairCredenciais([p("const x = 1;\nconsole.log(x);", "codeBlock")] as never);
  assert.equal(r.credenciais.length, 0);
  assert.ok(corpoTem(r.blocks as never[], "console.log"));
});

test("dois-pontos de largura total e rótulos em inglês", () => {
  const r = extrairCredenciais([
    p("Username： user.fake"),
    p("Password: Pp1!falsa"),
  ] as never);
  assert.equal(r.credenciais.length, 2);
});

test("linha de tabela markdown não esconde a credencial", () => {
  const r = extrairCredenciais([p("| Senha: Tt5&falsa |")] as never);
  assert.equal(r.credenciais.length, 1);
  assert.ok(!r.credenciais[0].valor.includes("|"), "a borda da célula sai");
});

test("linhas soltas sem rótulo dentro do bloco de acesso vão pro cofre", () => {
  // Em cerca de metade das páginas históricas a credencial é assim:
  // nenhuma regex de palavra-chave alcança.
  const r = extrairCredenciais([
    p("Dados de acesso domínio/hospedagem/wordpress:"),
    p("contato@fakecliente.com.br"),
    p("Xk9!falsa-senha"),
    p("admin.fake"),
    p("Zz2@outra-falsa"),
    p("Objetivo do site", "heading"),
    p("Vender mais para clínicas."),
  ] as never);
  assert.equal(r.credenciais.length, 4);
  assert.ok(!corpoTem(r.blocks as never[], "Xk9!falsa-senha"));
  assert.ok(corpoTem(r.blocks as never[], "Vender mais"), "fecha no título seguinte");
});

test("três pares seguidos: a terceira senha não fica pra trás", () => {
  const r = extrairCredenciais([
    p("Acessos", "heading"),
    p("Login: um.fake"), p("Senha: Aa1!falsa"),
    p("Login: dois.fake"), p("Senha: Bb2!falsa"),
    p("Login: tres.fake"), p("Senha: Cc3!falsa"),
  ] as never);
  assert.equal(r.credenciais.length, 6);
  assert.ok(!corpoTem(r.blocks as never[], "Cc3!falsa"));
});

test("sub-rótulo de acesso mantém o bloco aberto", () => {
  const r = extrairCredenciais([
    p("Dados de acesso:", "heading"),
    p("Link da hospedagem:"),
    p("hospedeiro.fake"),
    p("Hh4$falsa"),
  ] as never);
  assert.ok(r.credenciais.some((c) => c.valor === "Hh4$falsa"));
});

// --- O outro lado: o que NÃO pode ser confundido com credencial ---

test("os campos do Modelo continuam no documento", () => {
  // O acesso é UM item entre vários no Modelo de EI. Os seguintes são
  // conteúdo do briefing e não podem sumir do corpo.
  const r = extrairCredenciais([
    p("ESTRUTURA INICIAL", "heading"),
    p("Dados de acesso domínio/hospedagem/wordpress:"),
    p("Login: cliente.fake"),
    p("Senha: Kk7#falsa"),
    p("Logo do cliente: enviado"),
    p("Paleta: Azul"),
    p("Prazo: 30/10"),
    p("Responsável: Valéria"),
  ] as never);
  assert.equal(r.credenciais.length, 2);
  assert.ok(corpoTem(r.blocks as never[], "Paleta: Azul"));
  assert.ok(corpoTem(r.blocks as never[], "Prazo: 30/10"));
  assert.ok(!corpoTem(r.blocks as never[], "Kk7#falsa"));
});

test("bloco aberto sem título depois não engole o documento", () => {
  const r = extrairCredenciais([
    p("Dados de acesso wordpress:"),
    p("admin.fake"),
    p("Zz9!falsa"),
    p("Quais são as cores preferidas?"),
    p("Azul e branco, algo clean"),
    p("contato@clientefake.com.br"),
    p("R$ 3.500,00"),
  ] as never);
  assert.ok(corpoTem(r.blocks as never[], "cores preferidas?"), "pergunta fica");
  assert.ok(corpoTem(r.blocks as never[], "contato@clientefake.com.br"));
  assert.ok(corpoTem(r.blocks as never[], "R$ 3.500,00"));
});

test("frase comum com 'senha:' no meio não vira credencial", () => {
  const r = extrairCredenciais([
    p("Combinamos que a senha: será enviada depois por e-mail seguro"),
    p("O cliente ainda não mandou o acesso: aguardando retorno dele"),
  ] as never);
  assert.equal(r.credenciais.length, 0);
  assert.ok(corpoTem(r.blocks as never[], "aguardando retorno"));
});

test("documento sem acesso nenhum sai idêntico", () => {
  const r = extrairCredenciais([p("Objetivo do site"), p("Vender mais.")] as never);
  assert.equal(r.credenciais.length, 0);
  assert.equal((r.blocks as never[]).length, 2);
});

test("prosa curta fora de bloco de acesso fica no corpo", () => {
  const r = extrairCredenciais([
    p("Sobre a empresa", "heading"),
    p("Clínica"), p("Curitiba"), p("2019"),
  ] as never);
  assert.equal(r.credenciais.length, 0);
  assert.equal((r.blocks as never[]).length, 4);
});

test("emoji ou pontuação antes do rótulo não escondem a senha", () => {
  // Uma página real (EI - Cury Vendas) tinha "‼️ Senha: …" e a senha do
  // cliente foi parar no CORPO do documento, que pode ganhar link público.
  // A régua passou a ser "até 8 caracteres que não são letra nem número".
  const r = extrairCredenciais([
    p("‼️ Senha: Zz9!falsa-exemplo"),
    p("⚠️ Login: user.fake"),
    p("→ Senha: Aa1!falsa"),
    p('"Login": bb.fake'),
  ] as never);
  assert.equal(r.credenciais.length, 4);
  assert.ok(!corpoTem(r.blocks as never[], "Zz9!falsa-exemplo"));
});
