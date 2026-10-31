/* ===== Favoritos, alertas e documentos (fatos relevantes, comunicados, relatórios) =====
   Favoritos e alertas ficam só neste navegador (localStorage); nada vai para o repositório. */
const FV={l:[],a:[],edit:null,boot:{}};
try{const l=JSON.parse(localStorage.getItem("favs")||"[]");if(Array.isArray(l))FV.l=l.filter(x=>x&&typeof x.k==="string").slice(0,60)}catch(e){}
try{const a=JSON.parse(localStorage.getItem("alertas")||"[]");if(Array.isArray(a))FV.a=a.filter(x=>x&&x.k&&x.c)}catch(e){}
function fvSave(){try{localStorage.setItem("favs",JSON.stringify(FV.l));localStorage.setItem("alertas",JSON.stringify(FV.a))}catch(e){}if(typeof syncMark==="function")syncMark()}
const fvHas=k=>FV.l.some(x=>x.k===k);
const fvCurto=s=>{s=String(s||"").replace(/\s+/g," ").trim();return s.length>56?s.slice(0,54).replace(/\s\S*$/,"")+"…":s};
const FV_TD={NTNB:"IPCAJ",NTNBP:"IPCA",RENDA:"RENDA",EDUCA:"EDUCA",LTN:"PRE",NTNF:"PREJ",LFT:"SELIC"};
const FV_C={pa:["a","Preço chegar a","≥","R$"],pb:["a","Preço cair a","≤","R$"],dv:["a","Variação no dia passar de","±","%"],
  ma:["f","Rentabilidade no mês cair abaixo de","≤","%"],r12:["f","Rentabilidade em 12 meses cair abaixo de","≤","%"],
  ta:["t","Taxa subir a","≥","%"],tb:["t","Taxa cair a","≤","%"]};
function favBtn(k,n){const on=fvHas(k);return '<button type="button" class="btn sec fvbtn" data-fav="'+esc(k)+'" data-favn="'+esc(String(n||"").slice(0,90))+'" aria-pressed="'+on+'">'+(on?'★ Favorito':'☆ Favoritar')+'</button>'}

/* valores atuais de cada favorito */
function fvTdName(kind,d){const K=KIND[kind];return (K&&K.td||kind)+" "+String(d).slice(0,4)}
function fvInfo(k){
  const tp=k[0],id=k.slice(2);
  if(tp==="f"){if(!FN.idx)return {wait:"fundos"};const r=fnRow(id),C=FN.C;if(!r)return FN.full?{nada:1}:{wait:"fundos"};
    return {n:r[1],sub:"Fundo · "+(FN.idx.classes[r[C.classe]]||""),ult:r[C.ult]?"cota de "+fdate(Date.parse(r[C.ult]+"T00:00:00Z")):"",val:null,dia:null,mes:r[C.rm],r12:r[C.r12],stamp:r[C.ult]||"",go:"f"}}
  if(tp==="a"){if(!AT.idx)return {wait:"bolsa"};const r=atRow(id),C=AT.C;if(!r)return {nada:1};
    return {n:id+" · "+r[1],sub:r[C.tipo],ult:"R$ "+fx(r[C.preco],2),val:r[C.preco],dia:r[C.d1],mes:r[C.r1m],r12:r[C.r12],stamp:r[C.data]||"",go:"a"}}
  if(tp==="t"){const x=typeof TD_ALL==="object"&&TD_ALL?TD_ALL[id]:null;if(!x)return Object.keys(TD_ALL||{}).length?{nada:1}:{wait:"mercado"};const [kind,d]=id.split("|"),tx=x.buy!=null?x.buy:x.rate;
    return {n:fvTdName(kind,d),sub:"Tesouro Direto · "+(x.buy!=null?"taxa de compra":"taxa de resgate (fora de venda)"),ult:(KIND[kind]&&KIND[kind].fam==="selic"?"Selic + ":KIND[kind]&&KIND[kind].fam==="ipca"?"IPCA + ":"")+fx(tx,2)+"%"+(x.price?" · R$ "+fx(x.price,2):""),val:tx,dia:null,mes:null,r12:null,stamp:new Date().toISOString().slice(0,10),go:"t",td:"TD-"+(FV_TD[kind]||kind)+"-"+String(d).slice(0,4)}}
  return {nada:1};
}
function fvTest(al,I){
  if(!I||I.wait||I.nada)return null;const v=+al.v;let x=null;
  if(al.c==="pa"||al.c==="pb"||al.c==="ta"||al.c==="tb")x=I.val;else if(al.c==="dv")x=I.dia;else if(al.c==="ma")x=I.mes;else if(al.c==="r12")x=I.r12;
  if(x==null||!isFinite(x)||!isFinite(v))return null;
  const ok=al.c==="pa"||al.c==="ta"?x>=v:al.c==="dv"?Math.abs(x)>=v:x<=v;return {ok,x};
}
const fvAlTxt=al=>{const c=FV_C[al.c]||["","?","",""];return c[2]+" "+(c[3]==="R$"?"R$ "+fx(+al.v,2):fx(+al.v,2)+"%")};
const fvAlLong=al=>{const c=FV_C[al.c]||["","?","",""];return c[1]+" "+(c[3]==="R$"?"R$ "+fx(+al.v,2):fx(+al.v,2)+"%")};

