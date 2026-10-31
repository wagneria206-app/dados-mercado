/* ================= Projeção de inflação: implícita (ANBIMA) ou média dos últimos 12 meses ================= */
function zeroPre(d){d=Math.max(1,d);return (Math.pow(dfCurve(d),252/d)-1)*100}
function ntnbCurve(){return (MKT.NTNB||[]).map(r=>[parseDate(r[0]),+r[1]]).filter(r=>isFinite(r[0])&&isFinite(r[1])&&r[0]>VAL+20*DAY).sort((a,b)=>a[0]-b[0])}
function realAt(t){const L=ntnbCurve();if(!L.length)return NaN;if(t<=L[0][0])return L[0][1];for(let i=1;i<L.length;i++)if(t<=L[i][0]){const [t0,r0]=L[i-1],[t1,r1]=L[i];return r0+(r1-r0)*(t-t0)/(t1-t0)}return L[L.length-1][1]}
function implAt(t){const r=realAt(t);if(!isFinite(r))return NaN;const n=zeroPre(du(VAL,Math.max(t,VAL+DAY)));return ((1+n/100)/(1+r/100)-1)*100}

function piFactor(t){
  if(t<=VAL)return 1;const yrs=(t-VAL)/DAY/365.25,k=t+"|"+PI_MODE+"|"+PI_PROJ+"|"+SC_PI_SHIFT;
  if(PIF_CACHE.has(k))return PIF_CACHE.get(k);let f;
  if(PI_PROJ!=null)f=Math.pow(1+(PI_PROJ+SC_PI_SHIFT)/100,yrs);
  else if(PI_MODE==="impl"&&isFinite(implAt(t)))f=Math.pow(1+(implAt(t)+SC_PI_SHIFT)/100,yrs);
  else f=Math.pow(1+(ipca12()+SC_PI_SHIFT)/100,yrs);
  PIF_CACHE.set(k,f);return f;
}
function piModeName(){return PI_PROJ!=null?"informada nos cenários":PI_MODE==="impl"?"inflação implícita do mercado (ANBIMA), por prazo":"média dos últimos 12 meses"}

