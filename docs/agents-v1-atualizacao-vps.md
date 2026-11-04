# KATUÁ Agents v1 — comandos para atualização posterior

**Somente para execução manual pelo responsável pela VPS. Nenhum destes comandos foi executado na produção durante a Fase 4.** Use a mesma sessão Bash e interrompa em qualquer erro. Não execute as suítes de fixtures no banco real.

Infraestrutura conferida no código: backend `/var/www/katua/app/server`, painel `/var/www/katua/frontend/frontend`, PostgreSQL 16 via serviço Compose `postgres`, API `https://vps.katua.com.br`, unidade `katua-api.service`. Antes de iniciar, confirme se os caminhos e a unidade continuam correspondendo à sua instalação. Não é necessário modificar Nginx ou aplicativos Android/iOS.

## 1. Conferência e backup

Execute como o usuário que mantém os clones, com acesso a Docker e sudo para systemd. O backup contém dados pessoais e configuração: mantenha-o privado e fora do diretório público.

```bash
set -euo pipefail
umask 077
katua_backup="$HOME/katua-backups/agents-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$katua_backup"
printf '%s\n' "$katua_backup"
for katua_repo in /var/www/katua/app /var/www/katua/frontend; do
  test -z "$(git -C "$katua_repo" status --porcelain)" || { echo "Clone com alterações: $katua_repo. Preserve-as antes de continuar."; exit 1; }
  test "$(git -C "$katua_repo" branch --show-current)" = main || { echo "Clone fora da main: $katua_repo"; exit 1; }
done
git -C /var/www/katua/app rev-parse HEAD > "$katua_backup/backend.sha"
git -C /var/www/katua/frontend rev-parse HEAD > "$katua_backup/frontend.sha"
cp -p /var/www/katua/app/server/.env "$katua_backup/backend.env"
if test -d /var/www/katua/frontend/frontend/dist; then
  tar -C /var/www/katua/frontend/frontend -czf "$katua_backup/panel-dist.tar.gz" dist
fi
cd /var/www/katua/app/server
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$katua_backup/database.dump"
test -s "$katua_backup/database.dump"
docker compose exec -T postgres pg_restore --list < "$katua_backup/database.dump" > "$katua_backup/database-contents.txt"
test -s "$katua_backup/database-contents.txt"
```

`pg_dump` faz snapshot consistente, mas registros posteriores ao backup não estão nele. A verificação do índice não substitui um ensaio de restauração em banco separado. Não restaure esse arquivo automaticamente sobre produção.

## 2. Atualizar backend e aplicar migrações incrementais

A instalação inicial fica com agentes globalmente desativados. O editor abaixo altera somente `AGENTS_ENABLED` no arquivo de configuração, sem imprimir dados sensíveis. Se a unidade systemd definir essa variável por outro caminho, ajuste essa fonte também antes de iniciar o serviço.

```bash
cd /var/www/katua/app
git fetch origin main
git merge --ff-only origin/main
cd server
python3 - <<'PY'
from pathlib import Path
import re
p=Path('.env')
s=p.read_text()
s=re.sub(r'^\s*(?:export\s+)?AGENTS_ENABLED\s*=.*$', 'AGENTS_ENABLED=false', s, flags=re.M)
if not re.search(r'^AGENTS_ENABLED=', s, re.M):
    s=s.rstrip()+'\nAGENTS_ENABLED=false\n'
p.write_text(s)
PY
npm ci --include=dev --no-audit --no-fund
npx --no-install prisma validate
npx --no-install prisma generate
npm run check
npm run build
sudo systemctl stop katua-api.service
npx --no-install prisma migrate deploy
npx --no-install prisma migrate status
sudo systemctl start katua-api.service
sudo systemctl is-active katua-api.service
curl --fail --silent --show-error https://vps.katua.com.br/
```

Se o `migrate deploy` falhar, mantenha o serviço parado e examine a falha; não use `migrate reset`, `db push` ou `migrate resolve` sem diagnóstico. O Prisma aplica todas as migrações pendentes do clone, portanto confira previamente o histórico caso a VPS esteja atrás das versões anteriores ao Agents. Não basta copiar apenas os três diretórios novos.

## 3. Atualizar painel

O build ocorre fora do diretório servido, e só depois substitui `dist`. Evita expor uma pasta parcialmente construída. Os comandos pressupõem `dist` como pasta real, conforme instalação atual.

