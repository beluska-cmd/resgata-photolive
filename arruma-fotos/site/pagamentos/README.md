# Pagamentos PhotoLive Magic — InfinitePay

Esta camada usa o Checkout Integrado da InfinitePay.

Fluxo:
1. usuário entra na conta PhotoLive;
2. escolhe serviço + plano;
3. frontend chama `/checkout` com o token Supabase;
4. Worker valida o usuário no Supabase;
5. Worker cria pedido no D1;
6. Worker cria checkout na InfinitePay;
7. usuário paga;
8. InfinitePay chama `/webhook/infinitepay`;
9. Worker valida `order_nsu` e valor;
10. pedido passa para `PAID` e o entitlement é ativado.

Segurança:
- nunca coloque `INFINITEPAY_HANDLE` em JavaScript público;
- configure `INFINITEPAY_HANDLE` como secret do Worker;
- configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` como secrets;
- não libere acesso apenas porque o cliente voltou pela `redirect_url`;
- o webhook é a confirmação principal.

Os planos Avulso/Mensal/Anual são produtos de cobrança diferentes. A existência de "Mensal" ou "Anual" nesta camada não afirma cobrança recorrente automática; isso depende da configuração/recursos disponíveis na conta InfinitePay.
