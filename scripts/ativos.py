"""Robô do módulo de ativos (ações, units, FIIs, Fiagros, ETFs e BDRs) — só dados oficiais.

B3: cotações históricas (COTAHIST), proventos, desdobramentos e grupamentos, cadastro das empresas e BDRs.
CVM: balanços (DFP e ITR), composição do capital, vínculo ticker–CNPJ (FCA) e informe mensal dos FIIs.
BCB/B3: CDI, IPCA, dólar, Ibovespa e IFIX.

Uso: python scripts/ativos.py ENTRADA SAIDA
"""
import base64
import bisect
import csv
import datetime as dt
import io
import json
import math
import os
import re
import sys
import time
import zipfile
from array import array

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fundos as FU  # noqa: E402  (baixar, sgs, b3_indice, indices)

ANO0 = 2005
INICIO = time.time()
LIMITE = INICIO + float(os.environ.get("MINUTOS", "48")) * 60
HOJE = dt.date.today()
UA = FU.UA
URL_COTAHIST = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A{}.ZIP"
B3 = "https://sistemaswebb3-listados.b3.com.br/"
URL_FII = "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_{}.zip"
URL_DFP = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_{}.zip"
URL_ITR = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_{}.zip"
URL_FCA = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_{}.zip"
BDI_OK = {"02", "05", "06", "07", "08", "12", "13", "14", "34", "35", "36"}
DIAG = {}


def log(*a):
    print(f"[{time.time() - INICIO:6.0f}s]", *a, flush=True)


def b64(d):
    return base64.b64encode(json.dumps(d).encode()).decode()


def num(s):
    return FU.num(s)


def norm(s):
    return FU.norm(s)


def dbr(s):
    """dd/mm/aaaa -> aaaa-mm-dd"""
    s = (s or "").strip()
    return f"{s[6:10]}-{s[3:5]}-{s[:2]}" if re.match(r"\d\d/\d\d/\d{4}$", s) else None


def b3get(path, par, tent=3):
    for t in range(tent):
        try:
            r = requests.get(B3 + path + "/" + b64(par), headers=UA, timeout=(10, 40))
            if r.status_code == 404:
                return None
            r.raise_for_status()
            txt = r.text.strip()
            time.sleep(0.25)
            return json.loads(txt) if txt and txt != "null" else None
        except Exception as e:  # noqa: BLE001
            if t == tent - 1:
                DIAG.setdefault("b3_erros", []).append(f"{path}: {str(e)[:80]}")
            time.sleep(2 + 3 * t)
    return None


# ------------------------------------------------------------------ cotações

class Ativo:
    __slots__ = ("t", "i", "c", "vol", "neg", "meta", "ev", "fii", "liq")

    def __init__(self, t):
        self.t = t
        self.i = array("i")
        self.c = array("d")
        self.vol = {}      # AAAAMM -> volume financeiro
        self.neg = {}      # AAAAMM -> dias com negócio
        self.meta = {}
        self.ev = []       # [data_com, tipo, valor] tipo: D dividendo, J JCP, R rendimento, E estimado (CVM), S multiplicador de ações
        self.fii = None
        self.liq = None


CAL, CALIX, A = [], {}, {}


def ler_cotahist(ano, filtro=None):
    """Linhas do mercado à vista: [(data, ticker, bdi, nome, especificação, fechamento, volume, negócios, isin)]."""
    r = FU.baixar(URL_COTAHIST.format(ano), aceita_404=True, timeout=(15, 600))
    if r is None:
        return None
    z = zipfile.ZipFile(io.BytesIO(r.content))
    out = []
    with z.open(z.namelist()[0]) as f:
        for raw in f:
            if raw[:2] != b"01" or raw[24:27] != b"010":
                continue
            bdi = raw[10:12].decode()
            if bdi not in BDI_OK:
                continue
            L = raw.decode("latin-1")
            t = L[12:24].strip()
            if filtro is not None and t not in filtro:
                continue
            esp = L[39:49].strip()
            if esp.startswith(("IBO", "DIR", "BNS", "REC", "FID", "TPR")):
                continue
            fat = int(L[210:217] or 1) or 1
            close = int(L[108:121]) / 100 / fat
            if close <= 0:
                continue
            d = f"{L[2:6]}-{L[6:8]}-{L[8:10]}"
            out.append((d, t, bdi, L[27:39].strip(), esp, close, int(L[170:188]) / 100, int(L[147:152]), L[230:242].strip()))
    out.sort()
    return out


def aplicar_ano(linhas, ativos):
    cont = {}
    for x in linhas:
        cont[x[0]] = cont.get(x[0], 0) + 1
    for d in sorted(cont):
        if cont[d] >= 30 and d not in CALIX and (not CAL or d > CAL[-1]):
            CALIX[d] = len(CAL)
            CAL.append(d)
    for d, t, bdi, nome, esp, close, vol, neg, isin in linhas:
        if t not in ativos:
            continue
        a = A.get(t)
        if a is None:
            a = A[t] = Ativo(t)
        a.meta.update(bdi=bdi, nr=nome, esp=esp, isin=isin)
        ym = d[:4] + d[5:7]
        a.vol[ym] = a.vol.get(ym, 0.0) + vol
        a.neg[ym] = a.neg.get(ym, 0) + 1
        ix = CALIX.get(d)
        if ix is None or (len(a.i) and ix <= a.i[-1]):
            continue
        a.i.append(ix)
        a.c.append(close)


def cortar(n):
    global CAL
    if n >= len(CAL):
        return
    for d in CAL[n:]:
        CALIX.pop(d, None)
    corte = CAL[n][:4] + CAL[n][5:7]
    CAL = CAL[:n]
    for a in A.values():
        p = bisect.bisect_left(a.i, n)
        del a.i[p:]
        del a.c[p:]
        for k in [k for k in a.vol if k >= corte]:
            a.vol.pop(k, None)
            a.neg.pop(k, None)


def tipo_de(meta):
    bdi, esp, nome = meta.get("bdi"), meta.get("esp", ""), norm(meta.get("nr", ""))
    if bdi in ("34", "35"):
        return "BDR"
    if bdi == "36":
        return "BDR de ETF"
    if bdi == "12":
        return "FII"
    if bdi in ("13", "14"):
        if nome.startswith("fiagro") or "agro" in nome[:12]:
            return "Fiagro"
        if nome.startswith("fii"):
            return "FII"
        if "infra" in nome or nome.startswith(("fi-i", "fic in")):
            return "FI-Infra"
        return "ETF"
    if esp.startswith("UNT"):
        return "Unit"
    return "Ação"


# ------------------------------------------------------------------ Tesouro Direto (Tesouro Transparente)

URL_TD = ("https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3"
          "/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv")
TD_NOMES = {"tesouro selic": ("SELIC", "Tesouro Selic"), "tesouro prefixado": ("PRE", "Tesouro Prefixado"),
            "tesouro prefixado com juros semestrais": ("PREJ", "Tesouro Prefixado com Juros Semestrais"),
            "tesouro ipca+": ("IPCA", "Tesouro IPCA+"), "tesouro ipca+ com juros semestrais": ("IPCAJ", "Tesouro IPCA+ com Juros Semestrais"),
            "tesouro renda+ aposentadoria extra": ("RENDA", "Tesouro RendA+"), "tesouro educa+": ("EDUCA", "Tesouro Educa+")}


