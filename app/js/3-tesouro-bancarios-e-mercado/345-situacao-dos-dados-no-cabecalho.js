/* ================= Rotina: Meu dia, saúde dos dados, importação de documentos ================= */
const todayUtc=()=>{const d=new Date();return utc(d.getFullYear(),d.getMonth(),d.getDate())};
function bdLag(a,b){if(!isFinite(a))return 99;let n=0;for(let t=a+DAY;t<b;t+=DAY)if(isBiz(t))n++;return n}

/* --- 3. saúde dos dados --- */
let MD_MKT=null;
const _onDoc0=onDoc;
onDoc=function(doc){if(doc)MD_MKT=doc;_onDoc0(doc);try{healthRender()}catch(e){}};
function healthItems(){
  const T=todayUtc(),D=DATA_INFO||{},L=[],add=(grp,name,date,st,txt,core)=>L.push({grp,name,date,st,txt,core});
  const lvl=(lag,g,a)=>lag<=g?"ok":lag<=a?"warn":"bad";
  const ref=parseDate(D.refDate),lagR=bdLag(ref,T);
  add("Mercado","Taxas ANBIMA de títulos públicos",ref,lvl(lagR,0,1),isFinite(ref)?(lagR?lagR+" dia(s) útil(eis) de atraso":"em dia"):"sem data",true);
  const tdk=Object.keys(typeof TDH==="object"&&TDH||{}).sort(),td=parseDate(D.tdDate||(tdk.length?tdk[tdk.length-1]:"")),lagT=bdLag(td,T);
  add("Mercado","Tesouro Direto (taxas de compra e venda)",td,lvl(lagT,1,2),isFinite(td)?(lagT>1?lagT+" dias úteis de atraso":"em dia"):"sem dados do Tesouro",true);
  const curv=MD_MKT&&Array.isArray(MD_MKT.curvePre)&&MD_MKT.curvePre.length>=5;
  add("Mercado","Curva de juros prefixada (ETTJ)",curv?ref:NaN,curv?"ok":"warn",curv?"da mesma data da ANBIMA":"usando a curva embutida no app",false);
  const ck=Object.keys(CDI_DAILY||{}).sort(),cd=ck.length?parseDate(ck[ck.length-1]):NaN,lagC=bdLag(cd,T);
  add("Índices","CDI diário",cd,lvl(lagC,1,3),isFinite(cd)?(lagC>1?lagC+" dias úteis sem CDI novo (o app projeta pela Selic)":"em dia"):"sem série",true);
  const ik=MD_MKT&&MD_MKT.ipca?Object.keys(MD_MKT.ipca).filter(k=>/^\d{6}$/.test(k)).sort():[],last=ik.length?ik[ik.length-1]:"";
  const now=new Date(T),exp=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-(now.getUTCDate()>=12?1:2),1)),ek=exp.getUTCFullYear()*100+exp.getUTCMonth()+1,lk=+last||0,mdiff=lk?(Math.floor(ek/100)*12+ek%100)-(Math.floor(lk/100)*12+lk%100):99;
  add("Índices","IPCA mensal (IBGE)",lk?utc(Math.floor(lk/100),lk%100-1,1):NaN,mdiff<=0?"ok":mdiff===1?"warn":"bad",lk?"último mês: "+String(lk).slice(4)+"/"+String(lk).slice(0,4)+(mdiff>0?" (falta "+mdiff+" mês)":""):"sem série",false);
  if(MD_MKT){const at=Date.parse(MD_MKT.statusAt||MD_MKT.updatedAt||"");const age=isFinite(at)?(Date.now()-at)/86400000:99;
    const st=MD_MKT.status==="error"?"bad":MD_MKT.status==="running"&&Date.now()-at>25*60000?"bad":age>4?"bad":age>2?"warn":"ok";
    add("Atualização","Atualização diária automática",isFinite(at)?at:NaN,st,MD_MKT.status==="error"?"a última tentativa falhou"+(MD_MKT.notes?": "+clean(MD_MKT.notes).slice(0,90):""):MD_MKT.status==="running"?"em andamento":"concluída"+(MD_MKT.notes?" · "+clean(MD_MKT.notes).slice(0,90):""),true)}
  else add("Atualização","Atualização diária automática",NaN,"warn","usando os dados embutidos no app",true);
  try{const n=CHK&&CHK.bad?CHK.bad.length:0;add("Atualização","Conferência de preços publicados",NaN,n?"warn":"ok",n?n+" taxa(s) não reproduzem o preço publicado":"todas as taxas reproduzem o preço publicado",false)}catch(e){}
  const held=new Map();Object.keys(POS).forEach(id=>{const p=POS[id],r=cartRes[id];if(!p||!r||r.err||r.closed)return;const k=p.mod+"|"+p.key;if(!held.has(k))held.set(k,{p,r,v:0});held.get(k).v+=r.valM||0});
  [...held.values()].forEach(({p,r,v})=>{
    if(p.mod==="pc"){const P=PAPERS[p.key];if(!P||!P.anbima){add("Carteira",(P&&P.type||"Crédito")+" "+p.key,NaN,"info","sem taxa ANBIMA: valor pela taxa "+(p.mrate?"informada":r.srcTag==="estimada"?"estimada (spread da emissão)":"da curva"),false);return}
      const rd=P.anbima&&parseDate(P.anbima.refDate),lg=isFinite(rd)&&isFinite(ref)?bdLag(rd,ref+DAY):99;add("Carteira",(P.type==="DEB"?"Debênture ":P.type+" ")+p.key,rd,!isFinite(rd)?"bad":lg<=0?"ok":lg<=3?"warn":"bad",!isFinite(rd)?"sem taxa ANBIMA":lg?"taxa ANBIMA de "+fdate(rd)+" ("+lg+" dia(s) útil(eis) antes)":"taxa ANBIMA em dia",false)}
    else if(p.mod==="fund"){const F=FUNDS[cnpjNorm(p.key)]||{},q=(F.quotes||[]).map(x=>parseDate(x[0])).filter(isFinite).sort((a,b)=>a-b),lq=q.length?q[q.length-1]:NaN,lg=bdLag(lq,T);
      add("Carteira","Fundo "+(p.fdName||F.name||p.key).slice(0,40),lq,!isFinite(lq)?"bad":lg<=5?"ok":lg<=15?"warn":"bad",!isFinite(lq)?"sem cota registrada: valor estimado":"última cota de "+fdate(lq)+(lg>5?" ("+lg+" dias úteis)":""),false)}});
  return L;
}
const MD_HORD={bad:0,warn:1,info:2,ok:3},MD_HDOT={ok:"pos",warn:"warn",bad:"neg",info:""};
function healthHtml(L){
  L=L||healthItems();const nb=L.filter(x=>x.st==="bad").length,nw=L.filter(x=>x.st==="warn").length;
  let h='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Fonte</th><th style="text-align:left">Situação</th></tr></thead><tbody>';
  let g="";L.slice().sort((a,b)=>a.grp.localeCompare(b.grp)||MD_HORD[a.st]-MD_HORD[b.st]).forEach(x=>{if(x.grp!==g){g=x.grp;h+='<tr><td colspan="2" style="text-align:left"><small><b>'+g+'</b></small></td></tr>'}
    h+='<tr><td style="text-align:left" class="tw"><span class="'+MD_HDOT[x.st]+'">●</span> '+esc(x.name)+(isFinite(x.date)?'<br><small>'+(x.grp==="Atualização"?fdt(new Date(x.date).toISOString()):fdate(x.date))+'</small>':'')+'</td><td style="text-align:left" class="tw"><small class="'+(x.st==="bad"?"neg":"")+'">'+esc(x.txt)+'</small></td></tr>'});
  return h+'</tbody></table></div><p class="sub" style="font-size:.8rem;margin-top:6px">'+(nb?nb+' fonte(s) desatualizada(s)':'Nenhuma fonte crítica atrasada')+(nw?' · '+nw+' em atenção':'')+'. Os dados são atualizados todo dia útil às 20h10; o botão Atualizar dados pede uma atualização na hora. Verde: em dia; amarelo: atenção; vermelho: valores podem estar defasados.</p>';
}
let MD_HOPEN=false;
function healthRender(){
  const bar=$("healthBar");if(!bar)return;const L=healthItems(),bad=L.filter(x=>x.st==="bad"&&x.core),core=bad;
  if(!bad.length){bar.hidden=true;bar.innerHTML="";return}
  bar.hidden=false;bar.className="healthbar"+(core.length?" crit":"");
  bar.innerHTML='<details'+(MD_HOPEN?' open':'')+'><summary><b>'+(core.length?'Dados de mercado desatualizados':'Dados da carteira desatualizados')+':</b> '+bad.slice(0,3).map(x=>esc(x.name)).join(", ")+(bad.length>3?' e mais '+(bad.length-3):'')+'. Os valores a mercado podem estar defasados. <u>Ver saúde dos dados</u></summary><div style="margin-top:8px">'+healthHtml(L)+'</div></details>';
  const d=bar.querySelector("details");d.addEventListener("toggle",()=>{MD_HOPEN=d.open});
}
setInterval(()=>{try{healthRender()}catch(e){}},60000);

/* --- 1. Meu dia --- */










/* --- 2. importação de nota, extrato ou comprovante --- */














