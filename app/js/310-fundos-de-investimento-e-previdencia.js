/* ================= Fundos de investimento e previdência (pelo CNPJ) ================= */
const FD_TYPES={
  RF_LP:{name:"Renda fixa ou multimercado · longo prazo",cc:0.15,tab:"lp",ir:"07",code:"01",exempt:false},
  RF_CP:{name:"Renda fixa · curto prazo",cc:0.20,tab:"cp",ir:"07",code:"01",exempt:false},
  ACOES:{name:"Ações",cc:0,tab:"acoes",ir:"07",code:"04",exempt:false},
  ISENTO:{name:"Isento para pessoa física (ex.: infraestrutura incentivado)",cc:0,tab:"isento",ir:"07",code:"11",exempt:true},
  PREV:{name:"Previdência (PGBL ou VGBL)",cc:0,tab:"prev",ir:"99",code:"06",exempt:false}
};
const FD_CLS={POS:"Pós-fixado (CDI)",PRE:"Prefixado",IPCA:"IPCA+",OUT:"Outros (multimercado, ações)"};
const cnpjNorm=s=>String(s||"").toUpperCase().replace(/[^0-9A-Z]/g,"");
function cnpjValid(s){const c=cnpjNorm(s);if(!/^[0-9A-Z]{12}[0-9]{2}$/.test(c))return false;if(/^(\d)\1{13}$/.test(c))return false;
  const v=ch=>ch.charCodeAt(0)-48,dv=(n)=>{const w=n===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];let s=0;for(let i=0;i<n;i++)s+=v(c[i])*w[i];const r=s%11;return r<2?0:11-r};
  return dv(12)===+c[12]&&dv(13)===+c[13]}
const cnpjFmt=s=>{const c=cnpjNorm(s);return c.length===14?c.slice(0,2)+"."+c.slice(2,5)+"."+c.slice(5,8)+"/"+c.slice(8,12)+"-"+c.slice(12):s};
let FUNDS={};