/* painel */
function favHtml(){return '<section class="panel fvpanel"><div class="fvbox">'+fvInner()+'</div></section>'}
function fvInner(){
  const need=new Set();let h='<div class="fvhd"><h3>Favoritos e alertas</h3>';
  const perm="Notification" in window?Notification.permission:"x";
  if(FV.a.length&&perm==="default")h+='<button type="button" class="btn sec" data-fvperm="1">Receber avisos neste aparelho</button>';
  h+='</div>';
  if(!FV.l.length)h+='<p class="sub">Toque em <b>☆ Favoritar</b> na página de um fundo ou de um ativo da Bolsa para acompanhar aqui a variação do dia, do mês e de 12 meses. Os títulos do Tesouro você adiciona logo abaixo. Em cada favorito dá para criar um alerta de preço, taxa ou rentabilidade.</p>';
  else{
    h+='<div class="tablewrap" style="max-height:none"><table class="ctab fvtab"><thead><tr><th style="text-align:left">Favorito</th><th>Último</th><th>Dia</th><th class="c-ph">Mês</th><th>12 meses</th><th style="text-align:left">Alertas</th><th></th></tr></thead><tbody>';
    FV.l.forEach(f=>{const I=fvInfo(f.k);if(I.wait)need.add(I.wait);
      const als=FV.a.filter(a=>a.k===f.k);
      h+='<tr><td style="text-align:left" class="tw fvn"><button type="button" class="link" data-fvgo="'+esc(f.k)+'" title="'+esc(I.n||f.n||f.k)+'">'+esc(fvCurto(I.n||f.n||f.k))+'</button><small style="display:block;color:var(--muted)">'+esc(I.wait?"carregando…":I.nada?"não encontrado na base atual":I.sub||"")+'</small></td>'
        +'<td class="fvu">'+(I.ult||"—")+'</td><td class="fvd" data-l="Dia">'+(I.dia!=null?fnPct(I.dia):"—")+'</td><td class="c-ph" data-l="Mês">'+(I.mes!=null?fnPct(I.mes):"—")+'</td><td class="fvd" data-l="12m">'+(I.r12!=null?fnPct(I.r12):"—")+'</td><td style="text-align:left" class="fva">';
      als.forEach(a=>{const t=fvTest(a,I);h+='<span class="fvchip'+(t&&t.ok?' fvon':'')+'" title="'+esc(fvAlLong(a))+'">'+(t&&t.ok?'● ':'')+fvAlTxt(a)+'<button type="button" data-fvdel="'+esc(a.id)+'" aria-label="Remover alerta">×</button></span>'});
      h+=(f.k[0]==="f"||f.k[0]==="a"||f.k[0]==="t"?'<button type="button" class="link fvadd" data-fvnew="'+esc(f.k)+'">+ alerta</button>':'')+'</td><td class="fvx"><button type="button" class="link" data-fvrm="'+esc(f.k)+'" aria-label="Tirar dos favoritos">×</button></td></tr>';
      if(FV.edit===f.k){const tp=f.k[0],ops=Object.keys(FV_C).filter(c=>FV_C[c][0]===tp);
        h+='<tr class="fvform"><td colspan="7" style="text-align:left"><div class="fnfilt"><div class="field"><label for="fvC">Avisar quando</label><select id="fvC">'+ops.map(c=>'<option value="'+c+'">'+FV_C[c][1]+'</option>').join("")+'</select></div><div class="field"><label for="fvV">Valor</label><input id="fvV" inputmode="decimal" autocomplete="off" placeholder="'+(tp==="a"?"ex.: 35,50":tp==="t"?"ex.: 7,50":"ex.: 0,80")+'"></div><div class="field" style="align-self:end"><button type="button" class="btn" data-fvok="'+esc(f.k)+'">Salvar alerta</button> <button type="button" class="btn sec" data-fvcancel="1">Cancelar</button></div></div></td></tr>'}
    });
    h+='</tbody></table></div>';
  }
  // títulos do Tesouro
  const td=typeof TD_ALL==="object"&&TD_ALL?Object.keys(TD_ALL).filter(k=>KIND[k.split("|")[0]]&&!fvHas("t:"+k)).sort((a,b)=>{const ka=a.split("|"),kb=b.split("|");return (KIND[ka[0]].td||"").localeCompare(KIND[kb[0]].td||"")||ka[1].localeCompare(kb[1])}):[];
  if(td.length)h+='<div class="fnfilt" style="margin-top:10px"><div class="field"><label for="fvTd">Adicionar título do Tesouro</label><select id="fvTd"><option value="">Escolha o título…</option>'+td.map(k=>{const [kd,d]=k.split("|");return '<option value="'+k+'">'+esc(fvTdName(kd,d))+(TD_ALL[k].buy!=null?'':' (fora de venda)')+'</option>'}).join("")+'</select></div></div>';
  h+='<p class="sub fvsyncnote">'+(SYNC.tok?'Sincronizado com o GitHub. ':'')+'A sincronização entre aparelhos e a cópia em arquivo ficam em <button type="button" class="link" data-ajustes="1">Ajustes</button>.</p>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:8px">'+(SYNC.tok?'Favoritos, alertas, carteiras simuladas e as listas do comparador ficam no seu repositório privado do GitHub e aparecem iguais em todos os aparelhos conectados. Com o app aberto, os alertas são conferidos sempre que os dados se atualizam; com o app fechado, o robô do repositório confere a cada 30 minutos no horário de mercado e o GitHub avisa por e-mail e pelo app do GitHub. ':'Favoritos e alertas ficam só neste navegador. Os alertas são conferidos sempre que o app está aberto e os dados se atualizam (Bolsa e fundos: fechamento do dia; Tesouro: ao longo do dia). ')+(perm==="granted"?'Avisos deste aparelho ativados.':perm==="denied"?'Os avisos estão bloqueados nas configurações do navegador; os alertas disparados aparecem destacados aqui.':'')+'</p>';
  if(need.size)setTimeout(()=>fvNeed(need),0);
  return h;
}
function fvNeed(need){
  if(need.has("fundos")&&!FV.boot.f){FV.boot.f=1;Promise.resolve(fnBoot()).then(()=>fnMore()).then(fvRefresh)}
  if(need.has("bolsa")&&!FV.boot.a){FV.boot.a=1;Promise.resolve(atBoot()).then(fvRefresh)}
}
function fvRefresh(){document.querySelectorAll(".fvbox").forEach(b=>{b.innerHTML=fvInner()});fvCheck()}

