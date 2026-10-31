/* ---------- fundos similares e gross-up (página do fundo) */
function fnSimHtml(F){
  const C=FN.C,R=FN.idx.rows,me=fnRow(F.c);if(!me||me[C.r12]==null)return "";
  const cat=FN.idx.anbima[me[C.anbima]]?["anbima",me[C.anbima]]:["classe",me[C.classe]];
  const grp=R.filter(r=>r[0]!==F.c&&r[C[cat[0]]]===cat[1]&&r[C.tipo]===me[C.tipo]&&!(r[C.flags]&1)&&r[C.r12]!=null&&r[C.v12]!=null&&(r[C.pl]||0)>=5e6);
  if(grp.length<3)return "";
  const keys=["r12","r24","r36","v12","dd36"],sd={};keys.forEach(k=>{const v=grp.map(r=>r[C[k]]).filter(x=>x!=null);const m=v.reduce((a,x)=>a+x,0)/v.length;sd[k]=Math.sqrt(v.reduce((a,x)=>a+(x-m)**2,0)/v.length)||1});
  const dist=r=>{let s=0,n=0;keys.forEach(k=>{const a=me[C[k]],b=r[C[k]];if(a!=null&&b!=null){s+=((a-b)/sd[k])**2;n++}});return n>=2?Math.sqrt(s/n):Infinity};
  const top=grp.map(r=>[dist(r),r]).filter(x=>isFinite(x[0])).sort((a,b)=>a[0]-b[0]).slice(0,8).map(x=>x[1]);if(!top.length)return "";
  let h='<section class="panel"><h3>Fundos similares</h3><p class="sub">Da mesma categoria, com retorno e risco mais parecidos nos últimos 12, 24 e 36 meses (patrimônio acima de R$ 5 milhões, sem exclusivos).</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Fundo</th><th>12 meses</th><th class="c-ph">36 meses</th><th>Vol. 12m</th><th class="c-ph">Taxa adm.</th><th>PL</th><th></th></tr></thead><tbody>';
  [me].concat(top).forEach((r,j)=>{h+='<tr'+(j?'':' class="cmpbm"')+'><td style="text-align:left" class="tw">'+(j?'<button type="button" class="link" data-fnopen="'+r[0]+'">'+esc(r[1])+'</button>':'<b>Este fundo</b>')+'<small style="display:block;color:var(--muted)">'+esc(FN.idx.gestores[r[C.gestor]]||"")+'</small></td><td>'+fnPct(r[C.r12])+'</td><td class="c-ph">'+fnPct(r[C.r36])+'</td><td>'+(r[C.v12]!=null?fx(r[C.v12],2)+'%':'—')+'</td><td class="c-ph">'+(r[C.tadm]!=null?fx(r[C.tadm],2)+'%':'—')+'</td><td>'+fnMoney(r[C.pl])+'</td><td>'+(j?'<button type="button" class="link" data-fncmp="'+r[0]+'">'+(FN.cmp.includes(r[0])?'✓':'+')+'</button>':'')+'</td></tr>'});
  return h+'</tbody></table></div><button type="button" class="btn sec" style="margin-top:8px" data-cmpaddmany="'+[F.c].concat(top.map(r=>r[0])).join(",")+'">Comparar este fundo com os similares</button></section>';
}
function fnGrossHtml(F){
  const r=fnRet(F,"12");if(!r)return "";const c=fnBmRet("cdi",r.p0,r.p1);if(!c||c<=0)return "";
  const acoes=/a[cç][oõ]es/i.test((F.cls||"")+(F.anb||"")),lp=/^s/i.test(F.lp||""),pc=r.r/c*100;
  const faixas=acoes?[["Qualquer prazo",15]]:lp?[["Até 180 dias",22.5],["181 a 360 dias",20],["361 a 720 dias",17.5],["Acima de 720 dias",15]]:[["Até 180 dias",22.5],["Acima de 180 dias",20]];
  const iso=FN.gu!=null&&FN.gu!==""?num(FN.gu):null;
  let h='<section class="panel"><h3>Gross-up: comparar com investimentos isentos</h3><p class="sub">Nos últimos 12 meses o fundo rendeu <b>'+fnPctT(r.r)+'</b> bruto ('+fx(pc,0)+'% do CDI). Quanto sobra depois do IR, pelo prazo da aplicação, e quanto um título isento de IR (LCI, LCA, CRI, CRA, debênture incentivada) precisaria pagar para empatar:</p>';
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Prazo</th><th>IR</th><th>Líquido no período</th><th>Isento equivalente</th>'+(iso?'<th>Fundo/CDB precisa render</th>':'')+'</tr></thead><tbody>';
  faixas.forEach(([lab,ir])=>{const l=r.r*(1-ir/100);h+='<tr><td style="text-align:left">'+lab+'</td><td>'+fx(ir,1)+'%</td><td>'+fnPct(l)+'</td><td>'+fx(pc*(1-ir/100),0)+'% do CDI</td>'+(iso?'<td>'+fx(iso/(1-ir/100),1)+'% do CDI</td>':'')+'</tr>'});
  h+='</tbody></table></div><div class="fnrow" style="margin-top:8px"><label class="sub" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">Tem uma oferta isenta? Informe a taxa: <span class="affix s" style="max-width:140px"><input inputmode="decimal" data-fngu="1" value="'+esc(FN.gu||"")+'" placeholder="ex.: 92"><span class="suf">% CDI</span></span></label></div>';
  return h+'<p class="sub" style="font-size:.8rem">'+(acoes?'Fundos de ações pagam 15% de IR só no resgate, sem come-cotas.':lp?'Fundo de longo prazo: tabela regressiva de 22,5% a 15%, com come-cotas de 15% em maio e novembro (a diferença é cobrada no resgate).':'Fundo de curto prazo: 22,5% até 180 dias e 20% depois, com come-cotas de 20%.')+' IOF (só para resgates em menos de 30 dias) não incluído.</p></section>';
}
function fnCartHistHtml(F){
  const H=F.carth;if(!H)return "";const ms=Object.keys(H).sort();if(ms.length<2)return "";
  const tot={};ms.forEach(m=>H[m].forEach(([t,p])=>{tot[t]=(tot[t]||0)+Math.abs(p)}));const tps=Object.keys(tot).sort((a,b)=>tot[b]-tot[a]).slice(0,8);
  const show=ms.slice(-12).reverse();
  let h='<div class="label" style="margin-top:12px">Composição mês a mês (% do PL)</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Tipo de ativo</th>'+show.map(m=>'<th>'+m.slice(4)+'/'+m.slice(2,4)+'</th>').join("")+'</tr></thead><tbody>';
  tps.forEach(t=>{h+='<tr><td style="text-align:left" class="tw"><small>'+esc(t)+'</small></td>'+show.map(m=>{const x=H[m].find(y=>y[0]===t);return '<td>'+(x?fx(x[1],1):'—')+'</td>'}).join("")+'</tr>'});
  return h+'</tbody></table></div>';
}