def tesouro_direto():
    """Títulos à venda: preço de resgate diário (PU venda manhã) desde o lançamento e cupons semestrais como proventos."""
    r = FU.baixar(URL_TD, timeout=(15, 300))
    try:
        txt = r.content.decode("utf-8")
    except UnicodeDecodeError:
        txt = r.content.decode("latin-1")
    linhas = list(csv.reader(io.StringIO(txt), delimiter=";"))
    cab = [norm(c) for c in linhas[0]]
    ix = lambda *n: next(cab.index(x) for x in n if x in cab)  # noqa: E731
    c_t, c_v, c_d = ix("tipo titulo"), ix("data vencimento"), ix("data base")
    c_pv, c_pb = ix("pu venda manha"), ix("pu base manha")
    ser = {}
    for L in linhas[1:]:
        if len(L) <= max(c_t, c_v, c_d, c_pv, c_pb):
            continue
        tp = TD_NOMES.get(norm(L[c_t]))
        v, d = dbr(L[c_v]), dbr(L[c_d])
        if not tp or not v or not d or v <= HOJE.isoformat():
            continue
        pu = num(L[c_pv]) or num(L[c_pb])
        if pu:
            ser.setdefault((tp, v), {})[d] = pu
    ipca = {}
    try:
        for d, x in FU.sgs(433, dt.date(2000, 7, 1), HOJE):
            ipca[d[:7]] = x
    except Exception as e:  # noqa: BLE001
        DIAG["td_ipca"] = str(e)[:150]

    def vna(ano, mes):
        v, y, m = 1000.0, 2000, 7
        while (y, m) < (ano, mes):
            x = ipca.get(f"{y}-{m:02d}")
            if x is None:
                return None
            v *= 1 + x / 100
            m += 1
            if m > 12:
                y, m = y + 1, 1
        return v
    n = 0
    for ((code, nome), venc), pts in ser.items():
        ano_ref = int(venc[:4]) - (19 if code == "RENDA" else 4 if code == "EDUCA" else 0)
        t = f"TD-{code}-{ano_ref}"
        if t in A:
            t += "-" + venc[5:7]
        a = A[t] = Ativo(t)
        for d in sorted(pts):
            k = CALIX.get(d)
            if k is not None and (not len(a.i) or k > a.i[-1]):
                a.i.append(k)
                a.c.append(pts[d])
        if not len(a.i):
            del A[t]
            continue
        a.meta = {"td": 1, "nr": f"{nome} {ano_ref}", "esp": code, "venc": venc, "isin": "", "tipo": "Tesouro Direto"}
        # cupons semestrais (pagos no dia do cupom; o preço cai no mesmo dia)
        meses = []
        if code == "PREJ":
            meses = [1, 7]
        elif code == "IPCAJ":
            mv = int(venc[5:7])
            meses = sorted({mv, (mv + 5) % 12 + 1})
        d0 = CAL[a.i[0]]
        for ano in range(int(d0[:4]), HOJE.year + 1):
            for mm in meses:
                dia = 1 if code == "PREJ" else 15
                dc = f"{ano}-{mm:02d}-{dia:02d}"
                if dc <= d0 or dc > HOJE.isoformat() or dc > venc:
                    continue
                if code == "PREJ":
                    val = 1000 * (1.1 ** 0.5 - 1)
                else:
                    vv = vna(ano, mm)
                    if vv is None:
                        continue
                    val = vv * (1.06 ** 0.5 - 1)
                p = bisect.bisect_left(CAL, dc) - 1
                if p >= 0:
                    a.ev.append([CAL[p], "C", round(val, 6), dc])
        # RendA+ e Educa+: na fase de pagamentos, parcela mensal no dia 15. O valor da parcela é a queda do preço
        # nesse dia além da variação diária típica dos dias anteriores (o Tesouro Transparente só publica o PU).
        if code in ("RENDA", "EDUCA"):
            pos = {k: j for j, k in enumerate(a.i)}
            for ano in range(ano_ref, HOJE.year + 1):
                for mm in range(1, 13):
                    dc = f"{ano}-{mm:02d}-15"
                    if dc <= d0 or dc > HOJE.isoformat() or dc > venc:
                        continue
                    p = bisect.bisect_left(CAL, dc)
                    j = pos.get(p)
                    if j is None or j < 6 or pos.get(p - 1) != j - 1:
                        continue
                    rs = sorted(a.c[q] / a.c[q - 1] - 1 for q in range(max(1, j - 11), j))
                    g = rs[len(rs) // 2] if rs else 0
                    queda = a.c[j - 1] * (1 + g) - a.c[j]
                    if queda > a.c[j - 1] * 0.002:
                        a.ev.append([CAL[a.i[j - 1]], "C", round(queda, 6), CAL[p]])
        n += 1
    log("Tesouro Direto:", n, "títulos à venda")


# ------------------------------------------------------------------ estado

def carregar(ent):
    global CAL, CALIX
    est = FU.ler_json(os.path.join(ent, "estado.json"), {})
    CAL = FU.ler_json(os.path.join(ent, "cal.json"), {}).get("d", [])
    CALIX = {d: i for i, d in enumerate(CAL)}
    pa = os.path.join(ent, "a")
    if os.path.isdir(pa):
        for nome in os.listdir(pa):
            j = FU.ler_json(os.path.join(pa, nome), None)
            if not j:
                continue
            a = Ativo(j["t"])
            i0 = j.get("i0")
            for k, v in enumerate(j.get("c") or []):
                if v is not None:
                    a.i.append(i0 + k)
                    a.c.append(v)
            m0 = j.get("vm0")
            if m0:
                for k, (v, n) in enumerate(zip(j.get("vol") or [], j.get("neg") or [])):
                    ym = FU.ym_add(m0, k)
                    if v:
                        a.vol[ym] = v
                    if n:
                        a.neg[ym] = n
            a.meta = j.get("meta") or {}
            a.ev = [list(e) for e in j.get("evc") or []]
            fi = j.get("fii")
            if fi and isinstance(fi.get("m"), list):
                m0 = fi.get("m0")
                fi = dict(fi, m={FU.ym_add(m0, k): v for k, v in enumerate(fi["m"]) if v})
                fi.pop("m0", None)
            a.fii = fi
            A[a.t] = a
    emp = FU.ler_json(os.path.join(ent, "emp.json"), {})
    log("estado:", len(A), "ativos,", len(CAL), "pregões,", len(emp), "emissores")
    return est, emp


# ------------------------------------------------------------------ proventos (B3)

SUF = {"ON": "3", "PN": "4", "PNA": "5", "PNB": "6", "PNC": "7", "PND": "8", "UNT": "11", "UNIT": "11"}


def add_ev(a, data, tipo, valor, pag=None):
    if not data or valor is None or valor <= 0:
        return
    for e in a.ev:
        if e[0] == data and e[1] == tipo and abs(e[2] - valor) < 1e-9:
            if pag and len(e) < 4:
                e.append(pag)
            return
    a.ev.append([data, tipo, round(valor, 10)] + ([pag] if pag else []))


def tipo_prov(label):
    l = norm(label)
    if "jrs" in l or "juros" in l:
        return "J"
    if "rendimento" in l:
        return "R"
    if "amortiz" in l or "restitu" in l:
        return "A"
    return "D"


def eventos_supl(cash, stock, por_isin, por_cod=None):
    for x in cash or []:
        a = por_isin.get((x.get("isinCode") or x.get("assetIssued") or "").strip())
        if a is not None:
            add_ev(a, dbr(x.get("lastDatePrior")), tipo_prov(x.get("label")), num(x.get("rate")), dbr(x.get("paymentDate")))
    for x in stock or []:
        a = por_isin.get((x.get("isinCode") or "").strip())
        lab, f = norm(x.get("label")), num(x.get("factor"))
        if a is None or not f:
            continue
        if "grupamento" in lab:
            m = f
        elif "desdobramento" in lab or "bonificacao" in lab:
            m = 1 + f / 100
        else:
            continue
        if m > 0 and abs(m - 1) > 1e-9:
            dc = dbr(x.get("lastDatePrior"))
            if dc and not any(e[0] == dc and e[1] == "S" for e in a.ev):
                a.ev.append([dc, "S", round(m, 10)])


def atualizar_empresa(cod, info, tickers, por_isin):
    """Cadastro, ações em circulação e proventos de um emissor (B3)."""
    s = b3get("listedCompaniesProxy/CompanyCall/GetListedSupplementCompany", {"issuingCompany": cod, "language": "pt-br"})
    if isinstance(s, list) and s:
        s = s[0]
    if not isinstance(s, dict):
        return False
    info["tn"] = (s.get("tradingName") or "").strip()
    info["on"] = num(s.get("numberCommonShares"))
    info["pn"] = num(s.get("numberPreferredShares"))
    info["seg"] = s.get("segment")
    cvm = s.get("codeCVM")
    eventos_supl(s.get("cashDividends"), s.get("stockDividends"), por_isin)
    if cvm and not info.get("setor"):
        d = b3get("listedCompaniesProxy/CompanyCall/GetDetail", {"codeCVM": str(cvm), "language": "pt-br"})
        if isinstance(d, dict):
            info["nome"] = d.get("companyName")
            info["cnpj"] = re.sub(r"\D", "", d.get("cnpj") or "")
            ic = [x.strip() for x in (d.get("industryClassification") or "").split("/")]
            if ic and ic[0]:
                info["setor"], info["sub"], info["sseg"] = (ic + ["", "", ""])[:3]
            info["site"] = d.get("website")
            info["mkt"] = d.get("market")
    if not info.get("hist") and info.get("tn"):
        pg, tot = 1, 1
        while pg <= tot and pg <= 20:
            j = b3get("listedCompaniesProxy/CompanyCall/GetListedCashDividends",
                      {"language": "pt-br", "pageNumber": pg, "pageSize": 120, "tradingName": info["tn"]})
            if not isinstance(j, dict):
                break
            tot = (j.get("page") or {}).get("totalPages") or 0
            for x in j.get("results") or []:
                t = cod + SUF.get((x.get("typeStock") or "").strip().upper(), "?")
                a = A.get(t)
                q = num(x.get("quotedPerShares")) or 1
                v = num(x.get("valueCash"))
                if a is not None and v:
                    add_ev(a, dbr(x.get("lastDatePriorEx")), tipo_prov(x.get("corporateAction")), v / q)
            pg += 1
        info["hist"] = 1
    info["t"] = HOJE.isoformat()
    return True


def atualizar_fundo_listado(cod, info, por_isin):
    s = b3get("fundsProxy/fundsCall/GetListedSupplementFunds", {"cnpj": "0", "identifierFund": cod, "typeFund": 7})
    if not isinstance(s, dict):
        return False
    info["nome"] = (s.get("fund") or "").strip()
    info["cotas"] = num(s.get("quantity"))
    info["adm"] = (s.get("ifd") or "").strip()
    eventos_supl(s.get("cashDividends"), s.get("stockDividends"), por_isin)
    info["t"] = HOJE.isoformat()
    return True


def bdrs():
    out, pg, tot = {}, 1, 1
    while pg <= tot and pg <= 15:
        j = b3get("listedCompaniesProxy/CompanyCall/GetCompaniesBDR", {"language": "pt-br", "pageNumber": pg, "pageSize": 120})
        if not isinstance(j, dict):
            break
        tot = (j.get("page") or {}).get("totalPages") or 0
        for x in j.get("results") or []:
            out[x.get("issuingCompany")] = {"nome": x.get("companyName"), "setor": x.get("sector"), "sub": x.get("subSector"),
                                            "sseg": x.get("segment"), "cat": x.get("describleCategoryBVMF")}
        pg += 1
    return out


# ------------------------------------------------------------------ CVM: FIIs

def fii_cvm(anos, por_isin):
    """Informe mensal dos FIIs: PL, cotistas, valor patrimonial da cota e rendimento do mês."""
    lidos = 0
    # quando o ISIN do informe não bate com o da B3 (classes novas, dígito de controle diferente), usa a raiz do código
    raiz = {}
    for isin, a in por_isin.items():
        if isin and len(isin) >= 6 and a.meta.get("tipo") in ("FII", "Fiagro", "FI-Infra"):
            raiz.setdefault(isin[2:6], []).append(a)
    raiz = {k: v[0] for k, v in raiz.items() if len(v) == 1}
    for ano in anos:
        try:
            r = FU.baixar(URL_FII.format(ano), aceita_404=True)
        except Exception as e:  # noqa: BLE001
            DIAG[f"fii_{ano}"] = str(e)[:150]
            continue
        if r is None:
            continue
        z = zipfile.ZipFile(io.BytesIO(r.content))
        geral, comp = {}, {}
        for n in z.namelist():
            if "geral" in n or "complemento" in n:
                for L in FU.ler_csv(z.open(n)):
                    k = (L.get("CNPJ_Fundo_Classe") or L.get("CNPJ_Fundo") or "", (L.get("Data_Referencia") or "")[:7])
                    (geral if "geral" in n else comp)[k] = L
        for k, g in geral.items():
            isin = (g.get("Codigo_ISIN") or "").strip()
            a = por_isin.get(isin) or (raiz.get(isin[2:6]) if len(isin) >= 6 else None)
            if a is None:
                continue
            c = comp.get(k) or {}
            f = a.fii = a.fii or {"m": {}}
            ym = k[1].replace("-", "")
            col = lambda *nomes: next((num(c.get(x)) for x in c if any(p.lower() in x.lower() for p in nomes) and num(c.get(x)) is not None), None)  # noqa: E731
            f["m"][ym] = [col("Valor_Patrimonial_Cota"), col("Patrimonio_Liquido"), num(c.get("Total_Numero_Cotistas")),
                          col("Dividend_Yield"), col("Rentabilidade_Efetiva"), col("Amortizacao")]
            f.update(cnpj=re.sub(r"\D", "", k[0]), nome=(g.get("Nome_Fundo_Classe") or g.get("Nome_Fundo") or "").strip(),
                     seg=g.get("Segmento_Atuacao"), mand=g.get("Mandato"), gest=g.get("Tipo_Gestao"),
                     adm=g.get("Nome_Administrador"), pub=g.get("Publico_Alvo"), ini=g.get("Data_Funcionamento"),
                     cotas=num(g.get("Quantidade_Cotas_Emitidas")))
            lidos += 1
    log("FIIs CVM:", lidos, "registros")


# ------------------------------------------------------------------ CVM: balanços

def ler_dfs(z, nome_parte, anual):
    """Contas por CNPJ e data: {cnpj: {data_fim: {conta: (descrição, valor)}}} (consolidado; individual se não houver)."""
    res = {}
    for tipo in ("con", "ind"):
        nomes = [n for n in z.namelist() if f"_{nome_parte}_{tipo}_" in n]
        if not nomes:
            continue
        for L in FU.ler_csv(z.open(nomes[0])):
            if L.get("ORDEM_EXERC", "").upper() not in ("ÚLTIMO", "ULTIMO"):
                continue
            k = re.sub(r"\D", "", L.get("CNPJ_CIA", ""))
            if tipo == "ind" and k in res and res[k].get("_t") == "con":
                continue
            ini, fim = L.get("DT_INI_EXERC", ""), L.get("DT_FIM_EXERC", "")
            if nome_parte == "DRE" and ini:
                meses = (int(fim[:4]) - int(ini[:4])) * 12 + int(fim[5:7]) - int(ini[5:7]) + 1
                if anual and meses < 10:
                    continue
                if not anual and meses != 3:
                    continue
            esc = 1000 if (L.get("ESCALA_MOEDA") or "").upper().startswith("MIL") else 1
            d = res.setdefault(k, {"_t": tipo})
            if d["_t"] != tipo:
                continue
            d.setdefault(fim, {})[L.get("CD_CONTA", "")] = (norm(L.get("DS_CONTA")), (num(L.get("VL_CONTA")) or 0) * esc)
    return res


def contas_dre(c):
    def g(cod):
        return c.get(cod, (None, None))[1]
    rec = g("3.01")
    ebit = None
    for cod, (ds, v) in c.items():
        if cod.count(".") == 1 and "antes do resultado financeiro" in (ds or ""):
            ebit = v
    ll = None
    cand = sorted([(len(cod), cod, v) for cod, (ds, v) in c.items() if "atribuido a socios da empresa controladora" in (ds or "")
                   or "atribuido aos socios da empresa controladora" in (ds or "")])
    if cand:
        ll = cand[0][2]
    else:
        nivel = [(cod, v) for cod, (ds, v) in c.items() if cod.count(".") == 1 and ds and ("lucro" in ds or "prejuizo" in ds) and "periodo" in ds]
        if nivel:
            ll = sorted(nivel, key=lambda x: [int(p) for p in x[0].split(".")])[-1][1]
    return rec, ebit, ll


def contas_bp(ca, cp):
    g = lambda c, cod: c.get(cod, (None, None))[1]  # noqa: E731
    at = g(ca, "1")
    cx = sum(v for cod, (ds, v) in ca.items() if cod in ("1.01.01", "1.01.02") and v)
    pl = None
    for cod, (ds, v) in cp.items():
        if cod.count(".") == 1 and ds and "patrimonio liquido" in ds:
            pl = v
    minor = sum(v for cod, (ds, v) in cp.items() if cod.count(".") == 2 and ds and "nao controladores" in ds and v)
    div = sum(v for cod, (ds, v) in cp.items() if cod in ("2.01.04", "2.02.01") and ds and "emprestimos" in ds and v)
    return at, cx or None, (pl - minor) if pl is not None else None, div


def capital(z):
    out = {}
    nomes = [n for n in z.namelist() if "composicao_capital" in n]
    if not nomes:
        return out
    for L in FU.ler_csv(z.open(nomes[0])):
        k = re.sub(r"\D", "", L.get("CNPJ_CIA", ""))
        d = L.get("DT_REFER", "")
        on = (num(L.get("QT_ACAO_ORDIN_CAP_INTEGR")) or 0) - (num(L.get("QT_ACAO_ORDIN_TESOURO")) or 0)
        pn = (num(L.get("QT_ACAO_PREF_CAP_INTEGR")) or 0) - (num(L.get("QT_ACAO_PREF_TESOURO")) or 0)
        if k not in out or d > out[k][0]:
            out[k] = (d, on, pn)
    return out


def balancos(est, fund):
    """Atualiza {cnpj: {"a": {ano: [...]}, "q": {aaaa-mm-dd: [...]}, "bp": {...}, "cap": [...]}} com DFP e ITR."""
    feitos = set(est.get("dfp_feitos", []))
    anos = list(range(HOJE.year - 10, HOJE.year))
    for ano in anos:
        chave = f"dfp{ano}"
        if chave in feitos and ano < HOJE.year - 1:
            continue
        if time.time() > LIMITE - 300:
            break
        try:
            r = FU.baixar(URL_DFP.format(ano), aceita_404=True)
            if r is None:
                continue
            z = zipfile.ZipFile(io.BytesIO(r.content))
            dre, bpa, bpp = ler_dfs(z, "DRE", True), ler_dfs(z, "BPA", True), ler_dfs(z, "BPP", True)
            for k, porfim in dre.items():
                for fim, c in porfim.items():
                    if fim == "_t":
                        continue
                    rec, ebit, ll = contas_dre(c)
                    at, cx, pl, div = contas_bp((bpa.get(k) or {}).get(fim, {}), (bpp.get(k) or {}).get(fim, {}))
                    fund.setdefault(k, {}).setdefault("a", {})[fim[:4]] = [rec, ebit, ll, pl, at, cx, div, fim]
            for k, v in capital(z).items():
                f = fund.setdefault(k, {})
                if not f.get("cap") or v[0] > f["cap"][0]:
                    f["cap"] = list(v)
            feitos.add(chave)
            log("DFP", ano, "ok")
        except Exception as e:  # noqa: BLE001
            DIAG[f"dfp_{ano}"] = str(e)[:150]
    for ano in range(HOJE.year - 2, HOJE.year + 1):
        chave = f"itr{ano}"
        if chave in feitos and ano < HOJE.year - 1:
            continue
        if time.time() > LIMITE - 240:
            break
        try:
            r = FU.baixar(URL_ITR.format(ano), aceita_404=True)
            if r is None:
                continue
            z = zipfile.ZipFile(io.BytesIO(r.content))
            dre, bpa, bpp = ler_dfs(z, "DRE", False), ler_dfs(z, "BPA", False), ler_dfs(z, "BPP", False)
            for k, porfim in dre.items():
                for fim, c in porfim.items():
                    if fim == "_t":
                        continue
                    rec, ebit, ll = contas_dre(c)
                    fund.setdefault(k, {}).setdefault("q", {})[fim] = [rec, ebit, ll]
            for k, porfim in bpp.items():
                for fim in porfim:
                    if fim == "_t":
                        continue
                    at, cx, pl, div = contas_bp((bpa.get(k) or {}).get(fim, {}), porfim[fim])
                    f = fund.setdefault(k, {})
                    if not f.get("bp") or fim > f["bp"][-1]:
                        f["bp"] = [at, cx, pl, div, fim]
            for k, v in capital(z).items():
                f = fund.setdefault(k, {})
                if not f.get("cap") or v[0] > f["cap"][0]:
                    f["cap"] = list(v)
            feitos.add(chave)
            log("ITR", ano, "ok")
        except Exception as e:  # noqa: BLE001
            DIAG[f"itr_{ano}"] = str(e)[:150]
    est["dfp_feitos"] = sorted(feitos)


def ltm(f):
    """Receita, EBIT e lucro dos últimos 12 meses (4 trimestres; o 4º trimestre sai do anual menos os 9 meses)."""
    q = dict((f.get("q") or {}).items())
    for ano, v in (f.get("a") or {}).items():
        fim = v[7]
        if fim[5:7] != "12":
            continue
        tri = [q.get(f"{ano}-03-31"), q.get(f"{ano}-06-30"), q.get(f"{ano}-09-30")]
        if all(tri) and f"{ano}-12-31" not in q:
            q[f"{ano}-12-31"] = [None if v[j] is None or any(t[j] is None for t in tri) else v[j] - sum(t[j] for t in tri) for j in range(3)]
    ks = sorted(q)[-4:]
    if len(ks) == 4:
        d0 = dt.date.fromisoformat(ks[0])
        d3 = dt.date.fromisoformat(ks[-1])
        if 250 <= (d3 - d0).days <= 300:
            return [None if any(q[k][j] is None for k in ks) else sum(q[k][j] for k in ks) for j in range(3)], ks[-1]
    an = sorted((f.get("a") or {}).items())
    if an:
        return an[-1][1][:3], an[-1][1][7]
    return None, None


# ------------------------------------------------------------------ cálculo

def ajustes(a):
    """Eventos com índice do pregão ex e multiplicador dos preços anteriores (para a série com proventos)."""
    out = []
    if not len(a.i):
        return out
    for e in sorted(a.ev, key=lambda e: e[0]):
        dc, tp, v = e[0], e[1], e[2]
        ix_ex = bisect.bisect_right(CAL, dc)
        if ix_ex >= len(CAL) or ix_ex <= a.i[0]:
            continue
        p = bisect.bisect_left(a.i, ix_ex) - 1
        if p < 0:
            continue
        pc = a.c[p]
        if tp == "S":
            if abs(v - 1) > 0.15:
                # confere com o salto de preço entre o último pregão "com" e o primeiro "ex"
                q = bisect.bisect_left(a.i, ix_ex)
                if q >= len(a.i) or a.i[q] - ix_ex > 10:
                    continue
                r = a.c[q] / pc
                if abs(math.log(r * v)) > abs(math.log(r)):
                    continue
            f = 1 / v
        else:
            # valor do provento em termos da cota da época (desfaz desdobramentos posteriores não refletidos)
            if v >= pc * 0.5:
                continue
            f = 1 - v / pc
        out.append([ix_ex, f, tp, v, dc])
    # desdobramentos e grupamentos sem registro: saltos de preço com razão próxima de um número redondo
    tem = {e[0] for e in out if e[2] == "S"}
    for j in range(1, len(a.i)):
        r = a.c[j] / a.c[j - 1]
        if (r < 0.55 or r > 1.9) and not any(a.i[j - 1] < t_ <= a.i[j] for t_ in tem) and a.i[j] - a.i[j - 1] <= 10:
            m = 1 / r
            for alvo in (2, 3, 4, 5, 8, 10, 20, 25, 50, 100, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 10, 1 / 20, 1 / 50, 1 / 100):
                if abs(m / alvo - 1) < 0.12:
                    out.append([a.i[j], 1 / alvo, "S*", alvo, CAL[a.i[j - 1]]])
                    break
    out.sort()
    return out


def serie_ajustada(a, adj):
    f = [1.0] * len(a.i)
    acc = 1.0
    k = len(adj) - 1
    for j in range(len(a.i) - 1, -1, -1):
        while k >= 0 and adj[k][0] > a.i[j]:
            acc *= adj[k][1]
            k -= 1
        f[j] = acc
    return [a.c[j] * f[j] for j in range(len(a.i))]


def metricas(a, adj, ibov, cdi):
    out = {}
    if len(a.i) < 2:
        return out
    q = serie_ajustada(a, adj)
    il, dl = a.i[-1], CAL[a.i[-1]]

    def em(d):
        p = bisect.bisect_right(a.i, bisect.bisect_right(CAL, d) - 1) - 1
        return p
    for n, k in ((1, "r1m"), (12, "r12"), (24, "r24"), (36, "r36"), (60, "r60")):
        alvo = FU.data_menos_meses(dl, n)
        if CAL[a.i[0]] <= alvo:
            p = em(alvo)
            if p >= 0:
                out[k] = (q[-1] / q[p] - 1) * 100
                if n == 12:
                    out["_p12"] = p
    pa = em(f"{int(dl[:4]) - 1}-12-31")
    if pa >= 0 and CAL[a.i[pa]][:4] == str(int(dl[:4]) - 1):
        out["ra"] = (q[-1] / q[pa] - 1) * 100
    if len(a.i) > 1 and a.i[-1] - a.i[-2] <= 5:
        out["d1"] = (a.c[-1] / a.c[-2] - 1) * 100 if not any(e[0] == a.i[-1] for e in adj) else (q[-1] / q[-2] - 1) * 100
    p12 = out.pop("_p12", None)
    if p12 is not None:
        R, X = [], []
        for j in range(p12 + 1, len(q)):
            if a.i[j] - a.i[j - 1] > 5:
                continue
            r = q[j] / q[j - 1] - 1
            R.append(r)
            b0, b1 = ibov[a.i[j - 1]] if ibov else None, ibov[a.i[j]] if ibov else None
            X.append(b1 / b0 - 1 if b0 and b1 else None)
        if len(R) > 120:
            mu = sum(R) / len(R)
            v = math.sqrt(sum((x - mu) ** 2 for x in R) / (len(R) - 1)) * math.sqrt(252)
            out["v12"] = v * 100
            xs = [(x, y) for x, y in zip(X, R) if x is not None]
            if len(xs) > 100:
                mx = sum(x for x, _ in xs) / len(xs)
                my = sum(y for _, y in xs) / len(xs)
                sxy = sum((x - mx) * (y - my) for x, y in xs)
                sxx = sum((x - mx) ** 2 for x, _ in xs)
                out["beta"] = sxy / sxx if sxx else None
            if cdi and v > 1e-4:
                c = 1.0
                for j in range(a.i[p12] + 1, il + 1):
                    c *= 1 + (cdi[j] or 0) / 100
                out["sh"] = ((1 + out["r12"] / 100) - c) / v
    alvo = FU.data_menos_meses(dl, 36)
    p = bisect.bisect_left(a.i, bisect.bisect_left(CAL, alvo))
    pico, dd = 0.0, 0.0
    for j in range(p, len(q)):
        if q[j] > pico:
            pico = q[j]
        elif pico:
            dd = min(dd, q[j] / pico - 1)
    out["dd"] = dd * 100
    # proventos em 12 meses por ação (em valores de hoje, descontando desdobramentos posteriores)
    lim = FU.data_menos_meses(dl, 12)
    tot = 0.0
    for ix, f, tp, v, dc in adj:
        if tp in ("D", "J", "R", "E") and dc > lim:
            m = 1.0
            for ix2, f2, tp2, v2, dc2 in adj:
                if tp2.startswith("S") and ix2 > ix:
                    m *= f2
            tot += v * m
    out["prov12"] = tot
    out["dy"] = tot / a.c[-1] * 100 if a.c[-1] else None
    # liquidez média diária (últimos 3 meses)
    ms = sorted(a.vol)[-3:]
    dias = sum(1 for d in CAL[-70:] if d[:4] + d[5:7] in ms)
    if ms and dias:
        out["liq"] = sum(a.vol[m] for m in ms) / dias
    return out


# ------------------------------------------------------------------ principal

# ------------------------------------------------------------------ documentos (CVM e B3 Fundos.NET)

URL_IPE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_{}.zip"
FNET = ("https://fnet.bmfbovespa.com.br/fnet/publico/pesquisarGerenciadorDocumentosDados"
        "?d=1&s=0&l=40&o%5B0%5D%5BdataEntrega%5D=desc&cnpjFundo={}")
FNET_DOC = "https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id={}"
CAT_IPE = {"Fato Relevante", "Comunicado ao Mercado", "Aviso aos Acionistas", "Dados Econômico-Financeiros",
           "Calendário de Eventos Corporativos", "Assembleia", "Reunião da Administração", "Relatório Proventos",
           "Aviso aos Debenturistas", "Informações de Companhias em Recuperação Judicial ou Extrajudicial"}
DOCS_MAX = 60


def docs_companhias(cnpjs):
    """Fatos relevantes, comunicados, avisos e atas das companhias abertas (CVM, documentos IPE)."""
    out = {}
    for y in (HOJE.year, HOJE.year - 1):
        try:
            r = FU.baixar(URL_IPE.format(y), aceita_404=True)
        except Exception as e:  # noqa: BLE001
            DIAG[f"ipe_{y}"] = str(e)[:150]
            continue
        if r is None:
            continue
        z = zipfile.ZipFile(io.BytesIO(r.content))
        for n in z.namelist():
            for L in FU.ler_csv(z.open(n)):
                c = re.sub(r"\D", "", L.get("CNPJ_Companhia", ""))
                if c not in cnpjs or L.get("Categoria") not in CAT_IPE or not L.get("Link_Download"):
                    continue
                out.setdefault(c, []).append([L.get("Data_Entrega", ""), L.get("Data_Referencia", ""), L.get("Categoria", ""),
                                              (L.get("Tipo") or "").strip(), (L.get("Especie") or "").strip(),
                                              (L.get("Assunto") or "").strip()[:200], L["Link_Download"]])
    for c, v in out.items():
        vistos, lim = set(), []
        for d in sorted(v, key=lambda x: (x[0], x[1]), reverse=True):
            chave = (d[0], d[2], d[3], d[5])
            if chave in vistos:
                continue
            vistos.add(chave)
            lim.append(d)
        out[c] = lim[:DOCS_MAX]
    return out


def docs_fundos_listados(cnpjs):
    """Documentos dos FIIs, Fiagros e FI-Infra no Fundos.NET da B3 (fatos relevantes, avisos, relatórios)."""
    from concurrent.futures import ThreadPoolExecutor
    br = lambda s: (s[6:10] + "-" + s[3:5] + "-" + s[0:2]) if len(s or "") >= 10 else (s[3:7] + "-" + s[0:2] if len(s or "") == 7 else s or "")  # noqa: E731

    def um(c):
        if time.time() > LIMITE - 400:
            return c, None
        try:
            r = requests.get(FNET.format(c), headers={**UA, "X-Requested-With": "XMLHttpRequest"}, timeout=(10, 40))
            r.raise_for_status()
            ds = r.json().get("data") or []
        except Exception:  # noqa: BLE001
            return c, None
        v = []
        for d in ds:
            tipo = (d.get("tipoDocumento") or "").strip()
            if "Estruturado" in tipo or d.get("status") not in (None, "AC"):
                continue
            v.append([br((d.get("dataEntrega") or "")[:10]), br(d.get("dataReferencia") or ""), (d.get("categoriaDocumento") or "").strip(),
                      tipo, (d.get("especieDocumento") or "").strip(), "", FNET_DOC.format(d.get("id"))])
        return c, v[:DOCS_MAX]
    out = {}
    with ThreadPoolExecutor(6) as ex:
        for c, v in ex.map(um, sorted(cnpjs)):
            if v is not None:
                out[c] = v
    return out


def documentos(ent, sai, emp, fca):
    """Grava d/{cnpj}.json; devolve os códigos de emissor com documento novo nos últimos 3 dias."""
    cias, fiis = {}, {}
    for t, a in A.items():
        tp = a.meta.get("tipo")
        if tp in ("Ação", "Unit"):
            c = fca.get(t) or emp.get(t[:4], {}).get("cnpj")
            if c:
                cias.setdefault(c, set()).add(t[:4])
        elif tp in ("FII", "Fiagro", "FI-Infra") and a.fii and a.fii.get("cnpj"):
            fiis.setdefault(a.fii["cnpj"], set()).add(t[:4])
    pd_ = os.path.join(sai, "d")
    os.makedirs(pd_, exist_ok=True)
    velho = os.path.join(ent, "d")
    novos, recente = 0, (HOJE - dt.timedelta(days=3)).isoformat()
    ativos_cod = set()
    for fonte, mapa, func in (("CVM", cias, docs_companhias), ("B3 Fundos.NET", fiis, docs_fundos_listados)):
        try:
            res = func(set(mapa))
        except Exception as e:  # noqa: BLE001
            DIAG["docs_" + fonte] = str(e)[:200]
            res = {}
        for c in mapa:
            v = res.get(c)
            if v is None:                         # falhou agora: mantém o que já estava publicado
                j = FU.ler_json(os.path.join(velho, c + ".json"), None)
                if j:
                    FU.gravar(os.path.join(pd_, c + ".json"), j)
                continue
            FU.gravar(os.path.join(pd_, c + ".json"), {"cnpj": c, "fonte": fonte, "docs": v})
            novos += 1
            if any(d[0][:10] >= recente for d in v):
                ativos_cod |= mapa[c]
    log("documentos:", novos, "emissores;", len(ativos_cod), "com documento nos últimos 3 dias")
    return ativos_cod


def principal():
    ent, sai = sys.argv[1], sys.argv[2]
    est, emp = carregar(ent)
    ano = HOJE.year
    # 1) ano corrente: define quem está ativo (negociado nos últimos 30 pregões)
    atual = ler_cotahist(ano) or []
    datas = sorted({x[0] for x in atual})
    rec = set(datas[-30:])
    ativos = {x[1] for x in atual if x[0] in rec}
    if len(ativos) < 300:
        raise RuntimeError("COTAHIST do ano sem dados suficientes")
    for t in list(A):
        if t not in ativos:
            del A[t]
    log("ativos negociados:", len(ativos))
    # 2) anos anteriores, em ordem
    ate = est.get("ano_ate", ANO0 - 1)
    for y in range(ate + 1, ano):
        if time.time() > LIMITE - 900:
            break
        cortar(bisect.bisect_left(CAL, f"{y}-01-01"))
        linhas = ler_cotahist(y, ativos)
        if linhas:
            aplicar_ano(linhas, ativos)
        ate = y
        log("cotações", y, "ok:", len(linhas or []), "linhas")
    est["ano_ate"] = ate
    if ate == ano - 1:
        cortar(bisect.bisect_left(CAL, f"{ano}-01-01"))
        aplicar_ano(atual, ativos)
        log("cotações", ano, "ok")
    del atual
    try:
        tesouro_direto()
    except Exception as e:  # noqa: BLE001
        DIAG["tesouro_direto"] = str(e)[:200]
    por_isin = {a.meta.get("isin"): a for a in A.values() if a.meta.get("isin")}
    for a in A.values():
        a.meta["tipo"] = "Tesouro Direto" if a.meta.get("td") else tipo_de(a.meta)

    # 3) FIIs: informe mensal da CVM
    anos_fii = [str(y) for y in range(2016, ano + 1) if str(y) not in est.get("fii_feitos", []) or y >= ano - 1]
    fii_ant = {t: a.fii for t, a in A.items() if a.fii}
    fii_cvm(anos_fii, por_isin)
    est["fii_feitos"] = sorted(set(est.get("fii_feitos", [])) | {y for y in anos_fii if int(y) < ano - 1})
    del fii_ant

    # 4) balanços (CVM)
    fund = FU.ler_json(os.path.join(ent, "fund.json"), {})
    balancos(est, fund)
    fca = {}
    for y in (ano, ano - 1):
        try:
            r = FU.baixar(URL_FCA.format(y), aceita_404=True)
            if r is None:
                continue
            z = zipfile.ZipFile(io.BytesIO(r.content))
            n = next(x for x in z.namelist() if "valor_mobiliario" in x)
            for L in FU.ler_csv(z.open(n)):
                t = (L.get("Codigo_Negociacao") or "").strip().upper()
                if t and t not in fca:
                    fca[t] = re.sub(r"\D", "", L.get("CNPJ_Companhia", ""))
        except Exception as e:  # noqa: BLE001
            DIAG[f"fca_{y}"] = str(e)[:150]

    # 4b) documentos: fatos relevantes, comunicados e avisos (CVM e B3 Fundos.NET)
    try:
        com_docs = documentos(ent, sai, emp, fca)
    except Exception as e:  # noqa: BLE001
        DIAG["documentos"] = str(e)[:200]
        com_docs = set()

    # 5) proventos e cadastro na B3 (por emissor). Revisto a cada execução quem publicou documento
    #    nos últimos 3 dias ou tem provento recente/a pagar; os demais, a cada 3 dias
    cods = {}
    for t, a in A.items():
        tp = a.meta["tipo"]
        if tp in ("Ação", "Unit", "BDR"):
            cods.setdefault(("E", t[:4]), []).append(t)
        elif tp in ("FII", "Fiagro", "FI-Infra", "ETF"):
            cods.setdefault(("F", t[:4]), []).append(t)
    agora = dt.datetime.now()
    lim_ev = (HOJE - dt.timedelta(days=45)).isoformat()
    lim_freq = (HOJE - dt.timedelta(days=400)).isoformat()

    def prioridade(k):
        if k[1] in com_docs:
            return True
        evs = [e for t in cods[k] if t in A for e in A[t].ev if e[1] in ("D", "J", "R", "A")]
        if any(e[0] >= lim_ev or (len(e) > 3 and e[3] and e[3] >= HOJE.isoformat()) for e in evs):
            return True
        return sum(1 for e in evs if e[0] >= lim_freq) >= 4        # paga com frequência (mensal ou trimestral)
    prio = {k for k in cods if prioridade(k)}

    def vencido(k):
        info = emp.get(k[1], {})
        if k in prio:
            ts = info.get("ts") or (info.get("t", "") + "T00:00:00" if info.get("t") else "")
            return not ts or agora - dt.datetime.fromisoformat(ts) > dt.timedelta(hours=10)
        return info.get("t", "") < (HOJE - dt.timedelta(days=3)).isoformat()
    fila = sorted(cods, key=lambda k: (k not in prio, emp.get(k[1], {}).get("ts") or emp.get(k[1], {}).get("t", ""), k))
    feitos = 0
    log("emissores prioritários (documento ou provento recente):", len(prio), "de", len(cods))
    for k in fila:
        info = emp.setdefault(k[1], {})
        if not vencido(k):
            continue
        if time.time() > LIMITE - 200:
            break
        ok = atualizar_empresa(k[1], info, cods[k], por_isin) if k[0] == "E" else atualizar_fundo_listado(k[1], info, por_isin)
        if ok:
            info["ts"] = agora.isoformat(timespec="seconds")
        feitos += 1 if ok else 0
    log("emissores atualizados na B3:", feitos, "de", len(fila))
    if not est.get("bdr_t") or est["bdr_t"] < (HOJE - dt.timedelta(days=20)).isoformat():
        bd = bdrs()
        if bd:
            est["bdr"] = bd
            est["bdr_t"] = HOJE.isoformat()
    bdr = est.get("bdr", {})
    n_est = 0
    for a in A.values():
        if not a.fii or a.meta["tipo"] not in ("FII", "Fiagro", "FI-Infra"):
            continue
        a.ev = [e for e in a.ev if e[1] != "E"]
        b3 = [e[0] for e in a.ev if e[1] in ("R", "D", "J")]
        lim = min(b3)[:7].replace("-", "") if b3 else "999999"
        for ym, v in a.fii["m"].items():
            if not v or ym >= lim or not v[0] or not v[3] or v[3] <= 0:
                continue
            dy = v[3] / 100 if v[3] > 0.2 else v[3]
            fim = f"{ym[:4]}-{ym[4:]}-31"
            p = bisect.bisect_right(CAL, fim) - 1
            if p < 0 or CAL[p][:7] != f"{ym[:4]}-{ym[4:]}":
                continue
            a.ev.append([CAL[p], "E", round(dy * v[0], 8)])
            n_est += 1
    log("rendimentos de FII estimados pelo informe da CVM:", n_est)

    # 6) índices
    FU.CAL = CAL
    bench = FU.indices()
    velho = FU.ler_json(os.path.join(ent, "bench.json"), {"d": {}, "m": {}})
    for nome, serie in (velho.get("m") or {}).items():
        bench["m"].setdefault(nome, serie)
    for nome, serie in (velho.get("d") or {}).items():
        if nome not in bench["d"] and serie:
            s2 = list(serie[:len(CAL)])
            while len(s2) < len(CAL):
                s2.append(s2[-1] if s2 else None)
            bench["d"][nome] = s2
    ibov, cdi = bench["d"].get("ibov"), bench["d"].get("cdi")

    # 7) gravação
    pa = os.path.join(sai, "a")
    os.makedirs(pa, exist_ok=True)
    rows, setores = [], {}
    r2 = lambda x: None if x is None else round(x, 2)  # noqa: E731

    def ix(v):
        if v not in setores:
            setores[v] = len(setores)
        return setores[v]
    for t in sorted(A):
        a = A[t]
        if not len(a.i):
            continue
        tp = a.meta["tipo"]
        adj = ajustes(a)
        mt = metricas(a, adj, ibov, cdi)
        reg = {"t": t, "tipo": tp, "meta": a.meta, "i0": a.i[0]}
        c = [None] * (a.i[-1] - a.i[0] + 1)
        for j in range(len(a.i)):
            c[a.i[j] - a.i[0]] = round(a.c[j], 6 if a.c[j] < 1 else 2 if a.c[j] >= 10 else 4)
        reg["c"] = c
        ms = sorted(set(a.vol) | set(a.neg))
        if ms:
            todos = FU.ym_seq(ms[0], ms[-1])
            reg["vm0"] = ms[0]
            reg["vol"] = [round(a.vol.get(m, 0)) for m in todos]
            reg["neg"] = [a.neg.get(m, 0) for m in todos]
        reg["evc"] = sorted(a.ev)
        reg["adj"] = [[e[0], round(e[1], 10), e[2], round(e[3], 10), e[4]] for e in adj]
        nome, setor, sub, extra = a.meta.get("nr", t), "", "", {}
        cod = t[:4]
        info = emp.get(cod, {})
        if tp in ("Ação", "Unit"):
            nome = info.get("nome") or nome
            setor, sub = info.get("setor") or "", info.get("sub") or ""
            cn = fca.get(t) or info.get("cnpj")
            if cn:
                reg["cnpj"] = cn
            f = fund.get(cn) if cn else None
            if f:
                reg["fund"] = {"a": f.get("a"), "bp": f.get("bp"), "cap": f.get("cap"), "cnpj": cn}
                l, lfim = ltm(f)
                # valor de mercado: ações ON e PN em circulação × cotação da classe (ou da outra classe se não negociar)
                cap = list(f.get("cap") or [None, info.get("on"), info.get("pn")])
                b3t = (info.get("on") or 0) + (info.get("pn") or 0)
                cvt = (cap[1] or 0) + (cap[2] or 0)
                if b3t and cvt:
                    razao = b3t / cvt
                    if 500 < razao < 2000:             # composição do capital informada em milhares
                        cap = [cap[0], (cap[1] or 0) * 1000, (cap[2] or 0) * 1000]
                    elif not 0.5 < razao < 2:
                        cap = [cap[0], info.get("on"), info.get("pn")]
                elif b3t and not cvt:
                    cap = [cap[0], info.get("on"), info.get("pn")]
                pon = A.get(cod + "3")
                ppn = next((A[cod + s] for s in ("4", "5", "6") if cod + s in A and len(A[cod + s].c)), None)
                p_on = pon.c[-1] if pon is not None and len(pon.c) else (ppn.c[-1] if ppn else None)
                p_pn = ppn.c[-1] if ppn is not None else p_on
                if cap and p_on:
                    mcap = (cap[1] or 0) * p_on + (cap[2] or 0) * (p_pn or p_on)
                    bp = f.get("bp") or (sorted((f.get("a") or {}).items())[-1][1][3:7] + [None] if f.get("a") else None)
                    pl = bp[2] if bp else None
                    acoes = (cap[1] or 0) + (cap[2] or 0)
                    ind = {"mcap": mcap, "acoes": acoes}
                    if l:
                        rec_, ebit_, ll_ = l
                        ind.update(rec=rec_, ebit=ebit_, ll=ll_, ltm=lfim)
                        if ll_ and ll_ > 0:
                            ind["pl_r"] = mcap / ll_
                        if rec_:
                            ind["ml"] = (ll_ or 0) / rec_ * 100 if ll_ is not None else None
                            ind["me"] = ebit_ / rec_ * 100 if ebit_ is not None else None
                        if pl and pl > 0 and ll_ is not None:
                            ind["roe"] = ll_ / pl * 100
                        if acoes:
                            ind["lpa"] = (ll_ or 0) / acoes
                    if pl:
                        ind["pvp"] = mcap / pl if pl > 0 else None
                        ind["vpa"] = pl / acoes if acoes else None
                        ind["pl"] = pl
                    if bp and bp[3] is not None:
                        dl = (bp[3] or 0) - (bp[1] or 0)
                        ind["dl"] = dl
                        if l and l[1]:
                            ind["dl_ebit"] = dl / l[1]
                            ind["ev_ebit"] = (mcap + dl) / l[1] if l[1] > 0 else None
                    reg["ind"] = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in ind.items()}
        elif tp in ("FII", "Fiagro", "FI-Infra", "ETF"):
            nome = (a.fii or {}).get("nome") or info.get("nome") or nome
            if a.fii:
                setor = a.fii.get("seg") or ""
                ms2 = sorted(a.fii["m"])
                if ms2:
                    reg["fii"] = {k2: v2 for k2, v2 in a.fii.items() if k2 != "m"}
                    reg["fii"]["m0"] = ms2[0]
                    todos = FU.ym_seq(ms2[0], ms2[-1])
                    reg["fii"]["m"] = [a.fii["m"].get(m) for m in todos]
                    u = a.fii["m"][ms2[-1]]
                    cotas = info.get("cotas") or a.fii.get("cotas")      # B3 primeiro; o informe pode vir defasado
                    pvp = a.c[-1] / u[0] if u[0] else None
                    if pvp is not None and not 0.2 < pvp < 5:      # informe inconsistente com a cotação
                        pvp = None
                    extra = {"vpc": u[0] if pvp else None, "pvp": pvp, "plf": u[1], "cot": u[2] if (u[2] or 0) > 1 else None,
                             "mcap": a.c[-1] * cotas if cotas else None}
            else:
                setor = "ETF" if tp == "ETF" else ""
        elif tp == "Tesouro Direto":
            setor = {"SELIC": "Tesouro Selic", "PRE": "Tesouro Prefixado", "PREJ": "Tesouro Prefixado com Juros",
                     "IPCA": "Tesouro IPCA+", "IPCAJ": "Tesouro IPCA+ com Juros", "RENDA": "Tesouro RendA+", "EDUCA": "Tesouro Educa+"}.get(a.meta.get("esp"), "")
            reg["venc"] = a.meta.get("venc")
        elif tp.startswith("BDR"):
            b = bdr.get(cod) or {}
            nome = b.get("nome") or nome
            setor, sub = b.get("setor") or "", b.get("sub") or ""
        reg["nome"], reg["setor"], reg["sub"] = nome, setor, sub
        reg["met"] = {k: (r2(v) if k not in ("liq", "prov12") else (round(v, 4) if v else v)) for k, v in mt.items()}
        FU.gravar(os.path.join(pa, t + ".json"), reg)
        ind = reg.get("ind", {})
        rows.append([t, (nome or "")[:70], tp, ix(setor), round(a.c[-1], 4), CAL[a.i[-1]], r2(mt.get("d1")), r2(mt.get("r1m")), r2(mt.get("ra")),
                     r2(mt.get("r12")), r2(mt.get("r24")), r2(mt.get("r36")), r2(mt.get("r60")), r2(mt.get("v12")), r2(mt.get("dd")),
                     r2(mt.get("beta")), round(mt["liq"]) if mt.get("liq") else None, r2(mt.get("dy")),
                     round(ind["mcap"]) if ind.get("mcap") else (round(extra["mcap"]) if extra.get("mcap") else None),
                     r2(ind.get("pl_r")), r2(ind.get("pvp") if ind else extra.get("pvp")), r2(ind.get("roe")), r2(ind.get("ml")),
                     r2(ind.get("dl_ebit")), r2(ind.get("ev_ebit")), int(extra["cot"]) if extra.get("cot") else None, r2(mt.get("sh"))])
    hoje = HOJE.isoformat()
    lim = (HOJE - dt.timedelta(days=10)).isoformat()
    agenda = []
    for t, a in A.items():
        if not len(a.c) or a.meta.get("td"):
            continue
        for e in a.ev:
            if e[1] in ("S", "E"):
                continue
            pag = e[3] if len(e) > 3 else None
            if e[0] >= lim or (pag and pag >= hoje):
                agenda.append([t, a.meta.get("tipo"), e[1], e[0], pag, e[2], round(e[2] / a.c[-1] * 100, 3) if a.c[-1] else None])
    agenda.sort(key=lambda x: (x[3], x[0]))
    FU.gravar(os.path.join(sai, "agenda.json"), {"geradoEm": dt.datetime.now().isoformat(timespec="seconds"), "hoje": hoje,
                                                 "cols": ["t", "tipo", "prov", "datacom", "pagamento", "valor", "yield"], "rows": agenda})
    inv = [s for s, _ in sorted(setores.items(), key=lambda x: x[1])]
    FU.gravar(os.path.join(sai, "idx.json"), {
        "dt": CAL[-1] if CAL else None, "geradoEm": dt.datetime.now().isoformat(timespec="seconds"),
        "cols": ["t", "nome", "tipo", "setor", "preco", "data", "d1", "r1m", "ra", "r12", "r24", "r36", "r60", "v12", "dd36", "beta",
                 "liq", "dy", "mcap", "pl", "pvp", "roe", "ml", "dlebit", "evebit", "cot", "sharpe"],
        "setores": inv, "rows": rows,
        "fonte": "B3 (cotações, proventos, cadastro) e CVM (balanços, informe dos FIIs)"})
    FU.gravar(os.path.join(sai, "cal.json"), {"d": CAL})
    FU.gravar(os.path.join(sai, "bench.json"), bench)
    FU.gravar(os.path.join(sai, "emp.json"), emp)
    FU.gravar(os.path.join(sai, "fund.json"), fund)
    est.update(geradoEm=dt.datetime.now().isoformat(timespec="seconds"), ativos=len(rows), pregoes=len(CAL),
               diag={k: (v[:20] if isinstance(v, list) else v) for k, v in DIAG.items()}, minutos=round((time.time() - INICIO) / 60, 1))
    FU.gravar(os.path.join(sai, "estado.json"), est)
    log("gravado:", len(rows), "ativos; cotações até", est["ano_ate"], "+ ano corrente")


if __name__ == "__main__":
    principal()
