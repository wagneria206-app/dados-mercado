"""Testes dos cálculos dos robôs (sem internet): casos com resposta conhecida.

  - Bolsa americana (scripts/eua.py): balanços da SEC em trimestres e 12 meses, escolha da moeda,
    indicadores (P/L, ROE, margens, crescimento) e ligação BDR → empresa na SEC;
  - Economia (scripts/macro.py): juros de prazo constante, uma observação por semana, leitura das
    projeções do Fed e da tabela do petróleo Brent.

Uso: python tests/robos.py
"""
import datetime as dt
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import atualizar  # noqa: E402
import eua  # noqa: E402
import macro  # noqa: E402

falhas, certos = [], [0]


def confere(nome, obtido, esperado, tol=0.0):
    try:
        bate = abs(float(obtido) - float(esperado)) <= tol
    except Exception:  # noqa: BLE001
        bate = obtido == esperado
    if bate:
        certos[0] += 1
    else:
        falhas.append(f"{nome}: obtido {obtido!r}, esperado {esperado!r}")


def fato(a, b, v, form="10-Q", filed="2026-01-01"):
    return {"start": a, "end": b, "val": v, "form": form, "filed": filed}


# ---------------- SEC: trimestres, acumulados e 12 meses
# ano fiscal = ano civil. A empresa informa o 1º trimestre direto e o resto só acumulado no ano (comum no fluxo de caixa).
fatos = {"Revenues": {"units": {"USD": [
    fato("2024-01-01", "2024-12-31", 400, "10-K"),
    fato("2025-01-01", "2025-03-31", 110), fato("2025-01-01", "2025-06-30", 230), fato("2025-01-01", "2025-09-30", 360),
    fato("2025-01-01", "2025-12-31", 500, "10-K"),
    fato("2026-01-01", "2026-03-31", 130), fato("2026-01-01", "2026-06-30", 270)]}}}
S = eua.serie(fatos, ["Revenues"], "USD", False, False)
an, tri = eua.anual_trimestral(S)
confere("SEC: receita anual de 2025", an.get("2025-12-31"), 500)
confere("SEC: 2º tri de 2025 pela diferença dos acumulados", tri.get("2025-06-30"), 120)
confere("SEC: 3º tri de 2025", tri.get("2025-09-30"), 130)
confere("SEC: 2º tri de 2026", tri.get("2026-06-30"), 140)
confere("SEC: 4º tri de 2025 = ano − 9 meses (500 − 360)", tri.get("2025-12-31"), 140)
fim, v = eua.ttm(an, tri)
confere("SEC: 12 meses até jun/2026 (130 + 140 + 130 + 140)", v, 540)
confere("SEC: data dos 12 meses", fim, "2026-06-30")
confere("SEC: 12 meses de um ano antes sem trimestres suficientes", eua.ttm_ant(an, tri, fim), None)
an2, tri2 = eua.anual_trimestral(eua.serie({"Revenues": {"units": {"USD": [fato("2024-01-01", "2024-12-31", 400, "10-K"), fato("2025-01-01", "2025-12-31", 500, "10-K")]}}}, ["Revenues"], "USD", False, False))
confere("SEC: empresa só com balanço anual (20-F) usa o último ano", eua.ttm(an2, tri2), ("2025-12-31", 500))
confere("SEC: crescimento contra o ano anterior", eua.ttm_ant(an2, tri2, "2025-12-31"), 400)
# prioridade de conceitos: o primeiro da lista vence, e o arquivamento mais recente vence dentro do mesmo conceito
f2 = {"Revenues": {"units": {"USD": [fato("2025-01-01", "2025-12-31", 10, "10-K", "2026-02-01"), fato("2025-01-01", "2025-12-31", 11, "10-K/A", "2026-05-01")]}},
      "SalesRevenueNet": {"units": {"USD": [fato("2025-01-01", "2025-12-31", 99, "10-K")]}}}
