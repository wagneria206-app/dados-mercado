"""
Extração determinística do cronograma de pagamentos de um CRI/CRA a partir do texto integral do termo
de securitização (pdftotext -layout).

Procura tabelas com uma data por linha (dd/mm/aaaa) e, na mesma linha, a indicação de juros/amortização
(Sim/Não, X) e o percentual de amortização. Uma tabela só é aceita se:
  - as datas forem crescentes e a última coincidir com o vencimento da série (informe da CVM), e
  - a amortização fechar 100% (percentual sobre o saldo com último pagamento = 100%,
    ou percentuais sobre o valor de emissão somando 100%).
Quando o termo tem várias séries com o mesmo vencimento, usa a ordem da série.
Também lê, por palavras-chave, as regras de atualização do IPCA (mês do número-índice, dias úteis ou
corridos). Nada é inventado: o que não for encontrado fica de fora e é informado.
"""
import re
import unicodedata

DATA = re.compile(r"(?<![\d/])(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?!\d)")
MESES = {"janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
         "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12}
DATA_EXT = re.compile(r"(?<!\d)(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})", re.I)
PCT = re.compile(r"(?<![\d,.])(\d{1,3}(?:[.,]\d{1,10})?)\s*%")
NUM = re.compile(r"(?<![\d/,.])(\d{1,3},\d{2,10})(?![\d/])")
SIM = re.compile(r"\b(sim|n[aã]o|x|-|n/a)\b", re.I)


def _norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s)


def _ymd(m):
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1 <= d <= 31 and 1 <= mo <= 12 and 1990 <= y <= 2080):
        return None
    return f"{y:04d}-{mo:02d}-{d:02d}"


def _num(s):
    return float(s.replace(".", "").replace(",", ".")) if "," in s else float(s)


class _M:
    def __init__(self, d, m, y, end):
        self._g, self._end = (d, m, y), end

    def group(self, i):
        return self._g[i - 1]

    def end(self):
        return self._end


def _datas(L):
    out = list(DATA.finditer(L))
    for m in DATA_EXT.finditer(L):
        mes = MESES[_norm(m.group(2)).strip()]
        out.append(_M(m.group(1), str(mes), m.group(3), m.end()))
    return out


def _linha(L):
    """Linha de tabela de pagamentos -> (data, juros, amort_flag, pct) ou None."""
    ds = _datas(L)
    if len(ds) != 1 or len(L) > 220:
        return None
    dt = _ymd(ds[0])
    if not dt:
        return None
    resto = L[ds[0].end():]
    pcts = PCT.findall(resto) or NUM.findall(resto)
    flags = [f.lower() for f in SIM.findall(resto)]
    if not pcts and not flags:
        return None
    pct = _num(pcts[-1]) if pcts else None
    if pct is not None and pct > 100.0001:
        return None
    j = a = None
    if flags:
        j = flags[0] in ("sim", "x")
        if len(flags) > 1:
            a = flags[1] in ("sim", "x")
    return dt, j, a, pct


def tabelas(texto):
    """Agrupa linhas de pagamento consecutivas (tolera quebras de página) em tabelas."""
    out, cur, gap = [], [], 0
    for L in texto.splitlines():
        r = _linha(L)
        if r:
            if cur and r[0] <= cur[-1][0]:
                if len(cur) >= 3:
                    out.append(cur)
                cur = []
            cur.append(r)
            gap = 0
        else:
            gap += 1
            if cur and gap > 90:
                if len(cur) >= 3:
                    out.append(cur)
                cur = []
    if len(cur) >= 3:
        out.append(cur)
    return out


def _montar(tab):
    """Tabela -> cronograma no formato do app e base (SALDO/VNE), ou None se não fechar 100%."""
    rows = []
    for dt, j, a, pct in tab:
        p = pct or 0.0
        if a is False:
            p = 0.0
        jj = 1 if (j is None or j) else 0
        if not jj and p == 0:
            continue            # mês sem pagamento
        rows.append([dt, jj, round(p, 6)])
    if not rows:
        return None
    if all(p is None for _, _, _, p in tab):
        # tabela só com Sim/Não: aceita quando só o último pagamento amortiza (bullet)
        am = [a for _, _, a, _ in tab]
        if am[-1] and not any(am[:-1]):
            rows[-1][2] = 100.0
        else:
            return None
    soma, ult = sum(r[2] for r in rows), rows[-1][2]
    if abs(ult - 100) < 0.01:
        base = "SALDO"
    elif abs(soma - 100) < 0.05:
        base = "VNE"
    else:
        return None
    rows[-1][1] = 1
    return rows, base


