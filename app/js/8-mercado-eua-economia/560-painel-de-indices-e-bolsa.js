/* ===== Painel de índices e Bolsa americana (Cboe, Nasdaq, Tesouro dos EUA, SEC; B3 e Banco Central) ===== */
const EU_URL="https://raw.githubusercontent.com/wagneria206-app/dados-mercado/eua/";
const EU={ix:null,idx:null,C:null,S:null,B:null,cal:null,emp:new Map(),load:null,err:null,per:"12",
  rk:{setor:"",liq:1e5,txt:"",sort:"mcap",dir:-1,n:50}};
try{const r=JSON.parse(localStorage.getItem("euRk")||"null");if(r&&typeof r==="object")Object.assign(EU.rk,r,{n:50})}catch(e){}
try{const p=localStorage.getItem("euPer");if(p)EU.per=p}catch(e){}
function euSave(){try{localStorage.setItem("euRk",JSON.stringify(EU.rk));localStorage.setItem("euPer",EU.per)}catch(e){}}
const euGet=p=>fetch(EU_URL+p,{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status+" em "+p);return r.json()});
function euRefresh(){if(typeof activeMod==="undefined")return;if((activeMod==="rs"||activeMod==="ju"||activeMod==="mu")&&typeof mkCalc==="function")mkCalc();else if(activeMod==="au")euCalc();else if(activeMod==="sp"&&typeof spRun==="function")spRun();else if(activeMod==="aa"&&typeof atAa==="function"&&$("euEmp"))euEmpFill()}
function euBoot(){
  if(EU.S||EU.load)return EU.load;EU.err=null;
  const b3=(typeof AT==="object"&&AT.B&&AT.cal)?Promise.resolve([{d:AT.cal},AT.B]):Promise.all([fetch(AT_URL+"cal.json",{cache:"no-cache"}).then(r=>r.ok?r.json():null).catch(()=>null),fetch(AT_URL+"bench.json",{cache:"no-cache"}).then(r=>r.ok?r.json():null).catch(()=>null)]);
  EU.load=Promise.all([euGet("indices.json").catch(e=>{EU.err=e;return null}),euGet("idx.json").catch(()=>null),b3]).then(([ix,idx,[c,b]])=>{
    EU.ix=ix;if(idx){EU.idx=idx;EU.C={};idx.cols.forEach((n,k)=>EU.C[n]=k)}
    const S={},T=d=>Date.parse(d+"T00:00:00Z");
    if(ix&&ix.d){const t=ix.d.map(T);Object.keys(ix.s).forEach(k=>{const a=ix.s[k],o=[];for(let i=0;i<a.length;i++)if(a[i]!=null)o.push([t[i],a[i]]);S[k]=o})}
    if(c&&c.d&&b&&b.d){const t=c.d.map(T);["ibov","ifix","usd"].forEach(k=>{const a=b.d[k];if(!a)return;const o=[];let ult=null;for(let i=0;i<a.length;i++){if(a[i]==null||a[i]===ult&&k!=="usd")continue;o.push([t[i],a[i]]);ult=a[i]}S[k]=o});
      if(b.d.cdi){const o=[];let v=1;for(let i=0;i<t.length;i++){const r=b.d.cdi[i];if(r==null)continue;v*=1+r/100;if(r>0||!o.length)o.push([t[i],v])}S.cdi=o}}
    if(S.spx&&S.usd){const U=S.usd;S.spxbrl=S.spx.map(([t,v])=>{const u=euAt(U,t);return u?[t,v*u[1]]:null}).filter(Boolean)}
    EU.S=S;EU.load=null;euRefresh();
  }).catch(e=>{EU.err=e;EU.load=null;euRefresh()});
  return EU.load;
}
function euAt(P,t){if(!P||!P.length||P[0][0]>t)return null;let lo=0,hi=P.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(P[m][0]<=t)lo=m;else hi=m-1}return P[lo]}
function euMoney(v,cur){if(v==null||!isFinite(v))return "—";const p=(!cur||cur==="USD")?"US$ ":cur+" ",a=Math.abs(v),s=v<0?"−":"";return a>=1e12?s+p+fx(a/1e12,2)+" tri":a>=1e9?s+p+fx(a/1e9,1)+" bi":a>=1e6?s+p+fx(a/1e6,0)+" mi":s+p+fx(a,0)}
const EU_SER={ibov:["Ibovespa","B3","pts"],ifix:["IFIX","B3","pts"],usd:["Dólar (PTAX)","Banco Central","brl"],spx:["S&P 500","Cboe","pts"],comp:["Nasdaq Composite","Nasdaq","pts"],
  djia:["Dow Jones","Cboe (DJX × 100)","pts"],ndx:["Nasdaq-100","Nasdaq","pts"],vix:["VIX (volatilidade do S&P 500)","Cboe","vix"],t10:["Treasury 10 anos","Tesouro dos EUA","tx"],
  t2:["Treasury 2 anos","Tesouro dos EUA","tx"],t3m:["Treasury 3 meses","Tesouro dos EUA","tx"],spxbrl:["S&P 500 em reais","Cboe × PTAX","pts"],cdi:["CDI","Banco Central","idx"]};
