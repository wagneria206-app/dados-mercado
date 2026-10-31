/* ---------- Dólar: PTAX do Banco Central ---------- */
let FX=null,FX_LOADING=false,FX_PER="1y",FX_MA=false,FXF=null,FXJ=null,FX_F1=false;
try{FX_PER=localStorage.getItem("fxPer")||"1y";FX_MA=localStorage.getItem("fxMa")==="1";FX_F1=localStorage.getItem("fxF1")==="1"}catch(e){}
const FX_PERS=[["1m","1 mês",1],["3m","3 meses",3],["6m","6 meses",6],["1y","1 ano",12],["2y","2 anos",24],["5y","5 anos",60],["10y","10 anos",120],["all","Desde 1995",0]];
function fxTopHtml(){const d=FX_TOP;if(!d||!d.venda)return "";const b=d.boletim&&d.boletim.data>d.data?d.boletim:null,v=b?b.venda:d.venda,ref=b?d.venda:d.anterior&&d.anterior.venda,ch=ref?(v/ref-1)*100:NaN;
  return '<span class="fxtop" data-fxgo="1" title="Abrir o acompanhamento do dólar">Dólar PTAX<b>'+fx(v,4)+(isFinite(ch)?' <small class="'+(ch>0?'neg':ch<0?'pos':'')+'">'+(ch>0?'▲':ch<0?'▼':'')+fx(Math.abs(ch),2)+'%</small>':'')+'</b></span>'}
