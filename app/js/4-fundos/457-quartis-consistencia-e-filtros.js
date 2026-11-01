/* ---------- ranking de fundos: quartil na categoria (12 e 36 meses), consistência, filtros salvos e busca por objetivo
   Quartil: posição do fundo entre os pares da mesma categoria ANBIMA (ou classe CVM) e do mesmo tipo, sem exclusivos.
   Consistência (robô): % das janelas de 12 meses dos últimos 3 anos, mês a mês, em que o fundo bateu o CDI. */
["pcdi","cons","q12","q36"].forEach(k=>{if(FN.rk[k]==null)FN.rk[k]=""});
let FN_QN=-1;
function fnQuartis(){const I=FN.idx;if(!I||FN_QN===I.rows.length)return;const C=FN.C;
  if(C.q12==null){C.q12=I.cols.length;C.q36=I.cols.length+1}
  const G=new Map();I.rows.forEach(r=>{if(r[C.flags]&1)return;const g=(r[C.anbima]!=null&&I.anbima[r[C.anbima]]?"a"+r[C.anbima]:"c"+r[C.classe])+"|"+r[C.tipo];(G.get(g)||G.set(g,[]).get(g)).push(r)});
  I.rows.forEach(r=>{r[C.q12]=null;r[C.q36]=null});
  G.forEach(L=>{if(L.length<8)return;[["r12","q12"],["r36","q36"]].forEach(([c,q])=>{const v=L.filter(r=>r[C[c]]!=null).sort((a,b)=>b[C[c]]-a[C[c]]),n=v.length;if(n<8)return;v.forEach((r,i)=>{r[C[q]]=Math.min(4,Math.floor(i/n*4)+1)})})});
  FN_QN=I.rows.length}
/* filtro extra do ranking (chamado em fnRkList) */
function fnRkExtra(r){const rk=FN.rk,C=FN.C;
  if(rk.pcdi!==""){const c=FN.idx.cdi12;if(!(c>0)||r[C.r12]==null||r[C.r12]/c*100<+rk.pcdi)return false}
  if(rk.cons!==""&&(C.cons==null||r[C.cons]==null||r[C.cons]<+rk.cons))return false;
  if(rk.q12!==""&&(r[C.q12]==null||r[C.q12]>+rk.q12))return false;
  if(rk.q36!==""&&(r[C.q36]==null||r[C.q36]>+rk.q36))return false;
  return true}
function fnRkExtraSel(sel){const rk=FN.rk;
  return sel("rkPcdi","12 meses acima de",[["","Qualquer"],[90,"90% do CDI"],[100,"100% do CDI"],[105,"105% do CDI"],[110,"110% do CDI"],[120,"120% do CDI"],[150,"150% do CDI"]],rk.pcdi)
    +sel("rkQ12","Quartil em 12 meses",[["","Qualquer"],[1,"1º quartil"],[2,"1º ou 2º"]],rk.q12)
    +sel("rkQ36","Quartil em 36 meses",[["","Qualquer"],[1,"1º quartil"],[2,"1º ou 2º"]],rk.q36)
    +(FN.C.cons!=null?sel("rkCons","Consistência mínima",[["","Qualquer"],[50,"50% das janelas"],[70,"70%"],[80,"80%"],[90,"90%"],[100,"100%"]],rk.cons):'')}
