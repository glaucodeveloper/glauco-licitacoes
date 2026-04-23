# Abstracao documental do PDF Confidence / Patagonia

## Fonte analisada

- Arquivo origem: `C:\Users\usuario\Downloads\Confidence Documentação completa Patagônia.pdf`
- Total de paginas: `52`
- Contexto identificado: `Concorrencia Eletronica 001/2025`
- Processo administrativo: `069.1475.2024.0003715-28`
- Proponente principal: `Confidence Construtora Ltda`
- Observacao tecnica: parte do PDF esta em paginas escaneadas; essas paginas foram classificadas visualmente para fechar o mapa documental.

## Estrutura documental abstrata

### 1. Contexto e proposta

- Documento nuclear que identifica o certame, o proponente, o representante legal e o valor ofertado.
- Funcao abstrata: abrir o dossie e amarrar todo o restante ao mesmo contexto administrativo.

### 2. Declaracoes de habilitacao e integridade

- Declaracoes de independencia da proposta, inexistencia de impedimento, veracidade documental e atendimento a requisitos legais.
- Funcao abstrata: registrar manifestacoes formais do licitante sobre conformidade, integridade e responsabilidade.

### 3. Qualificacao tecnico-operacional declarada

- Declaracoes sobre equipe, equipamentos, disponibilidade tecnica e aptidao declarada para desempenho.
- Funcao abstrata: afirmar capacidade operacional antes da camada de comprovacao.

### 4. Qualificacao economico-financeira

- Demonstrativo de disponibilidade financeira liquida, compromissos assumidos e patrimonio liquido.
- Funcao abstrata: demonstrar saude financeira e capacidade de absorver o contrato.

### 5. Camada de comprovacao institucional e cadastral

- Identificacao do representante, cadastro de fornecedor, certidoes institucionais e situacao cadastral.
- Funcao abstrata: comprovar existencia juridica, situacao cadastral e regularidade formal.

### 6. Camada de comprovacao tecnica por responsavel

- Para cada responsavel tecnico existe um conjunto recorrente:
- autorizacao individual;
- contrato de vinculacao;
- registro/quitação profissional;
- acervo tecnico ou operacional;
- atestado vinculado.
- Funcao abstrata: provar que a pessoa existe, esta vinculada ao licitante e possui experiencia aderente.

### 7. Declaracoes finais de conformidade

- Declaracoes de pleno conhecimento tecnico, protecao ao trabalho do menor e reserva de cargos.
- Funcao abstrata: fechar o pacote com declaracoes legais de aderencia normativa.

## Mapa do PDF por paginas

### Bloco principal

- p. 1: Proposta de preco
- p. 2-3: Declaracao de elaboracao independente de proposta e de inexistencia de impedimento a participacao no certame
- p. 4: Declaracao de veracidade de documentos
- p. 5-6: Declaracao de disponibilidade tecnica e equipamentos
- p. 7: Demonstrativo da disponibilidade financeira liquida
- p. 8: Declaracao de compromissos assumidos
- p. 9: Comprovacao de aptidao para o desempenho
- p. 10: Declaracao de patrimonio liquido
- p. 50: Declaracao de pleno conhecimento de requisitos tecnicos
- p. 51: Declaracao de protecao ao trabalho do menor
- p. 52: Declaracao de reserva de cargos para pessoa com deficiencia ou reabilitado da previdencia social

### Bloco de comprovacao institucional e cadastral

- p. 11: CNH do representante legal com QR Code
- p. 12: Certificado de Registro Cadastral - CRC
- p. 13-14: Situacao cadastral do fornecedor e painel de documentos/validade
- p. 15: Certidao estadual de concordata, falencia, recuperacao judicial e extrajudicial
- p. 16: Certidao de registro e quitacao - pessoa juridica - CREA-BA

### Bloco tecnico - Engenharia Civil

- p. 17-18: CAT com registro de atestado - Emily Almeida Pires
- p. 19-28: Atestado vinculado a CAT da Engenheira Civil
- p. 29: Certidao de Acervo Operacional - CAO da empresa
- p. 30-32: Contrato de prestacao de servicos tecnicos de engenharia civil
- p. 33: Autorizacao individual de responsavel tecnico - Emily Almeida Pires
- p. 34: Certidao de registro e quitacao - pessoa fisica - Emily Almeida Pires

