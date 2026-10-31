/* ===== Posição real da carteira: aplicações e resgates de cada item, rentabilidade por cotas (TWR) e TIR,
   líquida de IR (estimativa) e real (acima do IPCA), comparada ao CDI e à proposta ===== */
const spTemMov=c=>c.itens.some(x=>Array.isArray(x.mov)&&x.mov.length);
const spMovOk=m=>m&&/^\d{4}-\d{2}-\d{2}$/.test(m.d)&&isFinite(+m.v)&&+m.v!==0;
function spMovBtn(it,j){const n=(it.mov||[]).filter(spMovOk).length;return '<button type="button" class="link spmovb" data-spmov="'+j+'">'+(n?'Aplicações ('+n+')':'+ Informar aplicações')+'</button>'}
function spMovRow(c,j){
  const it=c.itens[j],L=(it.mov||[]).map((m,i)=>[m,i]).filter(([m])=>spMovOk(m)).sort((a,b)=>a[0].d.localeCompare(b[0].d)),hoje=new Date().toISOString().slice(0,10);
  let h='<tr class="spmovrow"><td colspan="5" style="text-align:left"><div class="spmov"><div class="label">Aplicações e resgates · '+esc(spItemNome(it))+'</div>';
  h+=L.length?'<table class="ctab"><thead><tr><th style="text-align:left">Data</th><th style="text-align:left">Movimento</th><th>Valor</th><th></th></tr></thead><tbody>'+L.map(([m,i])=>'<tr><td style="text-align:left">'+fdate(Date.parse(m.d+"T00:00:00Z"))+'</td><td style="text-align:left">'+(+m.v>0?'Aplicação':'Resgate')+'</td><td>'+brl(Math.abs(+m.v))+'</td><td><button type="button" class="fnx" data-spmovdel="'+j+'|'+i+'" aria-label="Apagar">×</button></td></tr>').join("")+'</tbody></table>':'<p class="sub" style="margin:4px 0">Nenhuma aplicação informada para este item.</p>';
  h+='<div class="sprow"><div class="field"><label for="spMovD">Data</label><input id="spMovD" type="date" max="'+hoje+'" value="'+(c.ef&&c.ef.data||hoje)+'"></div><div class="field"><label for="spMovT">Movimento</label><select id="spMovT"><option value="1">Aplicação</option><option value="-1">Resgate</option></select></div><div class="field"><label for="spMovV">Valor</label><div class="affix s"><input id="spMovV" inputmode="decimal" placeholder="ex.: 50.000,00"><span class="suf">R$</span></div></div><div class="field" style="align-self:end"><div class="spbtns" style="margin:0"><button type="button" class="btn" data-spmovadd="'+j+'">Incluir</button><button type="button" class="btn sec" data-spmov="'+j+'">Fechar</button></div></div></div>';
  h+='<p class="sub" style="font-size:.78rem;margin:4px 0 0">Informe o valor aplicado ou resgatado na data (bruto). O app calcula as cotas pela cota oficial do dia (fundos), pela cotação de fechamento (Bolsa e Tesouro) ou pela taxa informada (renda fixa).</p></div></td></tr>';
  return h;
}
/* série de níveis de um item: mensal antes do diário + diário, como [[data,valor],...] em ordem */
function spSerie(D){
  const day=[...D.d.entries()].filter(([k,v])=>v>0).sort((a,b)=>a[0]<b[0]?-1:1),d0=day.length?day[0][0]:"9999";
  const mon=[...D.m.entries()].map(([k,v])=>[new Date(fnMt(k)).toISOString().slice(0,10),v]).filter(([k,v])=>v>0&&k<d0).sort((a,b)=>a[0]<b[0]?-1:1);
  return mon.concat(day);
}
function spAt(S,d){let lo=0,hi=S.length-1,r=null;while(lo<=hi){const m=(lo+hi)>>1;if(S[m][0]<=d){r=S[m];lo=m+1}else hi=m-1}return r}
function spXirr(cf){ // cf: [[data,valor]] (aplicação negativa, resgate e valor final positivos) -> taxa ao ano
  if(cf.length<2||!cf.some(x=>x[1]<0)||!cf.some(x=>x[1]>0))return null;const t0=Date.parse(cf[0][0]+"T00:00:00Z");
  const f=r=>cf.reduce((a,[d,v])=>a+v/Math.pow(1+r,(Date.parse(d+"T00:00:00Z")-t0)/(365*DAY)),0);
  let lo=-0.99,hi=10,flo=f(lo),fhi=f(hi);if(!isFinite(flo)||!isFinite(fhi)||flo*fhi>0)return null;
  for(let i=0;i<200;i++){const m=(lo+hi)/2,fm=f(m);if(Math.abs(fm)<1e-7)return m;if(flo*fm<0){hi=m}else{lo=m;flo=fm}}return (lo+hi)/2;
}
function spAliq(reg,dias){if(reg==="lp"||reg==="rf")return dias<=180?0.225:dias<=360?0.2:dias<=720?0.175:0.15;if(reg==="cp")return dias<=180?0.225:0.2;if(reg==="acoes")return 0.15;if(reg==="fii")return 0.2;return 0}
function spPosCalc(c,its,Ds){
  const L=FN.L,cdiS=(()=>{const a=[];FN.cal.forEach((d,i)=>{if(L.d.cdi&&L.d.cdi[i])a.push([d,L.d.cdi[i]])});const d0=a.length?a[0][0]:"9999",m=Object.keys(L.m.cdi||{}).map(Number).map(k=>[new Date(fnMt(k)).toISOString().slice(0,10),L.m.cdi[k]]).filter(x=>x[0]<d0);return m.concat(a)})();
  const ipS=(()=>{const a=[];FN.cal.forEach((d,i)=>{if(L.d.ipca&&L.d.ipca[i])a.push([d,L.d.ipca[i]])});const d0=a.length?a[0][0]:"9999",m=Object.keys(L.m.ipca||{}).map(Number).map(k=>[new Date(fnMt(k)).toISOString().slice(0,10),L.m.ipca[k]]).filter(x=>x[0]<d0);return m.concat(a)})();
  const P=[];its.forEach((x,i)=>{const mv=(x.mov||[]).filter(spMovOk).map(m=>({d:m.d,v:+m.v})).sort((a,b)=>a.d<b.d?-1:1);if(!mv.length)return;const S=spSerie(Ds[i]);mv.forEach(m=>{const a=spAt(S,m.d);m.ed=a?a[0]:null});P.push({x,D:Ds[i],S,mv})});
  if(!P.length)return null;
  // data de avaliação: o dia mais recente que todos os itens com saldo já publicaram
  let dv="9999";P.forEach(p=>{const u=p.S.length?p.S[p.S.length-1][0]:"0000";if(u<dv)dv=u});
  const d0=P.reduce((a,p)=>{const e=p.mv.find(m=>m.ed);return e&&e.ed<a?e.ed:a},"9999");if(dv<d0)return {erro:"As aplicações informadas são mais recentes que os últimos dados publicados ("+fdate(Date.parse(dv+"T00:00:00Z"))+")."};
  // cotas por item e lotes (para o IR por aplicação, resgates saem dos lotes mais antigos)
  P.forEach(p=>{p.lotes=[];p.cotas=0;p.apl=0;p.resg=0;p.cf=[];p.sem=[];
    p.mv.forEach(m=>{if(m.d>dv)return;const lv=spAt(p.S,m.d);if(!lv){p.sem.push(m.d);return}const q=Math.abs(m.v)/lv[1];
      if(m.v>0){p.lotes.push({d:m.d,q,custo:m.v,lv:lv[1]});p.cotas+=q;p.apl+=m.v;p.cf.push([m.d,-m.v])}
      else{let r=q;p.resg+=-m.v;p.cf.push([m.d,-m.v]);while(r>1e-12&&p.lotes.length){const l=p.lotes[0],t=Math.min(r,l.q),f=t/l.q;l.custo-=l.custo*f;l.q-=t;r-=t;if(l.q<=1e-12)p.lotes.shift()}p.cotas=p.lotes.reduce((a,l)=>a+l.q,0)}});
    const lv=spAt(p.S,dv);p.lvF=lv?lv[1]:null;p.v=p.lvF?p.cotas*p.lvF:0;p.custo=p.lotes.reduce((a,l)=>a+l.custo,0);
    // IR estimado se resgatasse hoje, lote a lote
    const A=p.x.t==="a"&&AT.files.get(p.x.k),pr=A&&A.I?(d=>{let r=null;for(let j=0;j<A.I.length;j++){const dd=AT.cal[A.I[j]];if(dd<=d)r=A.R[j];else break}return r}):null;
    p.ir=0;p.lotes.forEach(l=>{const dias=(Date.parse(dv)-Date.parse(l.d))/DAY,vl=l.q*p.lvF;let g=vl-l.custo;
      if(p.D.reg==="fii"&&pr){const a=pr(l.d),b=pr(dv);g=a&&b?Math.max(0,l.custo*(b/a-1)):Math.max(0,g)}
      if(g>0)p.ir+=g*spAliq(p.D.reg,dias)});
    p.liq=p.v-p.ir;p.cfF=p.cf.concat(p.v>0?[[dv,p.v]]:[]);p.tir=spXirr(p.cfF);
    p.ret=p.lvF&&p.mv.length?(p.lvF/spAt(p.S,p.mv[0].d)[1]-1)*100:null;
    const c0=spAt(cdiS,p.mv[0].d),c1=spAt(cdiS,dv);p.cdi=c0&&c1?(c1[1]/c0[1]-1)*100:null;
    p.seCdi=p.mv.reduce((a,m)=>{const x0=spAt(cdiS,m.d),x1=spAt(cdiS,dv);return a+(x0&&x1?m.v*x1[1]/x0[1]:m.v)},0)});
  // carteira: rentabilidade por cotas (TWR) dia a dia, neutralizando aplicações e resgates
  const datas=[...new Set(P.flatMap(p=>p.S.map(s=>s[0])).filter(d=>d>=d0&&d<=dv))].sort();
  const fl=new Map();P.forEach(p=>p.mv.forEach(m=>{if(m.d<=dv)fl.set(m.d,(fl.get(m.d)||0)+m.v)}));
  const qn=P.map(()=>0),pts=[];let idx=1,vPrev=0;
  datas.forEach(d=>{const lvs=P.map(p=>{const a=spAt(p.S,d);return a?a[1]:null});const pre=P.reduce((a,p,i)=>a+(lvs[i]?qn[i]*lvs[i]:0),0);
    if(vPrev>0)idx*=pre/vPrev;
    P.forEach((p,i)=>p.mv.forEach(m=>{if(m.ed===d&&m.d<=dv&&lvs[i])qn[i]+=m.v/lvs[i]}));
    const pos=P.reduce((a,p,i)=>a+(lvs[i]?qn[i]*lvs[i]:0),0);vPrev=pos;pts.push({d,t:Date.parse(d+"T00:00:00Z"),idx,v:pos,apl:0})});
  const T={apl:P.reduce((a,p)=>a+p.apl,0),resg:P.reduce((a,p)=>a+p.resg,0),v:P.reduce((a,p)=>a+p.v,0),ir:P.reduce((a,p)=>a+p.ir,0),seCdi:P.reduce((a,p)=>a+p.seCdi,0)};
  T.liq=T.v-T.ir;T.ganho=T.v+T.resg-T.apl;T.twr=pts.length?(pts[pts.length-1].idx-1)*100:null;
  const cf=[];P.forEach(p=>p.cf.forEach(x=>cf.push(x)));cf.sort((a,b)=>a[0]<b[0]?-1:1);T.tir=spXirr(cf.concat([[dv,T.v]]));T.tirLiq=spXirr(cf.concat([[dv,T.liq]]));
  const c0=spAt(cdiS,d0),c1=spAt(cdiS,dv),i0=spAt(ipS,d0),i1=spAt(ipS,dv);T.cdi=c0&&c1?(c1[1]/c0[1]-1)*100:null;T.ipca=i0&&i1?(i1[1]/i0[1]-1)*100:null;
  T.real=T.twr!=null&&T.ipca!=null?((1+T.twr/100)/(1+T.ipca/100)-1)*100:null;
  const anos=(Date.parse(dv)-Date.parse(d0))/(365*DAY);T.tirP=T.tir!=null?(Math.pow(1+T.tir,Math.max(anos,1/365))-1)*100:null;
  T.cdiS=cdiS;
  return {P,T,dv,d0,pts,semDado:P.filter(p=>p.sem.length).map(p=>spItemNome(p.x))};
}
function spPosHtml(c,its,Ds){
  let X;try{X=spPosCalc(c,its,Ds)}catch(e){console.error(e);return '<section class="panel"><p class="err">Não deu para calcular a posição: '+esc(e.message)+'</p></section>'}
  if(!X)return "";if(X.erro)return '<section class="panel" data-reltit="Posição atual"><h3>Posição atual</h3><p class="warn">'+esc(X.erro)+'</p></section>';
  const {P,T,dv,d0,pts}=X,kp=(a,b,cc)=>'<div class="fnkp"><span>'+a+'</span><b>'+b+'</b>'+(cc?'<small>'+cc+'</small>':'')+'</div>',pct=v=>v==null?'—':fnPct(v),pa=v=>v==null?'—':fnPctT(v*100)+' a.a.';
  const dvs=fdate(Date.parse(dv+"T00:00:00Z")),d0s=fdate(Date.parse(d0+"T00:00:00Z"));
  let h='<section class="panel" data-reltit="Posição atual (aplicações reais)"><h3>Posição atual</h3><p class="sub">Com as aplicações e os resgates informados, de '+d0s+' até '+dvs+' (último dia com dados de todos os itens).</p>';
  h+='<div class="fnkpis">'+kp("Valor aplicado",brl(T.apl),T.resg?'resgatado '+brl(T.resg):'')+kp("Valor atual",brl(T.v),'líquido de IR (estimado) '+brl(T.liq))+kp("Ganho",'<span class="'+(T.ganho>=0?'pos':'neg')+'">'+brl(T.ganho)+'</span>','se estivesse no CDI: '+brl(T.seCdi))
    +kp("Rentabilidade da carteira",pct(T.twr),T.cdi!=null&&T.twr!=null&&T.cdi>0?(T.twr>0?fx(T.twr/T.cdi*100,0)+'% do CDI':'CDI '+fnPctT(T.cdi)):'por cotas, sem efeito dos aportes')
    +kp("Rentabilidade do cliente (TIR)",pa(T.tir),T.tirLiq!=null?'líquida de IR '+pa(T.tirLiq):'')
    +kp("Rentabilidade real",pct(T.real),T.ipca!=null?'acima do IPCA ('+fnPctT(T.ipca)+' no período)':'')+'</div>';
  const S=[{lab:"Carteira (por cotas)",col:FN_COLS[0],w:2.2,pts:pts.map(p=>[p.t,(p.idx-1)*100])}];
  const c0=spAt(T.cdiS,d0);if(c0)S.push({lab:"CDI",col:FN_BM.cdi.col,w:1.5,pts:pts.map(p=>{const x=spAt(T.cdiS,p.d);return [p.t,x?(x[1]/c0[1]-1)*100:null]})});
  if(pts.length>2)h+='<div class="label" style="margin-top:6px">Rentabilidade acumulada da carteira</div>'+fnChart(S,{fmt:"pct",zero:true,aria:"Rentabilidade real da carteira"});
  if(pts.length>2)h+='<div class="label" style="margin-top:10px">Patrimônio</div>'+fnChart([{lab:"Valor da carteira",col:FN_COLS[0],w:2,pts:pts.map(p=>[p.t,p.v])}],{fmt:"money",aria:"Patrimônio da carteira"});
  const totW=c.itens.reduce((a,x)=>a+(+x.w||0),0)||1;
  h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th>Aplicado</th><th>Valor atual</th><th>Ganho</th><th>Rentab. (cotas)</th><th class="c-sm">% do CDI</th><th>TIR a.a.</th><th class="c-md">IR estimado</th><th class="c-ph">Peso atual</th><th class="c-ph">Peso proposto</th></tr></thead><tbody>';
  P.forEach(p=>{const g=p.v+p.resg-p.apl;h+='<tr><td style="text-align:left" class="tw"><i class="fndot" style="background:'+CMP_COLS[c.itens.indexOf(p.x)%CMP_COLS.length]+'"></i>'+esc(spItemNome(p.x))+'<small style="display:block;color:var(--muted)">desde '+fdate(Date.parse(p.mv[0].d+"T00:00:00Z"))+(p.resg?' · resgatado '+brl(p.resg):'')+'</small></td><td>'+brl(p.apl)+'</td><td>'+brl(p.v)+'</td><td class="'+(g>=0?'pos':'neg')+'">'+brl(g)+'</td><td>'+pct(p.ret)+'</td><td class="c-sm">'+(p.cdi&&p.ret!=null&&p.cdi>0&&p.ret>0?fx(p.ret/p.cdi*100,0)+'%':'—')+'</td><td>'+(p.tir!=null?fnPctT(p.tir*100):'—')+'</td><td class="c-md">'+brl(p.ir)+'</td><td class="c-ph">'+(T.v?fx(p.v/T.v*100,1)+'%':'—')+'</td><td class="c-ph">'+fx((+p.x.w||0)/totW*100,1)+'%</td></tr>'});
  h+='<tr class="cmpbm"><td style="text-align:left"><b>Carteira</b></td><td><b>'+brl(T.apl)+'</b></td><td><b>'+brl(T.v)+'</b></td><td><b>'+brl(T.ganho)+'</b></td><td><b>'+pct(T.twr)+'</b></td><td class="c-sm">'+(T.cdi&&T.twr>0&&T.cdi>0?fx(T.twr/T.cdi*100,0)+'%':'—')+'</td><td><b>'+(T.tir!=null?fnPctT(T.tir*100):'—')+'</b></td><td class="c-md"><b>'+brl(T.ir)+'</b></td><td class="c-ph">100%</td><td class="c-ph">100%</td></tr></tbody></table></div>';
  if(X.semDado.length)h+='<p class="warn" style="font-size:.84rem">Sem cota ou cotação na data de alguma aplicação de: '+esc(X.semDado.join(", "))+'. Essas aplicações ficaram de fora; confira a data.</p>';
  h+='<p class="sub" style="font-size:.8rem">Rentabilidade da carteira: por cotas (TWR), sem o efeito do momento dos aportes e resgates; é a que se compara com o CDI e com a proposta. Rentabilidade do cliente: taxa interna de retorno (TIR) dos valores aplicados e resgatados nas datas informadas, ao ano. Real: rentabilidade da carteira descontado o IPCA do período. IR estimado se tudo fosse resgatado hoje, aplicação por aplicação (tabela regressiva na renda fixa e nos fundos de renda fixa e multimercado, já contando o come-cotas; 15% em ações, ETFs e BDRs sem a isenção de R$ 20 mil; 20% sobre o ganho de preço dos FIIs). Valores brutos de taxas de corretagem e custódia. Não substitui o extrato da instituição.</p></section>';
  return h;
}
/* eventos do editor de aplicações */
document.addEventListener("click",e=>{
  if(!(e.target.closest&&e.target.closest("#modFn"))||activeMod!=="sp")return;const g=a=>e.target.closest("["+a+"]");let x;const c=spC();
  if((x=g("data-spmov"))){const j=+x.dataset.spmov;SP.movOpen=SP.movOpen===j?null:j;spTopHtml();const v=$("spMovV");if(v)v.focus();return}
  if((x=g("data-spmovadd"))){const j=+x.dataset.spmovadd,it=c.itens[j],d=$("spMovD").value,t=+$("spMovT").value,v=num($("spMovV").value);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>new Date().toISOString().slice(0,10)){$("spMovD").focus();return}if(v==null||v<=0){$("spMovV").focus();return}
    it.mov=(it.mov||[]).concat([{d,v:Math.round(t*v*100)/100}]);SP_CMP=null;spSave();spCalc();return}
  if((x=g("data-spmovdel"))){const [j,i]=x.dataset.spmovdel.split("|").map(Number),it=c.itens[j];if(it&&it.mov){it.mov.splice(i,1);spSave();spCalc()}return}
  if((x=g("data-spmovgen"))){const tot=c.itens.reduce((a,y)=>a+(+y.w||0),0)||1;c.itens.forEach(y=>{if(!(y.mov&&y.mov.length)&&(+y.w||0)>0)y.mov=[{d:c.ef.data,v:Math.round((+c.ef.valor||0)*(+y.w)/tot*100)/100}]});spSave();spCalc();return}
});

