function spCorHtml(it,R){
  const ret=R.irets;
  const cor=(a,b)=>{const xs=[],ys=[];a.forEach((v,j)=>{if(isFinite(v)&&isFinite(b[j])){xs.push(v);ys.push(b[j])}});if(xs.length<12)return null;const mx=xs.reduce((s,x)=>s+x,0)/xs.length,my=ys.reduce((s,x)=>s+x,0)/ys.length;let sxy=0,sxx=0,syy=0;for(let j=0;j<xs.length;j++){sxy+=(xs[j]-mx)*(ys[j]-my);sxx+=(xs[j]-mx)**2;syy+=(ys[j]-my)**2}return sxx&&syy?sxy/Math.sqrt(sxx*syy):null};
  let h='<div class="label" style="margin-top:12px">Correlação dos retornos '+(R.diaria?'diários':'mensais')+'</div><div class="tablewrap" style="max-height:none"><table class="ctab cmpcor"><thead><tr><th></th>'+it.map((x,j)=>'<th><i class="fndot" style="background:'+CMP_COLS[j%CMP_COLS.length]+'"></i>'+(j+1)+'</th>').join("")+'</tr></thead><tbody>';
  it.forEach((x,i)=>{h+='<tr><td class="cmpn">'+(i+1)+'. '+esc(spItemNome(x).slice(0,30))+'</td>'+it.map((y,j)=>{const c=i===j?1:cor(ret[i],ret[j]);return '<td data-l="'+(j+1)+'">'+(c==null?'—':'<span class="fncor" style="--a:'+Math.abs(c).toFixed(2)+'">'+fx(c,2)+'</span>')+'</td>'}).join("")+'</tr>'});
  return h+'</tbody></table></div>';
}
/* ----- retornos mensais (agrega a base diária) */
function spMensais(R){const mm=new Map();R.rets.forEach(x=>mm.set(x.m,(mm.get(x.m)||1)*(1+x.r)));return [...mm.values()].map(v=>v-1)}
function spMensaisItens(R){return R.irets.map(arr=>{const mm=new Map();arr.forEach((r,j)=>{const m=R.rets[j].m;mm.set(m,(mm.get(m)||1)*(1+r))});return [...mm.values()].map(v=>v-1)})}
/* ----- projeção (Monte Carlo com reamostragem dos meses do histórico simulado) */
function spProjHtml(c,R){
  const mr=spMensais(R);if(mr.length<24)return '<section class="panel"><h3>Projeção</h3><p class="sub">São necessários pelo menos 24 meses de histórico para projetar.</p></section>';
  const hz=Math.max(1,Math.min(40,+c.hz||10)),meta=num(String(c.meta||""))||null,N=2000,M=hz*12,ap=+c.aporte||0,v0=+c.valor||0;
  let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};
  const P=[[],[],[],[],[]],qs=[0.05,0.25,0.5,0.75,0.95],fins=[],vals=[];for(let s=0;s<N;s++)vals.push(new Float64Array(M+1));
  for(let s=0;s<N;s++){let v=v0;vals[s][0]=v;for(let m=1;m<=M;m++){v=v*(1+mr[Math.floor(rnd()*mr.length)])+ap;vals[s][m]=v}fins.push(v)}
  const hoje=Date.now(),tm=m=>hoje+m*30.44*DAY;
  for(let m=0;m<=M;m+=(M>120?2:1)){const col=vals.map(a=>a[m]).sort((a,b)=>a-b);qs.forEach((q,i)=>P[i].push([tm(m),col[Math.floor(q*(N-1))]]))}
  const invest=[];for(let m=0;m<=M;m+=(M>120?2:1))invest.push([tm(m),v0+ap*m]);
  fins.sort((a,b)=>a-b);const pm=meta?fins.filter(x=>x>=meta).length/N*100:null;
  const ipm=(()=>{const I=FN.L.m.ipca||{};const ks=Object.keys(I).map(Number).filter(k=>k>R.m0&&k<=R.m1&&I[k-1]);if(!ks.length)return 0;return ks.reduce((a,k)=>a+(I[k]/I[k-1]-1),0)/ks.length})(),def=Math.pow(1+ipm,M);
  let h='<section class="panel"><h3>Projeção</h3><p class="sub">'+N+' cenários sorteando os retornos mensais da própria carteira no período simulado ('+mr.length+' meses), a partir do valor inicial e do aporte informados.</p>';
  h+='<div class="spparams" style="grid-template-columns:repeat(3,1fr)"><div class="field"><label for="spHz">Horizonte</label><select id="spHz" data-spv="hz">'+[1,2,3,5,10,15,20,25,30].map(y=>'<option value="'+y+'"'+(y===hz?' selected':'')+'>'+y+(y>1?' anos':' ano')+'</option>').join("")+'</select></div><div class="field"><label for="spMeta">Meta de patrimônio</label><div class="affix s"><input id="spMeta" inputmode="decimal" data-spv="meta" value="'+(meta?fx(meta,2):'')+'" placeholder="opcional"><span class="suf">R$</span></div></div></div>';
  h+=fnChart([{lab:"Otimista (95%)",col:"var(--gain)",dash:"3 3",w:1.3,pts:P[4]},{lab:"Favorável (75%)",col:"var(--gain)",w:1.4,pts:P[3]},{lab:"Mediana",col:FN_COLS[0],w:2.4,pts:P[2]},{lab:"Desfavorável (25%)",col:"var(--loss)",w:1.4,pts:P[1]},{lab:"Pessimista (5%)",col:"var(--loss)",dash:"3 3",w:1.3,pts:P[0]},{lab:"Total investido",col:"var(--flat)",dash:"5 4",w:1.2,pts:invest}],{fmt:"money",aria:"Projeção"});
  const at=yy=>{const m=Math.min(M,yy*12),col=vals.map(a=>a[m]).sort((a,b)=>a-b);return qs.map(q=>col[Math.floor(q*(N-1))])};
  const marcos=[1,3,5,10,15,20,30].filter(y=>y<=hz);if(!marcos.includes(hz))marcos.push(hz);
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Em</th><th>Pessimista</th><th>Desfavorável</th><th>Mediana</th><th>Favorável</th><th>Otimista</th><th class="c-ph">Investido</th></tr></thead><tbody>';
  marcos.forEach(y=>{const v=at(y);h+='<tr><td style="text-align:left">'+y+(y>1?' anos':' ano')+'</td>'+v.map((x,i)=>'<td'+(i===2?' style="font-weight:700"':'')+'>'+fnMoney(x)+'</td>').join("")+'<td class="c-ph">'+fnMoney(v0+ap*y*12)+'</td></tr>'});
  h+='</tbody></table></div>';
  if(meta)h+='<p style="margin:8px 0"><b>Chance de atingir '+fnMoney(meta)+' em '+hz+(hz>1?' anos':' ano')+': '+fx(pm,0)+'%</b></p>';
  h+='<p class="sub" style="font-size:.8rem">Valores nominais e brutos de IR. Em valores de hoje, descontando a inflação média do período ('+fx(ipm*1200,1)+'% ao ano, aproximadamente), a mediana seria '+fnMoney(at(hz)[2]/def)+'. A projeção supõe que o futuro se pareça com o passado da carteira, o que pode não acontecer.</p></section>';
  return h;
}
/* ----- otimização: carteiras sorteadas e fronteira eficiente (média e variância dos retornos mensais) */
function spOtimHtml(c,it,R){
  if(it.length<2)return "";const X=spMensaisItens(R),n=X.length,T=X[0].length;if(T<24)return "";
  const mu=X.map(a=>a.reduce((s,x)=>s+x,0)/T),cov=X.map((a,i)=>X.map((b,j)=>{let s=0;for(let t=0;t<T;t++)s+=(a[t]-mu[i])*(b[t]-mu[j]);return s/(T-1)}));
  const cdiM=(()=>{const cl=spCdiLv(R),c0=cl(R.k0),c1=cl(R.last);return c0&&c1?Math.pow(c1/c0,1/Math.max(1,T))-1:0})();
  const ev=w=>{let m=0,v=0;for(let i=0;i<n;i++){m+=w[i]*mu[i];for(let j=0;j<n;j++)v+=w[i]*w[j]*cov[i][j]}const ra=Math.pow(1+m,12)-1,va=Math.sqrt(Math.max(0,v))*Math.sqrt(12);return {r:ra*100,v:va*100,s:va>1e-6?(ra-(Math.pow(1+cdiM,12)-1))/va:null,w}};
  const mx=Math.max(1/n,(+c.omax||100)/100);let seed=777;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};
  const pts=[];for(let s=0;s<6000&&pts.length<3000;s++){const g=X.map(()=>-Math.log(1-rnd()+1e-12)*(rnd()<0.3?3:1));const sg=g.reduce((a,x)=>a+x,0);const w=g.map(x=>x/sg);if(w.some(x=>x>mx+1e-9))continue;pts.push(ev(w))}
  for(let i=0;i<n;i++){if(mx>=1){const w=X.map((_,j)=>j===i?1:0);pts.push(ev(w))}}
  if(!pts.length)return "";
  const atual=ev(R.w),minV=pts.reduce((a,b)=>b.v<a.v?b:a),maxS=pts.filter(p=>p.s!=null).reduce((a,b)=>b.s>a.s?b:a,pts[0]);
  SP.otim={minV,maxS};
  const NW=window.innerWidth<640,W=NW?420:chartW(),H=NW?300:chartH(260,W),PL=46,PR=12,PT=12,PB=30;const vs=pts.map(p=>p.v),rs=pts.map(p=>p.r);
  const v0=Math.min(...vs,atual.v)*0.95,v1=Math.max(...vs,atual.v)*1.05,r0=Math.min(...rs,atual.r)-0.5,r1=Math.max(...rs,atual.r)+0.5;
  const Xp=v=>PL+(v-v0)/(v1-v0||1)*(W-PL-PR),Yp=r=>PT+(r1-r)/(r1-r0||1)*(H-PT-PB);
  let g='';const st=niceStep((r1-r0)/5);for(let r=Math.ceil(r0/st)*st;r<=r1;r+=st)g+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+Yp(r).toFixed(1)+'" y2="'+Yp(r).toFixed(1)+'" stroke="var(--line)" stroke-dasharray="2 4"/><text x="'+(PL-6)+'" y="'+(Yp(r)+4).toFixed(1)+'" text-anchor="end">'+fx(r,st<1?1:0)+'%</text>';
  const sx=niceStep((v1-v0)/5);for(let v=Math.ceil(v0/sx)*sx;v<=v1;v+=sx)g+='<text x="'+Xp(v).toFixed(1)+'" y="'+(H-PB+16)+'" text-anchor="middle">'+fx(v,sx<1?1:0)+'%</text>';
  pts.forEach(p=>{g+='<circle cx="'+Xp(p.v).toFixed(1)+'" cy="'+Yp(p.r).toFixed(1)+'" r="1.8" fill="var(--accent)" opacity=".25"/>'});
  const mk=(p,col,lab)=>'<circle cx="'+Xp(p.v).toFixed(1)+'" cy="'+Yp(p.r).toFixed(1)+'" r="6" fill="'+col+'" stroke="var(--surface)" stroke-width="2"><title>'+lab+'</title></circle>';
  g+=mk(minV,"var(--s4)","Mínima volatilidade")+mk(maxS,"var(--gold)","Máximo Sharpe")+mk(atual,"var(--loss)","Carteira atual");
  g+='<text x="'+(W-PR)+'" y="'+(H-4)+'" text-anchor="end">volatilidade ao ano</text>';
  let h='<section class="panel"><h3>Otimização da carteira</h3><p class="sub">Cada ponto é uma combinação de pesos dos mesmos itens, com o retorno e a volatilidade que teria tido no período simulado. A borda de cima é a fronteira eficiente: o maior retorno para cada nível de risco.</p>';
  h+='<div class="fnrow"><label class="sub" style="display:flex;gap:8px;align-items:center">Peso máximo por item <select data-spv="omax">'+[100,50,40,30,25,20].map(x=>'<option value="'+x+'"'+(x===(+c.omax||100)?' selected':'')+'>'+x+'%</option>').join("")+'</select></label></div>';
  h+='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Fronteira eficiente">'+g+'</svg><div class="legend"><span><i style="background:var(--loss)"></i>Carteira atual</span><span><i style="background:var(--s4)"></i>Mínima volatilidade</span><span><i style="background:var(--gold)"></i>Máximo Sharpe</span></div>';
  h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th>Atual</th><th>Mínima volatilidade</th><th>Máximo Sharpe</th></tr></thead><tbody>';
  it.forEach((x,i)=>{h+='<tr><td style="text-align:left" class="tw"><small>'+esc(spItemNome(x).slice(0,50))+'</small></td><td>'+fx(R.w[i]*100,1)+'%</td><td>'+fx(minV.w[i]*100,1)+'%</td><td>'+fx(maxS.w[i]*100,1)+'%</td></tr>'});
  const lin=(lab,f)=>'<tr class="cmpbm"><td style="text-align:left">'+lab+'</td>'+[atual,minV,maxS].map(p=>'<td>'+f(p)+'</td>').join("")+'</tr>';
  h+=lin("Retorno ao ano",p=>fnPctT(p.r))+lin("Volatilidade ao ano",p=>fx(p.v,2)+'%')+lin("Sharpe",p=>p.s!=null?fx(p.s,2):'—')+'</tbody></table></div>';
  h+='<div class="spbtns" style="margin-top:8px"><button type="button" class="btn sec" data-spotim="minV">Usar os pesos de mínima volatilidade</button><button type="button" class="btn sec" data-spotim="maxS">Usar os pesos de máximo Sharpe</button></div>';
  return h+'<p class="sub" style="font-size:.8rem">Calculado com os retornos mensais do período simulado. Pesos ótimos no passado mudam com o tempo e costumam concentrar a carteira: use como referência, não como recomendação.</p></section>';
}
/* comparação entre as carteiras salvas */
let SP_CMP=null;
function spCmpCartsHtml(){
  const n=SP.carts.filter(x=>!SP.fcli||(SP.fcli==="__sem"?!x.cli:x.cli===SP.fcli)).length;if(n<2)return "";
  return '<section class="panel" data-reltit="Comparação entre as carteiras"><h3>Comparar carteiras</h3><p class="sub">'+(SP.fcli&&SP.fcli!=="__sem"?'As carteiras do cliente '+esc(SP.fcli):'Todas as carteiras salvas')+', no período em comum.</p><div id="spCmpBox">'+(SP_CMP||'<button type="button" class="btn sec" data-spcmp="1">Comparar as '+n+' carteiras</button>')+'</div></section>';
}
async function spCmpCarts(){
  const box=$("spCmpBox");if(!box)return;box.innerHTML='<p class="sub">Calculando…</p>';
  const res=[];for(const c of SP.carts.filter(x=>!SP.fcli||(SP.fcli==="__sem"?!x.cli:x.cli===SP.fcli))){const it=c.itens.filter(x=>(+x.w||0)>0);if(!it.length)continue;try{const D=await Promise.all(it.map(spItemData));res.push({c,it,D})}catch(e){}}
  if(res.length<2){box.innerHTML='<p class="sub">É preciso ter pelo menos 2 carteiras com itens.</p>';return}
  const first=r=>Math.max(...r.D.map(x=>Math.min(...x.m.keys())));const k0=Math.max(...res.map(first));
  const out=res.map(r=>Object.assign(r,{R:spSim(Object.assign({},r.c,{ini:mname2(k0),fim:"",aporte:0,base:"m",ir:0}),r.it,r.D)}));
  const ok=out.filter(r=>!r.R.erro);if(ok.length<2){box.innerHTML='<p class="sub">Não há período em comum entre as carteiras.</p>';return}const last=Math.min(...ok.map(r=>r.R.last));
  let h=fnUse(FN,()=>{const S=ok.map((r,j)=>({lab:r.c.nome,col:CMP_COLS[j%CMP_COLS.length],w:2,pts:r.R.pts.filter(p=>p.k<=last).map(p=>[p.t,(p.idx-1)*100])}));
    let x=fnChart(S,{fmt:"pct",zero:true,months:true,aria:"Carteiras"});
    x+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Carteira</th><th>Retorno</th><th>% do CDI</th><th>Ao ano</th><th>Volatilidade</th><th>Sharpe</th><th>Perda máxima</th><th class="c-ph">Meses acima do CDI</th></tr></thead><tbody>';
    ok.forEach((r,j)=>{const rr=r.R.rets.filter(q=>q.k<=last),idx=rr.reduce((a,q)=>a*(1+q.r),1),s=spStats(r.R,rr,idx);x+='<tr><td style="text-align:left"><i class="fndot" style="background:'+CMP_COLS[j%CMP_COLS.length]+'"></i>'+esc(r.c.nome)+'</td><td><b>'+fnPct(s.tot)+'</b></td><td>'+(s.pcdi!=null?fx(s.pcdi,0)+'%':'—')+'</td><td>'+fnPctT(s.ann)+'</td><td>'+fx(s.vol,2)+'%</td><td>'+(s.sharpe!=null?fx(s.sharpe,2):'—')+'</td><td>'+fnPct(s.dd)+'</td><td class="c-ph">'+(s.acima!=null?fx(s.acima,0)+'%':'—')+'</td></tr>'});
    return x+'</tbody></table></div><p class="sub" style="font-size:.8rem">De '+mname(ok[0].R.k0)+' a '+mname(last)+', base mensal, sem aportes e sem IR.</p>'});
  SP_CMP=h;box.innerHTML=h;
}
const mname2=k=>Math.floor((k+1)/12)+"-"+String((k+1)%12+1).padStart(2,"0");
function spCsv(){
  const L=SP.last;if(!L||L.R.erro)return;const R=L.R,lbl=k=>R.diaria?k:mname(k);const rows=[["Data","Patrimônio bruto","Patrimônio líquido de IR","Investido","Rentabilidade acumulada (%)"].concat(L.bms.map(b=>b[1]+" acumulado (%)"))];
  const f=v=>v==null?"":(+v).toFixed(4).replace(".",",");
  R.pts.forEach(p=>rows.push([lbl(p.k),f(p.v),f(p.liq),f(p.inv),f((p.idx-1)*100)].concat(L.bms.map(b=>{const a=b[2].get(R.k0),z=b[2].get(p.k);return a&&z?f((z/a-1)*100):""}))));
  rows.push([]);rows.push(["Item","Peso-alvo (%)","Retorno no período (%)","Contribuição (p.p.)","Tributação"]);L.it.forEach((x,i)=>rows.push([spItemNome(x),f(R.w[i]*100),f(R.per[i]),f(R.contrib[i]),SP_IR[R.reg[i]]||""]));
  cmpCsvRows(rows,"carteira-"+(L.c.nome||"simulada").replace(/[^\w-]+/g,"-").toLowerCase());
}
function cmpCsvRows(rows,nome){const txt="﻿"+rows.map(r=>r.map(c=>{c=String(c==null?"":c);return /[;"\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(";")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"text/csv;charset=utf-8"}));a.download=nome+"-"+new Date().toISOString().slice(0,10)+".csv";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
/* guarda as séries para a correlação */
async function spRun(){return spRunCore()}

/* ----- eventos */
function spSearch(q){
  const out=[];if(q.trim().length<2)return out;
  if(AT.idx)atSearch(q,6).forEach(j=>{const r=AT.idx.rows[j];out.push({t:"a",k:r[0],n:r[0]+" · "+r[1],tipo:r[AT.C.tipo],s:'R$ '+fx(r[AT.C.preco],2)+' · 12m '+fnPctT(r[AT.C.r12])})});
  if(FN.idx)fnSearch(q,8).forEach(j=>{const r=FN.idx.rows[j];out.push({t:"f",k:r[0],n:r[1],tipo:"Fundo · "+(FN.idx.classes[r[FN.C.classe]]||""),s:fnCnpjF(r[0])+' · 12m '+fnPctT(r[FN.C.r12])})});
  spCredSearch(q).forEach(x=>out.push(x));
  return out;
}
function spAdd(item){const c=spC();if(c.itens.length>=CMP_MAX){alertLite("A carteira aceita até "+CMP_MAX+" itens.");return}if(c.itens.some(x=>x.t===item.t&&x.k===item.k))return;
  const n=c.itens.length+1;c.itens.forEach(x=>x.w=Math.round(+x.w*(n-1)/n*10)/10);item.w=Math.round((100-c.itens.reduce((a,x)=>a+(+x.w||0),0))*10)/10;c.itens.push(item);SP_CMP=null;spSave();spCalc()}
document.addEventListener("click",e=>{
  if(!(e.target.closest&&e.target.closest("#modFn"))||activeMod!=="sp")return;const g=a=>e.target.closest("["+a+"]");let x;const c=spC();
  if((x=g("data-spadd"))){const d=JSON.parse(x.dataset.spadd);spAdd(d);return}
  if((x=g("data-sprm"))){c.itens.splice(+x.dataset.sprm,1);SP_CMP=null;spSave();spCalc();return}
  if((x=g("data-speq"))){const n=c.itens.length;c.itens.forEach((it,j)=>it.w=Math.round(100/n*10)/10);const d=100-c.itens.reduce((a,it)=>a+it.w,0);if(n)c.itens[0].w=Math.round((c.itens[0].w+d)*10)/10;spSave();spCalc();return}
  if((x=g("data-spnorm"))){const t=c.itens.reduce((a,it)=>a+(+it.w||0),0);if(t>0)c.itens.forEach(it=>it.w=Math.round(it.w/t*1000)/10);spSave();spCalc();return}
  if((x=g("data-spclear"))){c.itens=[];spSave();spCalc();return}
  if((x=g("data-spnew"))){const cli=SP.fcli&&SP.fcli!=="__sem"?SP.fcli:"";SP.carts.push(spNova(cli?"Proposta "+(SP.carts.filter(y=>y.cli===cli).length+1):"Carteira "+(SP.carts.length+1),cli));SP.efForm=false;SP.cur=SP.carts.length-1;SP_CMP=null;spSave();spCalc();return}
  if((x=g("data-spdup"))){const d=JSON.parse(JSON.stringify(c));d.nome=c.nome+" (cópia)";d.id=null;d.sit="proposta";delete d.ef;d.criada=spHoje();d.ver=1;SP.carts.push(d);SP.cur=SP.carts.length-1;SP_CMP=null;spSave();spCalc();return}
  if((x=g("data-spdel"))){if(SP.carts.length<2)return;if(!confirmLite(x))return;SP.carts.splice(SP.cur,1);SP.cur=Math.max(0,SP.cur-1);SP_CMP=null;spSave();spCalc();return}
  if((x=g("data-sprfadd"))){const v=num(SP.rf.taxa);if(v==null){alertLite("Informe a taxa da renda fixa.");return}spAdd({t:"s",k:SP.rf.tipo+":"+v,rf:SP.rf.tipo,x:v,n:SP.rf.tipo==="cdi"?fx(v,1)+"% do CDI":SP.rf.tipo==="cdimais"?"CDI + "+fx(v,2)+"% a.a.":SP.rf.tipo==="ipca"?"IPCA + "+fx(v,2)+"% a.a.":"Prefixado "+fx(v,2)+"% a.a.",tipo:"Renda fixa"});return}
  if((x=g("data-spcmp"))){spCmpCarts();return}
  if((x=g("data-spver"))){const d=JSON.parse(JSON.stringify(c));d.id=null;d.sit="proposta";delete d.ef;d.criada=spHoje();d.ver=(+c.ver||1)+1;d.nome=String(c.nome).replace(/\s*\(v\d+\)$/,"")+" (v"+d.ver+")";SP.carts.push(d);SP.cur=SP.carts.length-1;SP_CMP=null;spSave();spCalc();return}
  if((x=g("data-spgo"))){SP.cur=+x.dataset.spgo;SP.efForm=false;SP_CMP=null;spSave();spCalc();try{$("spTop").scrollIntoView({behavior:"smooth"})}catch(y){}return}
  if((x=g("data-spefform"))){SP.efForm=true;spTopHtml();return}
  if((x=g("data-spefno"))){SP.efForm=false;spTopHtml();return}
  if((x=g("data-spefok"))){const d=$("spEfD").value,v=num($("spEfV").value);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>spHoje()){$("spEfD").focus();return}if(v==null||v<=0){$("spEfV").focus();return}
    c.sit="efetivada";c.ef={data:d,valor:v};{const tot=c.itens.reduce((a,y)=>a+(+y.w||0),0)||1;c.itens.forEach(y=>{if(!(y.mov&&y.mov.length)&&(+y.w||0)>0)y.mov=[{d,v:Math.round(v*(+y.w)/tot*100)/100}]})}SP.efForm=false;SP_CMP=null;spSave();spCalc();return}
  if((x=g("data-spdesef"))){c.sit="proposta";delete c.ef;spSave();spCalc();return}
  if((x=g("data-spotim"))){const o=SP.otim&&SP.otim[x.dataset.spotim];if(!o)return;const at=c.itens.filter(y=>(+y.w||0)>0);at.forEach((y,i)=>y.w=Math.round(o.w[i]*1000)/10);const d=100-c.itens.reduce((a,y)=>a+(+y.w||0),0);if(at.length)at[0].w=Math.round((at[0].w+d)*10)/10;SP_CMP=null;spSave();spCalc();try{$("spTop").scrollIntoView({behavior:"smooth"})}catch(y){}return}
  if((x=g("data-spcsv"))){spCsv();return}
  if((x=g("data-spretry"))){FN.err=null;AT.err=null;spCalc();return}
});
function confirmLite(btn){if(btn.dataset.ok==="1")return true;btn.dataset.ok="1";btn.textContent="Confirmar exclusão";setTimeout(()=>{btn.dataset.ok="";btn.textContent="Excluir"},4000);return false}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||activeMod!=="sp")return;const c=spC();
  if(t.dataset.spsel){SP.cur=+t.value;SP.efForm=false;SP_CMP=null;spSave();spCalc()}
  else if(t.dataset.spclif!=null&&t.id==="spCliF"){SP.fcli=t.value;const j=SP.carts.findIndex(x=>!SP.fcli||(SP.fcli==="__sem"?!x.cli:x.cli===SP.fcli));if(j>=0&&!(!SP.fcli||(SP.fcli==="__sem"?!spC().cli:spC().cli===SP.fcli)))SP.cur=j;SP_CMP=null;spSave();spCalc()}
  else if(t.dataset.spcli!=null&&t.id==="spCliI"){c.cli=t.value.trim().slice(0,40);spSave();spTopHtml()}
  else if(t.dataset.spobs!=null&&t.id==="spObs"){c.obs=t.value.slice(0,2000);spSave()}
  else if(t.dataset.spnome!=null&&t.dataset.spnome!==undefined&&t.id==="spNome"){c.nome=t.value.trim()||c.nome;SP_CMP=null;spSave();spCalc()}
  else if(t.dataset.spw!=null){const v=num(t.value);c.itens[+t.dataset.spw].w=v==null?0:Math.max(0,v);SP_CMP=null;spSave();spCalc()}
  else if(t.dataset.spv){const k=t.dataset.spv;c[k]=k==="valor"||k==="aporte"?(num(t.value)||0):t.value;SP_CMP=null;spSave();spCalc()}
  else if(t.dataset.spir){c.ir=t.checked?1:0;spSave();spCalc()}
  else if(t.dataset.spiso!=null&&t.dataset.spiso!==undefined&&t.type==="checkbox"){const it=c.itens[+t.dataset.spiso];if(it){it.isento=t.checked?1:0;spSave();spCalc()}}
  else if(t.dataset.spbm){c.bm=c.bm||{};c.bm[t.dataset.spbm]=t.checked?1:0;spSave();spCalc()}
  else if(t.dataset.sprft){SP.rf.tipo=t.value;spTopHtml()}
  else if(t.dataset.sprfe!=null||t.dataset.sprfv!=null){const j=+(t.dataset.sprfe!=null?t.dataset.sprfe:t.dataset.sprfv),it=c.itens[j];if(!it||it.t!=="s")return;
    if(t.dataset.sprfe!=null)it.rf=t.value;else{const v=num(t.value);if(v==null)return;it.x=v}
    const base=String(it.n||"").replace(/\s*\((estimado: )?[^()]*\)\s*$/,"").trim(),lab=spRfLab(it.rf,+it.x||0);
    it.n=base&&!/^(\d|CDI|IPCA|Prefixado)/.test(base)?base+" ("+lab+")":lab;it.k=it.rf+":"+it.x+":"+j;delete it.est;SP_CMP=null;spSave();spCalc()}
  else if(t.dataset.sprfx){SP.rf.taxa=t.value}
});
let SP_QT=null;
document.addEventListener("input",e=>{const t=e.target;if(!t||t.id!=="spQ")return;const box=$("spRes2");clearTimeout(SP_QT);SP_QT=setTimeout(()=>{const L=spSearch(t.value);if(t.value.trim().length<2){box.hidden=true;return}
  box.innerHTML=L.length?L.map(x=>'<button type="button" class="fnri" data-spadd=\''+JSON.stringify({t:x.t,k:x.k,n:x.n.slice(0,80),tipo:x.tipo,rf:x.rf,x:x.x,isento:x.isento}).replace(/'/g,"&#39;")+'\'><b>'+esc(x.n)+'</b><small>'+esc(x.tipo)+' · '+x.s+'</small></button>').join(""):'<div class="fnri"><small>Nada encontrado.</small></div>';box.hidden=false},120)});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target&&e.target.dataset&&e.target.dataset.sprfx!=null){e.preventDefault();SP.rf.taxa=e.target.value;const b=document.querySelector("[data-sprfadd]");if(b)b.click()}});

