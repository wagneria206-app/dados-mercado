#!/usr/bin/env python3
# VERSAO: 2026-10-27 (limpeza: só o que o app Mercado e Títulos usa)
"""
Robô de dados de mercado.

Busca dados públicos oficiais e grava arquivos JSON na pasta data/:
  data/mercado.json       retrato do dia, no mesmo formato que o app usa (market/current)
  data/td_historico.json  preços e taxas do Tesouro Direto dos últimos 90 dias úteis
  data/debentures.json    taxas indicativas ANBIMA de todas as debêntures
  data/catalogo_debentures.json  características e agenda de todas as debêntures (SND),
                          no formato de papel do app, com a taxa ANBIMA do dia
  data/fundos_catalogo.json todos os fundos da CVM (nome, tipo, cotas recentes)
  data/cri_cra_cvm.json   dados de todos os CRIs e CRAs do informe mensal da CVM (último mês)
  data/termos/indice.json link do termo de securitização (Fundos.NET) de cada CRI e CRA
  data/cri_cra_anbima.json taxas indicativas e PU da ANBIMA de todos os CRIs e CRAs precificados
  data/cri_cra_cronogramas.json cronograma de pagamentos lido de cada termo de securitização
  data/fundos/XX.json, data/fundos_hist/ cotas dos fundos (dias recentes e fins de mês)
  data/dolar.json          dólar PTAX do Banco Central: fechamento diário desde 1995 e boletins do dia
  data/curvas_hist.json    ETTJ da ANBIMA dia a dia (parâmetros), últimos 400 dias
  data/taxas_hist.json     60 dias de taxas ANBIMA (títulos públicos, debêntures, CRI/CRA)
  data/termos/textos.json  situação da extração de cada documento
  data/status.json        resultado de cada fonte (ok / erro) e horário
  data/diag/              amostras das respostas de cada fonte, para conferência

Cada fonte roda separada: se uma falhar, as outras continuam e o valor
anterior daquela fonte é mantido. O script termina com erro (código 1)
quando alguma fonte falha, para o GitHub avisar por e-mail.
"""
import csv
import glob
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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cronograma  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, "data")
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
TD_TRANSPARENTE_FALHOU = [None]

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


def hist_taxas(papeis, ref_padrao):
    """Guarda as taxas indicativas dos últimos 60 dias úteis por código (painel Mercado: variação em 5 e 30 dias)."""
    h = ler_json("taxas_hist.json", {})
    for cod, v in papeis.items():
        tx, d = v.get("taxa"), v.get("data") or ref_padrao
        if tx is None or not d:
            continue
        L = [x for x in h.get(cod, []) if x[0] != d] + [[d, tx]]
        h[cod] = sorted(L)[-60:]
    gravar_json("taxas_hist.json", h)


def _sem_carimbo(o):
    if isinstance(o, dict):
        return {k: _sem_carimbo(v) for k, v in o.items() if k not in ("geradoEm",)}
    return o


def gravar_json(nome, obj):
    caminho = os.path.join(DADOS, nome)
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    try:
        with open(caminho, encoding="utf-8") as f:
            if _sem_carimbo(json.load(f)) == _sem_carimbo(obj):
                return          # conteúdo igual: não gera alteração no repositório
    except Exception:  # noqa: BLE001
        pass
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


URLS_TD = [URL_TD, URL_TD.replace("PrecoTaxaTesouroDireto.csv", "precotaxatesourodireto.csv")]


@fonte("tesouro_direto")
def tesouro_direto(mercado):
    txt, ultimo = None, None
    for url in URLS_TD:
        try:
            r = baixar(url, timeout=300)
            t = texto(r)
            if t.lstrip()[:1] != "<" and ";" in t[:500]:
                txt = t
                break
            diag("tesouro_transparente", url, r)
            ultimo = "o site devolveu uma página em vez do arquivo CSV"
        except Exception as e:  # noqa: BLE001
            ultimo = str(e)
    if txt is None:
        TD_TRANSPARENTE_FALHOU[0] = ultimo
        return {"aviso": f"Tesouro Transparente indisponível ({ultimo}); usado o site do Tesouro Direto"}
    linhas = csv.reader(io.StringIO(txt), delimiter=";")
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
            hist_taxas(papeis, dia.isoformat())
            return {"data": dia.isoformat(), "papeis": len(papeis)}
    raise RuntimeError("nenhum arquivo ANBIMA de debêntures nos últimos 8 dias úteis")


# ---------------------------------------------------------------- Banco Central (SGS)

