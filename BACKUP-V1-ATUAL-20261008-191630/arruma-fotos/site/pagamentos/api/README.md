# PhotoLive Magic — Integração PagBank

## Fluxo

1. Cliente escolhe um serviço.
2. PhotoLive cria uma solicitação de pagamento.
3. Backend cria o checkout no PagBank.
4. Cliente é enviado ao checkout PagBank.
5. PagBank processa o pagamento.
6. PagBank envia webhook ao backend.
7. Backend confirma o status.
8. Serviço passa para ACTIVE somente após confirmação.

## Serviços

- Editor de Fotos — R$ 9,90
- Editor de Vídeos — R$ 12,90
- Recuperar — R$ 14,90
- Diagnóstico — R$ 7,90
- Premium — R$ 24,90

## Estados

NOT_CONTRACTED
PENDING
ACTIVE
CANCELED
EXPIRED

## Importante

Nunca colocar token secreto do PagBank no frontend.

A ativação do serviço deve depender da confirmação recebida pelo backend/webhook.
