"""Robô de opções de ações (B3): volatilidade implícita no dinheiro e relação entre puts e calls.

Fontes (arquivos públicos diários da B3, os mesmos que o robô de ativos já usa):
  InstrumentsConsolidatedFile    cadastro: tipo da opção (OptnTp), preço de exercício (ExrcPric), vencimento (XprtnDt),
                                 ativo objeto (UndrlygTckrSymb1 ou Asst)
  TradeInformationConsolidatedFile  negócios do dia: último preço (LastPric), volume financeiro (NtlFinVol)

Para cada ação com opções negociadas: volatilidade implícita (Black-Scholes) da call e da put mais próximas do
dinheiro no primeiro vencimento com pelo menos 7 dias corridos, e volume financeiro de puts ÷ calls. Guarda o
histórico dos últimos 250 pregões em opcoes.json. Os nomes dos campos encontrados ficam em estado.json.

Uso: python scripts/opcoes.py <entrada> <saída>
"""
import datetime as dt
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ativos as AT  # noqa: E402  (b3_arquivo, num_b3)
import fundos as FU  # noqa: E402  (gravar, ler_json)

HIST = 250
JURO = float(os.environ.get("JURO_OPCOES", "0.14"))   # taxa livre de risco ao ano (aproximação pela Selic)


def ncdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def bs(tipo, s, k, t, r, v):
    if t <= 0 or v <= 0:
        return max(0.0, s - k) if tipo == "C" else max(0.0, k - s)
    d1 = (math.log(s / k) + (r + v * v / 2) * t) / (v * math.sqrt(t))
    d2 = d1 - v * math.sqrt(t)
    if tipo == "C":
        return s * ncdf(d1) - k * math.exp(-r * t) * ncdf(d2)
    return k * math.exp(-r * t) * ncdf(-d2) - s * ncdf(-d1)


def vol_implicita(tipo, preco, s, k, t, r):
    lo, hi = 0.01, 3.0
    if not (bs(tipo, s, k, t, r, lo) <= preco <= bs(tipo, s, k, t, r, hi)):
        return None
    for _ in range(60):
        mid = (lo + hi) / 2
        if bs(tipo, s, k, t, r, mid) < preco:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def tipo_opcao(x):
    t = (x.get("OptnTp") or x.get("OptnStyl") or "").upper()
    if t.startswith("C"):
        return "C"
    if t.startswith("P"):
        return "P"
    return None


def principal():
    ent, sai = sys.argv[1], sys.argv[2]
    os.makedirs(sai, exist_ok=True)
    velho = FU.ler_json(os.path.join(ent, "opcoes.json"), {}) or {}
    H = velho.get("t") or {}
    diag, dia = {}, None
    d = dt.date.today()
    for _ in range(7):
        d -= dt.timedelta(days=1)
        if d.weekday() >= 5:
            continue
        try:
            cad = AT.b3_arquivo("InstrumentsConsolidatedFile", d.isoformat())
            neg = AT.b3_arquivo("TradeInformationConsolidatedFile", d.isoformat()) if cad else None
        except Exception as e:  # noqa: BLE001
            diag[d.isoformat()] = str(e)[:150]
            continue
        if cad and neg:
            dia = d
            break
    if not dia:
        raise SystemExit("arquivos da B3 não encontrados nos últimos dias: " + str(diag)[:300])
    diag["campos_cadastro"] = sorted(cad[0].keys())
    diag["campos_negocios"] = sorted(neg[0].keys())
    N = {x.get("TckrSymb", "").strip(): x for x in neg}
    preco = {t: AT.num_b3(x.get("LastPric")) or AT.num_b3(x.get("TradAvrgPric")) for t, x in N.items()}
    # ativo objeto pelo código-raiz (Asst), quando o cadastro não traz o código da ação: a ação mais negociada da raiz
    melhor = {}
    for x in cad:
        cat = (x.get("SctyCtgyNm") or "").upper()
        t = (x.get("TckrSymb") or "").strip()
        if ("SHARES" in cat or "UNIT" in cat) and t in N:
            v = AT.num_b3(N[t].get("NtlFinVol")) or 0
            a = (x.get("Asst") or t[:4]).strip()
            if v > melhor.get(a, ("", -1))[1]:
                melhor[a] = (t, v)
    por = {}
    for x in cad:
        if "OPTION" not in (x.get("SctyCtgyNm") or "").upper():
            continue
        tp = tipo_opcao(x)
        k = AT.num_b3(x.get("ExrcPric"))
        venc = (x.get("XprtnDt") or "")[:10]
        obj = (x.get("UndrlygTckrSymb1") or "").strip().upper() or melhor.get((x.get("Asst") or "").strip(), ("", 0))[0]
        t = (x.get("TckrSymb") or "").strip()
        if not tp or not k or not venc or not obj or t not in N:
            continue
        p = preco.get(t)
        vol = AT.num_b3(N[t].get("NtlFinVol")) or 0
        if not p or vol <= 0:
            continue
        por.setdefault(obj, []).append((tp, k, venc, p, vol))
    hoje = dia.isoformat()
    n = 0
    for obj, L in por.items():
        s = preco.get(obj)
        if not s:
            continue
        vc = sum(v for tp, *_, v in L if tp == "C")
        vp = sum(v for tp, *_, v in L if tp == "P")
        vencs = sorted({x[2] for x in L if (dt.date.fromisoformat(x[2]) - dia).days >= 7})
        ivc = ivp = None
        if vencs:
            v0 = vencs[0]
            t = (dt.date.fromisoformat(v0) - dia).days / 365.0
            for tp in ("C", "P"):
                cand = sorted((abs(k / s - 1), k, p) for x_tp, k, venc, p, _ in L if x_tp == tp and venc == v0)
                if cand and cand[0][0] <= 0.1:
                    iv = vol_implicita(tp, cand[0][2], s, cand[0][1], t, JURO)
                    if tp == "C":
                        ivc = iv
                    else:
                        ivp = iv
        reg = [hoje, round(ivc * 100, 1) if ivc else None, round(ivp * 100, 1) if ivp else None, round(vp / vc, 2) if vc else None, round(vc + vp)]
        H[obj] = [x for x in (H.get(obj) or []) if x[0] != hoje] + [reg]
        H[obj] = sorted(H[obj])[-HIST:]
        n += 1
    out = {"geradoEm": dt.datetime.now().isoformat(timespec="seconds"), "dt": hoje,
           "cols": ["data", "vol_implicita_call", "vol_implicita_put", "puts_sobre_calls", "volume_opcoes"], "t": H,
           "fonte": "B3: cadastro de instrumentos e negócios do dia (opções de ações); volatilidade implícita pelo modelo de Black-Scholes"}
    FU.gravar(os.path.join(sai, "opcoes.json"), out)
    FU.gravar(os.path.join(sai, "estado.json"), {"geradoEm": out["geradoEm"], "dia": hoje, "acoes_com_opcoes": n, "diag": diag})
    print("opções:", n, "ações com opções negociadas em", hoje)


if __name__ == "__main__":
    principal()
