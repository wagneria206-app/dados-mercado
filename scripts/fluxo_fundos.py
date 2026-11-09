"""Fluxo da indústria de fundos: captação líquida e patrimônio por categoria, mês a mês (informes da CVM).

Lê os arquivos de cada fundo (f/<cnpj>.json ou os pacotes pk/f-<chave>.json) já gravados pelo robô de fundos e grava
fluxo.json na mesma pasta. Não acessa a internet: roda logo depois do robô de fundos, ou sobre uma cópia já coletada.

Fundos de cotas (FIC) ficam de fora, porque o dinheiro deles já aparece nos fundos em que aplicam (contar os dois
dobraria o fluxo). Previdência (PGBL, VGBL, FAPI) é um grupo próprio, separado da classe CVM.

Uso: python scripts/fluxo_fundos.py <pasta do ramo fundos>
"""
import datetime as dt
import glob
import json
import os
import sys

MESES = 37          # 36 meses completos + o mês corrente (parcial)
TOP_ANB = 30        # tipos ANBIMA com maior patrimônio que entram no detalhe
PREV_FLAGS = 128


def mes_k(s):
    return int(s[:4]) * 12 + int(s[4:6]) - 1


def k_mes(k):
    return f"{k // 12:04d}-{k % 12 + 1:02d}"


def fundos(pasta):
    fs = sorted(glob.glob(os.path.join(pasta, "f", "*.json")))
    if fs:
        for p in fs:
            with open(p, encoding="utf-8") as f:
                yield json.load(f)
        return
    for p in sorted(glob.glob(os.path.join(pasta, "pk", "f-*.json"))):
        with open(p, encoding="utf-8") as f:
            yield from json.load(f).values()


def flags_prev(pasta):
    """CNPJs marcados como previdência no índice (e na 2ª parte do índice)."""
    prev = set()
    for nome in ("idx.json", "idx_p.json"):
        p = os.path.join(pasta, nome)
        if not os.path.exists(p):
            continue
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
        cols = d.get("cols")
        if not cols or "flags" not in cols:
            continue
        cf, cc = cols.index("flags"), cols.index("cnpj")
        for r in d["rows"]:
            if (r[cf] or 0) & PREV_FLAGS:
                prev.add(r[cc])
    return prev


def grupo(j, prev):
    nome = (j.get("n") or "").upper()
    if j.get("c") in prev or "PREV" in nome or "FAPI" in (j.get("tipo") or "") or "PGBL" in nome or "VGBL" in nome:
        return "Previdência"
    return j.get("cls") or "Outros"


def calcular(pasta, hoje=None):
    with open(os.path.join(pasta, "idx.json"), encoding="utf-8") as f:
        dt_idx = json.load(f).get("dt") or (hoje or dt.date.today()).isoformat()
    kfim = int(dt_idx[:4]) * 12 + int(dt_idx[5:7]) - 1
    k0 = kfim - MESES + 1
    prev = flags_prev(pasta)
    G, A = {}, {}
    n_fundos = n_fic = 0

    def soma(D, nome, k, cap, pl, ativo):
        g = D.setdefault(nome, {"cap": [0.0] * MESES, "pl": [0.0] * MESES, "n": [0] * MESES})
        i = k - k0
        if cap is not None:
            g["cap"][i] += cap
        if pl is not None:
            g["pl"][i] += pl
        if ativo:
            g["n"][i] += 1

    for j in fundos(pasta):
        if j.get("fic") == "S":
            n_fic += 1
            continue
        n_fundos += 1
        gr, anb = grupo(j, prev), (j.get("anb") or "").strip()
        m0, d0 = j.get("m0"), j.get("d0")
        pl = {}
        if m0:
            km = mes_k(m0)
            for n, v in enumerate(j.get("mpl") or []):
                if v is not None and k0 <= km + n <= kfim:
                    pl[km + n] = v * 1000
        cap = {}
        if d0:
            kd = mes_k(d0)
            ca, re = j.get("mca") or [], j.get("mre") or []
            for n in range(max(len(ca), len(re))):
                k = kd + n
                if k0 <= k <= kfim:
                    a = ca[n] if n < len(ca) else None
                    r = re[n] if n < len(re) else None
                    if a is not None or r is not None:
                        cap[k] = ((a or 0) - (r or 0)) * 1000
        for k in set(pl) | set(cap):
            soma(G, gr, k, cap.get(k), pl.get(k), k in pl)
            if anb:
                soma(A, anb, k, cap.get(k), pl.get(k), k in pl)
    top = sorted(A, key=lambda a: -A[a]["pl"][-2])[:TOP_ANB]
    rnd = lambda g: {"cap": [round(v) for v in g["cap"]], "pl": [round(v) for v in g["pl"]], "n": g["n"]}
    return {
        "geradoEm": dt.datetime.now().isoformat(timespec="seconds"), "dt": dt_idx,
        "meses": [k_mes(k) for k in range(k0, kfim + 1)], "parcial": True,
        "grupos": {g: rnd(v) for g, v in sorted(G.items(), key=lambda x: -x[1]["pl"][-2])},
        "anbima": {a: rnd(A[a]) for a in top},
        "fundos": n_fundos, "fic_fora": n_fic,
        "fonte": "CVM: informe diário (aplicações, resgates e patrimônio) e cadastro de fundos",
    }


if __name__ == "__main__":
    pasta = sys.argv[1]
    d = calcular(pasta)
    with open(os.path.join(pasta, "fluxo.json"), "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
    print("fluxo dos fundos:", d["fundos"], "fundos;", d["fic_fora"], "FIC fora;", len(d["grupos"]), "grupos;", d["meses"][0], "a", d["meses"][-1])
