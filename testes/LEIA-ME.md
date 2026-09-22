# Testes

`npm test` — roda tudo. Sem framework e sem dependência nova: é o runner
nativo do Node (`node --test`), que desde a versão 22 também executa
TypeScript direto, tirando os tipos na hora.

## O que tem aqui, e por quê

São as regras que **quebram calado** — as que erram sem dar erro, e que por
isso só apareceriam num briefing torto meses depois:

- `datas.test.ts` — formatação de prazo. `new Date("nao-e-data")` não lança:
  devolve data inválida, e formatá-la dá a string "Invalid Date" na tela.
- `credenciais.test.ts` — extração de senha do corpo do documento. O corpo
  pode ganhar link público; senha que escapa pra lá não tem volta. Todos os
  valores aqui são **falsos**, escritos à mão.
- `recorrencia.test.ts` — data da próxima ocorrência de uma demanda que se
  repete. Vira de mês e de ano, e mês que não tem dia 31.
- `links.test.ts` — links nas observações da tarefa.

## O que NÃO tem

Nada que dependa de banco, de rede ou de navegador. Esses caminhos são
verificados abrindo o app, e essa parte continua sendo manual.

## Escrevendo mais

Um arquivo `*.test.ts` aqui dentro, import relativo com a extensão `.ts`
(o alias `@/` não existe fora do bundler):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { minhaFuncao } from "../src/lib/arquivo.ts";

test("descrição do que tem que valer", () => {
  assert.equal(minhaFuncao("entrada"), "saída esperada");
});
```

Teste bom descreve a **regra**, não a implementação: o nome deve continuar
verdadeiro se a função for reescrita por dentro.
