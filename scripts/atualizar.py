#!/usr/bin/env python3
"""
Robô de dados de mercado.

Busca dados públicos oficiais e grava arquivos JSON na pasta data/:
  data/mercado.json       retrato do dia, no mesmo formato que o app usa (market/current)
  data/td_historico.json  preços e taxas do Tesouro Direto dos últimos 90 dias úteis
  data/debentures.json    taxas indicativas ANBIMA de todas as debêntures
  data/fundos.json        cotas da CVM dos fundos listados em config/fundos.txt
  data/catalogo_debentures.json  características e agenda de todas as debêntures (SND),
                          no formato de papel do app, com a taxa ANBIMA do dia
  data/cri_cra_cvm.json   dados de todos os CRIs e CRAs do informe mensal da CVM (último mês)
  data/termos/            termos de securitização (Fundos.NET) dos códigos em config/cri_cra.txt
  data/status.json        resultado de cada fonte (ok / erro) e horário
  data/diag/              amostras das respostas de cada fonte, para conferência

Cada fonte roda separada: se uma falhar, as outras continuam e o valor
anterior daquela fonte é mantido. O script termina com erro (código 1)
quando alguma fonte falha, para o GitHub avisar por e-mail.
"""
import csv
import datetime as dt
import io
import json
import os
import re
import sys
import time
import traceback
import unicodedata
import zipfile

import requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, "data")
CONFIG = os.path.join(RAIZ, "config")
BRT = dt.timezone(dt.timedelta(hours=-3))
AGORA = dt.datetime.now(BRT)
HOJE = AGORA.date()

S = requests.Session()
S.headers.update({
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    "Accept": "text/html,application/json,text/csv,text/plain,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
})

STATUS = {}
ANBIMA_DEB = {}          # taxas ANBIMA do dia, por código (preenchido por anbima_debentures)
ANBIMA_DEB_DATA = [None]

URL_TD = ("https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3"
          "/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv")
URL_ANBIMA_PUB = "https://www.anbima.com.br/informacoes/merc-sec/arqs/ms{:%y%m%d}.txt"
URL_ANBIMA_DEB = "https://www.anbima.com.br/informacoes/merc-sec-debentures/arqs/db{:%y%m%d}.txt"
URL_SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{}/dados?formato=json&dataInicial={}&dataFinal={}"
URL_SIDRA_IPCA = "https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266/p/last%2024"
URL_CVM = "https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_{}.zip"


# ---------------------------------------------------------------- utilidades

