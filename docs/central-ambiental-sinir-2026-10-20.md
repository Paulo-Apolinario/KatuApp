# Central ambiental e SINIR — 20/10/2026

## Entrega e limite de funcionamento

O painel passa a preparar documentos na própria página, persistindo dados pela API do KATUÁ. A transmissão ao SINIR **não está ativa**. Não foi obtido contrato técnico oficial vigente suficiente para implementar e homologar emissão. Não há adaptador de envio, autenticação no SINIR, número oficial, PDF oficial ou protocolo simulado. O botão informa o impedimento e a API recusa envio com `503 INTEGRATION_UNAVAILABLE`, mesmo após aprovação interna.

Esta entrega substitui a antiga tela de links na rota `/mtr-online` pela **Central ambiental e SINIR**. A aprovação é uma revisão interna do KATUÁ, não certificação ou confirmação do SINIR. A integração externa segue como prioridade bloqueadora no backlog.

## Alterações entregues

- Unidades por município, CNPJ, código oficial informado manualmente, endereço, responsáveis, papéis operacionais e indicação de ambiente. Selecionar produção não habilita transmissão.
- Piloto: Jijoca de Jericoacoara (2307254), Cruz (2304251) e Sobral (2312908). Fortaleza (2304400) permanece disponível.
- Rascunhos distintos para MTR regular, MTR-LR de origem, MTR-LR de processo, CDF e preparação da declaração municipal anual.
- MTR com origem, transportador, destinatário, resíduos, quantidades, unidades físicas, códigos informados manualmente, transporte e referências. CDF com MTRs, período e responsável técnico. Não há integração fiscal de NF-e.
- Importação de coleta pertencente à cooperativa da unidade. Quantidade e unidade são preservadas; dados e códigos oficiais exigem conferência. Não converte volume em massa.
- Preparação municipal em seis etapas: diagnóstico; custos e serviços compartilhados; áreas; renda e trabalho; passivos; responsável e revisão. É apoio à preparação, não reprodução integral homologada do questionário oficial.
- Campo vazio significa desconhecido; zero é preservado. Dados operacionais da cooperativa não são apresentados como total municipal consolidado. Declaração possui ano de referência e fontes informadas pelo usuário.
- Estados internos: rascunho, em revisão, aprovado internamente e arquivado. Edição concorrente é rejeitada por versão. Mudanças na unidade após aprovação exigem nova revisão antes de eventual envio.
- Histórico paginado de eventos com autoria e versão; listagens de documentos paginadas por unidade e família. Exportação JSON é identificada como preparação interna, sem validade de emissão oficial.
- Evidências privadas PDF/PNG/JPEG, até 10 MB por arquivo e 20 por documento, com identificação por UUID, checagem de assinatura inicial/MIME e SHA-256. Downloads exigem autenticação e escopo. Isso não substitui verificação de conteúdo ou antivírus.
- Interface adaptada ao celular, mensagens de falha e conflito, recuperação de conexão, ausência de lista antiga quando recarregar falha e alertas de edição não salva no documento. A navegação geral do menu ainda não intercepta toda troca de rota com edição pendente.

## Acesso e responsabilidades

| Perfil | Acesso |
| --- | --- |
| Cooperativa | Suas unidades e documentos; preparação e revisão interna; compartilhamento municipal desligado por padrão. |
| Gestor municipal — VIEWER | Leitura nos municípios designados. |
| Gestor municipal — EDITOR | Também prepara documentos da unidade municipal. |
| Gestor municipal — REVIEWER | Também aprova internamente documentos da unidade municipal. |
| Administrador ativo | Pode conceder/revogar designações. Não ganha leitura automática dos documentos. |

Documentos de cooperativa só são visíveis ao gestor do município quando a cooperativa habilita explicitamente o compartilhamento da unidade. Esse compartilhamento inclui seus documentos e anexos; o acesso municipal continua sendo somente leitura. Revogação é verificada nas requisições seguintes. Não há atribuição automática de prefeitura a toda cooperativa da cidade.

