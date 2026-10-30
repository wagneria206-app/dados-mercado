"""Robô da Bolsa americana — só fontes oficiais.

Índices: S&P 500, Dow Jones (DJX × 100) e VIX da Cboe; Nasdaq Composite e Nasdaq-100 da Nasdaq;
juros do Tesouro americano (2 e 10 anos) do U.S. Department of the Treasury.
Empresas: cotação e valor de mercado do dia (Nasdaq, que divulga também as ações da NYSE) e
demonstrações financeiras, dividendos e documentos entregues à SEC (EDGAR, XBRL).
Liga cada BDR negociado na B3 (lista da base de ativos) à empresa na SEC pelo nome e pelo código.

Uso: python scripts/eua.py ENTRADA SAIDA
"""
import concurrent.futures as cf
import csv
import datetime as dt
import io
import json
import os
import re
import sys
import threading
import time

import requests

INICIO = time.time()
LIMITE = INICIO + float(os.environ.get("MINUTOS", "25")) * 60
HOJE = dt.date.today()
ANO0 = 2005
REPO = os.environ.get("GITHUB_REPOSITORY", "wagneria206-app/dados-mercado")
NAV = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
       "Accept": "application/json, text/plain, */*"}
# a SEC pede identificação (nome e contato) no User-Agent
SEC_UAS = ["MercadoETitulos dados-mercado@users.noreply.github.com", "MercadoETitulos contato@example.org", NAV["User-Agent"]]
SEC_UA = None
DIAG = {}
MAX_EMP = int(os.environ.get("MAX_EMPRESAS", "800"))
REFAZ_DIAS = 4


def log(*a):
    print(f"[{time.time() - INICIO:6.0f}s]", *a, flush=True)


def ler(p, padrao):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return padrao


def gravar(p, obj):
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def get(url, headers=None, timeout=60, tentativas=3):
    ult = None
    for t in range(tentativas):
        try:
            r = requests.get(url, headers=headers or NAV, timeout=timeout)
            if r.status_code == 200:
                return r
            ult = f"HTTP {r.status_code}"
            if r.status_code in (403, 404):
                break
        except Exception as e:  # noqa: BLE001
            ult = repr(e)
        time.sleep(2 + 3 * t)
    raise RuntimeError(f"{url}: {ult}")


# ------------------------------------------------------------------ índices
def cboe(sim, mult=1.0):
    j = get(f"https://cdn.cboe.com/api/global/delayed_quotes/charts/historical/{sim}.json").json()
    return {x["date"]: round(float(x["close"]) * mult, 2) for x in j["data"]
            if x["date"] >= f"{ANO0}-01-01" and float(x["close"]) > 0}


def nasdaq_idx(sim):
    u = (f"https://api.nasdaq.com/api/quote/{sim}/historical?assetclass=index&fromdate={ANO0}-01-01"
         f"&limit=9999&todate={HOJE.isoformat()}")
    rows = get(u, timeout=90).json()["data"]["tradesTable"]["rows"]
    out = {}
    for r in rows:
        m, d, y = r["date"].split("/")
        v = float(r["close"].replace(",", ""))
        if v > 0:
            out[f"{y}-{m}-{d}"] = round(v, 2)
    return out


def treasury(velho):
    """Taxas de fechamento do Tesouro americano (curva par, % a.a.); refaz só o ano atual e o anterior."""
    out = {"t2": dict(velho.get("t2", {})), "t10": dict(velho.get("t10", {})), "t3m": dict(velho.get("t3m", {}))}
    anos = range(ANO0, HOJE.year + 1) if not out["t10"] else (HOJE.year - 1, HOJE.year)
    for a in anos:
        u = (f"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/{a}/all"
             f"?type=daily_treasury_yield_curve&field_tdr_date_value={a}&page&_format=csv")
        try:
            txt = get(u).text
        except Exception as e:  # noqa: BLE001
            DIAG[f"treasury_{a}"] = str(e)
            continue
        for r in csv.DictReader(io.StringIO(txt)):
            m, d, y = r["Date"].split("/")
            k = f"{y}-{m}-{d}"
            for c, n in (("2 Yr", "t2"), ("10 Yr", "t10"), ("3 Mo", "t3m")):
                if r.get(c):
                    out[n][k] = float(r[c])
    return out


