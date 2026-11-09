"""Robô da saúde financeira dos emissores de debêntures (balanços entregues à CVM).

Para cada emissor do catálogo de debêntures do app, encontra o CNPJ no cadastro de companhias abertas da CVM (pelo
nome) e lê as demonstrações anuais (DFP) e trimestrais (ITR) dos últimos anos: receita, EBITDA, EBIT, despesa
financeira, lucro, caixa, dívida de curto e de longo prazo, patrimônio, ativo e passivo circulantes.
Com isso o app calcula dívida líquida/EBITDA, cobertura de juros, liquidez corrente e quanto da dívida vence em 12 meses.

Fontes (dados abertos da CVM):
  cadastro  https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv
  DFP       https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_<ano>.zip
  ITR       https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_<ano>.zip

Uso: python scripts/emissores.py <entrada> <saída> <pasta data do site (com catalogo_debentures.json)>
"""
import datetime as dt
import io
import json
import os
import re
import sys
import unicodedata
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fundos as FU  # noqa: E402  (baixar, ler_csv, num, gravar)

URL_CAD = "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv"
URL_DFP = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_{}.zip"
URL_ITR = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_{}.zip"
HOJE = dt.date.today()
ANOS = 5
SUFIXOS = r"\b(s ?a|s ?/ ?a|ltda|cia|companhia|de|do|da|dos|das|e|em recuperacao judicial|em rec judicial|holding|participacoes)\b"


def nome_chave(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)|[*.,/\-–]", " ", s)
    s = re.sub(SUFIXOS, " ", s)
    return re.sub(r"\s+", " ", s).strip()


