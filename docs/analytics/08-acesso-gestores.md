# Liberação temporária do Analytics

O Analytics de participação exige autenticação normal da cooperativa e senha compartilhada de gestor. Este controle temporário não identifica individualmente o gestor; permissões individuais poderão substituir a chave posteriormente.

A chave inicial solicitada pelo responsável foi configurada somente como hash bcrypt no backend. Não é enviada no bundle web, não é persistida no navegador, não aparece em URLs e não altera a senha de login da cooperativa. Não exige variável de ambiente nova nem migração.

POST /analytics/access/unlock verifica o escopo da cooperativa, valida senha (até 128 caracteres), limita a cinco tentativas por conta em quinze minutos e cria um token opaco aleatório válido por trinta minutos. O token fica vinculado ao usuário e à credencial de login atual. Não serve como JWT de autenticação. Tokens são mantidos na memória do processo; reiniciar a API exige nova liberação. Esta implementação atende à API atual de processo único.

Todas as consultas GET de /analytics/participation/* e /analytics/access/status exigem X-Analytics-Access válido, além do login. Exportações usam a consulta protegida executive. Respostas usam Cache-Control private, no-store. POST /analytics/access/lock revoga a liberação. O heartbeat de uso permanece protegido apenas pelo login para não interromper a telemetria de outras telas/perfis.

A web guarda a liberação apenas em memória, durante a navegação entre as subabas e os detalhes do Analytics. Sair dessa área, atualizar a página, bloquear manualmente ou atingir trinta minutos volta à tela de senha. Tentativas sem liberação recebem 403 ANALYTICS_LOCKED. Senha incorreta não encerra o login normal do painel. Nenhum dado é consultado até a liberação.

Testes: toda a integração descartável anterior permanece; novos casos verificam todas as consultas, senha, perfil, credencial de login diferente, token adulterado, revogação, expiração, limite de tentativas e impossibilidade de usar o token opaco como login. Para rodar localmente, forneça KATUA_TEST_ANALYTICS_PASSWORD por ambiente de teste (não em arquivos versionados). A validação web cobre a tela, senha incorreta sem consulta de dados, navegação interna, retorno, atualização, bloqueio manual e acesso direto.
