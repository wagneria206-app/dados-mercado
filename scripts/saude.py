"""Saúde das fontes: junta, a cada poucas horas, a situação de cada robô e de cada fonte de dados.

Lê:
  - as execuções dos robôs no GitHub Actions (últimos 35 dias);
  - o estado que cada robô publica no seu ramo (site/data/status.json, ativos/estado.json,
    fundos/estado.json, eua/estado.json e macro/macro.json).
Guarda o histórico diário (60 dias) no ramo "saude", em saude.json, que o app mostra em Mercado › Resumo.

Uso: python scripts/saude.py SAIDA   (precisa de GITHUB_TOKEN e GITHUB_REPOSITORY e dos ramos de dados já buscados)
"""
import datetime as dt
import json
import os
import re
import subprocess
import sys

import requests

REPO = os.environ.get("GITHUB_REPOSITORY", "wagneria206-app/dados-mercado")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
AGORA = dt.datetime.now(dt.timezone.utc)
HOJE = (AGORA - dt.timedelta(hours=3)).date().isoformat()  # dia em Brasília
DIAS_HIST = 60

ROBOS = [("atualizar.yml", "Mercado (taxas, curvas, dólar, inflação, crédito)"),
         ("intradiario.yml", "Tesouro Direto ao longo do dia"),
         ("fundos.yml", "Fundos de investimento (CVM)"),
         ("ativos.yml", "Bolsa (B3 e CVM)"),
         ("eua.yml", "Bolsa americana (SEC, Cboe, Nasdaq)"),
         ("macro.yml", "Economia (Focus, IBGE, BLS, Fed)"),
         ("checagem.yml", "Checagem automática do app")]

NOMES = {"anbima_cri_cra": "ANBIMA · CRI e CRA", "anbima_curva_hist": "ANBIMA · histórico das curvas", "anbima_curva_juros": "ANBIMA · curva de juros",
         "anbima_debentures": "ANBIMA · debêntures", "anbima_ima": "ANBIMA · índices IMA", "anbima_titulos_publicos": "ANBIMA · títulos públicos",
         "b3_futuros": "B3 · DI e dólar futuros", "bcb_cdi_selic": "Banco Central · CDI e Selic", "bcb_dolar_ptax": "Banco Central · dólar PTAX",
         "bcb_fluxo_estrangeiro": "Banco Central · capital estrangeiro", "bcb_ibge_inflacao": "Banco Central e IBGE · inflação detalhada",
         "credito_spreads": "Spreads de crédito (cálculo)", "cvm_catalogo_fundos": "CVM · catálogo de fundos", "cvm_cri_cra": "CVM · CRI e CRA",
         "dolar_fundamentos": "Dólar justo (BCB, BLS, Fed)", "fundosnet_termos": "B3 Fundos.NET · termos de emissão",
         "fundosnet_textos": "B3 Fundos.NET · documentos", "ibge_ipca": "IBGE · IPCA", "snd_catalogo_debentures": "SND · catálogo de debêntures",
         "tesouro_direto": "Tesouro Transparente · histórico", "tesouro_direto_site": "Tesouro Direto · preços do dia",
         "indices": "Cboe, Nasdaq e Tesouro dos EUA · índices e juros", "screener": "Nasdaq · cotações do dia", "sec_tickers": "SEC · lista de empresas",
         "empresas": "SEC · balanços das empresas", "focus": "Banco Central · Boletim Focus", "br": "IBGE e Banco Central · atividade, fiscal e crédito",
         "cm": "Tesouro Transparente · juros de prazo constante", "us": "BLS · inflação e emprego nos EUA", "fed": "Fed · projeções",
         "dxy": "Fed · índice do dólar", "brent": "EIA · petróleo Brent",
         "ativos": "B3 e CVM · cotações, proventos e balanços", "fundos": "CVM · cotas, cadastro e carteiras dos fundos"}
LIMITE_H = 60  # sem nova leitura há mais que isso (horas) = atrasada


def show(ref, caminho):
    try:
        return json.loads(subprocess.run(["git", "show", f"origin/{ref}:{caminho}"], capture_output=True, check=True).stdout)
    except Exception:  # noqa: BLE001
        return None


def erro_de_verdade(v):
    return isinstance(v, str) and re.search(r"(?i)erro|error|http|timeout|timed out|falh|exception|refused|recus|sem dados|não", v)


