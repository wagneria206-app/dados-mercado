"""Painel mensal das ações para o teste histórico de estratégias (backtest) do app.

Para cada ação ou unit que já teve liquidez relevante, grava mês a mês desde 2006: retorno total (cotação com
proventos reinvestidos), liquidez média diária, rendimento de proventos de 12 meses, P/L, P/VP e ROE do último
balanço anual já publicado naquele mês (três meses depois do fim do exercício, prazo da CVM). Assim o teste só
usa o que um investidor sabia em cada data, sem olhar o futuro.

Lê o idx.json, cal.json, bench.json e as cotações (a/<código>.json ou pk/a-<letra>.json) já gravados pelo robô de
ativos e grava painel.json na mesma pasta. Não acessa a internet.

Aproximação conhecida: o valor de mercado usa a quantidade de ações atual com preços ajustados por desdobramentos
(recompras e emissões antigas não são refeitas).

Uso: python scripts/painel_mensal.py <pasta do ramo ativos>
"""
import bisect
import json
import os
import re
import sys

ANO0 = 2006
LIQ_MIN = 1e6      # já negociou ao menos R$ 1 milhão por dia em algum mês


def r2(v, d=2):
    return None if v is None else round(v, d)


def ler(pasta, nome, padrao=None):
    p = os.path.join(pasta, nome)
    if not os.path.exists(p):
        return padrao
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def calcular(pasta):
    idx, cal, bench = ler(pasta, "idx.json"), ler(pasta, "cal.json")["d"], ler(pasta, "bench.json", {})
    C = {c: i for i, c in enumerate(idx["cols"])}
    meses = sorted({d[:7] for d in cal if d[:4] >= str(ANO0)})
    km = {m: i for i, m in enumerate(meses)}
    fim_mes = {}   # índice do último pregão de cada mês
    for i, d in enumerate(cal):
        if d[:7] in km:
            fim_mes[d[:7]] = i
    dias_mes = {}
    for d in cal:
        dias_mes[d[:7]] = dias_mes.get(d[:7], 0) + 1
    cache = {}

    def ativo(t):
        p = os.path.join(pasta, "a", t + ".json")
        if os.path.exists(p):
            return ler(pasta, os.path.join("a", t + ".json"))
        c0 = t[:1].upper()
        k = c0 if re.match(r"[A-Z0-9]", c0) else "_"
        if k not in cache:
            cache.clear()
            cache[k] = ler(pasta, os.path.join("pk", "a-" + k + ".json"), {})
        return cache[k].get(t)

    out = {}
    linhas = [r for r in idx["rows"] if r[C["tipo"]] in ("Ação", "Unit")]
    for r in sorted(linhas, key=lambda r: r[0][:1].upper()):
        t = r[0]
        j = ativo(t)
        if not j or not j.get("c"):
            continue
        i0 = j.get("i0", 0)
        I, R = [], []
        for k, v in enumerate(j["c"]):
            if v is not None:
                I.append(i0 + k)
                R.append(v)
        if len(I) < 30:
            continue
        adj = sorted(j.get("adj") or [])
        # série com proventos (Q) e só com desdobramentos (S), como no app
        Q, S = [0.0] * len(I), [0.0] * len(I)
        accq = accs = 1.0
        k = len(adj) - 1
        for x in range(len(I) - 1, -1, -1):
            while k >= 0 and adj[k][0] > I[x]:
                accq *= adj[k][1]
                if str(adj[k][2]).startswith("S"):
                    accs *= adj[k][1]
                k -= 1
            Q[x], S[x] = R[x] * accq, R[x] * accs
        # proventos por ação na base de ações de hoje (desfaz desdobramentos posteriores)
        prov = []
        for e in adj:
            if str(e[2]) in ("D", "J", "R", "E") and len(e) > 4:
                m = 1.0
                for e2 in adj:
                    if str(e2[2]).startswith("S") and e2[0] > e[0]:
                        m *= e2[1]
                prov.append((e[4], e[3] * m))
        prov.sort()
        pd = [p[0] for p in prov]
        # volume mensal
        vol = {}
        if j.get("vm0") and j.get("vol"):
            k0 = int(j["vm0"][:4]) * 12 + int(j["vm0"][4:]) - 1
            for n, v in enumerate(j["vol"]):
                kk = k0 + n
                m = f"{kk // 12:04d}-{kk % 12 + 1:02d}"
                if v and dias_mes.get(m):
                    vol[m] = v / dias_mes[m]
        if not vol or max(vol.values()) < LIQ_MIN:
            continue
        fund = ((j.get("fund") or {}).get("a")) or {}
        anos = sorted((v[7], v[2], v[3]) for v in fund.values() if v and v[7])
        acoes = (j.get("ind") or {}).get("acoes")
        ret, liq, dy, pl, pvp, roe = [], [], [], [], [], []
        ant = None
        for m in meses:
            ix = fim_mes.get(m)
            p = bisect.bisect_right(I, ix) - 1 if ix is not None else -1
            ok = p >= 0 and ix - I[p] <= 25      # negociou nos últimos ~25 pregões
            if not ok:
                ret.append(None); liq.append(r2(vol.get(m), 0)); dy.append(None); pl.append(None); pvp.append(None); roe.append(None)
                ant = None
                continue
            rr = (Q[p] / ant - 1) * 100 if ant else None
            if rr is not None and (rr > 150 or rr < -80):
                rr = None      # salto de mais de 150% ou queda de mais de 80% num mês: quase sempre erro de ajuste (desdobramento não registrado)
            ret.append(r2(rr))
            ant = Q[p]
            liq.append(r2(vol.get(m), 0))
            dref = cal[I[p]]
            lim = f"{int(dref[:4]) - 1}{dref[4:]}"
            a, b = bisect.bisect_right(pd, lim), bisect.bisect_right(pd, dref)
            soma = sum(v for _, v in prov[a:b])
            dy.append(r2(soma / S[p] * 100) if S[p] else None)
            # último balanço anual publicado (fim do exercício + 3 meses)
            bal = None
            for fim, ll, plq in anos:
                y, mm = int(fim[:4]), int(fim[5:7]) + 4      # disponível a partir do 1º dia do 4º mês depois do fim do exercício
                y, mm = y + (mm - 1) // 12, (mm - 1) % 12 + 1
                if f"{y:04d}-{mm:02d}-01" <= dref:
                    bal = (ll, plq)
            if bal and acoes:
                mc = S[p] * acoes
                pl.append(r2(mc / bal[0], 1) if bal[0] and bal[0] > 0 else None)
                pvp.append(r2(mc / bal[1]) if bal[1] and bal[1] > 0 else None)
                roe.append(r2(bal[0] / bal[1] * 100, 1) if bal[1] and bal[1] > 0 and bal[0] is not None else None)
            else:
                pl.append(None); pvp.append(None); roe.append(None)
        out[t] = {"n": r[C["nome"]], "s": idx["setores"][r[C["setor"]]] if r[C["setor"]] is not None else "",
                  "ret": ret, "liq": liq, "dy": dy, "pl": pl, "pvp": pvp, "roe": roe}
    # índices: Ibovespa (retorno de preço) e CDI do mês
    bd = (bench or {}).get("d") or {}
    IB = bd.get("ibov") or [None] * len(cal)
    ib, cdi = [], []
    for n, m in enumerate(meses):
        ix = fim_mes.get(m)
        ia = fim_mes.get(meses[n - 1]) if n else None
        v1 = IB[ix] if ix is not None else None
        v0 = IB[ia] if ia is not None else None
        ib.append(r2((v1 / v0 - 1) * 100) if v0 and v1 else None)
        cm = ((bench or {}).get("m") or {}).get("cdi") or {}
        v = cm.get(m.replace("-", ""))     # CDI do mês em % (série mensal do Banco Central; a diária só existe nos anos recentes)
        cdi.append(r2(v, 3) if v is not None else None)
    return {"meses": meses, "ibov": ib, "cdi": cdi, "a": out,
            "nota": "retorno total mensal (%); liquidez média diária (R$); rendimento de 12 meses (%); P/L, P/VP e ROE do último balanço anual publicado",
            "fonte": "B3 (cotações, proventos) e CVM (balanços anuais), montado pelo app a partir do robô de ativos"}


if __name__ == "__main__":
    pasta = sys.argv[1]
    d = calcular(pasta)
    with open(os.path.join(pasta, "painel.json"), "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
    print("painel mensal:", len(d["a"]), "ações;", d["meses"][0], "a", d["meses"][-1], ";", round(os.path.getsize(os.path.join(pasta, "painel.json")) / 1e6, 1), "MB")