/* conferência dos alertas e avisos */
function fvToast(L){
  let d=document.querySelector(".fvtoast");if(!d){d=document.createElement("div");d.className="fvtoast";d.setAttribute("role","status");document.body.appendChild(d)}
  if(d.hidden||!FV.tl)FV.tl=[];FV.tl=FV.tl.concat(L).slice(-6);
  d.innerHTML='<b>Alertas disparados</b>'+FV.tl.map(x=>'<div>'+esc(x)+'</div>').join("")+'<button type="button" class="btn sec" data-fvtoast="1">Fechar</button>';d.hidden=false;
}
function fvNotify(tit,body){
  try{if(!("Notification" in window)||Notification.permission!=="granted")return;
    const o={body,icon:"icone-192.png",tag:"alerta-"+tit};
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration)navigator.serviceWorker.getRegistration().then(r=>{if(r)r.showNotification(tit,o);else new Notification(tit,o)}).catch(()=>{try{new Notification(tit,o)}catch(e){}});
    else new Notification(tit,o)}catch(e){}
}
function fvCheck(){
  if(!FV.a.length)return;const novos=[],need=new Set();let mud=false;
  FV.a.forEach(a=>{const I=fvInfo(a.k);if(I.wait){need.add(I.wait);return}const t=fvTest(a,I);if(!t)return;
    const st=I.stamp+"|"+t.ok;if(t.ok&&a.ult!==st){a.ult=st;mud=true;const nome=I.n||a.k;novos.push(fvCurto(nome)+": "+fvAlLong(a).charAt(0).toLowerCase()+fvAlLong(a).slice(1)+" (agora "+(FV_C[a.c][3]==="R$"?"R$ "+fx(t.x,2):fx(t.x,2)+"%")+")");fvNotify(nome,fvAlLong(a)+" — agora "+(FV_C[a.c][3]==="R$"?"R$ "+fx(t.x,2):fx(t.x,2)+"%"))}
    else if(!t.ok&&a.ult&&a.ult.endsWith("|true")){a.ult=st;mud=true}});
  if(mud)fvSave();if(novos.length)fvToast(novos);if(need.size)fvNeed(need);
}
setTimeout(fvCheck,8000);setInterval(fvCheck,60000);

