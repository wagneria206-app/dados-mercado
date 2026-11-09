/* ---------- análise técnica do ativo: médias móveis, IFR, MACD, tendência, suportes e resistências */
// Mesmas contas do robô (scripts/tecnica.py), que grava as colunas técnicas no índice para o ranking.
// Cotação de fechamento ajustada só por desdobramentos e grupamentos (sem proventos), como nos gráficos técnicos.
function tecSerie(A){
  const spl=(A.adj||[]).filter(e=>String(e[2]).startsWith("S")).sort((a,b)=>a[0]-b[0]);
  const c=new Array(A.I.length);let acc=1,k=spl.length-1;
  for(let x=A.I.length-1;x>=0;x--){while(k>=0&&spl[k][0]>A.I[x]){acc*=spl[k][1];k--}c[x]=A.R[x]*acc}
  return {t:A.I.map(ix=>AT.T[ix]),c};
}
function tecMedia(c,n){const o=new Array(c.length).fill(null);let s=0;for(let k=0;k<c.length;k++){s+=c[k];if(k>=n)s-=c[k-n];if(k>=n-1)o[k]=s/n}return o}
function tecMME(c,n){const o=new Array(c.length).fill(null),a=2/(n+1);let e=null;for(let k=0;k<c.length;k++){if(k===n-1){let s=0;for(let j=0;j<n;j++)s+=c[j];e=s/n}else if(k>=n)e=c[k]*a+e*(1-a);if(k>=n-1)o[k]=e}return o}
function tecIFR(c,n){
  n=n||14;const o=new Array(c.length).fill(null);if(c.length<=n+1)return o;
  let mg=0,mp=0;for(let k=1;k<=n;k++){const d=c[k]-c[k-1];if(d>0)mg+=d;else mp-=d}mg/=n;mp/=n;
  const v=()=>mp===0?(mg>0?100:50):100-100/(1+mg/mp);o[n]=v();
  for(let k=n+1;k<c.length;k++){const d=c[k]-c[k-1];mg=(mg*(n-1)+Math.max(0,d))/n;mp=(mp*(n-1)+Math.max(0,-d))/n;o[k]=v()}
  return o;
}
function tecNiveis(c,p){
  // pivôs: mínimas e máximas locais (5 pregões de cada lado) no último ano, agrupadas quando a menos de 2% entre si
  const u=c.slice(-250),pv=[];
  for(let k=5;k<u.length-5;k++){const w=u.slice(k-5,k+6);if(u[k]===Math.min(...w))pv.push(u[k]);else if(u[k]===Math.max(...w))pv.push(u[k])}
  pv.sort((a,b)=>a-b);const g=[];
  pv.forEach(v=>{const l=g[g.length-1];if(l&&v<=l.m*1.02){l.s+=v;l.n++;l.m=l.s/l.n}else g.push({s:v,n:1,m:v})});
  const sup=g.filter(x=>x.m<p*0.995).sort((a,b)=>b.m-a.m).slice(0,2),res=g.filter(x=>x.m>p*1.005).sort((a,b)=>a.m-b.m).slice(0,2);
  return {sup,res};
}
function tecCalc(A){
  const S=tecSerie(A),c=S.c,n=c.length;if(n<60||!c[n-1])return null;
  const m21=tecMedia(c,21),m50=tecMedia(c,50),m200=tecMedia(c,200),ifr=tecIFR(c,14);
  const e12=tecMME(c,12),e26=tecMME(c,26),macd=c.map((_,k)=>e12[k]!=null&&e26[k]!=null?e12[k]-e26[k]:null);
  const mv=macd.filter(v=>v!=null),sg=tecMME(mv,9),sig=new Array(n-mv.length).fill(null).concat(sg);
  const p=c[n-1],u=c.slice(-252),L=k=>k<0?k+n:k;
  let cruz=0,cruzT=null;
  for(let k=n-20;k<n;k++){if(k<1)continue;const a0=m50[k-1],b0=m200[k-1],a1=m50[k],b1=m200[k];if([a0,b0,a1,b1].some(v=>v==null))continue;
    if(a0<=b0&&a1>b1){cruz=1;cruzT=S.t[k]}else if(a0>=b0&&a1<b1){cruz=-1;cruzT=S.t[k]}}
  const r=[];for(let k=Math.max(1,n-21);k<n;k++)r.push(Math.log(c[k]/c[k-1]));
  const mu=r.reduce((a,b)=>a+b,0)/r.length,vol=Math.sqrt(r.reduce((a,b)=>a+(b-mu)**2,0)/Math.max(1,r.length-1)*252)*100;
  const M50=m50[L(-1)],M200=m200[L(-1)];
  return {S,p,m21,m50,m200,ifr,macd,sig,cruz,cruzT,vol,
    M21:m21[L(-1)],M50,M200,IFR:ifr[L(-1)],MACD:macd[L(-1)],SIG:sig[L(-1)],
    tend:M50&&M200?(p>M50&&M50>M200?1:p<M50&&M50<M200?-1:0):null,
    max52:Math.max(...u),min52:Math.min(...u),niv:tecNiveis(c,p)};
}
function tecKp(l,v,s,cls){return '<div class="fnkp"><span>'+l+'</span><b'+(cls?' class="'+cls+'"':'')+'>'+v+'</b>'+(s?'<small>'+s+'</small>':'')+'</div>'}
const tecDist=(p,m)=>m?(p/m-1)*100:null;
const tecSinalPct=v=>v==null?'—':(v>=0?'+':'')+fx(v,1)+'%';
function atTecHtml(A){
  if(A.tipo==="Tesouro Direto")return "";
  const T=tecCalc(A);if(!T)return "";
  const n=T.S.c.length,k0=Math.max(0,n-252),tt=T.S.t;
  const ser=(arr,lab,col,w,dash)=>({lab,col,w,dash,pts:arr.slice(k0).map((v,j)=>[tt[k0+j],v])});
  let h='<section class="panel tec" id="tecnica"><h3>Análise técnica</h3>';
  const tl=T.tend===1?['Alta','pos']:T.tend===-1?['Baixa','neg']:T.tend===0?['Lateral','']:['—',''];
  const il=T.IFR==null?'':T.IFR>=70?'sobrecomprado':T.IFR<=30?'sobrevendido':'neutro';
  h+='<div class="fnkpis">'+tecKp("Tendência",tl[0],T.M200?'preço × médias de 50 e 200':'menos de 200 pregões',tl[1])
    +tecKp("IFR (14)",T.IFR!=null?fx(T.IFR,0):'—',il,T.IFR>=70?'neg':T.IFR<=30?'pos':'')
    +tecKp("Média de 200 dias",T.M200?'R$ '+fx(T.M200,2):'—',T.M200?tecSinalPct(tecDist(T.p,T.M200))+' do preço':'')
    +tecKp("Máxima de 52 semanas",'R$ '+fx(T.max52,2),tecSinalPct(tecDist(T.p,T.max52))+' do preço')
    +tecKp("Volatilidade (21 dias)",fx(T.vol,0)+'%','ao ano')+'</div>';
  h+='<div class="label">Últimos 12 meses: cotação e médias móveis</div>'
    +fnChart([ser(T.S.c,A.t,FN_COLS[0],2),ser(T.m50,"Média de 50 dias",FN_COLS[4],1.4),ser(T.m200,"Média de 200 dias",FN_COLS[1],1.4,"5 3")],{fmt:"brl",aria:"Cotação e médias móveis"});
  const lim=v=>({lab:"",col:"var(--muted)",w:1,dash:"3 4",pts:[[tt[k0],v],[tt[n-1],v]]});
  h+='<div class="label">IFR de 14 dias (acima de 70: sobrecomprado; abaixo de 30: sobrevendido)</div>'
    +fnChart([ser(T.ifr,"IFR",FN_COLS[3],1.6),lim(70),lim(30)],{fmt:"int",h:150,noLegend:true,aria:"IFR"});
  // níveis
  const nv=(arr,tp)=>arr.length?arr.map(x=>'R$ '+fx(x.m,2)+' <small>('+tecSinalPct(tecDist(x.m,T.p))+', '+x.n+(x.n>1?' toques':' toque')+')</small>').join('<br>'):'<small>nenhum no último ano</small>';
  h+='<div class="tablewrap"><table class="ctab"><tbody>'
    +'<tr><th style="text-align:left">Resistências (acima)</th><td>'+nv(T.niv.res)+'</td></tr>'
    +'<tr><th style="text-align:left">Preço atual</th><td><b>R$ '+fx(T.p,2)+'</b></td></tr>'
    +'<tr><th style="text-align:left">Suportes (abaixo)</th><td>'+nv(T.niv.sup)+'</td></tr>'
    +'<tr><th style="text-align:left">Médias de 21, 50 e 200 dias</th><td>'+[T.M21,T.M50,T.M200].map(m=>m?'R$ '+fx(m,2)+' <small>('+tecSinalPct(tecDist(T.p,m))+')</small>':'—').join(' · ')+'</td></tr>'
    +'<tr><th style="text-align:left">MACD (12, 26, 9)</th><td>'+(T.MACD!=null&&T.SIG!=null?(T.MACD>T.SIG?'acima da linha de sinal (força compradora)':'abaixo da linha de sinal (força vendedora)'):'—')+'</td></tr>'
    +'<tr><th style="text-align:left">Mínima de 52 semanas</th><td>R$ '+fx(T.min52,2)+' <small>('+tecSinalPct(tecDist(T.p,T.min52))+' do preço)</small></td></tr>'
    +'</tbody></table></div>';
  // leitura
  const L=[];
  if(T.tend===1)L.push('Tendência de <b>alta</b>: o preço está acima da média de 50 dias, que está acima da de 200.');
  else if(T.tend===-1)L.push('Tendência de <b>baixa</b>: o preço está abaixo da média de 50 dias, que está abaixo da de 200.');
  else if(T.tend===0)L.push('Sem tendência definida: preço e médias de 50 e 200 dias não estão alinhados.');
  if(T.cruz===1)L.push('A média de 50 dias cruzou <b>para cima</b> a de 200 em '+fdate(T.cruzT)+' (cruzamento de alta, conhecido como "golden cross").');
  if(T.cruz===-1)L.push('A média de 50 dias cruzou <b>para baixo</b> a de 200 em '+fdate(T.cruzT)+' (cruzamento de baixa, conhecido como "death cross").');
  if(T.IFR>=70)L.push('IFR em '+fx(T.IFR,0)+': o ativo subiu forte em pouco tempo e está <b>sobrecomprado</b>; correções são comuns nessa faixa.');
  else if(T.IFR<=30)L.push('IFR em '+fx(T.IFR,0)+': o ativo caiu forte em pouco tempo e está <b>sobrevendido</b>; repiques são comuns nessa faixa.');
  const dm=tecDist(T.p,T.max52);if(dm!=null&&dm>-3)L.push('Negocia <b>perto da máxima de 52 semanas</b> ('+tecSinalPct(dm)+').');
  const dn=tecDist(T.p,T.min52);if(dn!=null&&dn<3)L.push('Negocia <b>perto da mínima de 52 semanas</b> ('+tecSinalPct(dn)+').');
  if(T.niv.sup[0])L.push('Suporte mais próximo em R$ '+fx(T.niv.sup[0].m,2)+' ('+tecSinalPct(tecDist(T.niv.sup[0].m,T.p))+').');
  if(T.niv.res[0])L.push('Resistência mais próxima em R$ '+fx(T.niv.res[0].m,2)+' ('+tecSinalPct(tecDist(T.niv.res[0].m,T.p))+').');
  h+='<div class="label" style="margin-top:12px">Leitura</div><ul class="tecler">'+L.map(x=>'<li>'+x+'</li>').join("")+'</ul>';
  h+='<p class="sub" style="font-size:.8rem">Fechamentos diários da B3 até '+fdate(tt[n-1])+', ajustados por desdobramentos e grupamentos (sem proventos). Suportes e resistências: mínimas e máximas locais do último ano, agrupadas quando a menos de 2% entre si.</p></section>';
  return h;
}
const TEC_SINAIS=[["","Todos"],["alta","Tendência de alta"],["baixa","Tendência de baixa"],["lat","Sem tendência"],["cra","Cruzamento de alta (20 pregões)"],["crb","Cruzamento de baixa (20 pregões)"],["sc","IFR sobrecomprado (70+)"],["sv","IFR sobrevendido (30−)"],["max","Perto da máxima de 52 semanas"],["min","Perto da mínima de 52 semanas"]];
function tecFiltro(r,C,s){
  if(!s)return true;const v=k=>C[k]==null?null:r[C[k]];
  switch(s){case"alta":return v("tend")===1;case"baixa":return v("tend")===-1;case"lat":return v("tend")===0;case"cra":return v("cruz")===1;case"crb":return v("cruz")===-1;
    case"sc":return v("ifr")!=null&&v("ifr")>=70;case"sv":return v("ifr")!=null&&v("ifr")<=30;case"max":return v("max52d")!=null&&v("max52d")>-3;case"min":return v("min52d")!=null&&v("min52d")<3}
  return true;
}
function tecCel(c,v){
  if(c==="tend")return v===1?'<span class="pos">Alta</span>':v===-1?'<span class="neg">Baixa</span>':v===0?'Lateral':'—';
  if(c==="cruz")return v===1?'<span class="pos">↑ alta</span>':v===-1?'<span class="neg">↓ baixa</span>':'—';
  if(c==="ifr")return v==null?'—':'<span class="'+(v>=70?'neg':v<=30?'pos':'')+'">'+fx(v,0)+'</span>';
  return tecSinalPct(v);
}
