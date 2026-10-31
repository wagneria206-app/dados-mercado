"""Contratos dos dados: confere se os arquivos publicados pelos robôs têm os campos que o app usa.

Se um robô mudar o formato de um arquivo (renomear uma coluna, trocar uma lista por outra coisa), o app
quebraria em silêncio numa tela. Este teste pega isso antes, campo a campo, e diz qual arquivo e qual campo.

Uso: python tests/contratos.py
"""
import json
import sys
import urllib.request

RAW = "https://raw.githubusercontent.com/wagneria206-app/dados-mercado/"
falhas, certos = [], [0]


def baixar(caminho):
    try:
        with urllib.request.urlopen(urllib.request.Request(RAW + caminho, headers={"User-Agent": "contratos"}), timeout=120) as r:
            return json.load(r)
    except Exception as e:  # noqa: BLE001
        falhas.append(f"{caminho}: não consegui ler ({e})")
        return None


def pega(j, caminho):
    for p in caminho.split("."):
        if isinstance(j, dict) and p in j:
            j = j[p]
        else:
            return KeyError
    return j


def exige(arq, j, caminho, tipo=None, minimo=None):
    if j is None:
        return
    v = pega(j, caminho)
    if v is KeyError:
        falhas.append(f"{arq}: falta o campo «{caminho}»")
        return
    if tipo and not isinstance(v, tipo):
        falhas.append(f"{arq}: «{caminho}» deveria ser {tipo.__name__ if isinstance(tipo, type) else tipo}, veio {type(v).__name__}")
        return
    if minimo is not None and hasattr(v, "__len__") and len(v) < minimo:
        falhas.append(f"{arq}: «{caminho}» tem {len(v)} itens (mínimo {minimo})")
        return
    certos[0] += 1


def colunas(arq, j, cols, linhas=1):
    if j is None:
        return
    exige(arq, j, "rows", list, linhas)
    tem = set(j.get("cols") or [])
    for c in cols:
        if c in tem:
            certos[0] += 1
        else:
            falhas.append(f"{arq}: falta a coluna «{c}»")
    n = len(j.get("cols") or [])
    ruins = [i for i, r in enumerate((j.get("rows") or [])[:200]) if len(r) != n]
    if ruins:
        falhas.append(f"{arq}: linhas com número de colunas diferente do cabeçalho (ex.: linha {ruins[0]})")


num = (int, float)

# mercado (robô principal, ramo site)
m = baixar("site/data/mercado.json")
for c, t in (("refDate", str), ("dolar.venda", num), ("dolar.data", str), ("selicOver", num), ("ipca", dict), ("inflacaoImplicita", list),
             ("curvePre", (list, dict)), ("curveIpca", (list, dict)), ("td", dict), ("td.date", str), ("anbima", (dict, list)), ("cdiDaily", (dict, list))):
    exige("site/data/mercado.json", m, c, t)
exige("site/data/mercado.json", m, "ipca", dict, 24)
d = baixar("site/data/di_futuro.json")
exige("site/data/di_futuro.json", d, "dias", dict, 2)
ima = baixar("site/data/ima.json")
exige("site/data/ima.json", ima, "indices", list, 5)
exige("site/data/ima.json", ima, "data", str)
dol = baixar("site/data/dolar.json")
exige("site/data/dolar.json", dol, "serie", list, 1000)
# economia
x = baixar("macro/macro.json")
for c in ("focus.anuais.IPCA", "focus.anuais.Selic", "focus.anuais.Câmbio", "focus.anuais.PIB Total", "focus.selic.reunioes", "focus.ipca12", "br", "us", "fed", "dxy", "brent"):
    exige("macro/macro.json", x, c)
# bolsas e EUA
i = baixar("eua/indices.json")
exige("eua/indices.json", i, "d", list, 1000)
for s in ("spx", "djia", "vix", "comp", "ndx", "t2", "t10", "t3m"):
    exige("eua/indices.json", i, "s." + s, list)
    if i and isinstance(pega(i, "s." + s), list) and len(i["s"][s]) != len(i["d"]):
        falhas.append(f"eua/indices.json: série {s} com tamanho diferente das datas")
colunas("eua/idx.json", baixar("eua/idx.json"), ["t", "tk", "nome", "px", "d1", "mcap", "pl", "pvp", "roe", "ml", "dy"], 100)
a = baixar("ativos/idx.json")
colunas("ativos/idx.json", a, ["t", "nome", "tipo", "setor", "preco", "data", "d1", "r1m", "r12", "liq", "dy", "pl", "pvp"], 500)
exige("ativos/idx.json", a, "setores", list, 5)
cal = baixar("ativos/cal.json")
exige("ativos/cal.json", cal, "d", list, 1000)
b = baixar("ativos/bench.json")
for s in ("d.ibov", "d.cdi", "m"):
    exige("ativos/bench.json", b, s)
if cal and b and isinstance(pega(b, "d.ibov"), list) and len(b["d"]["ibov"]) != len(cal["d"]):
    falhas.append("ativos/bench.json: Ibovespa com tamanho diferente do calendário")
colunas("ativos/agenda.json", baixar("ativos/agenda.json"), ["t", "tipo", "prov", "datacom", "pagamento", "valor", "yield"], 10)
# fundos
f = baixar("fundos/idx_p.json")
colunas("fundos/idx_p.json", f, ["cnpj", "nome", "classe", "gestor", "pl", "cotistas", "rm", "r12", "ult"], 1000)
for c in ("classes", "gestores"):
    exige("fundos/idx_p.json", f, c, list, 3)
exige("fundos/cal.json", baixar("fundos/cal.json"), "d", list, 500)
# saúde das fontes
s = baixar("saude/saude.json")
for c, t in (("robos", list), ("fontes", list), ("hist", dict)):
    exige("saude/saude.json", s, c, t)

print(f"{certos[0]} campos conferidos, {len(falhas)} com problema.")
if falhas:
    print("\nPROBLEMAS:")
    for x in falhas:
        print(" -", x)
    sys.exit(1)