def indices(ent):
    velho = ler(os.path.join(ent, "indices.json"), {})
    vel = {}
    if velho.get("d"):
        for k, arr in velho.get("s", {}).items():
            vel[k] = {d: v for d, v in zip(velho["d"], arr) if v is not None}
    S = {}
    fontes = (("spx", lambda: cboe("_SPX")), ("djia", lambda: cboe("_DJX", 100.0)), ("vix", lambda: cboe("_VIX")),
              ("comp", lambda: nasdaq_idx("COMP")), ("ndx", lambda: nasdaq_idx("NDX")))
    for n, f in fontes:
        try:
            s = f()
            if len(s) < 100:
                raise RuntimeError("série curta")
            S[n] = {**vel.get(n, {}), **s}
        except Exception as e:  # noqa: BLE001
            DIAG[n] = str(e)
            log("índice", n, "falhou:", e)
            if vel.get(n):
                S[n] = vel[n]
    S.update({k: v for k, v in treasury(vel).items() if v})
    datas = sorted({d for s in S.values() for d in s if d >= f"{ANO0}-01-01"})
    # só dias de pregão nos EUA (há S&P 500 ou Nasdaq)
    datas = [d for d in datas if d in S.get("spx", {}) or d in S.get("comp", {})]
    return {"d": datas, "s": {k: [S[k].get(d) for d in datas] for k in S},
            "fonte": "Cboe (S&P 500, Dow Jones via DJX × 100, VIX), Nasdaq (Nasdaq Composite e Nasdaq-100), "
                     "U.S. Department of the Treasury (juros de 3 meses, 2 e 10 anos)",
            "ts": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"}


# ------------------------------------------------------------------ cotações do dia (Nasdaq)
SETOR = {"Technology": "Tecnologia", "Finance": "Financeiro", "Health Care": "Saúde",
         "Consumer Discretionary": "Consumo cíclico", "Consumer Staples": "Consumo não cíclico",
         "Industrials": "Indústria", "Energy": "Energia", "Utilities": "Utilidade pública",
         "Real Estate": "Imobiliário", "Basic Materials": "Materiais básicos",
         "Telecommunications": "Telecomunicações", "Miscellaneous": "Outros"}


def sic_setor(sic):
    try:
        s = int(sic)
    except Exception:  # noqa: BLE001
        return None
    if 1000 <= s < 1500 or 2600 <= s < 2700 or 2800 <= s < 2830 or 2840 <= s < 2900 or 3300 <= s < 3400:
        return "Materiais básicos"
    if 1300 <= s < 1400 or 2900 <= s < 3000 or 4600 <= s < 4700:
        return "Energia"
    if 2830 <= s < 2840 or 3840 <= s < 3860 or 8000 <= s < 8100:
        return "Saúde"
    if 3570 <= s < 3580 or 3660 <= s < 3700 or 7370 <= s < 7380 or 3600 <= s < 3630:
        return "Tecnologia"
    if 4800 <= s < 4900:
        return "Telecomunicações"
    if 4900 <= s < 5000:
        return "Utilidade pública"
    if 6000 <= s < 6500 or 6700 <= s < 6800:
        return "Financeiro"
    if 6500 <= s < 6600 or s == 6798:
        return "Imobiliário"
    if 2000 <= s < 2200:
        return "Consumo não cíclico"
    if 5000 <= s < 6000 or 7000 <= s < 8000 or 2300 <= s < 2400 or 3700 <= s < 3720:
        return "Consumo cíclico"
    if 1500 <= s < 1800 or 3400 <= s < 3600 or 3700 <= s < 3800 or 4000 <= s < 4600 or 8700 <= s < 8800:
        return "Indústria"
    return "Outros"


def num(s):
    try:
        return float(str(s).replace("$", "").replace(",", "").replace("%", ""))
    except Exception:  # noqa: BLE001
        return None


def screener():
    u = "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true"
    rows = get(u, timeout=120).json()["data"]["rows"]
    out = {}
    for r in rows:
        out[r["symbol"].strip().upper().replace("/", "-").replace("^", "-P")] = {
            "px": num(r.get("lastsale")), "d1": num(r.get("pctchange")), "mcap": num(r.get("marketCap")) or None,
            "setor": SETOR.get(r.get("sector") or "", None), "ind": r.get("industry") or None,
            "pais": r.get("country") or None, "nome": r.get("name")}
    return out


# ------------------------------------------------------------------ BDR -> empresa na SEC
SUF = (r"\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|COS|LTD|LIMITED|PLC|SA|S A|NV|N V|AG|SE|AB|ASA|HOLDINGS?|"
       r"GROUP|THE|CLASS [A-C]|CL [A-C]|COM|COMMON|STOCK|SHARES|ADR|ADS|SPONSORED|NEW|DE|DEL|LLC|LP|L P|TRUST|"
       r"BANCORP|SAB|CV)\b")
# BDRs cujo nome na B3 é diferente do nome na SEC (conferidos à mão)
MANUAL = {"A1OS34": "AOS", "C1HR34": "CHRW", "C1PB34": "CPB", "D1HI34": "DHI", "D2KS34": "DKS", "D2PZ34": "DPZ",
          "FDMO34": "F", "FMXB34": "FMX", "G1WW34": "GWW", "GEOO34": "GE", "HPQB34": "HPQ", "J1BH34": "JBHT",
          "M1CB34": "TAP", "M1MC34": "MMC", "MACY34": "M", "O2LE34": "OLED", "ORLY34": "ORLY", "P2CF34": "PAC",
          "PSKY34": "PSKY", "Q1RV34": "QRVO", "S2CH34": "SQM", "S2RE34": "ASR", "SCHW34": "SCHW", "SLBG34": "SLB",
          "T1LK34": "TLK", "T1RO34": "TROW", "USBC34": "USB", "VFCO34": "VFC", "W1AB34": "WAB", "W1BD34": "WBD",
          "W1RB34": "WRB", "CMCS34": "CMCSA"}


def nz(s):
    s = s.upper().replace("&", " AND ")
    s = re.sub(r"/[A-Z]{2,4}/?$", "", s)
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    s = re.sub(SUF, " ", s)
    return " ".join(s.split())


def ligar(bdrs, sec, scr):
    byn, byt = {}, {}
    for cik, nm, tk, ex in sec:
        if not tk:
            continue
        tk = tk.upper()
        byt.setdefault(tk, (cik, nm, tk, ex))
        byn.setdefault(nz(nm), []).append((cik, nm, tk, ex))
    out = {}
    for code, nome in bdrs:
        n = nz(nome)
        c = None
        stem = re.sub(r"\d+$", "", code)
        s2 = re.sub(r"\d", "", stem)
        if code in MANUAL and MANUAL[code] in byt:
            c = byt[MANUAL[code]]
        elif byn.get(n):
            L = sorted(byn[n], key=lambda x: (x[2] not in scr, x[2].replace("-", "") != s2,
                                               x[3] not in ("NYSE", "Nasdaq"), len(x[2])))
            c = L[0]
        else:
            for cand in (s2, stem):
                if cand in byt and nz(byt[cand][1]).split()[:1] == n.split()[:1]:
                    c = byt[cand]
                    break
        if c:
            out[code] = {"cik": c[0], "tk": c[2], "ex": c[3], "nome": c[1]}
    return out


# ------------------------------------------------------------------ demonstrações (XBRL da SEC)
GAAP = {
    "rec": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
            "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet", "SalesRevenueGoodsNet",
            "RevenuesNetOfInterestExpense"],
    "lop": ["OperatingIncomeLoss"],
    "ll": ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"],
    "lpa": ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted", "EarningsPerShareBasic"],
    "fco": ["NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    "divpg": ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
    "recompra": ["PaymentsForRepurchaseOfCommonStock"],
    "dps": ["CommonStockDividendsPerShareDeclared", "CommonStockDividendsPerShareCashPaid"],
    "ativo": ["Assets"], "passivo": ["Liabilities"],
    "pl": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    "caixa": ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
    "divida": ["LongTermDebt", "LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"],
    "divcp": ["LongTermDebtCurrent", "ShortTermBorrowings", "CommercialPaper"],
}
IFRS = {
    "rec": ["Revenue", "RevenueFromContractsWithCustomers"],
    "lop": ["ProfitLossFromOperatingActivities"],
    "ll": ["ProfitLossAttributableToOwnersOfParent", "ProfitLoss"],
    "lpa": ["DilutedEarningsLossPerShare", "BasicAndDilutedEarningsLossPerShare", "BasicEarningsLossPerShare"],
    "fco": ["CashFlowsFromUsedInOperatingActivities"],
    "capex": ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
              "PurchaseOfPropertyPlantAndEquipment"],
    "divpg": ["DividendsPaidClassifiedAsFinancingActivities", "DividendsPaid",
              "DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities"],
    "recompra": ["PaymentsToAcquireOrRedeemEntitysShares"],
    "dps": ["DividendsRecognisedAsDistributionsToOwnersPerShare"],
    "ativo": ["Assets"], "passivo": ["Liabilities"],
    "pl": ["EquityAttributableToOwnersOfParent", "Equity"],
    "caixa": ["CashAndCashEquivalents"],
    "divida": ["NoncurrentPortionOfNoncurrentBorrowings", "LongtermBorrowings", "Borrowings"],
    "divcp": ["CurrentPortionOfLongtermBorrowings", "ShorttermBorrowings", "CurrentBorrowings"],
}
FLUXO = ["rec", "lop", "ll", "lpa", "fco", "capex", "divpg", "recompra", "dps"]
SALDO = ["ativo", "passivo", "pl", "caixa", "divida", "divcp"]
POR_ACAO = {"lpa", "dps"}
FORMS_ANO = {"10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A", "10-KT"}


