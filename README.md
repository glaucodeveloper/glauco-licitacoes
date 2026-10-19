# Glauco Licitações

Cockpit desktop para acompanhar agentes de licitações, portais externos e o radar da Bahia. A aplicação combina Electron, React e Vite com serviços locais e organização própria de dados.

## Estrutura

- `electron/`: inicialização e integração com a janela desktop.
- `src/`: interface da aplicação.
- `server/`: serviços locais.
- `data/`: dados usados pelo projeto.
- `scripts/`: desenvolvimento, empacotamento e ferramentas auxiliares.
- `test/`: testes Node.js.

## Desenvolvimento

Requer Node.js e npm.

```bash
npm install
npm run dev
```

## Comandos principais

```bash
npm test          # executa os testes Node.js
npm run build     # gera a interface Vite
npm run package   # compila e empacota a aplicação
npm run windows-app # gera um executável portátil para Windows
```

O README anterior apontava para um framework em um caminho relativo que não existe neste repositório. Esta documentação descreve a aplicação e os comandos declarados no `package.json` atual.