/* variação entre o último ponto e o último ponto antes de 'ini' (ou no máximo em 'ate') */
function euVar(P,k,base){if(!P||P.length<2||!base)return null;const u=P[P.length-1],tx=EU_SER[k][2]==="tx"||EU_SER[k][2]==="vix";return tx?u[1]-base[1]:(u[1]/base[1]-1)*100}
function euBase(P,per){if(!P||P.length<2)return null;const u=P[P.length-1],d=new Date(u[0]);
  if(per==="dia")return P[P.length-2];
  if(per==="mes")return euAt(P,Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)-1);
  if(per==="ano")return euAt(P,Date.UTC(d.getUTCFullYear(),0,1)-1);
  const n=+per,t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-n,d.getUTCDate());if(P[0][0]>t+7*DAY)return null;return euAt(P,t)}
function euFmtV(k,v){const f=EU_SER[k][2];return f==="tx"?fx(v,2)+"%":f==="brl"?"R$ "+fx(v,4):f==="vix"?fx(v,2):f==="idx"?fx(v,4):fx(v,v>=1000?0:2)}
function euFmtD(k,v){if(v==null||!isFinite(v))return "—";const f=EU_SER[k][2];if(f==="tx"){const b=Math.round(v*100);return '<span class="'+(b>0?"neg":b<0?"pos":"")+'">'+(b>0?"+":b<0?"−":"")+Math.abs(b)+' bps</span>'}if(f==="vix")return '<span class="'+(v>0?"neg":v<0?"pos":"")+'">'+(v>0?"+":v<0?"−":"")+fx(Math.abs(v),2)+'</span>';return fnPct(v)}
function euSpark(P,k){const L=P.slice(-66);if(L.length<5)return "";let lo=Infinity,hi=-Infinity;L.forEach(p=>{lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1])});const W=120,H=28,t0=L[0][0],t1=L[L.length-1][0];
  const up=L[L.length-1][1]>=L[0][1],bad=EU_SER[k][2]==="tx"||EU_SER[k][2]==="vix"?up:!up;
  const d=L.map((p,i)=>(i?"L":"M")+((p[0]-t0)/Math.max(1,t1-t0)*W).toFixed(1)+" "+(H-2-(p[1]-lo)/Math.max(1e-9,hi-lo)*(H-4)).toFixed(1)).join(" ");
  return '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><path d="'+d+'" fill="none" stroke="'+(bad?"var(--loss)":"var(--gain)")+'" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>'}
function euCard(k){const P=EU.S&&EU.S[k];if(!P||P.length<3)return "";const u=P[P.length-1],[nome]=EU_SER[k];
  if(k==="cdi"){const r12=euVar(P,k,euBase(P,"12")),ra=euVar(P,k,euBase(P,"ano"));return '<div class="pnlc"><span>CDI acumulado</span><b>'+(r12!=null?fx(r12,2)+'%':'—')+'</b><small>12 meses · no ano '+(ra!=null?fx(ra,2)+'%':'—')+'</small>'+euSpark(P,k)+'</div>'}
  const dd=euVar(P,k,euBase(P,"dia")),dm=euVar(P,k,euBase(P,"mes")),da=euVar(P,k,euBase(P,"ano")),d12=euVar(P,k,euBase(P,"12"));
  return '<div class="pnlc"><span>'+esc(nome)+' <em>'+fdate(u[0]).slice(0,5)+(k==="usd"&&EU.usdHora?' · '+esc(EU.usdHora)+', parcial':'')+'</em></span><b>'+euFmtV(k,u[1])+' <i>'+euFmtD(k,dd)+'</i></b><small>mês '+euFmtD(k,dm)+' · ano '+euFmtD(k,da)+' · 12m '+euFmtD(k,d12)+'</small>'+euSpark(P,k)+'</div>'}
const EU_PERS=[["1","1 mês"],["6","6 meses"],["ano","No ano"],["12","12 meses"],["36","3 anos"],["60","5 anos"]];
function euPerfChart(keys,cols){
  const S=EU.S,out=[];let tA=0;keys.forEach(k=>{const P=S[k];if(P&&P.length)tA=Math.max(tA,P[P.length-1][0])});
  keys.forEach((k,j)=>{const P=S[k];if(!P||P.length<3)return;const b=euBase(P,EU.per);if(!b)return;const pts=P.filter(p=>p[0]>b[0]).map(p=>[p[0],(p[1]/b[1]-1)*100]);pts.unshift([b[0],0]);out.push({lab:EU_SER[k][0],col:cols[j],w:k==="cdi"?1.6:2,dash:k==="cdi"?"4 3":"none",pts:fnThin(pts.map(p=>({t:p[0],v:p[1]})),500).map(p=>[p.t,p.v])})});
  return fnSeg("euper",EU_PERS,EU.per)+fnChart(out,{fmt:"pct",zero:true,h:240,legend:true,aria:"Desempenho comparado"})}