A autenticação agora reconfirma no banco conta ativa e papel compatível com o token. O perfil `MUNICIPAL_MANAGER` é restrito às rotas da central e à consulta da própria sessão; não pode entrar nos módulos operacionais antigos. A alteração de papel exige novo login. No painel, recebe menu dedicado à central.

O administrador pode usar `POST /environmental/municipal-access` ou o script operacional abaixo, em `server`, para **contas existentes**. Não cria contas ou senhas e não é executado pela migração. O administrador informado precisa estar ativo e ter papel ADMIN; usuário alvo precisa ser PF ou MUNICIPAL_MANAGER. Registrar a referência da designação formal é obrigatório.

```bash
npx --no-install tsx scripts/designate-municipal-access.ts --admin-email ADMIN_EXISTENTE --user-email USUARIO_EXISTENTE --municipality 2312908 --permission EDITOR --appointment 'Portaria de designação'
```

Para revogar, informar os mesmos dados e acrescentar `--revoke`. A revogação desativa a designação; não devolve automaticamente o usuário ao papel PF. Sem designação ativa, o gestor não vê documentos municipais. A aprovação de documentos da própria cooperativa não exige duas pessoas diferentes nesta versão.

## Banco, API e armazenamento

Nova migração: `20261020160000_environmental_workspace`. Acrescenta o papel municipal e cinco tabelas de unidades, designações, documentos, eventos e anexos, sem reescrever registros operacionais existentes. O histórico antigo já registrado na VPS não deve ser registrado novamente. Não usar `db push`, `migrate reset` ou marcar esta migração como aplicada sem executá-la.

API interna sob `/environmental`: contexto, unidades, documentos, transições, histórico, importação de coleta, anexos e designação. Payloads estritos, autorização no servidor e conflito de versão. Nenhum endpoint externo do SINIR foi presumido a partir de manuais antigos.

Evidências ficam em `private-environmental-files`, relativo ao diretório de execução da API, fora de `/uploads`. O diretório é ignorado pelo Git, precisa ser persistente e gravável pelo usuário do serviço; arquivos são criados com modo 0600. Preservar esse diretório nas atualizações. Arquivar documento mantém evidências e eventos; não há exclusão física na interface.

A implantação é realizada pelo responsável pela VPS: atualizar os dois repositórios preservando alterações locais, `.env`, `uploads` e evidências privadas; instalar dependências da API, gerar Prisma, conferir `prisma migrate status`, executar `prisma migrate deploy`, verificar TypeScript e compilar; reiniciar `katua-api.service` e verificar serviço/logs. Depois compilar e publicar o painel. Não usa PM2. Não houve acesso ou implantação na VPS nesta entrega. O arquivo `server/src/server.ts`, que possui ajustes locais na VPS, não foi modificado.

## Validação realizada

- 29 testes unitários do painel aprovados, incluindo preservação de desconhecido/zero e importação de unidades físicas.
- 10 cenários integrados da central aprovados, usando API real Fastify/Prisma, migração incremental sobre o baseline anterior dos PEVs, PGlite e Chromium. Incluem isolamento, permissões, conflito de edição, revisão, bloqueio de emissão, anexos privados, paginação, navegação municipal móvel e recuperação offline.
- 9 cenários integrados de regressão dos PEVs aprovados com a nova autenticação: cadastro/mapa, edição, ocorrências, retirada, rastreabilidade, isolamento e reconexão.
- Verificação TypeScript e compilação da API; compilação do painel; lint dos componentes novos/alterados. O build do painel mantém aviso de tamanho de chunks já existente.

Resultados reproduzíveis em `docs/validacao-central-ambiental-2026-10-20.json`. Fixtures são fictícias e locais; credenciais, banco de testes e arquivos de evidência não são publicados. Não houve comunicação com o SINIR, homologação externa ou teste contra banco de produção. PGlite não substitui a validação operacional no PostgreSQL da VPS.

Testes: `frontend/tests/environmental.test.mjs`, `frontend/tests/environmental-browser.mjs` e `server/tests/environmental/local-server.ts`. O teste de navegador exige ferramentas locais PGlite/Chromium/Playwright externas às dependências do produto; consultar variáveis no cabeçalho do script. O teste usa o baseline anterior identificado por SHA para aplicar incrementalmente a nova migração.