function lastBizOfMonth(y,m){let t=utc(y,m+1,0);while(!isBiz(t))t-=DAY;return t}
function ccDates(a,b){const out=[];const y0=new Date(a).getUTCFullYear(),y1=new Date(b).getUTCFullYear();for(let y=y0;y<=y1;y++)[4,10].forEach(m=>{const t=lastBizOfMonth(y,m);if(t>a&&t<=b)out.push(t)});return out}
function cdiGrowth(a,b,pct){let f=1;for(let x=a;x<b;x+=DAY)if(isBiz(x))f*=1+cdiDay(x)*pct/100;return f}
function prevRate(days){const y=days/365.25;return y<=2?0.35:y<=4?0.30:y<=6?0.25:y<=8?0.20:y<=10?0.15:0.10}
function prevNext(buy){const steps=[2,4,6,8,10],y=(VAL-buy)/DAY/365.25;const s=steps.find(k=>k>y);return s?{t:buy+s*365.25*DAY,rate:prevRate((s+0.01)*365.25)}:null}
function fdTaxRate(type,days){if(type==="RF_LP")return days<=180?0.225:days<=360?0.20:days<=720?0.175:0.15;if(type==="RF_CP")return days<=180?0.225:0.20;if(type==="ACOES")return 0.15;return 0}
function fundEval(p){
  const c=cnpjNorm(p.key);if(!c)return {err:"Digite o CNPJ do fundo para começar."};if(!cnpjValid(c))return {err:"CNPJ inválido. Confira os 14 caracteres (os dois últimos são os dígitos verificadores)."};
  const F=FUNDS[c]||{},type=FD_TYPES[p.fdType]?p.fdType:(FD_TYPES[F.type]?F.type:null);if(!type)return {err:"Escolha o tipo do fundo (tributação)."};
  const T=FD_TYPES[type],buy=parseDate(p.buy),amt=num(p.amt),pct=isFinite(num(p.exp))?num(p.exp):(type==="ACOES"?0:100);
  if(isNaN(buy)||buy>VAL)return {err:"Informe a data da aplicação (até "+fdate(VAL)+")."};if(!(amt>0))return {err:"Informe o valor aplicado."};
  if(buy<Date.parse(TX.d0))return {err:"A série do CDI embutida começa em 2005."};
  const Q=(F.quotes||[]).map(q=>[parseDate(q[0]),q[1],q[2]]).filter(q=>q[0]<=VAL);
  let cota0=num(p.cota0),cotas=num(p.cotas);const nearBuy=Q.find(q=>Math.abs(q[0]-buy)<=5*DAY);
  if(!(cota0>0)&&cotas>0)cota0=amt/cotas;if(!(cota0>0)&&nearBuy)cota0=nearBuy[1];
  let unitsOv=0,basisEst=false;
  if(!(cota0>0)&&Q.length&&(num(p.cotasNow)>0||num(p.saldo)>0)){const lq=Q[Q.length-1];unitsOv=num(p.cotasNow)>0?num(p.cotasNow):num(p.saldo)/lq[1];if(unitsOv>0){cota0=amt/unitsOv;cotas=unitsOv;basisEst=true}}
  let virtual=false;if(!(cota0>0)){if(Q.length)return {err:"Para calcular, informe o saldo bruto de hoje (está no extrato) ou as cotas compradas."};cota0=1;virtual=true}
  if(!(cotas>0))cotas=amt/cota0;
  const A=[[buy,cota0]].concat(Q.filter(q=>q[0]>buy).map(q=>[q[0],q[1]]));const last=A[A.length-1];
  const grow=(a,b)=>type==="ACOES"||p.fdCls==="OUT"&&!(num(p.exp)>0)?1:cdiGrowth(a,b,pct);
  const cotaAt=H=>{if(H<=buy)return cota0;for(let i=1;i<A.length;i++)if(H<=A[i][0]){const [a,ca]=A[i-1],[b,cb]=A[i];return ca*Math.pow(cb/ca,(H-a)/Math.max(DAY,b-a))}return last[1]*grow(last[0],H)};
  // come-cotas
  const CC=T.cc?ccDates(buy,VAL):[];let units=cotas,base=cota0,ccPaid=0;const ccList=[];
  const unitsAt=H=>{let u=cotas,b=cota0;for(const t of (T.cc?ccDates(buy,H):[])){const ct=cotaAt(t),g=(ct-b)*u;if(g>0){const tx=T.cc*g;u-=tx/ct;b=ct}}return u};
  CC.forEach(t=>{const ct=cotaAt(t),g=(ct-base)*units;if(g>0){const tx=T.cc*g;units-=tx/ct;ccPaid+=tx;ccList.push({t,tx});base=ct}});
  if(num(p.cotasNow)>0)units=num(p.cotasNow);else if(unitsOv>0)units=unitsOv;
  const cNow=cotaAt(VAL),V=units*cNow,days=(VAL-buy)/DAY,gain=V+ccPaid-amt;
  const prev=type==="PREV",pgbl=prev&&p.fdPlan==="PGBL",prog=prev&&p.fdReg==="PROG";
  const taxAt=(t,V1,cc1,cost)=>{const d=(t-buy)/DAY,g=V1+cc1-cost;if(T.exempt)return 0;if(prev){const base=pgbl?V1:Math.max(0,V1-cost);return base*(prog?0.15:prevRate(d))}const io=d<30&&g>0?g*iofRate(d):0;return Math.max(0,fdTaxRate(type,d)*Math.max(0,g-io)-cc1)+io};
  const irNow=taxAt(VAL,V,ccPaid,amt),netNow=V-irNow;
  const lastQ=Q.length?Q[Q.length-1]:null,estDays=lastQ?(VAL-lastQ[0])/DAY:Infinity;
  const name=(F.name||p.fdName||"Fundo "+cnpjFmt(c)).slice(0,90);
  const src=basisEst?(lastQ?"saldo informado, cota de "+txD2(lastQ[0]):"saldo informado"):virtual?"estimado a "+fx(pct,0)+"% do CDI":lastQ?(estDays<1?"cota de "+txD2(lastQ[0]):"cota de "+txD2(lastQ[0])+" + estimativa"):"cota da aplicação + estimativa";
  const valueAt=H=>H<=buy?amt:unitsAt(Math.min(H,VAL))*cotaAt(Math.min(H,VAL));
  const T2={name:prev?(p.fdPlan||"Previdência"):"Fundo",fgc:false,exempt:T.exempt};
  const cls=FD_CLS[p.fdCls]?p.fdCls:(type==="ACOES"?"OUT":"POS");
  return {isBank:true,isFund:true,type,T:T2,fd:{cnpj:c,cota0,cotas,units,cNow,ccPaid,ccList,lastQ,virtual,pct,prev,pgbl,prog,admin:F.admin||"",F},cls,
    name,idx:cls==="PRE"?"PRE":cls==="IPCA"?"IPCA":"DI_PCT",issuer:F.admin||name,conglom:F.admin||name,fgc:false,liq:true,
    q:1,buy,mat:VAL+60*365*DAY,end:VAL+60*365*DAY,rc:NaN,rm:NaN,fmt:()=>"",inv:amt,recvPast:0,valM:V,vNow:V,vMat:V,taxNow:irNow,taxMat:irNow,netNow,netMat:netNow,
    agio:0,res:V-amt,net:netNow-amt,hv:{rStar:NaN},srcTag:src,tirGross:irr(amt,[{t:VAL,amt:V+ccPaid}],buy),tirNet:irr(amt,[{t:VAL,amt:netNow}],buy),matured:false,
    reg:()=>({exempt:T.exempt,cust:"NONE"}),pastList:[],sc:{priceAt:(r,H)=>valueAt(H),cashBetween:()=>[],usesIpca:false,driver:"CDI"},valueAt,
    taxOn:(t,frac,gross)=>{const u=unitsAt(t),ct=cotaAt(t),V1=u*ct,ccT=ccList.filter(x=>x.t<=t).reduce((a,x)=>a+x.tx,0);const tx=taxAt(t,V1,ccT,amt);return V1>0?tx*Math.min(1,gross/V1):0},
    estDays};
}