def sgs(serie, dias):
    """Série do SGS do Banco Central. Tenta o período por datas e, se a API falhar, os últimos N valores."""
    ini = (HOJE - dt.timedelta(days=dias)).strftime("%d/%m/%Y")
    fim = HOJE.strftime("%d/%m/%Y")
    n = max(30, int(dias * 0.75))
    urls = [URL_SGS.format(serie, ini, fim),
            f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados/ultimos/{min(n, 20)}?formato=json"]
    ultimo = None
    for tentativa in range(3):
        for url in urls:
            try:
                # O firewall do Banco Central recusa identificação de navegador vinda de servidores;
                # com a identificação simples de robô ele responde normalmente.
                r = requests.get(url, timeout=90, headers={"User-Agent": "robo-dados-mercado/1.0 (GitHub Actions)",
                                                           "Accept": "application/json"})
                corpo = r.content.strip()
                if r.status_code == 200 and corpo[:1] == b"[":
                    return [(data_dmy(x["data"]), num(x["valor"])) for x in r.json() if num(x["valor"]) is not None]
                diag(f"bcb_sgs_{serie}", url, r)
                ultimo = f"HTTP {r.status_code}, resposta não é JSON"
            except Exception as e:  # noqa: BLE001
                ultimo = str(e)
        time.sleep(10 * (tentativa + 1))
    raise RuntimeError(f"SGS {serie}: {ultimo}")


@fonte("bcb_cdi_selic")
def bcb(mercado):
    try:
        cdi = sgs(12, 180)          # CDI diário, % ao dia
        selic = sgs(1178, 30)       # Selic over anualizada, % a.a.
        selic_m = sgs(4390, 800)    # Selic acumulada no mês, %
    except Exception as e:  # noqa: BLE001
        # A API do Banco Central às vezes fica fora do ar. Se os dados guardados são recentes,
        # seguimos com eles e só avisamos; se estão velhos, é erro de verdade.
        ult = max((mercado.get("cdiDaily") or {"": 0}).keys())
        if ult and ult >= (HOJE - dt.timedelta(days=5)).isoformat():
            return {"aviso": f"API do Banco Central indisponível agora; mantidos os dados até {ult}", "detalhe": str(e)[:200]}
        raise
    if not cdi or not selic:
        raise RuntimeError("séries do Banco Central vieram vazias")
    mercado["cdiDaily"] = {d: v for d, v in cdi if d}
    mercado["selicOver"] = selic[-1][1]
    if selic_m:
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
        # O site manda o cabeçalho com acentos quebrados ("T\ufffdtulo", "Pre\ufffdo"):
        # normaliza trocando o caractere inválido por "i"/"c" conforme a palavra.
        def ncab(c):
            c = norm(c.replace("\ufffd", "#"))
            return c.replace("t#tulo", "titulo").replace("pre#o", "preco").replace("unit#rio", "unitario").replace("#", "")
        cab_i = next((i for i, L in enumerate(linhas) if any("titulo" in ncab(c) for c in L)), None)
        if cab_i is None:
            raise RuntimeError(f"CSV {nome}: cabeçalho não encontrado")
        cab = [ncab(c) for c in linhas[cab_i]]
        c_nome = next(i for i, c in enumerate(cab) if "titulo" in c)
        c_taxa = next((i for i, c in enumerate(cab) if i != c_nome and ("rendimento" in c or "rentabilidade" in c or "taxa" in c)), None)
        c_pu = next((i for i, c in enumerate(cab) if "preco" in c or "pu" == c), None)
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
            if 1 <= len(linhas) < 10 and nome == "csv":
                # negociação suspensa (dias de volatilidade): o site publica só alguns títulos.
                # Atualiza os que vieram e marca os demais como suspensos, com a hora da última cotação.
                td = mercado.get("td") or {}
                velho = {(r[0], r[1]): r for r in td.get("ALL", [])}
                for r in linhas:
                    velho[(r[0], r[1])] = r
                tipos_ok = sorted({r[0] for r in linhas})
                tipos_todos = sorted({k[0] for k in velho})
                td["ALL"] = sorted(velho.values())
                ant = td.get("suspenso") if (td.get("suspenso") or {}).get("data") == HOJE.isoformat() else {}
                td["suspenso"] = {"desde": ant.get("desde") or AGORA.strftime("%H:%M"),
                                  "data": HOJE.isoformat(), "disponiveis": tipos_ok,
                                  "suspensos": [k for k in tipos_todos if k not in tipos_ok],
                                  "ultimaCompleta": td.get("ultimaCompleta") or td.get("coletadoEm")}
                td["date"] = data or HOJE.isoformat()
                mercado["td"] = td
                return {"via": "csv-parcial", "data": td["date"], "titulos": len(linhas),
                        "aviso": "Tesouro Direto com negociação suspensa para " + ", ".join(td["suspenso"]["suspensos"])}
            if len(linhas) >= 10:
                linhas.sort()
                mercado["td"] = {"source": "Tesouro Direto (site oficial)", "date": data or HOJE.isoformat(), "ALL": linhas,
                                 "ultimaCompleta": AGORA.isoformat(timespec="seconds")}
                hist = ler_json("td_historico.json", {})
                hist[mercado["td"]["date"]] = linhas
                gravar_json("td_historico.json", {d: hist[d] for d in sorted(hist)[-90:]})
                return {"via": nome, "data": mercado["td"]["date"], "titulos": len(linhas)}
            erros.append(f"{nome}: só {len(linhas)} títulos")
        except Exception as e:  # noqa: BLE001
            erros.append(f"{nome}: {str(e)[:200]}")
    if TD_TRANSPARENTE_FALHOU[0]:
        raise RuntimeError("nenhuma fonte do Tesouro Direto respondeu: " + "; ".join(erros))
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
            b = ettj_parametros(txt, dia)
            if b:
                h = ler_json("curvas_hist.json", {"fonte": "ANBIMA – ETTJ (parâmetros Nelson-Siegel-Svensson)", "dias": {}})
                h["dias"][dia.isoformat()] = b
                gravar_json("curvas_hist.json", h)
            mercado["curvePre"] = curva_pre
            mercado["curveIpca"] = curva_ipca
            mercado["inflacaoImplicita"] = implicita
            mercado["curveDate"] = dia.isoformat()
            return {"data": dia.isoformat(), "vertices": len(curva_pre)}
    raise RuntimeError("curva de juros ANBIMA não encontrada nos últimos 6 dias úteis")


def ettj_parametros(txt, dia=None):
    """Parâmetros da ETTJ (beta1..beta4, lambda1, lambda2) das curvas prefixada e IPCA, como a ANBIMA publica.
    Com dia, só aceita a resposta se a data de referência impressa no arquivo for esse dia."""
    out = {}
    if dia is not None:
        m = re.match(r"\s*(\d{2})/(\d{2})/(\d{4})", txt or "")
        if not m or dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1))) != dia:
            return None
    for L in txt.splitlines():
        p = [c.strip() for c in L.split(";")]
        nome = norm(p[0]) if p else ""
        if nome in ("prefixados", "ipca") and len(p) >= 7:
            try:
                v = [float(x.replace(",", ".")) for x in p[1:7]]
            except ValueError:
                continue
            out["pre" if nome == "prefixados" else "ipca"] = [round(x, 12) for x in v]
    return out if len(out) == 2 else None


@fonte("anbima_curva_hist")
def anbima_curva_hist():
    """
    Histórico diário da ETTJ (só os 12 parâmetros por dia; o app recalcula a curva com a fórmula da ANBIMA).
    Busca primeiro as datas que o app compara (1 dia, 1 semana, 1 mês e 1 ano atrás) e depois completa,
    aos poucos, todos os dias úteis dos últimos 400 dias. Feriado ou dia sem curva fica marcado como vazio.
    """
    h = ler_json("curvas_hist.json", {"fonte": "ANBIMA – ETTJ (parâmetros Nelson-Siegel-Svensson)", "dias": {}})
    dias = h.setdefault("dias", {})
    vazios = h.setdefault("vazios", {})

    def uteis_antes(d, n=6):
        out = []
        while len(out) < n:
            if d.weekday() < 5:
                out.append(d)
            d -= dt.timedelta(days=1)
        return out
    alvo = []
    for back in (1, 7, 30, 365):
        alvo += uteis_antes(HOJE - dt.timedelta(days=back))
    alvo += [HOJE - dt.timedelta(days=k) for k in range(1, 401)]
    vistos, fila = set(), []
    for d in alvo:
        k = d.isoformat()
        if d.weekday() >= 5 or k in vistos or k in dias or vazios.get(k, 0) >= 2:
            continue
        vistos.add(k)
        fila.append(d)
    limite, novos, sem = time.time() + 4 * 60, 0, 0
    for d in fila[:80]:
        if time.time() > limite:
            break
        k = d.isoformat()
        try:
            r = baixar(URL_ETTJ, dados={"Idioma": "PT", "Dt_Ref": d.strftime("%d/%m/%Y"), "saida": "csv"}, tentativas=2, timeout=60)
            b = ettj_parametros(texto(r), d)
        except Exception:  # noqa: BLE001
            b = None
        if b:
            dias[k] = b
            vazios.pop(k, None)
            novos += 1
        else:
            vazios[k] = vazios.get(k, 0) + 1
            sem += 1
    corte = (HOJE - dt.timedelta(days=420)).isoformat()
    h["dias"] = {k: v for k, v in sorted(dias.items()) if k >= corte}
    h["vazios"] = {k: v for k, v in sorted(vazios.items()) if k >= corte}
    gravar_json("curvas_hist.json", h)
    if fila and not h["dias"]:
        raise RuntimeError("a ANBIMA não devolveu nenhuma curva histórica")
    return {"dias": len(h["dias"]), "novos_agora": novos, "sem_curva_agora": sem,
            "mais_antigo": min(h["dias"]) if h["dias"] else None, "faltam": max(0, len(fila) - novos - sem)}



