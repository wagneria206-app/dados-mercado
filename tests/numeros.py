"""Testes dos números do app: cálculos conferidos contra casos conhecidos.

Abre o index.html deste checkout com ?teste=1 (que expõe as funções de cálculo em window.APPT) e confere:
  - calendário de dias úteis (ANBIMA/B3): 2024 teve 253 dias úteis e 2025, 252; feriados conhecidos;
  - IR regressivo e tabela oficial do IOF;
  - preço dos títulos públicos pela metodologia da ANBIMA (LTN, NTN-F e NTN-B), refeito aqui de forma
    independente, e os preços publicados pelo Tesouro Direto do dia (a calculadora precisa reproduzi-los);
  - TIR (XIRR) em fluxos com resposta conhecida;
  - curva Nelson-Siegel-Svensson;
  - equivalência LCI/LCA × CDB;
  - estatísticas de risco (volatilidade, retorno anualizado, perda máxima) numa série sintética;
  - teste de estresse (solução do sistema e composição dos choques) e comparador de investimento no exterior.

Uso: python tests/numeros.py [caminho/do/index.html]
"""
import asyncio
import math
import os
import sys

from playwright.async_api import async_playwright

INDEX = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "index.html")
RAIZ = os.path.dirname(INDEX)
APP = "https://wagneria206-app.github.io/dados-mercado/"
falhas = []
ok = [0]


def confere(nome, obtido, esperado, tol=0.0):
    try:
        bate = abs(float(obtido) - float(esperado)) <= tol
    except Exception:  # noqa: BLE001
        bate = obtido == esperado
    if bate:
        ok[0] += 1
    else:
        falhas.append(f"{nome}: obtido {obtido!r}, esperado {esperado!r} (tolerância {tol})")


def trunc(x, n):
    f = 10 ** n
    return math.floor(x * f + 1e-9) / f


