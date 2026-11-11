"""Robô das companhias abertas: fatos relevantes e resultados trimestrais (CVM, dados abertos).

1) Fatos relevantes e comunicados (IPE: informações periódicas e eventuais). A CVM publica a lista de todos os
   documentos entregues pelas companhias em
   https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_<ano>.zip
   O robô guarda, dos últimos 120 dias, os fatos relevantes, comunicados ao mercado e avisos aos acionistas das
   companhias com ações na B3, com data, categoria, assunto e o link do documento na CVM. Cada item recebe um TEMA
   por palavras do assunto (recompra, proventos, aquisição, emissão de dívida, recuperação judicial…): é uma
   classificação por regras, sem modelo de linguagem; o texto do documento não é lido nem resumido.

2) Resultados trimestrais (ITR) e anuais (DFP): receita, EBIT e lucro de cada trimestre dos últimos 3 anos.
   O 4º trimestre não é entregue em separado: sai do ano (DFP) menos os três primeiros trimestres (ITR).

Grava fatos.json, trimestral.json e estado.json (com os cabeçalhos encontrados, para conferência).

Uso: python scripts/empresas.py <entrada> <saída>
"""
import datetime as dt
import io
import os
import re
import sys
import unicodedata
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fundos as FU  # noqa: E402  (baixar, ler_csv, gravar, outro_ramo)
import emissores as EM  # noqa: E402  (contas, linha: leitura de DRE da DFP e do ITR)

URL_IPE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_{}.zip"
HOJE = dt.date.today()
DIAS = 120
POR_CIA = 25

COLS = {
    "cnpj": ["cnpj_companhia", "cnpj_cia", "cnpj"],
    "nome": ["nome_companhia", "denom_cia", "nome_cia"],
    "cat": ["categoria"],
    "tipo": ["tipo"],
    "especie": ["especie"],
    "assunto": ["assunto"],
    "data": ["data_entrega", "data_referencia", "dt_entrega"],
    "link": ["link_download", "link_doc", "link"],
}
CATEGORIAS = ("fato relevante", "comunicado ao mercado", "aviso aos acionistas")

# tema -> (nível, palavras). Nível 1: pode afetar a capacidade de pagamento ou o controle; 2: relevante; 3: rotina.
TEMAS = [
    ("recuperacao", 1, ["recuperacao judicial", "recuperacao extrajudicial", "falencia", "pedido de tutela", "medida cautelar", "stay period"]),
    ("inadimplencia", 1, ["vencimento antecipado", "inadimplemento", "descumprimento", "waiver", "covenant", "nao pagamento", "default", "standstill", "reperfilamento", "reestruturacao da divida", "reestruturacao de divida"]),
    ("rating", 1, ["rating", "classificacao de risco", "rebaixamento", "elevacao da nota"]),
    ("investigacao", 1, ["investigacao", "operacao da policia", "busca e apreensao", "inconsistencias contabeis", "fraude", "republicacao das demonstracoes", "reapresentacao das demonstracoes", "denuncia"]),
    ("recompra", 2, ["recompra", "programa de aquisicao de acoes", "aquisicao de acoes de emissao propria"]),
    ("proventos", 2, ["dividendo", "juros sobre capital", "jcp", "proventos", "distribuicao de lucros", "restituicao de capital", "reducao de capital"]),
    ("controle", 2, ["alienacao de controle", "mudanca de controle", "troca de controle", "oferta publica de aquisicao", "opa", "acordo de acionistas", "fechamento de capital", "cancelamento de registro"]),
    ("fusao", 2, ["aquisicao", "incorporacao", "fusao", "combinacao de negocios", "venda de ativo", "alienacao de ativo", "alienacao de participacao", "desinvestimento", "joint venture", "cisao"]),
    ("emissao", 2, ["emissao de debentures", "debentures", "notas comerciais", "oferta publica de distribuicao", "follow-on", "aumento de capital", "bonds", "senior notes", "captacao", "financiamento"]),
    ("gestao", 2, ["renuncia", "eleicao de diretor", "eleicao de membro", "novo diretor", "diretor presidente", "ceo", "cfo", "diretor financeiro", "destituicao"]),
    ("projecoes", 2, ["projecoes", "guidance", "estimativas", "previa operacional", "previa de resultado", "dados operacionais"]),
    ("acoes", 3, ["grupamento", "desdobramento", "bonificacao", "conversao de acoes"]),
    ("processo", 2, ["processo", "arbitragem", "acao judicial", "decisao judicial", "auto de infracao", "multa", "cade", "aneel", "anatel", "anp"]),
]