### Bloco tecnico - Engenharia Eletrica

- p. 35: Autorizacao individual de responsavel tecnico - Paulo Moreira Mota da Silva
- p. 36: CAT com registro de atestado - Paulo Moreira Mota da Silva
- p. 37-45: Atestado vinculado a CAT do Engenheiro Eletricista
- p. 46-47: Contrato de assistencia tecnica especializada em engenharia eletrica
- p. 48-49: Certidao de registro e quitacao - pessoa fisica - Paulo Moreira Mota da Silva

## Anexos identificados

### Anexos institucionais e cadastrais

- Anexo 01: CNH do representante legal - p. 11
- Anexo 02: Certificado de Registro Cadastral (CRC) - p. 12
- Anexo 03: Situacao cadastral do fornecedor - p. 13-14
- Anexo 04: Certidao estadual de falencia/concordata - p. 15
- Anexo 05: Certidao CREA pessoa juridica - p. 16

### Anexos tecnicos - Engenharia Civil

- Anexo 06: CAT com registro de atestado da Engenheira Civil - p. 17-18
- Anexo 07: Atestado vinculado a CAT da Engenheira Civil - p. 19-28
- Anexo 08: Certidao de Acervo Operacional (CAO) da empresa - p. 29
- Anexo 09: Contrato de vinculacao da Engenheira Civil - p. 30-32
- Anexo 10: Autorizacao individual da Engenheira Civil - p. 33
- Anexo 11: Certidao CREA pessoa fisica da Engenheira Civil - p. 34

### Anexos tecnicos - Engenharia Eletrica

- Anexo 12: Autorizacao individual do Engenheiro Eletricista - p. 35
- Anexo 13: CAT com registro de atestado do Engenheiro Eletricista - p. 36
- Anexo 14: Atestado vinculado a CAT do Engenheiro Eletricista - p. 37-45
- Anexo 15: Contrato de vinculacao do Engenheiro Eletricista - p. 46-47
- Anexo 16: Certidao CREA pessoa fisica do Engenheiro Eletricista - p. 48-49

## Abstracao util para sistema

### Entidades minimas

- `PacoteDocumental`: o dossie completo de uma licitacao/processo.
- `SecaoDocumental`: agrupamento logico, por exemplo `proposta`, `declaracoes`, `qualificacao_financeira`, `qualificacao_tecnica`.
- `DocumentoPrincipal`: documento declaratorio ou formulario principal.
- `Anexo`: evidencia que sustenta um documento principal ou uma secao.
- `Pessoa`: representante legal ou responsavel tecnico.
- `Entidade`: empresa licitante, orgao contratante, conselho profissional.
- `Validacao`: regra de integridade, assinatura, prazo, vencimento, relacao entre documentos.

### Relacoes abstratas

- Um `PacoteDocumental` contem varias `SecoesDocumentais`.
- Cada `SecaoDocumental` contem `DocumentosPrincipais` e `Anexos`.
- Um `Anexo` pode comprovar mais de um `DocumentoPrincipal`.
- Uma `Pessoa` pode estar ligada a varios anexos tecnicos.
- Um `DocumentoPrincipal` pode exigir anexos obrigatorios.
- Um documento pode ter `validade`, `assinatura`, `origem_textual` e `status_de_validacao`.

### Regras de negocio sugeridas

- Todo documento deve pertencer a exatamente uma secao primaria.
- Todo anexo deve possuir vinculo explicito com o item que ele comprova.
- Documentos com vencimento devem gerar alerta por data.
- Paginas escaneadas devem registrar `origem_textual = escaneado`.
- Acervos tecnicos devem ser vinculados ao profissional e ao tipo de competencia.
- Contratos de vinculacao devem ser vinculados ao responsavel tecnico correspondente.

## Uso recomendado da abstracao

- Separar o dossie em `estrutura logica` e `evidencias`.
- Tratar declaracoes como camada declaratoria.
- Tratar certidoes, contratos, acervos e registros como camada probatoria.
- Modelar responsaveis tecnicos como agregados independentes com seus proprios anexos.
- Permitir reuso da mesma estrutura em novos certames, trocando apenas a instancia documental.

## Arquivo complementar

- Template reutilizavel em YAML: `C:\Users\usuario\Downloads\template_sistema_documental_confidence.yml`
