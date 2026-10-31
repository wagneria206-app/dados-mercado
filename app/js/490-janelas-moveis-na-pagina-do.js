/* ---------- janelas móveis na página do fundo ou ativo */
function fnJanHtml(F){
  const n=FN.jan||12,S=cmpJanSeries(F,n);if(S.length<3)return "";
  const st=cmpJan(F,n,null),m=FN.L.m.cdi||{},cs=[];Object.keys(m).map(Number).sort((a,b)=>a-b).forEach(k=>{if(m[k-n]&&fnMt(k)>=S[0][0]&&fnMt(k)<=S[S.length-1][0]+5*DAY)cs.push([fnMt(k),(m[k]/m[k-n]-1)*100])});
  let h='<section class="panel"><h3>Janelas móveis</h3><div class="fnrow"><label class="sub" style="display:flex;gap:8px;align-items:center">Janela de <select data-fnjan="1">'+[12,24,36].map(x=>'<option value="'+x+'"'+(x===n?' selected':'')+'>'+x+' meses</option>').join("")+'</select></label></div>';
  h+=fnChart([{lab:"Retorno em "+n+" meses",col:FN_COLS[0],w:2,pts:S},{lab:"CDI em "+n+" meses",col:"var(--flat)",dash:"5 4",w:1.4,pts:cs}],{fmt:"pct",zero:true,months:true,aria:"Janelas móveis"});
  const it=(a,b)=>'<div><dt>'+a+'</dt><dd>'+b+'</dd></div>';
  h+='<dl class="fninfo fnrisk">'+it("Janelas analisadas",fx(st.jn,0))+it("Acima do CDI",st.jcdi!=null?fx(st.jcdi,0)+'%':'—')+it("Positivas",fx(st.jpos,0)+'%')+it("Retorno médio",fnPct(st.jmed))+it("Mediana",fnPct(st.jmd))+it("Pior janela",fnPct(st.jmin))+it("Melhor janela",fnPct(st.jmax))+it("CDI médio na janela",fnPctT(st.jc))+'</dl>';
  return h+'<p class="sub" style="font-size:.8rem">Retorno de cada período de '+n+' meses terminando no fim de cada mês. Mostra o que aconteceu com quem ficou '+n+' meses, qualquer que fosse o mês de entrada.</p></section>';
}

