/* ---------- tour de boas-vindas: aparece na primeira abertura em cada aparelho (e pode ser revisto em Ajustes)
   Destaca cada parte do app com um balão curto. Não aparece em navegadores automatizados (testes). */
const TOUR=[
  [null,"Bem-vindo ao Mercado e Investimentos","Mercado, economia, fundos, Bolsa e carteiras num só lugar, sempre com dados de fontes oficiais. São 6 passos rápidos."],
  [".areas","Áreas do app","Mercado (juros, inflação, dólar, economia, EUA), Fundos, Bolsa, Carteiras e Simulações e a calculadora de títulos. Em cada área, as abas logo abaixo levam aos assuntos."],
  [".busca","Busca","Ache qualquer fundo, ação, FII, ETF, BDR, título do Tesouro ou tela do app. No computador, a tecla / leva direto para cá."],
  ["#mkOut .rsgrid>div,#mkOut .pnlc","De onde vem cada número","Toque no pequeno i de um cartão para ver a fonte oficial. Se uma fonte atrasar, um aviso amarelo aparece no topo da tela."],
  [".tabs button[data-mod=fv]","Favoritos e alertas","Acompanhe fundos, ativos, títulos e indicadores de economia (Focus, IPCA, dólar…) e crie alertas. Com a sincronização, os avisos chegam até com o app fechado."],
  ["#btAjustes","Ajustes e apresentação","Tema claro ou escuro, tela inicial, blocos do Resumo, sincronização e segurança (proteja o token com senha). Ao lado: a saúde das fontes (uma bolinha vermelha aparece quando algo falha), Metodologia e fontes e o modo apresentação para reuniões."]];
const TR={i:0,on:false};
function tourAbre(){if(TR.on)return;TR.on=true;TR.i=0;if(activeMod!=="rs"){try{setMod("rs")}catch(e){}}setTimeout(tourPasso,350)}
function tourFecha(){TR.on=false;document.querySelectorAll(".tourhl,.tourbx").forEach(e=>e.remove());lsSet("tourVisto","1")}
function tourPasso(){
  document.querySelectorAll(".tourhl,.tourbx").forEach(e=>e.remove());if(!TR.on)return;
  const [sel,tit,txt]=TOUR[TR.i],alvo=sel?document.querySelector(sel):null,ult=TR.i===TOUR.length-1;
  const bx=document.createElement("div");bx.className="tourbx";bx.setAttribute("role","dialog");bx.setAttribute("aria-label",tit);
  bx.innerHTML='<span class="tourn">'+(TR.i+1)+' de '+TOUR.length+'</span><b>'+tit+'</b><p>'+txt+'</p><div class="tourbt"><button type="button" class="link" data-tour="pular">'+(ult?'':'Pular')+'</button><span>'+(TR.i?'<button type="button" class="btn sec" data-tour="volta">Voltar</button>':'')+'<button type="button" class="btn" data-tour="segue">'+(ult?'Começar':'Próximo')+'</button></span></div>';
  if(alvo){alvo.scrollIntoView({block:"center",behavior:"instant"});const r=alvo.getBoundingClientRect(),hl=document.createElement("div");hl.className="tourhl";
    const sx=window.scrollX,sy=window.scrollY;Object.assign(hl.style,{left:(sx+r.left-6)+"px",top:(sy+r.top-6)+"px",width:(r.width+12)+"px",height:(r.height+12)+"px"});document.body.appendChild(hl);
    document.body.appendChild(bx);const w=bx.offsetWidth,h=bx.offsetHeight,abaixo=r.bottom+14+h<window.innerHeight;
    bx.style.left=(sx+Math.max(12,Math.min(window.innerWidth-w-12,r.left+r.width/2-w/2)))+"px";bx.style.top=(sy+(abaixo?r.bottom+14:Math.max(12,r.top-h-14)))+"px"}
  else{const hl=document.createElement("div");hl.className="tourhl tourcheio";document.body.appendChild(hl);document.body.appendChild(bx);bx.classList.add("tourmeio")}
  const b=bx.querySelector('[data-tour="segue"]');if(b)b.focus()}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-tour]");if(x){const a=x.dataset.tour;
    if(a==="pular")tourFecha();else if(a==="volta"){TR.i=Math.max(0,TR.i-1);tourPasso()}else if(a==="segue"){if(TR.i>=TOUR.length-1)tourFecha();else{TR.i++;tourPasso()}}return}
  if(e.target.closest&&e.target.closest("[data-tourabre]")){try{ajFecha()}catch(x){}tourAbre()}});
document.addEventListener("keydown",e=>{if(!TR.on)return;if(e.key==="Escape")tourFecha();else if(e.key==="ArrowRight"){const b=document.querySelector('[data-tour="segue"]');if(b)b.click()}else if(e.key==="ArrowLeft"&&TR.i){TR.i--;tourPasso()}});
window.addEventListener("resize",()=>{if(TR.on)tourPasso()});
if(!navigator.webdriver&&lsGet("tourVisto","")!=="1"&&!/#(fundo|ativo)=/.test(location.hash))setTimeout(tourAbre,2500);