# ---------------------------------------------------------------- Banco Central: dólar (PTAX)

URL_PTAX = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
UA_BCB = {"User-Agent": "robo-dados-mercado/1.0 (GitHub Actions)", "Accept": "application/json"}


def olinda(caminho):
    ultimo = None
    for tentativa in range(3):
        try:
            r = requests.get(URL_PTAX + caminho, timeout=120, headers=UA_BCB)
            if r.status_code == 200 and r.content.strip()[:1] == b"{":
                return r.json().get("value", [])
            diag("bcb_ptax", URL_PTAX + caminho, r)
            ultimo = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            ultimo = str(e)
        time.sleep(5 * (tentativa + 1))
    raise RuntimeError(f"PTAX: {ultimo}")


def ptax_boletins(dolar):
    """Boletins do dia (abertura, intermediários e fechamento); se hoje ainda não tem, o último dia útil."""
    for d in dias_recentes(5):
        L = olinda("CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='USD'&@dataCotacao='"
                   + d.strftime("%m-%d-%Y") + "'&$format=json")
        if L:
            bol = [{"hora": x["dataHoraCotacao"][11:16], "tipo": x.get("tipoBoletim", ""),
                    "compra": x["cotacaoCompra"], "venda": x["cotacaoVenda"]} for x in L]
            dolar["boletins"] = {"data": d.isoformat(), "lista": bol}
            fech = [b for b in bol if norm(b["tipo"]).startswith("fech")]
            if fech:   # o fechamento do dia entra na série assim que sai
                ser = dict((r[0], r) for r in dolar.get("serie", []))
                ser[d.isoformat()] = [d.isoformat(), fech[-1]["compra"], fech[-1]["venda"]]
                dolar["serie"] = [ser[k] for k in sorted(ser)]
            return len(bol)
    return 0


def dolar_resumo(dolar):
    """Resumo pequeno para o mercado.json (barra do app): último fechamento, o anterior e o último boletim."""
    ser = dolar.get("serie") or []
    out = {}
    if ser:
        out = {"data": ser[-1][0], "compra": ser[-1][1], "venda": ser[-1][2]}
        if len(ser) > 1:
            out["anterior"] = {"data": ser[-2][0], "venda": ser[-2][2]}
    b = dolar.get("boletins") or {}
    if b.get("lista"):
        u = b["lista"][-1]
        out["boletim"] = {"data": b["data"], "hora": u["hora"], "tipo": u["tipo"], "compra": u["compra"], "venda": u["venda"]}
    return out


@fonte("bcb_dolar_ptax")
def bcb_dolar(mercado):
    """
    Dólar PTAX do Banco Central: série diária de fechamento (compra e venda) desde 1995 e os boletins do dia.
    Na primeira vez baixa tudo; depois, só os últimos 40 dias (o Banco Central pode corrigir dias recentes).
    """
    dolar = ler_json("dolar.json", {})
    ser = dict((r[0], r) for r in dolar.get("serie", []))
    ini = dt.date(1995, 1, 2) if len(ser) < 5000 else HOJE - dt.timedelta(days=40)
    L = olinda("CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='"
               + ini.strftime("%m-%d-%Y") + "'&@dataFinalCotacao='" + HOJE.strftime("%m-%d-%Y")
               + "'&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao")
    for x in L:
        d = x["dataHoraCotacao"][:10]
        if x.get("cotacaoVenda"):
            ser[d] = [d, x["cotacaoCompra"], x["cotacaoVenda"]]
    if len(ser) < 5000:
        raise RuntimeError(f"PTAX: série incompleta ({len(ser)} dias)")
    dolar = {"fonte": "Banco Central do Brasil – PTAX (fechamento: média dos 4 boletins do dia)",
             "serie": [ser[k] for k in sorted(ser)], "boletins": dolar.get("boletins")}
    n = ptax_boletins(dolar)
    dolar["atualizadoEm"] = AGORA.isoformat(timespec="seconds")
    gravar_json("dolar.json", dolar)
    mercado["dolar"] = dolar_resumo(dolar)
    return {"dias": len(dolar["serie"]), "ultimo": dolar["serie"][-1], "boletins_hoje": n}

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
            "vna": coluna(cab, "valor nominal atual"),
            "vna_data": coluna(cab, "data ult. vna"),
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
    agenda, vistos = {}, set()

    def ler_agenda(url, nome_diag):
        r = baixar(url, timeout=400)
        diag(nome_diag, url, r)
        cab, linhas = tabela_tab(texto(r))
        c_ativo = coluna(cab, "ativo")
        c_evento = coluna(cab, "evento", evitar=("data",))
        c_data_ev = coluna(cab, "data do evento")
        c_data_pg = coluna(cab, "pagamento") if coluna(cab, "pagamento") is not None else coluna(cab, "liquidacao")
        c_taxa = coluna(cab, "taxa") if coluna(cab, "taxa") is not None else coluna(cab, "perc")
        n = 0
        for L in linhas:
            cod = pega(L, c_ativo).upper()
            ev = norm(pega(L, c_evento))
            dpg = data_dmy(pega(L, c_data_pg)) or data_dmy(pega(L, c_data_ev))
            tx = num(pega(L, c_taxa))
            if not cod or not dpg or (cod, dpg, ev, tx) in vistos:
                continue
            vistos.add((cod, dpg, ev, tx))
            agenda.setdefault(cod, []).append((dpg, ev, tx))
            n += 1
        return n

    try:
        ler_agenda(URL_SND_AGENDA, "snd_agenda")
    except Exception as e:  # noqa: BLE001
        diag("snd_agenda", URL_SND_AGENDA, erro=e)
        STATUS["snd_agenda"] = {"ok": False, "em": AGORA.isoformat(timespec="seconds"), "erro": str(e)[:500]}
    # o SND só devolve os eventos futuros: os pagamentos já feitos o app reconstrói pelo saldo atual
    tem_passado = False

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
            if ev.startswith("vencimento") or (ev.startswith("resgate") and "parcial" not in ev):
                e[1] = -1  # marca: resgate de todo o saldo (vencimento ou resgate antecipado total)
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
            "agendaParcial": not tem_passado or not any(d < HOJE.isoformat() for d, _, _ in agenda.get(cod, [])),
            "updatedAt": AGORA.isoformat(timespec="seconds"), "notes": "",
        }
        if num(x.get("vna")):
            papel["vnaAtual"] = num(x.get("vna"))
            papel["vnaData"] = data_dmy(x.get("vna_data", "")) or x.get("vna_data", "")
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


def indice_cri_cra(txt):
    """Interpreta o texto livre da taxa ('IPCA + 7,5%', 'CDI + 1,2% a.a.', '100% CDI', '12,5% a.a.')."""
    t = norm(txt).replace(",", ".")
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", t)]
    if "ipca" in t:
        return "IPCA", (nums[-1] if nums else None)
    if "cdi" in t or re.search(r"\bdi\b", t) or "selic" in t:
        m = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(do\s*)?(cdi|di)", t)
        if m and "+" not in t:
            return "DI_PCT", float(m.group(1))
        return "DI_SPREAD", (nums[-1] if nums else 0.0)
    if any(x in t for x in ("igp", "incc", "tr ", "dolar", "usd", "tjlp")):
        return "OUTRO", (nums[-1] if nums else None)
    if nums:
        return "PRE", nums[-1]
    return "OUTRO", None