an, _ = eua.anual_trimestral(eua.serie(f2, ["Revenues", "SalesRevenueNet"], "USD", False, False))
confere("SEC: retificação mais recente prevalece", an["2025-12-31"], 11)
# moeda: a dos dados mais recentes; empate fica com o dólar
f3 = {"Revenue": {"units": {"TWD": [fato("2024-01-01", "2024-12-31", 1, "20-F")], "USD": [fato("2024-01-01", "2024-12-31", 1, "20-F")]}}}
confere("SEC: empate de datas fica com o dólar", eua.unidade(f3, ["Revenue"], False), "USD")
f3["Revenue"]["units"]["TWD"].append(fato("2025-01-01", "2025-12-31", 1, "20-F"))
confere("SEC: moeda com dado mais recente", eua.unidade(f3, ["Revenue"], False), "TWD")

# ---------------- indicadores
hoje = eua.HOJE
e = {"moeda": "USD", "ttm": {"rec": 1000, "rec_ant": 800, "ll": 200, "ll_ant": 160, "pl": 1000, "lop": 300, "divpg": 50,
                             "fim": (hoje - dt.timedelta(days=90)).isoformat()}}
m = eua.metricas(e, {"px": 10, "mcap": 4000, "d1": 1})
confere("P/L = valor de mercado ÷ lucro", m["pl"], 20)
confere("P/VP", m["pvp"], 4)
confere("ROE", m["roe"], 20)
confere("margem líquida", m["ml"], 20)
confere("margem operacional", m["mop"], 30)
confere("crescimento da receita", m["crec"], 25)
confere("dividend yield", m["dy"], 1.25)
e["ttm"]["fim"] = (hoje - dt.timedelta(days=600)).isoformat()
confere("balanço velho: sem P/L", eua.metricas(e, {"px": 10, "mcap": 4000, "d1": 1}).get("pl"), None)

# ---------------- ligação BDR → SEC
sec = [[320193, "Apple Inc.", "AAPL", "Nasdaq"], [1652044, "Alphabet Inc.", "GOOGL", "Nasdaq"], [1166691, "COMCAST CORP", "CMCSA", "Nasdaq"],
       [1166691, "COMCAST CORP", "CCZ", "NYSE"], [37996, "FORD MOTOR CO", "F", "NYSE"]]
lig = eua.ligar([("AAPL34", "APPLE INC."), ("GOGL34", "ALPHABET INC"), ("CMCS34", "COMCAST CORPORATION"), ("FDMO34", "FORD MOTORS COMPANY"),
                 ("XXXX34", "EMPRESA INEXISTENTE SA")], sec, {"AAPL": 1, "GOOGL": 1, "CMCSA": 1, "F": 1})
confere("BDR AAPL34 → AAPL", lig.get("AAPL34", {}).get("tk"), "AAPL")
confere("BDR GOGL34 → GOOGL", lig.get("GOGL34", {}).get("tk"), "GOOGL")
confere("BDR CMCS34 → CMCSA (não CCZ)", lig.get("CMCS34", {}).get("tk"), "CMCSA")
confere("BDR com nome diferente (lista manual) FDMO34 → F", lig.get("FDMO34", {}).get("tk"), "F")
confere("BDR sem empresa na SEC fica de fora", "XXXX34" in lig, False)

# ---------------- economia: prazo constante e semanas
confere("prazo constante: interpolação no meio", macro.interp([(8, 6.0), (12, 7.0)], 10), 6.5, 1e-9)
confere("prazo constante: vencimento exato", macro.interp([(5, 6.2), (10, 6.8)], 10), 6.8, 1e-9)
confere("prazo constante: vizinho longe demais", macro.interp([(1, 6.0), (30, 7.0)], 10), None)
confere("prazo constante: sem vencimento acima", macro.interp([(2, 6.0), (4, 7.0)], 10), None)
sem = macro.semanal([("2026-10-19", 1), ("2026-10-21", 2), ("2026-10-23", 3), ("2026-10-26", 4)])
confere("Focus: uma observação por semana (a última)", sem, [["2026-10-23", 3], ["2026-10-26", 4]])

