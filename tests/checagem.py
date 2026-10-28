"""Checagem geral do app antes de publicar.

Abre o index.html deste checkout num navegador sem tela, com os dados reais
publicados pelos robôs, percorre todas as áreas e abas e abre fundos, ações,
FIIs e títulos do Tesouro. Falha se aparecer erro de JavaScript ou texto
quebrado (NaN, undefined, Infinity) em algo visível.

Uso: python tests/checagem.py [caminho/do/index.html]
"""
import asyncio
import json
import os
import sys
import urllib.request

from playwright.async_api import async_playwright

INDEX = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "index.html")
RAIZ = os.path.dirname(INDEX)
APP = "https://wagneria206-app.github.io/dados-mercado/"
RAW = "https://raw.githubusercontent.com/wagneria206-app/dados-mercado/"
RUINS = ("NaN", "undefined", "Infinity", "[object Object]")
problemas = []


def ruim(onde, texto):
    achou = [w for w in RUINS if w in texto]
    if achou:
        i = min(texto.find(w) for w in achou)
        problemas.append(f"{onde}: texto quebrado {achou} perto de «{texto[max(0, i - 80):i + 40]}»".replace("\n", " "))


def baixar(caminho):
    try:
        with urllib.request.urlopen(RAW + caminho, timeout=60) as r:
            return json.load(r)
    except Exception as e:  # base fora do ar não é erro do app
        print("aviso: não consegui ler", caminho, e)
        return None


def amostra_fundos():
    idx = baixar("fundos/idx.json")
    if not idx:
        return []
    cols = idx["cols"]
    c, pl = cols.index("cnpj"), cols.index("pl")
    linhas = sorted((r for r in idx["rows"] if r[pl]), key=lambda r: -r[pl])
    # os 4 maiores e alguns do meio da lista, inclusive subclasses (chave de 15 letras)
    ks = [r[c] for r in linhas[:4]] + [r[c] for r in linhas[len(linhas) // 3::max(1, len(linhas) // 7)][:4]]
    sub = [r[c] for r in linhas if len(str(r[c])) == 15][:2]
    return ks + sub


async def esperar(pg, sel, segundos=25):
    texto = ""
    for _ in range(segundos * 4):
        texto = await pg.evaluate(f"(document.querySelector({json.dumps(sel)})||{{}}).innerText||''")
        if texto and "Carregando" not in texto:
            break
        await pg.wait_for_timeout(250)
    return texto


async def main():
    fundos = amostra_fundos()
    async with async_playwright() as p:
        nav = await p.chromium.launch()
        for largura in (1280, 390):
            ctx = await nav.new_context(viewport={"width": largura, "height": 900})
            pg = await ctx.new_page()
            tag = f"[{largura}px]"
            pg.on("pageerror", lambda e, t=tag: problemas.append(f"{t} erro de JavaScript: {e}"))

            async def rota(r):
                u = r.request.url
                if u.startswith(APP):
                    caminho = u[len(APP):].split("?")[0].split("#")[0] or "index.html"
                    arq = os.path.join(RAIZ, caminho)
                    if os.path.isfile(arq):
                        tipo = "text/html; charset=utf-8" if arq.endswith(".html") else None
                        return await r.fulfill(path=arq, content_type=tipo)
                if "fonts.g" in u:
                    return await r.abort()
                await r.continue_()

            await ctx.route("**/*", rota)
            await pg.goto(APP)
            await pg.wait_for_timeout(5000)

            areas = await pg.evaluate("[...document.querySelectorAll('.areas button[data-area]')].map(b=>b.dataset.area)")
            for area in areas:
                await pg.evaluate(f"document.querySelector('.areas button[data-area={area}]').click()")
                await pg.wait_for_timeout(1500)
                mods = await pg.evaluate(
                    "[...document.querySelectorAll('.tabs button[data-mod]')].filter(b=>b.offsetParent).map(b=>b.dataset.mod)")
                for mod in mods or [None]:
                    if mod:
                        await pg.evaluate(f"document.querySelector('.tabs button[data-mod={mod}]').click()")
                    for _ in range(40):  # até 10 s para a aba terminar de carregar
                        await pg.wait_for_timeout(250)
                        texto = await pg.evaluate("document.body.innerText")
                        if "Carregando" not in texto and _ >= 6:
                            break
                    ruim(f"{tag} {area}/{mod}", texto)
                    if len(texto) < 300:
                        problemas.append(f"{tag} {area}/{mod}: aba quase vazia")
                    print(tag, area, mod, len(texto), "caracteres", flush=True)

            if largura == 1280:
                # Tesouro: "Mostrar todos os títulos" precisa abrir a lista completa
                await pg.evaluate("document.querySelector('.areas button[data-area=mkt]').click()")
                await pg.evaluate("document.querySelector('.tabs button[data-mod=tx]').click()")
                await pg.wait_for_timeout(2500)
                conta = "[...document.querySelectorAll('#txOpp tr,#mkOut tr')].filter(r=>r.offsetParent).length"
                antes = await pg.evaluate(conta)
                await pg.evaluate("(document.getElementById('oppMore')||{click(){}}).click()")
                await pg.wait_for_timeout(1000)
                depois = await pg.evaluate(conta)
                print("Tesouro: linhas", antes, "→", depois)
                if depois <= antes:
                    problemas.append(f"Tesouro: 'Mostrar todos' não abriu mais títulos ({antes} → {depois})")

                await pg.evaluate("document.querySelector('.areas button[data-area=fnd]').click()")
                await pg.wait_for_timeout(1500)
                for k in fundos:
                    await pg.evaluate(f"location.hash='#fundo={k}'")
                    await pg.wait_for_timeout(400)
                    t = await esperar(pg, "#fnBody")
                    ruim(f"fundo {k}", t)
                    if len(t) < 800:
                        problemas.append(f"fundo {k}: página não abriu ({t[:80]!r})")
                    print("fundo", k, len(t))
                for a in ("PETR4", "ITUB4", "HGLG11", "BOVA11", "AAPL34", "TD-IPCA-2035", "TD-SELIC-2029", "TD-PRE-2027"):
                    await pg.evaluate(f"location.hash='#ativo={a}'")
                    await pg.wait_for_timeout(400)
                    t = await esperar(pg, "#atBody")
                    ruim(f"ativo {a}", t)
                    if len(t) < 600:
                        problemas.append(f"ativo {a}: página não abriu ({t[:80]!r})")
                    print("ativo", a, len(t))
            await ctx.close()
        await nav.close()

    if problemas:
        print("\nPROBLEMAS ENCONTRADOS:")
        for x in problemas:
            print(" -", x)
        sys.exit(1)
    print("\nTudo certo: nenhuma aba com erro.")


asyncio.run(main())