```bash
cd /var/www/katua/frontend
git fetch origin main
git merge --ff-only origin/main
cd frontend
npm ci --include=dev --no-audit --no-fund
npm run lint
VITE_API_BASE_URL=https://vps.katua.com.br npm run build -- --outDir dist-agents-next
test -s dist-agents-next/index.html
if test -e dist; then mv dist "dist-before-agents-$(date -u +%Y%m%dT%H%M%SZ)"; fi
mv dist-agents-next dist
curl --fail --silent --show-error https://painel.katua.com.br/ > /dev/null
```

Não é necessário reiniciar Nginx para trocar arquivos estáticos. Faça login e confira coletas, rotas, estoque e sino existentes. A Central deve explicar o módulo desativado; nenhum agente é ativado automaticamente para cooperativas novas.

## 4. Ativação gradual após homologação

Depois de validar os fluxos existentes e conferir os logs, ative globalmente:

```bash
cd /var/www/katua/app/server
python3 - <<'PY'
from pathlib import Path
p=Path('.env');s=p.read_text()
assert 'AGENTS_ENABLED=false' in s, 'Confira a origem da configuração antes de ativar'
p.write_text(s.replace('AGENTS_ENABLED=false','AGENTS_ENABLED=true'))
PY
sudo systemctl restart katua-api.service
sudo systemctl is-active katua-api.service
sudo journalctl -u katua-api.service --since '5 minutes ago' --no-pager
```

Na Central de Agentes, habilite inicialmente somente uma cooperativa e um agente. Execute análise manual; confira respostas, histórico e notificações. Depois habilite automações e observe fila, retentativas e consumo com `systemctl status`, `free -h` e `top`. Valores iniciais: checagem do worker a cada 60s, análise periódica a cada 60min, eventos agrupados com intervalo de 5min. A frequência de análise por cooperativa é configurável; não aumente sem medir.

## 5. Reversão sem apagar dados

Use o caminho de backup impresso no passo 1. Desative primeiro o módulo na fonte efetiva da configuração. O bloqueio global para o worker não desliga os gatilhos SQL; o SQL abaixo pausa somente a captura dos nove gatilhos do Agents e preserva dados, fila e histórico.

```bash
# Se esta for outra sessão, informe o caminho exato salvo no passo 1:
# katua_backup="$HOME/katua-backups/agents-AAAAMMDDTHHMMSSZ"
test -s "$katua_backup/backend.sha"
cd /var/www/katua/app/server
python3 - <<'PY'
from pathlib import Path
import re
p=Path('.env');s=p.read_text()
s=re.sub(r'^\s*(?:export\s+)?AGENTS_ENABLED\s*=.*$', 'AGENTS_ENABLED=false', s, flags=re.M)
if not re.search(r'^AGENTS_ENABLED=',s,re.M):s=s.rstrip()+'\nAGENTS_ENABLED=false\n'
p.write_text(s)
PY
sudo systemctl stop katua-api.service
docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < prisma/rollback/agents-events-pause.sql
cd /var/www/katua/app
git switch --detach "$(cat "$katua_backup/backend.sha")"
cd server
npm ci --include=dev --no-audit --no-fund
npx --no-install prisma generate
npm run build
sudo systemctl start katua-api.service
sudo systemctl is-active katua-api.service
cd /var/www/katua/frontend
git switch --detach "$(cat "$katua_backup/frontend.sha")"
if test -s "$katua_backup/panel-dist.tar.gz"; then
  cd frontend
  if test -e dist; then mv dist "dist-agents-rollback-$(date -u +%Y%m%dT%H%M%SZ)"; fi
  tar -xzf "$katua_backup/panel-dist.tar.gz"
fi
curl --fail --silent --show-error https://vps.katua.com.br/
```

O rollback deixa clones em um commit anterior destacado; o histórico remoto não muda. Não remova tabelas, colunas, enums ou registros de migração. Não restaure o backup do banco só para reverter código, pois isso perderia trabalho operacional posterior ao backup. Retorne à `main` com `git switch main` somente ao retomar a versão nova; reaplique o fluxo de validação, execute `agents-events-resume.sql` contra o banco correto e só então habilite o worker novamente. Eventos durante a captura pausada não serão reproduzidos; a análise periódica reavalia o estado atual.
