/* ---------- Estratégias: fatores da Bolsa. Todo mês, desde 2007, as ações líquidas são ordenadas por cinco critérios
   clássicos e o quinto mais bem colocado forma uma carteira de pesos iguais para o mês seguinte (painel.json, sem olhar o
   futuro: o balanço só entra depois de publicado). Mostra o que tem funcionado e quem se encaixa hoje em cada estilo. */
const FT_DEF=[
  ["valor","Valor","lucro alto para o preço (menor P/L positivo)",(a,m)=>{const p=a.pl[m];return p>0&&p<60?1/p:null}],
  ["div","Dividendos","maior rendimento em proventos nos últimos 12 meses",(a,m)=>{const d=a.dy[m];return d>0&&d<40?d:null}],
  ["qual","Qualidade","maior retorno sobre o patrimônio (ROE)",(a,m)=>{const r=a.roe[m];return r>0&&r<100?r:null}],
  ["mom","Momento","maior alta em 12 meses, sem o último mês",(a,m)=>{let f=1,n=0;for(let k=m-11;k<m;k++){const x=a.ret[k];if(x!=null){f*=1+x/100;n++}}return n>=10?f:null}],
  ["bvol","Baixa volatilidade","menor oscilação mensal em 12 meses",(a,m)=>{const v=[];for(let k=m-11;k<=m;k++){const x=a.ret[k];if(x!=null)v.push(x)}if(v.length<10)return null;const mu=v.reduce((s,x)=>s+x,0)/v.length;return -Math.sqrt(v.reduce((s,x)=>s+(x-mu)*(x-mu),0)/(v.length-1))}]];
const FTR={r:null};
function ftCalc(pn){
  const M=pn.meses,A=Object.entries(pn.a),m0=M.indexOf("2007-01"),out={},sel={};FT_DEF.forEach(([k])=>{out[k]=[]});out.uni=[];out.ibov=[];
  for(let m=Math.max(m0,12);m<M.length-1;m++){
    const U=A.filter(([t,a])=>(a.liq[m]||0)>=2e6&&a.ret[m]!=null);if(U.length<40)continue;
    const nx=a=>a.ret[m+1];out.ibov.push([M[m+1],pn.ibov[m+1]]);{const v=U.map(([t,a])=>nx(a)).filter(x=>x!=null);out.uni.push([M[m+1],v.reduce((s,x)=>s+x,0)/v.length])}
    FT_DEF.forEach(([k,,,f])=>{const sc=U.map(([t,a])=>({t,a,s:f(a,m)})).filter(x=>x.s!=null).sort((x,y)=>y.s-x.s),q=sc.slice(0,Math.max(5,Math.round(sc.length/5)));
      const v=q.map(x=>nx(x.a)).filter(x=>x!=null);out[k].push([M[m+1],v.length?v.reduce((s,x)=>s+x,0)/v.length:0])})}
  const ml=M.length-1;FT_DEF.forEach(([k,,,f])=>{sel[k]=A.filter(([t,a])=>(a.liq[ml]||0)>=5e6&&a.ret[ml]!=null).map(([t,a])=>({t,n:a.n,s:f(a,ml)})).filter(x=>x.s!=null).sort((x,y)=>y.s-x.s).slice(0,8)});
  return {out,sel,ate:M[ml]}}
