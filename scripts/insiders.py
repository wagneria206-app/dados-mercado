"""Robô de negociações de administradores e controladores (CVM, Valores Mobiliários Negociados e Detidos).

Toda companhia aberta entrega à CVM, todo mês, as compras e vendas de ações feitas pelos controladores, conselheiros,
diretores e pessoas ligadas (Resolução CVM 44, art. 11). A CVM publica os formulários consolidados em
https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/VLMO/DADOS/vlmo_cia_aberta_<ano>.zip.

Grava insiders.json com, para cada companhia, o saldo de compras e vendas por mês e grupo (controlador, conselho,
diretoria) nos últimos 24 meses e as maiores movimentações recentes. Os nomes das pessoas não são publicados pela
CVM nesse arquivo consolidado e não são gravados.

As colunas são localizadas pelo nome (com alternativas), porque a CVM já mudou o leiaute desses arquivos; os
cabeçalhos encontrados ficam em estado.json para conferência.

Uso: python scripts/insiders.py <entrada> <saída>
"""
import datetime as dt
import io
import os
import re
import sys
import unicodedata
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fundos as FU  # noqa: E402  (baixar, ler_csv, num)

URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/VLMO/DADOS/vlmo_cia_aberta_{}.zip"
HOJE = dt.date.today()
MESES = 24
TOP = 15

# alternativas de nome para cada coluna (comparadas sem acento e em minúsculas)
COLS = {
    "cnpj": ["cnpj_companhia", "cnpj_cia", "cnpj"],
    "nome": ["nome_companhia", "denom_cia", "nome_cia", "companhia"],
    "cargo": ["tipo_cargo", "cargo", "tipo_pessoa", "tipo_empresa"],
    "mov": ["tipo_movimentacao", "movimentacao", "tipo_operacao", "operacao"],
    "ativo": ["tipo_ativo", "valor_mobiliario", "tipo_valor_mobiliario", "caracteristica_valor_mobiliario"],
    "data": ["data_movimentacao", "data_operacao", "data_negocio"],
    "ref": ["data_referencia", "dt_refer", "data_ref"],
    "qtd": ["quantidade", "qtd", "quantidade_movimentada"],
    "preco": ["preco_unitario", "preco", "valor_unitario"],
    "vol": ["volume", "valor_total", "valor_operacao", "volume_operacao"],
}


