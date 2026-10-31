/* ---------- indicadores de economia nos favoritos e alertas (Focus, IPCA, Selic, dólar, Bolsas, juros dos EUA)
   Os mesmos cálculos estão no robô de alertas do repositório privado (scripts/alertas.py), para avisar com o app fechado.
   Chave do favorito: "m:<indicador>" ou "m:<indicador>:<ano>" (Focus de um ano). */
const MA={ok:false,load:null,t:0,x:null,m:null,i:null,b:null,cal:null};
const MA_TIPOS={fipca:["Focus: IPCA de ","%","Banco Central, Boletim Focus (mediana)","ec"],fselic:["Focus: Selic no fim de ","%","Banco Central, Boletim Focus (mediana)","ec"],
  fcambio:["Focus: dólar no fim de ","R$","Banco Central, Boletim Focus (mediana)","ec"],fpib:["Focus: PIB de ","%","Banco Central, Boletim Focus (mediana)","ec"],
  ipca12:["IPCA em 12 meses","%","IBGE","in"],selic:["Selic efetiva (over)","%","Banco Central","ju"],impl1:["Inflação implícita de 1 ano","%","ANBIMA (curva de juros)","in"],
  ptax:["Dólar PTAX (venda)","R$","Banco Central","fx"],ibov:["Ibovespa","pts","B3","rs"],spx:["S&P 500","pts","Cboe","mu"],t10:["Treasury 10 anos","%","Departamento do Tesouro dos EUA","mu"],vix:["VIX (volatilidade do S&P 500)","pts","Cboe","mu"]};
const MA_FOCUS={fipca:"IPCA",fselic:"Selic",fcambio:"Câmbio",fpib:"PIB Total"};
function maLista(){const y=new Date().getFullYear(),L=[];["fipca","fselic","fcambio","fpib"].forEach(t=>{L.push(t+":"+y);L.push(t+":"+(y+1))});return L.concat(["ipca12","selic","impl1","ptax","ibov","spx","t10","vix"])}
function maNome(id){const [t,y]=id.split(":"),T=MA_TIPOS[t];return T?T[0]+(y||""):id}
function maUn(id){const T=MA_TIPOS[id.split(":")[0]];return T?T[1]:""}
function maFmt(id,v){const u=maUn(id);return u==="R$"?"R$ "+fx(v,u==="R$"&&id.startsWith("ptax")?4:2):u==="%"?fx(v,2)+"%":fx(v,v>=1000?0:2)}
function maLoad(forca){
  if(MA.load)return MA.load;if(MA.ok&&!forca&&Date.now()-MA.t<30*60000)return Promise.resolve();
  const j=u=>fetch(u,{cache:"no-cache"}).then(r=>r.ok?r.json():null).catch(()=>null);
  MA.load=Promise.all([j(MC_URL+"macro.json"),j(ROBO+"mercado.json"),j(EU_URL+"indices.json"),j(AT_URL+"bench.json"),j(AT_URL+"cal.json")]).then(([x,m,i,b,c])=>{
    MA.x=x;MA.m=m;MA.i=i;MA.b=b;MA.cal=c&&c.d;MA.ok=true;MA.t=Date.now();MA.load=null}).catch(()=>{MA.load=null});
  return MA.load}
/* valor atual de um indicador: {v, d (data do dado)} ou null */
function maVal(id){
  const [t,y]=id.split(":"),X=MA.x,M=MA.m,I=MA.i;
  const ult=(arr,datas)=>{if(!arr)return null;for(let k=arr.length-1;k>=0;k--)if(arr[k]!=null&&isFinite(arr[k]))return {v:+arr[k],d:datas?datas[k]:null};return null};
  if(MA_FOCUS[t]){const s=X&&X.focus&&X.focus.anuais&&X.focus.anuais[MA_FOCUS[t]]&&X.focus.anuais[MA_FOCUS[t]][y];if(!s||!s.length)return null;const u=s[s.length-1];return {v:+u[1],d:u[0]}}
  if(t==="ipca12"){const q=M&&M.ipca;if(!q)return null;const ks=Object.keys(q).sort(),k=ks[ks.length-1];if(!k)return null;const a=+k.slice(0,4),m=+k.slice(4),k0=String(a-1)+String(m).padStart(2,"0");if(!q[k0])return null;return {v:(q[k]/q[k0]-1)*100,d:k.slice(0,4)+"-"+k.slice(4)+"-01"}}
  if(t==="selic")return M&&isFinite(M.selicOver)?{v:+M.selicOver,d:M.refDate||null}:null;
  if(t==="impl1"){const a=M&&M.inflacaoImplicita;const r=a&&a.find(p=>p[0]===252);return r?{v:+r[1],d:M.curveDate||M.refDate||null}:null}
  if(t==="ptax"){const d=M&&M.dolar;return d&&+d.venda>0?{v:+d.venda,d:d.data}:null}
  if(t==="ibov")return MA.b&&MA.b.d?ult(MA.b.d.ibov,MA.cal):null;
  if(I&&I.s&&I.s[t])return ult(I.s[t],I.d);
  return null}
/* lista para adicionar aos favoritos */
function maSelHtml(){
  const L=maLista().filter(id=>!fvHas("m:"+id));if(!L.length)return "";
  return '<div class="field"><label for="fvMa">Adicionar indicador de economia</label><select id="fvMa"><option value="">Escolha o indicador…</option>'+L.map(id=>{const r=MA.ok?maVal(id):null;return '<option value="'+id+'">'+esc(maNome(id))+(r?' · hoje '+maFmt(id,r.v):'')+'</option>'}).join("")+'</select></div>'}
document.addEventListener("change",e=>{const t=e.target;if(t&&t.id==="fvMa"&&t.value){const id=t.value;FV.l.push({k:"m:"+id,n:maNome(id)});fvSave();fvRefresh()}});
setInterval(()=>{if(FV.l.some(f=>f.k[0]==="m"))maLoad(true).then(()=>{try{fvRefresh()}catch(e){}})},30*60000);
