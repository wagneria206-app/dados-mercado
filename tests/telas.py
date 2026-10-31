"""Fotografa todas as telas do app, no tamanho de um tablet, nos temas claro e escuro.

Serve para revisar a aparência a cada mudança sem abrir o app aparelho por aparelho: no GitHub, as fotos
ficam anexadas à execução da checagem (seção "Artifacts", arquivo "telas"). Não reprova nada sozinho.

Uso: python tests/telas.py [caminho/do/index.html] [pasta de saída]
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

INDEX = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "index.html")
SAIDA = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else "telas")
RAIZ = os.path.dirname(INDEX)
APP = "https://wagneria206-app.github.io/dados-mercado/"
LARGURA, ALTURA, MAX_ALTURA = 1180, 820, 4000   # iPad na horizontal; telas muito longas são cortadas


async def main():
    os.makedirs(SAIDA, exist_ok=True)
    async with async_playwright() as p:
        nav = await p.chromium.launch()
        for tema in ("claro", "escuro"):
            ctx = await nav.new_context(viewport={"width": LARGURA, "height": ALTURA})
            await ctx.add_init_script(f"try{{localStorage.setItem('tema','{tema}')}}catch(e){{}}")

            async def rota(r):
                u = r.request.url
                if u.startswith(APP):
                    arq = os.path.join(RAIZ, u[len(APP):].split("?")[0].split("#")[0] or "index.html")
                    if os.path.isfile(arq):
                        return await r.fulfill(path=arq, content_type="text/html; charset=utf-8" if arq.endswith(".html") else None)
                await r.continue_()

            await ctx.route("**/*", rota)
            pg = await ctx.new_page()
            await pg.goto(APP)
            await pg.wait_for_timeout(5000)
            areas = await pg.evaluate("[...document.querySelectorAll('.areas button[data-area]')].map(b=>b.dataset.area)")
            n = 0
            for area in areas:
                await pg.evaluate(f"document.querySelector('.areas button[data-area={area}]').click()")
                await pg.wait_for_timeout(1200)
                mods = await pg.evaluate("[...document.querySelectorAll('.tabs button[data-mod]')].filter(b=>b.offsetParent).map(b=>b.dataset.mod)")
                for mod in mods:
                    await pg.evaluate(f"document.querySelector('.tabs button[data-mod={mod}]').click()")
                    await pg.wait_for_timeout(3000)
                    alt = min(MAX_ALTURA, await pg.evaluate("document.documentElement.scrollHeight"))
                    n += 1
                    await pg.screenshot(path=os.path.join(SAIDA, f"{tema}-{n:02d}-{area}-{mod}.jpg"), type="jpeg", quality=70,
                                        clip={"x": 0, "y": 0, "width": LARGURA, "height": alt}, full_page=True)
                    print(tema, area, mod, flush=True)
            await ctx.close()
        await nav.close()


asyncio.run(main())
