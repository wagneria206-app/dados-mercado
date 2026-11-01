/* ---------- ordenar qualquer tabela clicando no título da coluna
   1º clique: números do maior para o menor (textos de A a Z); 2º clique inverte. Linhas de total ficam no fim.
   Tabelas que já têm ordenação própria (rankings, comparador) continuam com a delas. */
function ordValor(td){
  const t=(td.textContent||"").replace(/\s+/g," ").trim();
  if(!t||/^[—–-]$/.test(t))return null;
  const d=/^(\d{2})\/(\d{2})\/(\d{2,4})/.exec(t);if(d)return Date.UTC(+(d[3].length===2?"20"+d[3]:d[3]),+d[2]-1,+d[1]);
  const s=t.replace(/^(R\$|US\$|adm\.|DY|IPCA \+|CDI \+|Selic \+|D\+)\s*/i,"");
  if(!/^[+\-−]?\d/.test(s))return t.toLocaleLowerCase("pt-BR");
  const m=/^[+\-−]?[\d.]*\d(,\d+)?/.exec(s);let v=num(m[0].replace("−","-"));if(!isFinite(v))return t.toLocaleLowerCase("pt-BR");
  const resto=s.slice(m[0].length);if(/^\s*tri\b/.test(resto))v*=1e12;else if(/^\s*bi\b/.test(resto))v*=1e9;else if(/^\s*mi\b/.test(resto))v*=1e6;else if(/^\s*mil\b/.test(resto))v*=1e3;
  return v}
function ordPode(tb){
  if(!tb||!tb.tHead||tb.tHead.rows.length!==1||!tb.tBodies[0])return false;
  const ths=[...tb.tHead.rows[0].cells];
  if(ths.some(th=>th.colSpan>1||th.querySelector("button,a,input,select")||[...th.attributes].some(a=>a.name!=="data-ordem"&&/^data-.*(sort|ord)/.test(a.name))))return false;
  return ![...tb.tBodies[0].rows].some(r=>[...r.cells].some(c=>c.colSpan>1))}
document.addEventListener("click",e=>{
  const th=e.target.closest&&e.target.closest("table.ctab thead th");if(!th)return;const tb=th.closest("table");if(!ordPode(tb))return;
  const col=th.cellIndex,desc=th.dataset.ordem!=="desc"&&th.dataset.ordem!=="asc"?null:th.dataset.ordem;
  const linhas=[...tb.tBodies[0].rows],fixas=linhas.filter(r=>r.classList.contains("cmpbm")),mov=linhas.filter(r=>!r.classList.contains("cmpbm"));
  const vals=mov.map(r=>({r,v:r.cells[col]?ordValor(r.cells[col]):null})),numerico=vals.some(x=>typeof x.v==="number");
  // 1º clique: números do maior para o menor, textos de A a Z
  const ordem=desc?(desc==="desc"?"asc":"desc"):(numerico?"desc":"asc"),f=ordem==="asc"?1:-1;
  vals.sort((a,b)=>{if(a.v==null&&b.v==null)return 0;if(a.v==null)return 1;if(b.v==null)return -1;
    if(typeof a.v===typeof b.v)return (typeof a.v==="number"?a.v-b.v:a.v.localeCompare(b.v,"pt-BR"))*f;return typeof a.v==="number"?-1:1});
  const cor=tb.tBodies[0];vals.forEach(x=>cor.appendChild(x.r));fixas.forEach(r=>cor.appendChild(r));
  [...tb.tHead.rows[0].cells].forEach(c=>{delete c.dataset.ordem;c.removeAttribute("aria-sort")});th.dataset.ordem=ordem;th.setAttribute("aria-sort",ordem==="asc"?"ascending":"descending");
  if(tb.dataset.rclT){[...cor.rows].forEach((r,i)=>r.classList.toggle("rclx",i>=RCL_LINHAS&&!r.classList.contains("cmpbm")))}
});
/* marca as colunas que podem ser ordenadas (cursor de mão e seta) */
{let rq=0;new MutationObserver(()=>{if(rq)return;rq=requestAnimationFrame(()=>{rq=0;document.querySelectorAll("table.ctab:not([data-ordok])").forEach(tb=>{tb.dataset.ordok="1";if(ordPode(tb))tb.classList.add("ordenavel")})})}).observe(document.querySelector(".wrap")||document.body,{childList:true,subtree:true})}