def sem_acento(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower().strip()


def classificar(texto):
    """(tema, nível) pelo assunto do documento; ('outros', 3) quando nenhuma palavra bate."""
    s = " " + re.sub(r"[^a-z0-9 -]+", " ", sem_acento(texto)) + " "
    for tema, nivel, palavras in TEMAS:
        for p in palavras:
            if (" " + p + " ") in s or (len(p) > 5 and p in s):
                return tema, nivel
    return "outros", 3


def achar_colunas(cab):
    n = {sem_acento(c): c for c in cab}
    return {k: next((n[a] for a in alts if a in n), None) for k, alts in COLS.items()}


def data_iso(s):
    s = (s or "").strip()[:10]
    if re.match(r"\d{4}-\d{2}-\d{2}", s):
        return s
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", s)
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def montar_fatos(linhas, alvo, hoje=None):
    """{cnpj: [[data, categoria, tema, nível, assunto, link]]} dos últimos DIAS dias, mais recentes primeiro."""
    hoje = hoje or HOJE
    corte = (hoje - dt.timedelta(days=DIAS)).isoformat()
    out, vistos = {}, set()
    for L in linhas:
        cnpj = re.sub(r"\D", "", L.get("cnpj") or "")
        cat = sem_acento(L.get("cat"))
        d = data_iso(L.get("data"))
        if cnpj not in alvo or not d or d < corte or not any(c in cat for c in CATEGORIAS):
            continue
        assunto = re.sub(r"\s+", " ", (L.get("assunto") or L.get("tipo") or L.get("especie") or "").strip())[:180]
        chave = (cnpj, d, assunto.lower())
        if chave in vistos:        # reapresentações e versões do mesmo documento
            continue
        vistos.add(chave)
        tema, nivel = classificar(assunto + " " + (L.get("tipo") or "") + " " + (L.get("especie") or ""))
        rot = "Fato relevante" if "fato" in cat else "Comunicado" if "comunicado" in cat else "Aviso aos acionistas"
        out.setdefault(cnpj, []).append([d, rot, tema, nivel, assunto, (L.get("link") or "").strip()])
    for k in out:
        out[k].sort(key=lambda x: (x[0], -x[3]), reverse=True)
        out[k] = out[k][:POR_CIA]
    return out


def ler_ipe(anos):
    linhas, diag = [], {}
    for ano in anos:
        try:
            r = FU.baixar(URL_IPE.format(ano), aceita_404=True, timeout=(15, 600))
            if r is None:
                diag[str(ano)] = "sem arquivo"
                continue
            z = zipfile.ZipFile(io.BytesIO(r.content))
            csvs = [n for n in z.namelist() if n.lower().endswith(".csv")]
            if not csvs:
                diag[str(ano)] = "zip sem csv"
                continue
            it = FU.ler_csv(z.open(csvs[0]))
            primeiro = next(it, None)
            if not primeiro:
                continue
            C = achar_colunas(list(primeiro))
            diag[str(ano)] = {"lido": csvs[0], "cabecalho": list(primeiro), "colunas": C}
            if not (C["cnpj"] and C["cat"] and C["data"]):
                diag[str(ano)]["erro"] = "colunas essenciais não encontradas"
                continue
            for L in [primeiro, *it]:
                linhas.append({k: (L.get(c, "") if c else "") for k, c in C.items()})
        except Exception as e:  # noqa: BLE001
            diag[str(ano)] = str(e)[:200]
    return linhas, diag


def trimestres(dfp, itr):
    """Junta ITR (trimestres isolados) e DFP (ano) em {fim: [receita, ebit, lucro]}; o 4º tri = ano − 3 trimestres.

    dfp: {ano: [receita, ebit, lucro]}; itr: {fim 'AAAA-MM-DD': [receita, ebit, lucro]}.
    """
    out = {f: list(v) for f, v in itr.items()}
    for ano, tot in dfp.items():
        tr = [v for f, v in itr.items() if f[:4] == str(ano) and f[5:7] in ("03", "06", "09")]
        if len(tr) != 3:
            continue
        q4 = [None if tot[i] is None or any(t[i] is None for t in tr) else tot[i] - sum(t[i] for t in tr) for i in range(3)]
        out[f"{ano}-12-31"] = q4
    return dict(sorted(out.items())[-12:])


def ler_trimestral(alvo):
    """{cnpj: {fim: [receita, ebit, lucro]}} dos últimos 3 anos."""
    dfp, itr, diag = {}, {}, {}
    pega = lambda c: [EM.g(c, "3.01"), EM.busca(c, "3.", "antes do resultado financeiro"), EM.linha(c, {}, {}, {})[4]]  # noqa: E731
    for ano in range(HOJE.year - 3, HOJE.year + 1):
        for url, trimestral, dest, rot in ((EM.URL_DFP, False, dfp, "dfp"), (EM.URL_ITR, True, itr, "itr")):
            try:
                r = FU.baixar(url.format(ano), aceita_404=True, timeout=(15, 600))
                if r is None:
                    continue
                D = EM.contas(zipfile.ZipFile(io.BytesIO(r.content)), "DRE", alvo, trimestral)
                n = 0
                for k, por in D.items():
                    for fim, c in por.items():
                        if fim == "_t":
                            continue
                        if trimestral:
                            dest.setdefault(k, {})[fim] = pega(c)
                        else:
                            dest.setdefault(k, {})[int(fim[:4])] = pega(c)
                        n += 1
                diag[f"{rot}{ano}"] = n
            except Exception as e:  # noqa: BLE001
                diag[f"{rot}{ano}"] = str(e)[:150]
    out = {}
    for k in set(dfp) | set(itr):
        q = trimestres(dfp.get(k, {}), itr.get(k, {}))
        if len(q) >= 2:
            out[k] = q
    return out, diag


def principal():
    sai = sys.argv[2]   # a entrada (sys.argv[1]) não é usada
    os.makedirs(sai, exist_ok=True)
    emp = FU.outro_ramo("ativos", "emp.json") or {}
    alvo = {re.sub(r"\D", "", str(e.get("cnpj") or "")): True for e in emp.values() if isinstance(e, dict) and e.get("cnpj")}
    alvo.pop("", None)
    if not alvo:
        raise SystemExit("empresas: emp.json do ramo ativos sem CNPJs; nada a fazer")
    agora = dt.datetime.now().isoformat(timespec="seconds")
    linhas, d1 = ler_ipe([HOJE.year - 1, HOJE.year] if HOJE.month <= 4 else [HOJE.year])
    fatos = montar_fatos(linhas, alvo)
    FU.gravar(os.path.join(sai, "fatos.json"), {"geradoEm": agora, "dias": DIAS, "cols": ["data", "categoria", "tema", "nivel", "assunto", "link"],
                                                 "cias": fatos, "fonte": "CVM: documentos entregues pelas companhias abertas (IPE, dados abertos)"})
    tri, d2 = ler_trimestral(alvo)
    FU.gravar(os.path.join(sai, "trimestral.json"), {"geradoEm": agora, "cols": ["receita", "ebit", "lucro"], "e": tri,
                                                      "fonte": "CVM: ITR e DFP (dados abertos); 4º trimestre = ano menos os três primeiros"})
    FU.gravar(os.path.join(sai, "estado.json"), {"geradoEm": agora, "companhias": len(alvo), "com_fatos": len(fatos),
                                                  "fatos": sum(len(v) for v in fatos.values()), "com_trimestral": len(tri), "ipe": d1, "balancos": d2})
    print("empresas:", len(alvo), "companhias;", len(fatos), "com fatos;", len(tri), "com resultados trimestrais")
    if not fatos and not tri:
        raise SystemExit("empresas: nenhuma fonte respondeu")


if __name__ == "__main__":
    principal()