def regras_ipca(texto):
    """Regras do IPCA lidas na definição do número-índice (NIk) e do pro rata (dup/dut ou dcp/dct)."""
    t = _norm(texto)
    r = {}
    trechos = [t[m.start():m.start() + 420] for m in re.finditer(r"\bni ?k\b", t)][:12]
    for tr in trechos:
        if re.search(r"segundo mes (imediatamente )?anterior|2o mes anterior|dois meses anteriores", tr):
            r["ipcaLag"] = 2
            break
        if re.search(r"mes (imediatamente )?anterior|mes imediatamente precedente", tr):
            r["ipcaLag"] = 1
            break
    if "ipcaLag" not in r:
        if re.search(r"segundo mes (imediatamente )?anterior", t):
            r["ipcaLag"] = 2
        elif re.search(r"mes (imediatamente )?anterior ao mes de atualizacao", t):
            r["ipcaLag"] = 1
    if re.search(r"\bdup\b", t) and re.search(r"\bdut\b", t):
        r["prorata"] = "du"
    elif re.search(r"\bdcp\b", t) and re.search(r"\bdct\b", t):
        r["prorata"] = "dc"
    return r


def _util(ymd):
    """Data de pagamento em fim de semana vai para a segunda-feira (os feriados ficam como estão no termo)."""
    from datetime import date, timedelta
    y, m, d = map(int, ymd.split("-"))
    x = date(y, m, d)
    while x.weekday() >= 5:
        x += timedelta(days=1)
    return x.isoformat()


def extrair(texto, serie):
    """serie: dict com 'vencimento' (AAAA-MM-DD), 'serie' (número), 'index', 'rate', 'dataEmissao'."""
    vencs = [v for v in (serie.get("vencimento"), serie.get("vencAnbima")) if v]
    cands = []
    for tab in tabelas(texto):
        m = _montar(tab)
        if not m:
            continue
        rows, base = m
        dv = min(abs(_dias(rows[-1][0], v)) for v in vencs) if vencs else 0
        if dv > 60:
            continue
        if serie.get("dataEmissao") and rows[0][0] < serie["dataEmissao"]:
            continue
        cands.append((rows, base, dv))
    if not cands:
        return None
    # mesmo vencimento em várias séries: usa a posição da série (1ª tabela = 1ª série, ...)
    exatos = [c for c in cands if c[2] <= 6]
    cands = exatos or cands
    escolha = cands[0]
    try:
        n = int(re.sub(r"\D", "", str(serie.get("serie") or "")) or 0)
    except ValueError:
        n = 0
    distintos = []
    for c in cands:
        if all(c[0] != d[0] for d in distintos):
            distintos.append(c)
    if len(distintos) > 1 and 1 <= n <= len(distintos):
        escolha = distintos[n - 1]
    elif len(distintos) > 1:
        return {"ambiguo": len(distintos)}
    rows, base, dv = escolha
    # coerência: juros periódicos (intervalo máximo de 13 meses, a contar do início) e taxa plausível
    pag = [serie.get("dataEmissao")] + [r[0] for r in rows if r[1]] if serie.get("dataEmissao") else [r[0] for r in rows if r[1]]
    pag = [x for x in pag if x]
    if any(_dias(pag[i + 1], pag[i]) > 400 for i in range(len(pag) - 1)):
        return {"incoerente": "intervalo entre pagamentos de juros maior que 13 meses (tabela só de amortização?)"}
    if serie.get("index") == "DI_SPREAD" and (serie.get("rate") or 0) > 30:
        return {"incoerente": "taxa do informe da CVM não parece spread sobre o CDI"}
    rows = [[_util(r[0]), r[1], r[2]] for r in rows]
    dias = [int(r[0][8:10]) for r in rows]
    out = {"schedule": rows, "basis": base, "linhas": len(rows), "annivDay": max(set(dias), key=dias.count)}
    if dv > 6:
        out["aviso"] = f"o último pagamento da tabela difere {dv} dias do vencimento informado à CVM"
    if serie.get("index") == "IPCA":
        out.update(regras_ipca(texto))
    return out


def _dias(a, b):
    from datetime import date
    y1, m1, d1 = map(int, a.split("-"))
    y2, m2, d2 = map(int, b.split("-"))
    return (date(y1, m1, d1) - date(y2, m2, d2)).days