/* eventos (valem em qualquer área do app) */
document.addEventListener("click",e=>{
  const g=s=>e.target.closest&&e.target.closest(s);let x;
  if((x=g("[data-fav]"))){const k=x.dataset.fav;if(fvHas(k)){FV.l=FV.l.filter(f=>f.k!==k);FV.a=FV.a.filter(a=>a.k!==k)}else FV.l.push({k,n:x.dataset.favn||k});fvSave();const on=fvHas(k);x.setAttribute("aria-pressed",on);x.textContent=on?"★ Favorito":"☆ Favoritar";fvRefresh();return}
  if((x=g("[data-fvgo]"))){const k=x.dataset.fvgo,id=k.slice(2);if(k[0]==="f")fnOpen(id);else if(k[0]==="a")atOpen(id);else{const I=fvInfo(k);if(I.td){if(AT.idx&&!atRow(I.td))return;atOpen(I.td)}}return}
  if((x=g("[data-fvrm]"))){const k=x.dataset.fvrm;FV.l=FV.l.filter(f=>f.k!==k);FV.a=FV.a.filter(a=>a.k!==k);fvSave();fvRefresh();document.querySelectorAll('[data-fav="'+CSS.escape(k)+'"]').forEach(b=>{b.setAttribute("aria-pressed","false");b.textContent="☆ Favoritar"});return}
  if((x=g("[data-fvnew]"))){FV.edit=x.dataset.fvnew;fvRefresh();const v=$("fvV");if(v)v.focus();return}
  if(g("[data-fvcancel]")){FV.edit=null;fvRefresh();return}
  if((x=g("[data-fvok]"))){const c=$("fvC").value,v=num(String($("fvV").value||"").replace(/[^\d,.\-]/g,""));if(!isFinite(v)||$("fvV").value.trim()===""){$("fvV").focus();return}
    FV.a.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),k:x.dataset.fvok,c,v});FV.edit=null;fvSave();fvRefresh();
    if("Notification" in window&&Notification.permission==="default")Notification.requestPermission().then(()=>fvRefresh()).catch(()=>{});return}
  if((x=g("[data-fvdel]"))){FV.a=FV.a.filter(a=>a.id!==x.dataset.fvdel);fvSave();fvRefresh();return}
  if(g("[data-fvperm]")){if("Notification" in window)Notification.requestPermission().then(()=>fvRefresh()).catch(()=>{});return}
  if(g("[data-fvtoast]")){const d=document.querySelector(".fvtoast");if(d)d.hidden=true;return}
});
document.addEventListener("change",e=>{const t=e.target;if(t&&t.id==="fvTd"&&t.value){if(typeof SYNC!=="undefined")delete SYNC.del["f|t:"+t.value];const k=t.value,[kd,d]=k.split("|");FV.l.push({k:"t:"+k,n:fvTdName(kd,d)});fvSave();fvRefresh()}});

