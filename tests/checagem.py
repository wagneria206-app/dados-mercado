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
# passa o mouse em cada gráfico visível e confere se a caixa de valores aparece dentro dele
DICAS = """async()=>{const out=[];const cs=[...document.querySelectorAll('svg')].filter(s=>s.getBoundingClientRect().width>100&&s.parentElement&&s.parentElement.querySelector(':scope > .cvtip'));
for(const s of cs){s.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,50));const r=s.getBoundingClientRect();
 (s.lastElementChild||s).dispatchEvent(new MouseEvent('mousemove',{clientX:r.left+r.width*0.6,clientY:r.top+r.height*0.5,bubbles:true}));
 await new Promise(r=>setTimeout(r,50));const t=s.parentElement.querySelector(':scope > .cvtip'),q=t.getBoundingClientRect();
 if(t.hidden||q.height<10||q.bottom<r.top-5||q.top>r.bottom+5||q.left>r.right+5||q.right<r.left-5)out.push(s.parentElement.className)}
return out}"""
# gráficos desenhados na escala da tela: 1 unidade do desenho ≈ 1 pixel (senão o texto dos eixos fica gigante ou miúdo
# e o desenho pode sair cortado). Minigráficos que esticam de propósito (preserveAspectRatio=none) ficam de fora.
ESCALA = """()=>{const o=[];document.querySelectorAll('svg').forEach(s=>{const vb=s.viewBox&&s.viewBox.baseVal,r=s.getBoundingClientRect();
 if(!vb||!vb.width||r.width<200||s.getAttribute('preserveAspectRatio')==='none'||!s.getClientRects().length)return;const k=r.width/vb.width;
 if(k<0.72||k>1.4)o.push((s.id||s.getAttribute('aria-label')||s.parentElement.className||'svg')+' escala '+k.toFixed(2))});
 if(document.documentElement.scrollWidth>window.innerWidth+1)o.push('página mais larga que a tela ('+document.documentElement.scrollWidth+'px)');return o}"""
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


