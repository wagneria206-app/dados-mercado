/* ===== Fundos: análise, ranking e comparador com os dados oficiais da CVM ===== */
const FN_URL="https://raw.githubusercontent.com/wagneria206-app/dados-mercado/fundos/";
const FNM=new Set(["fa","fr","fc","fg","aa","ar","ac","au","ag","sp"]);
const FN_BM={cdi:{lab:"CDI",col:"#7c8aa5"},ibov:{lab:"Ibovespa",col:"#f97316"},ipca:{lab:"IPCA",col:"#eab308"},usd:{lab:"Dólar",col:"#22c55e"},ifix:{lab:"IFIX",col:"#a16207"}};
Object.assign(FN_BM,{imab:{lab:"IMA-B",col:"#06b6d4"},imab5:{lab:"IMA-B 5",col:"#38bdf8"},imab5p:{lab:"IMA-B 5+",col:"#0f766e"},irfm:{lab:"IRF-M",col:"#c026d3"},imas:{lab:"IMA-S",col:"#94a3b8"},imag:{lab:"IMA-Geral",col:"#ec4899"}});
const FN_COLS=["#2563eb","#dc2626","#16a34a","#9333ea","#f59e0b","#0891b2"];
const FN_BML=()=>new Set(Object.values(FN_BM).map(x=>x.lab).concat(["CDI","IPCA","Ibovespa"]));
const FN_PER=[["mes","No mês"],["ano","No ano"],["6","6 meses"],["12","12 meses"],["24","24 meses"],["36","36 meses"],["60","60 meses"],["tudo","Desde o início"]];
const FN={idx:null,C:null,sk:null,T:null,cal:null,B:null,L:null,files:new Map(),load:null,err:null,view:null,cur:null,per:"12",bm:{cdi:1,ibov:0,ipca:0,usd:0,ifix:0},tabCmp:"pcdi",rper:"12",
  rk:{tipo:"",cls:"",anb:"",pl:10e6,cot:0,exc:0,qual:1,prof:0,txt:"",sort:"r12",dir:-1,n:50,ges:"",adm:"",tmax:"",amax:"",rmax:"",idade:""},cmp:[],cper:"12",q:"",jan:12,gu:""};
try{const c=JSON.parse(localStorage.getItem("fnCmp")||"[]");if(Array.isArray(c))FN.cmp=c.slice(0,25)}catch(e){}
try{const r=JSON.parse(localStorage.getItem("fnRk")||"null");if(r&&typeof r==="object")Object.assign(FN.rk,r,{n:50})}catch(e){}
try{const b=JSON.parse(localStorage.getItem("fnBm")||"null");if(b&&typeof b==="object")Object.assign(FN.bm,b)}catch(e){}
function fnSave(){const j=JSON.stringify(FN.cmp);try{if(j!==localStorage.getItem("fnCmp")){localStorage.setItem("cmpAt",String(Date.now()));if(typeof syncMark==="function")setTimeout(syncMark,0)}localStorage.setItem("fnCmp",j);localStorage.setItem("fnRk",JSON.stringify(FN.rk));localStorage.setItem("fnBm",JSON.stringify(FN.bm))}catch(e){}}
const fnUrl=p=>(window.FN_BASE||FN_URL)+p;
async function fnGet(p){const r=await fetch(fnUrl(p),{cache:"no-cache"});if(!r.ok)throw new Error("HTTP "+r.status+" em "+p);return r.json()}
const fnNorm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const fnCnpjF=k=>k&&k.length===14&&/^\d+$/.test(k)?k.slice(0,2)+"."+k.slice(2,5)+"."+k.slice(5,8)+"/"+k.slice(8,12)+"-"+k.slice(12):k||"";
function fnMoney(v){if(v==null||!isFinite(v))return "—";const a=Math.abs(v),s=v<0?"−":"";return a>=1e9?s+"R$ "+fx(a/1e9,2)+" bi":a>=1e6?s+"R$ "+fx(a/1e6,1)+" mi":a>=1e3?s+"R$ "+fx(a/1e3,0)+" mil":s+"R$ "+fx(a,0)}
function fnPct(v,d){if(v==null||!isFinite(v))return "—";d=d==null?2:d;return '<span class="'+(v>0?"pos":v<0?"neg":"")+'">'+(v<0?"−":"")+fx(Math.abs(v),d)+"%</span>"}
const fnPctT=(v,d)=>v==null||!isFinite(v)?"—":(v<0?"−":"")+fx(Math.abs(v),d==null?2:d)+"%";
function fnInt(v){return v==null||!isFinite(v)?"—":fx(v,0)}

