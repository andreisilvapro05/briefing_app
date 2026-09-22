import { register } from "node:module";
import { pathToFileURL } from "node:url";

/**
 * Deixa o Node resolver os imports do app.
 *
 * O código de `src/` importa sem extensão (`./markdown-to-blocks`) e pelo
 * atalho `@/lib/...` — as duas coisas são resolvidas pelo bundler do
 * Next, não pelo Node. Em vez de reescrever o app pra caber no runner de
 * teste, o runner aprende as duas regras. São elas:
 *
 *   "@/x"  → <raiz>/src/x
 *   "./x"  → tenta ./x.ts, depois ./x.tsx, depois ./x/index.ts
 *
 * Fica aqui, e não num arquivo de configuração de framework, porque é a
 * única coisa que os testes precisam além do Node.
 */
register(pathToFileURL(new URL("./ganchos.mjs", import.meta.url).pathname));
