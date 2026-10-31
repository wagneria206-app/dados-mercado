/* ===== Comparador (fundos e ativos, até 25), janelas móveis, similares, gross-up, gestoras ===== */
const CMP_MAX=25;
const CMP_COLS=["#2563eb","#16a34a","#dc2626","#9333ea","#f59e0b","#0891b2","#db2777","#65a30d","#4f46e5","#ea580c","#0d9488","#be123c","#854d0e","#0284c7","#7c3aed","#4d7c0f","#e879f9","#1e3a8a","#14b8a6","#64748b","#facc15","#831843","#22d3ee","#a3a3a3","#b91c1c"];
const CMPST={f:{tab:"ret",per:"12",hide:{},ini:"",fim:"",same:1,jan:12,sort:{}},a:{tab:"ret",per:"12",hide:{},ini:"",fim:"",same:1,jan:12,sort:{}}};
try{const c=JSON.parse(localStorage.getItem("cmpSt")||"null");if(c&&c.f&&c.a){Object.assign(CMPST.f,c.f,{hide:{}});Object.assign(CMPST.a,c.a,{hide:{}})}}catch(e){}
function cmpSave(){try{localStorage.setItem("cmpSt",JSON.stringify({f:Object.assign({},CMPST.f,{hide:{}}),a:Object.assign({},CMPST.a,{hide:{}})}))}catch(e){}}
function cmpK(kind){
  return kind==="f"?{kind,list:FN.cmp,X:FN,files:FN.files,load:fnFund,key:F=>F.c,name:F=>F.fan||F.n||fnCnpjF(F.c),open:"fnopen",body:"fnCbody",save:fnSave,noun:"fundo"}
    :{kind,list:AT.cmp,X:AT,files:AT.files,load:atFile,key:F=>F.t,name:F=>F.t+" · "+(F.nome||""),open:"atopen",body:"atCbody",save:atSave,noun:"ativo"};
}
function fnCmp(){cmpRender("f")}
function atCmp(){cmpRender("a")}
const cmpDt=s=>{const t=Date.parse((s||"")+"T00:00:00Z");return isFinite(t)?t:null};
function cmpPeriod(F,st){
  let p0=null;const first=fnFirst(F),last=fnLast(F);if(!first||!last)return null;
  if(st.per==="custom"){const a=cmpDt(st.ini);p0=a==null||first.t>a?first:fnPtAt(F,a)}
  else p0=fnStart(F,st.per)||(st.per==="tudo"?first:null);
  return {p0,first,last,curto:!p0};
}
function cmpRender(kind){
  const K=cmpK(kind),st=CMPST[kind],b=$(K.body);if(!b)return;
  if(!K.list.length){b.innerHTML='<p class="sub" style="margin-top:12px">Nenhum '+K.noun+' escolhido ainda. Busque acima ou use o botão + no ranking e na análise.</p>';return}
  const miss=K.list.filter(k=>!K.files.has(k));
  if(miss.length){b.innerHTML='<p class="sub" style="margin-top:12px">Carregando '+miss.length+' '+K.noun+(miss.length>1?'s':'')+'…</p>';
    Promise.all(miss.map(k=>K.load(k).catch(()=>{const i=K.list.indexOf(k);if(i>=0)K.list.splice(i,1);K.save()}))).then(()=>{if(activeMod===(kind==="f"?"fc":"ac"))cmpRender(kind)});return}
  try{b.innerHTML=fnUse(K.X,()=>cmpHtml(K,st))}catch(e){b.innerHTML='<p class="err">Não deu para montar a comparação: '+esc(e.message)+'</p>';console.error(e)}
}
function cmpHtml(K,st){
  const Fs=K.list.map(k=>K.files.get(k)).filter(Boolean),col=j=>CMP_COLS[j%CMP_COLS.length];
  let h='<div class="cmphead"><span class="sub">'+Fs.length+' de '+CMP_MAX+'</span><button type="button" class="link" data-cmpclear="'+K.kind+'">Limpar tudo</button><button type="button" class="link" data-cmpcsv="'+K.kind+'">Baixar tabela (CSV)</button><button type="button" class="link" data-rel="'+(K.kind==="f"?"fc":"ac")+'">Relatório PDF</button><button type="button" class="link" data-cmp2sp="'+K.kind+'">Criar carteira/proposta com estes itens</button></div>';
  h+='<div class="fnchips">'+Fs.map((F,j)=>'<span class="fnchip"><i style="background:'+col(j)+'"></i><button type="button" class="link" data-'+K.open+'="'+K.key(F)+'">'+esc(K.name(F).slice(0,46))+'</button><button type="button" class="fnx" data-cmprm="'+K.kind+'|'+K.key(F)+'" aria-label="Remover">×</button></span>').join("")+'</div>';
  h+=fnSeg("cmpper",FN_PER.filter(x=>x[0]!=="mes").concat([["custom","Datas livres"]]),st.per);
  if(st.per==="custom")h+='<div class="cmpdates"><label>De <input type="date" data-cmpini="'+K.kind+'" value="'+esc(st.ini)+'"></label><label>até <input type="date" data-cmpfim="'+K.kind+'" value="'+esc(st.fim)+'"></label></div>';
  h+='<div class="cvsel cmpopt"><label><input type="checkbox" data-cmpsame="'+K.kind+'"'+(st.same?' checked':'')+'>Mesmo início para todos</label></div>'+fnBmSel();
  // períodos
  const per=Fs.map(F=>cmpPeriod(F,st));let t0=null,t1=null;
  const ok=per.filter(p=>p&&p.p0);
  if(!ok.length)return h+'<p class="sub">Nenhum dos escolhidos tem histórico para esse período.</p>';
  if(st.same){t0=Math.max(...ok.map(p=>p.p0.t));t1=Math.max(...ok.map(p=>p.last.t))}
  const fimReq=st.per==="custom"?cmpDt(st.fim):null;
  const rows=Fs.map((F,j)=>{const p=per[j];if(!p||!p.p0)return {F,j,sem:true};
    let a=st.same?fnPtAt(F,t0):p.p0,z=st.same?fnPtAt(F,t1):p.last;if(fimReq!=null&&z&&z.t>fimReq)z=fnPtAt(F,fimReq);
    if(!a||!z||a.t>=z.t)return {F,j,sem:true};
    return {F,j,p0:a,p1:z,r:(z.q/a.q-1)*100,cdi:fnBmRet("cdi",a,z)}});
  const tmin=Math.min(...ok.map(p=>p.p0.t)),lim=st.same&&t0>tmin+5*DAY?Fs.filter((F,j)=>per[j]&&per[j].p0&&per[j].p0.t>tmin+5*DAY):[];
  // gráfico
  const S=[];rows.forEach(x=>{if(x.sem||st.hide[K.key(x.F)])return;const P=fnThin(fnSeries(x.F,x.p0).filter(p=>p.t<=x.p1.t),Fs.length>8?350:600);S.push({lab:K.name(x.F).slice(0,30),col:col(x.j),w:Fs.length>8?1.5:2,pts:P.map(p=>[p.t,(p.q/x.p0.q-1)*100])})});
  const ref=rows.find(x=>!x.sem);const refP=ref?fnThin(fnSeries(ref.F,ref.p0).filter(p=>p.t<=ref.p1.t),500):[];
  const bmRows=[];Object.keys(FN_BM).forEach(b=>{if(!FN.bm[b]||!refP.length)return;const b0=fnLev(b,refP[0]);if(!b0)return;S.push({lab:FN_BM[b].lab,col:FN_BM[b].col,dash:FN_BM[b].dash||"4 4",w:1.4,pts:refP.map(p=>{const v=fnLev(b,p);return [p.t,v?(v/b0-1)*100:null]})});bmRows.push(b)});
  h+='<div class="label" style="margin-top:8px">'+(K.kind==="f"?"Rentabilidade":"Retorno com proventos")+(st.same&&ref?' de '+fdate(ref.p0.t)+' a '+fdate(ref.p1.t):' (cada um desde o próprio início no período)')+'</div>'+fnChart(S,{fmt:"pct",zero:true,noLegend:true,aria:"Comparação"});
  h+='<div class="cmpleg">'+rows.map(x=>'<button type="button" data-cmphide="'+K.kind+'|'+K.key(x.F)+'" class="'+(st.hide[K.key(x.F)]||x.sem?'off':'')+'"'+(x.sem?' disabled title="Sem histórico no período"':'')+'><i style="background:'+col(x.j)+'"></i>'+esc(K.name(x.F).slice(0,34))+'</button>').join("")+bmRows.map(b=>'<span><i style="background:'+FN_BM[b].col+'"></i>'+FN_BM[b].lab+'</span>').join("")+'<button type="button" class="link" data-cmpall="'+K.kind+'">Mostrar todos</button><button type="button" class="link" data-cmpnone="'+K.kind+'">Ocultar todos</button></div>';
  if(lim.length&&lim.length<=10)h+='<p class="sub" style="font-size:.8rem">O início comum é limitado por: '+lim.map(F=>esc(K.name(F).slice(0,40))).join(", ")+'. Desmarque "Mesmo início para todos" para ver cada um desde o próprio início.</p>';
  if(rows.some(x=>x.sem))h+='<p class="sub" style="font-size:.8rem">Sem histórico no período: '+rows.filter(x=>x.sem).map(x=>esc(K.name(x.F).slice(0,40))).join(", ")+'.</p>';
  // abas da tabela
  h+=fnSeg("cmptab",[["ret","Rentabilidade"],["risk","Risco"],["jan","Janelas móveis"],["info","Características"],["cor","Correlação"]],st.tab);
  const T=cmpTable(K,st,rows,bmRows,ref);CMP_LAST[K.kind]=T;CMP_CTX[K.kind]={K,st,rows,bmRows,ref};
  h+=T.html;
  return h;
}
const CMP_LAST={},CMP_CTX={};
function cmpCols(K,st){
  const pct=v=>fnPct(v),pt=v=>fnPctT(v),n2=v=>v==null||!isFinite(v)?'—':fx(v,2);
  if(st.tab==="ret")return [["Período","r",pct],["% do CDI","pcdi",v=>v==null?'—':fx(v,0)+'%'],["Anualizado","ann",pt],["No mês","rm",pct],["No ano","ra",pct],["12 meses","r12",pct],["24 meses","r24",pct],["36 meses","r36",pct],["60 meses","r60",pct]];
  if(st.tab==="risk")return [["Volatilidade","vol",v=>v==null?'—':fx(v,2)+'%'],["Sharpe","sharpe",n2],["Sortino","sortino",n2,"c-sm"],["Perda máxima","dd",pct],["Recuperação (dias)","rec",v=>v==null?'—':v<0?'não recuperou':fx(v,0),"c-md"],["Beta (Ibov.)","beta",n2],["Alfa de Jensen","alpha",pct,"c-md"],["Treynor","treynor",pt,"c-lg"],["Tracking error","te",v=>v==null?'—':fx(v,2)+'%',"c-lg"],["Information ratio","ir",n2,"c-lg"],["VaR 95% (dia)","var95",pct,"c-md"],["Meses positivos","mpos",v=>v==null?'—':fx(v,0)+'%',"c-sm"],["Meses acima do CDI","mcdi",v=>v==null?'—':fx(v,0)+'%']];
  if(st.tab==="jan")return [["Janelas","jn",v=>v==null?'—':fx(v,0)],["Acima do CDI","jcdi",v=>v==null?'—':fx(v,0)+'%'],["Positivas","jpos",v=>v==null?'—':fx(v,0)+'%'],["Média","jmed",pct],["Mediana","jmd",pct],["Pior","jmin",pct],["Melhor","jmax",pct],["Média do CDI","jc",pt]];
  if(st.tab==="info"&&K.kind==="f")return [["Categoria","anb",v=>'<small>'+esc(v||"")+'</small>'],["Gestora","ges",v=>'<small>'+esc(v||"")+'</small>'],["Patrimônio","pl",fnMoney],["Cotistas","cot",fnInt],["Captação 12m","cap",fnMoney],["Taxa adm.","tadm",v=>v==null?'—':fx(v,2)+'%'],["Performance","tperf",v=>v==null?'—':v?fx(v,0)+'%':'não cobra'],["Aplicação mín.","amin",v=>v==null?'—':v?brl(v):'sem mínimo'],["Resgate","dres",v=>v==null?'—':'D+'+fx(v,0)],["Tributação","trib",v=>esc(v||"—")],["Início","ini",v=>v?fdate(v):'—']];
  if(st.tab==="info")return [["Tipo","tipo",v=>esc(v||"")],["Setor","setor",v=>'<small>'+esc(v||"")+'</small>'],["Preço","preco",v=>v==null?'—':'R$ '+fx(v,2)],["DY 12m","dy",pt],["P/L","plr",v=>v==null?'—':fx(v,1)],["P/VP","pvp",n2],["ROE","roe",pt],["Margem líq.","ml",pt],["DL/EBIT","dle",n2],["Valor de mercado","mcap",fnMoney],["Liquidez/dia","liq",fnMoney]];
  return [];
}
function cmpVals(K,st,x){
  const F=x.F,o={};if(st.tab==="ret"){o.r=x.r;o.pcdi=x.r!=null&&x.cdi>0?x.r/x.cdi*100:null;if(x.p0){const nd=(x.p0.i!=null&&x.p1.i!=null)?x.p1.i-x.p0.i:(x.p1.t-x.p0.t)/DAY*252/365;o.ann=nd>20?(Math.pow(1+x.r/100,252/nd)-1)*100:null}
    ["mes","ano","12","24","36","60"].forEach((p,i)=>{const r=fnRet(F,p);o[["rm","ra","r12","r24","r36","r60"][i]]=r?r.r:null})}
  else if(st.tab==="risk"){const rk=x.p0?fnRisk(F,x.p0,x.p1):null;if(rk){Object.assign(o,{vol:rk.vol,sharpe:rk.sharpe,sortino:rk.sortino,dd:rk.dd,beta:rk.beta,alpha:rk.alpha,treynor:rk.treynor,te:rk.te,ir:rk.ir,var95:rk.var95});o.rec=rk.ddT?(rk.rec?Math.round((rk.rec-rk.ddT)/DAY):-1):null}
    if(x.p0){const mo=fnMonthly(F),ks=[...mo.keys()].filter(k=>fnMt(k)>x.p0.t+5*DAY&&fnMt(k)<=x.p1.t+5*DAY);let p=0,c=0,nc=0;ks.forEach(k=>{const v=mo.get(k);if(v>0)p++;const b=fnBmMonth("cdi",k);if(b!=null){nc++;if(v>b)c++}});o.mpos=ks.length?p/ks.length*100:null;o.mcdi=nc?c/nc*100:null}}
  else if(st.tab==="jan"){Object.assign(o,cmpJan(F,st.jan,x.p1))}
  else if(st.tab==="info"&&K.kind==="f"){const r=fnRow(F.c),C=FN.C,u=F.M.get(F.MK[F.MK.length-1])||{};Object.assign(o,{anb:F.anb||F.cls,ges:F.ges,pl:u.pl,cot:u.cot,cap:r?r[C.capt12]:null,tadm:F.tadm,tperf:F.tperf,amin:F.amin,dres:F.dcot!=null||F.dpag!=null?(F.dcot||0)+(F.dpag||0):null,trib:/^s/i.test(F.lp||"")?"Longo prazo":/^n/i.test(F.lp||"")?"Curto prazo":"",ini:F.ini?Date.parse(F.ini.slice(0,10)+"T00:00:00Z"):null})}
  else if(st.tab==="info"){const m=F.met||{},i=F.ind||{},u=atFiiLast(F),px=F.R[F.R.length-1];Object.assign(o,{tipo:F.tipo,setor:F.setor,preco:px,dy:m.dy,plr:i.pl_r,pvp:i.pvp!=null?i.pvp:u&&u.vpc?px/u.vpc:null,roe:i.roe,ml:i.ml,dle:i.dl_ebit,mcap:i.mcap||(F.fii&&F.fii.cotas?F.fii.cotas*px:null),liq:m.liq})}
  return o;
}
function cmpJan(F,n,p1){ // janelas móveis de n meses com os fechamentos de fim de mês
  const ks=F.MK.filter(k=>!p1||fnMt(k)<=p1.t+5*DAY),R=[],C=[];let pos=0,ac=0;
  ks.forEach(k=>{if(!F.M.has(k-n))return;const r=(F.M.get(k).q/F.M.get(k-n).q-1)*100,c=FN.L&&FN.L.m.cdi&&FN.L.m.cdi[k]&&FN.L.m.cdi[k-n]?(FN.L.m.cdi[k]/FN.L.m.cdi[k-n]-1)*100:null;R.push(r);if(c!=null){C.push(c);if(r>c)ac++}if(r>0)pos++});
  if(!R.length)return {jn:0};const s=R.slice().sort((a,b)=>a-b);
  return {jn:R.length,jcdi:C.length?ac/C.length*100:null,jpos:pos/R.length*100,jmed:R.reduce((a,x)=>a+x,0)/R.length,jmd:s[Math.floor(s.length/2)],jmin:s[0],jmax:s[s.length-1],jc:C.length?C.reduce((a,x)=>a+x,0)/C.length:null};
}
function cmpJanSeries(F,n){const out=[];F.MK.forEach(k=>{if(F.M.has(k-n))out.push([fnMt(k),(F.M.get(k).q/F.M.get(k-n).q-1)*100])});return out}
function cmpTable(K,st,rows,bmRows,ref){
  const col=j=>CMP_COLS[j%CMP_COLS.length];
  if(st.tab==="cor"){
    const ok=rows.filter(x=>!x.sem);if(ok.length<2)return {html:'<p class="sub">Escolha pelo menos 2 itens com histórico no período.</p>',csv:[]};
    const D=ok.map(x=>{const m=new Map(),P=fnSeries(x.F,x.p0).filter(p=>p.i!=null&&p.t<=x.p1.t);for(let j=1;j<P.length;j++)if(P[j].i-P[j-1].i===1)m.set(P[j].i,P[j].q/P[j-1].q-1);return m});
    const cor=(a,b)=>{const xs=[],ys=[];a.forEach((v,k)=>{if(b.has(k)){xs.push(v);ys.push(b.get(k))}});if(xs.length<30)return null;const mx=xs.reduce((s,x)=>s+x,0)/xs.length,my=ys.reduce((s,x)=>s+x,0)/ys.length;let sxy=0,sxx=0,syy=0;for(let j=0;j<xs.length;j++){sxy+=(xs[j]-mx)*(ys[j]-my);sxx+=(xs[j]-mx)**2;syy+=(ys[j]-my)**2}return sxx&&syy?sxy/Math.sqrt(sxx*syy):null};
    const M=ok.map((x,i)=>ok.map((y,j)=>i===j?1:j<i?null:cor(D[i],D[j])));for(let i=0;i<ok.length;i++)for(let j=0;j<i;j++)M[i][j]=M[j][i];
    let h='<div class="tablewrap" style="max-height:none"><table class="ctab cmpcor"><thead><tr><th></th>'+ok.map((x,j)=>'<th title="'+esc(K.name(x.F))+'"><i class="fndot" style="background:'+col(x.j)+'"></i>'+(x.j+1)+'</th>').join("")+'</tr></thead><tbody>'
      +ok.map((x,i)=>'<tr><td class="cmpn"><i class="fndot" style="background:'+col(x.j)+'"></i>'+(x.j+1)+'. '+esc(K.name(x.F).slice(0,32))+'</td>'+M[i].map((c,j)=>'<td data-l="'+(ok[j].x===undefined?(ok[j].j+1):(ok[j].j+1))+'">'+(c==null?'—':'<span class="fncor" style="--a:'+Math.abs(c).toFixed(2)+'">'+fx(c,2)+'</span>')+'</td>').join("")+'</tr>').join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem">Correlação dos retornos diários no período. Perto de 1: andam juntos; perto de 0: sem relação; negativo: movimentos opostos.</p>';
    return {html:h,csv:[[""].concat(ok.map(x=>K.name(x.F)))].concat(ok.map((x,i)=>[K.name(x.F)].concat(M[i].map(c=>c==null?"":c.toFixed(4)))))};
  }
  const cols=cmpCols(K,st),vals=rows.map(x=>({x,v:x.sem&&st.tab!=="info"&&st.tab!=="jan"?{}:cmpVals(K,st,x)}));
  const so=st.sort[st.tab];if(so){const [c,d]=so;vals.sort((a,b)=>{const p=a.v[c],q=b.v[c];if(p==null&&q==null)return 0;if(p==null)return 1;if(q==null)return -1;return typeof p==="string"?d*p.localeCompare(q):d*(p-q)})}
  let h='';if(st.tab==="jan")h+='<div class="fnrow">'+fnSeg("cmpjan",[["12","12 meses"],["24","24 meses"],["36","36 meses"]],String(st.jan))+'</div>';
  h+='<div class="tablewrap cmpwrap" style="max-height:none"><table class="ctab cmptab"><thead><tr><th class="cmpn" style="text-align:left">'+(K.kind==="f"?"Fundo":"Ativo")+'</th>'+cols.map(([l,c,,cl])=>'<th'+(cl?' class="'+cl+'"':'')+' data-cmpsort="'+K.kind+'|'+c+'">'+l+(so&&so[0]===c?(so[1]<0?' ▾':' ▴'):'')+'</th>').join("")+'</tr></thead><tbody>';
  vals.forEach(({x,v})=>{h+='<tr><td class="cmpn"><i class="fndot" style="background:'+col(x.j)+'"></i><button type="button" class="link" data-'+K.open+'="'+K.key(x.F)+'">'+esc(K.name(x.F).slice(0,52))+'</button></td>'+cols.map(([l,c,f,cl])=>'<td'+(cl?' class="'+cl+'"':'')+' data-l="'+esc(String(l).replace(/<[^>]+>/g,""))+'">'+(v[c]===undefined?'—':f(v[c]))+'</td>').join("")+'</tr>'});
  // índices de referência
  if(ref&&(st.tab==="ret"||st.tab==="jan"))bmRows.forEach(b=>{const o={};if(st.tab==="ret"){const a={t:ref.p0.t,i:fnCalIdx(ref.p0.t),k:ref.p0.k},z={t:ref.p1.t,i:fnCalIdx(ref.p1.t),k:ref.p1.k};o.r=fnBmRet(b,a,z);const cd=fnBmRet("cdi",a,z);o.pcdi=o.r!=null&&cd>0?o.r/cd*100:null;
      const l=fnLast(ref.F);[["mes","rm"],["ano","ra"],["12","r12"],["24","r24"],["36","r36"],["60","r60"]].forEach(([p,c])=>{const s=fnStart(ref.F,p);o[c]=s?fnBmRet(b,s,l):null})}
    else{const fake={MK:[],M:new Map()};const m=FN.L.m[b]||{};Object.keys(m).map(Number).sort((a,c)=>a-c).forEach(k=>{if(fnMt(k)<=ref.p1.t+5*DAY){fake.MK.push(k);fake.M.set(k,{q:m[k]})}});Object.assign(o,cmpJan(fake,st.jan,null))}
    h+='<tr class="cmpbm"><td class="cmpn"><i class="fndot" style="background:'+FN_BM[b].col+'"></i>'+FN_BM[b].lab+'</td>'+cols.map(([l,c,f,cl])=>'<td'+(cl?' class="'+cl+'"':'')+' data-l="'+esc(String(l).replace(/<[^>]+>/g,""))+'">'+(o[c]===undefined?'':f(o[c]))+'</td>').join("")+'</tr>'});
  h+='</tbody></table></div>';
  if(st.tab==="jan"){const S=[];rows.forEach(x=>{if(x.sem||st.hide[K.key(x.F)])return;S.push({lab:K.name(x.F).slice(0,30),col:col(x.j),w:1.6,pts:cmpJanSeries(x.F,st.jan).filter(p=>p[0]<=x.p1.t+5*DAY)})});
    const m=FN.L.m.cdi||{},cs=[];Object.keys(m).map(Number).sort((a,b)=>a-b).forEach(k=>{if(m[k-st.jan])cs.push([fnMt(k),(m[k]/m[k-st.jan]-1)*100])});const t0=Math.min(...S.flatMap(s=>s.pts.map(p=>p[0])));S.push({lab:"CDI",col:"var(--flat)",dash:"5 4",w:1.4,pts:cs.filter(p=>p[0]>=t0&&(!ref||p[0]<=ref.p1.t+5*DAY))});
    h='<div class="label" style="margin-top:6px">Retorno em janelas móveis de '+st.jan+' meses (fim de cada mês)</div>'+fnChart(S,{fmt:"pct",zero:true,noLegend:true,months:true,aria:"Janelas móveis"})+h+'<p class="sub" style="font-size:.8rem">Cada janela é o retorno acumulado em '+st.jan+' meses terminando no fim de cada mês, usando todo o histórico disponível de cada um. Mostra a consistência: em quantas janelas o investimento ganhou do CDI e o pior resultado para quem ficou '+st.jan+' meses.</p>'}
  if(st.tab==="risk")h+='<p class="sub" style="font-size:.8rem">No período escolhido, com retornos diários. Beta, alfa de Jensen e Treynor usam o Ibovespa como mercado e o CDI como taxa livre de risco; tracking error e information ratio medem a distância em relação ao CDI.</p>';
  if(st.tab==="info"&&K.kind==="f")h+=cmpGrossHtml(rows);
  const csv=[[K.kind==="f"?"Fundo":"Ativo",K.kind==="f"?"CNPJ":"Código"].concat(cols.map(c=>c[0]))].concat(vals.map(({x,v})=>[K.name(x.F),K.key(x.F)].concat(cols.map(c=>v[c[1]]==null?"":typeof v[c[1]]==="number"?String(+v[c[1]].toFixed(4)).replace(".",","):String(v[c[1]])))));
  return {html:h,csv};
}
function cmpGrossHtml(rows){
  const r=rows.filter(x=>!x.sem&&x.r!=null&&x.cdi>0);if(!r.length)return "";
  let h='<div class="label" style="margin-top:12px">Gross-up: rentabilidade líquida de IR no período</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Fundo</th><th>Bruto</th><th>% do CDI bruto</th><th>Líquido (IR 15%)</th><th>Isento equivalente</th></tr></thead><tbody>';
  r.forEach(x=>{const acoes=/a[cç][oõ]es/i.test(x.F.cls||"")||/a[cç][oõ]es/i.test(x.F.anb||""),ir=0.15,liq=x.r*(1-ir);h+='<tr><td style="text-align:left" class="tw"><small>'+esc((x.F.fan||x.F.n||"").slice(0,50))+'</small></td><td>'+fnPct(x.r)+'</td><td>'+fx(x.r/x.cdi*100,0)+'%</td><td>'+fnPct(liq)+'</td><td>'+fx(liq/x.cdi*100,0)+'% do CDI'+(acoes?' <small>(ações: 15% só no resgate)</small>':'')+'</td></tr>'});
  return h+'</tbody></table></div><p class="sub" style="font-size:.8rem">Para comparar com LCI, LCA, CRI, CRA ou debêntures incentivadas (isentos para pessoa física): o fundo rende, depois do IR de 15% (aplicações acima de 2 anos), o mesmo que um título isento pagando a coluna da direita. O come-cotas antecipa o IR em maio e novembro, mas a alíquota final é a mesma.</p>';
}
function cmpCsv(kind){
  const T=CMP_LAST[kind];if(!T||!T.csv||!T.csv.length)return;
  const txt="﻿"+T.csv.map(r=>r.map(c=>{c=String(c==null?"":c).replace(/<[^>]+>/g,"");return /[;"\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(";")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"text/csv;charset=utf-8"}));a.download=(kind==="f"?"comparacao-fundos":"comparacao-ativos")+"-"+new Date().toISOString().slice(0,10)+".csv";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
document.addEventListener("click",e=>{
  if(!(e.target.closest&&e.target.closest("#modFn")))return;const g=a=>e.target.closest("["+a+"]");let x;
  const kd=()=>activeMod==="fc"?"f":"a",re=k=>{cmpSave();cmpRender(k)};
  if((x=g("data-cmpper"))){const k=kd();CMPST[k].per=x.dataset.cmpper;re(k);return}
  if((x=g("data-cmptab"))){const k=kd();CMPST[k].tab=x.dataset.cmptab;re(k);return}
  if((x=g("data-cmpjan"))){const k=kd();CMPST[k].jan=+x.dataset.cmpjan;re(k);return}
  if((x=g("data-cmphide"))){const [k,key]=x.dataset.cmphide.split("|");CMPST[k].hide[key]=!CMPST[k].hide[key];cmpRender(k);return}
  if((x=g("data-cmpall"))){const k=x.dataset.cmpall;CMPST[k].hide={};cmpRender(k);return}
  if((x=g("data-cmpnone"))){const k=x.dataset.cmpnone,K=cmpK(k);K.list.forEach(key=>CMPST[k].hide[key]=true);cmpRender(k);return}
  if((x=g("data-cmprm"))){const [k,key]=x.dataset.cmprm.split("|"),K=cmpK(k),i=K.list.indexOf(key);if(i>=0)K.list.splice(i,1);K.save();cmpRender(k);return}
  if((x=g("data-cmpclear"))){const k=x.dataset.cmpclear,K=cmpK(k);K.list.splice(0,K.list.length);K.save();cmpRender(k);return}
  if((x=g("data-cmpcsv"))){cmpCsv(x.dataset.cmpcsv);return}
  if((x=g("data-cmpsort"))){const [k,c]=x.dataset.cmpsort.split("|"),st=CMPST[k],cur=st.sort[st.tab];st.sort[st.tab]=[c,cur&&cur[0]===c?-cur[1]:-1];re(k);return}
  if((x=g("data-cmpaddmany"))){const ks=x.dataset.cmpaddmany.split(",");let n=0;ks.forEach(k=>{if(!FN.cmp.includes(k)&&FN.cmp.length<CMP_MAX){FN.cmp.push(k);n++}});fnSave();alertLite(n+" fundo(s) adicionados ao comparador.");fnFa();return}
});
document.addEventListener("change",e=>{const t=e.target;if(!(t&&t.dataset))return;
  if(t.dataset.cmpsame){const k=t.dataset.cmpsame;CMPST[k].same=t.checked?1:0;cmpSave();cmpRender(k)}
  else if(t.dataset.cmpini){const k=t.dataset.cmpini;CMPST[k].ini=t.value;cmpSave();cmpRender(k)}
  else if(t.dataset.cmpfim){const k=t.dataset.cmpfim;CMPST[k].fim=t.value;cmpSave();cmpRender(k)}
  else if(t.dataset.fnjan){FN.jan=+t.value;fnRender()}
  else if(t.dataset.fngu!=null){FN.gu=t.value;fnRender()}
});