def diag(nome, url, r=None, erro=None):
    """Guarda uma amostra da resposta em data/diag/ para conferência."""
    try:
        os.makedirs(os.path.join(DADOS, "diag"), exist_ok=True)
        linhas = [f"url: {url}", f"em: {AGORA.isoformat(timespec='seconds')}"]
        if r is not None:
            linhas += [f"status: {r.status_code}", f"tipo: {r.headers.get('content-type', '')}",
                       f"bytes: {len(r.content)}", "", texto(r)[:6000]]
        if erro is not None:
            linhas += [f"erro: {erro}"]
        with open(os.path.join(DADOS, "diag", nome + ".txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(linhas))
    except Exception:  # noqa: BLE001
        pass


def baixar(url, tentativas=3, aceita_404=False, timeout=120, dados=None, headers=None):
    ultimo = None
    for i in range(tentativas):
        try:
            if dados is not None:
                r = S.post(url, data=dados, timeout=timeout, headers=headers)
            else:
                r = S.get(url, timeout=timeout, headers=headers)
            if r.status_code == 404 and aceita_404:
                return None
            r.raise_for_status()
            return r
        except Exception as e:  # noqa: BLE001
            ultimo = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"falha ao baixar {url}: {ultimo}")


def texto(r):
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return r.content.decode(enc)
        except UnicodeDecodeError:
            continue
    return r.content.decode("latin-1", errors="replace")


def num(s):
    if s is None:
        return None
    s = str(s).strip()
    if s in ("", "-", "--", "N/D", "n/d"):
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def data_dmy(s):
    s = s.strip()
    try:
        return dt.datetime.strptime(s, "%d/%m/%Y").date().isoformat()
    except ValueError:
        return None


def data_ymd(s):
    s = s.strip()
    for f in ("%Y%m%d", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return dt.datetime.strptime(s, f).date().isoformat()
        except ValueError:
            continue
    return None


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().lower()


def dias_recentes(n):
    """Dias corridos de hoje para trás, só segunda a sexta."""
    d = HOJE
    saida = []
    while len(saida) < n:
        if d.weekday() < 5:
            saida.append(d)
        d -= dt.timedelta(days=1)
    return saida


def ler_json(nome, padrao):
    caminho = os.path.join(DADOS, nome)
    try:
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return padrao


def gravar_json(nome, obj):
    caminho = os.path.join(DADOS, nome)
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    os.replace(tmp, caminho)


def fonte(nome):
    """Decorador: roda a fonte isolada e registra ok/erro em STATUS."""
    def deco(func):
        def rodar(*a, **k):
            inicio = time.time()
            try:
                info = func(*a, **k) or {}
                STATUS[nome] = {"ok": True, "em": AGORA.isoformat(timespec="seconds"),
                                "segundos": round(time.time() - inicio, 1), **info}
                print(f"[ok]   {nome}: {info}")
            except Exception as e:  # noqa: BLE001
                STATUS[nome] = {"ok": False, "em": AGORA.isoformat(timespec="seconds"),
                                "erro": str(e)[:500]}
                print(f"[ERRO] {nome}: {e}")
                traceback.print_exc()
        return rodar
    return deco


# ---------------------------------------------------------------- Tesouro Direto

TD_TIPOS = {
    "tesouro selic": "LFT",
    "tesouro prefixado": "LTN",
    "tesouro prefixado com juros semestrais": "NTNF",
    "tesouro ipca+": "NTNBP",
    "tesouro ipca+ com juros semestrais": "NTNB",
    "tesouro renda+ aposentadoria extra": "RENDA",
    "tesouro educa+": "EDUCA",
    "tesouro igpm+ com juros semestrais": "IGPM",
}


def td_vencimento(tipo, venc):
    # O app identifica RendA+ e Educa+ pelo ano de início dos pagamentos (AAAA-01-15).
    if tipo == "RENDA":
        return f"{int(venc[:4]) - 19}-01-15"
    if tipo == "EDUCA":
        return f"{int(venc[:4]) - 4}-01-15"
    return venc


@fonte("tesouro_direto")
def tesouro_direto(mercado):
    r = baixar(URL_TD, timeout=300)
    linhas = csv.reader(io.StringIO(texto(r)), delimiter=";")
    cab = [norm(c) for c in next(linhas)]

    def col(*nomes):
        for n in nomes:
            if n in cab:
                return cab.index(n)
        raise RuntimeError(f"coluna não encontrada: {nomes} em {cab}")

    c_tipo = col("tipo titulo")
    c_venc = col("data vencimento")
    c_base = col("data base")
    c_tc = col("taxa compra manha")
    c_tv = col("taxa venda manha")
    c_pv = col("pu venda manha")

    por_dia = {}
    for L in linhas:
        if len(L) <= max(c_tipo, c_venc, c_base, c_tc, c_tv, c_pv):
            continue
        tipo = TD_TIPOS.get(norm(L[c_tipo]))
        venc = data_dmy(L[c_venc])
        base = data_dmy(L[c_base])
        if not tipo or not venc or not base:
            continue
        tv, pv, tc = num(L[c_tv]), num(L[c_pv]), num(L[c_tc])
        if tv is None:
            continue
        por_dia.setdefault(base, []).append(
            [tipo, td_vencimento(tipo, venc), tv, pv or 0, tc if tc else None])

    if not por_dia:
        raise RuntimeError("CSV do Tesouro veio sem linhas válidas")
    datas = sorted(por_dia)[-90:]
    ultima = datas[-1]
    mercado["td"] = {"source": "Tesouro Transparente (Tesouro Nacional)",
                     "date": ultima, "ALL": sorted(por_dia[ultima])}
    gravar_json("td_historico.json", {d: sorted(por_dia[d]) for d in datas})
    return {"data": ultima, "titulos": len(por_dia[ultima])}


# ---------------------------------------------------------------- ANBIMA: títulos públicos

ANBIMA_PUB = {"LTN": "LTN", "NTN-F": "NTNF", "NTN-B": "NTNB", "LFT": "LFT"}


def ler_arroba(txt):
    return [L.split("@") for L in txt.splitlines() if "@" in L]


@fonte("anbima_titulos_publicos")
def anbima_publicos(mercado):
    for dia in dias_recentes(8):
        r = baixar(URL_ANBIMA_PUB.format(dia), aceita_404=True)
        if r is None or len(r.content) < 500 or r.content.lstrip()[:1] == b"<":
            continue
        linhas = ler_arroba(texto(r))
        cab_i = next((i for i, L in enumerate(linhas) if norm(L[0]).startswith("titulo")), None)
        if cab_i is None:
            continue
        cab = [norm(c) for c in linhas[cab_i]]
        c_venc = next(i for i, c in enumerate(cab) if "vencimento" in c)
        c_tx = next(i for i, c in enumerate(cab) if "indicativ" in c and "interv" not in c)
        c_pu = cab.index("pu")
        saida = {k: [] for k in ANBIMA_PUB.values()}
        for L in linhas[cab_i + 1:]:
            k = ANBIMA_PUB.get(L[0].strip().upper())
            if not k or len(L) <= max(c_venc, c_tx, c_pu):
                continue
            venc, tx, pu = data_ymd(L[c_venc]), num(L[c_tx]), num(L[c_pu])
            if venc and tx is not None:
                saida[k].append([venc, tx, pu or 0])
        if not any(saida.values()):
            continue
        for k in saida:
            saida[k].sort()
        mercado["anbima"] = saida
        mercado["refDate"] = dia.isoformat()
        return {"data": dia.isoformat(), "titulos": sum(len(v) for v in saida.values())}
    raise RuntimeError("nenhum arquivo ANBIMA de títulos públicos nos últimos 8 dias úteis")


# ---------------------------------------------------------------- ANBIMA: debêntures

@fonte("anbima_debentures")
def anbima_debentures():
    for dia in dias_recentes(8):
        r = baixar(URL_ANBIMA_DEB.format(dia), aceita_404=True)
        if r is None or len(r.content) < 500 or r.content.lstrip()[:1] == b"<":
            continue
        linhas = ler_arroba(texto(r))
        papeis = {}
        cab = None
        for L in linhas:
            n = [norm(c) for c in L]
            if any(c.startswith("codigo") for c in n) and any("taxa indicativa" in c for c in n):
                cab = n
                continue
            if cab is None:
                continue
            codigo = L[0].strip().upper()
            if not re.fullmatch(r"[A-Z0-9]{4,14}", codigo):
                continue

            def campo(chave, excluir=None):
                for i, c in enumerate(cab):
                    if chave in c and (excluir is None or excluir not in c) and i < len(L):
                        return L[i].strip()
                return ""

            papeis[codigo] = {
                "nome": campo("nome"),
                "venc": data_ymd(campo("venc")) if campo("venc") else None,
                "indice": campo("indice"),
                "taxa": num(campo("taxa indicativa")),
                "pu": num(campo("pu", excluir="par")),
                "puPar": num(campo("pu par")),
                "duration": num(campo("duration")),
            }
        if papeis:
            ANBIMA_DEB.update(papeis)
            ANBIMA_DEB_DATA[0] = dia.isoformat()
            gravar_json("debentures.json", {"refDate": dia.isoformat(),
                                            "source": "ANBIMA – taxas indicativas de debêntures",
                                            "papers": papeis})
            return {"data": dia.isoformat(), "papeis": len(papeis)}
    raise RuntimeError("nenhum arquivo ANBIMA de debêntures nos últimos 8 dias úteis")


# ---------------------------------------------------------------- Banco Central (SGS)

def sgs(serie, dias):
    ini = (HOJE - dt.timedelta(days=dias)).strftime("%d/%m/%Y")
    fim = HOJE.strftime("%d/%m/%Y")
    r = baixar(URL_SGS.format(serie, ini, fim))
    return [(data_dmy(x["data"]), num(x["valor"])) for x in r.json() if num(x["valor"]) is not None]


@fonte("bcb_cdi_selic")
def bcb(mercado):
    cdi = sgs(12, 180)          # CDI diário, % ao dia
    selic = sgs(1178, 30)       # Selic over anualizada, % a.a.
    selic_m = sgs(4390, 800)    # Selic acumulada no mês, %
    if not cdi or not selic:
        raise RuntimeError("séries do Banco Central vieram vazias")
    mercado["cdiDaily"] = {d: v for d, v in cdi if d}
    mercado["selicOver"] = selic[-1][1]
    mercado["selicMonthly"] = {d[:4] + d[5:7]: v for d, v in selic_m if d}
    return {"cdi_ate": cdi[-1][0], "selic_over": selic[-1][1]}


# ---------------------------------------------------------------- IBGE (IPCA número-índice)

@fonte("ibge_ipca")
def ipca(mercado):
    r = baixar(URL_SIDRA_IPCA)
    dados = r.json()[1:]
    saida = {}
    for x in dados:
        periodo = next((v for k, v in x.items() if k.endswith("C") and re.fullmatch(r"\d{6}", str(v))), None)
        val = num(x.get("V"))
        if periodo and val:
            saida[periodo] = val
    if not saida:
        raise RuntimeError("SIDRA sem valores de IPCA")
    mercado["ipca"] = saida
    return {"ultimo_mes": max(saida)}


# ---------------------------------------------------------------- CVM (cotas de fundos)

def so_cnpj(s):
    return re.sub(r"[^0-9A-Z]", "", s.upper())


@fonte("cvm_fundos")
def cvm_fundos():
    caminho = os.path.join(CONFIG, "fundos.txt")
    alvo = set()
    if os.path.exists(caminho):
        for L in open(caminho, encoding="utf-8"):
            L = L.split("#")[0].strip()
            if L:
                alvo.add(so_cnpj(L))
    if not alvo:
        return {"aviso": "nenhum CNPJ em config/fundos.txt"}

    anterior = ler_json("fundos.json", {}).get("funds", {})
    series = {c: dict(anterior.get(c, {}).get("serie", {})) for c in alvo}
    meses = [HOJE.strftime("%Y%m"), (HOJE.replace(day=1) - dt.timedelta(days=1)).strftime("%Y%m")]
    lidos = 0
    for mes in meses:
        r = baixar(URL_CVM.format(mes), aceita_404=True, timeout=300)
        if r is None:
            continue
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            for nome in z.namelist():
                with z.open(nome) as f:
                    leitor = csv.reader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";")
                    cab = next(leitor)
                    c_cnpj = next(i for i, c in enumerate(cab) if c.startswith("CNPJ_FUNDO"))
                    c_data = cab.index("DT_COMPTC")
                    c_cota = cab.index("VL_QUOTA")
                    c_pl = cab.index("VL_PATRIM_LIQ") if "VL_PATRIM_LIQ" in cab else None
                    for L in leitor:
                        c = so_cnpj(L[c_cnpj])
                        if c in alvo:
                            cota = num(L[c_cota])
                            if cota:
                                series[c][L[c_data]] = [cota, num(L[c_pl]) if c_pl is not None else None]
                                lidos += 1
    saida = {}
    for c, s in series.items():
        datas = sorted(s)[-120:]
        if datas:
            saida[c] = {"serie": {d: s[d] for d in datas},
                        "ultima": {"data": datas[-1], "cota": s[datas[-1]][0], "pl": s[datas[-1]][1]}}
    gravar_json("fundos.json", {"source": "CVM – informe diário", "funds": saida})
    faltando = sorted(alvo - set(saida))
    return {"fundos": len(saida), "linhas": lidos, "sem_dados": faltando}


# ---------------------------------------------------------------- Tesouro Direto: site oficial (dados do dia)

URL_TD_JSON = "https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondsinfo.json"
URL_TD_CSV_RESGATAR = "https://www.tesourodireto.com.br/documents/d/guest/rendimento-resgatar-csv?download=true"
URL_TD_CSV_INVESTIR = "https://www.tesourodireto.com.br/documents/d/guest/rendimento-investir-csv?download=true"


def td_tipo_por_nome(nome):
    n = norm(nome)
    if n.startswith("tesouro selic"):
        return "LFT"
    if n.startswith("tesouro prefixado com juros"):
        return "NTNF"
    if n.startswith("tesouro prefixado"):
        return "LTN"
    if n.startswith("tesouro ipca+ com juros"):
        return "NTNB"
    if n.startswith("tesouro ipca+"):
        return "NTNBP"
    if n.startswith("tesouro renda+") or n.startswith("tesouro renda"):
        return "RENDA"
    if n.startswith("tesouro educa"):
        return "EDUCA"
    return None


def td_do_json():
    r = baixar(URL_TD_JSON, tentativas=2, headers={"Referer": "https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm"})
    diag("tesouro_direto_json", URL_TD_JSON, r)
    resp = r.json().get("response", {})
    data = (resp.get("TrsrBondMkt", {}).get("qtnDtTm") or "")[:10]
    linhas = []
    for item in resp.get("TrsrBdTradgList", []):
        b = item.get("TrsrBd", {})
        tipo = td_tipo_por_nome(b.get("nm", ""))
        venc = (b.get("mtrtyDt") or "")[:10]
        if not tipo or not venc:
            continue
        venda, pu, compra = b.get("anulRedRate"), b.get("untrRedVal"), b.get("anulInvstmtRate")
        if venda in (None, 0) and compra in (None, 0):
            continue
        linhas.append([tipo, td_vencimento(tipo, venc), venda if venda else compra, pu or 0, compra or None])
    return data, linhas


def td_dos_csv():
    """Planilhas de rentabilidade do site do Tesouro Direto (formato conferido pela amostra em data/diag)."""
    tabelas = {}
    for nome, url in (("resgatar", URL_TD_CSV_RESGATAR), ("investir", URL_TD_CSV_INVESTIR)):
        r = baixar(url, tentativas=2)
        diag("tesouro_direto_csv_" + nome, url, r)
        txt = texto(r)
        sep = ";" if txt.count(";") > txt.count(",") else ","
        linhas = list(csv.reader(io.StringIO(txt), delimiter=sep))
        cab_i = next((i for i, L in enumerate(linhas) if any("titulo" in norm(c) for c in L)), None)
        if cab_i is None:
            raise RuntimeError(f"CSV {nome}: cabeçalho não encontrado")
        cab = [norm(c) for c in linhas[cab_i]]
        c_nome = next(i for i, c in enumerate(cab) if "titulo" in c)
        c_taxa = next((i for i, c in enumerate(cab) if "rentabilidade" in c or "taxa" in c), None)
        c_pu = next((i for i, c in enumerate(cab) if "preco" in c or "pu" == c or "valor" in c), None)
        c_venc = next((i for i, c in enumerate(cab) if "vencimento" in c), None)
        dados = {}
        for L in linhas[cab_i + 1:]:
            if len(L) <= c_nome:
                continue
            tipo = td_tipo_por_nome(L[c_nome])
            if not tipo:
                continue
            venc = None
            if c_venc is not None and c_venc < len(L):
                venc = data_dmy(L[c_venc]) or data_ymd(L[c_venc])
            if not venc:
                m = re.search(r"(20\d\d)", L[c_nome])
                venc = m and f"{m.group(1)}-01-01"
            taxa_txt = L[c_taxa] if c_taxa is not None and c_taxa < len(L) else ""
            m = re.search(r"(-?\d+[.,]\d+)\s*%?\s*$", taxa_txt.strip())
            taxa = num(m.group(1)) if m else num(taxa_txt)
            pu = num(re.sub(r"[^\d,.-]", "", L[c_pu])) if c_pu is not None and c_pu < len(L) else None
            if venc and taxa is not None:
                dados[(tipo, td_vencimento(tipo, venc))] = (taxa, pu)
        tabelas[nome] = dados
    linhas = []
    for chave, (taxa, pu) in tabelas.get("resgatar", {}).items():
        compra = tabelas.get("investir", {}).get(chave, (None, None))[0]
        linhas.append([chave[0], chave[1], taxa, pu or 0, compra])
    return HOJE.isoformat(), linhas


@fonte("tesouro_direto_site")
def tesouro_direto_site(mercado):
    """Tenta o site oficial do Tesouro Direto, que costuma estar no dia. Se falhar, vale o Tesouro Transparente."""
    erros = []
    for nome, func in (("json", td_do_json), ("csv", td_dos_csv)):
        try:
            data, linhas = func()
            if len(linhas) >= 10:
                linhas.sort()
                mercado["td"] = {"source": "Tesouro Direto (site oficial)", "date": data or HOJE.isoformat(), "ALL": linhas}
                hist = ler_json("td_historico.json", {})
                hist[mercado["td"]["date"]] = linhas
                gravar_json("td_historico.json", {d: hist[d] for d in sorted(hist)[-90:]})
                return {"via": nome, "data": mercado["td"]["date"], "titulos": len(linhas)}
            erros.append(f"{nome}: só {len(linhas)} títulos")
        except Exception as e:  # noqa: BLE001
            erros.append(f"{nome}: {str(e)[:200]}")
    # Não é erro grave: o Tesouro Transparente já preencheu os dados.
    return {"aviso": "site do Tesouro Direto indisponível; mantidos os dados do Tesouro Transparente", "detalhe": erros}


# ---------------------------------------------------------------- ANBIMA: curva de juros (ETTJ)

URL_ETTJ = "https://www.anbima.com.br/informacoes/est-termo/CZ-down.asp"


@fonte("anbima_curva_juros")
def anbima_curva(mercado):
    for dia in dias_recentes(6):
        r = baixar(URL_ETTJ, dados={"Idioma": "PT", "Dt_Ref": dia.strftime("%d/%m/%Y"), "saida": "csv"})
        txt = texto(r)
        if dia == dias_recentes(1)[0] or "vertice" in norm(txt):
            diag("anbima_curva_juros", URL_ETTJ + " (POST " + dia.isoformat() + ")", r)
        curva_pre, curva_ipca, implicita = [], [], []
        for L in txt.splitlines():
            p = [c.strip() for c in L.split(";")]
            if len(p) < 3 or not re.fullmatch(r"[\d.]+", p[0]):
                continue
            du = int(p[0].replace(".", ""))
            ipca_r, pre_r = num(p[1]), num(p[2])
            if pre_r and 2 < pre_r < 40:
                curva_pre.append([du, pre_r])
            if ipca_r is not None and -5 < ipca_r < 20:
                curva_ipca.append([du, ipca_r])
            if len(p) > 3 and num(p[3]) is not None:
                implicita.append([du, num(p[3])])
        if len(curva_pre) >= 5:
            mercado["curvePre"] = curva_pre
            mercado["curveIpca"] = curva_ipca
            mercado["inflacaoImplicita"] = implicita
            mercado["curveDate"] = dia.isoformat()
            return {"data": dia.isoformat(), "vertices": len(curva_pre)}
    raise RuntimeError("curva de juros ANBIMA não encontrada nos últimos 6 dias úteis")


# ---------------------------------------------------------------- SND: catálogo de debêntures

URL_SND_CARAC = "https://www.debentures.com.br/exploreosnd/consultaadados/emissoesdedebentures/caracteristicas_e.asp?tip_deb={}&op_exc=False"
URL_SND_AGENDA = "https://www.debentures.com.br/exploreosnd/consultaadados/eventosfinanceiros/agenda_e.asp"


def tabela_tab(txt):
    """Lê um arquivo 'texto delimitado por Tab' do SND: acha o cabeçalho e devolve (cabeçalho, linhas)."""
    linhas = [L.split("\t") for L in txt.splitlines()]
    for i, L in enumerate(linhas):
        n = [norm(c) for c in L]
        if len(L) >= 5 and any(c in ("ativo", "codigo do ativo", "codigo") for c in n):
            return n, [x for x in linhas[i + 1:] if len(x) >= 3]
    raise RuntimeError("cabeçalho da tabela não encontrado")


def coluna(cab, *partes, evitar=()):
    for i, c in enumerate(cab):
        if all(p in c for p in partes) and not any(e in c for e in evitar):
            return i
    return None


def pega(L, i):
    return L[i].strip() if i is not None and i < len(L) else ""


def mapear_indice(tipo, mult, juros):
    t = norm(tipo)
    if t.startswith("di"):
        if mult and abs(mult - 100) > 0.001 and not juros:
            return "DI_PCT", mult
        return "DI_SPREAD", juros or 0.0
    if "ipca" in t:
        return "IPCA", juros
    if "pre" in t or "sem indice" in t:
        return "PRE", juros
    return None, juros


@fonte("snd_catalogo_debentures")
def snd_catalogo():
    # 1. características (públicas e privadas)
    carac = {}
    colunas_vistas = {}
    for tipo in ("publicas", "privadas"):
        url = URL_SND_CARAC.format(tipo)
        try:
            r = baixar(url, timeout=300)
        except Exception as e:  # noqa: BLE001
            diag("snd_caracteristicas_" + tipo, url, erro=e)
            continue
        diag("snd_caracteristicas_" + tipo, url, r)
        cab, linhas = tabela_tab(texto(r))
        colunas_vistas[tipo] = cab
        c = {
            "codigo": coluna(cab, "codigo do ativo") if coluna(cab, "codigo do ativo") is not None else coluna(cab, "ativo", evitar=("situacao",)),
            "emissor": coluna(cab, "empresa") if coluna(cab, "empresa") is not None else coluna(cab, "emissor"),
            "serie": coluna(cab, "serie"),
            "emissao": coluna(cab, "emissao", evitar=("data", "registro", "tipo")),
            "isin": coluna(cab, "isin"),
            "situacao": coluna(cab, "situacao"),
            "data_emissao": coluna(cab, "data de emissao") if coluna(cab, "data de emissao") is not None else coluna(cab, "data da emissao"),
            "vencimento": coluna(cab, "data de vencimento", evitar=("novo", "alterad")) if coluna(cab, "data de vencimento", evitar=("novo", "alterad")) is not None else coluna(cab, "vencimento", evitar=("novo", "tipo", "alterad")),
            "novo_venc": coluna(cab, "novo vencimento"),
            "inicio_rent": coluna(cab, "inicio da rentabilidade"),
            "vne": coluna(cab, "nominal na emissao"),
            "indice": coluna(cab, "indice") if coluna(cab, "indice", evitar=("referencia", "criterio")) is not None else coluna(cab, "remuneracao"),
            "mult": coluna(cab, "multiplicador"),
            "juros": coluna(cab, "juros", "taxa") if coluna(cab, "juros", "taxa") is not None else coluna(cab, "spread"),
            "prazo": coluna(cab, "juros", "prazo"),
            "tipo_amort": coluna(cab, "tipo de amortizacao"),
            "dia_ref": coluna(cab, "dia de referencia"),
            "incentivada": coluna(cab, "12.431") if coluna(cab, "12.431") is not None else coluna(cab, "incentivad"),
        }
        c["indice"] = coluna(cab, "indice", evitar=("referencia", "criterio")) if coluna(cab, "indice", evitar=("referencia", "criterio")) is not None else c["indice"]
        for L in linhas:
            cod = pega(L, c["codigo"]).upper()
            if not re.fullmatch(r"[A-Z0-9]{4,12}", cod):
                continue
            carac[cod] = {k: pega(L, i) for k, i in c.items()}
    if not carac:
        raise RuntimeError("SND: nenhuma característica lida (ver data/diag/snd_caracteristicas_*.txt)")

    # 2. agenda de eventos (todas as debêntures)
    agenda = {}
    try:
        r = baixar(URL_SND_AGENDA, timeout=300)
        diag("snd_agenda", URL_SND_AGENDA, r)
        cab, linhas = tabela_tab(texto(r))
        c_ativo = coluna(cab, "ativo")
        c_evento = coluna(cab, "evento", evitar=("data",))
        c_data_ev = coluna(cab, "data do evento")
        c_data_pg = coluna(cab, "pagamento") if coluna(cab, "pagamento") is not None else coluna(cab, "liquidacao")
        c_taxa = coluna(cab, "taxa") if coluna(cab, "taxa") is not None else coluna(cab, "perc")
        for L in linhas:
            cod = pega(L, c_ativo).upper()
            ev = norm(pega(L, c_evento))
            dpg = data_dmy(pega(L, c_data_pg)) or data_dmy(pega(L, c_data_ev))
            if not cod or not dpg:
                continue
            agenda.setdefault(cod, []).append((dpg, ev, num(pega(L, c_taxa))))
    except Exception as e:  # noqa: BLE001
        diag("snd_agenda", URL_SND_AGENDA, erro=e)
        STATUS["snd_agenda"] = {"ok": False, "em": AGORA.isoformat(timespec="seconds"), "erro": str(e)[:500]}

    # 3. monta cada papel no formato do app
    catalogo, sem_formula = {}, 0
    for cod, x in carac.items():
        situ = norm(x.get("situacao", ""))
        if situ and "registrad" not in situ:
            continue
        venc = data_dmy(x.get("novo_venc", "")) or data_dmy(x.get("vencimento", ""))
        if venc and venc < HOJE.isoformat():
            continue
        juros = num(x.get("juros"))
        mult = num(x.get("mult"))
        idx, taxa = mapear_indice(x.get("indice", ""), mult, juros)
        basis = "VNE" if "nominal de emissao" in norm(x.get("tipo_amort", "")) else "SALDO"
        eventos = {}
        for dpg, ev, tx in sorted(agenda.get(cod, [])):
            e = eventos.setdefault(dpg, [0, 0.0])
            if ev.startswith("juros") or ev.startswith("vencimento"):
                e[0] = 1
            if ev.startswith("amortiza") and tx:
                e[1] += tx
            if ev.startswith("vencimento"):
                e[1] = -1  # marca: resgate do saldo no vencimento
        sched, acum = [], 0.0
        for d in sorted(eventos):
            j, a = eventos[d]
            if a == -1:
                a = 100.0 if basis == "SALDO" else max(0.0, round(100.0 - acum, 6))
            acum += a if basis == "VNE" else 0
            sched.append([d, j, round(a, 6)])
        if venc and (not sched or sched[-1][0] < venc):
            sched.append([venc, 1, 100.0 if basis == "SALDO" else max(0.0, round(100.0 - acum, 6))])
        se = x.get("serie", "").lstrip("0") or x.get("serie", "")
        em = x.get("emissao", "").lstrip("0") or x.get("emissao", "")
        nome = x.get("emissor", "") + (f" – {em}ª emissão" if em else "") + (f", {se}ª série" if se and se.upper() not in ("UNI", "ÚNI", "UNICA") else "")
        papel = {
            "code": cod, "type": "DEB", "name": nome.strip(" –,"), "issuer": x.get("emissor", ""),
            "isin": x.get("isin", ""), "incentivada": norm(x.get("incentivada", "")).startswith("s"),
            "index": idx or "OUTRO", "indexRaw": x.get("indice", ""), "rate": taxa, "vne": num(x.get("vne")),
            "start": data_dmy(x.get("inicio_rent", "")) or data_dmy(x.get("data_emissao", "")),
            "maturity": venc, "basis": basis, "schedule": sched,
            "official": True, "sources": ["SND – debentures.com.br (características e agenda de eventos)"],
            "status": "ok" if idx and taxa is not None and sched else "incompleto",
            "updatedAt": AGORA.isoformat(timespec="seconds"), "notes": "",
        }
        dia_ref = num(x.get("dia_ref"))
        if idx == "IPCA" and dia_ref:
            papel["annivDay"] = int(dia_ref)
        prazo = norm(x.get("prazo", ""))
        if "360" in prazo:
            papel["dayBasis"] = "dc360"
        elif "365" in prazo:
            papel["dayBasis"] = "dc365"
        a = ANBIMA_DEB.get(cod)
        if a and a.get("taxa") is not None:
            papel["anbima"] = {"refDate": ANBIMA_DEB_DATA[0], "rate": a["taxa"], "pu": a.get("pu")}
            papel["sources"].append("ANBIMA – taxas indicativas de debêntures")
        if papel["status"] != "ok":
            sem_formula += 1
        catalogo[cod] = papel

    gravar_json("catalogo_debentures.json", {"geradoEm": AGORA.isoformat(timespec="seconds"),
                                              "taxasAnbima": ANBIMA_DEB_DATA[0], "papers": catalogo})
    gravar_json("diag/snd_colunas.json", colunas_vistas)
    com_agenda = sum(1 for p in catalogo.values() if len(p["schedule"]) > 1)
    com_anbima = sum(1 for p in catalogo.values() if "anbima" in p)
    return {"papeis": len(catalogo), "com_agenda": com_agenda, "com_taxa_anbima": com_anbima,
            "incompletos": sem_formula, "caracteristicas_lidas": len(carac), "ativos_na_agenda": len(agenda)}


# ---------------------------------------------------------------- CVM: informes mensais de CRI e CRA

URL_CVM_SEC = "https://dados.cvm.gov.br/dados/SECURIT/DOC/INF_MENSAL_{tipo}/DADOS/inf_mensal_{t}_{ano}.zip"
CRI_CRA = {}   # código -> campos do informe mensal (preenchido por cvm_cri_cra)


def chave_certificado(cab):
    for i, c in enumerate(cab):
        n = norm(c)
        if "codigo" in n and ("certificado" in n or "_if" in n or n.endswith(" if") or "ativo" in n):
            return i
    return None


@fonte("cvm_cri_cra")
def cvm_cri_cra():
    resumo = {}
    colunas = {}
    for tipo in ("CRI", "CRA"):
        conteudo = None
        for ano in (HOJE.year, HOJE.year - 1):
            url = URL_CVM_SEC.format(tipo=tipo, t=tipo.lower(), ano=ano)
            r = baixar(url, aceita_404=True, timeout=300)
            if r is not None:
                conteudo, url_usada = r.content, url
                break
        if conteudo is None:
            raise RuntimeError(f"informe mensal de {tipo} não encontrado na CVM")
        n_tipo = 0
        with zipfile.ZipFile(io.BytesIO(conteudo)) as z:
            for nome in z.namelist():
                if not nome.lower().endswith(".csv"):
                    continue
                quadro = re.sub(r"^inf_mensal_(cri|cra)_?|_?\d{4}\.csv$", "", nome.lower()) or "geral"
                with z.open(nome) as f:
                    leitor = csv.reader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";")
                    try:
                        cab = next(leitor)
                    except StopIteration:
                        continue
                    colunas[f"{tipo}/{nome}"] = cab
                    c_cod = chave_certificado(cab)
                    c_comp = next((i for i, c in enumerate(cab) if "competencia" in norm(c) or norm(c).startswith("data_ref")), None)
                    if c_cod is None:
                        continue
                    for L in leitor:
                        if len(L) <= c_cod:
                            continue
                        cod = re.sub(r"\s", "", L[c_cod]).upper()
                        if not cod:
                            continue
                        comp = L[c_comp].strip() if c_comp is not None and c_comp < len(L) else ""
                        comp = data_ymd(comp) or comp
                        reg = CRI_CRA.setdefault(cod, {"tipo": tipo, "competencia": "", "quadros": {}})
                        if comp and comp < reg["competencia"]:
                            continue
                        if comp > reg["competencia"]:
                            reg["competencia"] = comp
                            reg["quadros"] = {k: v for k, v in reg["quadros"].items() if v.get("_comp") == comp}
                        q = reg["quadros"].setdefault(quadro, {"_comp": comp})
                        for k, v in zip(cab, L):
                            v = v.strip()
                            if v and k not in q:
                                q[k] = v
                        n_tipo += 1
        diag("cvm_" + tipo.lower(), url_usada, erro=f"lido; {n_tipo} linhas")
        resumo[tipo] = sum(1 for v in CRI_CRA.values() if v["tipo"] == tipo)
    gravar_json("diag/cvm_cri_cra_colunas.json", colunas)
    gravar_json("cri_cra_cvm.json", {"geradoEm": AGORA.isoformat(timespec="seconds"), "certificados": CRI_CRA})
    return {"certificados": resumo}


