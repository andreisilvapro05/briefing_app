-- Mais de um modelo de briefing.
--
-- Karine (01/10): "ter modelos de briefing de site, landing page negócio,
-- landing page produto digital". Havia um Modelo só e todo briefing
-- nascia dele — site e landing de produto começam com perguntas
-- diferentes, e apagar metade a cada chamada é trabalho jogado fora.
--
-- O índice `ei_documents_one_template_per_kind` proibia o segundo. Sai, e
-- entra um que garante o que de fato importa: dois modelos do mesmo tipo
-- não podem ter o MESMO NOME, senão a lista de escolha fica ambígua.
--
-- Atenção a quem for mexer no código: `getTemplateDocument` e
-- `getTemplateDocumentId` usavam `.maybeSingle()`, que ESTOURA com mais de
-- uma linha. Foram corrigidos na mesma leva pra pegar o mais ANTIGO — o
-- Modelo original segue sendo o padrão de quem não escolhe.

drop index if exists public.ei_documents_one_template_per_kind;

create unique index if not exists ei_documents_template_nome_unico
  on public.ei_documents (kind, nome)
  where is_template;