def d2(s):
    return dt.date.fromisoformat(s)


def unidade(fatos, chaves, por_acao):
    """Escolhe a moeda dos dados mais recentes; empate fica com o dólar (ou a de mais fatos)."""
    cont, ult = {}, {}
    for k in chaves:
        for u, L in (fatos.get(k, {}).get("units") or {}).items():
            if por_acao != ("/" in u) or not L:
                continue
            base = u.split("/")[0]
            cont[base] = cont.get(base, 0) + len(L)
            ult[base] = max(ult.get(base, ""), max(f.get("end", "") for f in L))
    if not cont:
        return None
    return max(cont, key=lambda b: (ult[b], b == "USD", cont[b]))


def serie(fatos, chaves, moeda, por_acao, instante):
    """Junta os conceitos na ordem de prioridade; chave = (início, fim) ou fim. Fica o valor arquivado por último."""
    out = {}
    for pri, k in enumerate(chaves):
        units = (fatos.get(k) or {}).get("units") or {}
        for u, L in units.items():
            if u.split("/")[0] != moeda or por_acao != ("/" in u):
                continue
            for f in L:
                if "end" not in f or f.get("val") is None:
                    continue
                if instante:
                    key = f["end"]
                else:
                    if "start" not in f:
                        continue
                    key = (f["start"], f["end"])
                cur = out.get(key)
                cand = (pri, f.get("filed", ""), f["val"], f.get("form", ""))
                # conceito de maior prioridade vence; dentro dele, o arquivamento mais recente
                if cur is None or cand[0] < cur[0] or (cand[0] == cur[0] and cand[1] > cur[1]):
                    out[key] = cand
    return {k: (v[2], v[3]) for k, v in out.items()}


