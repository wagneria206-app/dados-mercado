#!/usr/bin/env python3
"""
Sincronização mecânica: dados do robô (pasta data/ deste repositório) -> banco do app Gestão de Carteiras.

Não lê páginas da web nem interpreta texto: só compara arquivos e monta as gravações.
Quem executa (a tarefa agendada do Claude) baixa os arquivos do robô e exporta o banco do app,
roda este script e aplica as gravações listadas em manifest.json.

Uso:
  python3 app_sync.py --data DIR_ROBO --db DIR_BANCO --out DIR_SAIDA [--register CODIGO ...] [--fund CNPJ ...]

DIR_ROBO  : cópia de data/ (mercado.json, debentures.json, cri_cra_anbima.json, catalogo_debentures.json,
            cri_cra_cvm.json, fundos_catalogo.json, td_historico.json, status.json, termos/indice.json,
            termos/textos.json)
DIR_BANCO : exportação do banco do app (ArtifactData com out_dir): market/current.json, papers/*.json,
            funds/*.json, tdhist/*.json, hist/*.json (as coleções que faltarem são tratadas como vazias)
Saída     : DIR_SAIDA/manifest.json  -> [{"op","collection","doc_id","file_path","motivo"}]
            DIR_SAIDA/termos.json    -> CRI/CRA que precisam das regras lidas do termo (com o id dos textos)
            DIR_SAIDA/relatorio.txt  -> resumo em português
"""
import argparse
import datetime as dt
import glob
import json
import os
import re
import sys

BRT = dt.timezone(dt.timedelta(hours=-3))
AGORA = dt.datetime.now(BRT).isoformat(timespec="seconds")

MSG_FONTES = {
    "anbima_titulos_publicos": "títulos públicos (ANBIMA)",
    "anbima_curva_juros": "curva de juros (ANBIMA)",
    "anbima_debentures": "debêntures (ANBIMA)",
    "anbima_cri_cra": "CRI/CRA (ANBIMA)",
    "tesouro_direto": "Tesouro Direto (Tesouro Transparente)",
    "tesouro_direto_site": "Tesouro Direto (site oficial)",
    "bcb_cdi_selic": "CDI e Selic (Banco Central)",
    "ibge_ipca": "IPCA (IBGE)",
    "cvm_cri_cra": "cadastro de CRI/CRA (CVM)",
    "cvm_catalogo_fundos": "cotas de fundos (CVM)",
    "snd_catalogo_debentures": "cadastro de debêntures (SND)",
    "fundosnet_termos": "índice de termos (Fundos.NET)",
    "fundosnet_textos": "textos dos termos (Fundos.NET)",
}


def ler(caminho, padrao=None):
    try:
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return padrao


def colecao(db, nome):
    out = {}
    for f in glob.glob(os.path.join(db, nome, "*.json")):
        d = ler(f, {})
        if isinstance(d, dict) and "data" in d and isinstance(d["data"], dict) and len(d) <= 3:
            d = d["data"]
        out[os.path.splitext(os.path.basename(f))[0]] = d
    return out


def cod_cri(c):
    c = re.sub(r"[^A-Z0-9]", "", (c or "").upper())
    c = re.sub(r"^CRA(?=CRA)", "", c)
    m = re.fullmatch(r"(?:CRI|CRA)(\d{2}[A-Z]\d{7})", c)
    return m.group(1) if m else c


def so_cnpj(s):
    return re.sub(r"[^0-9A-Z]", "", (s or "").upper())


class Saida:
    def __init__(self, out):
        self.out, self.manifest, self.n = out, [], 0
        os.makedirs(out, exist_ok=True)

    def grava(self, op, colecao, doc_id, dados, motivo):
        self.n += 1
        caminho = os.path.join(self.out, f"{self.n:04d}_{colecao}_{doc_id}.json")
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False)
        self.manifest.append({"op": op, "collection": colecao, "doc_id": doc_id,
                              "file_path": os.path.abspath(caminho), "motivo": motivo})


# ------------------------------------------------------------------ mercado