def fontes():
    out = []
    st = show("site", "data/status.json") or {}
    for k, v in (st.get("fontes") or {}).items():
        out.append({"id": k, "grupo": "Mercado", "ok": bool(v.get("ok")), "em": v.get("em"), "data": v.get("data"),
                    "erro": (v.get("erro") or v.get("motivo") or "")[:200] if not v.get("ok") else ""})
    for ref, arq, grupo, chave_ts in (("ativos", "estado.json", "Bolsa", "geradoEm"), ("fundos", "estado.json", "Fundos", "geradoEm")):
        e = show(ref, arq) or {}
        diag = {k: v for k, v in (e.get("diag") or {}).items() if erro_de_verdade(v)}
        out.append({"id": ref, "grupo": grupo, "ok": not diag, "em": e.get(chave_ts),
                    "erro": "; ".join(f"{k}: {v}" for k, v in list(diag.items())[:3])[:300]})
    e = show("eua", "estado.json") or {}
    diag = e.get("diag") or {}
    for k in ("indices", "screener", "sec_tickers", "empresas"):
        v = diag.get(k)
        if k == "empresas" and isinstance(v, dict):
            v = f"{len(v)} empresas com erro" if len(v) > 20 else ""
        out.append({"id": k, "grupo": "Bolsa americana", "ok": not v, "em": e.get("ts"), "erro": str(v or "")[:200]})
    m = show("macro", "macro.json") or {}
    diag = m.get("diag") or {}
    for k in ("focus", "br", "cm", "us", "fed", "dxy", "brent"):
        v = diag.get(k)
        out.append({"id": k, "grupo": "Economia", "ok": not v and bool(m.get(k)), "em": m.get("ts"), "erro": str(v or "")[:200]})
    for f in out:
        f["nome"] = NOMES.get(f["id"], f["id"])
        try:
            em = dt.datetime.fromisoformat(str(f["em"]).replace("Z", "+00:00"))
            if em.tzinfo is None:
                em = em.replace(tzinfo=dt.timezone.utc)
            horas = (AGORA - em).total_seconds() / 3600
        except Exception:  # noqa: BLE001
            horas = None
        if f["ok"] and (horas is None or horas > LIMITE_H):
            f["ok"] = False
            f["erro"] = "sem leitura nova " + (f"há {horas / 24:.0f} dias" if horas is not None else "registrada")
    return out


def execucoes():
    if not TOKEN:
        return []
    h = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json"}
    desde = (AGORA - dt.timedelta(days=35)).date().isoformat()
    out = []
    for wf, nome in ROBOS:
        runs, pg = [], 1
        while pg <= 5:
            r = requests.get(f"https://api.github.com/repos/{REPO}/actions/workflows/{wf}/runs",
                             params={"per_page": 100, "page": pg, "created": f">={desde}", "branch": "main"}, headers=h, timeout=60)
            if r.status_code != 200:
                break
            L = r.json().get("workflow_runs", [])
            runs += [x for x in L if x.get("event") in ("schedule", "workflow_dispatch", "push")]
            if len(L) < 100:
                break
            pg += 1
        dias = {}
        for x in runs:
            if x.get("status") != "completed":
                continue
            d = (dt.datetime.fromisoformat(x["created_at"].replace("Z", "+00:00")) - dt.timedelta(hours=3)).date().isoformat()
            c = x.get("conclusion")
            if c not in ("success", "failure", "timed_out", "startup_failure"):
                continue
            ok = c == "success"
            a = dias.get(d, [0, 0])
            a[0 if ok else 1] += 1
            dias[d] = a
        feitos = [x for x in runs if x.get("status") == "completed" and x.get("conclusion") in ("success", "failure", "timed_out", "startup_failure")]
        ult = feitos[0] if feitos else None
        ult_ok = next((x for x in feitos if x["conclusion"] == "success"), None)
        ult_fa = next((x for x in feitos if x["conclusion"] != "success"), None)
        n = len(feitos)
        out.append({"id": wf, "nome": nome, "n": n, "ok": sum(1 for x in feitos if x["conclusion"] == "success"),
                    "ultimo": {"em": ult["created_at"], "ok": ult["conclusion"] == "success", "url": ult["html_url"]} if ult else None,
                    "ultimo_ok": ult_ok["created_at"] if ult_ok else None,
                    "ultima_falha": {"em": ult_fa["created_at"], "url": ult_fa["html_url"]} if ult_fa else None,
                    "dias": {d: ("ok" if a[1] == 0 else "falha" if a[0] == 0 else "parcial") for d, a in dias.items()}})
    return out


def main(sai):
    os.makedirs(sai, exist_ok=True)
    velho = show("saude", "saude.json") or {}
    hist = velho.get("hist") or {}
    F = fontes()
    corte = (AGORA - dt.timedelta(days=DIAS_HIST)).date().isoformat()
    for f in F:
        h = hist.setdefault(f["id"], {})
        anterior = h.get(HOJE)
        # no mesmo dia, uma falha não é apagada por um sucesso posterior: vira "parcial"
        novo = "ok" if f["ok"] else "falha"
        h[HOJE] = novo if anterior in (None, novo) else "parcial"
        for d in [d for d in h if d < corte]:
            del h[d]
        f["dias"] = h
        f["falhas30"] = sum(1 for d, v in h.items() if v != "ok" and d >= (AGORA - dt.timedelta(days=30)).date().isoformat())
    R = execucoes() or velho.get("robos") or []
    out = {"ts": AGORA.isoformat(timespec="seconds"), "hoje": HOJE, "robos": R, "fontes": F, "hist": hist,
           "fonte": "GitHub Actions (execuções dos robôs) e o estado publicado por cada robô"}
    with open(os.path.join(sai, "saude.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    ruins = [f["nome"] for f in F if not f["ok"]]
    print(f"{len(R)} robôs, {len(F)} fontes; com problema agora: {ruins or 'nenhuma'}")


if __name__ == "__main__":
    main(sys.argv[1])
