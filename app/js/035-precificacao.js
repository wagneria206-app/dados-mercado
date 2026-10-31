/* ---------- precificação ---------- */
function matOf(kind,d){const K=KIND[kind],t=parseDate(d);return K.b1?addMonths(t,K.b1-1):t}
function couponDates(mat,from,to){const out=[];for(let t=mat;t>from;t=addMonths(t,-6))if(t<=to)out.unshift(t);return out}
function b1Dates(conv,n,from,to){const out=[];for(let i=0;i<n;i++){const t=addMonths(conv,i);if(t>from&&t<=to)out.push({t,i})}return out}
function b1Amt(n,i){const Ta=trunc(100/n,6);return i===n-1?+(100-(n-1)*Ta).toFixed(6):Ta}
function flowsFrom(kind,s,d){
  const K=KIND[kind];
  let list;
  if(K.b1){const conv=parseDate(d);list=b1Dates(conv,K.b1,s,Infinity).map(x=>({t:x.t,amt:b1Amt(K.b1,x.i)}))}
  else{const mat=parseDate(d),dates=K.cpn?couponDates(mat,s,mat):[mat],cpn=K.cpn?(K.idx?CPN_B:CPN_F):0,prin=K.idx?100:1000;list=dates.map((t,i)=>({t,amt:cpn+(i===dates.length-1?prin:0)}))}
  let prev=s,acc=0;
  return list.map(f=>{acc+=du(prev,f.t);prev=f.t;return {t:f.t,du:acc,amt:f.amt}});
}
function price(kind,fl,r,vna){
  const K=KIND[kind],y=1+r/100;let s=0;
  if(K.idx){for(const f of fl)s+=trunc(f.amt/Math.pow(y,f.du/252),10);const cot=trunc(s,4);return {cot,pu:trunc(vna*cot/100,K.b1?2:6)}}
  for(const f of fl)s+=trunc(f.amt/Math.pow(y,f.du/252),9);const pu=trunc(s,6);return {cot:pu/10,pu};
}
function pastPayments(kind,d,buy){
  const K=KIND[kind];
  if(K.b1){const U0=flowsFrom(kind,buy,d).reduce((a,f)=>a+f.amt,0);return b1Dates(parseDate(d),K.b1,buy,VAL).map(x=>({t:x.t,amt:trunc(vnaIpca(x.t)*b1Amt(K.b1,x.i)/100,6),f:b1Amt(K.b1,x.i)/U0}))}
  if(!K.cpn)return [];
  return couponDates(parseDate(d),buy,VAL).map(t=>({t,amt:K.idx?trunc(vnaIpca(t)*CPN_B/100,6):CPN_F,f:0}));
}

