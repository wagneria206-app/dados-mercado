"""Análise técnica dos ativos da B3: médias móveis, IFR, tendência, cruzamentos e distância da máxima de 52 semanas.

Lê o idx.json e as cotações de cada ativo (a/<código>.json ou os pacotes pk/a-<letra>.json) e acrescenta ao idx.json
as colunas técnicas. Não acessa a internet: roda logo depois do robô de ativos, ou sobre uma cópia já coletada.

Os cálculos usam a cotação de fechamento ajustada só por desdobramentos e grupamentos (sem proventos), como nos
gráficos de análise técnica. As mesmas contas estão no app (módulo 472), para a página de cada ativo.

Uso: python scripts/tecnica.py <pasta do ramo ativos>
"""
import json
import os
import re
import sys

COLS = ["mm50d", "mm200d", "ifr", "tend", "cruz", "max52d", "min52d"]
JANELA = 320  # pregões usados (bastam para a média de 200 e o IFR estabilizar)


def serie_desdobramentos(j):
    """Fechamentos em ordem, ajustados por desdobramentos e grupamentos posteriores."""
    i0, c = j.get("i0", 0), j.get("c") or []
    I, R = [], []
    for k, v in enumerate(c):
        if v is not None:
            I.append(i0 + k)
            R.append(v)
    spl = sorted(e for e in (j.get("adj") or []) if str(e[2]).startswith("S"))
    out, acc, k = [0.0] * len(I), 1.0, len(spl) - 1
    for x in range(len(I) - 1, -1, -1):
        while k >= 0 and spl[k][0] > I[x]:
            acc *= spl[k][1]
            k -= 1
        out[x] = R[x] * acc
    return out


def media(c, n, fim=None):
    fim = len(c) if fim is None else fim
    if fim < n:
        return None
    return sum(c[fim - n:fim]) / n


def ifr(c, n=14):
    """Índice de força relativa de Wilder."""
    if len(c) <= n + 1:
        return None
    c = c[-JANELA:]
    g = [max(0.0, c[k] - c[k - 1]) for k in range(1, len(c))]
    p = [max(0.0, c[k - 1] - c[k]) for k in range(1, len(c))]
    mg, mp = sum(g[:n]) / n, sum(p[:n]) / n
    for k in range(n, len(g)):
        mg = (mg * (n - 1) + g[k]) / n
        mp = (mp * (n - 1) + p[k]) / n
    if mp == 0:
        return 100.0 if mg > 0 else 50.0
    return 100 - 100 / (1 + mg / mp)


def indicadores(c):
    """Dicionário com as colunas técnicas a partir da série ajustada (mais recente por último)."""
    if len(c) < 60 or not c[-1]:
        return {}
    p = c[-1]
    m50, m200 = media(c, 50), media(c, 200)
    o = {"mm50d": (p / m50 - 1) * 100 if m50 else None, "mm200d": (p / m200 - 1) * 100 if m200 else None, "ifr": ifr(c)}
    if m50 and m200:
        o["tend"] = 1 if p > m50 > m200 else -1 if p < m50 < m200 else 0
        cruz = 0
        for k in range(len(c) - 20, len(c)):
            a0, b0 = media(c, 50, k), media(c, 200, k)
            a1, b1 = media(c, 50, k + 1), media(c, 200, k + 1)
            if None in (a0, b0, a1, b1):
                continue
            if a0 <= b0 and a1 > b1:
                cruz = 1
            elif a0 >= b0 and a1 < b1:
                cruz = -1
        o["cruz"] = cruz
    u = c[-252:]
    o["max52d"] = (p / max(u) - 1) * 100
    o["min52d"] = (p / min(u) - 1) * 100
    return o


def r2(v):
    return None if v is None else round(v, 2)


def aplicar(pasta):
    """Acrescenta (ou refaz) as colunas técnicas no idx.json da pasta."""
    ip = os.path.join(pasta, "idx.json")
    with open(ip, encoding="utf-8") as f:
        idx = json.load(f)
    cols = [c for c in idx["cols"] if c not in COLS]
    keep = [idx["cols"].index(c) for c in cols]
    cache = {}

    def ativo(t):
        p = os.path.join(pasta, "a", t + ".json")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                return json.load(f)
        c0 = t[:1].upper()
        k = c0 if re.match(r"[A-Z0-9]", c0) else "_"
        if k not in cache:
            pk = os.path.join(pasta, "pk", "a-" + k + ".json")
            cache.clear()
            cache[k] = json.load(open(pk, encoding="utf-8")) if os.path.exists(pk) else {}
        return cache[k].get(t)

    rows, n = [], 0
    for r in sorted(idx["rows"], key=lambda r: r[0][:1].upper()):
        base = [r[k] for k in keep]
        ind = {}
        if r[idx["cols"].index("tipo")] != "Tesouro Direto":
            j = ativo(r[0])
            if j:
                ind = indicadores(serie_desdobramentos(j))
                n += 1 if ind else 0
        rows.append(base + [r2(ind.get(c)) if c not in ("tend", "cruz") else ind.get(c) for c in COLS])
    ordem = {r[0]: k for k, r in enumerate(idx["rows"])}
    rows.sort(key=lambda r: ordem[r[0]])
    idx["cols"], idx["rows"] = cols + COLS, rows
    with open(ip, "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, separators=(",", ":"))
    return n


if __name__ == "__main__":
    print("análise técnica:", aplicar(sys.argv[1]), "ativos com indicadores")
