# DoseCerta — Controle do MEI (aplicação de fármacos)

Agenda de aplicações, estoque com rastreabilidade (lote + validade + CPF),
financeiro com CMV/margem, protocolos e orçamentos. Web app instalável (PWA).

## O que publicar

A pasta **`dist/`** contém o site pronto. Tudo fora dela é código-fonte
(serve apenas para desenvolvimento).

## Publicar no Netlify (link definitivo, grátis)

1. Acesse https://app.netlify.com/drop
2. Arraste **a pasta `dist`** (não a raiz do projeto).
3. Pronto: você recebe um link HTTPS para instalar em qualquer aparelho.

Alternativa com atualização automática: suba o projeto no GitHub e importe
no Netlify — o `netlify.toml` já define build (`npm run build`) e pasta (`dist`).

## Instalar como app

- iPhone: abra o link no Safari → Compartilhar → Adicionar à Tela de Início.
- Android/PC: abra o link e use o botão Instalar do próprio app (ou o ícone
  na barra de endereço do Chrome/Edge).

## Desenvolvimento local

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera a pasta dist/
```

## Dados

Os dados ficam no navegador de cada aparelho (localStorage).
Migração entre aparelhos: Dinheiro → Backup → exportar JSON → Restaurar.
