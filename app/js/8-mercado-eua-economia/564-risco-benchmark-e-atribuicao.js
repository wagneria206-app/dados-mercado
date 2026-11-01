/* ---------- risco de mercado (VaR, CVaR, duration), benchmark personalizado e atribuição de resultado
   VaR e CVaR históricos pela série mensal da simulação; duration pelo vencimento e pelos cupons de cada título;
   benchmark composto com rebalanceamento mensal (ex.: 70% CDI + 30% Ibovespa); atribuição: quanto cada item e cada classe somou. */
function spVar(r,conf){if(r.length<12)return null;const s=r.slice().sort((a,b)=>a-b),n=s.length,q=Math.max(1,Math.floor(n*(1-conf)));return {var:-s[q-1]*100,cvar:-s.slice(0,q).reduce((a,b)=>a+b,0)/q*100,n}}
/* duration (anos) e sensibilidade de cada item a +1 p.p. nos juros */
function spDur(x){const h=Date.parse(spHoje()+"T00:00:00Z"),anos=t=>Math.max(0,(t-h)/(365.25*DAY));
  const td=spTd(x);if(td){if(td.kind==="LFT")return {d:0,tipo:"pós"};const key=Object.keys(TD_ALL||{}).find(k=>k===td.kind+"|"+td.d),y=(key&&TD_ALL[key].rate!=null?TD_ALL[key].rate:td.K.fam==="ipca"?7:13)/100;
    if(td.K.b1){const ts=[];for(let j=0;j<td.K.b1;j++){const t=addMonths(td.ini,j);if(t>h)ts.push(anos(t))}const pv=ts.map(t=>Math.pow(1+y,-t)),s=pv.reduce((a,b)=>a+b,0);return {d:s?ts.reduce((a,t,i)=>a+t*pv[i],0)/s:0,y,tipo:"IPCA+"}}
    if(!td.K.cpn)return {d:anos(td.mat),y,tipo:td.K.fam==="ipca"?"IPCA+":"pré"};
    const cup=td.kind==="NTNF"?Math.pow(1.1,0.5)-1:Math.pow(1.06,0.5)-1,ts=couponDates(td.mat,h,td.mat).map(anos);let s=0,sw=0;ts.forEach((t,i)=>{const f=(cup+(i===ts.length-1?1:0))*Math.pow(1+y,-t);s+=f;sw+=f*t});return {d:s?sw/s:0,y,tipo:td.K.fam==="ipca"?"IPCA+":"pré"}}
  if(x.t==="s"){if(x.rf==="cdi"||x.rf==="cdimais")return {d:0,tipo:"pós"};const v=spVenc(x);const y=(+x.x||0)/100;return v?{d:anos(Date.parse(v.d+"T00:00:00Z")),y,tipo:x.rf==="ipca"?"IPCA+":"pré",aprox:1}:{d:null,tipo:x.rf==="ipca"?"IPCA+":"pré"}}
  return null}