async def interface(pg):
    """Busca única, ajustes (blocos do Resumo, tema) e modo apresentação."""
    async def busca(txt):
        await pg.fill("#busca", "")
        await pg.type("#busca", txt, delay=30)
        for _ in range(60):
            await pg.wait_for_timeout(250)
            t = await pg.evaluate("document.getElementById('buscaRes').innerText")
            if "Carregando" not in t and t.strip():
                return t
        return t
    t = await busca("petr4")
    if "PETR4" not in t:
        problemas.append(f"busca: 'petr4' não achou a ação ({t[:120]!r})")
    else:
        await pg.keyboard.press("Enter")
        await pg.wait_for_timeout(1500)
        if "ativo=PETR4" not in await pg.evaluate("location.hash"):
            problemas.append("busca: Enter não abriu a página da PETR4")
    t = await busca("ptax")
    if "Dólar" not in t:
        problemas.append(f"busca: 'ptax' não sugeriu a tela Dólar ({t[:120]!r})")
    t = await busca("bb renda fixa")
    if "FUNDOS" not in t.upper():
        problemas.append(f"busca: 'bb renda fixa' não achou fundos ({t[:120]!r})")
    await pg.keyboard.press("Escape")
    # ajustes: esconder o Painel de índices do Resumo e voltar
    await pg.evaluate("document.querySelector('.areas button[data-area=mkt]').click()")
    await pg.evaluate("document.querySelector('.tabs button[data-mod=rs]').click()")
    await pg.wait_for_timeout(2500)
    await pg.click("#btAjustes")
    await pg.wait_for_timeout(300)
    if not await pg.evaluate("document.getElementById('ajustes').open"):
        problemas.append("ajustes: a janela não abriu")
    await pg.click("[data-ajbl=painel]")
    await pg.wait_for_timeout(500)
    if "Painel de índices" in await pg.evaluate("document.getElementById('mkOut').innerText"):
        problemas.append("ajustes: desmarcar o Painel de índices não o tirou do Resumo")
    await pg.click("[data-ajbl=painel]")
    await pg.click("[data-ajdn='0']")
    await pg.wait_for_timeout(500)
    ordem = await pg.evaluate("[...document.querySelectorAll('[data-ajbl]')].map(i=>i.dataset.ajbl).join(',')")
    if not ordem.startswith("resumo,painel"):
        problemas.append(f"ajustes: a seta não mudou a ordem dos blocos ({ordem})")
    await pg.evaluate("localStorage.removeItem('rsBlocos')")
    await pg.click("[data-ajfecha]")
    # tema escuro e de volta ao automático
    await pg.click("#btTema")
    if await pg.evaluate("document.documentElement.dataset.theme") not in ("dark", "light"):
        problemas.append("tema: o botão não trocou o tema")
    await pg.evaluate("localStorage.removeItem('tema')")
    # modo apresentação
    await pg.click("#btApres")
    await pg.wait_for_timeout(400)
    vis = await pg.evaluate("[document.documentElement.classList.contains('apres'),getComputedStyle(document.querySelector('.appbar')).display,getComputedStyle(document.getElementById('apresSai')).display]")
    if not (vis[0] and vis[1] == "none" and vis[2] != "none"):
        problemas.append(f"apresentação: não entrou direito ({vis})")
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(300)
    if await pg.evaluate("document.documentElement.classList.contains('apres')"):
        problemas.append("apresentação: Esc não saiu do modo")
    # de onde vem: ícone de fonte nos cartões do Resumo e o balão
    await pg.evaluate("document.querySelector('.areas button[data-area=mkt]').click()")
    await pg.evaluate("document.querySelector('.tabs button[data-mod=rs]').click()")
    await pg.wait_for_timeout(2500)
    n = await pg.evaluate("document.querySelectorAll('#mkOut .fonteic').length")
    if n < 10:
        problemas.append(f"fontes: só {n} cartões do Resumo com o ícone de fonte")
    else:
        await pg.evaluate("document.querySelector('#mkOut .fonteic').click()")
        await pg.wait_for_timeout(300)
        if "De onde vem".upper() not in (await pg.evaluate("(document.querySelector('.fontepop')||{}).innerText||''")).upper():
            problemas.append("fontes: o balão com a fonte não abriu")
    if "EUA:" not in await pg.evaluate("document.getElementById('mkOut').innerText"):
        problemas.append("agenda: sem as divulgações dos EUA no Resumo")
    # saúde das fontes: ícone no cabeçalho com a situação e a janela com o painel
    await pg.wait_for_timeout(1500)
    st = await pg.evaluate("(document.getElementById('btSaude')||{dataset:{}}).dataset.st||''")
    if st not in ("ok", "aviso", "ruim"):
        problemas.append(f"saúde: o ícone do cabeçalho não leu a situação das fontes ({st!r})")
    await pg.click("#btSaude")
    await pg.wait_for_timeout(800)
    if "Robô".upper() not in (await pg.evaluate("(document.getElementById('saudeDlg')||{}).innerText||''")).upper():
        problemas.append("saúde: a janela com o painel não abriu")
    else:
        await pg.click("[data-sdfecha]")
    if "Saúde das fontes" in await pg.evaluate("document.getElementById('mkOut').innerText"):
        problemas.append("saúde: o painel ainda aparece no Resumo")
    # ordenar tabela pelo título da coluna (dois cliques em colunas diferentes)
    r = await pg.evaluate("""(()=>{const tb=[...document.querySelectorAll('#mkOut table.ordenavel')].find(t=>t.tBodies[0].rows.length>=4&&t.offsetParent);if(!tb)return 'sem tabela';
      const C=tb.tHead.rows[0].cells,v=i=>[...tb.tBodies[0].rows].filter(r=>!r.classList.contains('cmpbm')).map(r=>(r.cells[i]||{}).textContent||''),n=s=>parseFloat(s.replace(/[^\d,\-−]/g,'').replace('−','-').replace(',','.'));
      const ok=i=>{const x=v(i).map(n).filter(isFinite);return x.every((a,k)=>!k||x[k-1]>=a)};
      const col=[...C].findIndex((c,i)=>i>0&&v(i).map(n).filter(isFinite).length>=3);if(col<0)return 'sem coluna numérica';
      C[col].click();const a=ok(col);const c2=[...C].findIndex((c,i)=>i>col&&v(i).map(n).filter(isFinite).length>=3);if(c2<0)return a?'ok':'falhou';C[c2].click();return a&&ok(c2)?'ok':'falhou'})()""")
    if r != "ok":
        problemas.append(f"ordenação: clicar no título da coluna não ordenou a tabela ({r})")
    # metodologia
    await pg.click("#btMetodo")
    await pg.wait_for_timeout(400)
    if not await pg.evaluate("!!document.getElementById('metodo')&&document.getElementById('metodo').open&&document.getElementById('metodo').innerText.length>2000"):
        problemas.append("metodologia: a página não abriu")
    else:
        await pg.click("[data-metfecha]")
    # indicadores de economia nos favoritos
    await pg.evaluate("document.querySelector('.tabs button[data-mod=fv]').click()")
    await pg.wait_for_timeout(5000)
    ops = await pg.evaluate("[...document.querySelectorAll('#fvMa option')].map(o=>o.textContent)")
    if len(ops) < 10 or not any("hoje" in o for o in ops):
        problemas.append(f"favoritos: lista de indicadores de economia incompleta ({ops[:3]})")
    # telas longas: índice e blocos recolhíveis em Juros
    await pg.evaluate("document.querySelector('.tabs button[data-mod=ju]').click()")
    await pg.wait_for_timeout(3000)
    n = await pg.evaluate("document.querySelectorAll('#mkOut .tlidx [data-rclir]').length")
    if n < 3:
        problemas.append(f"Juros: índice no topo com {n} blocos")
    else:
        await pg.evaluate("document.querySelector('[data-rcltodos=\"0\"]').click()")
        await pg.wait_for_timeout(300)
        fech = await pg.evaluate("document.querySelectorAll('#mkOut section.rcl.fechado').length")
        await pg.evaluate("document.querySelector('[data-rcltodos=\"1\"]').click()")
        if fech < n:
            problemas.append("Juros: 'Recolher tudo' não recolheu os blocos")
        await pg.evaluate("localStorage.removeItem('rcl_ju')")
    # botão Voltar do navegador volta para a aba anterior
    await pg.evaluate("document.querySelector('.tabs button[data-mod=in]').click()")
    await pg.wait_for_timeout(1500)
    await pg.go_back()
    await pg.wait_for_timeout(1500)
    if not await pg.evaluate("document.querySelector('.tabs button[data-mod=ju]').getAttribute('aria-selected')==='true'"):
        problemas.append("navegação: o botão Voltar não voltou para a aba anterior (Juros)")
    print("busca, ajustes, tema e apresentação conferidos", flush=True)


