/* ---------- busca única, ajustes (tema, tela inicial, blocos do Resumo) e modo apresentação */
/* Tudo o que se escolhe aqui fica só neste aparelho (localStorage) e não tem nenhum dado pessoal. */
function lsGet(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}}
function lsSet(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}}

/* tema: automático (segue o aparelho), claro ou escuro */
function temaAplica(){const t=lsGet("tema","auto"),r=document.documentElement;if(t==="claro")r.dataset.theme="light";else if(t==="escuro")r.dataset.theme="dark";else delete r.dataset.theme;
  const b=$("btTema");if(b){const esc=temaEscuro();b.setAttribute("aria-label",esc?"Usar tema claro":"Usar tema escuro");b.title=esc?"Tema claro":"Tema escuro";b.classList.toggle("on",esc)}}
function temaEscuro(){const t=lsGet("tema","auto");return t==="escuro"||(t==="auto"&&!!(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches))}
temaAplica();
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",temaAplica)}catch(e){}

/* blocos da tela Mercado › Resumo: o usuário escolhe quais aparecem e em que ordem */
function rsBlocosDef(){return {painel:["Painel de índices (Bolsas, dólar e juros)",painelHtml],resumo:["Resumo do mercado (juros, Copom e inflação)",rsHtml],fluxo:["Capital estrangeiro e risco-país",fluxoHtml],agenda:["Agenda das próximas semanas",agendaHtml],bases:["Situação das fontes de dados",basesHtml]}}
function rsBlocos(){const D=rsBlocosDef(),ids=Object.keys(D);let L=[];try{L=JSON.parse(lsGet("rsBlocos","[]"))}catch(e){}
  L=L.filter(x=>Array.isArray(x)&&D[x[0]]);ids.forEach(id=>{if(!L.some(x=>x[0]===id))L.push([id,true])});return L}
function rsResumoHtml(P){const D=rsBlocosDef(),L=rsBlocos().filter(x=>x[1]);
  if(!L.length)return '<section class="panel"><p class="sub">Todos os blocos do Resumo estão ocultos. Escolha o que mostrar em <button type="button" class="link" data-ajustes="1">Ajustes</button>.</p></section>';
  return L.map(x=>P(D[x[0]][1]())).join("")}

/* tela que abre quando o app inicia */
function inicioMod(){const v=lsGet("inicio","ultima");return v&&v!=="ultima"&&AREA_OF[v]?v:null}

/* ---------- busca única */
const BZ_PAL={rs:"resumo painel ibovespa ifix s&p 500 dow jones nasdaq vix indices bolsa hoje",ec:"economia focus expectativas pib atividade desemprego fiscal divida credito selic copom",mu:"eua mundo fed fomc treasury payroll inflacao americana petroleo brent dolar global dxy exterior",
  fv:"favoritos alertas",ju:"juros di futuro copom selic curva ettj prefixado juro real ntn-b treasury",tx:"tesouro direto taxas historico titulos publicos",cr:"credito privado debentures cri cra spread",in:"inflacao ipca ipca-15 igp-m implicita",
  ix:"indices ima ima-b irf-m ima-s anbima renda fixa",fx:"dolar ptax cambio cupom cambial moeda",fa:"fundo analise cnpj",fr:"ranking fundos melhores",fc:"comparar fundos",fg:"gestoras administradoras",aa:"acao acoes fii etf bdr ativo analise",
  ar:"ranking acoes fiis dividendos",ac:"comparar acoes ativos",au:"bolsa americana eua sec balancos",ag:"agenda proventos dividendos jcp rendimentos",sc:"cenarios juros estresse simulacao",sim:"equivalencia lci lca cdb escada vencimentos",
  sp:"carteira simulador fronteira eficiente alocacao",pub:"calcular tesouro titulo marcacao a mercado agio desagio",pc:"calcular credito privado debenture cri cra",bank:"cdb lci lca rdb bancarios",fund:"fundos previdencia pgbl vgbl come-cotas"};