function euTabela(keys){
  const cols=[["dia","Dia",""],["mes","Mês",""],["ano","Ano",""],["12","12m",""],["36","36m","c-ph"],["60","60m","c-ph"]];
  let h='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab"><thead><tr><th style="text-align:left">Índice</th><th class="c-ph">Último</th>'+cols.map(c=>'<th class="'+c[2]+'">'+c[1]+'</th>').join("")+'</tr></thead><tbody>';
  keys.forEach(k=>{const P=EU.S[k];if(!P||P.length<3)return;const u=P[P.length-1];h+='<tr><td style="text-align:left">'+esc(EU_SER[k][0])+' <small>'+fdate(u[0]).slice(0,5)+'</small></td><td class="c-ph">'+(k==="cdi"?"—":euFmtV(k,u[1]))+'</td>'+cols.map(c=>'<td class="'+c[2]+'">'+euFmtD(k,euVar(P,k,euBase(P,c[0])))+'</td>').join("")+'</tr>'});
  return h+'</tbody></table></div>'}
/* painel resumo (Mercado › Resumo e Bolsa › EUA) */
/* PTAX do dia (robô de mercado, Banco Central) entra antes de a base da Bolsa ter o pregão de hoje */
function euUsdHoje(){try{const d=(typeof FX_TOP!=="undefined"&&FX_TOP)||null,U=EU.S&&EU.S.usd;if(!d||!d.data||!(+d.venda>0)||!U||!U.length)return;
  const put=(dt,v)=>{const t=Date.parse(dt+"T00:00:00Z");if(t>U[U.length-1][0])U.push([t,v]);else if(t===U[U.length-1][0])U[U.length-1][1]=v};
  put(d.data,+d.venda);const b=d.boletim;EU.usdHora=null;if(b&&b.data>d.data&&+b.venda>0){put(b.data,+b.venda);EU.usdHora=b.hora||"parcial"}}catch(e){}}
function painelHtml(modo){
  if(!EU.S){euBoot();return EU.err&&!EU.load?'':'<p class="sub">Carregando o painel de índices…</p>'}
  euUsdHoje();
  const eua=modo==="eua";
  const cards=eua?["spx","comp","djia","ndx","vix","t10","usd"]:["ibov","ifix","spx","comp","djia","usd","spxbrl","vix","t10","cdi"];
  let h=(eua?'':'<div class="fnacts" style="float:right;margin-left:10px"><button type="button" class="btn sec" data-rel="mk">Relatório de mercado (PDF)</button></div>')+'<span class="label">'+(eua?'Bolsa americana hoje':'Painel de índices')+'</span><p class="sub" style="margin-top:4px">'+(eua?'Fechamento mais recente de cada índice, com a variação no dia, no mês, no ano e em 12 meses. Juros e VIX mostram a variação em pontos.':'Bolsas do Brasil e dos EUA, dólar e juros: fechamento mais recente de cada um, com a variação no dia, no mês, no ano e em 12 meses (a data aparece ao lado do nome).')+'</p>';
  h+='<div class="pnlg">'+cards.map(euCard).join("")+'</div>';
  const keys=eua?["spx","comp","djia","ndx","ibov","spxbrl"]:["ibov","spx","comp","djia","spxbrl","usd","cdi"];
  h+='<div class="label" style="margin-top:14px">Desempenho comparado (%)</div>'+euPerfChart(keys,["#2563eb","#dc2626","#16a34a","#9333ea","#f59e0b","#0891b2","#64748b"]);
  h+=euTabela(eua?["spx","comp","djia","ndx","vix","t10","t2","t3m","usd","spxbrl","ibov"]:["ibov","ifix","spx","comp","djia","ndx","spxbrl","usd","vix","t10","cdi"]);
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Índices de preço (sem dividendos), cada um no último fechamento disponível (a data aparece ao lado). Ibovespa e IFIX entram com o fechamento oficial da B3, publicado na manhã do dia seguinte. S&P 500 em reais = S&P 500 × dólar PTAX do mesmo dia (o que um investidor brasileiro teria sem proteção cambial). Fontes: B3 (Ibovespa e IFIX), Banco Central (dólar PTAX e CDI), Cboe (S&P 500, VIX e Dow Jones, pelo índice DJX × 100), Nasdaq (Nasdaq Composite e Nasdaq-100) e Departamento do Tesouro dos EUA (juros dos Treasuries).'+(EU.usdHora?' Dólar com o boletim parcial da PTAX de hoje.':'')+(eua?' bps = centésimos de ponto percentual.':'')+'</p>';
  return h;
}

