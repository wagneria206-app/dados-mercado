#!/usr/bin/env bash
# Instala e protege o servidor do WF Investimentos (Ubuntu Server 26.04 LTS). Rode uma vez, com sudo:
#   curl -fsSL https://raw.githubusercontent.com/wagneria206-app/dados-mercado/main/servidor/instalar.sh -o instalar.sh
#   sudo bash instalar.sh
# Pode rodar de novo a qualquer momento: ele refaz a configuração sem apagar os dados.
#
# O que fica no servidor:
#   - ninguém de fora acessa: firewall fecha todas as entradas, menos o SSH vindo da rede de casa, e só com chave;
#   - saídas só para a web (portas 80 e 443), DNS criptografado (853) e hora certa (123);
#   - robôs com um usuário próprio (wf), sem senha, sem login e sem poder de administrador, presos em /srv/wf;
#   - código só muda quando você manda (wf-atualizar), e só com commits assinados pelo GitHub;
#   - atualizações de segurança automáticas, bloqueio de quem erra o SSH, cópia de segurança criptografada.
set -euo pipefail
REPO=https://github.com/wagneria206-app/dados-mercado.git
WF=/srv/wf
ETC=/etc/wf
RAMOS_DADOS="site estado ativos fundos eua macro saude"

ok()   { printf '\033[32m✔\033[0m %s\n' "$*"; }
info() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
aviso(){ printf '\033[33m!\033[0m %s\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Rode com sudo: sudo bash instalar.sh"; exit 1; }
ADMIN=${SUDO_USER:-}
[ -n "$ADMIN" ] && [ "$ADMIN" != root ] || { echo "Rode com sudo a partir do seu usuário (não como root direto)."; exit 1; }
. /etc/os-release; [ "$ID" = ubuntu ] || { echo "Este instalador é para o Ubuntu Server."; exit 1; }
# "wf" é reservado para o usuário dos robôs (sem senha, sem login, sem sudo). Se for uma pessoa, para aqui.
if [ "$ADMIN" = wf ] || { id wf >/dev/null 2>&1 && { [ "$(id -u wf)" -ge 1000 ] || id -nG wf | grep -qwE 'sudo|admin'; }; }; then
  echo "O nome 'wf' é reservado para os robôs, mas já é um usuário de pessoa neste servidor."
  echo "Crie outro usuário administrador (ex.: wfadmin), entre com ele, apague o 'wf' e rode de novo:"
  echo "  sudo adduser wfadmin && sudo usermod -aG sudo,adm wfadmin   (depois saia e entre como wfadmin)"
  echo "  sudo loginctl terminate-user wf; sudo deluser --remove-home wf"
  exit 1
fi

info "1/11 Fuso horário e atualizações do sistema"
timedatectl set-timezone America/Sao_Paulo
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q full-upgrade
apt-get -y -q install git rsync ufw fail2ban unattended-upgrades smartmontools restic gnupg curl ca-certificates \
  python3 python3-requests python3-pypdf python3-systemd nodejs npm
ok "pacotes instalados (Python e Node do próprio Ubuntu, que recebem correções de segurança automáticas)"

info "2/11 Usuário dos robôs e pastas"
id wf >/dev/null 2>&1 || useradd --system --home-dir $WF/home --shell /usr/sbin/nologin --user-group wf
passwd -l wf >/dev/null
mkdir -p $WF/{home,www,trabalho,logs,tmp,publicar,node,run} $ETC
chown -R wf:wf $WF/home $WF/www $WF/trabalho $WF/logs $WF/tmp $WF/publicar $WF/run
chown root:wf $WF $WF/node; chmod 750 $WF $WF/node
chmod 700 $ETC
cat > $WF/home/.gitconfig <<'EOF'
[safe]
	directory = /srv/wf/codigo
EOF
chown wf:wf $WF/home/.gitconfig
ok "usuário wf criado (sem senha, sem login, sem sudo)"

info "3/11 Chave pública do GitHub (para conferir a assinatura do código)"
mkdir -p $ETC/gnupg; chmod 700 $ETC/gnupg
curl -fsSL https://github.com/web-flow.gpg | GNUPGHOME=$ETC/gnupg gpg --batch --quiet --import 2>/dev/null
GNUPGHOME=$ETC/gnupg gpg --batch --list-keys --with-colons 2>/dev/null | awk -F: '/^fpr/{print "  impressão digital: "$10}'
ok "chave do GitHub importada"

info "4/11 Código (só commits do ramo main assinados pelo GitHub)"
git config --global --add safe.directory $WF/codigo 2>/dev/null || true
if [ ! -d $WF/codigo/.git ]; then git clone --quiet --single-branch --branch main "$REPO" $WF/codigo; fi
git -C $WF/codigo fetch --quiet origin main
alvo=$(git -C $WF/codigo rev-parse origin/main)
GNUPGHOME=$ETC/gnupg git -C $WF/codigo verify-commit "$alvo" 2>/dev/null || { echo "O último commit do GitHub não tem assinatura válida. Parei por segurança."; exit 1; }
git -C $WF/codigo -c advice.detachedHead=false checkout --quiet "$alvo"
chown -R root:wf $WF/codigo; chmod -R g-w,o-rwx $WF/codigo
install -m 755 $WF/codigo/servidor/wf-status.sh /usr/local/bin/wf-status
install -m 755 $WF/codigo/servidor/atualizar-codigo.sh /usr/local/sbin/wf-atualizar
ok "código na versão $(git -C $WF/codigo log -1 --format='%h de %ad' --date=format:'%d/%m/%Y')"

info "5/11 Retirando o que um servidor não precisa"
touch /etc/cloud/cloud-init.disabled 2>/dev/null || true
if dpkg -l snapd >/dev/null 2>&1 && [ -z "$(snap list 2>/dev/null | sed 1d)" ]; then apt-get -y -q purge snapd; ok "snapd removido"; fi
for s in ModemManager.service avahi-daemon.service cups.service bluetooth.service; do systemctl disable --now "$s" 2>/dev/null || true; done
ok "serviços dispensáveis desligados"

info "6/11 Proteções do núcleo do sistema, tampa e memória de troca"
install -m 644 $WF/codigo/servidor/sistema/99-wf-seguranca.conf /etc/sysctl.d/99-wf-seguranca.conf
sysctl --system >/dev/null
mkdir -p /etc/systemd/logind.conf.d
install -m 644 $WF/codigo/servidor/sistema/tampa.conf /etc/systemd/logind.conf.d/wf-tampa.conf
systemctl mask --now sleep.target suspend.target hibernate.target hybrid-sleep.target >/dev/null 2>&1
if [ "$(swapon --show=SIZE --bytes --noheadings | awk '{s+=$1} END{print s+0}')" -lt 3000000000 ]; then
  swapoff -a 2>/dev/null || true; fallocate -l 4G /swap.img && chmod 600 /swap.img && mkswap /swap.img >/dev/null && swapon /swap.img
  grep -q '^/swap.img' /etc/fstab || echo '/swap.img none swap sw 0 0' >> /etc/fstab
fi
ok "núcleo protegido; fechar a tampa não suspende; memória de troca de 4 GB"

info "7/11 Dados: começa com o histórico já coletado (cópia única do GitHub)"
if [ ! -d $WF/dados.git ]; then
  git init --quiet --bare $WF/dados.git
  for r in $RAMOS_DADOS; do
    if git --git-dir $WF/dados.git fetch --quiet --depth 1 "$REPO" "refs/heads/$r:refs/heads/$r" 2>/dev/null; then
      git --git-dir $WF/dados.git update-ref "refs/remotes/origin/$r" "refs/heads/$r"; echo "  $r"
    else aviso "ramo $r não encontrado: o robô monta do zero"; fi
  done
  chown -R wf:wf $WF/dados.git
fi
sudo -u wf env HOME=$WF/home /usr/bin/python3 $WF/codigo/servidor/exportar.py $WF/dados.git $WF/www >/dev/null
ok "dados prontos em $WF"

info "8/11 Ferramenta de publicação da Cloudflare (wrangler)"
if [ ! -x $WF/node/node_modules/.bin/wrangler ]; then
  npm install --prefix $WF/node --ignore-scripts --no-audit --no-fund --loglevel=error wrangler@4 >/dev/null
fi
chown -R root:wf $WF/node; chmod -R g-w,o-rwx $WF/node
ok "wrangler $($WF/node/node_modules/.bin/wrangler --version 2>/dev/null | tail -1) (só o administrador altera)"

info "9/11 Rede: DNS criptografado e firewall"
dev=$(ip -4 route show default | awk '{print $5; exit}')
LAN=$(python3 -c "import ipaddress,sys;print(ipaddress.ip_interface(sys.argv[1]).network)" "$(ip -4 -o addr show dev "$dev" | awk '{print $4; exit}')")
case "$LAN" in 10.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*|192.168.*) ;; *) echo "Rede de casa não reconhecida ($LAN). Parei antes do firewall."; exit 1;; esac
regras() {  # regras <dns>: dns = seguro (porta 853, Quad9) ou roteador (porta 53, só para a rede de casa)
  ufw --force reset >/dev/null
  ufw default deny incoming >/dev/null; ufw default deny outgoing >/dev/null; ufw default deny routed >/dev/null
  ufw limit in on "$dev" from "$LAN" to any port 22 proto tcp comment 'SSH so da rede de casa' >/dev/null
  ufw allow out 443/tcp comment 'web segura' >/dev/null
  ufw allow out 80/tcp comment 'web (atualizacoes do Ubuntu e ipeadata)' >/dev/null
  ufw allow out 123/udp comment 'hora certa (NTP)' >/dev/null
  ufw allow out 4460/tcp comment 'hora certa autenticada (NTS)' >/dev/null
  ufw allow out 67/udp comment 'endereco IPv4 do roteador (DHCP)' >/dev/null
  ufw allow out 547/udp comment 'endereco IPv6 do roteador (DHCPv6)' >/dev/null
  if [ "$1" = seguro ]; then ufw allow out 853/tcp comment 'DNS criptografado' >/dev/null
  else ufw allow out to "$LAN" port 53 comment 'DNS do roteador' >/dev/null; fi
  ufw logging low >/dev/null; ufw --force enable >/dev/null
}
testa_rede() { resolvectl flush-caches 2>/dev/null; sleep 2; curl -fsS -m 25 -o /dev/null https://dados.cvm.gov.br/ && curl -fsS -m 25 -o /dev/null https://www.bcb.gov.br/; }
# DNS só pelos servidores criptografados (o roteador deixa de responder pelo servidor)
mkdir -p /etc/systemd/resolved.conf.d
install -m 644 $WF/codigo/servidor/sistema/dns-seguro.conf /etc/systemd/resolved.conf.d/wf-dns-seguro.conf
umask 077; printf 'network:\n  version: 2\n  ethernets:\n    %s:\n      dhcp4-overrides: {use-dns: false}\n      dhcp6-overrides: {use-dns: false}\n' "$dev" > /etc/netplan/90-wf-dns.yaml; umask 022
netplan apply 2>/dev/null; systemctl restart systemd-resolved
regras seguro
if testa_rede; then ok "DNS criptografado funcionando (Quad9)"; DNS=seguro
else
  aviso "sua internet não deixou o DNS criptografado funcionar (porta 853): volto ao DNS do roteador"
  rm -f /etc/systemd/resolved.conf.d/wf-dns-seguro.conf /etc/netplan/90-wf-dns.yaml; netplan apply 2>/dev/null
  systemctl restart systemd-resolved; regras roteador; DNS=roteador
  testa_rede || { echo "Sem acesso à internet depois do firewall. Desliguei o firewall para você não ficar sem rede; me avise."; ufw --force disable; exit 1; }
fi
ok "firewall: entrada só SSH da rede $LAN; saída só web, DNS ($DNS) e hora"

info "10/11 SSH, bloqueio de tentativas e atualizações automáticas"
install -m 644 $WF/codigo/servidor/sistema/jail-wf.local /etc/fail2ban/jail.d/wf.local
systemctl enable --now fail2ban >/dev/null 2>&1; systemctl restart fail2ban
install -m 644 $WF/codigo/servidor/sistema/52-wf-atualizacoes /etc/apt/apt.conf.d/52-wf-atualizacoes
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
systemctl enable --now smartmontools >/dev/null 2>&1 || systemctl enable --now smartd >/dev/null 2>&1 || true
AK=$(getent passwd "$ADMIN" | cut -d: -f6)/.ssh/authorized_keys
if [ -s "$AK" ] && grep -qE '^(ssh-ed25519|ecdsa-sha2|ssh-rsa) ' "$AK"; then
  install -m 644 $WF/codigo/servidor/sistema/50-wf-ssh.conf /etc/ssh/sshd_config.d/50-wf-ssh.conf
  echo "AllowUsers $ADMIN" >> /etc/ssh/sshd_config.d/50-wf-ssh.conf
  sshd -t && systemctl try-reload-or-restart ssh
  ok "SSH só com a chave do seu computador, só para o usuário $ADMIN, senha desligada"
else
  aviso "a chave do seu computador ainda não está no servidor: o SSH continua aceitando senha."
  aviso "Siga o passo da chave no guia e rode este instalador de novo."
fi

info "11/11 Robôs, publicação e cópia de segurança"
cp $WF/codigo/servidor/systemd/* /etc/systemd/system/
systemctl daemon-reload
for t in ativos atualizar rapido fundos eua macro saude empresas aluguel opcoes insiders bancos emissores manutencao; do
  systemctl enable --now "wf-$t.timer" >/dev/null 2>&1
done
ok "robôs agendados (horário de Brasília)"
if [ ! -s $ETC/app.env ]; then
  # a senha de acesso do app continua a mesma: o código dela (o hash, nunca a senha) é lido do próprio site publicado
  h=$(curl -fsS -m 30 https://wfinvestimentos.com.br/ | grep -oE '<meta name="wf-senha" content="v1:[^"]+"' | head -1 | sed -E 's/.*content="([^"]+)"/\1/' || true)
  if [ -n "$h" ]; then ok "senha de acesso do app: a mesma do site atual"
  else read -r -p "Não encontrei a senha no site. Cole o código da senha do app (começa com v1:): " h; fi
  case "$h" in v1:*) printf 'WF_SENHA=%s\n' "$h" > $ETC/app.env ;; *) aviso "código da senha inválido: rode o instalador de novo" ;; esac
fi
[ -f $ETC/app.env ] && chmod 600 $ETC/app.env
if [ ! -s $ETC/cloudflare.env ]; then
  echo; echo "Chave da Cloudflare (crie seguindo o guia). Ela não aparece na tela enquanto você cola."
  read -r -p "Número da conta (Account ID): " cid
  read -r -s -p "Chave (API Token): " tok; echo
  if [ -n "$cid" ] && [ -n "$tok" ]; then
    umask 077; printf 'CLOUDFLARE_ACCOUNT_ID=%s\nCLOUDFLARE_API_TOKEN=%s\n' "$cid" "$tok" > $ETC/cloudflare.env; umask 022
  fi
  unset tok
fi
if [ -s $ETC/cloudflare.env ]; then chmod 600 $ETC/cloudflare.env; systemctl enable --now wf-publicar.timer >/dev/null 2>&1; ok "publicação automática ligada"
else aviso "sem a chave da Cloudflare, a publicação fica desligada; rode o instalador de novo quando tiver a chave"; fi
if [ ! -s $ETC/restic.senha ]; then
  umask 077; head -c 24 /dev/urandom | base64 | tr -d '/+=' | cut -c1-28 > $ETC/restic.senha; umask 022
  echo; echo "SENHA DA CÓPIA DE SEGURANÇA (anote em papel e guarde; sem ela a cópia não abre):"
  echo "    $(cat $ETC/restic.senha)"; echo
fi
systemctl enable --now wf-backup.timer >/dev/null 2>&1
ok "cópia de segurança diária às 3h30 (quando o disco WFBACKUP estiver ligado)"

echo; ok "Instalação concluída. Para ver o estado do servidor a qualquer momento: wf-status"