def anual_trimestral(S):
    """Fluxos: anuais (≈ 1 ano), trimestrais (diretos ou por diferença de acumulados no ano) e acumulados."""
    anual, tri, acum = {}, {}, {}
    for (a, b), (v, form) in S.items():
        dias = (d2(b) - d2(a)).days
        if 350 <= dias <= 380:
            anual[b] = v
        if 80 <= dias <= 100:
            tri[b] = v
        acum.setdefault(a, {})[b] = (dias, v)
    # trimestres que só aparecem acumulados (comum no fluxo de caixa): diferença entre acumulados do mesmo ano
    for a, ends in acum.items():
        L = sorted(ends.items())
        for i in range(1, len(L)):
            (e0, (n0, v0)), (e1, (n1, v1)) = L[i - 1], L[i]
            if 80 <= n1 - n0 <= 100 and e1 not in tri:
                tri[e1] = v1 - v0
    return anual, tri


def ttm(anual, tri):
    """Últimos 12 meses: soma dos 4 últimos trimestres contíguos, se forem mais novos que o último ano."""
    ks = sorted(tri)
    ua = max(anual) if anual else None
    if len(ks) >= 4:
        u = ks[-4:]
        if (d2(u[-1]) - d2(u[0])).days <= 300 and (ua is None or u[-1] >= ua):
            return u[-1], sum(tri[k] for k in u)
    if ua:
        return ua, anual[ua]
    return None, None


