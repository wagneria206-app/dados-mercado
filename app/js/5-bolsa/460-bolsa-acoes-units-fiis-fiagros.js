/* ===== Bolsa: ações, units, FIIs, Fiagros, ETFs e BDRs (B3 e CVM) ===== */
const AT_URL="https://raw.githubusercontent.com/wagneria206-app/dados-mercado/ativos/";
const AT={idx:null,C:null,sk:null,T:null,cal:null,L:null,files:new Map(),load:null,err:null,cur:null,q:"",pview:"ret",cmp:[],
  rk:{tipo:"Ação",setor:"",liq:1e6,txt:"",sort:"liq",dir:-1,n:50}};
try{const c=JSON.parse(localStorage.getItem("atCmp")||"[]");if(Array.isArray(c))AT.cmp=c.slice(0,25)}catch(e){}
try{const r=JSON.parse(localStorage.getItem("atRk")||"null");if(r&&typeof r==="object")Object.assign(AT.rk,r,{n:50})}catch(e){}
function atSave(){const j=JSON.stringify(AT.cmp);try{if(j!==localStorage.getItem("atCmp")){localStorage.setItem("cmpAt",String(Date.now()));if(typeof syncMark==="function")setTimeout(syncMark,0)}localStorage.setItem("atCmp",j);localStorage.setItem("atRk",JSON.stringify(AT.rk))}catch(e){}}
const atUrl=p=>(window.AT_BASE||AT_URL)+p;
async function atGet(p){const r=await fetch(atUrl(p),{cache:"no-cache"});if(!r.ok)throw new Error("HTTP "+r.status+" em "+p);return r.json()}
const atNm=x=>x==null?x:String(x).replace(/\. (?=(INC|CORP|LTD|LIMITED|PLC|S\.?A|CO|N\.?V)\b)/g,", ").replace(/^Petróleo\. /,"Petróleo, ");
const AT_FUNDO=new Set(["FII","Fiagro","FI-Infra"]);
function atBoot(){
  if(AT.idx||AT.load)return AT.load;AT.err=null;
  AT.load=Promise.all([atGet("idx.json"),atGet("cal.json"),atGet("bench.json")]).then(([i,c,b])=>{
    AT.idx=i;AT.C={};i.cols.forEach((n,k)=>AT.C[n]=k);i.setores=(i.setores||[]).map(atNm);i.rows.forEach(r=>{r[1]=nomeCx(atNm(r[1]))});
    AT.sk=i.rows.map(r=>fnNorm(r[0]+" "+r[1]+" "+(i.setores[r[AT.C.setor]]||"")));
    AT.cal=c.d;AT.B=b;AT.T=c.d.map(d=>Date.parse(d+"T00:00:00Z"));AT.L=lvBuild(AT.cal,b);AT.load=null;atHash();if(FNM.has(activeMod))fnCalc();extApply();
  }).catch(e=>{AT.err=e;AT.load=null;if(FNM.has(activeMod))fnCalc()});
  return AT.load;
}
async function atFile(t){if(AT.files.has(t))return AT.files.get(t);const j=await atGet("a/"+t+".json");const A=atDecode(j);AT.files.set(t,A);return A}
function atDecode(j){
  if(typeof j.nome==="string")j.nome=nomeCx(atNm(j.nome));
  const I=[],R=[];(j.c||[]).forEach((v,k)=>{if(v!=null){I.push(j.i0+k);R.push(v)}});
  const adj=j.adj||[],Q=new Array(I.length);let acc=1,k=adj.length-1;
  for(let x=I.length-1;x>=0;x--){while(k>=0&&adj[k][0]>I[x]){acc*=adj[k][1];k--}Q[x]=R[x]*acc}
  const M=new Map();I.forEach((ix,x)=>{const t=AT.T[ix],d=new Date(t);M.set(d.getUTCFullYear()*12+d.getUTCMonth(),{q:Q[x],p:R[x]})});
  const MK=[...M.keys()].sort((a,b)=>a-b);
  j.nome=atNm(j.nome);j.setor=atNm(j.setor);j.sub=atNm(j.sub);
  return Object.assign(j,{I,Q,R,M,MK,n:j.t,lab:j.t,rlab:"Desde "+new Date(AT.T[I[0]]).getUTCFullYear(),riskNote:"as cotações diárias com proventos",monNote:"Retorno total (cotação com proventos reinvestidos) calculado com os fechamentos da B3."});
}
const atRow=t=>{const R=AT.idx.rows;for(let j=0;j<R.length;j++)if(R[j][0]===t)return R[j];return null};
function atHash(){const m=/ativo=([A-Z0-9-]{4,16})/i.exec(location.hash||"");if(m&&(AT.cur!==m[1].toUpperCase()||activeMod!=="aa")){AT.cur=m[1].toUpperCase();AT.q="";const q=$("atQ");if(q)q.value="";const r=$("atRes");if(r)r.hidden=true;if(activeMod!=="aa")setMod("aa");else atAa()}}
function atOpen(t){AT.cur=t;AT.q="";try{history.replaceState(null,"","#ativo="+t)}catch(e){}
  try{const h=JSON.parse(localStorage.getItem("atHist")||"[]").filter(x=>x!==t);h.unshift(t);localStorage.setItem("atHist",JSON.stringify(h.slice(0,10)))}catch(e){}
  if(activeMod!=="aa")setMod("aa");else{const q=$("atQ");if(q)q.value="";const r=$("atRes");if(r)r.hidden=true;atAa()}
  try{$("fnOut").scrollIntoView({behavior:"smooth",block:"start"})}catch(e){}}