/* ----- debêntures, CRI e CRA no simulador: entram como renda fixa pela taxa indicativa atual da ANBIMA */
const SP_CRED={L:null,load:null};
function spCredLoad(){if(SP_CRED.L||SP_CRED.load)return;const g=f=>fetch(ROBO+f,{cache:"no-cache"}).then(r=>r.ok?r.json():null).catch(()=>null);
  SP_CRED.load=Promise.all([g("debentures.json"),g("cri_cra_anbima.json")]).then(([d,c])=>{const L=[];
    [[d,"Debênture"],[c,"CRI/CRA"]].forEach(([j,tipo])=>{if(!j||!j.papers)return;Object.entries(j.papers).forEach(([cod,p])=>{const ind=String(p.indice||""),tx=p.taxa;if(tx==null||!isFinite(tx))return;
      let rf=null;if(/^DI\s*\+/i.test(ind))rf="cdimais";else if(/%\s*do\s*DI/i.test(ind))rf="cdi";else if(/^IPCA/i.test(ind))rf="ipca";else if(/PREFIXADO/i.test(ind))rf="pre";if(!rf)return;
      const nome=String(p.nome||p.risco||p.emissor||"").replace(/\s*\(\*\)\s*/,"").trim(),inc=/\(\*\)/.test(String(p.nome||""));
      L.push({cod,nome,tipo,rf,x:+tx,ind,venc:p.venc,isento:tipo==="CRI/CRA"||inc?1:0,ref:j.refDate,sk:fnNorm(cod+" "+nome+" "+(p.emissor||""))})})});
    SP_CRED.L=L;SP_CRED.load=null;const q=$("spQ");if(q&&q.value.trim().length>=2)q.dispatchEvent(new Event("input",{bubbles:true}))})}
