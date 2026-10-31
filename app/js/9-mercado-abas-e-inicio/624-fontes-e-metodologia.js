/* ---------- "de onde vem": ícone em cada cartão de indicador com a fonte oficial do número, e a página Metodologia e fontes */
/* fonte pelo rótulo do cartão (a primeira regra que bate vale) */
const FONTES=[
  [/focus/i,"Banco Central · Boletim Focus (mediana das projeções de cerca de 150 instituições), publicado às segundas-feiras."],
  [/copom|selic implícita|precificad/i,"B3 · preços de ajuste do DI futuro. O app calcula a Selic implícita em cada reunião do Copom (taxa constante entre reuniões)."],
  [/^selic meta|^selic\b/i,"Banco Central · meta da taxa Selic definida pelo Copom (SGS 432)."],
  [/^di (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)|^di1|juros futuros/i,"B3 · taxa de ajuste do DI futuro do dia."],
  [/prefixado|juro real|inflação implícita|ettj/i,"ANBIMA · curva de juros (ETTJ, modelo Nelson-Siegel-Svensson) dos títulos públicos prefixados e IPCA+. Inflação implícita = (1 + prefixado) ÷ (1 + juro real) − 1."],
  [/ima-|irf-m|ima |ima-geral/i,"ANBIMA · índices IMA (carteiras teóricas de títulos públicos), resultado diário."],
  [/spread|debênture|cri |cra /i,"ANBIMA · taxas indicativas do mercado secundário de debêntures, CRI e CRA."],
  [/ipca-15/i,"IBGE · IPCA-15 (SIDRA)."],
  [/ipca|inflação|núcleo|serviços|preços livres|monitorados|comercializáveis/i,"IBGE · IPCA (SIDRA); núcleos e grupos de preços pelo Banco Central (SGS)."],
  [/tesouro|título/i,"Tesouro Nacional · preços e taxas do Tesouro Direto (Tesouro Transparente e site do Tesouro Direto)."],
  [/^ações ·|^renda fixa ·|capital estrangeiro/i,"Banco Central · balanço de pagamentos (investimento estrangeiro em carteira)."],
  [/próximos 12 meses/i,"Banco Central (Boletim Focus) e ANBIMA (inflação implícita na curva de juros)."],
  [/ibovespa|ifix|ações|bolsa/i,"B3 · fechamento oficial do índice, publicado na manhã do dia seguinte."],
  [/ptax|dólar \(ptax\)|dólar comercial|boletins/i,"Banco Central · dólar PTAX (média das consultas aos bancos às 10h, 11h, 12h e 13h)."],
  [/dólar justo|paridade|modelo de fundamentos/i,"Cálculo do app com PTAX e IPCA (Banco Central e IBGE) e CPI (BLS, EUA)."],
  [/dólar no mundo|índice do fed/i,"Federal Reserve · índice amplo do dólar (Nominal Broad Dollar Index)."],
  [/s&p 500 em reais/i,"Cboe (S&P 500) × Banco Central (dólar PTAX do mesmo dia)."],
  [/s&p|vix|dow jones/i,"Cboe · S&P 500, VIX e Dow Jones (pelo índice DJX × 100)."],
  [/nasdaq/i,"Nasdaq · Nasdaq Composite e Nasdaq-100."],
  [/treasury|juro dos eua|sofr/i,"Departamento do Tesouro dos EUA · juros dos Treasuries (curva diária); SOFR pelo Fed de Nova York."],
  [/payroll|desemprego \(eua\)|salário por hora|inflação \(cpi\)|cpi/i,"BLS (Bureau of Labor Statistics) · emprego e inflação dos EUA."],
  [/petróleo|brent/i,"EIA (Energy Information Administration) · preço semanal do petróleo Brent."],
  [/cdi/i,"B3 / Banco Central · taxa DI (CDI) diária (SGS 12)."],
  [/pib|ibc-br/i,"IBGE (PIB, SIDRA) e Banco Central (IBC-Br, SGS)."],
  [/desemprego/i,"IBGE · PNAD Contínua (SIDRA)."],
  [/dívida|resultado primário|resultado nominal/i,"Banco Central · estatísticas fiscais (SGS)."],
  [/concessões|crédito|inadimpl/i,"Banco Central · estatísticas de crédito (SGS)."],
  [/prêmio implícito|cupom cambial|risco-país/i,"B3 (cupom cambial pelo dólar futuro e DI) e Fed de Nova York (SOFR); cálculo do app."]];
function fonteDe(rot,ctx){
  if(ctx&&ctx.closest("#fnBody,#fnRkT,#fnCbody"))return "CVM · informe diário, cadastro, lâmina e carteira dos fundos; CDI e IPCA do Banco Central e IBGE. Indicadores calculados pelo app.";
  if(ctx&&ctx.closest("#atBody"))return "B3 (cotações e proventos), CVM (balanços e informes dos FIIs) e, nos BDRs, SEC (balanços da empresa nos EUA). Indicadores calculados pelo app.";
  if(ctx&&ctx.closest(".fxvar"))return "Banco Central · dólar PTAX de venda; variação calculada pelo app.";
  if(activeMod==="mu"&&/desemprego|inflação|núcleo|pib|salário|payroll|cpi|empregos/i.test(rot))return /pib/i.test(rot)?"BEA (Bureau of Economic Analysis) · PIB dos EUA.":"BLS (Bureau of Labor Statistics) · emprego e inflação dos EUA.";
  if(ctx&&ctx.closest("#spRes"))return "Cálculo do app com as cotas e cotações oficiais (CVM e B3), CDI (Banco Central) e IPCA (IBGE).";
  for(const [re,t] of FONTES)if(re.test(rot))return t;return null}
