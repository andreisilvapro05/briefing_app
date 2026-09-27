-- O arranjo de pagamento vira CAMPO, e o recebimento ganha data própria.
--
-- Pedido da Karine (26/09): "precisamos ter clareza todos os meses do que é
-- pagamento em pix e o que é fechamento; essas informações são difusas; tem
-- clientes que pagam parcelado, outros no pix, outros 50/50; no Asaas
-- começamos a receber só no outro mês quando é cartão, não antecipamos".
--
-- Hoje isso mora em `clients.pagamento_observacao`, texto livre. Os valores
-- reais no banco em 26/09: "pago no cartão" (13), "pix" (6), "50% recebido
-- de entrada, faltara 50% na entrega" (5), "entrada de R$431,5 + 5x de
-- 431,5 no boleto" (1), "R$1000 de entrada + R$1.406,56 no cartão em 8x"
-- (1). São três arranjos e uma forma, escritos de treze jeitos — por isso
-- nada soma.
--
-- NÃO há backfill. Adivinhar o arranjo a partir da frase erraria: "pago no
-- cartão" tanto descreve à vista quanto 8x. As colunas nascem nulas e a
-- observação antiga continua ali, ao lado, pra quem for preencher.

alter table public.clients
  -- Como o cliente combinou pagar.
  add column if not exists pagamento_arranjo text
    check (pagamento_arranjo in ('avista', 'entrada_saldo', 'parcelado', 'recorrente', 'outro')),
  -- Forma combinada. Não confundir com payment_receipts.forma, que é a
  -- forma de CADA recebimento — um 50/50 pode ter entrada no pix e saldo
  -- no cartão.
  add column if not exists pagamento_forma text
    check (pagamento_forma in ('pix', 'cartao', 'boleto', 'transferencia', 'dinheiro', 'misto')),
  -- Valor da entrada, quando o arranjo tem uma.
  add column if not exists pagamento_entrada numeric(12,2)
    check (pagamento_entrada is null or pagamento_entrada >= 0),
  -- Em quantas parcelas o saldo foi dividido.
  add column if not exists pagamento_parcelas smallint
    check (pagamento_parcelas is null or pagamento_parcelas between 1 and 48);

alter table public.payment_receipts
  -- Quando o dinheiro CAIU NA CONTA da agência. Nulo = no mesmo dia em que
  -- o cliente pagou, que é o caso de pix e boleto.
  --
  -- Existe porque `pago_em` carregava os dois sentidos ao mesmo tempo, e no
  -- cartão eles não coincidem: a compra é hoje, o repasse é no mês que vem.
  -- Sem separar, o caixa de setembro contava R$ 21.566,63 de cartão que
  -- ainda não entrou.
  add column if not exists recebido_em date,
  -- Qual parcela é esta, e de quantas. Nulo nos pagamentos únicos.
  add column if not exists parcela smallint
    check (parcela is null or parcela >= 1),
  add column if not exists parcelas_total smallint
    check (parcelas_total is null or parcelas_total between 1 and 48);

comment on column public.payment_receipts.recebido_em is
  'Data em que caiu na conta. Nulo = mesmo dia de pago_em. O caixa usa coalesce(recebido_em, pago_em).';