async def main():
    fundos = amostra_fundos()
    async with async_playwright() as p:
        nav = await p.chromium.launch()
        for largura in (1280, 390):
            ctx = await nav.new_context(viewport={"width": largura, "height": 900})
            pg = await ctx.new_page()
            tag = f"[{largura}px]"
            pg.on("pageerror", lambda e, t=tag: problemas.append(f"{t} erro de JavaScript: {e}"))
            # a política de segurança (CSP) não pode bloquear nada que o app usa
            pg.on("console", lambda m, t=tag: problemas.append(f"{t} bloqueado pela política de segurança: {m.text[:200]}")
                  if "Content Security Policy" in m.text else None)

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
                    for g in await pg.evaluate(ESCALA):
                        problemas.append(f"{tag} {area}/{mod}: {g}")
                    for g in await pg.evaluate(DICAS):
                        problemas.append(f"{tag} {area}/{mod}: gráfico ({g}) sem caixa de valores ao passar o mouse")
                    if len(texto) < 300:
                        problemas.append(f"{tag} {area}/{mod}: aba quase vazia")
                    print(tag, area, mod, len(texto), "caracteres", flush=True)

            if largura == 1280:
                await interface(pg)
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
            if os.environ.get("GITHUB_ACTIONS"):  # aparece como anotação na página da execução
                print("::error::" + x.replace("\n", " ")[:900])
        sys.exit(1)
    print("\nTudo certo: nenhuma aba com erro.")


asyncio.run(main())
