/* ================= Renda fixa bancária (CDB, RDB, LCI, LCA, LC, LCD, LIG, LF) ================= */
const BK_TYPES={
  CDB:{name:"CDB",fgc:true,exempt:false,desc:"Certificado de Depósito Bancário"},
  RDB:{name:"RDB",fgc:true,exempt:false,desc:"Recibo de Depósito Bancário"},
  LCI:{name:"LCI",fgc:true,exempt:true,desc:"Letra de Crédito Imobiliário"},
  LCA:{name:"LCA",fgc:true,exempt:true,desc:"Letra de Crédito do Agronegócio"},
  LC:{name:"LC",fgc:true,exempt:false,desc:"Letra de Câmbio"},
  LCD:{name:"LCD",fgc:false,exempt:true,desc:"Letra de Crédito do Desenvolvimento"},
  LIG:{name:"LIG",fgc:false,exempt:true,desc:"Letra Imobiliária Garantida"},
  LF:{name:"LF",fgc:false,exempt:false,desc:"Letra Financeira"}
};
const BK_IDX={
  DI_PCT:{pre:"",suf:"% do CDI",txt:r=>fx(r,2)+"% do CDI",ex:"110,00"},
  DI_SPREAD:{pre:"CDI +",suf:"% a.a.",txt:r=>"CDI + "+fx(r,2)+"%",ex:"1,00"},
  IPCA:{pre:"IPCA +",suf:"% a.a.",txt:r=>"IPCA + "+fx(r,2)+"%",ex:"6,00"},
  PRE:{pre:"",suf:"% a.a.",txt:r=>fx(r,2)+"% a.a.",ex:"13,00"}
};
function bkFactor(idx,rate,a,b){
  if(!(b>a))return 1;const n=du(a,b);
  if(idx==="DI_PCT")return cdiFactor(a,b,rate);
  if(idx==="DI_SPREAD")return cdiFactor(a,b)*Math.pow(1+rate/100,n/252);
  if(idx==="IPCA"){const P={index:"IPCA",start:new Date(a).toISOString().slice(0,10),ipcaLag:1,prorata:"du"};const f=ipcaFactor(P,b);return (isFinite(f)&&f>0?f:vnaBFwd(b)/vnaBFwd(a))*Math.pow(1+rate/100,n/252)}
  return Math.pow(1+rate/100,n/252);
}
function bkTax(T,gain,days){if(gain<=0)return 0;const iof=gain*iofRate(days);return iof+(T.exempt?0:(gain-iof)*irRate(days))}
function bkParse(p){
  const T=BK_TYPES[p.key],I=BK_IDX[p.idx],buy=parseDate(p.buy),mat=parseDate(p.mat),rate=num(p.rate),amt=num(p.amt);
  if(!T)return {err:"Escolha o tipo do título."};
  if(!I)return {err:"Escolha a remuneração."};
  if(isNaN(buy))return {err:"Informe a data da aplicação."};
  if(isNaN(mat))return {err:"Informe o vencimento."};
  if(mat<=buy)return {err:"O vencimento precisa ser depois da aplicação."};
  if(buy>VAL)return {err:"A aplicação precisa ser até "+fdate(VAL)+", a data dos dados de mercado."};
  if(!isFinite(rate)||rate<=(p.idx==="DI_PCT"?0:-5)||rate>(p.idx==="DI_PCT"?300:40))return {err:"Informe a taxa contratada ("+(p.idx==="DI_PCT"?"% do CDI, por exemplo 110":"% ao ano")+")."};
  if(!(amt>0))return {err:"Informe o valor aplicado."};
  if(buy<Date.parse(TX.d0)&&p.idx!=="PRE")return {err:"A série do CDI e do IPCA embutida começa em 2005."};
  return {T,I,buy,mat,rate,amt};
}
function bkName(p){const T=BK_TYPES[p.key];return (T?T.name:clean(p.key))+" "+(clean(p.issuer).trim()||"(emissor)")}
function bkConglom(p){return (clean(p.conglom).trim()||clean(p.issuer).trim()||"(sem emissor)")}
function posDay(){const n=new Date(),sp=new Date(n.getTime()-3*3600000);let t=Date.UTC(sp.getUTCFullYear(),sp.getUTCMonth(),sp.getUTCDate());for(let i=0;i<10&&!isBiz(t);i++)t-=DAY;return Math.max(VAL,Math.min(t,VAL+7*DAY))}
function bankEval(p){
  const x=bkParse(p);if(x.err)return {err:x.err};
  const {T,I,buy,mat,rate,amt}=x,PD=posDay(),now=Math.min(PD,mat);
  const vNow=amt*bkFactor(p.idx,rate,buy,now),vMat=amt*bkFactor(p.idx,rate,buy,mat);
  const dNow=(now-buy)/DAY,dMat=(mat-buy)/DAY,taxNow=bkTax(T,vNow-amt,dNow),taxMat=bkTax(T,vMat-amt,dMat);
  const matured=mat<=VAL;
  const tirNet=irr(amt,[{t:mat,amt:vMat-taxMat}],buy),tirGross=irr(amt,[{t:mat,amt:vMat}],buy);
  const valueAt=H=>H<=buy?amt:amt*bkFactor(p.idx,rate,buy,Math.min(H,mat));
  const reg=()=>({exempt:T.exempt,cust:"NONE"});
  return {
    isBank:true,name:bkName(p),type:p.key,T,idx:p.idx,issuer:clean(p.issuer).trim(),conglom:bkConglom(p),fgc:T.fgc,liq:!!p.liq,
    q:1,buy,mat,end:mat,rc:rate,rm:rate,fmt:I.txt,inv:amt,recvPast:matured?vMat:0,
    valM:matured?0:vNow,vNow,vMat,taxNow,taxMat,netNow:vNow-taxNow,netMat:vMat-taxMat,
    agio:0,res:(matured?vMat:vNow)-amt,net:(matured?vMat-taxMat:vNow-taxNow)-amt,
    hv:{rStar:NaN},srcTag:"na curva",tirNet,tirGross,matured,reg,pastList:matured?[{t:mat,amt:vMat,f:1}]:[],
    sc:{priceAt:(r,H)=>valueAt(H),cashBetween:H=>(!matured&&mat<=H)?[{t:mat,amt:vMat,f:1}]:[],usesIpca:p.idx==="IPCA",driver:p.idx==="IPCA"?"IPCA":p.idx==="PRE"?"PRE":"CDI"},
    valueAt,posDate:now
  };
}