@fonte("cvm_cri_cra")
def cvm_cri_cra():
    """Uma linha por série (código B3 = Codigo_CETIP), com os dados gerais da emissão."""
    resumo = {}
    for tipo in ("CRI", "CRA"):
        conteudo = None
        for ano in (HOJE.year, HOJE.year - 1):
            url = URL_CVM_SEC.format(tipo=tipo, t=tipo.lower(), ano=ano)
            r = baixar(url, aceita_404=True, timeout=300)
            if r is not None:
                conteudo = r.content
                break
        if conteudo is None:
            raise RuntimeError(f"informe mensal de {tipo} não encontrado na CVM")
        geral, classes = {}, {}
        with zipfile.ZipFile(io.BytesIO(conteudo)) as z:
            for nome in z.namelist():
                n = nome.lower()
                if not (n.endswith(".csv") and ("_geral_" in n or "_classe_" in n)):
                    continue
                with z.open(nome) as f:
                    for L in csv.DictReader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";"):
                        cid, ref = L.get("Codigo_Identificacao_Certificado", ""), L.get("Data_Referencia", "")
                        if "_geral_" in n:
                            if ref >= geral.get(cid, {}).get("Data_Referencia", ""):
                                geral[cid] = L
                        else:
                            cod = re.sub(r"\s", "", L.get("Codigo_CETIP", "") or "").upper()
                            if cod and ref >= classes.get(cod, {}).get("Data_Referencia", ""):
                                classes[cod] = L
        for cod, c in classes.items():
            g = geral.get(c.get("Codigo_Identificacao_Certificado", ""), {})
            taxa_txt = c.get("Taxa_Juros", "") or c.get("Taxas_Indexadores", "")
            idx, taxa = indice_cri_cra(taxa_txt)
            CRI_CRA[cod] = {
                "code": cod, "type": tipo, "securitizadora": g.get("Companhia_Emissora", ""),
                "cnpjSecuritizadora": re.sub(r"\D", "", c.get("CNPJ_Emissora", "") or g.get("CNPJ_Emissora", "")),
                "emissao": g.get("Numero_Emissao", ""), "nomeEmissao": g.get("Nome_Emissao", ""),
                "dataEmissao": g.get("Data_Emissao", ""), "serie": c.get("Numero_Serie", ""), "classe": c.get("Classe", ""),
                "isin": c.get("Codigo_ISIN", ""), "vencimento": c.get("Data_Vencimento", ""),
                "taxaTexto": taxa_txt, "index": idx, "rate": taxa,
                "periodicidade": c.get("Pagamento_Periodicidade", ""), "amortizacao": c.get("Periodicidade_Amortizacao", ""),
                "situacao": c.get("Situacao", ""), "lastro": g.get("Tipo_Lastro", ""),
                "competencia": c.get("Data_Referencia", ""), "fonte": "CVM – informe mensal de " + tipo,
            }
        resumo[tipo] = len(classes)
    gravar_json("cri_cra_cvm.json", {"geradoEm": AGORA.isoformat(timespec="seconds"), "certificados": CRI_CRA})
    return {"series": resumo}


# ---------------------------------------------------------------- Fundos.NET: termos de securitização

URL_FNET_BUSCA = "https://fnet.bmfbovespa.com.br/fnet/publico/pesquisarGerenciadorDocumentosDados"
URL_FNET_DOC = "https://fnet.bmfbovespa.com.br/fnet/publico/downloadDocumento?id={}"




_FNET_BASE = {"d": 0, "s": 0, "l": 200, "o[0][dataEntrega]": "desc", "idCategoriaDocumento": 0,
              "idTipoDocumento": 0, "idEspecieDocumento": 0}
FNET_VARIANTES = [
    dict(_FNET_BASE, paginaCertificados="true", cnpj="", tipoFundo="", situacao="", palavraChave="", administrador="",
         dataInicial="01/01/2000", dataFinal=HOJE.strftime("%d/%m/%Y")),
    dict(_FNET_BASE, paginaCertificados="true", cnpj=""),
    dict(_FNET_BASE, cnpj=""),
    dict(_FNET_BASE, cnpjFundo=""),
]
FNET_MODELO = [None]


def fnet_busca(params, nome_diag=None):
    r = S.get(URL_FNET_BUSCA, params=params, timeout=90,
              headers={"Referer": "https://fnet.bmfbovespa.com.br/fnet/publico/abrirGerenciadorDocumentosCVM",
                       "X-Requested-With": "XMLHttpRequest", "Accept": "application/json"})
    if nome_diag:
        diag(nome_diag, r.url, r)
    r.raise_for_status()
    j = r.json()
    return j.get("data", []), j.get("recordsTotal") or j.get("recordsFiltered") or 0


def eh_termo(d):
    txt = norm(" ".join(str(v) for v in d.values()))
    return "termo de securitiza" in txt or "termo" in norm(str(d.get("tipoDocumento", "")))


def pontuar(d, isin, cod, emissao, serie):
    txt = norm(" ".join(str(v) for v in d.values()))
    p = 0
    for alvo in (isin, cod):
        if alvo and norm(alvo) in txt:
            p += 10
    e = (emissao or "").lstrip("0")
    s_ = (serie or "").lstrip("0")
    if e and re.search(rf"\b{re.escape(e)}\s*(a|ª|o|º)?\s*(\(.*?\)\s*)?emiss", txt):
        p += 3
    if s_ and re.search(rf"\b{re.escape(s_)}\s*(a|ª)?\s*(\(.*?\)\s*)?s[eé]rie", txt):
        p += 2
    return p


URL_FNET_PAGINA = "https://fnet.bmfbovespa.com.br/fnet/publico/abrirGerenciadorDocumentosCertificadosCVM"


def fnet_categorias():
    """Códigos das categorias de documento: lê da página de busca ou, se ela não responder, descobre testando."""
    cats = ler_json("termos/categorias.json", {})
    if any("termo de securitiza" in k for k in cats):
        return cats
    for url in (URL_FNET_PAGINA, URL_FNET_PAGINA.replace("abrir", "pesquisar") + "?paginaCertificados=true"):
        try:
            r = S.get(url, timeout=150)
            diag("fnet_pagina", url, r)
            for val, nome in re.findall(r'<option[^>]*value="?(\d+)"?[^>]*>([^<]+)</option>', texto(r)):
                cats[norm(nome)] = int(val)
            if cats:
                break
        except Exception as e:  # noqa: BLE001
            diag("fnet_pagina", url, erro=e)
    if not any("termo de securitiza" in k for k in cats):
        # descoberta: pede 1 documento de cada código de categoria e lê o nome que volta
        for cid in range(1, 121):
            try:
                dados, _ = fnet_busca(dict(FNET_VARIANTES[0], l=1, idCategoriaDocumento=cid))
            except Exception:  # noqa: BLE001
                continue
            if dados:
                nome = norm(dados[0].get("categoriaDocumento", ""))
                if nome and nome not in cats:
                    cats[nome] = cid
            if sum(1 for k in cats if "termo de securitiza" in k) >= 2:
                break
    gravar_json("termos/categorias.json", cats)
    return cats