const FT_SEL=".rsgrid>div,.pnlc,.fnkp,.tot>div,.fxvar>div";
function fontesMarca(root){(root||document).querySelectorAll(FT_SEL).forEach(c=>{if(c.querySelector(":scope>.fonteic"))return;const sp=c.querySelector(":scope>span");if(!sp)return;
  const f=fonteDe(sp.textContent.trim(),c);if(!f)return;const b=document.createElement("button");b.type="button";b.className="fonteic";b.setAttribute("aria-label","De onde vem este número");b.dataset.fonte=f;b.textContent="i";c.appendChild(b)})}
let FT_RAF=0;
const FT_OBS=new MutationObserver(()=>{cancelAnimationFrame(FT_RAF);FT_RAF=requestAnimationFrame(()=>{["mkOut","fnOut"].forEach(id=>{const el=$(id);if(el)fontesMarca(el)})})});
["mkOut","fnOut"].forEach(id=>{const el=$(id);if(el)FT_OBS.observe(el,{childList:true,subtree:true})});
function fontePop(b){let p=document.querySelector(".fontepop");if(!p){p=document.createElement("div");p.className="fontepop";p.setAttribute("role","dialog");document.body.appendChild(p)}
  p.innerHTML='<b>De onde vem</b><p>'+esc(b.dataset.fonte)+'</p><button type="button" class="link" data-metodo="1">Metodologia e fontes</button>';p.hidden=false;
  const r=b.getBoundingClientRect(),w=Math.min(320,window.innerWidth-24);p.style.width=w+"px";p.style.left=Math.max(12,Math.min(window.innerWidth-w-12,r.right-w))+"px";p.style.top=(window.scrollY+r.bottom+6)+"px"}
document.addEventListener("click",e=>{const g=s=>e.target.closest&&e.target.closest(s);let x;
  if((x=g(".fonteic"))){e.stopPropagation();fontePop(x);return}
  const p=document.querySelector(".fontepop");if(p&&!g(".fontepop"))p.hidden=true;
  if(g("[data-metodo]")||g("#btMetodo")){if(p)p.hidden=true;try{ajFecha()}catch(x){}metAbre();return}
},true);