# ---------------------------------------------------------------- Fundos.NET: termos de securitização

URL_FNET_BUSCA = "https://fnet.bmfbovespa.com.br/fnet/publico/pesquisarGerenciadorDocumentosDados"
URL_FNET_DOC = "https://fnet.bmfbovespa.com.br/fnet/publico/downloadDocumento?id={}"


def campo_reg(reg, *partes):
    for q in reg.get("quadros", {}).values():
        for k, v in q.items():
            if all(p in norm(k) for p in partes):
                return v
    return ""


@fonte("fundosnet_termos")
def fundosnet_termos():
    caminho = os.path.join(CONFIG, "cri_cra.txt")
    codigos = []
    if os.path.exists(caminho):
        for L in open(caminho, encoding="utf-8"):
            L = L.split("#")[0].strip().upper()
            if L:
                codigos.append(re.sub(r"\s", "", L))
    if not codigos:
        return {"aviso": "nenhum código em config/cri_cra.txt"}
    os.makedirs(os.path.join(DADOS, "termos"), exist_ok=True)
    indice = ler_json("termos/indice.json", {})
    feitos, faltando = [], []
    for cod in codigos:
        if indice.get(cod, {}).get("arquivo") and os.path.exists(os.path.join(DADOS, "termos", indice[cod]["arquivo"])):
            feitos.append(cod)
            continue
        reg = CRI_CRA.get(cod, {})
        cnpj = re.sub(r"\D", "", campo_reg(reg, "cnpj", "securitizadora") or campo_reg(reg, "cnpj"))
        isin = campo_reg(reg, "isin")
        emissao = campo_reg(reg, "emissao")
        serie = campo_reg(reg, "serie")
        achado = None
        for params in (
            {"d": 0, "s": 0, "l": 200, "o[0][dataEntrega]": "desc", "cnpjFundo": cnpj, "idCategoriaDocumento": 0, "idTipoDocumento": 0, "idEspecieDocumento": 0},
            {"d": 0, "s": 0, "l": 200, "o[0][dataEntrega]": "desc", "cnpj": cnpj},
            {"d": 0, "s": 0, "l": 200, "o[0][dataEntrega]": "desc", "palavraChave": isin or cod},
        ):
            if not cnpj and "palavraChave" not in params:
                continue
            try:
                r = S.get(URL_FNET_BUSCA, params=params, timeout=90,
                          headers={"Referer": "https://fnet.bmfbovespa.com.br/fnet/publico/abrirGerenciadorDocumentosCVM",
                                   "X-Requested-With": "XMLHttpRequest", "Accept": "application/json"})
                diag(f"fnet_busca_{cod}", r.url, r)
                docs = r.json().get("data", [])
            except Exception as e:  # noqa: BLE001
                diag(f"fnet_busca_{cod}", URL_FNET_BUSCA, erro=e)
                continue
            candidatos = []
            for d in docs:
                txt = norm(" ".join(str(v) for v in d.values()))
                if "termo de securitiza" not in txt and "termo" not in norm(str(d.get("tipoDocumento", ""))):
                    continue
                pontos = 0
                for alvo in (isin, cod):
                    if alvo and norm(alvo) in txt:
                        pontos += 5
                if emissao and re.search(rf"\b0*{re.escape(emissao.lstrip('0') or emissao)}\s*(a|ª|o|º)?\s*emiss", txt):
                    pontos += 2
                if serie and re.search(rf"\b0*{re.escape(serie.lstrip('0') or serie)}\s*(a|ª)?\s*s[eé]rie", txt):
                    pontos += 1
                candidatos.append((pontos, d))
            if candidatos:
                candidatos.sort(key=lambda x: -x[0])
                if candidatos[0][0] > 0 or len(candidatos) == 1:
                    achado = candidatos[0][1]
                    break
        if not achado:
            faltando.append(cod)
            indice[cod] = {"arquivo": None, "tentativa": AGORA.isoformat(timespec="seconds"), "cnpj": cnpj, "isin": isin}
            continue
        try:
            r = baixar(URL_FNET_DOC.format(achado["id"]), timeout=180)
            conteudo = r.content
            if not conteudo.startswith(b"%PDF"):
                import base64
                try:
                    conteudo = base64.b64decode(r.text.strip().strip('"'))
                except Exception:  # noqa: BLE001
                    pass
            ext = "pdf" if conteudo.startswith(b"%PDF") else "bin"
            arq = f"{cod}.{ext}"
            with open(os.path.join(DADOS, "termos", arq), "wb") as f:
                f.write(conteudo)
            indice[cod] = {"arquivo": arq, "idFnet": achado["id"], "documento": str(achado.get("tipoDocumento", "")),
                           "entrega": achado.get("dataEntrega"), "baixadoEm": AGORA.isoformat(timespec="seconds"),
                           "cnpj": cnpj, "isin": isin, "fonte": "Fundos.NET (B3/CVM)"}
            feitos.append(cod)
        except Exception as e:  # noqa: BLE001
            diag(f"fnet_doc_{cod}", URL_FNET_DOC.format(achado.get("id")), erro=e)
            faltando.append(cod)
    gravar_json("termos/indice.json", indice)
    return {"termos_ok": feitos, "sem_termo": faltando}


# ---------------------------------------------------------------- principal

def main():
    mercado = ler_json("mercado.json", {})
    anbima_publicos(mercado)
    tesouro_direto(mercado)        # Tesouro Transparente: histórico (pode atrasar alguns dias)
    tesouro_direto_site(mercado)   # site do Tesouro Direto: dados do dia, quando disponível
    anbima_curva(mercado)
    bcb(mercado)
    ipca(mercado)
    anbima_debentures()
    snd_catalogo()
    cvm_cri_cra()
    fundosnet_termos()
    cvm_fundos()

    if mercado:
        mercado["updatedAt"] = AGORA.isoformat(timespec="seconds")
        mercado["status"] = "ok" if all(v["ok"] for v in STATUS.values()) else "parcial"
        mercado["statusAt"] = mercado["updatedAt"]
        gravar_json("mercado.json", mercado)
    gravar_json("status.json", {"rodou_em": AGORA.isoformat(timespec="seconds"), "fontes": STATUS})

    falhas = [k for k, v in STATUS.items() if not v["ok"]]
    if falhas:
        print("Fontes com erro:", ", ".join(falhas))
        sys.exit(1)
    print("Tudo certo.")


if __name__ == "__main__":
    main()
