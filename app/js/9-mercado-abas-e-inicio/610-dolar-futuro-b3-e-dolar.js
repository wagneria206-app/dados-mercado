/* ---------- Dólar futuro (B3) e dólar justo ---------- */
const FX_MES="FGHJKMNQUVXZ";
function fxExp(code){const m=FX_MES.indexOf(code[0]),y=2000+(+code.slice(1));let t=Date.UTC(y,m,1);while(!isBiz(t))t+=DAY;return t}
function fxFront1(){if(!FXF||!FX)return null;const A=new Array(FX._t.length).fill(NaN),ix=new Map(FX._t.map((t,i)=>[t,i]));
  for(const [d,L] of Object.entries(FXF.dias)){const t=Date.parse(d+"T00:00:00Z"),i=ix.get(t);if(i==null||!Array.isArray(L))continue;let best=null;L.forEach(r=>{const e=fxExp(r[0]);if(e>t&&(!best||e<best.e))best={e,v:+r[1]}});if(best)A[i]=best.v}return A}
function fxPtaxOn(t){const i=fxIdx(t);return i>=0?FX._v[i]:NaN}
function fxSolve(A,b){const n=b.length,M=A.map((r,i)=>r.concat([b[i]]));for(let p=0;p<n;p++){let mx=p;for(let r=p+1;r<n;r++)if(Math.abs(M[r][p])>Math.abs(M[mx][p]))mx=r;[M[p],M[mx]]=[M[mx],M[p]];if(Math.abs(M[p][p])<1e-14)return null;for(let r=p+1;r<n;r++){const f=M[r][p]/M[p][p];for(let c=p;c<=n;c++)M[r][c]-=f*M[p][c]}}const x=new Array(n).fill(0);for(let p=n-1;p>=0;p--){let s=M[p][n];for(let c=p+1;c<n;c++)s-=M[p][c]*x[c];x[p]=s/M[p][p]}return x}
function fxMonthly(){if(FX._m)return FX._m;const g={};FX.serie.forEach(r=>{const k=r[0].slice(0,7);(g[k]=g[k]||[]).push(+r[2])});const o={};for(const k in g)o[k]=g[k].reduce((a,b)=>a+b,0)/g[k].length;return FX._m=o}
const fxYm=ym=>(+ym.slice(0,4))*12+(+ym.slice(5,7))-1,fxYmT=ym=>Date.UTC(+ym.slice(0,4),+ym.slice(5,7)-1,15);
let FX_IPCA=null;
function fxIpca(ym){ // número-índice do IPCA; antes de 2005, encadeado pela variação mensal (SGS 433)
  const k=fxYm(ym);if(IPCA[k])return IPCA[k];
  if(!FX_IPCA){FX_IPCA={};const V=FXJ&&FXJ.mensal.ipca_var||{},ks=Object.keys(IPCA).map(Number).sort((a,b)=>a-b);let k0=ks[0],v=IPCA[k0];
    for(let j=k0;j>12*1994;j--){const y=Math.floor(j/12),m=j%12+1,key=y+"-"+String(m).padStart(2,"0"),pv=V[key];if(pv==null)break;v=v/(1+pv/100);FX_IPCA[j-1]=v}}
  return FX_IPCA[k]||NaN}
