# PhotoLive Magic — Ferramentas V1

Esta camada adiciona ferramentas independentes ao projeto, sem alterar a Home e sem misturar os editores dentro dela.

## Ferramentas funcionais criadas

- `editor-fotos/index.html` — editor de fotos já existente, preservado.
- `editor-videos/index.html` — reprodução local, velocidade, seleção de início/fim para reprodução e captura de quadro.
- `organizador-fotos/index.html` — seleção múltipla, ordenação, filtro, remoção da seleção e relatório CSV.
- `recuperador-fotos/index.html` — teste de decodificação e criação de nova cópia PNG normalizada quando o navegador consegue abrir a imagem.
- `criador-fotos/index.html` — criação de post, quadrado, story e paisagem com foto e texto.
- `compressor-fotos/index.html` — conversão JPG/PNG/WebP, qualidade e largura máxima.
- `redimensionar-fotos/index.html` — alteração de dimensões com opção de manter proporção.
- `colagem-fotos/index.html` — montagem 1x2, 2x1, 1x3 e 2x2.
- `marca-dagua-fotos/index.html` — aplicação de marca d'água textual.
- `ferramentas/index.html` — central independente que lista as ferramentas.

## Princípio técnico

As operações de imagem desta camada são feitas localmente no navegador com File API, Canvas e elementos nativos de mídia. Os arquivos originais não são sobrescritos pelas ferramentas.

## Limitações importantes

### Recuperador
Não promete recuperar arquivos apagados do armazenamento. Ele somente recupera/normaliza uma imagem que ainda pode ser lida pelo navegador.

### Editor de vídeos
A V1 usa recursos nativos do navegador. Ela não gera um novo MP4 cortado. Para exportação de vídeo será necessário adicionar um motor apropriado, como FFmpeg/WebCodecs, em uma etapa própria.

### Organizador
O navegador não deve mover ou renomear arquivos arbitrariamente no computador do usuário. A ferramenta organiza a seleção e gera relatório CSV; uma etapa futura pode usar APIs de acesso a diretórios quando disponíveis e autorizadas pelo usuário.

## Integração

As páginas foram criadas separadamente e podem ser ligadas depois aos cards/botões da Minha Conta, Home comercial ou catálogo de serviços.

Não foi feita alteração estrutural na Home nesta etapa.


## Integração V1

- As ferramentas ficam separadas em `servicos/<ferramenta>/index.html`.
- A Central fica em `servicos/ferramentas/index.html`.
- A Minha Conta possui acesso à Central e aos editores funcionais.
- Os links comerciais continuam separados das ferramentas funcionais.
- O Recuperador normaliza imagens que o navegador ainda consegue decodificar; não recupera arquivos apagados do armazenamento.
- O Editor de Vídeos possui ferramentas locais de reprodução/análise; exportação avançada de vídeo exige processamento adicional.
