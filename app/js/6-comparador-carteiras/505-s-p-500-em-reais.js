/* ---------- S&P 500 em reais com dividendos (ETF IVVB11, que reinveste os dividendos) como índice de referência: a Cboe só publica o S&P 500 sem dividendos */
FN_BM.spx={lab:"S&P 500 com dividendos, em R$ (IVVB11)",col:"#ef4444"};
let EXT_SPX=null;
async function extSpx(){
  if(EXT_SPX)return EXT_SPX;
  EXT_SPX=Promise.all([fetch(atUrl("cal.json"),{cache:"no-cache"}).then(r=>r.ok?r.json():null),fetch(atUrl("a/IVVB11.json"),{cache:"no-cache"}).then(r=>r.ok?r.json():null)]).then(([c,j])=>{
    if(!c||!j)return null;const m={};(j.c||[]).forEach((v,k)=>{if(v!=null)m[c.d[j.i0+k]]=v});return m}).catch(()=>null);
  return EXT_SPX;
}
function lvAddSpx(L,cal,m){
  if(!L||!m||!cal)return;const ds=Object.keys(m).sort();if(!ds.length)return;let j=0,last=null;const a=new Array(cal.length);
  cal.forEach((d,i)=>{while(j<ds.length&&ds[j]<=d){last=m[ds[j]];j++}a[i]=d>=ds[0]?last:null});L.d.spx=a;
  const mm={};ds.forEach(d=>{mm[+d.slice(0,4)*12+(+d.slice(5,7))-1]=m[d]});L.m.spx=mm;
}
function extApply(){extSpx().then(m=>{if(!m)return;let mud=false;if(FN.L&&!FN.L.d.spx){lvAddSpx(FN.L,FN.cal,m);mud=true}if(AT.L&&!AT.L.d.spx){lvAddSpx(AT.L,AT.cal,m);mud=true}if(mud&&FNM.has(activeMod)&&FN.bm.spx)fnCalc()})}