def ler_descricao(desc):
    """'OPEA CRI Emissão:362 Série(s):1 (+2) LOG COMMERCIAL 10/2024 BRAPCSCRIQK5' -> partes úteis."""
    d = norm(desc)
    m_e = re.search(r"emissao:\s*(\d+)", d)
    m_s = re.search(r"serie(?:\(s\))?:\s*(\d+)(?:\s*\(\+(\d+)\))?", d)
    ult = desc.strip().split()[-1].upper() if desc.strip() else ""
    return {
        "sec": d.split(" cri ")[0].split(" cra ")[0].split(" cr ")[0].strip(),
        "emissao": int(m_e.group(1)) if m_e else None,
        "serie_ini": int(m_s.group(1)) if m_s else None,
        "serie_fim": (int(m_s.group(1)) + int(m_s.group(2) or 0)) if m_s else None,
        "codigo": ult if re.fullmatch(r"[A-Z0-9]{10,12}", ult) else "",
    }


@fonte("fundosnet_termos")
def fundosnet_termos():
    """
    Índice com o termo de securitização (e aditamentos) de cada CRI e CRA, para o app mostrar o link
    na hora do cadastro. Varre a categoria 'Termo de Securitização' do Fundos.NET; na primeira vez varre
    tudo (aos poucos, se precisar de mais de uma execução) e depois só os documentos novos.
    """
    os.makedirs(os.path.join(DADOS, "termos"), exist_ok=True)
    estado = ler_json("termos/estado.json", {})
    docs = ler_json("termos/documentos_fnet.json", {})
    if estado.get("versao") != 3:
        estado, docs = {"versao": 3}, {}

    cats = fnet_categorias()
    alvo = {k: v for k, v in cats.items() if "termo de securitiza" in k}
    if not alvo:
        alvo = {"(sem filtro de categoria)": 0}
    limite = time.time() + 9 * 60
    novos = 0
    for nome_cat, id_cat in alvo.items():
        chave = f"cat_{id_cat}"
        st = estado.setdefault(chave, {"completo": False, "proximo": 0})
        inicio = 0 if st["completo"] else st["proximo"]
        pagina = inicio // 200
        total = None
        while time.time() < limite:
            params = dict(FNET_VARIANTES[0], s=pagina * 200, idCategoriaDocumento=id_cat)
            try:
                dados, total = fnet_busca(params, "fnet_termos_exemplo" if pagina == inicio // 200 else None)
            except Exception as e:  # noqa: BLE001
                diag("fnet_erro_" + chave, URL_FNET_BUSCA, erro=e)
                break
            conhecidos = 0
            for d in dados:
                cat = d.get("categoriaDocumento", "")
                if "termo de securitiza" not in norm(cat):
                    continue
                k = str(d.get("id"))
                if k in docs:
                    conhecidos += 1
                    continue
                docs[k] = {"desc": d.get("descricaoFundo", ""), "cat": cat, "entrega": d.get("dataEntrega", "")}
                novos += 1
            pagina += 1
            fim = len(dados) < 200 or (total and pagina * 200 >= total)
            if st["completo"] and dados and conhecidos == len(dados):
                break          # já completo e esta página só tem documentos conhecidos
            if fim:
                st["completo"], st["proximo"] = True, 0
                break
            st["proximo"] = pagina * 200
        st["total_no_site"] = total
    gravar_json("termos/documentos_fnet.json", docs)
    gravar_json("termos/estado.json", estado)

    # liga cada série ao termo e aos aditamentos
    por_codigo, por_emissao = {}, {}
    for k, d in docs.items():
        info = ler_descricao(d["desc"])
        item = {"id": int(k), "cat": d["cat"], "entrega": d["entrega"], "desc": d["desc"]}
        if info["codigo"]:
            por_codigo.setdefault(info["codigo"], []).append(item)
        if info["emissao"] is not None:
            por_emissao.setdefault((info["sec"].split(" ")[0], info["emissao"]), []).append((info, item))
    indice = {}
    for cod, reg in CRI_CRA.items():
        cands, conf = list(por_codigo.get(cod, [])) + list(por_codigo.get((reg.get("isin") or "").upper(), [])), "alta"
        if not cands:
            try:
                em, se = int(reg.get("emissao") or -1), int(reg.get("serie") or -1)
            except ValueError:
                em, se = -1, -1
            sec = norm(reg.get("securitizadora", "")).split(" ")[0] if reg.get("securitizadora") else ""
            for (sec_doc, em_doc), lst in por_emissao.items():
                if em_doc != em or not sec or not (sec.startswith(sec_doc[:4]) or sec_doc.startswith(sec[:4])):
                    continue
                for info, item in lst:
                    if info["serie_ini"] is None or info["serie_ini"] <= se <= info["serie_fim"]:
                        cands.append(item)
            conf = "media"
        if not cands:
            continue
        termos = [c for c in cands if not norm(c["cat"]).startswith("aditamento")]
        adit = [c for c in cands if norm(c["cat"]).startswith("aditamento")]
        base = (termos or adit)[0]
        indice[cod] = {
            "idFnet": base["id"], "url": f"https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id={base['id']}",
            "confianca": conf, "documento": base["cat"], "entrega": base["entrega"],
            "aditamentos": [{"id": a["id"], "url": f"https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id={a['id']}",
                             "entrega": a["entrega"]} for a in adit[:10]],
        }
    gravar_json("termos/indice.json", indice)
    completo = all(v.get("completo") for k, v in estado.items() if k.startswith("cat_"))
    return {"categorias": list(alvo), "documentos_no_indice": len(docs), "novos_agora": novos,
            "varredura_completa": completo, "series_com_termo": len(indice), "series_total": len(CRI_CRA)}



# ---------------------------------------------------------------- ANBIMA: CRI e CRA (taxas indicativas)

from html.parser import HTMLParser

URLS_ANBIMA_CRI = [
    "https://www.anbima.com.br/pt_br/informar/precos-e-indices/precos/taxas-de-cri-e-cra.htm",
    "https://www.anbima.com.br/pt_br/informar/precos-e-indices/precos/taxas-de-cri-e-cra/taxas-de-cri-e-cra.htm",
]


class _Tabelas(HTMLParser):
    """Junta todas as tabelas da página como listas de linhas de texto."""
    def __init__(self):
        super().__init__()
        self.tabelas, self._t, self._l, self._c = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self._t = []
        elif tag == "tr" and self._t is not None:
            self._l = []
        elif tag in ("td", "th") and self._l is not None:
            self._c = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._c is not None and self._l is not None:
            self._l.append(re.sub(r"\s+", " ", "".join(self._c)).strip())
            self._c = None
        elif tag == "tr" and self._l is not None and self._t is not None:
            if self._l:
                self._t.append(self._l)
            self._l = None
        elif tag == "table" and self._t is not None:
            self.tabelas.append(self._t)
            self._t = None

    def handle_data(self, data):
        if self._c is not None:
            self._c.append(data)


def cod_cri(c):
    """Código B3: CRI tem 10 caracteres (24A2720884); CRA começa com CRA (CRA0220060P).
    Tira só prefixos acrescentados à mão ("CRI 24A2720884", "CRA-CRA0220060P")."""
    c = re.sub(r"[^A-Z0-9]", "", (c or "").upper())
    c = re.sub(r"^CRA(?=CRA)", "", c)
    m = re.fullmatch(r"(?:CRI|CRA)(\d{2}[A-Z]\d{7})", c)
    return m.group(1) if m else c


@fonte("anbima_cri_cra")
def anbima_cri_cra():
    erros = []
    for url in URLS_ANBIMA_CRI:
        try:
            r = baixar(url, tentativas=2, timeout=180)
        except Exception as e:  # noqa: BLE001
            erros.append(str(e)[:200])
            continue
        diag("anbima_cri_cra", url, r)
        p = _Tabelas()
        p.feed(texto(r))
        papeis, ref = {}, None
        for t in p.tabelas:
            cab_i = next((i for i, L in enumerate(t[:5]) if any(norm(c) == "codigo" for c in L)), None)
            if cab_i is None:
                continue
            cab = [norm(c) for c in t[cab_i]]

            def ci(*nomes):
                return next((i for i, c in enumerate(cab) if any(n in c for n in nomes)), None)
            c_cod, c_ind, c_pu = cab.index("codigo"), ci("indicativa"), ci("pu") if "pu" in cab else None
            c_pu = cab.index("pu") if "pu" in cab else c_pu
            c_data, c_venc, c_idx = ci("data de referencia", "referencia"), ci("vencimento"), ci("indice", "correcao")
            c_par, c_dur, c_emi, c_risco = ci("% pu par", "pu par"), ci("duration"), ci("emissor"), ci("risco")
            for L in t[cab_i + 1:]:
                if len(L) <= c_cod:
                    continue
                cod = cod_cri(L[c_cod])
                if not cod:
                    continue
                g = lambda i: L[i] if i is not None and i < len(L) else ""  # noqa: E731
                d = data_dmy(g(c_data)) if g(c_data) else None
                ref = max(ref or "", d or "") or ref
                papeis[cod] = {"taxa": num(g(c_ind)), "pu": num(g(c_pu)), "puPar": num(g(c_par)),
                               "duration": num(g(c_dur)), "indice": g(c_idx), "venc": data_dmy(g(c_venc)) if g(c_venc) else None,
                               "emissor": g(c_emi), "risco": g(c_risco), "data": d, "codigoAnbima": L[c_cod]}
        if papeis:
            gravar_json("cri_cra_anbima.json", {"refDate": ref, "source": "ANBIMA – taxas de CRI e CRA",
                                                "geradoEm": AGORA.isoformat(timespec="seconds"), "papers": papeis})
            sem = sum(1 for v in papeis.values() if v["taxa"] is None)
            hist_taxas(papeis, ref)
            return {"data": ref, "papeis": len(papeis), "sem_taxa": sem}
        erros.append(f"{url}: nenhuma tabela com coluna Código ({len(p.tabelas)} tabelas na página)")
    raise RuntimeError("; ".join(erros))


# ---------------------------------------------------------------- Fundos.NET: texto integral dos termos

import base64
import shutil
import subprocess
import tempfile


def pdf_para_texto(conteudo):
    """Texto de todas as páginas, separadas por '\f'. Usa pdftotext (poppler); se faltar, pypdf."""
    with tempfile.TemporaryDirectory() as d:
        pdf = os.path.join(d, "doc.pdf")
        with open(pdf, "wb") as f:
            f.write(conteudo)
        if shutil.which("pdftotext"):
            subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", pdf, os.path.join(d, "doc.txt")],
                           check=True, timeout=180, capture_output=True)
            with open(os.path.join(d, "doc.txt"), encoding="utf-8", errors="replace") as f:
                return f.read()
        from pypdf import PdfReader  # noqa: PLC0415
        return "\f".join((pg.extract_text() or "") for pg in PdfReader(pdf).pages)