async function fxLoad(){if(FX_LOADING)return;FX_LOADING=true;try{const [D,F2,J2]=await Promise.all([roboJson("dolar.json"),roboJson("dolar_futuro.json").catch(()=>null),roboJson("dolar_fundamentos.json").catch(()=>null)]);if(D&&Array.isArray(D.serie)&&D.serie.length){FX=D;FX._t=D.serie.map(r=>Date.parse(r[0]+"T00:00:00Z"));FX._v=D.serie.map(r=>+r[2]);FX._ma50=fxMA(FX._v,50);FX._ma200=fxMA(FX._v,200)}FXF=F2&&F2.dias&&Object.keys(F2.dias).length?F2:null;FXJ=J2&&J2.mensal&&J2.mensal.cpi_eua?J2:null;FX_IPCA=null;if(FX){FX._f1=fxFront1();FX._m=null}}catch(e){if(!FX){const o=$("fxOut");if(o)o.innerHTML='<p class="err">Não deu para ler os dados do dólar agora. Toque em Atualizar dados em instantes.</p>'}}finally{FX_LOADING=false}if(FX&&activeMod==="fx")fxCalc()}
function fxMA(V,n){const o=new Array(V.length).fill(NaN);let s=0;for(let i=0;i<V.length;i++){s+=V[i];if(i>=n)s-=V[i-n];if(i>=n-1)o[i]=s/n}return o}
function fxIdx(t){const T=FX._t;let lo=0,hi=T.length-1;if(t<T[0])return -1;if(t>=T[hi])return hi;while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=t)lo=m;else hi=m}return lo}
function fxPct(a,b){return isFinite(a)&&isFinite(b)&&b>0?(a/b-1)*100:NaN}
function fxSigned(x){return isFinite(x)?'<span class="'+(x>0?'neg':x<0?'pos':'')+'">'+(x>0?'+':x<0?'−':'')+fx(Math.abs(x),2)+'%</span>':'—'}
function fxCalc(){
  const o=$("fxOut");if(!o)return;if(!FX){o.innerHTML='<p class="sub">Carregando a série do dólar (Banco Central)…</p>';fxLoad();return}
  const S=FX.serie,T=FX._t,V=FX._v,n=S.length,L=S[n-1],tL=T[n-1],vL=V[n-1];
  const B=FX.boletins&&Array.isArray(FX.boletins.lista)&&FX.boletins.lista.length?FX.boletins:null,live=B&&B.data>L[0]?B.lista[B.lista.length-1]:null;
  const back=t=>{const i=fxIdx(t);return i>=0?V[i]:NaN},dAgo=k=>tL-k*DAY,mAgo=k=>{const d=new Date(tL);d.setUTCMonth(d.getUTCMonth()-k);return d.getTime()};
  const yStart=Date.UTC(new Date(tL).getUTCFullYear(),0,1)-DAY,mStart=Date.UTC(new Date(tL).getUTCFullYear(),new Date(tL).getUTCMonth(),1)-DAY;
  const VR=[["Dia",n>1?V[n-2]:NaN],["Semana",back(dAgo(7))],["No mês",back(mStart)],["No ano",back(yStart)],["12 meses",back(mAgo(12))],["5 anos",back(mAgo(60))]];
  let h='<span class="label">Dólar comercial (PTAX)</span><p class="sub" style="margin-top:4px">Taxa oficial do Banco Central: média das consultas feitas aos bancos às 10h, 11h, 12h e 13h. É a referência de contratos, fundos e balanços.</p>';
  h+='<div class="tot" style="margin-top:10px"><div><span class="n">PTAX venda · fechamento de '+fdate(tL)+'</span><span class="v">R$ '+fx(vL,4)+'</span><span class="n">compra R$ '+fx(+L[1],4)+'</span></div>';
  if(live)h+='<div><span class="n">Hoje, boletim das '+esc(live.hora)+' ('+esc(String(live.tipo).toLowerCase())+')</span><span class="v">R$ '+fx(+live.venda,4)+'</span><span class="n">'+fxSigned(fxPct(+live.venda,vL))+' sobre o fechamento anterior</span></div>';
  else h+='<div><span class="n">Boletins de hoje</span><span class="v" style="font-size:1rem">'+(B&&B.data===L[0]?'Fechamento já divulgado':'Saem às 10h, 11h, 12h e 13h')+'</span><span class="n">o app atualiza sozinho a cada 30 minutos</span></div>';
  h+='</div><div class="fxvar">'+VR.map(([k,b])=>'<div><span>'+k+'</span><b>'+fxSigned(fxPct(vL,b))+'</b></div>').join("")+'</div>';
  // gráfico do período
  const P=FX_PERS.find(p=>p[0]===FX_PER)||FX_PERS[3],t0=P[2]?mAgo(P[2]):T[0];let i0=Math.max(0,fxIdx(t0));if(T[i0]<t0&&i0<n-1)i0++;
  h+='<div class="fxctl"><div class="fxper" role="group" aria-label="Período">'+FX_PERS.map(p=>'<button type="button" data-fxper="'+p[0]+'" aria-pressed="'+(p[0]===P[0])+'">'+p[1]+'</button>').join("")+'</div><label class="fxma"><input type="checkbox" data-fxma'+(FX_MA?' checked':'')+'> Médias móveis de 50 e 200 dias</label>'+(FXF?'<label class="fxma"><input type="checkbox" data-fxf1'+(FX_F1?' checked':'')+'> Dólar futuro (1º vencimento)</label>':'')+'</div>';
  h+=fxChart(i0,n-1);
  // estatísticas do período
  let mn=i0,mx=i0,sum=0,lr=[];for(let i=i0;i<n;i++){if(V[i]<V[mn])mn=i;if(V[i]>V[mx])mx=i;sum+=V[i];if(i>i0)lr.push(Math.log(V[i]/V[i-1]))}
  const avg=sum/(n-i0),mu=lr.reduce((a,b)=>a+b,0)/(lr.length||1),sd=Math.sqrt(lr.reduce((a,b)=>a+(b-mu)*(b-mu),0)/Math.max(1,lr.length-1)),vol=sd*Math.sqrt(252)*100;
  let below=0;for(let i=i0;i<n;i++)if(V[i]<vL)below++;const pct=below/(n-i0)*100;
  h+='<div class="tablewrap" style="max-height:none;margin-top:10px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">No período ('+esc(P[1].toLowerCase())+')</th><th>Valor</th><th style="text-align:left">Observação</th></tr></thead><tbody>'
   +'<tr><td style="text-align:left">Variação</td><td>'+fxSigned(fxPct(vL,V[i0]))+'</td><td style="text-align:left"><small>de R$ '+fx(V[i0],4)+' em '+fdate(T[i0])+'</small></td></tr>'
   +'<tr><td style="text-align:left">Mínima</td><td>R$ '+fx(V[mn],4)+'</td><td style="text-align:left"><small>em '+fdate(T[mn])+'</small></td></tr>'
   +'<tr><td style="text-align:left">Máxima</td><td>R$ '+fx(V[mx],4)+'</td><td style="text-align:left"><small>em '+fdate(T[mx])+' · hoje está '+fx(Math.abs(fxPct(vL,V[mx])),1)+'% abaixo</small></td></tr>'
   +'<tr><td style="text-align:left">Média</td><td>R$ '+fx(avg,4)+'</td><td style="text-align:left"><small>hoje está '+fxSigned(fxPct(vL,avg))+' em relação à média</small></td></tr>'
   +'<tr><td style="text-align:left">Percentil de hoje</td><td>'+fx(pct,0)+'</td><td style="text-align:left"><small>o dólar esteve mais barato que hoje em '+fx(pct,0)+'% dos dias do período</small></td></tr>'
   +'<tr><td style="text-align:left">Volatilidade anualizada</td><td>'+fx(vol,1)+'%</td><td style="text-align:left"><small>desvio-padrão das variações diárias × √252</small></td></tr>'
   +'</tbody></table></div>';
  h+=fxJustoHtml(live?+live.venda:vL)+fxFutHtml();
  // boletins do dia
  if(B)h+='<div class="label" style="margin-top:14px">Boletins de '+fdate(Date.parse(B.data+"T00:00:00Z"))+'</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab"><thead><tr><th style="text-align:left">Horário</th><th style="text-align:left">Boletim</th><th>Compra</th><th>Venda</th></tr></thead><tbody>'+B.lista.map(b=>'<tr><td style="text-align:left">'+esc(b.hora)+'</td><td style="text-align:left">'+esc(b.tipo)+'</td><td>'+fx(+b.compra,4)+'</td><td>'+fx(+b.venda,4)+'</td></tr>').join("")+'</tbody></table></div>';
  // fechamentos mensais
  const M=[];for(let i=n-1;i>=0&&M.length<14;i--){const d=new Date(T[i]),k=d.getUTCFullYear()*12+d.getUTCMonth();if(!M.length||M[M.length-1].k!==k)M.push({k,i})}
  const yEnd=y=>back(Date.UTC(y,0,1)-DAY);
  h+='<div class="label" style="margin-top:14px">Fechamento de cada mês</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab"><thead><tr><th style="text-align:left">Mês</th><th>Último dia</th><th>PTAX venda</th><th>No mês</th><th>No ano</th></tr></thead><tbody>'
   +M.slice(0,13).map((m,j)=>{const prev=M[j+1],y=new Date(T[m.i]).getUTCFullYear();return '<tr><td style="text-align:left">'+mname(m.k)+(m.i===n-1?' <small>(até agora)</small>':'')+'</td><td>'+fdate(T[m.i])+'</td><td>'+fx(V[m.i],4)+'</td><td>'+(prev?fxSigned(fxPct(V[m.i],V[prev.i])):'—')+'</td><td>'+fxSigned(fxPct(V[m.i],yEnd(y)))+'</td></tr>'}).join("")+'</tbody></table></div>';
  // conversor
  h+='<div class="label" style="margin-top:14px">Conversor pela PTAX</div><div class="fxconv" style="margin-top:6px"><div class="field"><label for="fxAmt">Valor</label><input id="fxAmt" inputmode="decimal" value="'+esc(FX.amt||"1.000,00")+'"></div><div class="field"><label for="fxCur">Moeda do valor</label><select id="fxCur"><option value="USD"'+(FX.cur!=="BRL"?' selected':'')+'>Dólares (US$)</option><option value="BRL"'+(FX.cur==="BRL"?' selected':'')+'>Reais (R$)</option></select></div></div><div id="fxConvOut" style="margin-top:6px"></div>';
  h+='<p class="sub" style="font-size:.82rem;margin-top:10px">Fonte: Banco Central do Brasil, PTAX (API de dados abertos). Fechamento = média dos 4 boletins do dia. Variações sobre o fechamento da PTAX venda; ▲ em vermelho = real perdendo valor. Bancos e casas de câmbio cobram spread e IOF sobre a cotação de referência, então o valor de uma operação real difere do conversor. Atualizado em '+(FX.atualizadoEm?fdt(FX.atualizadoEm):"—")+'.</p>';
  o.innerHTML=h;fxConv();
}
function fxChart(i0,i1){
  const T=FX._t,V=FX._v,NW=window.innerWidth<640,W=NW?420:chartW(),H=NW?330:chartH(250,W),PL=NW?44:52,PR=10,PT=14,PB=28,cnt=i1-i0+1,step=Math.max(1,Math.ceil(cnt/(NW?500:900)));
  const idx=[];for(let i=i0;i<=i1;i+=step)idx.push(i);if(idx[idx.length-1]!==i1)idx.push(i1);
  const series=[["v",V,"var(--accent)",2.2]];if(FX_MA){series.push(["m50",FX._ma50,"var(--s2)",1.4],["m200",FX._ma200,"var(--s3)",1.4])}if(FX_F1&&FX._f1)series.push(["f1",FX._f1,"var(--s4)",1.6]);
  let lo=Infinity,hi=-Infinity,mn=i0,mx=i0;for(let i=i0;i<=i1;i++){if(V[i]<V[mn])mn=i;if(V[i]>V[mx])mx=i;series.forEach(([,A])=>{const v=A[i];if(isFinite(v)){lo=Math.min(lo,v);hi=Math.max(hi,v)}})}
  const pad=(hi-lo)*0.06||0.05;lo-=pad;hi+=pad;const st=niceStep((hi-lo)/5);lo=Math.floor(lo/st)*st;hi=Math.ceil(hi/st)*st;
  const X=t=>PL+(t-T[i0])/Math.max(1,T[i1]-T[i0])*(W-PL-PR),Y=v=>PT+(hi-v)/(hi-lo)*(H-PT-PB);
  let g='';for(let v=lo;v<=hi+st/2;v+=st){const y=Y(v);g+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-dasharray="2 4"/><text x="'+(PL-6)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+fx(v,st>=1?0:Math.abs(st*10-Math.round(st*10))<1e-9?1:2)+'</text>'}
  const span=T[i1]-T[i0],ny=span/DAY/365.25,ticks=[];
  if(ny>2){const y0=new Date(T[i0]).getUTCFullYear(),sy=ny>16?5:ny>8?2:1;for(let y=Math.ceil(y0/sy)*sy;y<=new Date(T[i1]).getUTCFullYear();y+=sy){const t=Date.UTC(y,0,1);if(t>=T[i0])ticks.push([t,String(y)])}}
  else{const d=new Date(T[i0]);let k=d.getUTCFullYear()*12+d.getUTCMonth()+1;const sm=ny>1?3:span>100*DAY?1:0;if(sm){for(;;k+=sm){const t=Date.UTC(Math.floor(k/12),k%12,1);if(t>T[i1])break;ticks.push([t,mname(k)])}}else{for(let t=T[i0];t<=T[i1];t+=7*DAY)ticks.push([t,txD2(t).slice(0,5)])}}
  const maxT=NW?5:9,ev=Math.max(1,Math.ceil(ticks.length/maxT));ticks.filter((_,j)=>j%ev===0).forEach(([t,l])=>{g+='<text x="'+X(t).toFixed(1)+'" y="'+(H-PB+16)+'" text-anchor="middle">'+l+'</text>'});
  series.slice().reverse().forEach(([k,A,col,w])=>{let d='',pen=false;idx.forEach(i=>{const v=A[i];if(!isFinite(v)){pen=false;return}d+=(pen?'L':'M')+X(T[i]).toFixed(1)+' '+Y(v).toFixed(1)+' ';pen=true});g+='<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="'+w+'" stroke-linejoin="round"/>'});
  [[mx,"Máx."],[mn,"Mín."]].forEach(([i,l])=>{const x=X(T[i]),y=Y(V[i]);g+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="3.5" fill="'+(l==="Máx."?"var(--neg,#b3261e)":"var(--pos,#17694a)")+'"/>'});
  g+='<line class="cvx" x1="0" x2="0" y1="'+PT+'" y2="'+(H-PB)+'" stroke="var(--ink)" stroke-width="1" opacity="0"/>';
  const meta={W,PL,PR,t0:T[i0],t1:T[i1],pts:idx.map(i=>[T[i],+V[i].toFixed(4),FX_MA&&isFinite(FX._ma50[i])?+FX._ma50[i].toFixed(4):null,FX_MA&&isFinite(FX._ma200[i])?+FX._ma200[i].toFixed(4):null,FX_F1&&FX._f1&&isFinite(FX._f1[i])?+FX._f1[i].toFixed(4):null])};
  return '<div class="fxchart" data-fxc=\''+JSON.stringify(meta)+'\'><svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Dólar PTAX no período">'+g+'<rect x="'+PL+'" y="'+PT+'" width="'+(W-PL-PR)+'" height="'+(H-PT-PB)+'" fill="transparent"/></svg><div class="cvtip" hidden></div></div>'+(FX_MA||FX_F1?'<div class="legend"><span><i style="background:var(--accent)"></i>PTAX venda</span>'+(FX_MA?'<span><i style="background:var(--s2)"></i>Média de 50 dias</span><span><i style="background:var(--s3)"></i>Média de 200 dias</span>':'')+(FX_F1?'<span><i style="background:var(--s4)"></i>Dólar futuro, 1º vencimento (ajuste B3)</span>':'')+'</div>':'');
}
function fxConv(){const out=$("fxConvOut");if(!out||!FX)return;const a=num($("fxAmt").value),c=$("fxCur").value,L=FX.serie[FX.serie.length-1],cp=+L[1],vd=+L[2];FX.amt=$("fxAmt").value;FX.cur=c;
  if(!(a>0)){out.innerHTML='<p class="sub">Informe um valor.</p>';return}
  out.innerHTML=c==="USD"?'<p>Comprar US$ '+fx(a,2)+' custa <b>'+brl(a*vd)+'</b> pela PTAX venda ('+fx(vd,4)+'). Vender US$ '+fx(a,2)+' rende <b>'+brl(a*cp)+'</b> pela PTAX compra ('+fx(cp,4)+').</p>'
    :'<p>Com '+brl(a)+' se compram <b>US$ '+fx(a/vd,2)+'</b> pela PTAX venda ('+fx(vd,4)+'). Para receber '+brl(a)+' é preciso vender <b>US$ '+fx(a/cp,2)+'</b> pela PTAX compra ('+fx(cp,4)+').</p>'}
document.addEventListener("click",e=>{const t=e.target.closest&&e.target.closest("[data-fxper],[data-fxgo]");if(!t)return;
  if(t.dataset.fxgo){setMod("fx");try{window.scrollTo({top:0,behavior:"smooth"})}catch(x){}return}
  FX_PER=t.dataset.fxper;try{localStorage.setItem("fxPer",FX_PER)}catch(x){}const y=window.scrollY;fxCalc();window.scrollTo(0,y)});
document.addEventListener("change",e=>{if(e.target.matches&&e.target.matches("[data-fxf1]")){FX_F1=e.target.checked;try{localStorage.setItem("fxF1",FX_F1?"1":"0")}catch(x){}const y=window.scrollY;fxCalc();window.scrollTo(0,y);return}if(e.target.matches&&e.target.matches("[data-fxma]")){FX_MA=e.target.checked;try{localStorage.setItem("fxMa",FX_MA?"1":"0")}catch(x){}const y=window.scrollY;fxCalc();window.scrollTo(0,y)}else if(e.target.id==="fxCur")fxConv()});
document.addEventListener("input",e=>{if(e.target.id==="fxAmt")fxConv()});
document.addEventListener("mousemove",e=>{const box=e.target.closest&&e.target.closest(".fxchart");document.querySelectorAll(".fxchart").forEach(b=>{if(b!==box){const t=b.querySelector(".cvtip");if(t&&!t.hidden)t.hidden=true;const l=b.querySelector(".cvx");if(l)l.setAttribute("opacity","0")}});if(!box)return;
  let M;try{M=JSON.parse(box.dataset.fxc)}catch(x){return}const svg=box.querySelector("svg"),R=svg.getBoundingClientRect(),sx=R.width/M.W,px=(e.clientX-R.left)/sx,t=M.t0+(px-M.PL)/(M.W-M.PL-M.PR)*(M.t1-M.t0);
  let best=M.pts[0];for(const p of M.pts)if(Math.abs(p[0]-t)<Math.abs(best[0]-t))best=p;const X=M.PL+(best[0]-M.t0)/Math.max(1,M.t1-M.t0)*(M.W-M.PL-M.PR);
  const ln=box.querySelector(".cvx");ln.setAttribute("x1",X);ln.setAttribute("x2",X);ln.setAttribute("opacity",".35");
  const tip=box.querySelector(".cvtip");tip.innerHTML='<b>'+fdate(best[0])+'</b><span><i style="background:var(--accent)"></i>PTAX venda: R$ '+fx(best[1],4)+'</span>'+(best[2]!=null?'<span><i style="background:var(--s2)"></i>Média 50 dias: '+fx(best[2],4)+'</span>':'')+(best[3]!=null?'<span><i style="background:var(--s3)"></i>Média 200 dias: '+fx(best[3],4)+'</span>':'')+(best[4]!=null?'<span><i style="background:var(--s4)"></i>Futuro 1º venc.: '+fx(best[4],4)+'</span>':'');
  tip.hidden=false;const bx=box.getBoundingClientRect(),left=X*sx+12;tip.style.top="8px";tip.style.left=(left+tip.offsetWidth>bx.width?Math.max(0,X*sx-tip.offsetWidth-12):left)+"px"});

applyData(DATA0);
buildOptions();applyFam();renderMkt();
pcBind();pcList();
let m0="rs";try{m0=inicioMod()||localStorage.getItem("mod2")||"rs"}catch(e){}
scBind();
extBind();
txBind();
if(m0!=="pub"){try{calc()}catch(e){}}
setMod(["pub","pc","bank","fund","sc","sim","tx","mk","fx","rs","ec","mu","ju","cr","in","ix","fa","fr","fc","fg","aa","ar","ac","au","ag","sp"].includes(m0)?m0:"rs");
setStat("Dados de "+fdate(VAL)+"."+checkLine(),CHK.bad.length?"bad":"ok");