def ttm_ant(anual, tri, fim):
    """12 meses encerrados cerca de um ano antes de 'fim' (para crescimento)."""
    if not fim:
        return None
    alvo = d2(fim) - dt.timedelta(days=365)
    ks = [k for k in sorted(tri) if abs((d2(k) - alvo).days) <= 20]
    if ks:
        e = ks[-1]
        L = [k for k in sorted(tri) if k <= e][-4:]
        if len(L) == 4 and (d2(L[-1]) - d2(L[0])).days <= 300:
            return sum(tri[k] for k in L)
    ka = [k for k in anual if abs((d2(k) - alvo).days) <= 20]
    return anual[ka[-1]] if ka else None


TRAVA = threading.Lock()
PROX = [0.0]


def sec_get(url, timeout=120):
    """Respeita o limite da SEC (bem abaixo de 10 pedidos por segundo); em 429 espera e tenta de novo."""
    hdr = {"User-Agent": SEC_UA, "Accept-Encoding": "gzip, deflate"}
    for t in range(5):
        with TRAVA:
            espera = PROX[0] - time.time()
            if espera > 0:
                time.sleep(espera)
            PROX[0] = time.time() + 0.25
        try:
            r = requests.get(url, headers=hdr, timeout=timeout)
        except Exception as e:  # noqa: BLE001
            ult = repr(e)
            time.sleep(3)
            continue
        if r.status_code == 200:
            return r
        ult = f"HTTP {r.status_code}"
        if r.status_code == 404:
            break
        if r.status_code in (429, 403):
            with TRAVA:
                PROX[0] = time.time() + 30 * (t + 1)
            log("SEC pediu pausa:", r.status_code)
    raise RuntimeError(f"{url}: {ult}")


def empresa(cik):
    sub = sec_get(f"https://data.sec.gov/submissions/CIK{cik:010d}.json", 60).json()
    try:
        cfj = sec_get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json").json()
    except RuntimeError as e:
        if "404" in str(e):
            cfj = {"facts": {}}
        else:
            raise
    facts = cfj.get("facts") or {}
    tax = "us-gaap" if len(facts.get("us-gaap", {})) >= len(facts.get("ifrs-full", {})) else "ifrs-full"
    F = facts.get(tax, {})
    MAP = GAAP if tax == "us-gaap" else IFRS
    moeda = unidade(F, MAP["rec"] + MAP["ll"] + MAP["ativo"], False)
    res = {"cik": cik, "nome": sub.get("name"), "sic": sub.get("sic"), "sicd": sub.get("sicDescription"),
           "fye": sub.get("fiscalYearEnd"), "uf": sub.get("stateOfIncorporationDescription"),
           "cat": sub.get("category"), "site": sub.get("website") or sub.get("investorWebsite") or None,
           "tks": sub.get("tickers"), "exs": sub.get("exchanges"), "tax": tax, "moeda": moeda,
           "ts": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"}
    A, Q, T = {}, {}, {}
    if moeda:
        for k in FLUXO:
            S = serie(F, MAP[k], moeda, k in POR_ACAO, False)
            an, tr = anual_trimestral(S)
            A[k], Q[k] = an, tr
            fim, v = ttm(an, tr) if k not in POR_ACAO else ttm(an, tr)
            T[k] = v
            if k in ("rec", "ll"):
                T[k + "_ant"] = ttm_ant(an, tr, fim)
            if k == "rec":
                T["fim"] = fim
        for k in SALDO:
            S = serie(F, MAP[k], moeda, False, True)
            A[k] = {e: v for e, (v, form) in S.items()}
            Q[k] = A[k]
            if S:
                T[k] = S[max(S)][0]
                T[k + "_dt"] = max(S)
    # ações em circulação (capa do formulário; soma das classes da mesma data)
    sh = {}
    for f in ((facts.get("dei", {}).get("EntityCommonStockSharesOutstanding") or {}).get("units") or {}).get("shares", []):
        sh.setdefault(f["end"], {})[f.get("accn")] = sh.get(f["end"], {}).get(f.get("accn"), 0) + f["val"]
    if sh:
        e = max(sh)
        T["acoes"] = max(sh[e].values())
        T["acoes_dt"] = e
    # tabelas: 10 anos fiscais e 8 trimestres
    fins = sorted({e for k in ("rec", "ll", "fco") for e in A.get(k, {})})
    ends_a = []
    for e in reversed(fins):
        if all(abs((d2(e) - d2(x)).days) > 40 for x in ends_a):
            ends_a.append(e)
    ends_a = sorted(ends_a)[-10:]
    COLS = FLUXO + SALDO

    def pega(D, e):
        if e in D:
            return D[e]
        for k in D:  # balanço com data alguns dias diferente do fim do exercício
            if abs((d2(k) - d2(e)).days) <= 7:
                return D[k]
        return None

    res["cols"] = COLS
    res["a"] = [[e] + [pega(A.get(c, {}), e) for c in COLS] for e in ends_a]
    ends_q = sorted({e for k in ("rec", "ll") for e in Q.get(k, {})})[-8:]
    res["q"] = [[e] + [pega(Q.get(c, {}), e) for c in COLS] for e in ends_q]
    res["ttm"] = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in T.items() if v is not None}
    # documentos entregues à SEC
    r = (sub.get("filings") or {}).get("recent") or {}
    docs = []
    KEEP = {"10-K", "10-Q", "8-K", "20-F", "6-K", "40-F", "DEF 14A", "10-K/A", "20-F/A", "10-Q/A", "S-1", "424B2"}
    for i, form in enumerate(r.get("form", [])):
        if form not in KEEP or form == "424B2":
            continue
        acc = r["accessionNumber"][i]
        doc = r["primaryDocument"][i]
        url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc.replace('-', '')}/{doc}" if doc else \
            f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc.replace('-', '')}/"
        docs.append([form, r["filingDate"][i], r.get("reportDate", [""] * (i + 1))[i] or "", r.get("items", [""] * (i + 1))[i] or "",
                     (r.get("primaryDocDescription", [""] * (i + 1))[i] or "")[:80], url])
        if len(docs) >= 30:
            break
    res["docs"] = docs
    return res