def sync_mercado(R, DB, S, rel):
    m = R["mercado"]
    atual = ler(os.path.join(DB, "market", "current.json"), {}) or {}
    if not m or not m.get("refDate"):
        rel.append("Mercado: o robô não tem dados de mercado; nada gravado.")
        return
    if atual.get("refDate") and atual["refDate"] > m["refDate"]:
        rel.append(f"Mercado: o app já tem {atual['refDate']}, mais novo que o robô ({m['refDate']}); mantido.")
        return
    falhas = [MSG_FONTES.get(k, k) for k, v in (R["status"].get("fontes") or {}).items() if not v.get("ok")]
    avisos = []
    td = m.get("td") or {}
    if td.get("date") and td["date"] < m["refDate"]:
        avisos.append(f"Tesouro Direto de {td['date'][8:10]}/{td['date'][5:7]}")
    if m.get("curveDate") and m["curveDate"] < m["refDate"]:
        avisos.append(f"curva de juros de {m['curveDate'][8:10]}/{m['curveDate'][5:7]}")
    notas = []
    if falhas:
        notas.append("Fontes com falha na última coleta: " + ", ".join(falhas) + " (mantido o último dado válido).")
    if avisos:
        notas.append("Dados mais antigos que a ANBIMA: " + ", ".join(avisos) + ".")
    doc = {k: m[k] for k in ("refDate", "anbima", "curvePre", "curveIpca", "curveDate", "inflacaoImplicita",
                             "ipca", "selicMonthly", "selicOver", "cdiDaily", "td") if k in m}
    if "td" in doc:
        t = doc["td"]
        t.setdefault("RENDA", [[int(r[1][:4]), r[2], r[3]] for r in t.get("ALL", []) if r[0] == "RENDA"])
        t.setdefault("EDUCA", [[int(r[1][:4]), r[2], r[3]] for r in t.get("ALL", []) if r[0] == "EDUCA"])
    doc.update({"updatedAt": AGORA, "status": "ok", "statusAt": AGORA, "notes": " ".join(notas),
                "source": "Robô dados-mercado (arquivos oficiais: ANBIMA, Tesouro, Banco Central, IBGE)",
                "robotRunAt": R["status"].get("rodou_em")})
    S.grava("set", "market", "current", doc, f"mercado de {m['refDate']} (antes {atual.get('refDate')})")
    rel.append(f"Mercado: {atual.get('refDate')} -> {m['refDate']}" + (f"; {' '.join(notas)}" if notas else ""))


def sync_historicos(R, DB, S, rel, papers):
    m = R["mercado"]
    if not m.get("refDate"):
        return
    hist = colecao(DB, "hist")
    ref = m["refDate"]
    if ref not in hist:
        deb = {}
        for code, p in papers.items():
            a = p.get("anbima") or {}
            if a.get("refDate") == ref and a.get("rate") is not None:
                deb[code] = a["rate"]
        td = m.get("td") or {}
        S.grava("set", "hist", ref, {
            "date": ref, "anbima": {k: [[r[0], r[1]] for r in v] for k, v in (m.get("anbima") or {}).items()},
            "td": [[r[0], r[1], r[2]] for r in td.get("ALL", [])], "tdDate": td.get("date"), "deb": deb,
        }, "histórico do dia")
    tdh = colecao(DB, "tdhist")
    novos = 0
    for d, linhas in sorted((R["td_hist"] or {}).items())[-15:]:
        if d in tdh:
            continue
        S.grava("set", "tdhist", d, {"date": d, "source": "Robô dados-mercado (Tesouro)",
                                     "rows": [[r[0], r[1], r[2], r[4] if len(r) > 4 else None] for r in linhas]},
                "histórico do Tesouro Direto")
        novos += 1
    if novos:
        rel.append(f"Histórico do Tesouro Direto: {novos} dia(s) novo(s).")


# ------------------------------------------------------------------ papéis

def taxa_anbima(R, p):
    """(registro ANBIMA ou None, data de referência)"""
    code = p.get("code", "")
    if p.get("type") == "DEB":
        return R["deb"].get("papers", {}).get(code.upper()), R["deb"].get("refDate")
    tab = R["cri"].get("papers", {})
    r = tab.get(cod_cri(code)) or tab.get(code.upper())
    return r, (r or {}).get("data") or R["cri"].get("refDate")


def registro_deb(R, code):
    c = R["catdeb"].get("papers", {}).get(code.upper())
    if not c:
        return None
    doc = dict(c)
    doc.update({"code": code.upper(), "status": "ok", "updatedAt": AGORA,
                "rulesSource": {"doc": "SND – características e agenda de eventos (debentures.com.br)", "url": "", "clausula": ""}})
    if doc.get("agendaParcial"):
        doc["notes"] = ((doc.get("notes") or "") + " Agenda passada não disponível no SND; amortizações já pagas "
                        "não constam do cronograma.").strip()
    return doc