const BZ={q:"",it:[],sel:0};
function bzTelas(){return [...document.querySelectorAll(".tabs button[data-mod]")].map(b=>({m:b.dataset.mod,t:b.textContent.trim(),a:AREA_T[AREA_OF[b.dataset.mod]]||""}))}
function bzBusca(){
  const inp=$("busca"),box=$("buscaRes");if(!inp||!box)return;const q=inp.value.trim();BZ.q=q;
  if(q.length<2){box.hidden=true;BZ.it=[];return}
  const w=fnNorm(q).split(/\s+/).filter(Boolean),it=[];let h="";
  const grupo=(t,rows)=>{if(!rows.length)return;h+='<div class="bzh">'+t+'</div>';rows.forEach(r=>{h+='<button type="button" class="bzi" role="option" data-bzi="'+it.length+'"><b>'+r.t+'</b><small>'+r.s+'</small></button>';it.push(r.go)})};
  grupo("Telas",bzTelas().filter(x=>w.every(p=>fnNorm(x.t+" "+x.a+" "+(BZ_PAL[x.m]||"")).includes(p))).slice(0,5).map(x=>({t:esc(x.t),s:esc(x.a),go:()=>{setMod(x.m);try{window.scrollTo({top:0,behavior:"smooth"})}catch(e){}}})));
  if(AT.idx)grupo("Bolsa e Tesouro Direto",atSearch(q,6).map(j=>{const r=AT.idx.rows[j],C=AT.C;return {t:esc(r[0])+' · '+esc(r[1]),s:esc(r[C.tipo]||"")+(r[C.preco]!=null?' · R$ '+fx(r[C.preco],2):''),go:()=>atOpen(r[0])}}));
  if(FN.idx)grupo("Fundos",fnSearch(q,6).map(j=>{const r=FN.idx.rows[j],C=FN.C;return {t:esc(r[1]),s:fnCnpjF(r[0])+' · '+esc(FN.idx.classes[r[C.classe]]||"")+' · PL '+fnMoney(r[C.pl]),go:()=>fnOpen(r[0])}}));
  const falta=[!AT.idx&&!AT.err?"ativos":"",!FN.idx&&!FN.err?"fundos":""].filter(Boolean);
  if(falta.length)h+='<div class="bzh bzw">Carregando a base de '+falta.join(" e ")+'…</div>';
  if(!it.length&&!falta.length)h='<div class="bzh bzw">Nada encontrado para “'+esc(q)+'”.</div>';
  BZ.it=it;BZ.sel=0;box.innerHTML=h;box.hidden=false;bzMarca();
}
function bzMarca(){document.querySelectorAll("#buscaRes .bzi").forEach((b,i)=>{const on=i===BZ.sel;b.classList.toggle("on",on);b.setAttribute("aria-selected",on?"true":"false");if(on)b.scrollIntoView({block:"nearest"})})}
function bzVai(i){const f=BZ.it[i];if(!f)return;const inp=$("busca");inp.value="";$("buscaRes").hidden=true;inp.blur();f()}
function bzCarrega(){const ps=[];try{if(!AT.idx&&!AT.load&&!AT.err)ps.push(atBoot())}catch(e){}try{if(!FN.idx&&!FN.load&&!FN.err)ps.push(fnBoot())}catch(e){}
  [AT.load,FN.load].forEach(p=>{if(p&&p.then)p.then(()=>{if(BZ.q)bzBusca()},()=>{if(BZ.q)bzBusca()})})}