def fnet_pdf(id_doc):
    """O Fundos.NET às vezes entrega o PDF direto e às vezes em base64 (com ou sem aspas)."""
    r = baixar(URL_FNET_DOC.format(id_doc), tentativas=2, timeout=180,
               headers={"Referer": "https://fnet.bmfbovespa.com.br/fnet/publico/abrirGerenciadorDocumentosCVM"})
    c = r.content
    if c[:5] == b"%PDF-":
        return c
    t = c.strip().strip(b'"')
    try:
        b = base64.b64decode(t, validate=False)
        if b[:5] == b"%PDF-":
            return b
    except Exception:  # noqa: BLE001
        pass
    diag("fnet_documento_inesperado", URL_FNET_DOC.format(id_doc), r)
    raise RuntimeError(f"documento {id_doc} não é PDF ({r.headers.get('content-type', '')}, {len(c)} bytes)")


@fonte("fundosnet_textos")
def fundosnet_textos():
    """
    Baixa cada termo de securitização (e aditamentos) e lê o cronograma de pagamentos (o texto não é guardado).
    Ordem: os CRI/CRA precificados pela ANBIMA, depois os demais
    (mais recentes primeiro). Cada execução trabalha por no máximo ~8 minutos; o resto fica para a próxima.
    """
    indice = ler_json("termos/indice.json", {})
    feitos = ler_json("termos/textos.json", {})
    anb = ler_json("cri_cra_anbima.json", {}).get("papers", {})

    def ids(cod):
        i = indice.get(cod) or indice.get(cod_cri(cod))
        if not i:
            return []
        return [i["idFnet"]] + [a["id"] for a in i.get("aditamentos", [])]

    fila, vistos = [], set()
    def por(lista, prio):
        for cod in lista:
            for i in ids(cod):
                if str(i) not in vistos:
                    vistos.add(str(i))
                    fila.append((prio, i))
    por(sorted(anb), 1)
    por(sorted(indice, key=lambda c: -indice[c]["idFnet"]), 2)

    pend = [(p, i) for p, i in fila if not feitos.get(str(i), {}).get("ok") and feitos.get(str(i), {}).get("tentativas", 0) < 3]
    limite = time.time() + 10 * 60
    novos, erros = 0, 0
    from concurrent.futures import ThreadPoolExecutor  # noqa: PLC0415

    # documento -> séries que ele cobre (o mesmo termo costuma valer para várias séries)
    por_doc = {}
    for cod, ix in indice.items():
        for i in [ix["idFnet"]] + [a["id"] for a in ix.get("aditamentos", [])]:
            por_doc.setdefault(i, []).append(cod)
    cronos = ler_json("cri_cra_cronogramas.json", {})
    cvm = CRI_CRA or ler_json("cri_cra_cvm.json", {}).get("certificados", {})

    def extrair_cronogramas(i, txt):
        """Lê a tabela de pagamentos do termo para cada série do documento; o aditamento mais novo prevalece."""
        n = 0
        for cod in por_doc.get(i, []):
            s = dict(cvm.get(cod) or {})
            if not s:
                continue
            a = anb.get(cod) or {}
            s["vencAnbima"] = a.get("venc")
            try:
                r = cronograma.extrair(txt, s)
            except Exception:  # noqa: BLE001
                r = None
            if not r or "schedule" not in r:
                continue
            velho = cronos.get(cod)
            if velho and velho.get("docId", 0) > i:
                continue
            r.update({"docId": i, "entrega": (indice.get(cod) or {}).get("entrega", ""),
                      "url": f"https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id={i}",
                      "extraidoEm": AGORA.isoformat(timespec="seconds")})
            cronos[cod] = r
            n += 1
        return n

    def um(i):
        if time.time() > limite:
            return i, None, None
        try:
            txt = pdf_para_texto(fnet_pdf(i))
            if len(txt.strip()) < 500:
                raise RuntimeError("PDF sem texto (provavelmente escaneado)")
            return i, {"ok": True, "paginas": txt.count("\f") + 1, "caracteres": len(txt)}, txt
        except Exception as e:  # noqa: BLE001
            return i, {"ok": False, "erro": str(e)[:200]}, None

    # 4 downloads ao mesmo tempo (o Fundos.NET aguenta bem; cada documento leva alguns segundos)
    lote = [i for _, i in pend][:1200]
    with ThreadPoolExecutor(max_workers=4) as ex:
        for i, res, txt in ex.map(um, lote):
            if res is None:
                continue
            if txt:
                res["cronogramas"] = extrair_cronogramas(i, txt)
            reg = feitos.setdefault(str(i), {})
            if res["ok"]:
                reg.update(res, em=AGORA.isoformat(timespec="seconds"))
                reg.pop("erro", None)
                novos += 1
            else:
                reg.update(ok=False, erro=res["erro"], tentativas=reg.get("tentativas", 0) + 1)
                erros += 1
    gravar_json("termos/textos.json", feitos)
    gravar_json("cri_cra_cronogramas.json", cronos)
    total_ok = sum(1 for v in feitos.values() if v.get("ok"))
    if pend and novos == 0 and erros:
        raise RuntimeError(f"nenhum termo baixado; último erro: {next(v['erro'] for v in feitos.values() if not v.get('ok'))}")
    return {"novos_agora": novos, "erros_agora": erros, "textos_total": total_ok, "series_com_cronograma": len(cronos), "documentos_na_fila": len(fila),
            "pendentes": max(0, len(pend) - novos)}