def sem_acento(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower().strip()


def achar_colunas(cab):
    n = {sem_acento(c): c for c in cab}
    out = {}
    for k, alts in COLS.items():
        for a in alts:
            if a in n:
                out[k] = n[a]
                break
        else:
            m = [c for s, c in n.items() if any(a in s for a in alts)]
            if m:
                out[k] = m[0]
    return out


def grupo_cargo(s):
    s = sem_acento(s)
    if "controlador" in s:
        return "ctl"
    if "conselho de administra" in s:
        return "cons"
    if "diretor" in s:
        return "dir"
    if "fiscal" in s or "tecnic" in s or "consultiv" in s or "comite" in s:
        return "out"
    if "propria" in s or "tesouraria" in s or "companhia" in s:
        return "cia"     # a própria companhia (recompra), informada no mesmo formulário
    return "out"


def lado(mov):
    s = sem_acento(mov)
    if "compra" in s or "aquisic" in s or "subscri" in s or "exercicio de opc" in s:
        return 1
    if "venda" in s or "alienac" in s:
        return -1
    return 0       # doações, bonificações, desdobramentos, empréstimos: não são negociação


def eh_acao(ativo):
    s = sem_acento(ativo)
    return not s or "acao" in s or "acoes" in s or "unit" in s or "certificado de deposito" in s


def data_iso(s):
    s = (s or "").strip()[:10]
    if re.match(r"\d{4}-\d{2}-\d{2}", s):
        return s
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", s)
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def ler(anos):
    linhas, diag = [], {}
    for ano in anos:
        r = FU.baixar(URL.format(ano), aceita_404=True, timeout=(15, 600))
        if r is None:
            diag[str(ano)] = "sem arquivo"
            continue
        z = zipfile.ZipFile(io.BytesIO(r.content))
        nomes = sorted(z.namelist(), key=lambda n: ("_con_" not in n, n))
        csvs = [n for n in nomes if n.lower().endswith(".csv")]
        diag[str(ano)] = {"arquivos": z.namelist()}
        if not csvs:
            continue
        it = FU.ler_csv(z.open(csvs[0]))
        primeiro = next(it, None)
        if not primeiro:
            continue
        C = achar_colunas(list(primeiro))
        diag[str(ano)].update(lido=csvs[0], cabecalho=list(primeiro), colunas=C)
        faltam = [k for k in ("cnpj", "mov", "qtd") if k not in C]
        if faltam:
            diag[str(ano)]["erro"] = "colunas não encontradas: " + ", ".join(faltam)
            continue
        for L in [primeiro, *it]:
            linhas.append({k: L.get(c, "") for k, c in C.items()})
    return linhas, diag


def principal():
    sai = sys.argv[2]   # a entrada (sys.argv[1]) não é usada: o robô baixa tudo de novo
    os.makedirs(sai, exist_ok=True)
    linhas, diag = ler([HOJE.year - 2, HOJE.year - 1, HOJE.year])
    k_fim = HOJE.year * 12 + HOJE.month - 1
    k0 = k_fim - MESES + 1
    cias = {}
    for L in linhas:
        if not eh_acao(L.get("ativo")):
            continue
        sd = lado(L.get("mov"))
        if not sd:
            continue
        d = data_iso(L.get("data")) or data_iso(L.get("ref"))
        if not d:
            continue
        k = int(d[:4]) * 12 + int(d[5:7]) - 1
        if not k0 <= k <= k_fim:
            continue
        q, p, v = FU.num(L.get("qtd")), FU.num(L.get("preco")), FU.num(L.get("vol"))
        if not v and q and p:
            v = q * p
        if not v or v <= 0:
            continue
        cnpj = re.sub(r"\D", "", L.get("cnpj") or "")
        if len(cnpj) != 14:
            continue
        g = grupo_cargo(L.get("cargo"))
        c = cias.setdefault(cnpj, {"n": (L.get("nome") or "").strip()[:80], "m": {}, "ult": []})
        mm = c["m"].setdefault(f"{k // 12:04d}{k % 12 + 1:02d}", {})
        a = mm.setdefault(g, [0.0, 0.0])
        a[0 if sd > 0 else 1] += v
        c["ult"].append([d, g, sd, round(q) if q else None, round(p, 4) if p else None, round(v)])
    for c in cias.values():
        for mm in c["m"].values():
            for g in mm:
                mm[g] = [round(mm[g][0]), round(mm[g][1])]
        c["ult"] = sorted(c["ult"], key=lambda x: (x[0], x[5]), reverse=True)
        lim = (HOJE - dt.timedelta(days=180)).isoformat()
        c["ult"] = sorted([x for x in c["ult"] if x[0] >= lim], key=lambda x: -x[5])[:TOP]
    out = {"geradoEm": dt.datetime.now().isoformat(timespec="seconds"), "ate": HOJE.isoformat(),
           "grupos": {"ctl": "Controladores", "cons": "Conselho de administração", "dir": "Diretoria",
                      "out": "Conselho fiscal e outros órgãos", "cia": "A própria companhia (recompra)"},
           "cias": cias, "fonte": "CVM: Valores Mobiliários Negociados e Detidos (Resolução CVM 44, art. 11), dados abertos"}
    FU.gravar(os.path.join(sai, "insiders.json"), out)
    FU.gravar(os.path.join(sai, "estado.json"), {"geradoEm": out["geradoEm"], "linhas": len(linhas), "companhias": len(cias), "diag": diag})
    print("insiders:", len(linhas), "linhas lidas;", len(cias), "companhias com negociação nos últimos", MESES, "meses")
    if not cias:
        raise SystemExit("nenhuma negociação encontrada: confira as colunas em estado.json")


if __name__ == "__main__":
    principal()