def registro_cri(R, code):
    k = cod_cri(code)
    c = R["cvm"].get("certificados", {}).get(k) or R["cvm"].get("certificados", {}).get(code.upper())
    if not c:
        return None, None
    termo = R["indice"].get(k) or R["indice"].get(code.upper())
    nome = c.get("nomeEmissao") or ""
    doc = {
        "code": code.upper(), "type": c.get("type"), "status": "ok", "updatedAt": AGORA,
        "name": f"{nome} – {c.get('securitizadora', '')}, {c.get('emissao', '')}ª emissão, {c.get('serie', '')}ª série".strip(" –,"),
        "index": c.get("index") if c.get("index") in ("IPCA", "DI_SPREAD", "DI_PCT", "PRE") else None,
        "rate": c.get("rate"), "maturity": c.get("vencimento"), "isin": c.get("isin"),
        "securitizadora": c.get("securitizadora"), "official": False, "rulesVerified": False,
        "sources": [c.get("fonte", "CVM – informe mensal")],
        "notes": "Dados gerais do informe mensal da CVM. Cronograma e regras de correção: pendentes da leitura do termo de securitização.",
    }
    if termo:
        doc["rulesSource"] = {"doc": termo.get("documento", "Termo de Securitização") + f" (Fundos.NET, entregue em {termo.get('entrega', '')})",
                              "url": termo.get("url", ""), "clausula": ""}
        doc["sources"].append("Fundos.NET – termo de securitização")
    return {k2: v for k2, v in doc.items() if v is not None}, termo


def ids_termo(termo):
    if not termo:
        return []
    return [termo["idFnet"]] + [a["id"] for a in termo.get("aditamentos", [])]


def sync_papeis(R, DB, S, rel, registrar, termos_out):
    papers = colecao(DB, "papers")
    pedidos = {c.upper() for c in registrar}
    for code, p in papers.items():
        if p.get("status") == "pending":
            pedidos.add(code.upper())
    atual = 0
    for code in sorted(pedidos):
        p = papers.get(code, {})
        tipo = p.get("type") or ("DEB" if code.upper() in R["catdeb"].get("papers", {}) else
                                 "CRA" if code.upper().startswith("CRA") else "CRI")
        if tipo == "DEB":
            doc = registro_deb(R, code)
            if doc:
                S.grava("set", "papers", code, doc, "cadastro pelo catálogo do SND")
                papers[code] = doc
                rel.append(f"Cadastro {code}: debênture completa pelo SND.")
            else:
                rel.append(f"Cadastro {code}: não está no catálogo de debêntures do SND (registradas e não vencidas).")
            continue
        doc, termo = registro_cri(R, code)
        if not doc:
            rel.append(f"Cadastro {code}: não está no informe mensal da CVM de CRI/CRA.")
            continue
        # o que já estava no banco (cronograma, regras, anotações) prevalece; a CVM só completa
        merged = dict(doc)
        merged.update({k2: v for k2, v in p.items() if v not in (None, "", []) and k2 not in ("status", "updatedAt", "requestedAt")})
        merged["status"] = "ok" if merged.get("schedule") else "pending"
        if not merged.get("schedule"):
            merged["notes"] = "Aguardando a leitura do cronograma no termo de securitização. " + (p.get("notes") or "")
        doc = merged
        S.grava("set", "papers", code, doc, "cadastro pelo informe da CVM")
        papers[code] = doc
        rel.append(f"Cadastro {code}: dados gerais pela CVM" + ("; termo localizado." if termo else "; termo NÃO localizado no Fundos.NET."))
    # taxas de mercado
    for code, p in papers.items():
        if p.get("status") != "ok" or p.get("type") not in ("DEB", "CRI", "CRA"):
            continue
        reg, ref = taxa_anbima(R, p)
        if reg is None or not ref:
            continue
        velho = (p.get("anbima") or {}).get("refDate") or ""
        if reg.get("taxa") is None:
            if p.get("anbimaNA") != ref:
                S.grava("update", "papers", code, {"anbimaNA": ref}, "ANBIMA lista o papel sem taxa")
            continue
        if ref >= velho and ((p.get("anbima") or {}).get("rate") != reg["taxa"] or ref != velho):
            S.grava("update", "papers", code, {"anbima": {"refDate": ref, "rate": reg["taxa"], "pu": reg.get("pu")},
                                               "anbimaNA": {"__delete__": True}}, f"taxa ANBIMA de {ref}")
            p["anbima"] = {"refDate": ref, "rate": reg["taxa"], "pu": reg.get("pu")}
            atual += 1
    rel.append(f"Taxas ANBIMA atualizadas: {atual} papel(is).")
    # CRI/CRA que precisam das regras do termo
    textos = R["textos"]
    for code, p in papers.items():
        if p.get("type") not in ("CRI", "CRA") or p.get("rulesVerified") is True:
            continue
        termo = R["indice"].get(cod_cri(code)) or R["indice"].get(code.upper())
        ids = ids_termo(termo)
        prontos = [i for i in ids if (textos.get(str(i)) or {}).get("ok")]
        termos_out.append({"code": code, "ids": ids, "textos_prontos": prontos,
                           "url_texto": [f"data/termos/texto/{i}.txt.gz" for i in prontos],
                           "termo_url": (termo or {}).get("url"), "tem_cronograma": bool(p.get("schedule"))})
    return papers