def sem_acento(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()


def cadastro():
    """{nome normalizado: cnpj} das companhias abertas (ativas primeiro)."""
    r = FU.baixar(URL_CAD, timeout=(15, 300))
    out, sit = {}, {}
    for L in FU.ler_csv(io.BytesIO(r.content)):
        cnpj = re.sub(r"\D", "", L.get("CNPJ_CIA", ""))
        if len(cnpj) != 14:
            continue
        ativa = (L.get("SIT") or "").upper().startswith("ATIV")
        for campo in ("DENOM_SOCIAL", "DENOM_COMERC"):
            k = nome_chave(L.get(campo))
            if k and (k not in out or (ativa and not sit.get(k))):
                out[k], sit[k] = cnpj, ativa
    return out


def emissores(site):
    cat = json.load(open(os.path.join(site, "catalogo_debentures.json"), encoding="utf-8"))
    E = {}
    for cod, p in (cat.get("papers") or {}).items():
        nome = p.get("issuer") or p.get("name") or ""
        if "securitizadora" in sem_acento(nome):
            continue   # CRI/CRA via securitizadora: o risco é do devedor, não da securitizadora
        E.setdefault(nome, []).append(cod)
    return E


def contas(z, parte, alvo, trimestral):
    """{cnpj: {data_fim: {codigo: (descricao, valor)}}} só dos CNPJs pedidos (consolidado; individual se faltar)."""
    res = {}
    for tipo in ("con", "ind"):
        nomes = [n for n in z.namelist() if f"_{parte}_{tipo}_" in n]
        if not nomes:
            continue
        for L in FU.ler_csv(z.open(nomes[0])):
            k = re.sub(r"\D", "", L.get("CNPJ_CIA", ""))
            if k not in alvo or (L.get("ORDEM_EXERC", "").upper() not in ("ÚLTIMO", "ULTIMO")):
                continue
            if tipo == "ind" and res.get(k, {}).get("_t") == "con":
                continue
            ini, fim = L.get("DT_INI_EXERC", ""), L.get("DT_FIM_EXERC", "")
            if ini and parte in ("DRE", "DFC_MI", "DFC_MD"):
                meses = (int(fim[:4]) - int(ini[:4])) * 12 + int(fim[5:7]) - int(ini[5:7]) + 1
                if (not trimestral and meses < 10) or (trimestral and meses != 3 and parte == "DRE"):
                    continue
            esc = 1000 if (L.get("ESCALA_MOEDA") or "").upper().startswith("MIL") else 1
            d = res.setdefault(k, {"_t": tipo})
            if d["_t"] != tipo:
                continue
            d.setdefault(fim, {})[L.get("CD_CONTA", "")] = (sem_acento(L.get("DS_CONTA")), (FU.num(L.get("VL_CONTA")) or 0) * esc)
    return res


def g(c, cod):
    return (c.get(cod) or (None, None))[1]


def busca(c, nivel_prefixo, *palavras):
    for cod, (ds, v) in c.items():
        if cod.startswith(nivel_prefixo) and ds and all(p in ds for p in palavras):
            return v
    return None


def linha(dre, bpa, bpp, dfc):
    rec = g(dre, "3.01")
    ebit = busca(dre, "3.", "antes do resultado financeiro")
    dfin = busca(dre, "3.06.", "despesas financeiras")
    ll = None
    for cod, (ds, v) in sorted(dre.items(), key=lambda x: len(x[0])):
        if ds and ("lucro" in ds or "prejuizo" in ds) and ("periodo" in ds or "exercicio" in ds) and cod.count(".") == 1:
            ll = v
    da = None
    for cod, (ds, v) in dfc.items():
        if cod.startswith("6.01.01") and ds and ("depreciac" in ds or "amortizac" in ds or "exaust" in ds) and v:
            da = (da or 0) + abs(v)
    cx = sum(v for cod, (ds, v) in bpa.items() if cod in ("1.01.01", "1.01.02") and v) or None
    ac, pc = g(bpa, "1.01"), g(bpp, "2.01")
    dcp = sum(v for cod, (ds, v) in bpp.items() if cod.startswith("2.01.04") and cod.count(".") == 2 and v) or 0
    dlp = sum(v for cod, (ds, v) in bpp.items() if cod.startswith("2.02.01") and cod.count(".") == 2 and v) or 0
    pl = busca(bpp, "2.0", "patrimonio liquido")
    ebitda = ebit + da if ebit is not None and da is not None else None
    return [rec, ebitda, ebit, abs(dfin) if dfin else None, ll, cx, dcp, dlp, pl, ac, pc]


def principal():
    ent, sai, site = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(sai, exist_ok=True)
    E = emissores(site)
    cad = cadastro()
    alvo, achou, falta = {}, {}, []
    for nome, cods in E.items():
        cnpj = cad.get(nome_chave(nome))
        if cnpj:
            achou.setdefault(cnpj, {"n": nome, "deb": []})["deb"] += cods
            alvo[cnpj] = True
        else:
            falta.append(nome)
    out = {cnpj: dict(v, a={}, q={}) for cnpj, v in achou.items()}
    diag = {}
    for ano in range(HOJE.year - ANOS, HOJE.year):
        try:
            r = FU.baixar(URL_DFP.format(ano), aceita_404=True, timeout=(15, 600))
            if r is None:
                continue
            z = zipfile.ZipFile(io.BytesIO(r.content))
            D, A, P = contas(z, "DRE", alvo, False), contas(z, "BPA", alvo, False), contas(z, "BPP", alvo, False)
            F = contas(z, "DFC_MI", alvo, False) or contas(z, "DFC_MD", alvo, False)
            for k, por in D.items():
                for fim, c in por.items():
                    if fim != "_t":
                        out[k]["a"][fim[:4]] = linha(c, (A.get(k) or {}).get(fim, {}), (P.get(k) or {}).get(fim, {}), (F.get(k) or {}).get(fim, {})) + [fim]
            diag[f"dfp{ano}"] = len(D)
        except Exception as e:  # noqa: BLE001
            diag[f"dfp{ano}"] = str(e)[:150]
    for ano in (HOJE.year - 1, HOJE.year):
        try:
            r = FU.baixar(URL_ITR.format(ano), aceita_404=True, timeout=(15, 600))
            if r is None:
                continue
            z = zipfile.ZipFile(io.BytesIO(r.content))
            D, A, P = contas(z, "DRE", alvo, True), contas(z, "BPA", alvo, True), contas(z, "BPP", alvo, True)
            F = {}   # no ITR o fluxo de caixa é acumulado no ano: a depreciação não casa com o trimestre (o app usa a do último ano)
            for k, por in D.items():
                for fim, c in por.items():
                    if fim != "_t":
                        out[k]["q"][fim] = linha(c, (A.get(k) or {}).get(fim, {}), (P.get(k) or {}).get(fim, {}), (F.get(k) or {}).get(fim, {})) + [fim]
            diag[f"itr{ano}"] = len(D)
        except Exception as e:  # noqa: BLE001
            diag[f"itr{ano}"] = str(e)[:150]
    res = {"geradoEm": dt.datetime.now().isoformat(timespec="seconds"),
           "cols": ["receita", "ebitda", "ebit", "desp_fin", "lucro", "caixa", "divida_cp", "divida_lp", "pl", "ativo_circ", "passivo_circ", "fim"],
           "e": {k: v for k, v in out.items() if v["a"] or v["q"]},
           "fonte": "CVM: cadastro de companhias abertas, DFP e ITR (dados abertos)"}
    FU.gravar(os.path.join(sai, "emissores.json"), res)
    FU.gravar(os.path.join(sai, "estado.json"), {"geradoEm": res["geradoEm"], "emissores": len(E), "com_cnpj": len(achou),
                                                  "com_balanco": len(res["e"]), "sem_cnpj": sorted(falta)[:300], "diag": diag})
    print("emissores:", len(E), "no catálogo;", len(achou), "com CNPJ na CVM;", len(res["e"]), "com balanço")


if __name__ == "__main__":
    principal()
