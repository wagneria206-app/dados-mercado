"""Robô do módulo de fundos — só dados oficiais.

CVM: informe diário (cota, PL, captação, resgate, cotistas), cadastro, extrato, lâmina e carteira (CDA).
BCB: CDI, IPCA e dólar (SGS). B3: Ibovespa e IFIX (estatísticas de índices).

Uso: python scripts/fundos.py ENTRADA SAIDA
  ENTRADA = pasta com a última publicação (ramo "fundos"), usada como estado
  SAIDA   = pasta nova que será publicada
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

INI_DIARIO = "201901"          # cota diária guardada a partir daqui
INI_MENSAL = 2005              # cota de fim de mês desde este ano
INICIO = time.time()
LIMITE = INICIO + float(os.environ.get("MINUTOS", "38")) * 60
UA = {"User-Agent": "Mozilla/5.0 (dados-mercado; +https://github.com/wagneria206-app/dados-mercado)"}
HOJE = dt.date.today()
ESC = 1e6                      # retornos diários guardados em milionésimos

URL_DIA = "https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_{}.zip"
URL_DIA_HIST = "https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/HIST/inf_diario_fi_{}.zip"
URL_CAD_175 = "https://dados.cvm.gov.br/dados/FI/CAD/DADOS/registro_fundo_classe.zip"
URL_CAD_FI = "https://dados.cvm.gov.br/dados/FI/CAD/DADOS/cad_fi.csv"
URL_EXTRATO = "https://dados.cvm.gov.br/dados/FI/DOC/EXTRATO/DADOS/extrato_fi_{}.csv"
URL_LAMINA = "https://dados.cvm.gov.br/dados/FI/DOC/LAMINA/DADOS/lamina_fi_{}.zip"
URL_CDA = "https://dados.cvm.gov.br/dados/FI/DOC/CDA/DADOS/cda_fi_{}.zip"
URL_SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{}/dados?formato=json&dataInicial={}&dataFinal={}"
URL_B3_IDX = "https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay/{}"

DIAG = {}


def log(*a):
    print(f"[{time.time() - INICIO:6.0f}s]", *a, flush=True)


def baixar(url, timeout=(15, 300), tentativas=3, aceita_404=False):
    ultimo = None
    for t in range(tentativas):
        try:
            r = requests.get(url, headers=UA, timeout=timeout)
            if r.status_code == 404 and aceita_404:
                return None
            r.raise_for_status()
            return r
        except Exception as e:  # noqa: BLE001
            ultimo = e
            time.sleep(3 + 5 * t)
    raise RuntimeError(f"{url}: {ultimo}")


def num(s):
    s = (s or "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        try:
            return float(s.replace(".", "").replace(",", "."))
        except ValueError:
            return None


def chave(c):
    k = re.sub(r"[^0-9A-Z]", "", (c or "").upper())
    return k if len(k) == 14 else None


def ym_seq(a, b):
    """Meses AAAAMM de a até b, inclusive."""
    y, m = int(a[:4]), int(a[4:])
    out = []
    while f"{y}{m:02d}" <= b:
        out.append(f"{y}{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def ym_add(a, n):
    y, m = int(a[:4]), int(a[4:]) - 1 + n
    return f"{y + m // 12}{m % 12 + 1:02d}"


def ler_json(p, padrao):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return padrao


def gravar(p, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


# ------------------------------------------------------------------ informe diário

_HIST = {}


def csv_do_mes(ym):
    """Abre o CSV do informe diário do mês (arquivo mensal ou anual do histórico)."""
    if ym >= "202101":
        r = baixar(URL_DIA.format(ym), aceita_404=True)
        if r is None:
            return None
        z = zipfile.ZipFile(io.BytesIO(r.content))
        return [z.open(n) for n in z.namelist() if n.lower().endswith(".csv")]
    ano = ym[:4]
    if ano not in _HIST:
        _HIST.clear()
        r = baixar(URL_DIA_HIST.format(ano), aceita_404=True)
        _HIST[ano] = zipfile.ZipFile(io.BytesIO(r.content)) if r is not None else None
    z = _HIST[ano]
    if z is None:
        return None
    nomes = [n for n in z.namelist() if ym in n and n.lower().endswith(".csv")]
    return [z.open(n) for n in nomes]


def ler_mes(ym, filtro=None):
    """{cnpj: [(data, cota, pl, capt, resg, cotistas)]} e {cnpj: tipo}."""
    arqs = csv_do_mes(ym)
    if arqs is None:
        return None, {}
    dados, tipos = {}, {}
    for f in arqs:
        leitor = csv.reader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";")
        cab = next(leitor)
        ix = {c: i for i, c in enumerate(cab)}
        c_cnpj = next(i for i, c in enumerate(cab) if c.startswith("CNPJ_FUNDO"))
        c_sub = ix.get("ID_SUBCLASSE")
        c_tp = ix.get("TP_FUNDO_CLASSE", ix.get("TP_FUNDO"))
        c_d, c_q = ix["DT_COMPTC"], ix["VL_QUOTA"]
        c_pl, c_ca, c_re, c_co = ix.get("VL_PATRIM_LIQ"), ix.get("CAPTC_DIA"), ix.get("RESG_DIA"), ix.get("NR_COTST")
        n = len(cab)
        for L in leitor:
            if len(L) < n:
                continue
            sub = L[c_sub].strip().upper() if c_sub is not None else ""
            k = sub if sub else chave(L[c_cnpj])
            if sub:
                SUBPAI[sub] = chave(L[c_cnpj])
            if not k or (filtro is not None and k not in filtro):
                continue
            q = num(L[c_q])
            if not q or q <= 0:
                continue
            dados.setdefault(k, []).append((L[c_d][:10], q, num(L[c_pl]) or 0.0, num(L[c_ca]) or 0.0,
                                            num(L[c_re]) or 0.0, int(num(L[c_co]) or 0)))
            if c_tp is not None:
                tipos[k] = L[c_tp].strip()
    for v in dados.values():
        v.sort()
    return dados, tipos


# ------------------------------------------------------------------ estado dos fundos

def ler_mensal(f, j):
    """Reconstrói os registros mensais a partir do formato compacto do arquivo."""
    m0 = j.get("m0")
    if not m0:
        return
    mq, mpl = j.get("mq") or [], j.get("mpl") or []
    d0 = j.get("d0") or m0
    mc, mca, mre = j.get("mc") or [], j.get("mca") or [], j.get("mre") or []
    meses = ym_seq(m0, ym_add(m0, len(mq) - 1)) if mq else []
    off = len(ym_seq(m0, d0)) - 1 if d0 >= m0 else 0
    for n, ym in enumerate(meses):
        q = mq[n]
        if q is None:
            continue
        k = n - off
        pega = lambda L: (L[k] if 0 <= k < len(L) else None)  # noqa: E731
        f.m[ym] = [None, q, (mpl[n] or 0) * 1000 if n < len(mpl) and mpl[n] is not None else 0, pega(mc) or 0,
                   (pega(mca) or 0) * 1000, (pega(mre) or 0) * 1000]


def escrever_mensal(f, reg):
    meses = sorted(f.m)
    if not meses:
        return
    todos = ym_seq(meses[0], meses[-1])
    g = lambda ym, i: (f.m[ym][i] if ym in f.m else None)  # noqa: E731
    reg["m0"] = meses[0]
    reg["mq"] = [None if g(ym, 1) is None else float(f"{g(ym, 1):.10g}") for ym in todos]
    reg["mpl"] = [None if g(ym, 2) is None else round(g(ym, 2) / 1000) for ym in todos]
    rec = [ym for ym in todos if ym >= INI_DIARIO]
    if rec:
        reg["d0"] = rec[0]
        reg["mc"] = [g(ym, 3) for ym in rec]
        reg["mca"] = [None if g(ym, 4) is None else round(g(ym, 4) / 1000) for ym in rec]
        reg["mre"] = [None if g(ym, 5) is None else round(g(ym, 5) / 1000) for ym in rec]


class Fundo:
    __slots__ = ("m", "i", "q")

    def __init__(self):
        self.m = {}               # AAAAMM -> [dia, cota, pl, cotistas, captação, resgate]
        self.i = array("i")       # índices do calendário
        self.q = array("d")       # cotas


SUBPAI = {}       # subclasse -> CNPJ da classe
CAL = []          # datas do calendário (AAAA-MM-DD)
OLD = {}          # carteira e histórico de carteira da publicação anterior
CALIX = {}
F = {}


def carregar_estado(pasta):
    global CAL, CALIX
    est = ler_json(os.path.join(pasta, "estado.json"), {})
    CAL = ler_json(os.path.join(pasta, "cal.json"), {}).get("d", [])
    CALIX = {d: i for i, d in enumerate(CAL)}
    pf = os.path.join(pasta, "f")
    n = 0
    if os.path.isdir(pf):
        for nome in os.listdir(pf):
            j = ler_json(os.path.join(pf, nome), None)
            if not j:
                continue
            f = Fundo()
            ler_mensal(f, j)
            i0, q0, r = j.get("i0"), j.get("q0"), j.get("r") or []
            if i0 is not None and q0:
                f.i.append(i0)
                f.q.append(q0)
                q = q0
                for k, x in enumerate(r):
                    if x is None:
                        continue
                    q = q * x[0] if isinstance(x, list) else q * (1 + x / ESC)
                    f.i.append(i0 + 1 + k)
                    f.q.append(q)
            F[nome[:-5]] = f
            if j.get("cart") or j.get("carth"):
                OLD[nome[:-5]] = (j.get("cart"), j.get("carth") or {})
            n += 1
    log("estado carregado:", n, "fundos,", len(CAL), "dias no calendário")
    return est


def cortar_calendario(n):
    """Descarta os dias do calendário a partir do índice n (para reprocessar meses)."""
    global CAL
    if n >= len(CAL):
        return
    for d in CAL[n:]:
        CALIX.pop(d, None)
    CAL = CAL[:n]
    for f in F.values():
        p = bisect.bisect_left(f.i, n)
        if p < len(f.i):
            del f.i[p:]
            del f.q[p:]


def aplicar_mes(ym, dados, diario, ativos):
    if diario:
        cont = {}
        for rows in dados.values():
            for r in rows:
                cont[r[0]] = cont.get(r[0], 0) + 1
        for d in sorted(cont):
            if cont[d] >= 150 and d not in CALIX and (not CAL or d > CAL[-1]):
                CALIX[d] = len(CAL)
                CAL.append(d)
    for k, rows in dados.items():
        if k not in ativos:
            continue
        f = F.get(k)
        if f is None:
            f = F[k] = Fundo()
        u = rows[-1]
        f.m[ym] = [int(u[0][8:10]), u[1], u[2], u[5], sum(r[3] for r in rows), sum(r[4] for r in rows)]
        if diario:
            for r in rows:
                ix = CALIX.get(r[0])
                if ix is None or (len(f.i) and ix <= f.i[-1]):
                    continue
                f.i.append(ix)
                f.q.append(r[1])


# ------------------------------------------------------------------ cadastro, extrato, lâmina

def norm(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", (s or "").strip().lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def ler_csv(fobj):
    leitor = csv.reader(io.TextIOWrapper(fobj, encoding="latin-1"), delimiter=";")
    cab = [c.strip() for c in next(leitor)]
    for L in leitor:
        yield {cab[i]: L[i] for i in range(min(len(cab), len(L)))}


def cadastro(ativos):
    info = {}
    ativos = set(ativos) | {v for v in SUBPAI.values() if v}      # classes das subclasses também
    cob = {}

    def cobertura(etapa):
        """Quantos fundos ativos já têm taxa de administração e prazo de resgate depois de cada etapa."""
        cob[etapa] = {"taxa": sum(1 for k in ativos if info.get(k, {}).get("tadm") is not None),
                      "resgate": sum(1 for k in ativos if info.get(k, {}).get("dcot") is not None or info.get(k, {}).get("dpag") is not None)}

    def pega(k, **kv):
        d = info.setdefault(k, {})
        for a, b in kv.items():
            b = (b or "").strip() if isinstance(b, str) else b
            if b in (None, "", "-"):
                continue
            if a == "ini":
                b = b[:10]
                if re.match(r"\d{4}-\d\d-\d\d$", b) and (a not in d or b < d[a]):
                    d[a] = b
            elif a not in d:
                d[a] = b
    try:
        r = baixar(URL_CAD_175)
        z = zipfile.ZipFile(io.BytesIO(r.content))
        fundos = {}
        nome_fundo = next(n for n in z.namelist() if "registro_fundo" in n)
        for L in ler_csv(z.open(nome_fundo)):
            L = {norm(a): b for a, b in L.items()}
            fundos[L.get("id_registro_fundo", "")] = L
        nome_classe = next(n for n in z.namelist() if "registro_classe" in n)
        for L in ler_csv(z.open(nome_classe)):
            L = {norm(a): b for a, b in L.items()}
            if "cad175_colunas" not in DIAG:
                DIAG["cad175_colunas"] = list(L.keys())
            tx = next((L[c] for c in L if "taxa" in c and "adm" in c), None)
            if tx and chave(L.get("cnpj_classe")) in ativos:
                pega(chave(L.get("cnpj_classe")), tadm=num(tx))
            k = chave(L.get("cnpj_classe"))
            if not k or k not in ativos:
                continue
            fu = fundos.get(L.get("id_registro_fundo", ""), {})
            pega(k, n=L.get("denominacao_social"), cls=L.get("classificacao"), anb=L.get("classificacao_anbima"),
                 bm=L.get("indicador_desempenho"), pub=L.get("publico_alvo"), exc=L.get("exclusivo"),
                 lp=L.get("tributacao_longo_prazo"), cond=L.get("forma_condominio"), ini=L.get("data_inicio"),
                 fic=L.get("classe_cotas"), aud=L.get("auditor"), cus=L.get("custodiante"),
                 ges=fu.get("gestor"), adm=fu.get("administrador"), cnf=chave(fu.get("cnpj_fundo")),
                 nf=fu.get("denominacao_social"), tpf=fu.get("tipo_fundo"))
    except Exception as e:  # noqa: BLE001
        DIAG["cad175"] = str(e)[:300]
    cobertura("cadastro_novo")
    anterior = {}   # taxas do cadastro antigo de fundos já migrados para a nova regra (último recurso)
    try:
        r = baixar(URL_CAD_FI)
        for L in ler_csv(io.BytesIO(r.content)):
            L = {norm(a): b for a, b in L.items()}
            k = chave(L.get("cnpj_fundo"))
            if not k or k not in ativos:
                continue
            if "cancel" in norm(L.get("sit")):
                if num(L.get("taxa_adm")) is not None and k not in anterior:
                    anterior[k] = {"tadm": num(L.get("taxa_adm")), "tperf": num(L.get("taxa_perfm"))}
                continue
            pega(k, n=L.get("denom_social"), cls=L.get("classe"), anb=L.get("classe_anbima"), bm=L.get("rentab_fundo"),
                 pub=L.get("publico_alvo"), exc=L.get("fundo_exclusivo"), lp=L.get("trib_lprazo"), cond=L.get("condom"),
                 ini=L.get("dt_ini_ativ") or L.get("dt_const"), fic=L.get("fundo_cotas"), aud=L.get("auditor"),
                 cus=L.get("custodiante"), ges=L.get("gestor"), adm=L.get("admin"),
                 tadm=num(L.get("taxa_adm")), tperf=num(L.get("taxa_perfm")), itperf=L.get("inf_taxa_perfm"))
    except Exception as e:  # noqa: BLE001
        DIAG["cad_fi"] = str(e)[:300]
    cobertura("cadastro_antigo")
    # extrato (informações de prazos, taxas e aplicação mínima): últimos 3 anos, vale o mais recente de cada fundo
    ext = {}
    for ano in (HOJE.year, HOJE.year - 1, HOJE.year - 2):
        try:
            r = baixar(URL_EXTRATO.format(ano), aceita_404=True)
            if r is None:
                continue
            for L in ler_csv(io.BytesIO(r.content)):
                k = chave(L.get("CNPJ_FUNDO_CLASSE") or L.get("CNPJ_FUNDO"))
                if not k or k not in ativos:
                    continue
                d = L.get("DT_COMPTC", "")
                if k not in ext or d > ext[k][0]:
                    ext[k] = (d, L)
        except Exception as e:  # noqa: BLE001
            DIAG[f"extrato_{ano}"] = str(e)[:300]
    for k, (_, L) in ext.items():
        pega(k, anb=L.get("CLASSE_ANBIMA"), pub=L.get("PUBLICO_ALVO"), cond=L.get("CONDOM"),
             tadm=num(L.get("TAXA_ADM")), tperf=num(L.get("TAXA_PERFM")) if (L.get("EXISTE_TAXA_PERFM") or "").upper().startswith("S") else None,
             itperf=L.get("PARAM_TAXA_PERFM"), amin=num(L.get("APLIC_MIN")),
             dcot=num(L.get("QT_DIA_CONVERSAO_COTA")), dpag=num(L.get("QT_DIA_PAGTO_RESGATE")))
    cobertura("extrato")
    # lâmina (prevalece para taxas e prazos de quem oferece ao varejo): a mais recente de cada fundo nos últimos 12 meses
    lam = {}
    for k_mes in range(0, 12):
        ym = ym_add(HOJE.strftime("%Y%m"), -k_mes)
        try:
            r = baixar(URL_LAMINA.format(ym), aceita_404=True)
            if r is None:
                continue
            z = zipfile.ZipFile(io.BytesIO(r.content))
            nome = next(n for n in z.namelist() if re.search(r"lamina_fi_\d{6}\.csv$", n))
            cab_ok = False
            for L in ler_csv(z.open(nome)):
                if not cab_ok:
                    DIAG["lamina_colunas"] = list(L.keys())
                    cab_ok = True
                sub = (L.get("ID_SUBCLASSE") or "").strip().upper()
                k = sub or chave(L.get("CNPJ_FUNDO_CLASSE") or L.get("CNPJ_FUNDO"))
                if k and k in ativos and k not in lam:
                    lam[k] = L
        except Exception as e:  # noqa: BLE001
            DIAG[f"lamina_{ym}"] = str(e)[:300]
    for k, L in lam.items():
        d = info.setdefault(k, {})
        for a, col in (("tadm", "TAXA_ADM"), ("tperf", "TAXA_PERFM"), ("amin", "INVEST_INICIAL_MIN"),
                       ("dcot", "QT_DIA_CONVERSAO_COTA_RESGATE"), ("dpag", "QT_DIA_PAGTO_RESGATE"),
                       ("tsai", "TAXA_SAIDA"), ("car", "QT_DIA_CAREN")):
            v = num(L.get(col))
            if v is not None:
                d[a] = v
        for a, col, lim in (("obj", "OBJETIVO", 500), ("pol", "POLIT_INVEST", 700), ("fan", "NM_FANTASIA", 120),
                            ("rsk", "RISCO_PERDA", 200)):
            v = (L.get(col) or "").strip()
            if v and v != "-":
                d[a] = v[:lim]
        for col in L:
            if "CLASSE_RISCO" in col or col in ("RISCO", "PR_RISCO"):
                v = num(L.get(col))
                if v:
                    d["risco"] = v
    cobertura("lamina")
    # último recurso: taxa do cadastro antigo (fundos que migraram para a nova regra da CVM e ainda não têm extrato nem lâmina)
    for k, v in anterior.items():
        d = info.setdefault(k, {})
        if d.get("tadm") is None and v.get("tadm") is not None:
            d["tadm"], d["tadm_fte"] = v["tadm"], "cadastro anterior à Resolução CVM 175"
            if d.get("tperf") is None and v.get("tperf") is not None:
                d["tperf"] = v["tperf"]
    cobertura("cadastro_anterior")
    DIAG["cobertura_taxa_resgate"] = dict(cob, fundos=len(ativos))
    subs = [k for k in ativos if len(k) != 14 or not k.isdigit()]
    if subs:
        try:
            r = baixar(URL_CAD_175)
            z = zipfile.ZipFile(io.BytesIO(r.content))
            nome_sub = next(n for n in z.namelist() if "subclasse" in n)
            for L in ler_csv(z.open(nome_sub)):
                L = {norm(a): b for a, b in L.items()}
                k = (L.get("id_subclasse") or "").strip().upper()
                if k not in ativos:
                    continue
                pai = SUBPAI.get(k)
                base = dict(info.get(pai, {}))
                for a in ("obj", "pol", "fan", "tadm", "tperf", "amin", "dcot", "dpag", "tsai", "car", "risco", "rsk"):
                    base.pop(a, None)
                d = info.setdefault(k, {})
                for a, v in base.items():
                    d.setdefault(a, v)
                nm = (L.get("denominacao_social") or "").strip()
                pn = (info.get(pai, {}) or {}).get("n", "")
                d["n"] = (pn + " · " + nm) if nm and len(nm) < 40 and pn else (nm or pn)
                for a, col in (("exc", "exclusivo"), ("pub", "publico_alvo"), ("cond", "forma_condominio"), ("prev", "previdenciario")):
                    v = (L.get(col) or "").strip()
                    if v:
                        d[a] = v
                ini = (L.get("data_inicio") or "")[:10]
                if re.match(r"\d{4}-\d\d-\d\d$", ini):
                    d["ini"] = ini
                d["pai"] = pai
        except Exception as e:  # noqa: BLE001
            DIAG["subclasses"] = str(e)[:200]
    log("cadastro:", len(info), "fundos e subclasses; extrato:", len(ext), "; lâmina:", len(lam))
    return info


# ------------------------------------------------------------------ carteira (CDA)

TITPUB = {"letras financeiras do tesouro": "LFT", "letras do tesouro nacional": "LTN", "notas do tesouro nacional - serie b": "NTN-B",
          "notas do tesouro nacional - serie f": "NTN-F", "notas do tesouro nacional - serie c": "NTN-C",
          "notas do tesouro nacional serie b": "NTN-B", "notas do tesouro nacional serie f": "NTN-F"}


def nome_ativo(blc, L):
    g = lambda c: (L.get(c) or "").strip()  # noqa: E731
    if blc == "BLC_1":
        t = TITPUB.get(norm(g("TP_TITPUB")).replace("–", "-"), g("TP_TITPUB")[:20] or "Título público")
        v = g("DT_VENC")
        return f"{t} {v[5:7]}/{v[:4]}" if len(v) >= 7 else t, None
    if blc == "BLC_2":
        return g("NM_FUNDO_CLASSE_SUBCLASSE_COTA") or g("NM_FUNDO_COTA") or "Cotas de fundo", chave(g("CNPJ_FUNDO_CLASSE_COTA") or g("CNPJ_FUNDO_COTA"))
    if blc == "BLC_3":
        return "Swap " + g("DS_SWAP"), None
    if blc == "BLC_4":
        return (g("CD_ATIVO") + " " + g("DS_ATIVO")).strip() or g("TP_ATIVO"), None
    if blc in ("BLC_5", "BLC_6"):
        return (g("TP_ATIVO") + " " + g("EMISSOR")).strip(), None
    if blc == "BLC_7":
        return g("DS_ATIVO_EXTERIOR") or g("EMISSOR") or g("TP_ATIVO"), None
    return g("DS_ATIVO") or g("EMISSOR") or g("TP_APLIC"), None


def posicao(blc, L, tp):
    """Identidade (para somar a mesma exposição em fundos diferentes) e grupo de risco de cada posição da CDA."""
    g = lambda c: (L.get(c) or "").strip()  # noqa: E731
    tpn = norm(tp)
    so = lambda s: re.sub(r"\D", "", s or "")  # noqa: E731
    if blc == "CONFID":
        return None, "conf"
    if blc == "BLC_1":
        t = TITPUB.get(norm(g("TP_TITPUB")).replace("–", "-"), "TP")
        grp = "compr" if "compromissad" in tpn else {"LFT": "tpos", "LTN": "tpre", "NTN-F": "tpre"}.get(t, "tipca")
        return f"tp:{t}:{g('DT_VENC')[:7]}", grp
    if blc == "BLC_2":
        c = chave(g("CNPJ_FUNDO_CLASSE_COTA") or g("CNPJ_FUNDO_COTA"))
        return (f"f:{c}" if c else None), "cotas"
    if blc == "BLC_3":
        return None, "deriv"
    if "futuro" in tpn or "opc" in tpn or "termo" in tpn or "swap" in tpn:
        return None, "deriv"
    if blc == "BLC_4":
        cd = g("CD_ATIVO").upper()
        if "debenture" in tpn:
            return f"d:{cd}", "cred"
        if "bdr" in tpn or "brazilian depositary" in tpn or re.match(r"^[A-Z0-9]{4}3[2-5]$", cd):
            return f"a:{cd[:4]}", "ext"
        if "acoes" in tpn or "acao" in tpn or "recibo" in tpn or "bonus" in tpn:
            return f"a:{cd[:4]}", "acoes"
        if "cotas de fundos" in tpn or re.match(r"^[A-Z]{4}11$", cd):
            return f"a:{cd}", "cotas"
        return (f"a:{cd}" if cd else None), "outros"
    if blc == "BLC_5":
        c = so(g("CNPJ_EMISSOR"))
        return (f"e:{c[:8]}" if c else None), "banc"
    if blc == "BLC_6":
        c = so(g("CPF_CNPJ_EMISSOR") or g("CNPJ_EMISSOR"))
        return (f"e:{c[:8]}" if len(c) == 14 else None), "cred"
    if blc == "BLC_7":
        cd = g("CD_ATIVO_BV_MERC") or g("DS_ATIVO_EXTERIOR")
        return (f"x:{norm(cd)[:40]}" if cd else None), "ext"
    if "disponib" in tpn or "valores a" in tpn:
        return None, "caixa"
    c = so(g("CPF_CNPJ_EMISSOR") or g("CNPJ_EMISSOR"))
    return (f"e:{c[:8]}" if len(c) == 14 else None), "outros"


def carteiras(ativos, estado):
    """Composição e maiores posições na carteira mais recente de cada fundo; composição de cada mês lido (histórico)."""
    out, assin, hist = {}, [], {}
    bom = set()   # fundos com uma carteira de pouco sigilo já escolhida (as mais recentes podem estar quase toda confidencial)
    n_meses = 4 if estado.get("cda_hist") else 13   # 4: a CVM libera as posições em sigilo depois de até 90 dias
    meses = []
    for k in range(1, n_meses + 5):
        ym = ym_add(HOJE.strftime("%Y%m"), -k)
        meses.append(ym)
    lidos = 0
    for ym in meses:
        if lidos >= n_meses or time.time() > LIMITE - 300:
            break
        try:
            r = baixar(URL_CDA.format(ym), aceita_404=True)
        except Exception as e:  # noqa: BLE001
            DIAG[f"cda_{ym}"] = str(e)[:200]
            continue
        if r is None:
            continue
        lidos += 1
        assin.append(f"{ym}:{len(r.content)}")
        z = zipfile.ZipFile(io.BytesIO(r.content))
        pl, pos, comp, grupos, expo = {}, {}, {}, {}, {}
        for nome in z.namelist():
            blc = (re.search(r"(BLC_\d|CONFID|PL|fie)", nome) or [None])[0]
            if not blc:
                continue
            for L in ler_csv(z.open(nome)):
                k = chave(L.get("CNPJ_FUNDO_CLASSE") or L.get("CNPJ_FUNDO"))
                if not k or k not in ativos:
                    continue
                if blc == "PL":
                    pl[k] = num(L.get("VL_PATRIM_LIQ"))
                    continue
                v = num(L.get("VL_MERC_POS_FINAL"))
                if not v:
                    continue
                tp = (L.get("TP_APLIC") or "Outros").strip()
                if blc == "CONFID":
                    tp = "Não divulgado (confidencial)"
                    nm, cn = "Posições não divulgadas", None
                else:
                    nm, cn = nome_ativo(blc, L)
                c = comp.setdefault(k, {})
                c[tp] = c.get(tp, 0) + v
                if k not in bom:
                    if blc not in DIAG.setdefault("cda_colunas", {}):
                        DIAG["cda_colunas"][blc] = sorted(L.keys())[:60]
                    ch, grp = posicao(blc, L, tp)
                    gg = grupos.setdefault(k, {})
                    gg[grp] = gg.get(grp, 0) + v
                    if v > 0:
                        p = pos.setdefault(k, {})
                        a = p.setdefault(nm, [0.0, cn, tp])
                        a[0] += v
                        if ch:
                            x = expo.setdefault(k, {}).setdefault(ch, [0.0, nm, grp])
                            x[0] += v
                if blc == "fie" and k not in pl:
                    pl[k] = num(L.get("VL_PATRIM_LIQ"))
        for k, c in comp.items():
            base = pl.get(k) or sum(v for v in c.values())
            if not base:
                continue
            hist.setdefault(k, {})[ym] = [[t, round(v / base * 100, 1)] for t, v in sorted(c.items(), key=lambda x: -abs(x[1]))[:10]]
            if k in bom:
                continue
            conf = sum(v for t, v in c.items() if t.startswith("Não divulgado")) / base
            if conf <= 0.3:
                bom.add(k)
            elif k in out:
                continue
            top = sorted(pos.get(k, {}).items(), key=lambda x: -x[1][0])[:12]
            out[k] = {"dt": f"{ym[:4]}-{ym[4:]}", "sig": round(conf * 100, 1),
                      "comp": [[t, round(v / base * 100, 2)] for t, v in sorted(c.items(), key=lambda x: -abs(x[1]))],
                      "top": [[n, round(a[0] / base * 100, 2), a[1], a[2]] for n, a in top],
                      # raio-X: exposição por grupo de risco e as maiores posições com identidade comum entre fundos
                      "g": {gr: round(v / base * 100, 2) for gr, v in grupos.get(k, {}).items() if abs(v / base) >= 0.0001},
                      "x": [[ch, a[1][:60], round(a[0] / base * 100, 3), a[2]] for ch, a in sorted(expo.get(k, {}).items(), key=lambda y: -y[1][0])[:80]
                            if a[0] / base >= 0.0005]}
        log("CDA", ym, "carteiras:", len(comp))
    if lidos >= n_meses:
        estado["cda_hist"] = 1
    return out, assin, hist


# ------------------------------------------------------------------ índices de referência

def sgs(serie, ini, fim):
    out = []
    a = ini
    while a <= fim:
        b = min(fim, dt.date(a.year + 9, 12, 31))
        for t in range(4):
            try:
                r = requests.get(URL_SGS.format(serie, a.strftime("%d/%m/%Y"), b.strftime("%d/%m/%Y")), headers=UA, timeout=(15, 90))
                j = r.json()
                break
            except Exception:  # noqa: BLE001
                time.sleep(4 + 6 * t)
        else:
            raise RuntimeError(f"SGS {serie} indisponível")
        for x in j:
            d = x["data"]
            out.append((f"{d[6:]}-{d[3:5]}-{d[:2]}", float(x["valor"])))
        a = dt.date(b.year + 1, 1, 1)
        time.sleep(1)
    return out


def b3_indice(indice, ano):
    p = base64.b64encode(json.dumps({"index": indice, "language": "pt-br", "year": str(ano)}).encode()).decode()
    r = baixar(URL_B3_IDX.format(p), timeout=(15, 60))
    out = []
    for row in r.json().get("results") or []:
        dia = row.get("day")
        for m in range(1, 13):
            v = row.get(f"rateValue{m}")
            x = num(v) if v else None
            if x:
                try:
                    out.append((dt.date(ano, m, dia).isoformat(), x))
                except ValueError:
                    pass
    return sorted(out)


URL_ANB_IMA = "https://www.anbima.com.br/informacoes/ima/ima-sh-down.asp"
URL_ANB_PUB = "https://raw.githubusercontent.com/wagneria206-app/dados-mercado/fundos/anbima_ima.json"
ANB_IDX = {"IMA-B": "imab", "IMA-B 5": "imab5", "IMA-B 5+": "imab5p", "IRF-M": "irfm", "IMA-S": "imas", "IMA-GERAL": "imag"}
ANB = None        # {data: {nome: número-índice}}; None = só ler a última publicação


def anbima_dia(d):
    """Números-índice do IMA numa data (formulário de séries históricas da ANBIMA). {} se não houve cálculo."""
    dados = {"Tipo": "", "DataRef": "", "Pai": "ima", "escolha": "2", "Idioma": "PT", "saida": "csv",
             "Dt_Ref": d.strftime("%d/%m/%Y"), "Dt_Ref_Ver": HOJE.strftime("%Y%m%d")}
    r = requests.post(URL_ANB_IMA, data=dados, headers=UA, timeout=(10, 40))
    out = {}
    for L in r.content.decode("latin-1").splitlines():
        p = L.split(";")
        if len(p) > 3 and p[0].strip() in ANB_IDX and re.match(r"\d\d/\d\d/\d{4}$", p[1].strip()):
            v = num(p[2])
            if v:
                out[ANB_IDX[p[0].strip()]] = v
    return out


def anbima_historico(estado, max_dias=450):
    """Fins de mês desde 2005 e, depois, dias úteis desde 2019 (do mais recente para o mais antigo)."""
    feitos = set(estado.get("anb_vazios", []))
    alvo = []
    m = dt.date(INI_MENSAL, 1, 31)
    while m < HOJE:
        fim = (m.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)
        alvo.append(fim)
        m = (fim + dt.timedelta(days=1)).replace(day=28) + dt.timedelta(days=4)
    feitos_m = {d[:7] for d in ANB}
    pedidos = 0
    for fim in alvo:
        if fim.strftime("%Y-%m") in feitos_m or fim >= HOJE or time.time() > LIMITE - 500 or pedidos > 330:
            continue
        for back in range(0, 6):
            d = fim - dt.timedelta(days=back)
            if d.weekday() >= 5:
                continue
            pedidos += 1
            try:
                v = anbima_dia(d)
            except Exception as e:  # noqa: BLE001
                DIAG["anbima_ima"] = str(e)[:150]
                v = {}
            time.sleep(0.3)
            if v:
                ANB[d.isoformat()] = v
                break
    for d in reversed(CAL):
        if pedidos >= max_dias or time.time() > LIMITE - 400:
            break
        if d in ANB or d in feitos:
            continue
        pedidos += 1
        try:
            v = anbima_dia(dt.date.fromisoformat(d))
        except Exception as e:  # noqa: BLE001
            DIAG["anbima_ima"] = str(e)[:150]
            continue
        time.sleep(0.3)
        if v:
            ANB[d] = v
        else:
            feitos.add(d)
    estado["anb_vazios"] = sorted(feitos)[-400:]
    log("ANBIMA IMA:", len(ANB), "datas no histórico;", pedidos, "consultas")


def indices():
    global ANB
    b = {"d": {}, "m": {}, "fonte": "BCB (CDI, IPCA, dólar PTAX), B3 (Ibovespa, IFIX) e ANBIMA (IMA)"}
    if ANB is None:
        try:
            ANB = requests.get(URL_ANB_PUB, headers=UA, timeout=(10, 60)).json()
        except Exception:  # noqa: BLE001
            ANB = {}
    if ANB:
        ds = sorted(ANB)
        for nome in ANB_IDX.values():
            serie = [(d, ANB[d][nome]) for d in ds if ANB[d].get(nome)]
            if not serie:
                continue
            dd = dict(serie)
            b["m"][nome] = {}
            for d, v in serie:
                b["m"][nome][d[:4] + d[5:7]] = v
            ult, arr = None, []
            for d in CAL:
                if d in dd:
                    ult = dd[d]
                arr.append(ult if (ult is not None and d >= ds[0]) else None)
            b["d"][nome] = arr
    ini = dt.date(INI_MENSAL, 1, 1)
    try:
        cdi = dict(sgs(12, dt.date(int(INI_DIARIO[:4]), 1, 1), HOJE))
        b["d"]["cdi"] = [round(cdi.get(d, 0.0), 6) for d in CAL]
    except Exception as e:  # noqa: BLE001
        DIAG["cdi"] = str(e)
    for nome, serie in (("cdi", 4391), ("ipca", 433)):
        try:
            b["m"][nome] = {d[:4] + d[5:7]: v for d, v in sgs(serie, ini, HOJE)}
        except Exception as e:  # noqa: BLE001
            DIAG[nome + "_m"] = str(e)

    def fecha(serie_d, nome):
        dd = dict(serie_d)
        mm = {}
        for d, v in serie_d:
            mm[d[:4] + d[5:7]] = v
        b["m"][nome] = mm
        ult = None
        arr = []
        for d in CAL:
            if d in dd:
                ult = dd[d]
                arr.append(ult)
            else:
                arr.append(ult)
        b["d"][nome] = arr
    try:
        fecha(sgs(1, ini, HOJE), "usd")
    except Exception as e:  # noqa: BLE001
        DIAG["usd"] = str(e)
    for idx, nome, a0 in (("IBOV", "ibov", INI_MENSAL), ("IFIX", "ifix", 2011)):
        s = []
        try:
            for ano in range(a0, HOJE.year + 1):
                s += b3_indice(idx, ano)
                time.sleep(0.5)
            fecha(s, nome)
        except Exception as e:  # noqa: BLE001
            DIAG[nome] = str(e)[:200]
    return b


# ------------------------------------------------------------------ métricas

def data_menos_meses(d, n):
    y, m = int(d[:4]), int(d[5:7]) - n
    while m <= 0:
        y, m = y - 1, m + 12
    dia = min(int(d[8:10]), [31, 29 if y % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    return f"{y}-{m:02d}-{dia:02d}"


def metricas(f, cdi_d):
    """Indicadores para o índice e o ranking (em %)."""
    out = {}
    if not len(f.i):
        return out
    il, ql = f.i[-1], f.q[-1]
    dl = CAL[il]
    meses = sorted(f.m)

    def ret_desde(d):
        p = bisect.bisect_right(f.i, bisect.bisect_right(CAL, d) - 1) - 1
        if p < 0 or f.q[p] <= 0:
            return None, None
        return (ql / f.q[p] - 1) * 100, f.i[p]
    ym_l = dl[:4] + dl[5:7]
    ant = [m for m in meses if m < ym_l]
    if ql <= 0:
        return out
    # saltos de cota (reinício, amortização, erro no informe): as medidas que os atravessam não são comparáveis
    saltos = [f.i[j] for j in range(1, len(f.q)) if f.q[j - 1] > 0 and not 0.6 < f.q[j] / f.q[j - 1] < 1.5]
    desde = lambda ix: any(s_ > ix for s_ in saltos)  # noqa: E731
    cal_mes = lambda ym: bisect.bisect_right(CAL, f"{ym[:4]}-{ym[4:]}-31") - 1  # noqa: E731
    if saltos and saltos[-1] >= bisect.bisect_left(CAL, data_menos_meses(dl, 60)):
        out["salto"] = 1
    if ant and f.m[ant[-1]][1] and not desde(cal_mes(ant[-1])):
        out["rm"] = (ql / f.m[ant[-1]][1] - 1) * 100
    anoant = [m for m in meses if m <= f"{int(dl[:4]) - 1}12"]
    if anoant and anoant[-1][:4] == str(int(dl[:4]) - 1) and f.m[anoant[-1]][1] and not desde(cal_mes(anoant[-1])):
        out["ra"] = (ql / f.m[anoant[-1]][1] - 1) * 100
    for n, nome in ((12, "r12"), (24, "r24"), (36, "r36"), (60, "r60")):
        alvo = data_menos_meses(dl, n)
        if CAL and CAL[f.i[0]] <= alvo:
            r, i0 = ret_desde(alvo)
            if r is not None and not desde(i0):
                out[nome] = r
                if n == 12:
                    out["_i12"] = i0
    i12 = out.pop("_i12", None)
    if i12 is not None:
        p = bisect.bisect_left(f.i, i12)
        rets = [f.q[j] / f.q[j - 1] - 1 for j in range(p + 1, len(f.q)) if f.q[j - 1] > 0]
        if len(rets) > 150:
            mu = sum(rets) / len(rets)
            v = math.sqrt(sum((x - mu) ** 2 for x in rets) / (len(rets) - 1)) * math.sqrt(252)
            out["v12"] = v * 100
            if cdi_d:
                c = 1.0
                for j in range(i12 + 1, il + 1):
                    c *= 1 + (cdi_d[j] or 0) / 100
                out["c12"] = (c - 1) * 100
                if v > 0.001:
                    out["sh"] = ((1 + out["r12"] / 100) - c) / v
    # perda máxima em 36 meses
    alvo = data_menos_meses(dl, 36)
    p = bisect.bisect_left(f.i, bisect.bisect_left(CAL, alvo))
    pico, dd = 0.0, 0.0
    if p < len(f.i) and desde(f.i[p] if p < len(f.i) else 0):
        p = len(f.q)
        dd = None
    for j in range(p, len(f.q)):
        x = f.q[j]
        if x > pico:
            pico = x
        elif pico:
            dd = min(dd, x / pico - 1)
    out["dd"] = dd * 100 if dd is not None else None
    ult12 = [f.m[m] for m in meses[-12:]]
    out["cap"] = sum((r[4] or 0) - (r[5] or 0) for r in ult12)
    return out


# ------------------------------------------------------------------ gravação

def codificar(f):
    if not len(f.i):
        return None, None, []
    i0, q0 = f.i[0], f.q[0]
    r = [None] * (f.i[-1] - i0)
    for j in range(1, len(f.i)):
        a, b = f.q[j - 1], f.q[j]
        x = b / a if a > 0 else 1.0
        # variações extremas (cota reiniciada, grupamento) vão como razão exata para não zerar a cota
        r[f.i[j] - i0 - 1] = round((x - 1) * ESC) if 0.5 < x < 2 else [float(f"{x:.12g}")]
    return i0, q0, r


def simplifica_tipo(t):
    t = (t or "").upper().replace("CLASSES - ", "").replace("CLASSE - ", "").strip()
    return t or "FI"


def classe_cvm(c, tipo):
    c = norm(c)
    for a, b in (("renda fixa", "Renda Fixa"), ("multimercado", "Multimercado"), ("acoes", "Ações"), ("cambial", "Cambial"),
                 ("referenciado", "Renda Fixa"), ("curto prazo", "Renda Fixa"), ("divida externa", "Cambial")):
        if a in c:
            return b
    if "FAPI" in (tipo or ""):
        return "Previdência (FAPI)"
    return {"FIDC": "FIDC", "FII": "FII", "FIP": "FIP", "FIAGRO": "Fiagro", "ETF": "ETF"}.get(tipo, tipo if tipo != "FIF" else "Outros")


def anbima_nome(a):
    a = re.sub(r"\s+", " ", (a or "").strip())
    if a and a == a.upper():
        a = " ".join(w if w in ("FIDC", "FII", "FIP", "FGTS", "FMP", "ESG", "&") else w.capitalize() for w in a.lower().upper().split(" "))
    return a


def principal():
    ent, sai = sys.argv[1], sys.argv[2]
    estado = carregar_estado(ent)
    if os.environ.get("REFAZER") == "1":      # reconstrói a cota diária do zero
        cortar_calendario(0)
        estado["diario_ate"] = ym_add(INI_DIARIO, -1)
    ym_atual = HOJE.strftime("%Y%m")
    m1, m2 = ym_add(ym_atual, -1), ym_add(ym_atual, -2)

    # quem está ativo: fundos com cota no mês atual ou no anterior
    atual, tipos = ler_mes(ym_atual)
    ant, tipos_a = ler_mes(m1)
    recentes = {ym_atual: atual} if atual else {}
    if ant:
        recentes[m1] = ant
    tipos_a.update(tipos)
    ativos = set()
    for d in recentes.values():
        ativos.update(d)
    if len(ativos) < 1000:
        raise RuntimeError("informe diário da CVM sem dados suficientes")
    for k in list(F):
        if k not in ativos:
            del F[k]
    log("fundos ativos:", len(ativos))

    # 1) cota diária: avança em ordem cronológica até o mês M-2
    ate = estado.get("diario_ate", ym_add(INI_DIARIO, -1))
    pend = [m for m in ym_seq(ym_add(ate, 1), m2)]
    for ym in pend:
        if time.time() > LIMITE - 600:
            break
        if len(CAL):
            cortar_calendario(bisect.bisect_left(CAL, f"{ym[:4]}-{ym[4:]}-01"))
        dados, _ = ler_mes(ym, ativos)
        if dados:
            aplicar_mes(ym, dados, True, ativos)
        ate = ym
        log("diário", ym, "ok —", len(dados or {}), "fundos")
    estado["diario_ate"] = ate

    # 2) meses recentes (refeitos a cada execução, a CVM revisa)
    if ate == m2:
        cortar_calendario(bisect.bisect_left(CAL, f"{m1[:4]}-{m1[4:]}-01"))
        for ym in (m1, ym_atual):
            dados = recentes.get(ym)
            if dados is None:
                dados, t2 = ler_mes(ym, ativos)
                tipos_a.update(t2)
            if dados:
                aplicar_mes(ym, dados, True, ativos)
                log("recente", ym, "ok —", len(dados), "fundos")

    # 3) cotas de fim de mês antigas (2005 a 2018), do arquivo anual
    feitos = set(estado.get("mensal_anos", []))
    for ano in range(int(INI_DIARIO[:4]) - 1, INI_MENSAL - 1, -1):
        if str(ano) in feitos:
            continue
        if time.time() > LIMITE - 420:
            break
        for ym in ym_seq(f"{ano}01", f"{ano}12"):
            dados, _ = ler_mes(ym, ativos)
            if dados:
                aplicar_mes(ym, dados, False, ativos)
        _HIST.clear()
        feitos.add(str(ano))
        log("mensal", ano, "ok")
    estado["mensal_anos"] = sorted(feitos)

    # 4) cadastro, carteira e índices
    info = cadastro(ativos)
    hist = {}
    if estado.get("cda") != HOJE.strftime("%Y-%W") or os.environ.get("CDA") == "1":
        cart, assin, hist = carteiras(ativos, estado)
        estado["cda"] = HOJE.strftime("%Y-%W")
        estado["cda_meses"] = assin
        for k, (c0, _) in OLD.items():          # fundo sem carteira nova: mantém a anterior
            if k not in cart and c0:
                cart[k] = c0
    else:
        cart = {k: c0 for k, (c0, _) in OLD.items() if c0}
    carth = {}
    for k in ativos:
        h = dict((OLD.get(k) or (None, {}))[1])
        h.update(hist.get(k, {}))
        if h:
            carth[k] = dict(sorted(h.items())[-24:])
    global ANB
    ANB = ler_json(os.path.join(ent, "anbima_ima.json"), {})
    try:
        anbima_historico(estado)
    except Exception as e:  # noqa: BLE001
        DIAG["anbima_hist"] = str(e)[:200]
    gravar(os.path.join(sai, "anbima_ima.json"), ANB)
    bench = indices()
    velho = ler_json(os.path.join(ent, "bench.json"), {"d": {}, "m": {}})
    for nome, serie in (velho.get("m") or {}).items():          # fonte fora do ar: mantém a última coleta
        if nome not in bench["m"] and serie:
            bench["m"][nome] = serie
    for nome, serie in (velho.get("d") or {}).items():
        if nome not in bench["d"] and serie:
            s2 = list(serie[:len(CAL)])
            while len(s2) < len(CAL):
                s2.append(s2[-1] if s2 else None)
            bench["d"][nome] = s2

    # 5) gravação
    cdi_d = bench["d"].get("cdi")
    gestores, cls_l, anb_l, tip_l, adm_l = {}, {}, {}, {}, {}

    def ix(dic, v):
        if v not in dic:
            dic[v] = len(dic)
        return dic[v]
    linhas = []
    pf = os.path.join(sai, "f")
    os.makedirs(pf, exist_ok=True)
    r2 = lambda x: None if x is None else round(x, 2)  # noqa: E731
    for k in sorted(ativos):
        f = F.get(k)
        if f is None or not f.m:
            continue
        inf = info.get(k, {})
        tipo = simplifica_tipo(tipos_a.get(k) or inf.get("tpf"))
        i0, q0, r = codificar(f)
        meses = sorted(f.m)
        reg = {"c": k, "n": inf.get("n") or inf.get("nf") or ("Fundo " + k), "tipo": tipo}
        if inf.get("anb"):
            inf["anb"] = anbima_nome(inf["anb"])
        for a in ("fan", "cls", "anb", "bm", "pub", "exc", "lp", "cond", "ini", "fic", "aud", "cus", "ges", "adm", "cnf", "nf", "pai", "prev",
                  "tadm", "tadm_fte", "tperf", "itperf", "amin", "dcot", "dpag", "tsai", "car", "obj", "pol", "risco", "rsk"):
            if inf.get(a) not in (None, ""):
                reg[a] = inf[a]
        escrever_mensal(f, reg)
        if i0 is not None:
            reg.update(i0=i0, q0=q0, r=r)
        if k in cart:
            reg["cart"] = cart[k]
        elif inf.get("pai") in cart:
            reg["cart"] = cart[inf["pai"]]
        if carth.get(k):
            reg["carth"] = carth[k]
        mt = metricas(f, cdi_d)
        reg["met"] = {a: r2(b) if a != "cap" else round(b) for a, b in mt.items()}
        gravar(os.path.join(pf, k + ".json"), reg)
        u = f.m[meses[-1]]
        flags = 0
        if norm(inf.get("exc")).startswith("s"):
            flags |= 1
        pub = norm(inf.get("pub"))
        if "qualif" in pub:
            flags |= 2
        if "profis" in pub:
            flags |= 4
        if norm(inf.get("fic")).startswith("s") or " fic " in f" {norm(reg['n'])} " or "cotas" in norm(reg["n"]):
            flags |= 8
        if "fechad" in norm(inf.get("cond")):
            flags |= 16
        if inf.get("pai"):
            flags |= 32
        if mt.get("salto"):
            flags |= 64
        prim = meses[0]
        linhas.append([k, reg["n"][:90], ix(tip_l, tipo), ix(cls_l, classe_cvm(inf.get("cls"), tipo)),
                       ix(anb_l, anbima_nome(inf.get("anb"))), ix(gestores, (inf.get("ges") or "").strip()[:60]),
                       round(u[2] or 0), u[3] or 0, r2(mt.get("rm")), r2(mt.get("ra")), r2(mt.get("r12")), r2(mt.get("r24")),
                       r2(mt.get("r36")), r2(mt.get("r60")), r2(mt.get("v12")), r2(mt.get("sh")), r2(mt.get("dd")),
                       round(mt.get("cap", 0)), f"{prim[:4]}-{prim[4:]}", flags, inf.get("tadm"),
                       CAL[f.i[-1]] if len(f.i) else None, inf.get("amin"),
                       (inf.get("dcot") or 0) + (inf.get("dpag") or 0) if inf.get("dcot") is not None or inf.get("dpag") is not None else None,
                       inf.get("tperf"), ix(adm_l, (inf.get("adm") or "").strip()[:60])])
    inv = lambda d: [a for a, _ in sorted(d.items(), key=lambda x: x[1])]  # noqa: E731
    ult = CAL[-1] if CAL else None
    cab = {
        "dt": ult, "geradoEm": dt.datetime.now().isoformat(timespec="seconds"),
        "cols": ["cnpj", "nome", "tipo", "classe", "anbima", "gestor", "pl", "cotistas", "rm", "ra", "r12", "r24", "r36", "r60",
                 "v12", "sharpe", "dd36", "capt12", "inicio", "flags", "tadm", "ult", "amin", "dres", "tperf", "adm"],
        "tipos": inv(tip_l), "classes": inv(cls_l), "anbima": inv(anb_l), "gestores": inv(gestores), "adms": inv(adm_l),
        "cdi12": r2(metricas_cdi(cdi_d)),
        "fonte": "CVM – informe diário, cadastro, extrato, lâmina e CDA"}
    gravar(os.path.join(sai, "idx.json"), dict(cab, rows=linhas))
    # índice em duas partes para o app abrir mais rápido: primeiro os fundos não exclusivos, depois os exclusivos
    excl = [r for r in linhas if (r[19] or 0) & 1]
    gravar(os.path.join(sai, "idx_p.json"), dict(cab, rows=[r for r in linhas if not (r[19] or 0) & 1], resto=len(excl)))
    gravar(os.path.join(sai, "idx_x.json"), {"geradoEm": cab["geradoEm"], "rows": excl})
    gravar(os.path.join(sai, "cal.json"), {"d": CAL})
    gravar(os.path.join(sai, "bench.json"), bench)
    estado.update(geradoEm=dt.datetime.now().isoformat(timespec="seconds"), fundos=len(linhas), dias=len(CAL),
                  diag=DIAG, minutos=round((time.time() - INICIO) / 60, 1))
    gravar(os.path.join(sai, "estado.json"), estado)
    log("gravado:", len(linhas), "fundos; diário até", estado["diario_ate"], "; anos mensais", estado["mensal_anos"])


def metricas_cdi(cdi_d):
    if not cdi_d or not CAL:
        return None
    alvo = data_menos_meses(CAL[-1], 12)
    p = bisect.bisect_right(CAL, alvo) - 1
    c = 1.0
    for j in range(p + 1, len(CAL)):
        c *= 1 + (cdi_d[j] or 0) / 100
    return (c - 1) * 100


if __name__ == "__main__":
    principal()
