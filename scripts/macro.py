"""Robô de economia (Brasil, EUA e mundo) — só fontes oficiais.

Brasil: Boletim Focus (Banco Central, Olinda), atividade (IBGE/SIDRA: PIB, desemprego, indústria, varejo,
serviços; Banco Central: IBC-Br), fiscal e crédito (Banco Central/SGS) e juros de prazo constante calculados
com as taxas do Tesouro Direto (Tesouro Transparente).
EUA e mundo: inflação e emprego (BLS), projeções do Fed (Summary of Economic Projections), índice amplo do
dólar (Fed, H.10) e petróleo Brent (EIA).

Uso: python scripts/macro.py ENTRADA SAIDA
"""
import csv
import datetime as dt
import html
import io
import json
import os
import re
import sys
import time
import urllib.parse

import requests

INICIO = time.time()
HOJE = dt.date.today()
NAV = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
       "Accept": "application/json, text/plain, */*"}
DIAG = {}
OLINDA = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/"
URL_TD = ("https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3"
          "/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv")


def log(*a):
    print(f"[{time.time() - INICIO:6.0f}s]", *a, flush=True)


def ler(p, padrao):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return padrao


def get(url, timeout=90, tentativas=3, **kw):
    ult = None
    hdr = kw.pop("headers", NAV)
    for t in range(tentativas):
        try:
            r = requests.get(url, headers=hdr, timeout=timeout, **kw)
            if r.status_code == 200:
                return r
            ult = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            ult = repr(e)
        time.sleep(3 + 4 * t)
    raise RuntimeError(f"{url[:120]}: {ult}")


def parte(nome, f, velho):
    """Roda uma coleta; se falhar, mantém o que foi publicado antes."""
    try:
        v = f()
        log(nome, "ok")
        return v
    except Exception as e:  # noqa: BLE001
        DIAG[nome] = str(e)[:300]
        log(nome, "FALHOU:", e)
        return velho.get(nome)


# ------------------------------------------------------------------ Focus
def olinda(ent, filtro, select, top=100000):
    u = (OLINDA + ent + "?$top=" + str(top) + "&$filter=" + urllib.parse.quote(filtro) +
         "&$select=" + select + "&$orderby=" + urllib.parse.quote("Data asc") + "&$format=json")
    return get(u, timeout=120).json()["value"]


def semanal(pares):
    """Uma observação por semana (a última de cada semana)."""
    por = {}
    for d, v in pares:
        y, w, _ = dt.date.fromisoformat(d).isocalendar()
        por[(y, w)] = (d, v)
    return [list(por[k]) for k in sorted(por)]


def focus():
    ini = (HOJE - dt.timedelta(days=3 * 365)).isoformat()
    out = {"anuais": {}}
    for ind in ("IPCA", "Selic", "PIB Total", "Câmbio", "Resultado primário", "Dívida líquida do setor público"):
        rows = olinda("ExpectativasMercadoAnuais", f"Indicador eq '{ind}' and baseCalculo eq 0 and Data ge '{ini}'",
                      "Data,DataReferencia,Mediana")
        refs = {}
        for r in rows:
            ref = str(r["DataReferencia"])
            if not ref.isdigit() or not (HOJE.year - 1 <= int(ref) <= HOJE.year + 3):
                continue
            refs.setdefault(ref, []).append((r["Data"], r["Mediana"]))
        out["anuais"][ind] = {k: semanal(v) for k, v in refs.items()}
    ini12 = "2012-01-01"
    rows = olinda("ExpectativasMercadoInflacao12Meses", f"Indicador eq 'IPCA' and Suavizada eq 'S' and baseCalculo eq 0 and Data ge '{ini12}'",
                  "Data,Mediana")
    out["ipca12"] = semanal([(r["Data"], r["Mediana"]) for r in rows])
    # Selic por reunião do Copom: pesquisa mais recente e a de cerca de 4 semanas antes
    ini_s = (HOJE - dt.timedelta(days=45)).isoformat()
    rows = olinda("ExpectativasMercadoSelic", f"baseCalculo eq 0 and Data ge '{ini_s}'", "Data,Reuniao,Mediana")
    datas = sorted({r["Data"] for r in rows})
    if datas:
        u = datas[-1]
        alvo = (dt.date.fromisoformat(u) - dt.timedelta(days=28)).isoformat()
        a = max([d for d in datas if d <= alvo] or [datas[0]])

        def reun(d):
            L = [(r["Reuniao"], r["Mediana"]) for r in rows if r["Data"] == d]
            return sorted(L, key=lambda x: (int(x[0].split("/")[1]), int(x[0][1:].split("/")[0])))
        out["selic"] = {"data": u, "reunioes": reun(u), "ant": {"data": a, "reunioes": reun(a)}}
    out["fonte"] = "Banco Central do Brasil — Sistema de Expectativas de Mercado (Boletim Focus), medianas"
    return out