## Backlog

| Prioridade | Item | Situação / critério para concluir |
| --- | --- | --- |
| P0 | Contrato vigente e habilitação das APIs oficiais | Bloqueado externamente. Confirmar MTR regular, MTR-LR e CDF separadamente; obter documentação oficial e autorização de organização/unidade. |
| P0 | Adaptador oficial no backend | Pendente. Implementar somente após contrato: autenticação, renovação, emissão, consulta, download, recebimento/cancelamento quando suportados, tratamento de erros e proteção contra duplicidade. |
| P0 | Homologação real | Pendente. Validar cenários autorizados, repetir envio com timeout sem duplicar, registrar identificador retornado, conferir documento oficial e só então habilitar produção. |
| P1 | API de Estados e Municípios | Não confirmada. Verificar se existe canal oficial de integração e suas condições; não reutilizar API MTR como se atendesse declaração municipal. |
| P1 | Catálogos oficiais e mapeamento | Pendente. Sincronizar resíduos, unidades, acondicionamento, classe, estado físico, tecnologias e participantes conforme contrato. Campos atuais são preparação manual. |
| P1 | Questionário e consolidação municipal completos | Pendente. Confirmar exercício, campos e obrigatoriedades oficiais; cadastrar fontes e cobertura de toda a prefeitura, evitando duplicidade de dados de cooperativas. |
| P1 | Credenciais e delegação | Pendente. Definir armazenamento seguro/renovação no servidor segundo mecanismo oficial; nunca solicitar senha Gov.br no formulário do KATUÁ. |
| P2 | Auditoria de administração | Pendente. Histórico imutável das mudanças de designação, compartilhamento e cadastro de unidade; hoje eventos documentais e designações atuais são persistidos. |
| P2 | Aperfeiçoamentos de uso | Pendente. Interceptar toda navegação com alterações pendentes, ampliar filtros/paginação de unidades e avaliar acessibilidade com usuários do piloto. |
| P2 | Fiscal e automações adicionais | Fora da entrega: emissão fiscal NF-e, assinatura digital, conversão automática de documentos e totais municipais automáticos. Dependem de requisitos próprios. |

### O que confirmar com o suporte oficial

1. Documentação vigente, versão e URLs de homologação/produção de cada módulo.
2. Autenticação e delegação para software terceiro após a adoção de Gov.br em 2026; não presumir que login interativo e autenticação de API sejam iguais.
3. Habilitação das organizações, unidades e papéis; disponibilidade para cooperativas e prefeituras do Ceará.
4. Métodos, schemas, catálogos, limites, erros, idempotência e consulta por chave após timeout.
5. Download de documento oficial, cancelamento, recebimento e emissão de CDF conforme permissões do participante.
6. Existência de API para a declaração de Estados e Municípios, exercício e regras próprias.

## Referências consultadas

- [SINIR — MTR](https://sinir.gov.br/sistemas/mtr/): canal oficial e aviso de acesso Gov.br. Não estabelece sozinho contrato de API.
- [SINIR — Estados e Municípios](https://sinir.gov.br/sistemas/estados-e-municipios/): declaração anual municipal, distinta da operação de MTR.
- [Manual do usuário MTR-LR](https://portal-api.sinir.gov.br/wp-content/uploads/2026/07/MTR-LR-Manual-do-Usuario.pdf): módulos de logística reversa e usuário de API; não equivale a especificação completa do web service.
- Manual de Estados e Municípios enviado pelo usuário: referência para as seis seções de preparação.
- [IBGE — Jijoca de Jericoacoara](https://www.ibge.gov.br/cidades-e-estados/ce/jijoca-de-jericoacoara.html), [Cruz](https://www.ibge.gov.br/cidades-e-estados/ce/cruz.html) e [Sobral](https://www.ibge.gov.br/cidades-e-estados/ce/sobral.html): códigos municipais.

A cópia histórica do manual de web service em plataforma de terceiros não foi tratada como contrato vigente. Nenhuma senha, token ou dado de autenticação foi incluído nesta documentação.
