#!/usr/bin/env bash
# Resumo do servidor em uma tela:  wf-status
[ "$(id -u)" = 0 ] || exec sudo "$0" "$@"   # as pastas do servidor só abrem para o administrador
WF=${WF:-/srv/wf}
b() { printf '\n\033[1m%s\033[0m\n' "$1"; }
b "Servidor"
echo "  ligado há: $(uptime -p | sed 's/up //')   ·   hora: $(date '+%d/%m/%Y %H:%M')"
echo "  memória: $(free -h | awk '/Mem:/{print $3" usados de "$2}')   ·   disco: $(df -h / | awk 'NR==2{print $3" usados de "$2" ("$5")"}')"
t=$(cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | sort -n | tail -1); [ -n "$t" ] && echo "  temperatura do processador: $((t / 1000)) °C"
if command -v smartctl >/dev/null; then echo "  saúde do disco: $(smartctl -H /dev/sda 2>/dev/null | grep -oE 'PASSED|FAILED.*' || echo '?')"; fi
[ -f /var/run/reboot-required ] && echo "  atualização de segurança aguardando reinício (acontece sozinho às 4h15)"
b "Últimas execuções dos robôs"
if [ -f "$WF/logs/execucoes.tsv" ]; then
  tail -n 400 "$WF/logs/execucoes.tsv" | awk -F'\t' '{u[$2]=$0} END{for(k in u) print u[k]}' | sort -t$'\t' -k2 |
  while IFS=$'\t' read -r q r c s; do
    printf '  %-10s %s  %s  (%s s)\n' "$r" "$(date -d "$q" '+%d/%m %H:%M')" "$([ "$c" = 0 ] && echo 'ok' || echo "FALHOU ($c)")" "$s"
  done
else echo "  nenhuma execução registrada ainda"; fi
b "Publicação na Cloudflare"
if [ -s /etc/wf/cloudflare.env ]; then
  journalctl -u wf-publicar --since -2d -o cat 2>/dev/null | grep -E 'publicado|nada mudou|limite|não publico' | tail -2 | sed 's/^/  /'
else echo "  desligada: falta a chave da Cloudflare (rode o instalador de novo quando tiver a chave)"; fi
echo "  publicações neste mês: $(cat "$WF/publicar/$(date +%Y-%m)" 2>/dev/null || echo 0) (limite 450)"
b "Cópia de segurança"
u=$(journalctl -u wf-backup --since -3d -o cat 2>/dev/null | grep -E 'cópia feita|não está ligado' | tail -1)
echo "  ${u:-nenhuma cópia nos últimos 3 dias (a cópia roda às 3h30)}"
b "Proteções"
echo "  firewall: $(ufw status 2>/dev/null | head -1 | sed 's/Status: //')"
echo "  serviços com falha: $(systemctl --failed --no-legend | wc -l)"
echo "  acesso SSH: $(systemctl is-active ssh.service ssh.socket 2>/dev/null | grep -q "^active" && echo ligado || echo "desligado (só pelo teclado do servidor)")"
systemctl is-active -q ssh.service ssh.socket 2>/dev/null && echo "  tentativas de acesso bloqueadas (SSH): $(fail2ban-client status sshd 2>/dev/null | awk -F: '/Total banned/{gsub(/ /,"",$2);print $2}' || echo '?')"
echo