# ---------------- projeções do Fed e Brent (HTML de exemplo no formato das páginas oficiais)
SEP = """<table><tr><th>Variable</th><th>Median1</th></tr><tr><th>2026</th><th>2027</th><th>Longer run</th><th>2026</th><th>2027</th><th>Longer run</th><th>2026</th><th>2027</th><th>Longer run</th></tr>
<tr><td>Change in real GDP</td><td>2.3</td><td>2.4</td><td>2.0</td><td>a</td><td>b</td><td>c</td><td>d</td><td>e</td><td>f</td></tr>
<tr><td>June projection</td><td>2.2</td><td>2.3</td><td>2.0</td></tr>
<tr><td>Federal funds rate</td><td>4.1</td><td>3.9</td><td>3.2</td></tr><tr><td>June projection</td><td>3.8</td><td>3.6</td><td>3.1</td></tr></table>"""


class R:
    def __init__(self, t):
        self.text = t
        self.content = t.encode()


macro.get = lambda u, **k: R("fomcprojtabl20260916.htm") if "fomccalendars" in u else R(SEP)
s = macro.fed_sep()
confere("Fed: data da projeção", s["data"], "2026-09-16")
confere("Fed: anos", s["anos"], ["2026", "2027", "Longo prazo"])
confere("Fed: juro de 2027", s["mediana"]["ffr"][1], 3.9)
confere("Fed: projeção anterior do PIB 2026", s["anterior"]["pib"][0], 2.2)
linhas = "".join(f"<tr><td class='B6'>&nbsp;&nbsp;2025 Dec-29 to Jan- 2</td><td>70.1</td><td>70.2</td><td>70.3</td><td></td><td>70.5</td></tr>" for _ in range(1))
mil = "".join(f"<tr><td>&nbsp;&nbsp;{2006 + i // 52} Jan- 2 to Jan- 6</td><td>1</td><td>1</td><td>1</td><td>1</td><td>1</td></tr>" for i in range(210))
macro.get = lambda u, **k: R(mil + linhas)
b = macro.brent()["s"]
confere("Brent: semana que vira o ano", b[-4:], [["2025-12-29", 70.1], ["2025-12-30", 70.2], ["2025-12-31", 70.3], ["2026-01-02", 70.5]])

# ---------------- Fundos.NET: termos de CRI/CRA escaneados não fazem o robô falhar
def termos(docs, ja=None):
    arqs = {"termos/indice.json": {"CRI1": {"idFnet": 1, "aditamentos": [{"id": 2}, {"id": 3}]}}, "termos/textos.json": ja or {},
            "cri_cra_anbima.json": {"papers": {}}, "cri_cra_cronogramas.json": {}, "cri_cra_cvm.json": {"certificados": {}}}
    gravado = {}
    atualizar.ler_json = lambda n, d: arqs.get(n, d)
    atualizar.gravar_json = lambda n, o: gravado.__setitem__(n, o)
    atualizar.fnet_pdf = lambda i: docs[i]
    atualizar.pdf_para_texto = lambda c: (_ for _ in ()).throw(RuntimeError("fora do ar")) if c == "erro" else c
    atualizar.STATUS.clear()
    atualizar.fundosnet_textos()
    return atualizar.STATUS["fundosnet_textos"], gravado.get("termos/textos.json", {})


st, t = termos({1: "texto " * 200, 2: "", 3: "erro"})
confere("Fundos.NET: lê o termo com texto", st.get("novos_agora"), 1)
confere("Fundos.NET: escaneado marcado e fora da fila", t.get("2", {}).get("escaneado"), True)
st, t = termos({2: "", 3: ""}, {"1": {"ok": True}})
confere("Fundos.NET: só escaneados na fila não é falha", st.get("ok"), True)
st, t = termos({2: "erro", 3: "erro"}, {"1": {"ok": True}})
confere("Fundos.NET: fonte fora do ar continua sendo falha", st.get("ok"), False)
st, t = termos({}, {"1": {"ok": True}, "2": {"ok": False, "erro": "PDF sem texto (provavelmente escaneado)", "tentativas": 1}, "3": {"ok": True}})
confere("Fundos.NET: registro antigo de PDF sem texto sai da fila", st.get("ok"), True)

# ---------------- inflação dos EUA: BLS, depois FRED, depois a última coleta (até 75 dias)
cpi = {f"{a}-{m:02d}": 100.0 + a for a in range(1995, 2027) for m in range(1, 13) if f"{a}-{m:02d}" <= "2026-09"}
def falha(*a, **k):
    raise RuntimeError("recusado")