function spRiscoHtml(c,it,R){
  if(!it.length||!R||!R.rets)return "";const {w,tot,real}=spPesos(c,it),pat=real?SP_POS.X.T.v:tot,M=spMensais(R),V95=spVar(M,0.95),V99=spVar(M,0.99);
  const kp=(a,b,cc,cls)=>'<div class="fnkp'+(cls?' '+cls:'')+'"><span>'+a+'</span><b>'+b+'</b>'+(cc?'<small>'+cc+'</small>':'')+'</div>';
  const D=it.map((x,i)=>({x,w:w[i],D:spDur(x)})),rf=D.filter(o=>o.D&&o.D.d!=null&&o.w>0),rfp=rf.filter(o=>o.D.d>0),wp=rfp.reduce((a,o)=>a+o.w,0);
  const dm=wp>0?rfp.reduce((a,o)=>a+o.w*o.D.d,0)/wp:null,sens=rfp.reduce((a,o)=>a+o.w*o.D.d/(1+(o.D.y||0)),0);   // −% da carteira por +1 p.p.
  const semD=D.filter(o=>o.w>0&&o.D&&o.D.d==null);
  let h='<section class="panel" data-reltit="Risco de mercado"><h3>Risco de mercado</h3><p class="sub">Quanto a carteira pode perder em um mês ruim e quanto ela sente uma alta de juros.</p><div class="fnkpis">'
    +kp("VaR 95% (1 mês)",V95?'<span class="neg">−'+fx(V95.var,2)+'%</span>':'—',V95?'≈ '+brl(pat*V95.var/100)+' · em 1 de cada 20 meses a perda passou disso':'histórico curto')
    +kp("CVaR 95% (1 mês)",V95?'<span class="neg">−'+fx(V95.cvar,2)+'%</span>':'—',V95?'≈ '+brl(pat*V95.cvar/100)+' · média dos 5% piores meses':'')
    +kp("VaR 99% (1 mês)",V99&&V99.n>=60?'<span class="neg">−'+fx(V99.var,2)+'%</span>':'—',V99&&V99.n>=60?'≈ '+brl(pat*V99.var/100)+' · 1 de cada 100 meses':'precisa de 5 anos de histórico')
    +kp("Duration (pré e IPCA+)",dm!=null?fx(dm,1)+' anos':'—',dm!=null?fx(wp*100,0)+'% da carteira em taxa travada':'sem renda fixa de taxa travada com vencimento conhecido')
    +kp("Juros +1 p.p.",sens>0?'<span class="neg">−'+fx(sens,2)+'%</span>':'—',sens>0?'≈ −'+brl(pat*sens/100)+' na marcação a mercado':'',sens>3?'kpalerta':'')+'</div>';
  if(rf.length)h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab ordenavel"><thead><tr><th style="text-align:left">Item</th><th style="text-align:left">Indexador</th><th>Peso</th><th>Duration</th><th>Juros +1 p.p.</th></tr></thead><tbody>'
    +rf.sort((a,b)=>b.D.d-a.D.d).map(o=>'<tr><td style="text-align:left" class="tw">'+esc(spItemNome(o.x)).slice(0,48)+'</td><td style="text-align:left">'+o.D.tipo+'</td><td>'+fx(o.w*100,1)+'%</td><td data-ordem="'+o.D.d+'">'+(o.D.d>0?fx(o.D.d,1)+' anos'+(o.D.aprox?' *':''):'≈ 0 (pós)')+'</td><td>'+(o.D.d>0?'−'+fx(o.D.d/(1+(o.D.y||0)),2)+'%':'—')+'</td></tr>').join("")+'</tbody></table></div>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">VaR e CVaR históricos: a partir dos '+(V95?V95.n:M.length)+' meses da simulação dos pesos atuais (não é previsão; meses de crise fora do histórico não aparecem). Duration de Macaulay pelos cupons e vencimento oficiais do Tesouro e a taxa de hoje; títulos pós-fixados (Selic, CDI) têm duration de taxa perto de zero. Juros +1 p.p. = duration modificada × 1 ponto: quanto o preço cai se as taxas sobem 1 ponto de uma vez (só importa se vender antes do vencimento). '+(it.some(x=>x.t==="s"&&x.rf!=="cdi"&&x.rf!=="cdimais")?'* Renda fixa privada: duration pelo vencimento informado (sem cupons). ':'')+(semD.length?semD.length+(semD.length>1?' itens prefixados ou IPCA+':' item prefixado ou IPCA+')+' sem vencimento: informe na composição. ':'')+'Fundos não entram na duration (a CVM não informa); veja o raio-X.</p></section>';
  return h}

/* benchmark composto: c.bmx = {cdi, ibov, ifix, usd, ipcax: pesos em %, tx: taxa do IPCA+} */
const SP_BMX=[["cdi","CDI"],["ibov","Ibovespa"],["ifix","IFIX"],["usd","Dólar"],["ipcax","IPCA +"]];
function spBmx(c){if(!c.bmx)c.bmx={cdi:100,ibov:0,ifix:0,usd:0,ipcax:0,tx:5};return c.bmx}
function spBmxSerie(c,R){const B=spBmx(c),soma=SP_BMX.reduce((a,[k])=>a+(+B[k]||0),0);if(!(soma>0))return null;
  const S=SP_BMX.filter(([k])=>+B[k]>0).map(([k])=>({p:+B[k]/soma,m:R.diaria?spBmDaily(k,Object.assign({},c,{ipcax:String(B.tx)})):spBmSeries(k,Object.assign({},c,{ipcax:String(B.tx)}))}));if(S.some(s=>!s.m))return null;
  const out=new Map();let v=1,prev=R.k0;out.set(R.k0,1);for(const x of R.rets){let r=0;for(const s of S){const a=s.m.get(prev),b=s.m.get(x.k);if(!a||!b)return out.size>1?out:null;r+=s.p*(b/a-1)}v*=1+r;out.set(x.k,v);prev=x.k}return out}
/* atribuição: pesos-alvo no início de cada janela, deslizando com os retornos (soma exatamente o retorno da janela) */
function spAtrib(R,i0){const n=R.rets.length;if(i0<0||i0>=n)return null;let V=R.w.slice();const T0=V.reduce((a,b)=>a+b,0),C=V.map(()=>0);
  for(let j=i0;j<n;j++){V=V.map((v,i)=>{const r=R.irets[i][j];C[i]+=v/T0*r;return v*(1+r)})}return C.map(x=>x*100)}
