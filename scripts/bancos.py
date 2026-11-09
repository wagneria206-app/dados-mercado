"""Robô da saúde dos bancos (IF.data, Banco Central).

Lê, para os conglomerados prudenciais e instituições independentes (TipoInstituicao = 1), os relatórios trimestrais do
IF.data: Resumo (ativo, carteira de crédito, captações, patrimônio, lucro), Informações de Capital (Basileia, capital
principal, alavancagem) e Carteira de crédito por nível de risco (AA a H). Do cadastro vêm as instituições de cada
conglomerado, para o app achar o banco emissor de um CDB, LCI, LCA ou LF pelo nome.

API (OData, dados abertos do Banco Central):
  https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/

Os nomes das colunas variam entre datas (por exemplo "Índice de Basileia (n) = (e) / (j)"); por isso são procurados
por trechos do nome, e os nomes encontrados ficam em estado.json para conferência.

Uso: python scripts/bancos.py <entrada> <saída>
"""
import datetime as dt
import os
import re
import sys
import unicodedata

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fundos as FU  # noqa: E402  (UA, gravar)

BASE = "https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/"
TRIMESTRES = 6
HOJE = dt.date.today()

# indicador: (relatório, trechos que precisam estar no nome da coluna, trechos que não podem estar)
INDIC = {
    "ativo": ("1", ["ativo total"], []),
    "credito": ("1", ["carteira de credito classificada"], []),
    "captacoes": ("1", ["captac"], []),
    "pl": ("1", ["patrimonio liquido"], []),
    "lucro": ("1", ["lucro liquido"], []),
    "basileia": ("5", ["indice de basileia"], ["amplo"]),
    "capital_principal": ("5", ["indice de capital principal"], []),
    "nivel1": ("5", ["indice de capital nivel i"], ["ii"]),
    "alavancagem": ("5", ["razao de alavancagem"], []),
    "imobilizacao": ("5", ["indice de imobilizacao"], []),
}
NIVEIS = ["aa", "a", "b", "c", "d", "e", "f", "g", "h"]


def norm(s):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()).strip()


def odata(func, params):
    q = "&".join(f"@{k}={v}" for k, v in params.items())
    sig = ",".join(f"{k}=@{k}" for k in params)
    url = f"{BASE}{func}({sig})?{q}&$format=json"
    for t in range(4):
        try:
            r = requests.get(url, headers=FU.UA, timeout=(15, 300))
            r.raise_for_status()
            return r.json().get("value", [])
        except Exception:  # noqa: BLE001
            if t == 3:
                raise
    return []


def trimestres():
    """Datas-base (AAAAMM) dos últimos trimestres, da mais recente para a mais antiga."""
    k = HOJE.year * 12 + HOJE.month - 1
    out = []
    while len(out) < TRIMESTRES + 3:
        y, m = divmod(k, 12)
        if (m + 1) % 3 == 0:
            out.append(f"{y}{m + 1:02d}")
        k -= 1
    return out


def coluna(colunas, inclui, exclui):
    for c in colunas:
        n = norm(c)
        if all(p in n for p in inclui) and not any(p in n for p in exclui):
            return c
    return None