# ------------------------------------------------------------------ fundos

def tipo_fundo(t, nome):
    s = (t or "") + " " + (nome or "")
    s = s.lower()
    if "previd" in s or "fie" in s.split():
        return "PREV"
    if "ações" in s or "acoes" in s or " fia" in s:
        return "ACOES"
    return "RF_LP"


def sync_fundos(R, DB, S, rel, pedir):
    funds = colecao(DB, "funds")
    cat = R["fundos"].get("funds", {})
    for c in pedir:
        k = so_cnpj(c)
        funds.setdefault(k, {"cnpj": k, "status": "pending", "quotes": []})
    n = 0
    for k, f in funds.items():
        k = so_cnpj(f.get("cnpj") or k)
        c = cat.get(k)
        if not c:
            if f.get("status") == "pending":
                S.grava("set", "funds", k, dict(f, status="error", updatedAt=AGORA,
                                               notes="CNPJ não encontrado no informe diário da CVM."), "fundo não encontrado")
            continue
        q = {d: [d, v, s] for d, v, *s in [(x[0], x[1], *(x[2:] or [""])) for x in (f.get("quotes") or [])]}
        for d, v in c.get("q", []):
            q[d] = [d, v, "CVM – informe diário"]
        novas = [q[d] for d in sorted(q)][-240:]
        doc = dict(f)
        mudou = novas != (f.get("quotes") or [])
        doc["quotes"] = novas
        if f.get("status") == "pending" or not f.get("name"):
            doc.update({"cnpj": k, "name": c.get("n") or f.get("name"), "admin": c.get("a") or f.get("admin"),
                        "cls": c.get("t") or f.get("cls"), "type": f.get("type") or tipo_fundo(c.get("t"), c.get("n")),
                        "status": "ok", "sources": ["CVM – cadastro e informe diário de fundos"],
                        "notes": f.get("notes") or "Tributação assumida pela classe da CVM; confira no regulamento."})
            mudou = True
        if mudou:
            doc["updatedAt"] = AGORA
            S.grava("set", "funds", k, doc, "cotas oficiais da CVM")
            n += 1
    rel.append(f"Fundos atualizados pela CVM: {n}.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--db", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--register", nargs="*", default=[])
    ap.add_argument("--fund", nargs="*", default=[])
    ap.add_argument("--so-cadastro", action="store_true", help="só cadastro (sem mercado nem históricos)")
    a = ap.parse_args()
    D = a.data
    R = {
        "mercado": ler(os.path.join(D, "mercado.json"), {}) or {},
        "status": ler(os.path.join(D, "status.json"), {}) or {},
        "deb": ler(os.path.join(D, "debentures.json"), {}) or {},
        "cri": ler(os.path.join(D, "cri_cra_anbima.json"), {}) or {},
        "catdeb": ler(os.path.join(D, "catalogo_debentures.json"), {}) or {},
        "cvm": ler(os.path.join(D, "cri_cra_cvm.json"), {}) or {},
        "fundos": ler(os.path.join(D, "fundos_catalogo.json"), {}) or {},
        "td_hist": ler(os.path.join(D, "td_historico.json"), {}) or {},
        "indice": ler(os.path.join(D, "termos", "indice.json"), {}) or {},
        "textos": ler(os.path.join(D, "termos", "textos.json"), {}) or {},
    }
    S, rel, termos = Saida(a.out), [], []
    if not a.so_cadastro:
        sync_mercado(R, a.db, S, rel)
    papers = sync_papeis(R, a.db, S, rel, a.register, termos)
    if not a.so_cadastro:
        sync_historicos(R, a.db, S, rel, papers)
    sync_fundos(R, a.db, S, rel, a.fund)
    with open(os.path.join(a.out, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(S.manifest, f, ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, "termos.json"), "w", encoding="utf-8") as f:
        json.dump(termos, f, ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, "relatorio.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(rel) + "\n")
    print("\n".join(rel))
    print(f"{len(S.manifest)} gravação(ões) em {os.path.join(a.out, 'manifest.json')}")


if __name__ == "__main__":
    sys.exit(main())
