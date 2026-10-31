/* ---------- resultado: essencial à vista, memória de cálculo recolhida ---------- */
const MEMO_OPEN={};
const KEYROW=/^(Resultado da posição|Pagamentos recebidos|Valor a mercado hoje|Valor na curva hoje|Valor hoje|Valor investido|Valor aplicado|Resultado se vender hoje|Resultado líquido|Resultado se resgatar|Valor no vencimento|Recebe no vencimento|IR, IOF|IR e IOF|Rendimento)/;
function foldMemo(el){
  if(!el||el.querySelector(":scope > details.memo"))return;
  const dl=el.querySelector(":scope > dl");if(!dl)return;
  const rows=[...dl.children];if(rows.length<7)return;
  const keep=document.createElement("dl");keep.className="keydl";
  let head="";rows.forEach(r=>{const dt=r.querySelector("dt");if(r.classList.contains("head")){head=dt?dt.textContent.trim():"";return}
    if(r.classList.contains("strong")||(dt&&KEYROW.test(dt.textContent.trim()))){const c=r.cloneNode(true),cd=c.querySelector("dt");if(cd&&head&&cd.textContent.trim().split(/\s+/).length===1)cd.textContent=cd.textContent.trim()+" · "+head.charAt(0).toLowerCase()+head.slice(1);keep.appendChild(c)}});
  if(!keep.children.length)return;
  const det=document.createElement("details");det.className="memo";det.open=!!MEMO_OPEN[el.id];
  det.addEventListener("toggle",()=>{MEMO_OPEN[el.id]=det.open});
  const sm=document.createElement("summary");sm.textContent="Memória de cálculo";det.appendChild(sm);
  dl.parentNode.insertBefore(keep,dl);dl.parentNode.insertBefore(det,dl);det.appendChild(dl);
  let nx=det.nextElementSibling;if(nx&&nx.matches("p.sub")&&/tabela regressiva|IR /.test(nx.textContent))det.appendChild(nx);
}
["out","pcOut","bkOut"].forEach(id=>{const el=$(id);if(!el||typeof MutationObserver==="undefined")return;new MutationObserver(()=>foldMemo(el)).observe(el,{childList:true})});














