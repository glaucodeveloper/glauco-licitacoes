# GLAUCO Example App

Projeto de exemplo para demonstrar o uso do [Glauco Framework](../glauco-framework/README.md) - um framework Ruby/JRuby para criar aplicações desktop com React-like state management.

## Pré-requisitos

```bash
# Instalar JRuby 10.0.4 ou superior
rbenv install jruby-10.0.4 || ruby -v && rbenv install jruby-10.0.4

# Instalar gems do projeto
bundle install
```

## Rodando o app

```bash
# Executar a aplicação de exemplo
jruby bin/main.rb
```

## Estrutura do Projeto

```
glauco-example-app/
├── Gemfile              # Dependências Ruby
├── .ruby-version        # Versão do JRuby (jruby-10.0.4)
├── bin/                 # Scripts de execução
│   └── main.rb         # Entrada principal da aplicação
├── core/                # Módulo Glauco Framework embeded
├── App/                 # Componentes do aplicativo
├── public/             # Assets públicos (CSS, JS)
├── config/             # Configurações YAML
├── data/               # Dados persistentes
└── docs/                # Documentação local
```

## Exemplos Disponíveis

Veja [`../glauco-framework/examples/`](../glauco-framework/examples/) para exemplos de apps:
- `basic_ui_with_fs_io.rb` - UI básica com acesso ao sistema de arquivos
- `floating_chat_app.rb` - App de chat web flutuante
- `linkedin_bot.rb` - Bot para LinkedIn Jobs

## Criando Novo Projeto a Partir deste Template

```bash
# No projeto alvo:
bundle exec warbler package # Empacotar como JAR
bundle exec glauco-package build # Construir com Glauco
bundle exec glauco-containerize build # Gerar imagem Docker
```

## Sobre o Framework Glauco

Framework Ruby para construir interfaces desktop HTML com gerenciamento de estado estilo React, usando:
- JRuby + SWT (para janela nativa)
- Expressões CSS/HTML aninhadas em Ruby
- State management funcional
- Suporte a Webviews e Browser embedded
- Integração com LLM via Ollama

---

_Referência principal: [../glauco-framework/README.md](../glauco-framework/README.md)_