function fxPPC(spot){
  const Sm=fxMonthly(),C=FXJ.mensal.cpi_eua,R=[];Object.keys(Sm).sort().forEach(ym=>{const p=fxIpca(ym),c=C[ym];if(p&&c)R.push({ym,s:Sm[ym],p:p/c})});
  if(R.length<60)return null;const last=R[R.length-1],L=last.ym,back=y=>(+L.slice(0,4)-y)+L.slice(4);
  const W=[["Desde 1999 (câmbio flutuante)","1999-02",true],["Últimos 20 anos",back(20)],["Últimos 10 anos",back(10)],["Desde 1995 (Plano Real)","1995-01"]];
  const wins=W.map(([lab,from,main])=>{const S=R.filter(r=>r.ym>=from);const avg=S.reduce((a,r)=>a+r.s/r.p,0)/S.length;return {lab,from,main:!!main,avg,fair:avg*last.p,dev:(spot/(avg*last.p)-1)*100,n:S.length}});
  return {R,last,wins,main:wins[0]};
}
function fxBEER(spot){
  const Sm=fxMonthly(),J=FXJ.mensal,C=J.cpi_eua,DX=J.dolar_global||{},CO=J.commodities||{},EM=J.embi||{},U=FXJ.ultimo||{};
  const coOk=Object.keys(CO).length>100&&U.commodities;
  const months=Object.keys(Sm).sort().filter(ym=>ym>="2006-01"&&fxIpca(ym)&&C[ym]&&DX[ym]&&(!coOk||CO[ym]));if(months.length<60)return null;
  const embiOk=months.filter(m=>EM[m]!=null).length>=months.length*0.9&&U.embi&&Date.parse(U.embi.data)>VAL-45*DAY;
  const use=embiOk?months.filter(m=>EM[m]!=null):months;
  const row=ym=>[1,Math.log(fxIpca(ym)/C[ym]),Math.log(DX[ym])].concat(coOk?[Math.log(CO[ym])]:[]).concat(embiOk?[EM[ym]/100]:[]);
  const X=use.map(row),y=use.map(m=>Math.log(Sm[m])),k=X[0].length,A=[],b=new Array(k).fill(0);for(let i=0;i<k;i++)A.push(new Array(k).fill(0));
  X.forEach((x,r)=>{for(let i=0;i<k;i++){b[i]+=x[i]*y[r];for(let j=0;j<k;j++)A[i][j]+=x[i]*x[j]}});const beta=fxSolve(A,b);if(!beta)return null;
  const fit=X.map(x=>x.reduce((a,v,i)=>a+v*beta[i],0)),res=y.map((v,i)=>v-fit[i]),ym=y.reduce((a,b)=>a+b,0)/y.length;
  const sse=res.reduce((a,b)=>a+b*b,0),sst=y.reduce((a,b)=>a+(b-ym)*(b-ym),0),r2=1-sse/sst,sd=Math.sqrt(sse/Math.max(1,y.length-k));
  const lm=months[months.length-1],pNow=fxIpca(lm)/C[lm];
  const xNow=[1,Math.log(pNow),Math.log(U.dolar_global?U.dolar_global.valor:DX[lm])].concat(coOk?[Math.log(U.commodities.valor)]:[]).concat(embiOk?[U.embi.valor/100]:[]);
  const fair=Math.exp(xNow.reduce((a,v,i)=>a+v*beta[i],0));
  return {beta,r2,sd,fair,dev:(spot/fair-1)*100,n:use.length,from:use[0],to:use[use.length-1],embiOk,fitted:use.map((m,i)=>[fxYmT(m),Math.exp(fit[i])]),U,coOk};
}
function fxMulti(S,opt){
  opt=opt||{};const NW=window.innerWidth<640,W=NW?420:chartW(),H=NW?300:chartH(240,W),PL=NW?44:52,PR=10,PT=14,PB=28;
  let lo=Infinity,hi=-Infinity,t0=Infinity,t1=-Infinity;S.forEach(s=>s.pts.forEach(([t,v])=>{if(!isFinite(v))return;lo=Math.min(lo,v);hi=Math.max(hi,v);t0=Math.min(t0,t);t1=Math.max(t1,t)}));if(!isFinite(lo))return "";
  const pad=(hi-lo)*0.06||0.05;lo-=pad;hi+=pad;const st=niceStep((hi-lo)/5);lo=Math.floor(lo/st)*st;hi=Math.ceil(hi/st)*st;
  const X=t=>PL+(t-t0)/Math.max(1,t1-t0)*(W-PL-PR),Y=v=>PT+(hi-v)/(hi-lo)*(H-PT-PB);
  let g='';for(let v=lo;v<=hi+st/2;v+=st){const y=Y(v);g+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-dasharray="2 4"/><text x="'+(PL-6)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+fx(v,st>=1?0:Math.abs(st*10-Math.round(st*10))<1e-9?1:2)+'</text>'}
  const ny=(t1-t0)/DAY/365.25,ticks=[];if(opt.months){const d=new Date(t0);let k=d.getUTCFullYear()*12+d.getUTCMonth();const sm=Math.max(1,Math.ceil((ny*12)/(NW?5:10)));for(;;k+=sm){const t=Date.UTC(Math.floor(k/12),k%12,1);if(t>t1)break;if(t>=t0)ticks.push([t,mname(k)])}}
  else if(ny<0.35){const nd=Math.max(1,Math.round((t1-t0)/DAY/(NW?4:8)));for(let t=t0;t<=t1;t+=nd*DAY)ticks.push([t,txD2(t).slice(0,5)])}
  else if(ny<2.5){const d=new Date(t0);let k=d.getUTCFullYear()*12+d.getUTCMonth()+1;const sm=Math.max(1,Math.ceil(ny*12/(NW?4:8)));for(;;k+=sm){const t=Date.UTC(Math.floor(k/12),k%12,1);if(t>t1)break;ticks.push([t,mname(k)])}}
  else{const sy=ny>16?4:ny>8?2:1;for(let y=Math.ceil(new Date(t0).getUTCFullYear()/sy)*sy;y<=new Date(t1).getUTCFullYear();y+=sy){const t=Date.UTC(y,0,1);if(t>=t0)ticks.push([t,String(y)])}}
  ticks.forEach(([t,l])=>{g+='<text x="'+X(t).toFixed(1)+'" y="'+(H-PB+16)+'" text-anchor="middle">'+l+'</text>'});
  S.slice().reverse().forEach(s=>{let d='',pen=false;s.pts.forEach(([t,v])=>{if(!isFinite(v)){pen=false;return}d+=(pen?'L':'M')+X(t).toFixed(1)+' '+Y(v).toFixed(1)+' ';pen=true});g+='<path d="'+d+'" fill="none" stroke="'+s.col+'" stroke-width="'+((s.w||1.8)*0.7).toFixed(2)+'"'+(s.dash?' stroke-dasharray="'+s.dash+'"':'')+' stroke-linejoin="round"/>';if(opt.dots)s.pts.forEach(([t,v])=>{if(isFinite(v))g+='<circle cx="'+X(t).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="2.6" fill="'+s.col+'"/>'})});
  g+='<line class="cvx" x1="0" x2="0" y1="'+PT+'" y2="'+(H-PB)+'" stroke="var(--ink)" stroke-width="1" opacity="0"/>';
  const meta={W,PL,PR,t0,t1,u:opt.unit==null?"R$":opt.unit,months:!!opt.months,S:S.map(s=>({lab:s.lab,col:s.col,pts:s.pts.filter(p=>isFinite(p[1])).map(p=>[p[0],+p[1].toFixed(4)])}))};
  return '<div class="fxmulti" data-fxm=\''+JSON.stringify(meta).replace(/'/g,"&#39;")+'\'><svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img">'+g+'<rect x="'+PL+'" y="'+PT+'" width="'+(W-PL-PR)+'" height="'+(H-PT-PB)+'" fill="transparent"/></svg><div class="cvtip" hidden></div></div><div class="legend">'+S.map(s=>'<span><i style="background:'+s.col+'"></i>'+esc(s.lab)+'</span>').join("")+'</div>';
}
document.addEventListener("mousemove",e=>{const box=e.target.closest&&e.target.closest(".fxmulti");document.querySelectorAll(".fxmulti").forEach(b=>{if(b!==box){const t=b.querySelector(".cvtip");if(t&&!t.hidden)t.hidden=true;const l=b.querySelector(".cvx");if(l)l.setAttribute("opacity","0")}});if(!box)return;
  let M;try{M=JSON.parse(box.dataset.fxm)}catch(x){return}const svg=box.querySelector("svg"),R=svg.getBoundingClientRect(),sx=R.width/M.W,px=(e.clientX-R.left)/sx,t=M.t0+(px-M.PL)/(M.W-M.PL-M.PR)*(M.t1-M.t0);
  let bt=null;M.S.forEach(s=>s.pts.forEach(p=>{if(bt==null||Math.abs(p[0]-t)<Math.abs(bt-t))bt=p[0]}));if(bt==null)return;const X=M.PL+(bt-M.t0)/Math.max(1,M.t1-M.t0)*(M.W-M.PL-M.PR);
  const ln=box.querySelector(".cvx");ln.setAttribute("x1",X);ln.setAttribute("x2",X);ln.setAttribute("opacity",".35");
  const tip=box.querySelector(".cvtip");tip.innerHTML='<b>'+(M.months?mname(new Date(bt).getUTCFullYear()*12+new Date(bt).getUTCMonth()):fdate(bt))+'</b>'+M.S.map(s=>{let q=null;s.pts.forEach(p=>{if(q==null||Math.abs(p[0]-bt)<Math.abs(q[0]-bt))q=p});return q&&Math.abs(q[0]-bt)<20*DAY?'<span><i style="background:'+s.col+'"></i>'+esc(s.lab)+': '+(M.u==="R$"?'R$ '+fx(q[1],4):M.u==="%"?fx(q[1],2)+'%':M.u==="pp"?fx(q[1],2)+' p.p.':fx(q[1],2))+'</span>':''}).join("");
  tip.hidden=false;const bx=box.getBoundingClientRect(),left=X*sx+12;tip.style.top="8px";tip.style.left=(left+tip.offsetWidth>bx.width?Math.max(0,X*sx-tip.offsetWidth-12):left)+"px"});
function fxFutHtml(){
  if(!FXF)return '<div class="label" style="margin-top:16px">Dólar futuro (B3)</div><p class="sub">Os preços de ajuste da B3 aparecem aqui depois da próxima coleta do robô.</p>';
  const ks=Object.keys(FXF.dias).sort(),dk=ks[ks.length-1],L=(FXF.dias[dk]||[]).slice(),t=Date.parse(dk+"T00:00:00Z"),S=fxPtaxOn(t),J=FXJ&&FXJ.ultimo&&FXJ.ultimo.juro_eua?FXJ.ultimo.juro_eua:null;
  L.sort((a,b)=>fxExp(a[0])-fxExp(b[0]));const rows=L.filter(r=>fxExp(r[0])>t).slice(0,12);if(!rows.length)return "";
  let h='<div class="label" style="margin-top:16px">Dólar futuro (B3) · ajuste de '+fdate(t)+'</div><p class="sub" style="margin-top:2px">Preço de ajuste do contrato DOL de cada vencimento (vence no 1º dia útil do mês e liquida pela PTAX do último dia útil do mês anterior). O prêmio sobre a PTAX reflete a diferença de juros entre o Brasil e os EUA.</p>';
  const prevK=ks.length>1?ks[ks.length-2]:null,PV=prevK?Object.fromEntries((FXF.dias[prevK]||[]).map(r=>[r[0],+r[1]])):{};
  const b=rows[0],eb=fxExp(b[0]),nb=du(t,eb),dcb=(eb-t)/DAY,Fb=+b[1];
  h+='<div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">Contrato</th><th>Dias úteis</th><th>Ajuste (R$/US$)</th><th>No dia</th><th>Prêmio s/ 1º venc.</th><th class="c-ph">Prêmio ao ano</th>'+(J?'<th class="c-ph">Justo pela paridade de juros</th><th class="c-ph">Cupom cambial implícito</th>':'')+'</tr></thead><tbody>';
  rows.forEach((r,ix)=>{const e=fxExp(r[0]),n=du(t,e),dc=(e-t)/DAY,F=+r[1],dd=PV[r[0]]?(F/PV[r[0]]-1)*100:NaN;
    let pr='—',pa='—',cip='';
    if(ix>0){const dn=n-nb,ddc=dc-dcb;pr=fxSigned((F/Fb-1)*100);pa=fx((Math.pow(F/Fb,252/Math.max(1,dn))-1)*100,2)+'%';
      if(J){const fdi=dfCurve(n)/dfCurve(nb),Ft=Fb*fdi/(1+J.valor/100*ddc/360),cup=(Fb*fdi/F-1)*360/ddc*100;cip='<td class="c-ph">'+fx(Ft,4)+' <small>('+fxSigned((F/Ft-1)*100)+')</small></td><td class="c-ph">'+fx(cup,2)+'% a.a.</td>'}}
    else if(J)cip='<td class="c-ph">base</td><td class="c-ph">—</td>';
    const d=new Date(e);h+='<tr><td style="text-align:left"><b>'+esc(r[0])+'</b> <small>'+mname(d.getUTCFullYear()*12+d.getUTCMonth())+' · vence '+txD2(e)+'</small></td><td>'+n+'</td><td><b>'+fx(F,4)+'</b></td><td>'+fxSigned(dd)+'</td><td>'+(ix?pr:'<small>base</small>')+'</td><td class="c-ph">'+(ix?pa:'—')+'</td>'+cip+'</tr>'});
  h+='</tbody></table></div><p class="sub" style="font-size:.8rem;margin-top:4px">1º vencimento ('+esc(b[0])+') a R$ '+fx(Fb,4)+'; PTAX de '+fdate(t)+' a R$ '+fx(S,4)+' ('+fxSigned((Fb/S-1)*100)+'). A PTAX é a média até as 13h e o ajuste é do fim da tarde, por isso os prêmios são medidos a partir do 1º vencimento, cotado no mesmo momento.</p>';
  // curva do dólar futuro: hoje, 1 semana e 1 mês
  const pick=back=>{let b=null;for(const k of ks)if(Date.parse(k+"T00:00:00Z")<=t-back*DAY)b=k;return b},C=[[dk,"Hoje","var(--accent)"],[pick(7),"1 semana atrás","var(--s4)"],[pick(30),"1 mês atrás","var(--s2)"]].filter(x=>x[0]);
  const ser=[];const seen=new Set();C.forEach(([k,lab,col])=>{if(seen.has(k))return;seen.add(k);const tt=Date.parse(k+"T00:00:00Z"),P=(FXF.dias[k]||[]).map(r=>[fxExp(r[0]),+r[1]]).filter(p=>p[0]>tt).sort((a,b)=>a[0]-b[0]).slice(0,12);if(P.length>1)ser.push({lab:lab+" ("+txD2(tt)+")",col,pts:P,w:k===dk?2.4:1.6})});
  if(ser.length)h+='<div class="label" style="margin-top:10px">Curva do dólar futuro (por vencimento)</div>'+fxMulti(ser,{months:true,dots:true});
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Fonte: B3, arquivo consolidado de negócios do dia (preço de ajuste, atualizado no fim da tarde). Prêmio ao ano = (ajuste ÷ ajuste do 1º vencimento)^(252 ÷ dias úteis entre eles) − 1.'+(J?' Justo pela paridade de juros = 1º vencimento × juro prefixado da curva ANBIMA no intervalo ÷ (1 + SOFR × dias corridos/360), com SOFR de '+fx(J.valor,2)+'% ('+fdate(Date.parse(J.data))+'). Cupom cambial implícito = juro em dólar que o mercado embute no futuro; acima do SOFR, a diferença é o prêmio de risco do país e de conversibilidade.':'')+'</p>';
  return h;
}
function fxJustoHtml(spot){
  if(!FXJ)return '<div class="label" style="margin-top:16px">Dólar justo</div><p class="sub">Os dados de inflação e de mercado dos EUA aparecem aqui depois da próxima coleta do robô.</p>';
  const P=fxPPC(spot),B=fxBEER(spot);if(!P&&!B)return "";
  const card=(t,v,dev,sub)=>'<div><span class="n">'+t+'</span><span class="v">R$ '+fx(v,4)+'</span><span class="n">'+(isFinite(dev)?'o dólar de hoje está '+fxSigned(dev).replace(/^<span class="(\w*)">[+−]?/,'<span class="$1">')+(dev>=0?' acima':' abaixo'):'')+(sub?' · '+sub:'')+'</span></div>';
  let h='<div class="label" style="margin-top:18px">Dólar justo</div><p class="sub" style="margin-top:2px">Estimativas de onde o dólar estaria pelos fundamentos, por dois critérios muito usados por economistas. Não são previsão: o câmbio pode ficar longe do valor justo por muito tempo.</p><div class="tot" style="margin-top:8px">';
  if(P)h+=card("Paridade do poder de compra",P.main.fair,(spot/P.main.fair-1)*100,'média real desde 1999');
  if(B)h+=card("Modelo de fundamentos",B.fair,B.dev,'faixa normal R$ '+fx(B.fair*Math.exp(-B.sd),2)+' a '+fx(B.fair*Math.exp(B.sd),2));
  h+='</div>';
  if(P){h+='<details style="margin-top:10px" open><summary class="label" style="cursor:pointer">1. Paridade do poder de compra (inflação do Brasil × EUA)</summary><p class="sub" style="margin-top:6px">Ideia: no longo prazo, o câmbio acompanha a diferença de inflação entre os países. O app calcula o câmbio real de cada mês (PTAX média × CPI dos EUA ÷ IPCA), tira a média de um período longo e aplica a inflação acumulada até '+mname(fxYm(P.last.ym))+'. Períodos de referência diferentes dão valores diferentes:</p><div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">Média do câmbio real</th><th>Meses</th><th>Dólar justo</th><th>Dólar de hoje vs. justo</th></tr></thead><tbody>'
    +P.wins.map(w=>'<tr><td style="text-align:left">'+(w.main?'<b>':'')+esc(w.lab)+(w.main?'</b> <small>(referência)</small>':'')+'</td><td>'+w.n+'</td><td>'+(w.main?'<b>':'')+'R$ '+fx(w.fair,4)+(w.main?'</b>':'')+'</td><td>'+fxSigned(w.dev)+'</td></tr>').join("")+'</tbody></table></div>';
    const ser=[{lab:"PTAX (média do mês)",col:"var(--accent)",pts:P.R.filter(r=>r.ym>="2006-01").map(r=>[fxYmT(r.ym),r.s]),w:2.2},{lab:"Justo pela paridade (média desde 1999)",col:"var(--s2)",pts:P.R.filter(r=>r.ym>="2006-01").map(r=>[fxYmT(r.ym),P.main.avg*r.p]),dash:"5 4"}];
    if(B)ser.push({lab:"Modelo de fundamentos (ajustado)",col:"var(--s3)",pts:B.fitted});
    h+=fxMulti(ser)+'</details>'}
  if(B){const nm=["Constante","Diferença de inflação Brasil × EUA (log)","Dólar global – índice DXY pelas cotações do BC (log)"].concat(B.coOk?["Commodities – IC-Br do Banco Central em dólares (log)"]:[]).concat(B.embiOk?["Risco-país – EMBI+ Brasil (pontos ÷ 100)"]:[]);
    const U=B.U,val=[null,null,U.dolar_global].concat(B.coOk?[U.commodities]:[]).concat(B.embiOk?[U.embi]:[]);
    h+='<details style="margin-top:10px"><summary class="label" style="cursor:pointer">2. Modelo de fundamentos (regressão)</summary><p class="sub" style="margin-top:6px">Ideia: o real se valoriza quando o dólar perde força no mundo e quando as commodities sobem, e se desvaloriza quando o risco-país aumenta. O app estima, com dados mensais de '+mname(fxYm(B.from))+' a '+mname(fxYm(B.to))+' ('+B.n+' meses), quanto cada fator explica do dólar e aplica os valores mais recentes. O modelo explica '+fx(B.r2*100,0)+'% das variações do período; a faixa normal (±1 desvio dos erros) é de ±'+fx((Math.exp(B.sd)-1)*100,1)+'%.</p><div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">Fator</th><th>Coeficiente</th><th style="text-align:left">Último valor</th></tr></thead><tbody>'
     +B.beta.map((b,i)=>'<tr><td style="text-align:left">'+nm[i]+'</td><td>'+fx(b,3)+'</td><td style="text-align:left"><small>'+(val[i]?fx(val[i].valor,2)+' em '+fdate(Date.parse(val[i].data)):i===1?'IPCA e CPI até '+mname(fxYm(B.to)):'—')+'</small></td></tr>').join("")+'</tbody></table></div>'
     +((!B.embiOk||!B.coOk)?'<p class="sub" style="font-size:.8rem">Ficou de fora: '+[!B.coOk?'commodities (fonte indisponível)':'',!B.embiOk?'risco-país (a série pública do EMBI+ Brasil foi encerrada em 2024)':''].filter(Boolean).join(' e ')+'.</p>':'')+'</details>'}
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Fontes: Banco Central (PTAX, paridades para o índice do dólar'+(B&&B.coOk?' e IC-Br em dólares, para as commodities':'')+'), IBGE (IPCA), BLS (CPI dos EUA), Fed de Nova York (SOFR)'+(B&&B.embiOk?', Ipeadata/J.P. Morgan (EMBI+ Brasil)':'')+'. O dólar de hoje usa '+(spot!==FX._v[FX._v.length-1]?'o último boletim da PTAX':'a PTAX de fechamento')+'.</p>';
  return h;
}

