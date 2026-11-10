/* ---------- Conversor entre indexadores: IPCA+, % do CDI, CDI+ e prefixado, bruto e líquido, até o vencimento.
   Sem premissas digitadas, usa a curva de juros e a inflação implícita da ANBIMA até a data (bkFactor), e não um CDI e um
   IPCA fixos. % do CDI pela convenção da B3/ANBIMA: (1 + DI diário × %)^dias úteis, e não (1+CDI)^%.
   Líquido: o IR incide sobre o ganho total no vencimento (tabela regressiva pelos dias corridos), e não sobre a taxa. */
const CV_IDX=[["IPCA","IPCA +",[-10,60]],["DI_PCT","% do CDI",[1,500]],["DI_SPREAD","CDI +",[-20,60]],["PRE","Prefixado",[-5,80]]];
function cvPrem(){const c=num(($("cvCdi")||{}).value),i=num(($("cvIpca")||{}).value);return {cdi:isFinite(c)?c/100:null,ipca:isFinite(i)?i/100:null}}
function cvF(idx,r,mat,P){const n=du(VAL,mat);
  if(idx==="PRE")return Math.pow(1+r/100,n/252);
  if(idx==="DI_PCT"&&P.cdi!=null)return Math.pow(1+(Math.pow(1+P.cdi,1/252)-1)*r/100,n);
  if(idx==="DI_SPREAD"&&P.cdi!=null)return Math.pow((1+P.cdi)*(1+r/100),n/252);
  if(idx==="IPCA"&&P.ipca!=null)return Math.pow((1+P.ipca)*(1+r/100),n/252);
  return bkFactor(idx,r,VAL,mat)}
function cvSolve(idx,alvo,mat,P){const g=CV_IDX.find(x=>x[0]===idx)[2];let a=g[0],b=g[1];const f=x=>cvF(idx,x,mat,P)-alvo;if(!(f(a)*f(b)<=0))return NaN;
  for(let i=0;i<80;i++){const m=(a+b)/2;if(f(a)*f(m)<=0)b=m;else a=m}return (a+b)/2}
function cvFmt(idx,v){if(isFinite(v)&&Math.abs(v)<0.005)v=0;const sg=(b,x)=>b+(x<0?' − ':' + ')+fx(Math.abs(x),2)+'%';if(isFinite(v)&&idx==='IPCA')return sg('IPCA',v);if(isFinite(v)&&idx==='DI_SPREAD')return sg('CDI',v);return !isFinite(v)?'—':idx==="DI_PCT"?fx(v,2)+'% do CDI':idx==="IPCA"?'IPCA + '+fx(v,2)+'%':idx==="DI_SPREAD"?'CDI + '+fx(v,2)+'%':fx(v,2)+'% a.a.'}
function cvCalc(){
  const out=$("cvOut");if(!out)return;if(!$("cvMat").value)$("cvMat").value=isoD(addMonths(VAL,36));const idx=$("cvIdx").value,r=num($("cvRate").value),mat=parseDate($("cvMat").value),isento=$("cvIr").value==="isento",P=cvPrem();
  const L=CV_IDX.find(x=>x[0]===idx);$("cvRatePre").textContent=idx==="IPCA"?"IPCA +":idx==="DI_SPREAD"?"CDI +":"";$("cvRateSuf").textContent=idx==="DI_PCT"?"% do CDI":"% a.a.";
  $("cvRate").parentNode.classList.toggle("p",idx==="IPCA"||idx==="DI_SPREAD");
  if(!isFinite(r)){out.innerHTML='<p class="err">Informe a taxa.</p>';return}
  if(isNaN(mat)||mat<=VAL+DAY){out.innerHTML='<p class="err">Informe um vencimento futuro.</p>';return}
  const n=du(VAL,mat),dc=Math.round((mat-VAL)/DAY),ir=isento?0:irRate(dc),G=cvF(idx,r,mat,P),N=1+(G-1)*(1-ir),ano=x=>(Math.pow(x,252/n)-1)*100;
  if(!(G>0)){out.innerHTML='<p class="err">Não foi possível calcular com essa taxa.</p>';return}
  let h='<div class="tot"><div><span>Taxa efetiva bruta</span><b>'+fx(ano(G),2)+'% a.a.</b></div><div><span>Taxa efetiva líquida</span><b class="gain">'+fx(ano(N),2)+'% a.a.</b></div><div><span>IR no vencimento</span><b>'+(isento?'isento':fx(ir*100,1)+'%')+'</b></div></div>'
    +'<div class="tablewrap" style="max-height:none;margin-top:10px"><table class="ctab"><thead><tr><th style="text-align:left">Formato</th><th>Equivale, bruto</th><th>Equivale, líquido</th></tr></thead><tbody>'
    +CV_IDX.map(([k,nome])=>'<tr'+(k===idx?' style="font-weight:700"':'')+'><td style="text-align:left">'+nome+(k===idx?' <small>(informado)</small>':'')+'</td><td>'+cvFmt(k,k===idx?r:cvSolve(k,G,mat,P))+'</td><td>'+cvFmt(k,cvSolve(k,N,mat,P))+'</td></tr>').join("")
    +'</tbody></table></div>';
  if(!isento)h+='<p style="margin:10px 0 0">Uma aplicação <b>isenta</b> (LCI, LCA, CRI, CRA, debênture incentivada) empata pagando <b>'+cvFmt(idx,cvSolve(idx,N,mat,P))+'</b>.</p>';
  const cdiM=P.cdi!=null?P.cdi*100:ano(bkFactor("DI_PCT",100,VAL,mat)),ipM=P.ipca!=null?P.ipca*100:ano(bkFactor("IPCA",0,VAL,mat));
  h+='<p class="sub" style="font-size:.82rem;margin-top:10px">Prazo: '+n+' dias úteis ('+dc+' dias corridos), até '+fdate(mat)+'. Premissas: CDI médio de <b>'+fx(cdiM,2)+'%</b> e IPCA médio de <b>'+fx(ipM,2)+'%</b> ao ano até o vencimento'+(P.cdi==null&&P.ipca==null?', lidos da curva de juros e da inflação implícita da ANBIMA':P.cdi!=null&&P.ipca!=null?', digitados por você':', parte digitada por você e parte pela curva da ANBIMA')+'. '
    +'CDI + e IPCA + compõem a taxa base e a sobretaxa por produto, (1+base)×(1+taxa)−1, e não por soma. % do CDI segue a regra da B3: o percentual multiplica o CDI de cada dia. O IR incide sobre o rendimento total no vencimento (22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% acima); resgates com menos de 30 dias também pagam IOF. A comparação não inclui o risco de crédito de cada emissor.</p>';
  out.innerHTML=h;
}
function cvBind(){if(!$("cvForm"))return;$("cvForm").addEventListener("input",()=>{clearTimeout(cvBind.t);cvBind.t=setTimeout(cvCalc,150)});$("cvForm").addEventListener("change",cvCalc)}

