/* ---------- Teto do FGC: maior aporte que, no vencimento, ainda fica dentro da garantia (R$ 250 mil por CPF e por
   conglomerado, Resolução CMN 4.222/2013, contando principal e juros, antes do IR). Juros projetados pela curva de juros e
   pela inflação implícita da ANBIMA (bkFactor), com dias úteis do calendário da B3. */
function fgApplyIdx(){const I=BK_IDX[$("fgIdx").value];$("fgRatePre").textContent=I.pre;$("fgRateSuf").textContent=I.suf;$("fgRate").parentNode.classList.toggle("p",!!I.pre)}
function fgCalc(){
  const out=$("fgOut");if(!out)return;fgApplyIdx();if(!$("fgBuy").value)$("fgBuy").value=isoD(VAL);if(!$("fgMat").value)$("fgMat").value=isoD(addMonths(VAL,36));
  const idx=$("fgIdx").value,r=num($("fgRate").value),a=parseDate($("fgBuy").value),b=parseDate($("fgMat").value),ja=num($("fgJa").value)||0,mg=(num($("fgMg").value)||0)/100,lim=num($("fgLim").value);
  const err=t=>{out.innerHTML='<p class="err">'+t+'</p>'};
  if(!isFinite(r))return err("Informe a taxa.");if(isNaN(a)||isNaN(b))return err("Preencha as duas datas.");if(b<=a)return err("O vencimento precisa ser depois da aplicação.");
  if(!(lim>0))return err("Informe o teto da garantia.");if(mg<0||mg>=1)return err("A margem precisa ficar entre 0% e 99%.");
  const disp=(lim-ja)*(1-mg);if(disp<=0)return err("O que você já tem neste conglomerado ocupa todo o teto: um novo aporte ficaria sem cobertura.");
  const F=bkFactor(idx,r,a,b),n=du(a,b);if(!(F>0))return err("Não foi possível projetar essa taxa.");
  const max=Math.floor(disp/F*100)/100,fim=max*F,anos=n/252,ef=(Math.pow(F,1/anos)-1)*100,uso=(fim+ja)/lim*100,arred=Math.floor(max/1000)*1000;
  // sensibilidade: indexador 1 ponto acima do projetado (CDI ou IPCA), para calibrar a margem
  let sens=null;if(idx!=="PRE"){const base=Math.pow(idx==="IPCA"?bkFactor("IPCA",0,a,b):bkFactor("DI_PCT",100,a,b),1/anos)-1;
    const Fu=idx==="DI_PCT"?Math.pow(1+(Math.pow(1+base+0.01,1/252)-1)*r/100,n):Math.pow((1+base+0.01)*(1+r/100),anos);sens=(Fu/F-1)*100}
  const em=$("fgEm").value.trim(),cg=em&&typeof bkAcha==="function"?bkAcha(em):null;if(em&&typeof bkBoot==="function"&&!cg)bkBoot();
  let h='<div class="verdict"><span class="label">Aporte máximo</span></div><div class="big gain">'+brl(max)+'</div>'
    +(arred>0&&arred!==max?'<p class="sub" style="margin:2px 0 8px">Arredondado para baixo: <b>'+brl(arred)+'</b></p>':'')
    +'<div style="height:10px;border-radius:999px;background:var(--line);overflow:hidden;margin:10px 0 4px"><span style="display:block;height:100%;width:'+Math.min(100,uso).toFixed(1)+'%;background:var(--accent)"></span></div>'
    +'<p class="sub" style="margin:0 0 10px;font-size:.85rem">No vencimento: '+fx(uso,1)+'% do teto de '+brl(lim)+(ja>0?', contando '+brl(ja)+' que você já tem no grupo':'')+'.</p>'
    +'<div class="tot"><div><span>Valor bruto no vencimento</span><b>'+brl(fim)+'</b></div><div><span>Rendimento bruto</span><b>'+brl(fim-max)+'</b></div><div><span>Prazo</span><b>'+n+' dias úteis ('+fx(anos,2)+' anos)</b></div><div><span>Taxa efetiva</span><b>'+fx(ef,2)+'% a.a.</b></div></div>';
  if(sens!=null)h+='<p style="margin:10px 0 0">Se o '+(idx==="IPCA"?'IPCA':'CDI')+' médio ficar <b>1 ponto acima</b> do projetado, o valor no vencimento sobe '+fx(sens,2)+'%. '+(sens>mg*100?'<b class="neg">A margem de '+fx(mg*100,1)+'% não cobre esse desvio</b>: considere uma margem de pelo menos '+fx(Math.ceil(sens*10)/10,1)+'%.':'A margem de '+fx(mg*100,1)+'% cobre esse desvio.')+'</p>';
  // evolução por aniversário da aplicação
  const D=[];for(let k=1;;k++){const t=addMonths(a,12*k);if(t>=b)break;D.push(t)}D.push(b);
  h+='<div class="tablewrap" style="max-height:none;margin-top:12px"><table class="ctab"><thead><tr><th style="text-align:left">Data</th><th>Dias úteis</th><th>Saldo bruto</th><th>% do teto</th></tr></thead><tbody><tr><td style="text-align:left">'+fdate(a)+'</td><td>0</td><td>'+brl(max)+'</td><td>'+fx((max+ja)/lim*100,1)+'%</td></tr>'
    +D.map((t,i)=>{const v=max*bkFactor(idx,r,a,t),u=i===D.length-1;return '<tr'+(u?' style="font-weight:700"':'')+'><td style="text-align:left">'+fdate(t)+(u?' · vencimento':'')+'</td><td>'+du(a,t)+'</td><td>'+brl(v)+'</td><td>'+fx((v+ja)/lim*100,1)+'%</td></tr>'}).join("")+'</tbody></table></div>';
  h+='<div class="label" style="margin-top:14px">Confira antes de aplicar</div>'
    +(cg?'<p style="margin:4px 0">Conglomerado pelo Banco Central: <b>'+esc((cg.n||[])[0]||em)+'</b>. Some no campo "Já tenho" o que estiver em qualquer banco desse grupo.</p>'+(typeof bkSelo==="function"?bkSelo(em):''):em&&typeof BK==='object'&&BK.d?'<p class="sub" style="margin:4px 0">Não achei "'+esc(em)+'" na lista de conglomerados do Banco Central guardada no app: confira o nome no site do FGC.</p>':'')
    +'<ul style="margin:6px 0 0;padding-left:18px;font-size:.9rem;line-height:1.5"><li>O banco emissor está na <a href="https://www.fgc.org.br/instituicoes-associadas-e-conglomerados" target="_blank" rel="noopener">lista de associadas do FGC</a> (o emissor, não a corretora).</li><li>O produto é CDB, RDB, LC, LCI, LCA, LCD, LIG ou poupança. CRI, CRA, debênture, LF e fundos não têm FGC.</li><li>Somando todos os bancos, o total garantido respeita o teto global de R$ 1 milhão a cada 4 anos.</li></ul>'
    +'<p class="sub" style="font-size:.82rem;margin-top:10px">Cálculo: aporte máximo = (teto − já aplicado) × (1 − margem) ÷ fator até o vencimento. '+(idx==="PRE"?'Taxa prefixada: o valor final é conhecido.':idx==="IPCA"?'IPCA projetado pela inflação implícita da ANBIMA.':'CDI projetado pela curva de juros da ANBIMA.')+' O FGC considera o valor bruto, antes do IR. Consulte também o <a href="https://www.bcb.gov.br/estabilidadefinanceira/encontreinstituicao" target="_blank" rel="noopener">Banco Central</a> para confirmar o conglomerado.</p>';
  out.innerHTML=h;
}
function fgBind(){if(!$("fgForm"))return;
  $("fgForm").addEventListener("input",()=>{clearTimeout(fgBind.t);fgBind.t=setTimeout(fgCalc,150)});$("fgForm").addEventListener("change",fgCalc);
  $("fgCopia").addEventListener("click",()=>{$("fgIdx").value=$("bkIdx").value;$("fgRate").value=$("bkRate").value;$("fgEm").value=$("bkIssuer").value;if($("bkMat").value)$("fgMat").value=$("bkMat").value;const b=parseDate($("bkBuy").value);$("fgBuy").value=isoD(isNaN(b)||b<VAL?VAL:b);fgCalc()})}
