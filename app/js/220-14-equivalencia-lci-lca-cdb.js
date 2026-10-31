/* ---------- 14. equivalência LCI/LCA × CDB ---------- */
function eqSolve(idx,target,mat,lo,hi){let a=lo,b=hi;const f=x=>bkFactor(idx,x,VAL,mat)-target;if(f(a)*f(b)>0)return NaN;for(let i=0;i<70;i++){const m=(a+b)/2;if(f(a)*f(m)<=0)b=m;else a=m}return (a+b)/2}
function eqCalc(){
  const out=$("eqOut");if(!out)return;const idx=$("eqIdx").value,dir=$("eqDir").value,r=num($("eqRate").value),mat=parseDate($("eqMat").value);
  $("eqRatePre").textContent=idx==="IPCA"?"IPCA +":"";$("eqRateSuf").textContent=idx==="DI_PCT"?"% do CDI":"% a.a.";$("eqRate").parentNode.classList.toggle("p",idx==="IPCA");
  if(!isFinite(r)||r<=0&&idx!=="IPCA"){out.innerHTML='<p class="err">Informe a taxa.</p>';return}
  if(isNaN(mat)||mat<=VAL+DAY){out.innerHTML='<p class="err">Informe um vencimento futuro.</p>';return}
  const one=(m)=>{const days=(m-VAL)/DAY,ir=irRate(days),[lo,hi]=idx==="DI_PCT"?[1,500]:[-5,80];
    if(dir==="ex2tx"){const G=bkFactor(idx,r,VAL,m),need=1+(G-1)/(1-ir);return {ir,eq:eqSolve(idx,need,m,lo,hi),days}}
    const G=bkFactor(idx,r,VAL,m),net=1+(G-1)*(1-ir);return {ir,eq:eqSolve(idx,net,m,lo,hi),days}};
  const fmt=v=>idx==="DI_PCT"?fx(v,2)+"% do CDI":idx==="IPCA"?"IPCA + "+fx(v,2)+"%":fx(v,2)+"% a.a.",x=one(mat);
  let h='<div class="big gain">'+(isFinite(x.eq)?fmt(x.eq):'—')+'</div><p class="sub">'+(dir==="ex2tx"?'Um CDB (ou outro título tributado) precisa pagar isso para empatar com a '+'LCI/LCA de '+fmt(r):'Uma LCI/LCA isenta precisa pagar isso para empatar com o CDB de '+fmt(r))+', vencendo em '+fdate(mat)+' ('+Math.round(x.days)+' dias, IR de '+fx(x.ir*100,1)+'%).</p>';
  const P=[["6 meses",6],["1 ano",12],["2 anos",24],["3 anos",36],["5 anos",60]];
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Prazo</th><th>IR</th><th>Equivalente</th></tr></thead><tbody>'+P.map(([n,mo])=>{const y=one(addMonths(VAL,mo));return '<tr><td style="text-align:left">'+n+'</td><td>'+fx(y.ir*100,1)+'%</td><td>'+(isFinite(y.eq)?fmt(y.eq):'—')+'</td></tr>'}).join("")+'</tbody></table></div>';
  h+='<p class="sub" style="font-size:.82rem;margin-top:8px">Cálculo exato pelo rendimento total no prazo: o IR incide só sobre o ganho, pela tabela regressiva (22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% acima). '+(idx==="PRE"?'':idx==="IPCA"?'IPCA projetado de '+fx(piProj(),2)+'% a.a. ':'CDI projetado pela curva de juros da ANBIMA. ')+'LCI, LCA, LCD e LIG são isentas de IR para pessoa física; compare também o risco do emissor e a cobertura do FGC.</p>';
  out.innerHTML=h;
}
