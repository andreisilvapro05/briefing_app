/**
 * Estado de carregamento de TODAS as rotas /admin.
 *
 * Sem este arquivo o App Router não tem fronteira de Suspense na
 * navegação: ao clicar numa aba, a tela ficava congelada esperando o
 * servidor (medido em produção: 0,8s a 3,7s por página, todas
 * force-dynamic) e parecia que o clique não tinha funcionado.
 *
 * O esqueleto imita a casca (menu lateral + topo + cartões) pra que a
 * troca de aba não pareça um salto — só o miolo pisca enquanto os dados
 * chegam.
 */
export default function AdminLoading() {
  return (
    <div className="min-h-screen flex bg-fysi-cream" aria-busy="true">
      {/* Menu lateral (placeholder na mesma medida do real) */}
      <aside className="hidden md:flex w-[232px] shrink-0 border-r border-fysi-line bg-white flex-col">
        <div className="h-14 border-b border-fysi-line flex items-center gap-2.5 px-4">
          <div className="w-7 h-7 rounded-[8px] bg-fysi-cream animate-pulse" />
          <div className="flex flex-col gap-1">
            <div className="h-2.5 w-24 rounded bg-fysi-cream animate-pulse" />
            <div className="h-2 w-16 rounded bg-fysi-cream/70 animate-pulse" />
          </div>
        </div>
        <div className="p-3 flex flex-col gap-5">
          {[6, 4, 3].map((qtd, bloco) => (
            <div key={bloco} className="flex flex-col gap-1.5">
              <div className="h-2 w-20 rounded bg-fysi-cream animate-pulse mb-1" />
              {Array.from({ length: qtd }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 rounded-[10px] bg-fysi-cream/70 animate-pulse"
                />
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topo */}
        <div className="h-14 shrink-0 border-b border-fysi-line bg-white/90 flex items-center justify-between gap-3 px-4 md:px-6">
          <div className="h-3 w-40 rounded bg-fysi-cream animate-pulse" />
          <div className="h-9 flex-1 max-w-md rounded-full bg-fysi-cream animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-fysi-cream animate-pulse" />
            <div className="w-9 h-9 rounded-full bg-fysi-cream animate-pulse" />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-4">
          <div className="h-7 w-56 rounded bg-white animate-pulse" />
          <div className="h-3 w-80 rounded bg-white/70 animate-pulse mb-2" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[150px] rounded-[20px] bg-white border border-fysi-line shadow-fysi-card animate-pulse"
              />
            ))}
          </div>
          <div className="h-72 rounded-[20px] bg-white border border-fysi-line shadow-fysi-card animate-pulse" />
        </div>
      </div>

      <span className="sr-only">Carregando…</span>
    </div>
  );
}