# ------------------------------------------------------------------ IBGE (SIDRA) e Banco Central (SGS)
def sidra(tab, var, n, clas=""):
    u = f"https://apisidra.ibge.gov.br/values/t/{tab}/n1/all/v/{var}/p/last%20{n}{clas}"
    j = get(u, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"}).json()
    out = {}
    for r in j[1:]:
        try:
            v = float(r["V"])
        except Exception:  # noqa: BLE001
            continue
        out.setdefault(r["D2C"], []).append([r["D3C"], v])
    for k in out:
        out[k].sort()
    return out


def sgs(cod, ini="01/01/2010"):
    u = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial={ini}"
    L = get(u).json()
    return [[f"{x['data'][6:]}-{x['data'][3:5]}", float(x["valor"])] for x in L if x.get("valor") not in (None, "")]


def brasil():
    out = {}
    p = sidra(5932, "6561,6564", 48, "/c11255/90707")
    out["pib_aa"], out["pib_tt"] = p.get("6561", []), p.get("6564", [])
    out["desemp"] = sidra(6381, "4099", 120).get("4099", [])
    for nome, tab, var, clas in (("pim", 8888, "11601,11602", "/c544/129314"), ("pmc", 8880, "11708,11709", "/c11046/56734"),
                                 ("pms", 5906, "11623,11624", "/c11046/56726")):
        d = sidra(tab, var, 120, clas)
        a, b = var.split(",")
        out[nome + "_mm"], out[nome + "_aa"] = d.get(a, []), d.get(b, [])
    for nome, cod in (("ibcbr", 24364), ("ibcbr_ns", 24363), ("dbgg", 13762), ("dlsp", 4513), ("nfsp_prim", 5793),
                      ("nfsp_nom", 5727), ("concessoes", 20631), ("inad", 21082), ("inad_pf", 21084), ("inad_pj", 21083)):
        try:
            out[nome] = sgs(cod)
        except Exception as e:  # noqa: BLE001
            DIAG[f"sgs_{cod}"] = str(e)[:200]
    out["fonte"] = "IBGE (SIDRA: Contas Nacionais, PNAD Contínua, PIM-PF, PMC e PMS) e Banco Central (SGS: IBC-Br, fiscal e crédito)"
    return out


# ------------------------------------------------------------------ juros de prazo constante (Tesouro Direto)
def num(s):
    try:
        return float(str(s).replace(".", "").replace(",", ".")) if "," in str(s) else float(s)
    except Exception:  # noqa: BLE001
        return None


def prazo_constante():
    txt = get(URL_TD, timeout=180).content.decode("latin1")
    rd = csv.reader(io.StringIO(txt), delimiter=";")
    cab = next(rd)
    ix = {c.strip(): i for i, c in enumerate(cab)}
    grupos = {"Tesouro IPCA+ com Juros Semestrais": "real", "Tesouro IPCA+": "real",
              "Tesouro Prefixado": "pre", "Tesouro Prefixado com Juros Semestrais": "pre"}
    por = {}
    for r in rd:
        try:
            g = grupos.get(r[ix["Tipo Titulo"]].strip())
            if not g:
                continue
            db = dt.datetime.strptime(r[ix["Data Base"]], "%d/%m/%Y").date()
            if db.year < 2010:
                continue
            ve = dt.datetime.strptime(r[ix["Data Vencimento"]], "%d/%m/%Y").date()
            tx = num(r[ix["Taxa Venda Manha"]]) or num(r[ix["Taxa Compra Manha"]])
            if not tx or tx <= 0:
                continue
            por.setdefault(db, {}).setdefault(g, []).append(((ve - db).days / 365.25, tx))
        except Exception:  # noqa: BLE001
            continue

    def interp(L, T):
        L = sorted(L)
        abaixo = [x for x in L if x[0] <= T]
        acima = [x for x in L if x[0] >= T]
        if not abaixo or not acima:
            return None
        a, b = abaixo[-1], acima[0]
        if T - a[0] > 3 or b[0] - T > 3:
            return None
        if b[0] == a[0]:
            return round(a[1], 3)
        return round(a[1] + (b[1] - a[1]) * (T - a[0]) / (b[0] - a[0]), 3)
    datas = sorted(por)
    out = {"d": [d.isoformat() for d in datas]}
    for nome, g, T in (("real5", "real", 5), ("real10", "real", 10), ("pre3", "pre", 3), ("pre5", "pre", 5)):
        out[nome] = [interp(por[d].get(g, []), T) for d in datas]
    out["fonte"] = ("Tesouro Nacional (Tesouro Transparente): taxas de resgate do Tesouro Direto, interpoladas "
                    "entre os vencimentos vizinhos para prazo constante")
    return out


# ------------------------------------------------------------------ EUA
BLS = {"CUUR0000SA0": "cpi", "CUUR0000SA0L1E": "core", "CUSR0000SA0": "cpi_sa", "CES0000000001": "payroll",
       "LNS14000000": "desemp", "CES0500000003": "salario"}


def bls():
    out = {}
    for ini, fim in ((HOJE.year - 19, HOJE.year - 10), (HOJE.year - 9, HOJE.year)):
        r = requests.post("https://api.bls.gov/publicAPI/v2/timeseries/data/", timeout=90, headers={**NAV, "Content-Type": "application/json"},
                          data=json.dumps({"seriesid": list(BLS), "startyear": str(ini), "endyear": str(fim)}))
        j = r.json()
        if j.get("status") != "REQUEST_SUCCEEDED":
            raise RuntimeError(f"BLS: {j.get('status')} {j.get('message')}")
        for s in j["Results"]["series"]:
            k = BLS[s["seriesID"]]
            for x in s["data"]:
                if not x["period"].startswith("M") or x["period"] == "M13":
                    continue
                try:
                    out.setdefault(k, {})[f"{x['year']}-{x['period'][1:]}"] = float(x["value"])
                except Exception:  # noqa: BLE001
                    pass
        time.sleep(2)
    return {k: sorted([m, v] for m, v in d.items()) for k, d in out.items()} | {
        "fonte": "U.S. Bureau of Labor Statistics (CPI-U, payroll e desemprego)"}


def fed_sep():
    cal = get("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm").text
    L = sorted(set(re.findall(r"fomcprojtabl(\d{8})\.htm", cal)))
    if not L:
        raise RuntimeError("sem projeções do Fed no calendário")
    s = get(f"https://www.federalreserve.gov/monetarypolicy/fomcprojtabl{L[-1]}.htm").content.decode("utf-8-sig", "ignore")
    t = s[s.find("<table"):s.find("</table>", s.find("<table"))]
    rows = []
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
        rows.append([html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)])
    anos = None
    for r in rows:
        if r and r[0][:4].isdigit():
            anos = r
            break
    n = (len(anos) // 3) if anos else 5
    anos = anos[:n] if anos else []
    MAP = {"Change in real GDP": "pib", "Unemployment rate": "desemp", "PCE inflation": "pce",
           "Core PCE inflation": "core", "Federal funds rate": "ffr"}
    lin, ant, ultimo = {}, {}, None
    for r in rows:
        if not r:
            continue
        nome = re.sub(r"\d+$", "", r[0]).strip()
        val = lambda x: [num(v) if v else None for v in x[1:1 + n]]  # noqa: E731
        if nome in MAP:
            ultimo = MAP[nome]
            lin[ultimo] = val(r)
        elif ultimo and nome.lower().endswith("projection"):
            ant[ultimo] = val(r)
            ant["nome"] = nome
    d = L[-1]
    return {"data": f"{d[:4]}-{d[4:6]}-{d[6:]}", "anos": [a.replace("Longer run", "Longo prazo") for a in anos],
            "mediana": lin, "anterior": {k: v for k, v in ant.items() if k != "nome"},
            "fonte": "Federal Reserve — Summary of Economic Projections (mediana das projeções dos dirigentes)"}


def dolar_global():
    s = get("https://www.federalreserve.gov/releases/h10/summary/jrxwtfb_nb.htm", timeout=120).text
    out = []
    for d, v in re.findall(r"<t[hd][^>]*>\s*(\d{1,2}-[A-Z]{3}-\d{2})\s*</t[hd]>\s*<t[hd][^>]*>\s*([\d.]+)\s*</t[hd]>", s):
        try:
            out.append([dt.datetime.strptime(d.title(), "%d-%b-%y").date().isoformat(), float(v)])
        except Exception:  # noqa: BLE001
            pass
    if len(out) < 1000:
        raise RuntimeError(f"índice do dólar: só {len(out)} linhas")
    return {"s": sorted(out), "fonte": "Federal Reserve (H.10) — índice amplo nominal do dólar (jan/2006 = 100)"}


MES = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def brent():
    s = get("https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=RBRTE&f=D", timeout=120).content.decode("latin1")
    out = []
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", s, re.S | re.I):
        c = [html.unescape(re.sub(r"<[^>]+>", "", x)).replace("\xa0", " ").strip() for x in re.findall(r"<td[^>]*>(.*?)</td>", r, re.S | re.I)]
        if len(c) < 6:
            continue
        m = re.match(r"(\d{4})\s+([A-Z][a-z]{2})-\s*(\d{1,2})\s+to", c[0])
        if not m:
            continue
        ini = dt.date(int(m.group(1)), MES[m.group(2)], int(m.group(3)))
        if ini.year < 2006:
            continue
        for k in range(5):
            try:
                out.append([(ini + dt.timedelta(days=k)).isoformat(), float(c[1 + k])])
            except Exception:  # noqa: BLE001
                pass
    if len(out) < 1000:
        raise RuntimeError(f"Brent: só {len(out)} linhas")
    return {"s": out, "fonte": "U.S. Energy Information Administration (EIA) — Brent à vista, US$ por barril"}


def main(ent, sai):
    os.makedirs(sai, exist_ok=True)
    velho = ler(os.path.join(ent, "macro.json"), {})
    out = {}
    out["focus"] = parte("focus", focus, velho)
    out["br"] = parte("br", brasil, velho)
    out["cm"] = parte("cm", prazo_constante, velho)
    out["us"] = parte("us", bls, velho)
    out["fed"] = parte("fed", fed_sep, velho)
    out["dxy"] = parte("dxy", dolar_global, velho)
    out["brent"] = parte("brent", brent, velho)
    out["ts"] = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    out["diag"] = DIAG
    with open(os.path.join(sai, "macro.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    log("macro.json:", os.path.getsize(os.path.join(sai, "macro.json")) // 1024, "KB; falhas:", list(DIAG))
    if sum(1 for k in ("focus", "br", "cm", "us", "fed", "dxy", "brent") if out.get(k)) < 4:
        raise SystemExit("coletas demais falharam")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
