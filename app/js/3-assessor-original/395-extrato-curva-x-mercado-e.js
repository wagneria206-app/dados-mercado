/* ---------- extrato: curva x mercado e calibragem pelo PU do banco ---------- */
/* Curva de aplicação (critério dos custodiantes): PU par do papel menos o ágio/deságio da compra,
   apropriado linearmente por dias úteis entre a compra e o vencimento. */







function exAt(M,x){const P=M.pts;if(x<=P[0][0])return P[0];if(x>=P[P.length-1][0])return P[P.length-1];for(let i=1;i<P.length;i++)if(x<=P[i][0]){const a=P[i-1],b=P[i],t=(x-a[0])/(b[0]-a[0]);return [x,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}return P[P.length-1]}
function exShow(box,x){
  let M;try{M=JSON.parse(box.dataset.meta)}catch(e){return}const v=exAt(M,x),svg=box.querySelector("svg"),hv=svg.querySelector(".exhv");
  const X=t=>M.PL+(t-M.lo)/(M.hi-M.lo)*(M.W-M.PL-M.PR),Y=t=>M.PT+(M.y1-t)/(M.y1-M.y0)*(M.H-M.PT-M.PB),px=X(v[0]),py=Y(v[1]);
  hv.style.display="";const L=hv.querySelector(".exhl");L.setAttribute("x1",px);L.setAttribute("x2",px);const c=hv.querySelector(".exhc");c.setAttribute("cx",px);c.setAttribute("cy",py);
  const tg=hv.querySelector(".exht"),tx=px+14+260>M.W-M.PR?px-274:px+14,ty=Math.max(M.PT,Math.min(py-46,M.H-M.PB-92));tg.setAttribute("transform","translate("+tx.toFixed(1)+","+ty.toFixed(1)+")");
  const vm=v[2]*M.q;hv.querySelector(".ex1").textContent="Taxa "+fx(v[0],2)+"% a.a.";hv.querySelector(".ex2").textContent="PU a mercado R$ "+fx(v[2],4);hv.querySelector(".ex3").textContent="Valor a mercado "+brl(vm);
  const e4=hv.querySelector(".ex4");e4.textContent=(v[1]>=0?"Ágio ":"Deságio ")+signed(v[1],brl);e4.setAttribute("fill",v[1]>=0?"var(--gain)":"var(--loss)");
  const o=box.querySelector(".exsout");if(o){const d=vm-M.val;o.innerHTML='A <b>'+fx(v[0],2)+'%</b>: valor a mercado <b>'+brl(vm)+'</b> · '+(v[1]>=0?'ágio':'deságio')+' <b class="'+(v[1]>=0?"pos":"neg")+'">'+signed(v[1],brl)+'</b> · em relação a hoje <b class="'+(d>=0?"pos":"neg")+'">'+signed(d,brl)+'</b>'}
}
document.addEventListener("mousemove",e=>{const h=e.target.closest&&e.target.closest(".exchart .exhit");if(!h)return;const box=h.closest(".exchart"),svg=box.querySelector("svg"),R=svg.getBoundingClientRect();let M;try{M=JSON.parse(box.dataset.meta)}catch(x){return}
  const sx=(e.clientX-R.left)/R.width*M.W,x=M.lo+(sx-M.PL)/(M.W-M.PL-M.PR)*(M.hi-M.lo);exShow(box,x);const rg=box.querySelector(".exrng");if(rg)rg.value=x.toFixed(2)});
document.addEventListener("mouseout",e=>{const h=e.target.closest&&e.target.closest(".exchart .exhit");if(!h||(e.relatedTarget&&h.contains(e.relatedTarget)))return;const box=h.closest(".exchart"),hv=box.querySelector(".exhv");const rg=box.querySelector(".exrng");if(rg&&rg.dataset.touched)return;if(hv)hv.style.display="none"});
document.addEventListener("input",e=>{if(!e.target.classList||!e.target.classList.contains("exrng"))return;e.target.dataset.touched="1";exShow(e.target.closest(".exchart"),+e.target.value)});
document.addEventListener("click",e=>{const h=e.target.closest&&e.target.closest(".exchart");if(h)e.stopPropagation()},true);





