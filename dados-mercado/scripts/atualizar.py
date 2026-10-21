#!/usr/bin/env python3
"""
Robô de dados de mercado.

Busca dados públicos oficiais e grava arquivos JSON na pasta data/:
  data/mercado.json       retrato do dia, no mesmo formato que o app usa (market/current)
  data/td_historico.json  preços e taxas do Tesouro Direto dos últimos 90 dias úteis
  data/debentures.json    taxas indicativas ANBIMA de todas as debêntures
  data/fundos.json        cotas da CVM dos fundos listados em config/fundos.txt
  data/status.json        resultado de cada fonte (ok / erro) e horário

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
S.headers["User-Agent"] = "Mozilla/5.0 (robo dados-mercado; GitHub Actions)"

STATUS = {}

URL_TD = ("https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3"
          "/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv")
URL_ANBIMA_PUB = "https://www.anbima.com.br/informacoes/merc-sec/arqs/ms{:%y%m%d}.txt"
URL_ANBIMA_DEB = "https://www.anbima.com.br/informacoes/merc-sec-debentures/arqs/db{:%y%m%d}.txt"
URL_SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{}/dados?formato=json&dataInicial={}&dataFinal={}"
URL_SIDRA_IPCA = "https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266/p/last%2024"
URL_CVM = "https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_{}.zip"


# ---------------------------------------------------------------- utilidades

def baixar(url, tentativas=3, aceita_404=False, timeout=120):
    ultimo = None
    for i in range(tentativas):
        try:
            r = S.get(url, timeout=timeout)
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
    os.makedirs(DADOS, exist_ok=True)
    caminho = os.path.join(DADOS, nome)
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


# ---------------------------------------------------------------- principal

def main():
    mercado = ler_json("mercado.json", {})
    anbima_publicos(mercado)
    tesouro_direto(mercado)
    bcb(mercado)
    ipca(mercado)
    anbima_debentures()
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