def sec_ua():
    global SEC_UA
    for ua in SEC_UAS:
        try:
            r = requests.get("https://data.sec.gov/submissions/CIK0000320193.json", headers={"User-Agent": ua}, timeout=30)
            if r.status_code == 200:
                SEC_UA = ua
                log("SEC aceita o User-Agent:", ua[:40])
                return
        except Exception:  # noqa: BLE001
            pass
    raise RuntimeError("SEC recusou todos os User-Agents")


# ------------------------------------------------------------------ índice para o app
def metricas(e, q):
    t = e.get("ttm") or {}
    usd = e.get("moeda") == "USD"
    mcap = q.get("mcap") if q else None
    if not mcap and q and q.get("px") and t.get("acoes"):
        mcap = q["px"] * t["acoes"]
    ll, rec, pl = t.get("ll"), t.get("rec"), t.get("pl")
    m = {"mcap": mcap, "px": q.get("px") if q else None, "d1": q.get("d1") if q else None}
    recente = bool(t.get("fim")) and (HOJE - d2(t["fim"])).days <= 460
    if usd and mcap and recente:
        m["pl"] = round(mcap / ll, 2) if ll and ll > 0 else None
        m["pvp"] = round(mcap / pl, 2) if pl and pl > 0 else None
        m["dy"] = round(t["divpg"] / mcap * 100, 2) if t.get("divpg") is not None else None
    m["roe"] = round(ll / pl * 100, 2) if ll is not None and pl and pl > 0 else None
    m["ml"] = round(ll / rec * 100, 2) if ll is not None and rec and rec > 0 else None
    m["mop"] = round(t["lop"] / rec * 100, 2) if t.get("lop") is not None and rec and rec > 0 else None
    m["crec"] = round((rec / t["rec_ant"] - 1) * 100, 2) if rec and t.get("rec_ant") and t["rec_ant"] > 0 else None
    m["cll"] = round((ll / t["ll_ant"] - 1) * 100, 2) if ll and t.get("ll_ant") and t["ll_ant"] > 0 and ll > 0 else None
    return m