function spCredSearch(q){if(!SP_CRED.L){spCredLoad();return []}const t=fnNorm(q).split(/\s+/).filter(Boolean);if(!t.length||q.trim().length<3)return [];
  return SP_CRED.L.filter(x=>t.every(w=>x.sk.includes(w))).slice(0,6).map(x=>{const lab=spRfLab(x.rf,x.x);return {t:"s",k:"cr:"+x.cod,rf:x.rf,x:x.x,isento:x.isento,n:x.cod+" · "+x.nome.slice(0,40)+" ("+lab+")",tipo:x.tipo,
    s:x.ind+" · taxa ANBIMA "+lab+" · vence "+fdate(Date.parse(x.venc+"T00:00:00Z"))+(x.isento?" · isento de IR":"")}})}

/* ----- propostas: desempenho desde a efetivação, composição, itens e fichas */
function spEfHtml(c,it,E,stP){
  const dt=fdate(Date.parse(c.ef.data+"T00:00:00Z"));
  if(!E||E.erro||!E.pts||E.pts.length<2)return '<section class="panel" data-reltit="Desde a efetivação"><h3>Desde a efetivação ('+dt+')</h3><p class="sub">Ainda não há cotas publicadas depois da data de aplicação. O acompanhamento aparece assim que os dados do próximo dia útil chegarem.</p></section>';
  const last=E.pts[E.pts.length-1],st=spStats(E,E.rets,last.idx),dias=Math.max(1,(last.t-E.pts[0].t)/DAY),esp=stP&&stP.ann!=null?(Math.pow(1+stP.ann/100,dias/365)-1)*100:null;
  const kp=(a,b,cc)=>'<div class="fnkp"><span>'+a+'</span><b>'+b+'</b>'+(cc?'<small>'+cc+'</small>':'')+'</div>',lbl=k=>E.diaria?fdate(Date.parse(k+"T00:00:00Z")):mname(k);
  let h='<section class="panel" data-reltit="Desde a efetivação"><h3>Desde a efetivação ('+dt+')</h3><p class="sub">Desempenho real dos itens e pesos desta carteira desde a aplicação, até '+lbl(E.last)+', com rebalanceamento '+SP_REB.find(x=>x[0]===String(c.reb))[1].toLowerCase()+'. <button type="button" class="link" data-spmovgen="1">Detalhar as aplicações de cada item</button> para informar datas e valores reais.</p>';
  h+='<div class="fnkpis">'+kp("Valor aplicado",brl(+c.ef.valor),dt)+kp("Valor hoje",brl(last.v),E.ir?"líquido de IR "+brl(last.liq):"")+kp("Retorno desde a aplicação",fnPct(st.tot),st.pcdi!=null&&st.tot>0?fx(st.pcdi,0)+"% do CDI":(()=>{const cl=spCdiLv(E),a=cl(E.k0),z=cl(E.last);return a&&z?"CDI no período "+fnPctT((z/a-1)*100):""})())+kp("Esperado pelo histórico",esp!=null?fnPctT(esp):"—","retorno anual da proposta ("+fnPctT(stP.ann)+") no mesmo prazo")+kp("Diferença",esp!=null?fnPct(st.tot-esp)+" <small>p.p.</small>":"—","realizado − esperado")+'</div>';
  const S=[{lab:"Carteira",col:FN_COLS[0],w:2.4,pts:E.pts.map(p=>[p.t,(p.idx-1)*100])}],cdi=E.diaria?spBmDaily("cdi",c):spBmSeries("cdi",c);
  if(cdi&&cdi.get(E.k0)){const b0=cdi.get(E.k0);S.push({lab:"CDI",col:FN_BM.cdi.col,dash:"5 4",w:1.5,pts:E.pts.map(p=>{const v=cdi.get(p.k);return [p.t,v?(v/b0-1)*100:null]})})}
  h+=fnChart(S,{fmt:"pct",zero:true,months:!E.diaria,aria:"Desde a efetivação"});
  h+='<div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th>Peso-alvo</th><th>Retorno desde a aplicação</th><th>Contribuição</th></tr></thead><tbody>'+it.map((x,i)=>'<tr><td style="text-align:left" class="tw"><i class="fndot" style="background:'+CMP_COLS[c.itens.indexOf(x)%CMP_COLS.length]+'"></i>'+esc(spItemNome(x))+'</td><td>'+fx(E.w[i]*100,1)+'%</td><td>'+fnPct(E.per[i])+'</td><td>'+fnPct(E.contrib[i])+' <small>p.p.</small></td></tr>').join("")+'</tbody></table></div>';
  return h+'<p class="sub" style="font-size:.8rem">Valores calculados com as cotas e cotações oficiais a partir da data informada, sem custos de corretagem. Não substitui o extrato da instituição.</p></section>';
}