/* ---------- Inflação: IPCA, CDI e juro real de cada ano desde 2006 (índices mensais do Banco Central guardados no robô de ativos) */
const INA={b:null,err:null,load:null};
function inAnoHtml(){
  if(!INA.b){if(!INA.load&&!INA.err)INA.load=atGet("bench.json").then(b=>{INA.b=b;INA.load=null;if(activeMod==="in")mkCalc()}).catch(e=>{INA.err=e;INA.load=null});return INA.err?'':'<h3>IPCA, CDI e juro real por ano</h3><p class="sub">Carregando…</p>'}
  const m=INA.b.m||{},C=m.cdi||{},I=m.ipca||{},ult=Object.keys(I).sort().pop()||"",y1=+ult.slice(0,4),L=[];
  const ac=(S,y,ate)=>{let f=1;for(let k=1;k<=ate;k++){const v=S[y+String(k).padStart(2,"0")];if(v==null)return null;f*=1+v/100}return (f-1)*100}; // taxas mensais em %
  for(let y=y1;y>=2006;y--){const ate=y===y1?+ult.slice(4):12,ip=ac(I,y,ate),ci=ac(C,y,ate);if(ci==null||ip==null)continue;
    L.push({y,ci,ip,re:((1+ci/100)/(1+ip/100)-1)*100,parc:ate<12,ate:ate<12?ate:null})}
  if(!L.length)return "";const cheio=L.filter(x=>!x.parc),med=k=>cheio.reduce((s,x)=>s+x[k],0)/cheio.length,neg=cheio.filter(x=>x.re<0).length;
  return '<h3>IPCA, CDI e juro real por ano</h3><p class="sub">Quanto o CDI rendeu acima da inflação em cada ano. O juro real é ganho de poder de compra: (1 + CDI) ÷ (1 + IPCA) − 1.</p>'
    +'<div class="fnkpis">'+[["IPCA médio",fx(med("ip"),2)+'%'],["CDI médio",fx(med("ci"),2)+'%'],["Juro real médio",fx(med("re"),2)+'%'],["Anos com juro real negativo",neg+' de '+cheio.length]].map(x=>'<div class="fnkp"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join("")+'</div>'
    +'<div class="tablewrap"><table class="ctab"><thead><tr><th style="text-align:left">Ano</th><th>IPCA</th><th>CDI</th><th>Juro real</th></tr></thead><tbody>'
    +L.map(x=>'<tr><td style="text-align:left">'+x.y+(x.parc?' <small>(até '+['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+x.ate]+')</small>':'')+'</td><td>'+fx(x.ip,2)+'%</td><td>'+fx(x.ci,2)+'%</td><td class="'+(x.re>=0?'pos':'neg')+'">'+fx(x.re,2)+'%</td></tr>').join("")
    +'</tbody></table></div><p class="sub" style="font-size:.8rem">Fonte: Banco Central (SGS): IPCA, série 433; CDI acumulado no mês, série 4391. Acumulado dos meses de janeiro a dezembro por capitalização composta. Médias aritméticas dos anos completos; o ano em curso aparece até o último mês divulgado e fica fora das médias.</p>';
}