def main(ent, sai):
    os.makedirs(os.path.join(sai, "s"), exist_ok=True)
    # 1) índices
    try:
        I = indices(ent)
        gravar(os.path.join(sai, "indices.json"), I)
        log("índices:", {k: sum(1 for x in v if x is not None) for k, v in I["s"].items()}, "até", I["d"][-1])
    except Exception as e:  # noqa: BLE001
        DIAG["indices"] = str(e)
        log("índices falharam:", e)
        v = ler(os.path.join(ent, "indices.json"), None)
        if v:
            gravar(os.path.join(sai, "indices.json"), v)
    # 2) cotações do dia
    try:
        scr = screener()
        log("cotações Nasdaq:", len(scr))
    except Exception as e:  # noqa: BLE001
        DIAG["screener"] = str(e)
        scr = (ler(os.path.join(ent, "cot.json"), {}) or {})
        log("cotações falharam; uso as anteriores", len(scr))
    gravar(os.path.join(sai, "cot.json"), scr)
    # 3) BDRs da B3 e ligação com a SEC
    at = get(f"https://raw.githubusercontent.com/{REPO}/ativos/idx.json").json()
    C = {n: i for i, n in enumerate(at["cols"])}
    bdrs = [(r[0], r[1]) for r in at["rows"] if r[C["tipo"]] == "BDR"]
    sec_ua()
    hdr = {"User-Agent": SEC_UA}
    try:
        sec = get("https://www.sec.gov/files/company_tickers_exchange.json", hdr).json()["data"]
        gravar(os.path.join(sai, "sec_tickers.json"), sec)
    except Exception as e:  # noqa: BLE001
        DIAG["sec_tickers"] = str(e)
        sec = ler(os.path.join(ent, "sec_tickers.json"), [])
    lig = ligar(bdrs, sec, scr)
    log("BDRs:", len(bdrs), "ligados à SEC:", len(lig))
    # 4) empresas: refaz as mais antigas primeiro (ciclo de poucos dias)
    ciks = sorted({v["cik"] for v in lig.values()})
    idade = {}
    for c in ciks:
        p = os.path.join(ent, "s", f"{c}.json")
        old = ler(p, None)
        if old:
            gravar(os.path.join(sai, "s", f"{c}.json"), old)
            idade[c] = old.get("ts", "")
        else:
            idade[c] = ""
    lim = (dt.datetime.utcnow() - dt.timedelta(days=REFAZ_DIAS)).isoformat()
    fila = sorted([c for c in ciks if idade[c] < lim], key=lambda c: idade[c])[:MAX_EMP]
    log("empresas a atualizar:", len(fila), "de", len(ciks))
    ok = err = 0

    def um(c):
        if time.time() > LIMITE:
            return c, None, "tempo"
        try:
            return c, empresa(c), None
        except Exception as e:  # noqa: BLE001
            return c, None, str(e)[:200]

    with cf.ThreadPoolExecutor(3) as ex:
        for c, res, er in ex.map(um, fila):
            if res:
                gravar(os.path.join(sai, "s", f"{c}.json"), res)
                ok += 1
            elif er != "tempo":
                err += 1
                DIAG.setdefault("empresas", {})[str(c)] = er
    log("empresas atualizadas:", ok, "erros:", err)
    # 5) índice para o ranking
    rows = []
    for code, nome in bdrs:
        L = lig.get(code)
        if not L:
            continue
        e = ler(os.path.join(sai, "s", f"{L['cik']}.json"), None)
        if not e:
            continue
        q = scr.get(L["tk"].upper())
        m = metricas(e, q)
        setor = (q or {}).get("setor") or sic_setor(e.get("sic"))
        t = e.get("ttm") or {}
        rows.append([code, L["tk"], e.get("nome") or L["nome"], setor, L["ex"], L["cik"], e.get("moeda"),
                     m["px"], m["d1"], m["mcap"], m.get("pl"), m.get("pvp"), m["roe"], m["ml"], m["mop"], m["crec"],
                     m["cll"], m.get("dy"), t.get("rec"), t.get("ll"), t.get("fim"), (q or {}).get("ind")])
    idx = {"cols": ["t", "tk", "nome", "setor", "ex", "cik", "moeda", "px", "d1", "mcap", "pl", "pvp", "roe", "ml",
                    "mop", "crec", "cll", "dy", "rec", "ll", "fim", "ind"],
           "rows": rows, "dt": HOJE.isoformat(), "ts": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z",
           "fonte": "SEC (EDGAR/XBRL: demonstrações e documentos), Nasdaq (cotação e valor de mercado do dia), B3 (lista de BDRs)"}
    gravar(os.path.join(sai, "idx.json"), idx)
    gravar(os.path.join(sai, "estado.json"), {"diag": DIAG, "ok": ok, "erros": err, "ligados": len(lig),
                                              "bdrs": len(bdrs), "ts": idx["ts"]})
    log("idx:", len(rows), "linhas; diag:", list(DIAG))
    if not rows:
        raise SystemExit("nenhuma empresa no índice")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