# ---------------------------------------------------------------- CVM: catálogo de todos os fundos

URL_CVM_CAD_175 = "https://dados.cvm.gov.br/dados/FI/CAD/DADOS/registro_fundo_classe.zip"
URL_CVM_CAD_FI = "https://dados.cvm.gov.br/dados/FI/CAD/DADOS/cad_fi.csv"


def ler_cadastro_fundos():
    """CNPJ -> {nome, tipo, admin}. Usa o cadastro novo (RCVM 175) e o antigo (cad_fi)."""
    cad = {}
    colunas = {}

    def absorver(linhas, origem):
        cab = None
        for L in linhas:
            if cab is None:
                cab = [norm(c) for c in L]
                colunas[origem] = cab
                c_cnpj = [i for i, c in enumerate(cab) if "cnpj" in c and not any(x in c for x in ("admin", "gestor", "auditor", "custod", "controlad"))]
                c_nome = next((i for i, c in enumerate(cab) if "denominacao" in c or c == "denom_social"), None)
                c_tipo = next((i for i, c in enumerate(cab) if c in ("tipo_classe", "classe", "classe_anbima", "tp_fundo", "tipo_fundo")
                               or "classificacao" in c), None)
                c_adm = next((i for i, c in enumerate(cab) if c in ("admin", "administrador") or ("admin" in c and "cnpj" not in c)), None)
                c_sit = next((i for i, c in enumerate(cab) if c in ("sit", "situacao")), None)
                continue
            if c_nome is None:
                return
            if c_sit is not None and c_sit < len(L) and "cancel" in norm(L[c_sit]):
                continue
            for ci in c_cnpj[:1]:
                if ci < len(L):
                    k = re.sub(r"[^0-9A-Z]", "", L[ci].upper())
                    if len(k) == 14:
                        reg = cad.setdefault(k, {})
                        reg.setdefault("n", L[c_nome].strip()[:120])
                        if c_tipo is not None and c_tipo < len(L) and L[c_tipo].strip():
                            reg.setdefault("t", L[c_tipo].strip()[:60])
                        if c_adm is not None and c_adm < len(L) and L[c_adm].strip():
                            reg.setdefault("a", L[c_adm].strip()[:80])

    try:
        r = baixar(URL_CVM_CAD_175, timeout=300)
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            for nome in sorted(z.namelist(), key=lambda n: ("subclasse" in n, "fundo" in n)):
                if nome.lower().endswith(".csv"):
                    with z.open(nome) as f:
                        absorver(csv.reader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";"), nome)
    except Exception as e:  # noqa: BLE001
        diag("cvm_cadastro_175", URL_CVM_CAD_175, erro=e)
    try:
        r = baixar(URL_CVM_CAD_FI, timeout=300)
        absorver(csv.reader(io.StringIO(texto(r)), delimiter=";"), "cad_fi.csv")
    except Exception as e:  # noqa: BLE001
        diag("cvm_cad_fi", URL_CVM_CAD_FI, erro=e)
    gravar_json("diag/cvm_cadastro_colunas.json", colunas)
    return cad


