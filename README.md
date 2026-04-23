# Glauco Licitacoes Electron

Aplicativo Electron + React para administrar a empresa em torno de licitacoes do Estado da Bahia.

O app usa pasta local do usuario para estado, documentos, portais, TWA e logs. A primeira tela e um instalador fullscreen em slides para configurar Google/email, WhatsApp e perfil financeiro. A intencao historica inicia em branco e e inferida depois pelos itens das licitacoes participadas.

## Rodar

```powershell
npm install
npm start
```

## Testar

```powershell
npm test
```

## Build, pacote e container

```powershell
npm run build
npm run package
npm run containerize
npm run windows-app
```

`npm run containerize` gera Dockerfile, Kubernetes e runners em `dist/container` com baseline de hardening: usuario nao-root, capabilities removidas, `no-new-privileges`, filesystem read-only no runner e Pod Security `restricted`.

## Base Bahia

O radar usa a mesma base estrutural do projeto `explorador-licitacoes-ba-source`: corpus em `data/open-editais.dataset.json`, panorama em `data/open-editais.meta.json`, normalizacao, filtros, ordenacao por relevancia, paginacao e detalhe de edital.

## Portais e TWA

A tela `Portais externos` cadastra aplicativos por formulario simples, vincula cada app a uma rota da navegacao e abstrai porta/ngrok da interface. Ativar um portal inicia o servidor local e tenta abrir o tunel ngrok compartilhado. Gerar TWA cria manifest, assetlinks e scripts Bubblewrap na pasta local do usuario.