def principal():
    sai = sys.argv[2]   # a entrada (sys.argv[1]) não é usada: o robô baixa tudo de novo
    os.makedirs(sai, exist_ok=True)
    diag, datas, B = {}, [], {}
    for am in trimestres():
        if len(datas) >= TRIMESTRES:
            break
        try:
            resumo = odata("IfDataValores", {"AnoMes": am, "TipoInstituicao": 1, "Relatorio": "'1'"})
        except Exception as e:  # noqa: BLE001
            diag[am] = f"resumo: {e}"[:200]
            continue
        if not resumo:
            diag[am] = "sem dados ainda"
            continue
        linhas = {"1": resumo}
        for rel in ("5", "8"):
            try:
                linhas[rel] = odata("IfDataValores", {"AnoMes": am, "TipoInstituicao": 1, "Relatorio": f"'{rel}'"})
            except Exception as e:  # noqa: BLE001
                linhas[rel] = []
                diag[f"{am}_{rel}"] = str(e)[:200]
        datas.append(am)
        cols = {rel: sorted({x.get("NomeColuna", "") for x in L}) for rel, L in linhas.items()}
        achadas = {k: coluna(cols[rel], inc, exc) for k, (rel, inc, exc) in INDIC.items()}
        diag[am] = {"colunas": {r: c[:80] for r, c in cols.items()}, "usadas": achadas}
        idx = {}
        for rel, L in linhas.items():
            for x in L:
                idx.setdefault(str(x.get("CodInst")), {})[(rel, x.get("NomeColuna", ""))] = x.get("Saldo")
        for cod, V in idx.items():
            b = B.setdefault(cod, {"h": {}})
            r = {}
            for k, (rel, _, _) in INDIC.items():
                c = achadas.get(k)
                v = V.get((rel, c)) if c else None
                r[k] = float(v) if isinstance(v, (int, float)) else None
            # carteira por nível de risco: participação de E a H (risco elevado) na carteira classificada
            niv = {}
            for (rel, c), v in V.items():
                if rel == "8" and isinstance(v, (int, float)) and norm(c) in NIVEIS:
                    niv[norm(c)] = float(v)
            tot = sum(niv.values())
            r["risco_eh"] = sum(niv.get(n, 0) for n in ("e", "f", "g", "h")) / tot * 100 if tot else None
            r["risco_h"] = niv.get("h", 0) / tot * 100 if tot else None
            # o lucro do Resumo é acumulado no semestre: anualiza pelo número de meses do semestre
            mes = int(am[4:])
            meses = mes if mes <= 6 else mes - 6
            r["roe"] = r["lucro"] * 12 / meses / r["pl"] * 100 if r.get("lucro") is not None and r.get("pl") else None
            b["h"][am] = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items() if v is not None}
    # cadastro: instituições de cada conglomerado (para achar o banco pelo nome)
    nomes = {}
    if datas:
        try:
            for x in odata("IfDataCadastro", {"AnoMes": datas[0]}):
                cg = str(x.get("CodConglomeradoPrudencial") or "").strip()
                ci = str(x.get("CodInst") or "").strip()
                alvo = cg if cg and cg in B else ci if ci in B else None
                if alvo:
                    nomes.setdefault(alvo, set()).add((x.get("NomeInstituicao") or "").strip())
        except Exception as e:  # noqa: BLE001
            diag["cadastro"] = str(e)[:200]
    # escala: o IF.data já publicou valores em reais e em milhares; o maior banco do país tem ativo acima de R$ 1 trilhão
    maior = max((h.get("ativo") or 0 for b in B.values() for h in b["h"].values()), default=0)
    esc = 1 if maior > 1e11 else 1000
    for b in B.values():
        for h in b["h"].values():
            for k in ("ativo", "credito", "captacoes", "pl", "lucro"):
                if h.get(k) is not None:
                    h[k] = round(h[k] * esc)
            for k in ("basileia", "capital_principal", "nivel1", "alavancagem", "imobilizacao"):
                if h.get(k) is not None and abs(h[k]) <= 1.5:      # índice publicado como fração (0,15 = 15%)
                    h[k] = round(h[k] * 100, 2)
            if h.get("roe") is not None:
                h["roe"] = round(h["roe"], 2)
    diag["escala"] = esc
    out = {}
    for cod, b in B.items():
        if not b["h"]:
            continue
        ult = b["h"][max(b["h"])]
        if not ult.get("ativo") or ult["ativo"] <= 0:
            continue
        nm = sorted(n for n in nomes.get(cod, ()) if n)
        out[cod] = {"n": nm[:12], "h": b["h"]}
    res = {"geradoEm": dt.datetime.now().isoformat(timespec="seconds"), "datas": datas,
           "unidade": "valores em reais; índices em %",
           "b": out, "fonte": "Banco Central do Brasil, IF.data (dados selecionados de instituições financeiras)"}
    FU.gravar(os.path.join(sai, "bancos.json"), res)
    FU.gravar(os.path.join(sai, "estado.json"), {"geradoEm": res["geradoEm"], "datas": datas, "bancos": len(out), "diag": diag})
    print("bancos:", len(out), "conglomerados; datas-base", datas)
    if not out:
        raise SystemExit("nenhum banco lido: confira estado.json")


if __name__ == "__main__":
    principal()