const FN_RKX={rkPcdi:"pcdi",rkQ12:"q12",rkQ36:"q36",rkCons:"cons"};
/* busca por objetivo e filtros salvos */
const FN_RK0={tipo:"",cls:"",anb:"",pl:10e6,cot:0,exc:0,qual:1,prof:0,txt:"",sort:"r12",dir:-1,n:50,ges:"",adm:"",tmax:"",amax:"",rmax:"",idade:"",pcdi:"",cons:"",q12:"",q36:""};
function fnClsIdx(re){const j=(FN.idx.classes||[]).findIndex(x=>re.test(fnNorm(x||"")));return j<0?"":String(j)}
function fnObjetivos(){return [
  ["Caixa: renda fixa com resgate até D+1, acima de 100% do CDI e taxa até 0,5%",{cls:fnClsIdx(/^renda fixa$/),rmax:"1",pcdi:"100",tmax:"0.5",pl:50e6,sort:"r12"}],
  ["Renda fixa consistente: bateu o CDI em 80% das janelas, resgate até D+30",{cls:fnClsIdx(/^renda fixa$/),rmax:"30",cons:FN.C.cons!=null?"80":"",q36:FN.C.cons!=null?"":"2",idade:"3",pl:50e6,sort:FN.C.cons!=null?"cons":"r36"}],
  ["Multimercados de 1º quartil em 12 e em 36 meses",{cls:fnClsIdx(/multimercado/),q12:"1",q36:"1",idade:"3",pl:50e6,sort:"sharpe"}],
  ["Ações de 1º quartil em 36 meses, com 5 anos ou mais",{cls:fnClsIdx(/^acoes$/),q36:"1",idade:"5",pl:50e6,sort:"r36"}]]}
function fnFiltros(){try{const a=JSON.parse(localStorage.getItem("fnFiltros")||"[]");return Array.isArray(a)?a:[]}catch(e){return []}}
function fnFiltrosGuarda(a){try{localStorage.setItem("fnFiltros",JSON.stringify(a.slice(0,20)))}catch(e){}}
function fnFiltrosHtml(){const S=fnFiltros();
  return '<details class="nota" style="margin:6px 0 8px"><summary>Busca por objetivo e filtros salvos</summary><div class="fnchips" style="margin-top:6px">'
    +fnObjetivos().map(([n],i)=>'<button type="button" class="fnchip" data-fnobj="'+i+'">'+esc(n)+'</button>').join("")+'</div>'
    +(S.length?'<div class="label" style="margin-top:8px">Seus filtros</div><div class="fnchips">'+S.map((f,i)=>'<span class="fnchip"><button type="button" class="link" data-fnfil="'+i+'">'+esc(f.nome)+'</button> <button type="button" class="fnx" data-fnfilx="'+i+'" aria-label="Apagar filtro">×</button></span>').join("")+'</div>':'')
    +'<div class="debq" style="margin-top:8px"><div class="field"><label for="fnFilNome">Salvar os filtros atuais como</label><input id="fnFilNome" maxlength="50" placeholder="ex.: RF D+1 para caixa" autocomplete="off"></div><button type="button" class="btn sec" data-fnfilsalva="1">Salvar filtro</button></div>'
    +'<p class="sub" style="font-size:.78rem;margin-top:4px">Filtros salvos ficam neste aparelho. As buscas por objetivo são pontos de partida, não recomendação.</p></details>'}
document.addEventListener("click",e=>{const g=s=>e.target.closest&&e.target.closest(s);let x;if(!g("#modFn"))return;
  if((x=g("[data-fnobj]"))){const o=fnObjetivos()[+x.dataset.fnobj];if(!o)return;Object.assign(FN.rk,FN_RK0,o[1],{n:50});fnSave();fnRk();return}
  if((x=g("[data-fnfil]"))){const f=fnFiltros()[+x.dataset.fnfil];if(!f)return;Object.assign(FN.rk,FN_RK0,f.rk,{n:50});fnSave();fnRk();return}
  if((x=g("[data-fnfilx]"))){const a=fnFiltros();a.splice(+x.dataset.fnfilx,1);fnFiltrosGuarda(a);fnRk();return}
  if((x=g("[data-fnfilsalva]"))){const i=$("fnFilNome"),nome=(i&&i.value.trim())||"Filtro "+(fnFiltros().length+1);const rk=Object.assign({},FN.rk);delete rk.n;const a=fnFiltros().filter(f=>f.nome!==nome);a.unshift({nome,rk});fnFiltrosGuarda(a);fnRk();return}});
