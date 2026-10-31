/* ================= Carteiras: agenda, evolução, risco, FGC, exportação, importação B3 ================= */
let CART_VIEW="sheet",AG_PER="12",EVO_CACHE=null;


const isoD=t=>new Date(t).toISOString().slice(0,10);


function okRes(ids){return ids.map(id=>({id,p:POS[id],r:cartRes[id]})).filter(x=>x.r&&!x.r.err&&!x.r.closed)}