/* ---------- modo apresentação: tela limpa para reuniões (sem notas de rodapé, botões de edição e cabeçalho) */
function apresLiga(on){const r=document.documentElement;r.classList.toggle("apres",on);
  const b=$("btApres");if(b)b.setAttribute("aria-pressed",on?"true":"false");
  try{if(on){const el=r;(el.requestFullscreen||el.webkitRequestFullscreen||(()=>{})).call(el)}else if(document.fullscreenElement||document.webkitFullscreenElement)(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}
  setTimeout(()=>{try{setMod(activeMod)}catch(e){}},60)}
["fullscreenchange","webkitfullscreenchange"].forEach(ev=>document.addEventListener(ev,()=>{if(!(document.fullscreenElement||document.webkitFullscreenElement)&&document.documentElement.classList.contains("apres")&&apresFs)apresLiga(false);apresFs=!!(document.fullscreenElement||document.webkitFullscreenElement)}));
let apresFs=false;

/* ---------- janela de ajustes */
function ajHtml(){
  const t=lsGet("tema","auto"),ini=lsGet("inicio","ultima"),L=rsBlocos(),D=rsBlocosDef(),telas=bzTelas();
  const radio=(v,l)=>'<label class="ajop"><input type="radio" name="ajTema" value="'+v+'"'+(t===v?' checked':'')+'><span>'+l+'</span></label>';
  let h='<div class="ajhd"><h2>Ajustes</h2><button type="button" class="hbtn" data-ajfecha="1" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  h+='<section><h3>Aparência</h3><div class="ajseg">'+radio("auto","Automático")+radio("claro","Claro")+radio("escuro","Escuro")+'</div><p class="sub">Automático segue o tema do aparelho.</p></section>';
  h+='<section><h3>Tela inicial</h3><label class="label" for="ajIni">Ao abrir o app, mostrar</label><select id="ajIni"><option value="ultima"'+(ini==="ultima"?' selected':'')+'>A última tela usada</option>'
    +Object.values(AREA_T).filter((a,i,s)=>s.indexOf(a)===i&&a!=="Carteira").map(a=>'<optgroup label="'+esc(a)+'">'+telas.filter(x=>x.a===a).map(x=>'<option value="'+x.m+'"'+(ini===x.m?' selected':'')+'>'+esc(x.t)+'</option>').join("")+'</optgroup>').join("")+'</select></section>';
  h+='<section><h3>Blocos de Mercado › Resumo</h3><p class="sub">Marque o que aparece e use as setas para mudar a ordem.</p><ol class="ajbl">'+L.map((x,i)=>'<li><label><input type="checkbox" data-ajbl="'+x[0]+'"'+(x[1]?' checked':'')+'><span>'+esc(D[x[0]][0])+'</span></label><span class="ajmv"><button type="button" class="hbtn" data-ajup="'+i+'" aria-label="Subir"'+(i?'':' disabled')+'><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button><button type="button" class="hbtn" data-ajdn="'+i+'" aria-label="Descer"'+(i<L.length-1?'':' disabled')+'><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></span></li>').join("")+'</ol></section>';
  h+='<section><h3>Sincronizar favoritos entre aparelhos</h3><div class="fvbox">'+syncHtml()+'</div></section>';
  h+='<section><h3>Modo apresentação</h3><p class="sub">Para reuniões: esconde notas de rodapé, botões de edição e o cabeçalho, e aumenta um pouco as letras. Saia pelo botão no canto da tela ou com a tecla Esc.</p><button type="button" class="btn" data-ajapres="1">Começar apresentação</button></section>';
  return h}
function ajAbre(){const d=$("ajustes");if(!d)return;d.innerHTML=ajHtml();try{d.showModal()}catch(e){d.setAttribute("open","")}}
function ajFecha(){const d=$("ajustes");if(!d)return;try{d.close()}catch(e){d.removeAttribute("open")}}
function ajRefaz(){const d=$("ajustes");if(d&&d.open){const y=d.scrollTop;d.innerHTML=ajHtml();d.scrollTop=y}if(activeMod==="rs")mkCalc()}

document.addEventListener("click",e=>{const g=s=>e.target.closest&&e.target.closest(s);let x;
  if(g("#btTema")){lsSet("tema",temaEscuro()?"claro":"escuro");temaAplica();return}
  if(g("#btAjustes")||g("[data-ajustes]")){ajAbre();return}
  if(g("#btApres")||g("[data-ajapres]")){ajFecha();apresLiga(!document.documentElement.classList.contains("apres"));return}
  if(g("#apresSai")){apresLiga(false);return}
  if(g("[data-ajfecha]")){ajFecha();return}
  if(e.target.id==="ajustes"){ajFecha();return} // toque fora da janela
  if((x=g("[data-ajup]"))||(x=g("[data-ajdn]"))){const L=rsBlocos(),i=+(x.dataset.ajup!=null?x.dataset.ajup:x.dataset.ajdn),j=x.dataset.ajup!=null?i-1:i+1;if(j<0||j>=L.length)return;[L[i],L[j]]=[L[j],L[i]];lsSet("rsBlocos",JSON.stringify(L));ajRefaz();return}
  if((x=g("[data-bzi]"))){bzVai(+x.dataset.bzi);return}
  if(!g(".busca")){const b=$("buscaRes");if(b)b.hidden=true}
});
document.addEventListener("change",e=>{const t=e.target;
  if(t.name==="ajTema"){lsSet("tema",t.value);temaAplica();return}
  if(t.id==="ajIni"){lsSet("inicio",t.value==="ultima"?null:t.value);return}
  if(t.dataset&&t.dataset.ajbl){const L=rsBlocos(),x=L.find(y=>y[0]===t.dataset.ajbl);if(x)x[1]=t.checked;lsSet("rsBlocos",JSON.stringify(L));ajRefaz()}
});
document.addEventListener("input",e=>{if(e.target.id==="busca"){bzCarrega();bzBusca()}});
document.addEventListener("focusin",e=>{if(e.target.id==="busca"){bzCarrega();if(e.target.value.trim().length>1)bzBusca()}});
document.addEventListener("keydown",e=>{
  if(e.target&&e.target.id==="busca"){const n=BZ.it.length;
    if(e.key==="ArrowDown"&&n){e.preventDefault();BZ.sel=(BZ.sel+1)%n;bzMarca()}
    else if(e.key==="ArrowUp"&&n){e.preventDefault();BZ.sel=(BZ.sel-1+n)%n;bzMarca()}
    else if(e.key==="Enter"){e.preventDefault();bzVai(BZ.sel)}
    else if(e.key==="Escape"){e.target.value="";$("buscaRes").hidden=true;e.target.blur()}
    return}
  if(e.key==="Escape"&&document.documentElement.classList.contains("apres")){apresLiga(false);return}
  const tag=(e.target&&e.target.tagName)||"";if(e.key==="/"&&!/INPUT|TEXTAREA|SELECT/.test(tag)&&!e.target.isContentEditable){const b=$("busca");if(b){e.preventDefault();b.focus()}}
});

/* ao mudar a largura da janela (girar o tablet, abrir a barra lateral), redesenha a tela para os gráficos ficarem na escala certa */
let RZ_W=window.innerWidth,RZ_T=null;
window.addEventListener("resize",()=>{clearTimeout(RZ_T);RZ_T=setTimeout(()=>{const w=window.innerWidth;if(Math.abs(w-RZ_W)<40)return;RZ_W=w;if(activeMod==="tx")return;try{setMod(activeMod)}catch(e){}},250)});
