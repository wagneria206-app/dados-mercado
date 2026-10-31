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


MESES_FUT = "FGHJKMNQUVXZ"


def conferencias():
    """Conferência cruzada: fontes diferentes precisam contar a mesma história. Pega dado errado, não só ausente."""
    out = []

    def add(id_, nome, ok, detalhe):
        out.append({"id": id_, "grupo": "Conferência cruzada", "nome": nome, "ok": bool(ok), "em": AGORA.isoformat(timespec="seconds"),
                    "erro": "" if ok else detalhe, "detalhe": detalhe})
    idx = show("ativos", "idx.json") or {}
    C = {n: i for i, n in enumerate(idx.get("cols", []))}
    linha = {r[0]: r for r in idx.get("rows", [])}
    cal = (show("ativos", "cal.json") or {}).get("d") or []
    bench = (show("ativos", "bench.json") or {}).get("d") or {}
    # 1) Ibovespa (índice da B3) × BOVA11 (ETF que o replica): variação do dia
    try:
        ib = [v for v in bench.get("ibov", []) if v]
        d_ib = (ib[-1] / ib[-2] - 1) * 100
        d_bova = linha["BOVA11"][C["d1"]]
        dif = abs(d_ib - d_bova)
        add("x_ibov", "Ibovespa (B3) × BOVA11", dif <= 0.8, f"variação do dia: índice {d_ib:+.2f}%, ETF {d_bova:+.2f}% (diferença de {dif:.2f} ponto)")
    except Exception as e:  # noqa: BLE001
        add("x_ibov", "Ibovespa (B3) × BOVA11", False, f"não deu para conferir: {e}")
    # 2) Dólar PTAX (Banco Central) × 1º vencimento do dólar futuro (B3), no mesmo dia
    try:
        merc = show("site", "data/mercado.json") or {}
        fut = show("site", "data/dolar_futuro.json") or {}
        dia = merc["dolar"]["data"]
        ptax = float(merc["dolar"]["venda"])
        L = fut["dias"].get(dia) or fut["dias"][max(fut["dias"])]
        venc = lambda c: (2000 + int(c[1:3]), MESES_FUT.index(c[0]))  # noqa: E731
        # o 1º vencimento liquida pela PTAX do fim do mês (fica igual a ela); a conferência usa o 2º, que embute só o juro de ~1 mês
        segundo = sorted(L, key=lambda r: venc(r[0]))[1]
        dif = (float(segundo[1]) / ptax - 1) * 100
        add("x_dolar", "Dólar PTAX × dólar futuro (B3)", -0.5 <= dif <= 3, f"PTAX R$ {ptax:.4f} e vencimento {segundo[0]} R$ {float(segundo[1]):.4f}: diferença de {dif:+.2f}%")
    except Exception as e:  # noqa: BLE001
        add("x_dolar", "Dólar PTAX × dólar futuro (B3)", False, f"não deu para conferir: {e}")
    # 3) S&P 500 (Cboe) × dólar (PTAX) × IVVB11 (ETF do S&P 500 em reais): retorno de cerca de 1 mês
    try:
        I = show("eua", "indices.json") or {}
        dmap = dict(zip(I["d"], I["s"]["spx"]))
        dt_fim = idx["dt"]
        dt_ini = (dt.date.fromisoformat(dt_fim) - dt.timedelta(days=30)).isoformat()
        em = lambda D, d: D[max(k for k in D if k <= d and D[k])]  # noqa: E731
        usd = {c: v for c, v in zip(cal, bench.get("usd", [])) if v}
        spx_r = em(dmap, dt_fim) / em(dmap, dt_ini) - 1
        usd_r = em(usd, dt_fim) / em(usd, dt_ini) - 1
        esperado = ((1 + spx_r) * (1 + usd_r) - 1) * 100
        r1m = linha["IVVB11"][C["r1m"]]
        dif = abs(esperado - r1m)
        add("x_spx", "S&P 500 × dólar × IVVB11", dif <= 3, f"1 mês: S&P 500 em reais {esperado:+.2f}%, IVVB11 {r1m:+.2f}% (diferença de {dif:.2f} ponto)")
    except Exception as e:  # noqa: BLE001
        add("x_spx", "S&P 500 × dólar × IVVB11", False, f"não deu para conferir: {e}")
    # 4) CDI × Selic (Banco Central): o CDI anda cerca de 0,10 ponto abaixo da Selic
    try:
        merc = show("site", "data/mercado.json") or {}
        c = merc["cdiDaily"]
        cdi = ((1 + c[max(c)] / 100) ** 252 - 1) * 100
        sel = float(merc["selicOver"])
        add("x_cdi", "CDI × Selic", abs(sel - cdi) <= 0.25, f"Selic {sel:.2f}% e CDI {cdi:.2f}% ao ano")
    except Exception as e:  # noqa: BLE001
        add("x_cdi", "CDI × Selic", False, f"não deu para conferir: {e}")
    # 5) Focus recente (o Banco Central publica toda segunda-feira)
    try:
        m = show("macro", "macro.json") or {}
        d = m["focus"]["selic"]["data"]
        dias = (dt.date.fromisoformat(HOJE) - dt.date.fromisoformat(d)).days
        add("x_focus", "Boletim Focus em dia", dias <= 10, f"última pesquisa de {d} ({dias} dias)")
    except Exception as e:  # noqa: BLE001
        add("x_focus", "Boletim Focus em dia", False, f"não deu para conferir: {e}")
    return out