/* ---------- página Metodologia e fontes */
function metHtml(){
  const sec=(t,h)=>'<section><h3>'+t+'</h3>'+h+'</section>',li=a=>'<ul class="metl">'+a.map(x=>'<li>'+x+'</li>').join("")+'</ul>';
  let h='<div class="ajhd"><h2>Metodologia e fontes</h2><button type="button" class="hbtn" data-metfecha="1" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  h+=sec("Princípios",li(["Só dados oficiais e públicos: Banco Central, IBGE, B3, CVM, ANBIMA, Tesouro Nacional e, nos EUA, Fed, Tesouro americano, BLS, BEA, EIA, SEC, Cboe e Nasdaq.",
    "Robôs no GitHub coletam os dados em horários fixos e publicam arquivos que o app lê. Nada é digitado à mão.",
    "Toque no <b>i</b> de um cartão para ver de onde vem aquele número. Quando uma fonte falha, a tela avisa e mostra os últimos dados válidos.",
    "Projeções, impostos e valores de venda são estimativas para apoiar a análise. Não são recomendação de investimento."]));
  h+=sec("Fontes e horários",'<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Dado</th><th style="text-align:left">Fonte oficial</th><th style="text-align:left">Atualização</th></tr></thead><tbody>'+[
    ["Tesouro Direto (preços e taxas)","Tesouro Nacional","durante o dia e no fechamento"],["Curva de juros, IMA, debêntures, CRI e CRA","ANBIMA","dias úteis, à noite"],
    ["DI futuro, dólar futuro, Ibovespa, IFIX, ações, FIIs, ETFs e BDRs","B3","fechamento; índices na manhã seguinte"],["Selic, CDI, PTAX, Focus, crédito, fiscal, balanço de pagamentos","Banco Central (SGS, PTAX, Expectativas)","diária ou na divulgação"],
    ["IPCA, IPCA-15, PIB, PNAD, indústria, comércio e serviços","IBGE (SIDRA)","na divulgação"],["Fundos (cotas, patrimônio, cotistas, carteira)","CVM (dados abertos)","diária"],
    ["Balanços das empresas americanas (BDRs)","SEC (EDGAR)","diária"],["S&amp;P 500, VIX, Dow Jones; Nasdaq","Cboe; Nasdaq","fechamento"],
    ["Juros dos EUA; Fed; emprego e CPI; PIB e PCE; petróleo","Tesouro dos EUA; Federal Reserve; BLS; BEA; EIA","na divulgação"]].map(r=>'<tr><td style="text-align:left">'+r[0]+'</td><td style="text-align:left">'+r[1]+'</td><td style="text-align:left">'+r[2]+'</td></tr>').join("")+'</tbody></table></div>');
  h+=sec("Títulos públicos e crédito privado",li(["Preço dos títulos pela metodologia da ANBIMA e do Tesouro: VNA da NTN-B e da LFT atualizado pelo IPCA e pela Selic, dias úteis ÷ 252, com os truncamentos e arredondamentos oficiais. A checagem automática confere todo dia o preço calculado com os preços publicados pelo Tesouro e pela ANBIMA.",
    "Marcação a mercado: valor presente do fluxo restante na taxa de mercado; curva = na taxa contratada. Ágio ou deságio = diferença entre os dois.",
    "IR pela tabela regressiva (22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima), IOF regressivo nos primeiros 30 dias e custódia da B3 de 0,20% ao ano no Tesouro Direto.",
    "Debêntures, CRI e CRA: características e agenda de pagamentos do SND e da B3; taxa de mercado pela taxa indicativa da ANBIMA."]));
  h+=sec("Juros, inflação e câmbio",li(["Curva de juros: ETTJ da ANBIMA (Nelson-Siegel-Svensson). Juros de prazo constante (5 e 10 anos) lidos da curva.",
    "Selic implícita em cada Copom: taxa constante entre reuniões que torna os DIs futuros coerentes com o preço de ajuste (Selic ≈ CDI + 0,10).",
    "Inflação implícita: (1 + prefixado) ÷ (1 + juro real) − 1, no mesmo prazo. Inclui o prêmio pelo risco de inflação.",
    "Dólar justo: paridade do poder de compra (câmbio real médio de períodos longos) e um modelo de fundamentos. São referências, não previsão."]));
  h+=sec("Fundos e Bolsa",li(["Rentabilidade dos fundos pela variação da cota informada à CVM. Volatilidade anualizada = desvio-padrão dos retornos diários × √252. Sharpe sobre o CDI. Perda máxima = maior queda desde um pico.",
    "Ações, FIIs e ETFs: retorno com proventos reinvestidos na data com; dividend yield dos últimos 12 meses sobre o preço atual. P/L e P/VP com os balanços da CVM ou, nos BDRs, da SEC (últimos 12 meses).",
    "Comparações sempre no mesmo período para todos os itens."]));
  h+=sec("Carteiras",li(["Rentabilidade da carteira por cotas (TWR): neutraliza o efeito do momento das aplicações e resgates. É a que se compara com o CDI.",
    "Rentabilidade do cliente: TIR dos valores aplicados e resgatados nas datas informadas.",
    "IR estimado aplicação por aplicação, como se tudo fosse resgatado na data; resgates saem das aplicações mais antigas.",
    "Teste de estresse: sensibilidade de cada item a juros, Bolsa, dólar e S&amp;P 500 aplicada a choques históricos (2008, 2015, 2020…). Fronteira eficiente pelos retornos mensais históricos.",
    "Relatório mensal do cliente: patrimônio, ganho, rentabilidade no mês, no ano e desde o início, comparada ao CDI; composição e movimentações do mês."]));
  h+=sec("Economia e exterior",li(["Focus: mediana das projeções, semana a semana.","Como o exterior afeta o Brasil: correlações e sensibilidades com retornos semanais dos últimos 2 anos.",
    "Calendário dos EUA: datas oficiais do BLS e do BEA; decisões do Fed pelo calendário do FOMC; Copom pelo calendário do Banco Central."]));
  h+=sec("Conferências automáticas",li(["A cada 3 horas o robô de saúde confere se cada fonte foi atualizada e compara fontes diferentes que precisam contar a mesma história: Ibovespa × BOVA11, PTAX × dólar futuro, S&amp;P 500 × dólar × IVVB11, CDI × Selic e a data do Focus.",
    "Se uma fonte falha 2 dias seguidos, abre um aviso no GitHub, que fecha sozinho quando ela volta. PTAX e IPCA têm fonte reserva no próprio Banco Central.",
    "Antes de qualquer mudança no app entrar no ar, testes conferem os cálculos com casos de resposta conhecida e percorrem todas as telas."]));
  return h}
function metAbre(){let d=$("metodo");if(!d){d=document.createElement("dialog");d.id="metodo";d.className="ajdlg metdlg";d.setAttribute("aria-label","Metodologia e fontes");document.body.appendChild(d)}
  d.innerHTML=metHtml();try{d.showModal()}catch(e){d.setAttribute("open","")}d.scrollTop=0}
document.addEventListener("click",e=>{const g=s=>e.target.closest&&e.target.closest(s);const d=$("metodo");if(!d)return;
  if(g("[data-metfecha]")||e.target===d){try{d.close()}catch(x){d.removeAttribute("open")}}});
if(/#metodologia/.test(location.hash))setTimeout(metAbre,600);