function spBmAtribHtml(c,it,R){
  if(!it.length||!R||!R.rets||!R.rets.length)return "";const B=spBmx(c),BS=spBmxSerie(c,R),n=R.rets.length,lm=R.rets[n-1].m,ret=(i0)=>{let v=1;for(let j=i0;j<n;j++)v*=1+R.rets[j].r;return (v-1)*100};
  const iM=R.rets.findIndex(x=>x.m===lm),iA=R.rets.findIndex(x=>Math.floor(x.m/12)===Math.floor(lm/12)),i12=R.rets.findIndex(x=>x.m>lm-12);
  const bk=(i0)=>{if(!BS)return null;const a=BS.get(i0>0?R.rets[i0-1].k:R.k0),b=BS.get(R.rets[n-1].k);return a&&b?(b/a-1)*100:null};
  const J=[["No mês",iM],["No ano",iA],["12 meses",R.rets.length>=(R.diaria?240:12)?i12:-1],["Período todo",0]].filter(x=>x[1]>=0);
  const nome=SP_BMX.filter(([k])=>+B[k]>0).map(([k,l])=>fx(+B[k],0)+'% '+(k==="ipcax"?'IPCA + '+fx(+B.tx||0,1)+'%':l)).join(" + ")||"—";
  let h='<section class="panel" data-reltit="Benchmark e atribuição"><h3>Benchmark da carteira e atribuição de resultado</h3><p class="sub">Compare a carteira com um índice de referência feito sob medida e veja de onde veio o resultado.</p>';
  h+='<div class="sprow" style="margin-top:6px">'+SP_BMX.map(([k,l])=>'<div class="field"><label for="spBx'+k+'">'+l+(k==="ipcax"?'':'')+'</label><div class="affix s"><input id="spBx'+k+'" inputmode="decimal" data-spbmx="'+k+'" value="'+fx(+B[k]||0,0)+'"><span class="suf">%</span></div></div>').join("")
    +'<div class="field"><label for="spBxtx">Taxa do IPCA +</label><div class="affix s"><input id="spBxtx" inputmode="decimal" data-spbmx="tx" value="'+fx(+B.tx||0,2)+'"><span class="suf">% a.a.</span></div></div></div>';
  h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab"><thead><tr><th style="text-align:left">Janela</th><th>Carteira</th><th>Benchmark ('+esc(nome)+')</th><th>Diferença</th></tr></thead><tbody>'
    +J.map(([l,i0])=>{const a=ret(i0),b=bk(i0);return '<tr><td style="text-align:left">'+l+'</td><td>'+fnPct(a)+'</td><td>'+(b!=null?fnPct(b):'—')+'</td><td class="'+(b==null?'':a>=b?'pos':'neg')+'">'+(b!=null?(a>=b?'+':'−')+fx(Math.abs(a-b),2)+' p.p.':'—')+'</td></tr>'}).join("")+'</tbody></table></div>';
  if(BS){const pts=fnThin(R.pts,800);h+=fnChart([{lab:c.nome,col:FN_COLS[0],w:2.2,pts:pts.map(p=>[p.t,(p.idx-1)*100])},{lab:"Benchmark",col:"var(--s2)",dash:"5 4",w:1.6,pts:pts.map(p=>{const v=BS.get(p.k);return [p.t,v?(v-1)*100:null]})}],{fmt:"pct",zero:true,months:!R.diaria,h:200,aria:"Carteira contra o benchmark"})}
  // atribuição por item e por classe
  const A=J.map(([l,i0])=>[l,spAtrib(R,i0)]),cls={};it.forEach((x,i)=>{const k=spCl(x);(cls[k]=cls[k]||[]).push(i)});
  h+='<div class="label" style="margin-top:12px">Atribuição: quanto cada classe e cada item somou (pontos percentuais)</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab ordenavel"><thead><tr><th style="text-align:left">Classe / item</th><th>Peso</th>'+A.map(([l])=>'<th>'+l+'</th>').join("")+'</tr></thead><tbody>'
    +Object.entries(cls).map(([k,ix])=>'<tr class="cmpbm"><td style="text-align:left"><i class="fndot" style="background:'+SP_CL_COR[k]+'"></i><b>'+esc(SP_CL[k])+'</b></td><td>'+fx(ix.reduce((a,i)=>a+R.w[i],0)*100,1)+'%</td>'+A.map(([,C])=>{const v=ix.reduce((a,i)=>a+C[i],0);return '<td class="'+(v>=0?'pos':'neg')+'"><b>'+(v>=0?'+':'−')+fx(Math.abs(v),2)+'</b></td>'}).join("")+'</tr>'
      +ix.map(i=>'<tr><td style="text-align:left;padding-left:22px" class="tw"><small>'+esc(spItemNome(it[i])).slice(0,46)+'</small></td><td><small>'+fx(R.w[i]*100,1)+'%</small></td>'+A.map(([,C])=>'<td class="'+(C[i]>=0?'pos':'neg')+'"><small>'+(C[i]>=0?'+':'−')+fx(Math.abs(C[i]),2)+'</small></td>').join("")+'</tr>').join("")).join("")
    +'<tr><td style="text-align:left"><b>Carteira</b></td><td>100%</td>'+J.map(([,i0])=>'<td><b>'+fnPct(ret(i0))+'</b></td>').join("")+'</tr></tbody></table></div>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Benchmark composto com rebalanceamento mensal aos pesos escolhidos (séries do Banco Central e da B3). Atribuição pela simulação: em cada janela a carteira começa nos pesos-alvo e cada item soma peso × retorno a cada período, com os pesos andando junto com os preços; a soma dos itens é o retorno da carteira na janela. Sem IR e sem aportes.</p></section>';
  return h}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.spbmx||activeMod!=="sp")return;const B=spBmx(spC()),v=num(t.value);B[t.dataset.spbmx]=isFinite(v)?Math.max(0,v):0;spSave();spCalc()});
