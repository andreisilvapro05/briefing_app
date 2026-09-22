import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const RAIZ = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const EXTENSOES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(especificador, contexto, proximo) {
  // Atalho "@/..." do tsconfig — aponta pra src/.
  if (especificador.startsWith("@/")) {
    const base = path.join(RAIZ, "src", especificador.slice(2));
    const achado = comExtensao(base);
    if (achado) return { url: pathToFileURL(achado).href, shortCircuit: true };
  }

  // Import relativo sem extensão.
  if (especificador.startsWith(".") && contexto.parentURL) {
    const base = path.resolve(
      path.dirname(fileURLToPath(contexto.parentURL)),
      especificador
    );
    const achado = comExtensao(base);
    if (achado) return { url: pathToFileURL(achado).href, shortCircuit: true };
  }

  return proximo(especificador, contexto);
}

function comExtensao(base) {
  if (existsSync(base) && path.extname(base)) return base;
  for (const ext of EXTENSOES) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}
