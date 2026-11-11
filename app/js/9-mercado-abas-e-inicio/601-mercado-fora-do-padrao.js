/* ---------- Radar: mercado fora do padrão. Varre todas as ações e units líquidas da B3 (não só carteira e favoritos):
   amplitude (quantas estão acima das médias e nas máximas ou mínimas de 52 semanas), movimentos da semana fora do
   normal para a própria volatilidade e ações descoladas do seu setor. Usa as colunas técnicas do idx.json (tecnica.py). */
const FP_LIQ=5e6;
function fpBase(){if(!AT.idx)return null;const C=AT.C,R=AT.idx.rows;if(C.r5==null||C.mm200d==null)return null;
  return R.filter(r=>(r[C.tipo]==="Ação"||r[C.tipo]==="Unit")&&(r[C.liq]||0)>=FP_LIQ&&r[C.r5]!=null)}
function fpHtml(){
  if(!AT.idx){if(!AT.err)atBoot();return ""}const L=fpBase();if(!L||L.length<30)return "";const C=AT.C,I=AT.idx,pct=f=>L.filter(f).length/L.length*100;
  const a200=pct(r=>r[C.mm200d]>0),a50=pct(r=>r[C.mm50d]>0),mx=L.filter(r=>r[C.max52d]!=null&&r[C.max52d]>=-1),mn=L.filter(r=>r[C.min52d]!=null&&r[C.min52d]<=1);
  const lei=a200>=60?['ampla e saudável','var(--gain)']:a200<=40?['fraca: a maioria das ações está em queda','var(--loss)']:['dividida','var(--warn)'];
  // movimento da semana contra a volatilidade da própria ação (desvio semanal = vol anual ÷ √52)
  const z=r=>{const v=r[C.v12];return v>0?r[C.r5]/(v/Math.sqrt(52)):null};
  const setr=new Map();L.forEach(r=>{const s=r[C.setor];(setr.get(s)||setr.set(s,[]).get(s)).push(r[C.r5])});const medS=s=>{const a=(setr.get(s)||[]).slice().sort((x,y)=>x-y);return a.length>=4?a[a.length>>1]:null};
  const fora=L.map(r=>({r,z:z(r)})).filter(x=>x.z!=null&&Math.abs(x.z)>=2.5).sort((a,b)=>Math.abs(b.z)-Math.abs(a.z)).slice(0,10);
  const desc=L.map(r=>{const m=medS(r[C.setor]),v=r[C.v12];return m==null||!(v>0)?null:{r,d:r[C.r5]-m,z:(r[C.r5]-m)/(v/Math.sqrt(52))}}).filter(x=>x&&Math.abs(x.z)>=2).sort((a,b)=>Math.abs(b.z)-Math.abs(a.z)).slice(0,8);
  const lk=r=>'<button type="button" class="link" data-atopen="'+r[0]+'">'+r[0]+'</button>',st=r=>esc(I.setores[r[C.setor]]||"");
  let h='<h3>Mercado fora do padrão</h3><p class="sub">Varredura das '+L.length+' ações e units com liquidez acima de R$ 5 milhões por dia, com os pregões até '+fdate(AT.T[AT.T.length-1])+'.</p>'
    +'<div class="fnkpis">'+tecKp("Acima da média de 200 dias",fx(a200,0)+'%','amplitude <b style="color:'+lei[1]+'">'+lei[0]+'</b>')+tecKp("Acima da média de 50 dias",fx(a50,0)+'%',a50>a200+10?'o curto prazo melhora antes do longo':a50<a200-10?'o curto prazo piora antes do longo':'')
    +tecKp("Na máxima de 52 semanas",mx.length+'',mx.length?mx.slice(0,4).map(r=>r[0]).join(', '):'')+tecKp("Na mínima de 52 semanas",mn.length+'',mn.length?mn.slice(0,4).map(r=>r[0]).join(', '):'')+'</div>';
  if(fora.length)h+='<div class="label" style="margin-top:10px">Semana fora do normal para a própria ação</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ação</th><th style="text-align:left">Setor</th><th>Semana</th><th>Vezes o desvio normal</th><th>Setor na semana</th></tr></thead><tbody>'
    +fora.map(x=>'<tr><td style="text-align:left">'+lk(x.r)+'</td><td style="text-align:left"><small>'+st(x.r)+'</small></td><td class="'+(x.r[C.r5]>=0?'pos':'neg')+'">'+mcSig(x.r[C.r5],1)+'</td><td>'+fx(Math.abs(x.z),1)+'×</td><td>'+(medS(x.r[C.setor])==null?'—':mcSig(medS(x.r[C.setor]),1))+'</td></tr>').join("")+'</tbody></table></div>';
  if(desc.length)h+='<div class="label" style="margin-top:10px">Descolados do setor na semana</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ação</th><th style="text-align:left">Setor</th><th>Ação</th><th>Mediana do setor</th><th>Diferença</th></tr></thead><tbody>'
    +desc.map(x=>'<tr><td style="text-align:left">'+lk(x.r)+'</td><td style="text-align:left"><small>'+st(x.r)+'</small></td><td>'+mcSig(x.r[C.r5],1)+'</td><td>'+mcSig(medS(x.r[C.setor]),1)+'</td><td class="'+(x.d>=0?'pos':'neg')+'"><b>'+mcSig(x.d,1)+'</b></td></tr>').join("")+'</tbody></table></div>';
  if(!fora.length&&!desc.length)h+='<p style="margin:8px 0 0">Nenhuma ação líquida fugiu do próprio padrão nesta semana.</p>';
  return h+'<p class="sub" style="font-size:.8rem;margin-top:8px">Semana = últimos 5 pregões, sem proventos. "Vezes o desvio normal" compara a variação com a volatilidade de 12 meses da ação na escala de uma semana: acima de 2,5× acontece em menos de 2% das semanas numa distribuição normal. Descolados: diferença para a mediana do setor de pelo menos 2 desvios. Movimento fora do padrão costuma ter notícia por trás: confira fatos relevantes e a página da ação.</p>'}
