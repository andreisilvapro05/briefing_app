-- Alinha o teto do bucket ao do app (3 MB, src/lib/uploads.ts).
--
-- O bucket nasceu com 4 MB, o mesmo valor do `bodySizeLimit` do Next. Os
-- dois iguais criam uma faixa cega: um arquivo de 4,2 MB é recusado pelo
-- TRANSPORTE da Vercel, antes de a Server Action rodar, e a tela volta
-- sem salvar e sem dizer por quê. Com folga, quem recusa somos nós — com
-- mensagem e com a saída ("suba no Drive e cole o link").

update storage.buckets
   set file_size_limit = 3145728
 where id = 'anexos-demandas';