function ftAcum(L,n){const v=n?L.slice(-n):L;let f=1;v.forEach(p=>{f*=1+(p[1]||0)/100});return (f-1)*100}
function ftHtml(){
  if(!BT.pn){if(typeof btBoot==="function")btBoot();return '<h3>Fatores da Bolsa</h3><p class="sub">Carregando o histórico mensal das ações…</p>'}
  if(!FTR.r||FTR.r.pn!==BT.pn)FTR.r={pn:BT.pn,x:ftCalc(BT.pn)};const {out,sel,ate}=FTR.r.x;if(!out.ibov.length)return "";
  const an=L=>{const y=L.length/12;return y?(Math.pow(1+ftAcum(L)/100,1/y)-1)*100:null},rows=FT_DEF.map(([k,n,d])=>({k,n,d,a12:ftAcum(out[k],12),a36:ftAcum(out[k],36),aa:an(out[k])}));
  const ib12=ftAcum(out.ibov,12),ib36=ftAcum(out.ibov,36),ibA=an(out.ibov),top=rows.slice().sort((a,b)=>b.a12-a.a12);
  let h='<h3>Fatores da Bolsa: o que tem funcionado</h3><p class="sub">Todo mês, o quinto das ações líquidas mais bem colocado em cada critério vira uma carteira de pesos iguais no mês seguinte. Mostra que estilo de ação o mercado tem premiado.</p>'
    +'<p style="margin:6px 0">Nos últimos 12 meses, o estilo que mais rendeu foi <b>'+top[0].n+'</b> ('+mcSig(top[0].a12,1)+', contra '+mcSig(ib12,1)+' do Ibovespa); o que menos rendeu foi <b>'+top[top.length-1].n+'</b> ('+mcSig(top[top.length-1].a12,1)+').</p>'
    +'<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Fator</th><th>12 meses</th><th>36 meses</th><th>Ao ano desde '+out.ibov[0][0].slice(0,4)+'</th></tr></thead><tbody>'
    +rows.map(r=>'<tr><td style="text-align:left"><b>'+r.n+'</b><small style="display:block;color:var(--muted)">'+r.d+'</small></td><td class="'+(r.a12>=ib12?'pos':'neg')+'">'+mcSig(r.a12,1)+'</td><td class="'+(r.a36>=ib36?'pos':'neg')+'">'+mcSig(r.a36,1)+'</td><td>'+fx(r.aa,1)+'%</td></tr>').join("")
    +'<tr><td style="text-align:left">Ibovespa</td><td>'+mcSig(ib12,1)+'</td><td>'+mcSig(ib36,1)+'</td><td>'+fx(ibA,1)+'%</td></tr><tr><td style="text-align:left">Média das ações líquidas</td><td>'+mcSig(ftAcum(out.uni,12),1)+'</td><td>'+mcSig(ftAcum(out.uni,36),1)+'</td><td>'+fx(an(out.uni),1)+'%</td></tr></tbody></table></div>';
  const ser=(L,lab,col)=>{let f=100;return {lab,col,w:lab==="Ibovespa"?2.4:1.6,pts:L.slice(-120).map(p=>{f*=1+(p[1]||0)/100;return [Date.UTC(+p[0].slice(0,4),+p[0].slice(5,7)-1,28),f]})}};
  h+='<div class="label" style="margin-top:12px">R$ 100 aplicados em cada estilo, nos últimos 10 anos</div>'+fnChart(FT_DEF.map(([k,n],i)=>ser(out[k],n,FN_COLS[i%FN_COLS.length])).concat([ser(out.ibov,"Ibovespa","var(--ink)")]),{fmt:"num",h:240,aria:"Desempenho acumulado de cada fator"});
  h+='<div class="label" style="margin-top:12px">Quem mais se encaixa hoje</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr>'+FT_DEF.map(([,n])=>'<th>'+n+'</th>').join("")+'</tr></thead><tbody>';
  for(let i=0;i<8;i++)h+='<tr>'+FT_DEF.map(([k])=>{const x=sel[k][i];return '<td>'+(x?'<button type="button" class="link" data-atopen="'+x.t+'">'+x.t+'</button>':'')+'</td>'}).join("")+'</tr>';
  return h+'</tbody></table></div><p class="sub" style="font-size:.8rem;margin-top:8px">Ações e units com liquidez média acima de R$ 2 milhões por dia em cada mês (R$ 5 milhões na lista de hoje). Retorno total com proventos, sem custos nem impostos; carteiras refeitas todo mês. Dados até '+ate.slice(5)+'/'+ate.slice(0,4)+'. P/L, dividendos e ROE do último balanço anual já publicado na época. Desempenho passado não garante o futuro: fatores passam anos sem funcionar.</p>'}
