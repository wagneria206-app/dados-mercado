/* ---------- números ---------- */
/* largura dos gráficos = largura real do painel, para o texto dos eixos sair no tamanho certo (sem ampliar com a tela) */
function chartW(){const w=window.innerWidth||1024;if(w<640)return 420;const box=document.querySelector(".wrap");return Math.max(560,Math.min(1500,Math.round(((box&&box.clientWidth)||w)-72)))}
function chartH(h,W){return Math.round(h*Math.min(1.3,Math.max(1,W/760)))}
function num(s){s=String(s||"").trim().replace(/\s/g,"");if(!s)return NaN;if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");else if(/^-?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");return Number(s)}
const trunc=(x,n)=>{const p=Math.pow(10,n);return Math.trunc(x*p+(x>=0?1e-7:-1e-7))/p};
const brl=x=>x.toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2});
const fx=(x,d)=>x.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const fdate=t=>new Date(t).toLocaleDateString("pt-BR",{timeZone:"UTC"});
const fdt=s=>{try{return new Date(s).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}catch(e){return s}};
const signed=(x,f)=>(x>0.0049?"+":x<-0.0049?"−":"")+f(Math.abs(x));
const mname=k=>["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][k%12]+"/"+String(Math.floor(k/12)).slice(2);
function fr(fam,r){const F=FAM[fam];return (F.pre?F.pre+" ":"")+fx(r,F.dec)+"%"+(F.pre?"":" a.a.")}
const median=a=>{const s=a.filter(isFinite).sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:NaN};