/* ----- documentos do ativo: fatos relevantes, comunicados, avisos, resultados e relatórios */
const DOCS={m:new Map(),f:"todos"};
const DOC_GR=[["todos","Todos"],["fr","Fatos relevantes"],["com","Comunicados e avisos"],["res","Resultados e relatórios"],["ass","Assembleias"]];
function docGrupo(d){const c=fnNorm(d[2]+" "+d[3]);
  if(/fato relevante/.test(c))return "fr";if(/assembleia|reuniao da administracao|atos de deliberacao/.test(c))return "ass";
  if(/economico-financeiro|relatorio|demonstrac|informes periodicos|calendario/.test(c))return "res";return "com"}
function atDocsHtml(A){const c=A.cnpj||(A.fii&&A.fii.cnpj)||(A.fund&&A.fund.cnpj)||"";if(!c||A.tipo==="Tesouro Direto")return "";return '<section class="panel" id="atDocs" data-cnpj="'+esc(c)+'" hidden></section>'}
function docsFill(){
  const el=$("atDocs");if(!el)return;const c=el.dataset.cnpj;
  if(!DOCS.m.has(c)){DOCS.m.set(c,null);atGet("d/"+c+".json").then(j=>{DOCS.m.set(c,j);docsFill()}).catch(()=>{DOCS.m.set(c,{docs:[]});docsFill()});return}
  const j=DOCS.m.get(c);if(!j)return;const L=j.docs||[];if(!L.length){el.hidden=true;return}
  const f=DOCS.f,V=L.filter(d=>f==="todos"||docGrupo(d)===f),hoje=Date.now();
  let h='<h3>Documentos e fatos relevantes</h3><p class="sub">Os '+L.length+' documentos mais recentes publicados '+(j.fonte==="CVM"?'pela companhia na CVM (fatos relevantes, comunicados, avisos aos acionistas, resultados, assembleias e reuniões do conselho)':'pelo fundo no Fundos.NET da B3')+'. Clique para abrir o documento original.</p>'+fnSeg("docf",DOC_GR.filter(g=>g[0]==="todos"||L.some(d=>docGrupo(d)===g[0])),f);
  h+='<div class="tablewrap" style="max-height:420px;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Entrega</th><th style="text-align:left">Documento</th></tr></thead><tbody>';
  if(!V.length)h+='<tr><td colspan="2" class="sub" style="text-align:left">Nada neste grupo.</td></tr>';
  V.forEach(d=>{const t=Date.parse(d[0].slice(0,10)+"T00:00:00Z"),novo=hoje-t<4*864e5;const tit=[d[2],d[3]&&d[3]!==d[2]?d[3]:"",d[4]].filter(Boolean).join(" · ");
    h+='<tr><td style="text-align:left;white-space:nowrap">'+(isFinite(t)?fdate(t):esc(d[0]))+(novo?' <span class="fntag strong">novo</span>':'')+'</td><td style="text-align:left" class="tw"><a href="'+esc(/^https:\/\/(www\.rad\.cvm\.gov\.br|fnet\.bmfbovespa\.com\.br)\//.test(d[6])?d[6]:"#")+'" target="_blank" rel="noopener noreferrer">'+esc(tit||"Documento")+'</a>'+(d[5]?'<small style="display:block;color:var(--muted)">'+esc(d[5])+'</small>':'')+'</td></tr>'});
  h+='</tbody></table></div>';
  el.innerHTML=h;el.hidden=false;
}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-docf]");if(x){DOCS.f=x.dataset.docf;docsFill()}});

/* ----- sincronização com o repositório privado do GitHub (favoritos, alertas e carteiras simuladas) */
const SYNC_REPO="wagneria206-app/dados-mercado-config",SYNC_URL="https://api.github.com/repos/"+SYNC_REPO+"/contents/config.json";
const SYNC={tok:null,sha:null,at:null,st:"",dirty:false,t:null,run:null,del:{}};
try{SYNC.tok=localStorage.getItem("ghTok")||null;SYNC.at=localStorage.getItem("ghSyncAt")||null;SYNC.dirty=localStorage.getItem("ghDirty")==="1";SYNC.del=JSON.parse(localStorage.getItem("ghDel")||"{}")||{}}catch(e){}
function syncLs(){try{if(SYNC.tok)localStorage.setItem("ghTok",SYNC.tok);else localStorage.removeItem("ghTok");localStorage.setItem("ghSyncAt",SYNC.at||"");localStorage.setItem("ghDirty",SYNC.dirty?"1":"0");localStorage.setItem("ghDel",JSON.stringify(SYNC.del))}catch(e){}}
const syncB64d=b=>new TextDecoder().decode(Uint8Array.from(atob(String(b).replace(/\s/g,"")),c=>c.charCodeAt(0)));
const syncB64e=t=>{const u=new TextEncoder().encode(t);let s="";for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)};
async function syncApi(metodo,corpo){
  const r=await fetch(SYNC_URL+(metodo==="GET"?"?t="+Date.now():""),{method:metodo,cache:"no-store",headers:Object.assign({"Authorization":"Bearer "+SYNC.tok,"Accept":"application/vnd.github+json"},corpo?{"Content-Type":"application/json"}:{}),body:corpo?JSON.stringify(corpo):undefined});
  if(r.status===404&&metodo==="GET")return null;
  if(!r.ok){const e=new Error(r.status===401?"token inválido ou expirado":r.status===403?"o token não tem permissão de gravar (Contents: Read and write)":r.status===404?"repositório "+SYNC_REPO+" não encontrado para este token":"GitHub respondeu "+r.status);e.status=r.status;throw e}
  return r.json();
}
function syncCarts(){try{return SP.carts.map(c=>{if(!c.id)c.id="c"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);return c})}catch(e){return []}}
function syncCmpAt(){try{return +localStorage.getItem("cmpAt")||0}catch(e){return 0}}
function syncLocal(){return {favs:FV.l,alertas:FV.a.map(a=>({id:a.id,k:a.k,c:a.c,v:a.v})),carts:syncCarts(),del:SYNC.del,cmp:{f:FN.cmp.slice(),a:AT.cmp.slice(),at:syncCmpAt()}}}
function syncMerge(L,R){ // une as duas versões; o que foi apagado em qualquer aparelho continua apagado
  const del=Object.assign({},R.del||{},L.del||{}),vivo=k=>!del[k];
  const uni=(a,b,key)=>{const m=new Map();(b||[]).forEach(x=>{if(x&&vivo(key(x)))m.set(key(x),x)});(a||[]).forEach(x=>{if(x&&vivo(key(x)))m.set(key(x),x)});return [...m.values()]};
  // listas do comparador: vale a alteração mais recente (sem juntar, para que tirar um item também valha nos outros aparelhos)
  const lc=L.cmp||{},rc=R.cmp||{},cmp=(+rc.at||0)>(+lc.at||0)?rc:lc;
  return {favs:uni(L.favs,R.favs,x=>"f|"+x.k),alertas:uni(L.alertas,R.alertas,x=>"a|"+x.id),carts:uni(L.carts,R.carts,x=>"c|"+x.id),del,cmp};
}
function syncApply(D){
  const ult=new Map(FV.a.map(a=>[a.id,a.ult]));
  FV.l=(D.favs||[]).filter(x=>x&&typeof x.k==="string").slice(0,60);FV.a=(D.alertas||[]).filter(x=>x&&x.k&&x.c).map(a=>Object.assign({},a,{ult:ult.get(a.id)}));
  SYNC.del=D.del||{};
  if(Array.isArray(D.carts)&&D.carts.length){SP.carts=D.carts;SP.cur=Math.min(SP.cur,SP.carts.length-1);if(typeof SP_CMP!=="undefined")SP_CMP=null}
  try{localStorage.setItem("favs",JSON.stringify(FV.l));localStorage.setItem("alertas",JSON.stringify(FV.a));localStorage.setItem("spCarts",JSON.stringify(SP.carts))}catch(e){}
  let mudouCmp=false;const C=D.cmp;
  if(C&&(+C.at||0)>syncCmpAt()&&Array.isArray(C.f)&&Array.isArray(C.a)){const f=C.f.filter(x=>typeof x==="string").slice(0,25),a=C.a.filter(x=>typeof x==="string").slice(0,25);
    mudouCmp=JSON.stringify(f)!==JSON.stringify(FN.cmp)||JSON.stringify(a)!==JSON.stringify(AT.cmp);FN.cmp=f;AT.cmp=a;
    try{localStorage.setItem("fnCmp",JSON.stringify(f));localStorage.setItem("atCmp",JSON.stringify(a));localStorage.setItem("cmpAt",String(+C.at))}catch(e){}}
  fvRefresh();if(typeof activeMod!=="undefined"){if(activeMod==="sp")spCalc();else if(mudouCmp&&(activeMod==="fc"||activeMod==="ac"))fnCalc(activeMod)}
}
async function syncNow(forcar){
  if(!SYNC.tok)return;if(SYNC.run)return SYNC.run;
  SYNC.run=(async()=>{
    try{SYNC.st="sincronizando…";syncShow();
      for(let tent=0;tent<3;tent++){
        const j=await syncApi("GET");let R={favs:[],alertas:[],carts:[],del:{}};
        if(j){SYNC.sha=j.sha;try{R=JSON.parse(syncB64d(j.content))}catch(e){}}else SYNC.sha=null;
        const novoRemoto=!!(R.atualizadoEm&&R.atualizadoEm!==SYNC.at);
        if(!SYNC.dirty&&!forcar){if(novoRemoto)syncApply(R);SYNC.at=R.atualizadoEm||SYNC.at;break}
        const M=syncMerge(syncLocal(),R);M.v=1;M.atualizadoEm=new Date().toISOString();
        try{const r=await syncApi("PUT",{message:"Configurações do app ("+new Date().toLocaleString("pt-BR")+")",content:syncB64e(JSON.stringify(M,null,1)),sha:SYNC.sha||undefined});SYNC.sha=r&&r.content&&r.content.sha;SYNC.at=M.atualizadoEm;SYNC.dirty=false;syncApply(M);break}
        catch(e){if(e.status===409||e.status===422)continue;throw e}
      }
      SYNC.st="sincronizado às "+new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});SYNC.err=null;
    }catch(e){SYNC.st="";SYNC.err=e.message}
    syncLs();syncShow();
  })().finally(()=>{SYNC.run=null});
  return SYNC.run;
}
function syncMark(){if(!SYNC.tok)return;SYNC.dirty=true;syncLs();clearTimeout(SYNC.t);SYNC.t=setTimeout(()=>syncNow(),1500)}
function syncHtml(){
  let h='<details class="nota fvsync"'+(SYNC.tok||SYNC.err?' open':'')+'><summary>Sincronizar com o GitHub '+(SYNC.tok?'<span class="fnq fnq1">conectado</span>':'')+'</summary><div class="fvsyncbox">';
  if(SYNC.tok)h+='<p class="sub">Conectado ao repositório privado <b>'+SYNC_REPO+'</b>. <span id="syncSt">'+esc(SYNC.err?'':SYNC.st)+'</span></p>'+(SYNC.err?'<p class="warn">Não deu para sincronizar: '+esc(SYNC.err)+'.</p>':'')+'<div class="spbtns"><button type="button" class="btn sec" data-syncnow="1">Sincronizar agora</button><button type="button" class="btn sec" data-syncoff="1">Desconectar este aparelho</button></div>';
  else h+='<p class="sub">Cole o token de acesso do GitHub (começa com <code>github_pat_</code>), criado só para o repositório privado <b>'+SYNC_REPO+'</b> com <i>Contents: Read and write</i>. Ele fica guardado só neste aparelho; faça isso uma vez em cada aparelho.</p><div class="fnfilt"><div class="field"><label for="syncTok">Token</label><input id="syncTok" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></div><div class="field" style="align-self:end"><button type="button" class="btn" data-syncon="1">Conectar</button></div></div>'+(SYNC.err?'<p class="warn">'+esc(SYNC.err)+'</p>':'');
  h+='<div class="spbtns" style="margin-top:6px"><button type="button" class="link" data-bkp="1">Baixar cópia (arquivo)</button><label class="link" for="bkpIn" style="cursor:pointer">Restaurar de um arquivo</label><input id="bkpIn" type="file" accept=".json,application/json" hidden></div>';
  return h+'</div></details>';
}
function syncShow(){const el=$("syncSt");if(el)el.textContent=SYNC.err?"":SYNC.st;if(SYNC.err||!el)document.querySelectorAll(".fvbox").forEach(b=>{const d=b.querySelector(".fvsync");if(d)d.outerHTML=syncHtml()})}
document.addEventListener("click",e=>{const g=s=>e.target.closest&&e.target.closest(s);
  if(g("[data-syncon]")){const v=($("syncTok").value||"").trim();if(!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(v)){SYNC.err="isso não parece um token do GitHub";syncShow();return}SYNC.tok=v;SYNC.err=null;SYNC.dirty=true;syncLs();syncNow(true).then(()=>{if(SYNC.err){SYNC.tok=null;syncLs();syncShow()}});return}
  if(g("[data-syncnow]")){syncNow(true);return}
  if(g("[data-syncoff]")){SYNC.tok=null;SYNC.sha=null;SYNC.st="";SYNC.err=null;syncLs();fvRefresh();return}
  if(g("[data-bkp]")){const txt=JSON.stringify(Object.assign(syncLocal(),{v:1,exportadoEm:new Date().toISOString()}),null,1);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"application/json"}));a.download="mercado-favoritos-"+new Date().toISOString().slice(0,10)+".json";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);return}
});
document.addEventListener("change",async e=>{const t=e.target;if(!t||t.id!=="bkpIn"||!t.files||!t.files[0])return;
  try{const D=JSON.parse(await t.files[0].text());if(!D||!Array.isArray(D.favs))throw new Error("arquivo inválido");syncApply(syncMerge(syncLocal(),D));fvSave();try{localStorage.setItem("spCarts",JSON.stringify(SP.carts))}catch(x){}}
  catch(x){SYNC.err="não deu para ler o arquivo: "+x.message;syncShow()}t.value=""});
// apagar um favorito, alerta ou carteira registra a exclusão para os outros aparelhos
document.addEventListener("click",e=>{const g=s=>e.target.closest&&e.target.closest(s);let x;const agora=Date.now();
  if((x=g("[data-fvrm]")))SYNC.del["f|"+x.dataset.fvrm]=agora;
  else if((x=g("[data-fvdel]")))SYNC.del["a|"+x.dataset.fvdel]=agora;
  else if((x=g("[data-fav]"))){if(fvHas(x.dataset.fav))SYNC.del["f|"+x.dataset.fav]=agora;else delete SYNC.del["f|"+x.dataset.fav]}
  else if((x=g("[data-spdel]"))&&x.dataset.ok==="1"){const c=SP.carts[SP.cur];if(c&&c.id)SYNC.del["c|"+c.id]=agora}
  else return;syncLs()},true);
if(SYNC.tok){setTimeout(()=>syncNow(),1500);setInterval(()=>{if(document.visibilityState==="visible")syncNow()},5*60000);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")syncNow()})}