def avisos(F, hist):
    """Abre um aviso no GitHub (que chega por e-mail e no app do GitHub) quando uma fonte passa 2 dias seguidos
    com problema, e fecha quando ela volta."""
    if not TOKEN:
        return
    h = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json"}
    base = f"https://api.github.com/repos/{REPO}/issues"
    ontem = (dt.date.fromisoformat(HOJE) - dt.timedelta(days=1)).isoformat()
    try:
        abertos = {i["title"]: i["number"] for i in requests.get(base, params={"state": "open", "labels": "fonte-fora", "per_page": 100}, headers=h, timeout=60).json()}
    except Exception:  # noqa: BLE001
        return
    for f in F:
        tit = f"Fonte com problema: {f['nome']}"
        d = hist.get(f["id"], {})
        ruim = not f["ok"] and d.get(ontem) in ("falha", "parcial")
        if ruim and tit not in abertos:
            corpo = (f"A fonte **{f['nome']}** ({f['grupo']}) está com problema há pelo menos 2 dias.\n\nÚltima mensagem: {f.get('erro') or '—'}\n\n"
                     "O app continua mostrando os últimos dados válidos. Este aviso fecha sozinho quando a fonte voltar.")
            requests.post(base, headers=h, timeout=60, json={"title": tit, "body": corpo, "labels": ["fonte-fora"]})
        elif f["ok"] and tit in abertos:
            n = abertos[tit]
            requests.post(f"{base}/{n}/comments", headers=h, timeout=60, json={"body": f"Voltou a funcionar em {HOJE}."})
            requests.patch(f"{base}/{n}", headers=h, timeout=60, json={"state": "closed"})


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
    F = fontes() + conferencias()
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
    try:
        avisos(F, hist)
    except Exception as e:  # noqa: BLE001
        print("avisos:", e)
    R = execucoes() or velho.get("robos") or []
    out = {"ts": AGORA.isoformat(timespec="seconds"), "hoje": HOJE, "robos": R, "fontes": F, "hist": hist,
           "fonte": "GitHub Actions (execuções dos robôs) e o estado publicado por cada robô"}
    with open(os.path.join(sai, "saude.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    ruins = [f["nome"] for f in F if not f["ok"]]
    print(f"{len(R)} robôs, {len(F)} fontes; com problema agora: {ruins or 'nenhuma'}")


if __name__ == "__main__":
    main(sys.argv[1])
