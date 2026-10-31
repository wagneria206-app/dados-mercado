/* ===== Economia (Brasil) e EUA e mundo: Focus, IBGE, Banco Central, Tesouro, BLS, Fed e EIA ===== */
const MC_URL="https://raw.githubusercontent.com/wagneria206-app/dados-mercado/macro/";
const MC={d:null,load:null,err:null};
function mcBoot(){if(MC.d||MC.load)return;MC.load=fetch(MC_URL+"macro.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(j=>{MC.d=j;MC.load=null;mcRefresh()}).catch(e=>{MC.err=e;MC.load=null;mcRefresh()})}
function mcRefresh(){if(typeof activeMod!=="undefined"&&(activeMod==="ec"||activeMod==="mu")&&typeof mkCalc==="function")mkCalc()}
/* datas: "2026-09" (mês), "202609" (mês do IBGE), "202602" com trimestre (PIB) */
const mcTm=s=>{s=String(s);return s.length===7?Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,15):Date.UTC(+s.slice(0,4),+s.slice(4,6)-1,15)};
const mcTq=s=>{s=String(s);return Date.UTC(+s.slice(0,4),(+s.slice(4,6)-1)*3+1,15)};
const mcTd=s=>Date.parse(s+"T00:00:00Z");
const mcLast=L=>L&&L.length?L[L.length-1]:null;
const mcMes=s=>{const t=mcTm(s),d=new Date(t);return mname(d.getUTCFullYear()*12+d.getUTCMonth())};
const mcTri=s=>String(s).slice(5,6)+"º tri/"+String(s).slice(2,4);
const mcSig=(v,d,suf)=>v==null||!isFinite(v)?"—":'<span class="'+(v>0?"pos":v<0?"neg":"")+'">'+(v>0?"+":v<0?"−":"")+fx(Math.abs(v),d==null?1:d)+(suf==null?"%":suf)+'</span>';
const mcKp=(a,b,c)=>'<div class="fnkp"><span>'+a+'</span><b>'+b+'</b>'+(c?'<small>'+c+'</small>':'')+'</div>';
const mcCut=(P,anos)=>{const c=Date.now()-anos*365.25*DAY;return P.filter(p=>p[0]>=c)};
function mcYoY(L,lag){lag=lag||12;const out=[];for(let i=lag;i<L.length;i++)if(L[i-lag][1])out.push([L[i][0],(L[i][1]/L[i-lag][1]-1)*100]);return out}
function mcWait(){if(!MC.d){mcBoot();return MC.err&&!MC.load?'<p class="warn">A base de economia ainda não está disponível ('+esc(MC.err.message||MC.err)+'). Tente de novo mais tarde.</p>':'<p class="sub">Carregando os dados de economia…</p>'}return null}