@fonte("cvm_catalogo_fundos")
def cvm_catalogo_fundos():
    """Todos os fundos com cota diária na CVM: nome, tipo, última cota e cotas de fim de mês."""
    anterior = ler_json("fundos_catalogo.json", {}).get("funds", {})
    serie = {}   # cnpj -> {data: cota}
    pl = {}
    meses = [(HOJE.replace(day=1) - dt.timedelta(days=1)).strftime("%Y%m"), HOJE.strftime("%Y%m")]
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
                    c_sub = cab.index("ID_SUBCLASSE") if "ID_SUBCLASSE" in cab else None
                    c_data, c_cota = cab.index("DT_COMPTC"), cab.index("VL_QUOTA")
                    c_pl = cab.index("VL_PATRIM_LIQ") if "VL_PATRIM_LIQ" in cab else None
                    for L in leitor:
                        if c_sub is not None and c_sub < len(L) and L[c_sub].strip():
                            continue   # subclasses: fica a cota da classe
                        k = re.sub(r"[^0-9A-Z]", "", L[c_cnpj].upper())
                        cota = num(L[c_cota])
                        if len(k) != 14 or not cota:
                            continue
                        serie.setdefault(k, {})[L[c_data]] = cota
                        if c_pl is not None:
                            pl[k] = (L[c_data], num(L[c_pl]))
                        lidos += 1
    if not serie:
        raise RuntimeError("informe diário da CVM sem dados")
    cad = ler_cadastro_fundos()
    funds = {}
    for k, s_ in serie.items():
        datas = sorted(s_)
        fim_mes = {}
        for d in datas:
            fim_mes[d[:7]] = d
        pontos = sorted(set(list(fim_mes.values()) + datas[-5:]))
        q = [[d, s_[d]] for d in pontos]
        velho = anterior.get(k, {}).get("q", [])
        junt = {d: c for d, c in velho}
        junt.update({d: c for d, c in q})
        q = [[d, junt[d]] for d in sorted(junt)][-30:]
        reg = {"q": q}
        reg.update(cad.get(k, {}))
        if k in pl and pl[k][1]:
            reg["pl"] = round(pl[k][1])
        funds[k] = reg
    gravar_json("fundos_catalogo.json", {"geradoEm": AGORA.isoformat(timespec="seconds"), "source": "CVM – informe diário e cadastro de fundos", "funds": funds})
    # histórico de fins de mês (estado guardado no main; só meses completos) + carga inicial desde 2021
    hist = {}
    for f in glob.glob(os.path.join(DADOS, "fundos_hist", "*.json")):
        if not f.endswith("estado.json"):
            hist.update(ler_json(os.path.relpath(f, DADOS), {}))
    estado = ler_json("fundos_hist/estado.json", {"feitos": []})
    mes_atual = HOJE.strftime("%Y%m")

    def absorver_mes(series, mes):
        for k, s_ in series.items():
            ds = sorted(d for d in s_ if d.replace("-", "")[:6] == mes)
            if ds:
                hist.setdefault(k, {})[mes] = [ds[-1], s_[ds[-1]]]

    for mes in meses:
        if mes < mes_atual:
            absorver_mes(serie, mes)
            if mes not in estado["feitos"]:
                estado["feitos"].append(mes)
    pend, m = [], dt.date(2021, 1, 1)
    while m.strftime("%Y%m") < mes_atual:
        if m.strftime("%Y%m") not in estado["feitos"]:
            pend.append(m.strftime("%Y%m"))
        m = (m.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    limite_hist = time.time() + 6 * 60
    for mes in sorted(pend, reverse=True)[:10]:
        if time.time() > limite_hist:
            break
        try:
            r = baixar(URL_CVM.format(mes), aceita_404=True, timeout=300)
            if r is None:
                estado["feitos"].append(mes)     # mês sem arquivo mensal na CVM
                continue
            s_mes = {}
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                for nome in z.namelist():
                    with z.open(nome) as f:
                        leitor = csv.reader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";")
                        cab = next(leitor)
                        c_cnpj = next(i for i, c in enumerate(cab) if c.startswith("CNPJ_FUNDO"))
                        c_sub = cab.index("ID_SUBCLASSE") if "ID_SUBCLASSE" in cab else None
                        c_data, c_cota = cab.index("DT_COMPTC"), cab.index("VL_QUOTA")
                        for L in leitor:
                            if c_sub is not None and c_sub < len(L) and L[c_sub].strip():
                                continue
                            k = re.sub(r"[^0-9A-Z]", "", L[c_cnpj].upper())
                            cota = num(L[c_cota])
                            if len(k) == 14 and cota:
                                s_mes.setdefault(k, {})[L[c_data]] = cota
            absorver_mes(s_mes, mes)
            estado["feitos"].append(mes)
        except Exception as e:  # noqa: BLE001
            diag("cvm_hist_" + mes, URL_CVM.format(mes), erro=e)
    hist_fatias = {}
    for k, v in hist.items():
        hist_fatias.setdefault(k[:2], {})[k] = dict(sorted(v.items()))
    for pre, dados in hist_fatias.items():
        gravar_json(f"fundos_hist/{pre}.json", dados)
    estado["feitos"] = sorted(set(estado["feitos"]))
    gravar_json("fundos_hist/estado.json", estado)

    fatias = {}
    for k, v in funds.items():
        h = [x for _, x in sorted((hist.get(k) or {}).items())]
        q = {d: c for d, c in h}
        q.update({d: c for d, c in v.get("q", [])})
        v = dict(v, q=[[d, q[d]] for d in sorted(q)])
        fatias.setdefault(k[:2], {})[k] = v
    for pre, dados in fatias.items():
        gravar_json(f"fundos/{pre}.json", {"source": "CVM – informe diário e cadastro de fundos", "funds": dados})
    com_nome = sum(1 for v in funds.values() if v.get("n"))
    return {"fundos": len(funds), "com_nome": com_nome, "linhas": lidos,
            "historico_meses": len(estado["feitos"]), "historico_pendente": max(0, len(pend) - 10)}


# ---------------------------------------------------------------- principal

def rapido():
    """Execução intradiária (a cada 30 min): só o Tesouro Direto, que muda durante o dia."""
    mercado = ler_json("mercado.json", {})
    antes = (mercado.get("td") or {}).get("ALL")
    tesouro_direto_site(mercado)
    try:
        dolar = ler_json("dolar.json", {})
        if dolar.get("serie"):
            antes_b = json.dumps(dolar.get("boletins"))
            ptax_boletins(dolar)
            if json.dumps(dolar.get("boletins")) != antes_b:
                dolar["atualizadoEm"] = AGORA.isoformat(timespec="seconds")
                gravar_json("dolar.json", dolar)
                mercado["dolar"] = dolar_resumo(dolar)
                gravar_json("mercado.json", mercado)
            STATUS["bcb_dolar_ptax"] = {"ok": True, "em": AGORA.isoformat(timespec="seconds"), "boletins": len((dolar.get("boletins") or {}).get("lista", []))}
    except Exception as e:  # noqa: BLE001
        STATUS["bcb_dolar_ptax"] = {"ok": False, "em": AGORA.isoformat(timespec="seconds"), "erro": str(e)[:300]}
    st = ler_json("status.json", {"fontes": {}})
    st.setdefault("fontes", {}).update(STATUS)
    st["intradiario_em"] = AGORA.isoformat(timespec="seconds")
    td = mercado.get("td") or {}
    if STATUS.get("tesouro_direto_site", {}).get("via") and td.get("ALL"):
        td["hora"] = AGORA.strftime("%H:%M")
        td["coletadoEm"] = AGORA.isoformat(timespec="seconds")
        mercado["updatedAt"] = AGORA.isoformat(timespec="seconds")
        gravar_json("mercado.json", mercado)
        st["intradiario_mudou"] = antes != td["ALL"]
    gravar_json("status.json", st)
    print("Intradiário:", STATUS.get("tesouro_direto_site"))


def main():
    if "--rapido" in sys.argv:
        return rapido()
    mercado = ler_json("mercado.json", {})
    anbima_publicos(mercado)
    tesouro_direto(mercado)        # Tesouro Transparente: histórico (pode atrasar alguns dias)
    tesouro_direto_site(mercado)   # site do Tesouro Direto: dados do dia, quando disponível
    anbima_curva(mercado)
    anbima_curva_hist()
    bcb(mercado)
    bcb_dolar(mercado)
    ipca(mercado)
    anbima_debentures()
    snd_catalogo()
    anbima_cri_cra()
    cvm_cri_cra()
    fundosnet_termos()
    cvm_catalogo_fundos()
    fundosnet_textos()             # por último: usa o tempo que sobrar

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
