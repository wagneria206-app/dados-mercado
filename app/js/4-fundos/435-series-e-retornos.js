/* ---------- séries e retornos */
function fnLast(F){if(F.I.length)return {t:FN.T[F.I[F.I.length-1]],i:F.I[F.I.length-1],k:fnMk(FN.T[F.I[F.I.length-1]]),q:F.Q[F.Q.length-1]};const k=F.MK[F.MK.length-1];return k==null?null:{t:fnMt(k),i:null,k,q:F.M.get(k).q}}
function fnPtAt(F,t){ // último ponto do fundo com data <= t (diário quando houver; senão fim de mês)
  if(F.I.length&&t>=FN.T[F.I[0]]){let lo=0,hi=F.I.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(FN.T[F.I[m]]<=t)lo=m;else hi=m-1}return {t:FN.T[F.I[lo]],i:F.I[lo],k:fnMk(FN.T[F.I[lo]]),q:F.Q[lo]}}
  let best=null;for(const k of F.MK){if(fnMt(k)<=t+3*DAY)best=k;else break}
  if(best==null)return null;return {t:fnMt(best),i:null,k:best,q:F.M.get(best).q};
}
function fnFirst(F){const k=F.MK[0];if(k!=null&&(!F.I.length||fnMt(k)<FN.T[F.I[0]]))return {t:fnMt(k),i:null,k,q:F.M.get(k).q};if(F.I.length)return {t:FN.T[F.I[0]],i:F.I[0],k:fnMk(FN.T[F.I[0]]),q:F.Q[0]};return null}
function fnLev(b,p){const L=FN.L;if(!L)return null;if(p.i!=null&&L.d[b]){const v=L.d[b][p.i];if(v!=null)return v}const m=L.m[b];if(!m)return null;for(let k=p.k;k>=p.k-2;k--){if(m[k]!=null&&(p.i==null||k<p.k))return m[k]}return m[p.k]!=null?m[p.k]:null}
function fnBmRet(b,p0,p1){const a=fnLev(b,p0),c=fnLev(b,p1);return a&&c?(c/a-1)*100:null}
function fnStart(F,per){ // ponto-base de cada janela
  const l=fnLast(F);if(!l)return null;const d=new Date(l.t);
  if(per==="mes"){const k=l.k-1;return F.M.has(k)?{t:fnMt(k),i:fnCalIdx(fnMt(k)),k,q:F.M.get(k).q}:null}
  if(per==="ano"){const k=d.getUTCFullYear()*12-1;return F.M.has(k)?{t:fnMt(k),i:fnCalIdx(fnMt(k)),k,q:F.M.get(k).q}:null}
  if(per==="tudo")return fnFirst(F);
  const n=+per,y=d.getUTCFullYear(),m=d.getUTCMonth()-n;const t=Date.UTC(y,m,Math.min(d.getUTCDate(),new Date(Date.UTC(y,m+1,0)).getUTCDate()));
  const f=fnFirst(F);if(!f||f.t>t+5*DAY)return null;return fnPtAt(F,t);
}
function fnCalIdx(t){const T=FN.T;if(!T||!T.length||t<T[0])return null;let lo=0,hi=T.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(T[m]<=t)lo=m;else hi=m-1}return lo}
function fnRet(F,per){const p0=fnStart(F,per),p1=fnLast(F);if(!p0||!p1||p0.t>=p1.t)return null;return {p0,p1,r:(p1.q/p0.q-1)*100}}
function fnSeries(F,p0){ // pontos [t,valor relativo] a partir de p0
  const out=[];if(!p0)return out;const l=fnLast(F);
  const dStart=F.I.length?FN.T[F.I[0]]:Infinity;
  if(p0.t<dStart){for(const k of F.MK){const t=fnMt(k);if(t<p0.t-DAY)continue;if(t>=dStart)break;out.push({t,i:null,k,q:F.M.get(k).q})}}
  if(F.I.length){for(let j=0;j<F.I.length;j++){const t=FN.T[F.I[j]];if(t<p0.t)continue;out.push({t,i:F.I[j],k:fnMk(t),q:F.Q[j]})}}
  if(!out.length||out[0].t>p0.t)out.unshift(p0);
  if(l&&out[out.length-1].t<l.t)out.push(l);
  return out;
}
function fnThin(P,max){if(P.length<=max)return P;const s=P.length/max,o=[];for(let k=0;k<max;k++)o.push(P[Math.floor(k*s)]);o.push(P[P.length-1]);return o}

