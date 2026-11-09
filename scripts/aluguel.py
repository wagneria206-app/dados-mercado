"""Robô do aluguel de ações (B3, posições em aberto de empréstimo de ativos).

Quanto de cada ação está alugado mostra quanto o mercado aposta contra ela (a venda a descoberto exige alugar a
ação antes). A B3 publica todo dia o arquivo LendingOpenPositionFile (campos RptDt, TckrSymb, BalQty, BalVal,
TradAvrgPric). O robô guarda o histórico dos últimos 250 pregões em aluguel.json; o app calcula a fração das ações
alugadas e quantos dias de negociação seriam precisos para devolvê-las.

Uso: python scripts/aluguel.py <entrada> <saída>
"""
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ativos as AT  # noqa: E402  (b3_arquivo, num_b3)
import fundos as FU  # noqa: E402  (gravar, ler_json)

HIST = 250


def dias_uteis_recentes(n):
    d, out = dt.date.today(), []
    while len(out) < n:
        d -= dt.timedelta(days=1)
        if d.weekday() < 5:
            out.append(d)
    return out


def principal():
    ent, sai = sys.argv[1], sys.argv[2]
    os.makedirs(sai, exist_ok=True)
    velho = FU.ler_json(os.path.join(ent, "aluguel.json"), {}) or {}
    T = velho.get("t") or {}
    feitos = set(velho.get("dias") or [])
    novos, diag = [], {}
    for d in sorted(dias_uteis_recentes(7)):
        iso = d.isoformat()
        if iso in feitos:
            continue
        try:
            L = AT.b3_arquivo("LendingOpenPositionFile", iso)
        except Exception as e:  # noqa: BLE001
            diag[iso] = str(e)[:150]
            continue
        if not L:
            diag[iso] = "sem arquivo"
            continue
        diag[iso] = {"linhas": len(L), "campos": list(L[0].keys())[:12]}
        dia = {}
        for x in L:
            t = (x.get("TckrSymb") or "").strip().upper()
            q = AT.num_b3(x.get("BalQty"))
            v = AT.num_b3(x.get("BalVal"))
            if not t or not q:
                continue
            a = dia.setdefault(t, [0.0, 0.0])
            a[0] += q
            a[1] += v or 0
        for t, (q, v) in dia.items():
            T.setdefault(t, []).append([iso, round(q), round(v)])
        feitos.add(iso)
        novos.append(iso)
    for t in list(T):
        T[t] = sorted({x[0]: x for x in T[t]}.values())[-HIST:]
    dias = sorted(feitos)[-HIST:]
    if not T:
        raise SystemExit("nenhuma posição de aluguel lida: " + json.dumps(diag)[:500])
    out = {"geradoEm": dt.datetime.now().isoformat(timespec="seconds"), "dt": dias[-1] if dias else None, "dias": dias,
           "cols": ["data", "quantidade", "valor"], "t": T,
           "fonte": "B3: posições em aberto de empréstimo de ativos (LendingOpenPositionFile)"}
    FU.gravar(os.path.join(sai, "aluguel.json"), out)
    FU.gravar(os.path.join(sai, "estado.json"), {"geradoEm": out["geradoEm"], "novos": novos, "ativos": len(T), "diag": diag})
    print("aluguel:", len(T), "ativos; dias novos:", novos)


if __name__ == "__main__":
    principal()