async def main():
    async with async_playwright() as p:
        nav = await p.chromium.launch()
        ctx = await nav.new_context(viewport={"width": 1280, "height": 900})
        pg = await ctx.new_page()
        erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)))

        async def rota(r):
            u = r.request.url
            if u.startswith(APP):
                caminho = u[len(APP):].split("?")[0].split("#")[0] or "index.html"
                arq = os.path.join(RAIZ, caminho)
                if os.path.isfile(arq):
                    return await r.fulfill(path=arq, content_type="text/html; charset=utf-8" if arq.endswith(".html") else None)
            if "fonts.g" in u:
                return await r.abort()
            await r.continue_()

        await ctx.route("**/*", rota)
        await pg.goto(APP + "?teste=1")
        await pg.wait_for_function("typeof window.APPT==='function'", timeout=30000)
        J = lambda s: pg.evaluate("(()=>{const A=window.APPT();" + s + "})()")  # noqa: E731

        # ---------------- calendário
        dia = "Date.UTC({},{},{})"
        confere("dias úteis em 2024", await J(f"return A.du({dia.format(2024,0,1)},{dia.format(2025,0,1)})"), 253)
        confere("dias úteis em 2025", await J(f"return A.du({dia.format(2025,0,1)},{dia.format(2026,0,1)})"), 252)
        for d, esperado in (((2025, 2, 4), False), ((2025, 10, 20), False), ((2025, 3, 18), False), ((2025, 3, 21), False),
                            ((2025, 10, 21), True), ((2025, 5, 19), False), ((2026, 0, 2), True)):
            confere(f"dia útil {d[0]}-{d[1] + 1:02d}-{d[2]:02d}", await J(f"return A.isBiz({dia.format(*d)})"), esperado)

        # ---------------- IR e IOF
        for dias, aliq in ((1, .225), (180, .225), (181, .20), (360, .20), (361, .175), (720, .175), (721, .15), (3000, .15)):
            confere(f"IR com {dias} dias", await J(f"return A.irRate({dias})"), aliq)
        IOF = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0]
        for d in range(1, 31):
            confere(f"IOF no dia {d}", await J(f"return A.iofRate({d})"), IOF[d - 1] / 100, 1e-12)
        confere("IOF a partir de 30 dias", await J("return A.iofRate(45)"), 0)

        # ---------------- preços pela metodologia ANBIMA (refeitos aqui)
        confere("LTN: 12% a.a. em 252 dias úteis", await J("return A.price('LTN',[{du:252,amt:1000}],12).pu"), 892.857142, 1e-9)
        casos = [("LTN", "2029-01-01", 13.85), ("NTNF", "2035-01-01", 14.10), ("NTNB", "2035-05-15", 7.45), ("NTNB", "2050-08-15", 6.90)]
        for kind, venc, taxa in casos:
            r = await J(f"const t=A.VAL,fl=A.flowsFrom('{kind}',t,'{venc}');return {{fl,pu:A.price('{kind}',fl,{taxa},4500).pu,cot:A.price('{kind}',fl,{taxa},4500).cot}}")
            y = 1 + taxa / 100
            if kind == "NTNB":
                cot = trunc(sum(trunc(f["amt"] / y ** (f["du"] / 252), 10) for f in r["fl"]), 4)
                confere(f"cotação {kind} {venc}", r["cot"], cot, 1e-9)
                confere(f"PU {kind} {venc}", r["pu"], trunc(4500 * cot / 100, 6), 1e-6)
            else:
                pu = trunc(sum(trunc(f["amt"] / y ** (f["du"] / 252), 9) for f in r["fl"]), 6)
                confere(f"PU {kind} {venc}", r["pu"], pu, 1e-6)
            if kind == "NTNF":
                confere("cupom da NTN-F (10% a.a.)", r["fl"][0]["amt"], 48.80885, 1e-9)
            if kind == "NTNB":
                confere("cupom da NTN-B (6% a.a.)", r["fl"][0]["amt"], 2.956301, 1e-9)

        # ---------------- preços publicados do Tesouro Direto (precisam bater com o cálculo)
        for _ in range(60):
            n = await J("return A.CHK.n")
            if n:
                break
            await pg.wait_for_timeout(500)
        chk = await J("return {n:A.CHK.n,ok:A.CHK.ok,bad:A.CHK.bad}")
        if chk["n"]:
            frac = chk["ok"] / chk["n"]
            if frac < 0.95:
                falhas.append(f"preços publicados: só {chk['ok']} de {chk['n']} batem com o cálculo ({chk['bad'][:5]})")
            else:
                ok[0] += 1
            print(f"Tesouro/ANBIMA: {chk['ok']} de {chk['n']} preços publicados conferem")
        else:
            print("aviso: preços publicados não carregaram; conferência pulada")

        # ---------------- TIR
        confere("TIR: −100 hoje e +110 em 365 dias", await J("return A.spXirr([['2024-01-01',-100],['2024-12-31',110]])"), 0.10, 1e-6)
        r = await J("return A.spXirr([['2023-01-01',-1000],['2024-01-01',500],['2024-12-31',600]])")
        f = lambda x: -1000 + 500 / (1 + x) ** (365 / 365) + 600 / (1 + x) ** (730 / 365)  # noqa: E731
        lo, hi = 0.0, 1.0
        for _ in range(200):
            m = (lo + hi) / 2
            lo, hi = (m, hi) if f(m) > 0 else (lo, m)
        confere("TIR: −1000, +500 em 1 ano e +600 em 2 anos", r, (lo + hi) / 2, 1e-6)
        confere("alíquota de ações", await J("return A.spAliq('acoes',10)"), 0.15)
        confere("alíquota de fundo de curto prazo após 180 dias", await J("return A.spAliq('cp',400)"), 0.20)

        # ---------------- curva NSS
        b = [0.12, -0.02, 0.03, 0.01, 0.8, 0.2]
        for t in (0.5, 2.5, 10):
            e1, e2 = math.exp(-b[4] * t), math.exp(-b[5] * t)
            f1 = (1 - e1) / (b[4] * t)
            esp = (b[0] + b[1] * f1 + b[2] * (f1 - e1) + b[3] * ((1 - e2) / (b[5] * t) - e2)) * 100
            confere(f"curva NSS em {t} anos", await J(f"return A.nssY({b},{t})"), esp, 1e-9)

        # ---------------- equivalência LCI × CDB (prefixado)
        r = await J("const t=A.VAL,m=t+400*86400000,n=A.du(t,m),G=A.bkFactor('PRE',10,t,m),need=1+(G-1)/(1-A.irRate(400));return {n,eq:A.eqSolve('PRE',need,m,-5,80)}")
        G = 1.10 ** (r["n"] / 252)
        need = 1 + (G - 1) / (1 - 0.175)
        confere("CDB equivalente a LCI de 10% (400 dias)", r["eq"], (need ** (252 / r["n"]) - 1) * 100, 1e-6)
        confere("imposto de CDB com ganho de R$ 100 em 10 dias", await J("return A.bkTax({exempt:false},100,10)"), 100 * 0.66 + 100 * (1 - 0.66) * 0.225, 1e-9)

        # ---------------- estatísticas de risco numa série sintética
        n = 300
        rets = [0.001 + 0.004 * math.sin(j) for j in range(1, n)]
        q = [100.0]
        for x in rets:
            q.append(q[-1] * (1 + x))
        js = """const T=[],cdi=[],ib=[];let c=1,b=1;for(let j=0;j<%d;j++){T.push(Date.UTC(2020,0,1)+j*86400000);cdi.push(c);ib.push(b);c*=1.0005;b*=1+0.003*Math.cos(j)}
          const F={I:T.map((_,j)=>j),Q:%s,MK:[],M:new Map()},X={T,L:{d:{cdi,ibov:ib},m:{}},cal:T.map(t=>new Date(t).toISOString().slice(0,10))};
          return A.fnUse(X,()=>{const r=A.fnRisk(F,{t:T[0],i:0,k:0,q:F.Q[0]},null);return {vol:r.vol,ann:r.ann,dd:r.dd,tot:r.tot}})""" % (n, q)
        r = await J(js)
        mu = sum(rets) / len(rets)
        vol = math.sqrt(sum((x - mu) ** 2 for x in rets) / (len(rets) - 1)) * math.sqrt(252) * 100
        tot = q[-1] / q[0] - 1
        pk, dd = q[0], 0
        for v in q:
            pk = max(pk, v)
            dd = min(dd, v / pk - 1)
        confere("volatilidade anualizada", r["vol"], vol, 1e-9)
        confere("retorno no período", r["tot"], tot * 100, 1e-9)
        confere("retorno anualizado", r["ann"], ((1 + tot) ** (252 / (n - 1)) - 1) * 100, 1e-9)
        confere("perda máxima", r["dd"], dd * 100, 1e-9)

        # ---------------- estresse e exterior
        confere("sistema linear (estresse)", await J("return A.stSolve([[2,1,0],[1,3,1],[0,1,4]],[3,5,5]).map(x=>+x.toFixed(9)).join(',')"), "1,1,1")
        confere("choque com Bolsa e dólar compostos", await J("return A.stImp([1,1,0,0,1],[-0.1,0.2,0,0,-0.3],0)"), (1 - 0.1) * 1.2 * 0.7 - 1, 1e-12)
        r = await J("const s=Object.assign({},A.EX);Object.assign(A.EX,{v:100000,anos:10,ret:9,dy:1.3,cam:0,spread:0.5,iof:1.1,iofv:0.38,terL:0.23,terD:0.03,ir:15,ret_us:30});const o=A.exCalc().map(x=>x.liq);Object.assign(A.EX,s);return o")
        p, dy = (9 - 1.3) / 100, 0.013
        etf = 100000 * (1 + p + dy * 0.7 - 0.0023) ** 10
        bdr = 100000 * (1 + p + dy * 0.7 - 0.0003) ** 10
        ida = 100000 * (1 - 0.011 - 0.005)
        con = ida * (1 + p + dy * 0.7 - 0.0003) ** 10
        confere("exterior: ETF na B3", r[0], etf - (etf - 100000) * 0.15, 1e-6)
        confere("exterior: BDR", r[1], bdr - (bdr - 100000) * 0.15, 1e-6)
        confere("exterior: conta nos EUA", r[2], (con - (con - ida) * 0.15) * (1 - 0.0038 - 0.005), 1e-6)

        if erros:
            falhas.extend("erro de JavaScript: " + e for e in erros)
        await nav.close()

    print(f"\n{ok[0]} conferências certas, {len(falhas)} com problema.")
    if falhas:
        print("\nPROBLEMAS:")
        for x in falhas:
            print(" -", x)
        sys.exit(1)


asyncio.run(main())
