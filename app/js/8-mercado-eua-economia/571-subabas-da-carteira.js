/* ---------- Carteira em subabas: Visão geral, Desempenho, Risco, Crédito e caixa, Rebalancear, Oportunidades, Todas as carteiras
   Só a subaba aberta é montada (os blocos pesados, como raio-X e antes × depois, só carregam quando a subaba é aberta);
   trocar de subaba usa o cálculo já feito, sem refazer a simulação. O relatório em PDF continua com tudo. */
const SP_ABAS=[["geral","Visão geral"],["desemp","Desempenho"],["risco","Risco"],["credito","Crédito e caixa"],["rebal","Rebalancear"],["oport","Oportunidades"],["todas","Todas as carteiras"]];
try{SP.sub=localStorage.getItem("spSub")||"geral";if(!SP_ABAS.some(a=>a[0]===SP.sub))SP.sub="geral"}catch(e){SP.sub="geral"}
let SP_LAST=null,SP_TODAS=false;
/* subaba de cada bloco pelo título */
function spAbaDe(t){t=String(t||"");
  if(/^(Painel da carteira|Adequação|Posição atual|Desde a efetivação)/.test(t))return "geral";
  if(/^(Política|Boleta|Antes e depois|Proposta|Otimização)/.test(t))return "rebal";
  if(/^Crédito/.test(t))return "credito";
  if(/^(Raio-X|Risco de mercado|Contribuição de cada item|Perda a partir|Exposições|Projeção)/.test(t))return "risco";
  if(/^Substitutos/.test(t))return "oport";
  if(/^(Painel do assessor|Comparação entre as carteiras|Comparar carteiras)/.test(t))return "todas";
  return "desemp"}
const spT=(g,f)=>SP_TODAS||SP.sub===g?f():"";
function spAbasHtml(){return '<nav class="spabas" role="tablist" aria-label="Partes da carteira">'+SP_ABAS.map(([k,l])=>'<button type="button" role="tab" data-spaba="'+k+'" aria-selected="'+(SP.sub===k)+'">'+l+'</button>').join("")+'</nav>'}
/* esconde os blocos de outras subabas (os que sempre são montados, como o histórico) */
function spSubAplica(box){const a=$("spAbas");if(a)a.innerHTML=spAbasHtml();if(!box)return;
  const bm=box.querySelector(':scope>section[data-reltit^="Benchmark"]'),rs=$("spPanel");if(bm&&rs&&rs.parentElement===box)rs.after(bm);   // benchmark logo depois do resumo do histórico
  let vis=0;[...box.children].forEach(s=>{if(!s.matches||!s.matches("section.panel"))return;const t=s.dataset.reltit||((s.querySelector("h3")||{}).textContent||"").trim();const ok=SP_TODAS||spAbaDe(t)===SP.sub;s.hidden=!ok;if(ok)vis++});
  if(!vis&&!SP_TODAS)box.insertAdjacentHTML("beforeend",'<section class="panel spvazio"><p class="sub">Nada para mostrar nesta parte com os itens atuais desta carteira.</p></section>')}
function spSubRender(){const box=$("spRes");if(!box)return;
  if(!SP_LAST||SP_LAST.c!==spC()){spCalc();return}
  const {c,it,R}=SP_LAST;try{box.innerHTML=(it.length&&R?fnUse(FN,()=>spResHtml(c,it,R)):'<section class="panel"><p class="sub">Adicione fundos, ativos ou renda fixa e defina os pesos.</p></section>')+spT("todas",()=>spAssHtml()+spCmpCartsHtml());if(SP_ASS&&SP.sub==="todas")spAssRender();spSubAplica(box)}catch(e){console.error(e);spCalc()}}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-spaba]");if(!b||activeMod!=="sp")return;SP.sub=b.dataset.spaba;try{localStorage.setItem("spSub",SP.sub)}catch(x){}
  spSubRender();const a=$("spAbas");if(a){const y=a.getBoundingClientRect().top+window.scrollY-(document.querySelector(".areas")||{offsetHeight:0}).offsetHeight-6;if(window.scrollY>y)window.scrollTo({top:y})}});
/* relatório em PDF: todos os blocos, de todas as subabas */
function spResTudo(){if(!SP_LAST||!SP_LAST.R)return null;SP_TODAS=true;try{return fnUse(FN,()=>spResHtml(SP_LAST.c,SP_LAST.it,SP_LAST.R))}finally{SP_TODAS=false}}
document.addEventListener("toggle",e=>{const d=e.target;if(!d||!d.dataset||!d.dataset.spcompo)return;SP.compAb=d.open;try{localStorage.setItem("spCompo",d.open?"1":"0")}catch(x){}},true);
