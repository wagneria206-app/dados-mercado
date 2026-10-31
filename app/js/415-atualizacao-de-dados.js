/* ---------- atualização de dados ---------- */
const rstat=$("rstat"),btn=$("refresh");
function setStat(text,cls){rstat.textContent=text;rstat.className="rstat"+(cls?" "+cls:"")}
function refreshAll(){buildOptions();applyFam();renderMkt();pcMemo.clear();RAWC.clear();PIF_CACHE.clear();if(MKM.has(activeMod))return mkCalc();if(activeMod==='pub')calc();else if(activeMod==='pc')pcCalc();else if(activeMod==='bank')bkCalc();else if(activeMod==='fund')fdCalc();else if(activeMod==='sim')simCalc();else if(activeMod==='tx'){oppRender();txCalc()}else if(activeMod==='fx')fxCalc();else{scRefreshSources();scCalc()}}
let mcpNs=null,requestedAt=0;
function onDoc(doc){
  if(!doc)return;
  const newer=doc.refDate&&doc.anbima&&(doc.refDate>DATA_INFO.refDate||(doc.updatedAt&&doc.updatedAt!==DATA_INFO.updatedAt));
  if(newer&&applyData(doc))refreshAll();
  const at=doc.statusAt?Date.parse(doc.statusAt):0;
  if(doc.status==="running"){
    if(Date.now()-at>25*60000)setStat("A última atualização não terminou. Toque em Atualizar dados agora para tentar de novo.","bad");
    else setStat("Atualizando dados desde "+fdt(doc.statusAt)+". Os números mudam sozinhos quando terminar.","run");
  }else if(doc.status==="error")setStat("A última atualização não conseguiu buscar os dados. Os dados de "+fdate(VAL)+" continuam valendo. Tente de novo mais tarde.","bad");
  else setStat("Dados de "+fdate(VAL)+", atualizados em "+fdt(doc.updatedAt||doc.statusAt)+"."+checkLine(),CHK.bad.length?"bad":"ok");
  if(doc.status!=="running"&&at>requestedAt)btn.disabled=false;
}
btn.addEventListener("click",async()=>{btn.disabled=true;setStat("Lendo os dados do robô…","run");await roboLoad(null);btn.disabled=false
});

