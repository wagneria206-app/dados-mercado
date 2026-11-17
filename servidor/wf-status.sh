#!/usr/bin/env bash
# Resumo do servidor em uma tela:  wf-status
WF=${WF:-/srv/wf}
b() { printf '\n\033[1m%s\033[0m\n' "$1"; }
b "Servidor"
echo "  ligado há: $(uptime -p | sed 's/up //')   ·   hora: $(date '+%d/%m/%Y %H:%M')"
echo "  memória: $(free -h | awk '/Mem:/{print $3" usados de "$2}')   ·   disco: $(df -h / | awk 'NR==2{print $3" usados de "$2" ("$5")"}')"
t=$(cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | sort -n | tail -1); [ -n "$t" ] && echo "  temperatura do processador: $((t / 1000)) °C"
if command -v smartctl >/dev/null; then echo "  saúde do disco: $(sudo -n smartctl -H /dev/sda 2>/dev/null | grep -oE 'PASSED|FAILED.*' || echo 'rode com sudo para ver')"; fi
[ -f /var/run/reboot-required ] && echo "  atualização de segurança aguardando reinício (acontece sozinho às 4h15)"
b "Últimas execuções dos robôs"
if [ -f "$WF/logs/execucoes.tsv" ]; then
  tail -n 400 "$WF/logs/execucoes.tsv" | awk -F'\t' '{u[$2]=$0} END{for(k in u) print u[k]}' | sort -t$'\t' -k2 |
  while IFS=$'\t' read -r q r c s; do
    printf '  %-10s %s  %s  (%s s)\n' "$r" "$(date -d "$q" '+%d/%m %H:%M')" "$([ "$c" = 0 ] && echo 'ok' || echo "FALHOU ($c)")" "$s"
  done
else echo "  nenhuma execução registrada ainda"; fi
b "Publicação na Cloudflare"
journalctl -u wf-publicar --since -2d -o cat 2>/dev/null | grep -E 'publicado|nada mudou|limite|não publico' | tail -2 | sed 's/^/  /'
echo "  publicações neste mês: $(cat "$WF/publicar/$(date +%Y-%m)" 2>/dev/null || echo 0) (limite 450)"
b "Cópia de segurança"
journalctl -u wf-backup --since -3d -o cat 2>/dev/null | grep -E 'cópia feita|não está ligado' | tail -1 | sed 's/^/  /'
b "Proteções"
echo "  firewall: $(sudo -n ufw status 2>/dev/null | head -1 | sed 's/Status: //' || echo 'rode com sudo para ver')"
echo "  serviços com falha: $(systemctl --failed --no-legend | wc -l)"
echo "  tentativas de acesso bloqueadas (SSH): $(sudo -n fail2ban-client status sshd 2>/dev/null | awk -F: '/Total banned/{gsub(/ /,"",$2);print $2}' || echo '?')"
echo