atualizar.bls_cpi = lambda: cpi
confere("CPI EUA: BLS no ar", atualizar.cpi_eua_com_reserva([])[1], "BLS")
atualizar.bls_cpi = falha
atualizar.fred = lambda s: {k + "-01": v for k, v in cpi.items()}
confere("CPI EUA: BLS fora, usa o FRED", atualizar.cpi_eua_com_reserva([])[1][:4], "FRED")
atualizar.fred = falha
atualizar.ler_json = lambda n, d: {"mensal": {"cpi_eua": cpi}} if n == "dolar_fundamentos.json" else d
atualizar.HOJE = dt.date(2026, 10, 31)
confere("CPI EUA: os dois fora, usa a última coleta recente", atualizar.cpi_eua_com_reserva([])[1][:6], "última")
atualizar.HOJE = dt.date(2027, 1, 31)
confere("CPI EUA: última coleta velha demais não vale", atualizar.cpi_eua_com_reserva([])[0], None)

# fundos: identidade e grupo de risco das posições da carteira (CDA da CVM), para o raio-X e a sobreposição
import fundos  # noqa: E402
confere("CDA: ação pela raiz do código", fundos.posicao("BLC_4", {"CD_ATIVO": "PETR4"}, "Ações"), ("a:PETR", "acoes"))
confere("CDA: NTN-B pelo vencimento", fundos.posicao("BLC_1", {"TP_TITPUB": "NOTAS DO TESOURO NACIONAL - SERIE B", "DT_VENC": "2035-05-15"}, "Títulos Públicos"), ("tp:NTN-B:2035-05", "tipca"))
confere("CDA: compromissada é caixa", fundos.posicao("BLC_1", {"TP_TITPUB": "LETRAS FINANCEIRAS DO TESOURO", "DT_VENC": "2027-03-01"}, "Operações Compromissadas")[1], "compr")
confere("CDA: CDB pela raiz do CNPJ do banco", fundos.posicao("BLC_5", {"CNPJ_EMISSOR": "30.306.294/0001-45"}, "Depósitos a prazo e outros títulos de IF"), ("e:30306294", "banc"))
confere("CDA: debênture pelo emissor", fundos.posicao("BLC_6", {"CPF_CNPJ_EMISSOR": "33000167000101"}, "Debêntures"), ("e:33000167", "cred"))
confere("CDA: cota de outro fundo", fundos.posicao("BLC_2", {"CNPJ_FUNDO_CLASSE_COTA": "12.345.678/0001-90"}, "Cotas de Fundos"), ("f:" + fundos.chave("12.345.678/0001-90"), "cotas"))
confere("CDA: futuro é derivativo", fundos.posicao("BLC_4", {"CD_ATIVO": "DOLF27"}, "Mercado Futuro - Posições vendidas"), (None, "deriv"))

fundos.RATINGS.clear()
fundos.anota_rating("BLC_5", {"AG_RISCO": "Fitch", "GRAU_RISCO": "AAA(bra)", "CNPJ_EMISSOR": "60.746.948/0001-12", "EMISSOR": "BANCO BRADESCO", "DT_RISCO": "2026-05-10"})
fundos.anota_rating("BLC_5", {"AG_RISCO": "Fitch", "GRAU_RISCO": "AAA(bra)", "CNPJ_EMISSOR": "60746948000112", "EMISSOR": "BANCO BRADESCO", "DT_RISCO": "2026-08-01"})
fundos.anota_rating("BLC_5", {"AG_RISCO": "", "GRAU_RISCO": "AA", "CNPJ_EMISSOR": "60746948000112"})
r = fundos.ratings_json()["e"]["60746948"]
confere("rating da CDA: nota por agência e nº de posições", r[2], [["fitch", "AAA(BRA)", 2]])
confere("rating da CDA: data mais recente", r[1], "2026-08-01")

print(f"{certos[0]} conferências certas, {len(falhas)} com problema.")
if falhas:
    print("\nPROBLEMAS:")
    for x in falhas:
        print(" -", x)
    sys.exit(1)
