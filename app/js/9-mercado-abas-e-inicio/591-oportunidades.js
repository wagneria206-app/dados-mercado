/* ---------- Oportunidades: varre as ações do IBrX-100 e as outras classes e mostra, numa tela só, onde os dados
   apontam potencial. Ações: "Potencial WF" (0 a 100) = desconto contra a própria história (P/L do último balanço contra
   a mediana de 5 anos), desconto contra o setor, qualidade, momento e risco. A valorização indicada é calculada, não
   prevista: quanto o preço subiria se o P/L voltasse à mediana de 5 anos da própria empresa com o lucro de hoje.
   O mesmo critério é testado no passado (painel mensal desde 2008, sem olhar o futuro) para mostrar se funcionou. */
const OPO={bt:null,btK:null,ix:null,ixLoad:null};
function opoIndice(){ // composição oficial (robô de ativos) ou, sem ela, as 100 ações mais negociadas
  if(!OPO.ix&&!OPO.ixLoad)OPO.ixLoad=atGet("indices.json").then(j=>{OPO.ix=j||{c:{}};OPO.ixLoad=null;if(activeMod==="opo")mkCalc()}).catch(()=>{OPO.ix={c:{}};OPO.ixLoad=null;if(activeMod==="opo")mkCalc()});
  const C=AT.C,ofi=OPO.ix&&OPO.ix.c&&OPO.ix.c.IBXX;
  if(ofi&&ofi.L.length>=80)return {L:ofi.L.map(x=>x[0]).filter(t=>atRow(t)),oficial:true,dt:ofi.dt};
  const R=AT.idx.rows.filter(r=>(r[C.tipo]==="Ação"||r[C.tipo]==="Unit")&&r[C.liq]>0).sort((a,b)=>b[C.liq]-a[C.liq]),vis=new Set(),L=[];
  for(const r of R){const e=r[0].slice(0,4);if(vis.has(e))continue;vis.add(e);L.push(r[0]);if(L.length>=100)break}
  return {L,oficial:false}}
function opoPLHist(a,m,n){const v=[];for(let k=Math.max(0,m-n+1);k<=m;k++){const x=a.pl[k];if(x>0&&x<80)v.push(x)}return v}
const opoMed=v=>{const a=v.slice().sort((x,y)=>x-y);return a.length?a[a.length>>1]:null};
function opoAcoes(){
  const pn=typeof BT==="object"&&BT.pn,N=cbNota();if(!pn||!N)return null;const I=opoIndice(),C=AT.C,ml=pn.meses.length-1,out=[];
  I.L.forEach(t=>{const n=N.get(t),r=atRow(t),a=pn.a[t];if(!n||!r)return;const pl=r[C.pl];
    // o histórico e o "hoje" saem da mesma série do painel mensal (mesmo método de cálculo): nas units, o P/L do painel
    // difere do P/L do índice por um fator constante, que se cancela na comparação
    let hist=null,up=null,med=null,plh=null;if(a&&pl>0){for(let k=ml;k>=ml-2;k--)if(a.pl[k]>0&&a.pl[k]<80){plh=a.pl[k];break}const H=opoPLHist(a,ml,60);
      if(plh&&H.length>=24){const mh=opoMed(H);hist=100-H.filter(x=>x<plh).length/H.length*100;up=Math.min(150,(mh/plh-1)*100);med=pl*mh/plh}}
    const P=n.P,vs=P.valor,q=P.qual,mo=P.mom,rk=P.risco;if(vs==null||q==null)return;
    const pot=Math.round((hist==null?vs:hist)*0.30+vs*0.20+q*0.25+(mo==null?50:mo)*0.15+(rk==null?50:rk)*0.10);
    const fl=[];if(!(pl>0))fl.push("prejuízo");if(q<25)fl.push("qualidade fraca");
    out.push({t,n:r[1],s:AT.idx.setores[r[C.setor]]||"",pot,hist,up,med,pl,P,nota:n.nota,fl,dy:r[C.dy]})});
  return {L:out.sort((a,b)=>b.pot-a.pot),I}}
/* teste no passado: as 10 melhores pelo mesmo critério, refeitas todo mês, contra o Ibovespa */
function opoTeste(){
  const pn=typeof BT==="object"&&BT.pn;if(!pn)return null;if(OPO.bt&&OPO.btK===pn)return OPO.bt;
  const M=pn.meses,A=Object.entries(pn.a),m0=Math.max(M.indexOf("2008-01"),60),car=[],ib=[];
  const rank=(L,f,inv)=>{const v=L.map(f),s=v.filter(x=>x!=null).slice().sort((a,b)=>a-b);return v.map(x=>x==null?null:(s.filter(y=>y<x).length/Math.max(1,s.length-1))*100*(inv?-1:1)+(inv?100:0))};
  for(let m=m0;m<M.length-1;m++){
    const U=A.filter(([t,a])=>a.ret[m]!=null&&a.liq[m]>0).sort((x,y)=>y[1].liq[m]-x[1].liq[m]),vis=new Set(),T=[];
    for(const x of U){const e=x[0].slice(0,4);if(vis.has(e))continue;vis.add(e);T.push(x);if(T.length>=100)break}
    if(T.length<60)continue;
    const hist=T.map(([t,a])=>{const pl=a.pl[m];if(!(pl>0&&pl<80))return null;const H=opoPLHist(a,m,60);return H.length>=24?100-H.filter(x=>x<pl).length/H.length*100:null});
    const ey=T.map(([t,a])=>a.pl[m]>0?1/a.pl[m]:null),setr=new Map();T.forEach(([t,a],i)=>{const k=a.s;(setr.get(k)||setr.set(k,[]).get(k)).push(i)});
    const vs=T.map((x,i)=>{const g=setr.get(x[1].s);if(ey[i]==null)return null;const v=g.map(j=>ey[j]).filter(y=>y!=null);return v.length>=4?v.filter(y=>y<ey[i]).length/(v.length-1)*100:null});
    const roe=rank(T,([t,a])=>a.roe[m]>0&&a.roe[m]<100?a.roe[m]:null),mom=rank(T,([t,a])=>{let f=1,n=0;for(let k=m-11;k<m;k++){const x=a.ret[k];if(x!=null){f*=1+x/100;n++}}return n>=10?f:null}),
      vol=rank(T,([t,a])=>{const v=[];for(let k=m-11;k<=m;k++)if(a.ret[k]!=null)v.push(a.ret[k]);if(v.length<10)return null;const mu=v.reduce((s,x)=>s+x,0)/v.length;return Math.sqrt(v.reduce((s,x)=>s+(x-mu)**2,0)/v.length)},true);
    const sc=T.map((x,i)=>vs[i]==null||roe[i]==null||!(x[1].pl[m]>0)||roe[i]<25?null:(hist[i]==null?vs[i]:hist[i])*0.30+vs[i]*0.20+roe[i]*0.25+(mom[i]==null?50:mom[i])*0.15+(vol[i]==null?50:vol[i])*0.10);
    const top=T.map((x,i)=>[x,sc[i]]).filter(y=>y[1]!=null).sort((a,b)=>b[1]-a[1]).slice(0,10),r=top.map(([x])=>x[1].ret[m+1]).filter(v=>v!=null);
    if(r.length>=8){car.push([M[m+1],r.reduce((s,v)=>s+v,0)/r.length]);ib.push([M[m+1],pn.ibov[m+1]])}}
  const ac=L=>{let f=1;return L.map(p=>{f*=1+(p[1]||0)/100;return f})},fc=ac(car),fi=ac(ib),anos=car.length/12,an=f=>(Math.pow(f,1/anos)-1)*100;
  let ganha=0,jan=0;for(let i=12;i<fc.length;i++){jan++;if(fc[i]/fc[i-12]>fi[i]/fi[i-12])ganha++}
  const dd=F=>{let pk=1,mx=0;F.forEach(v=>{pk=Math.max(pk,v);mx=Math.min(mx,v/pk-1)});return mx*100};
  OPO.bt={car,ib,fc,fi,an:an(fc[fc.length-1]),ai:an(fi[fi.length-1]),pct:jan?ganha/jan*100:null,jan,ddc:dd(fc),ddi:dd(fi),ini:car[0]&&car[0][0]};OPO.btK=pn;return OPO.bt}
/* outras classes: reaproveita os motores do cérebro */
function opoOutras(){
  const L=[];
  try{const Pr=cbPremios()||[],Mp=cbMapa(Pr,cbExterno());Mp.C.filter(c=>c.t>0).forEach(c=>L.push(["Classe acima do peso",c.n,c.s.filter(x=>x[0]>0).map(x=>x[1]).join('; '),"vw"]))}catch(e){}
  try{const w=curvWins()[0],P=crRoll(w.b.pre,CR_PZ).filter(x=>x.T>=2&&x.col!=null).sort((a,b)=>b.col-a.col)[0],R=crRoll(w.b.ipca,CR_PZR).filter(x=>x.T>=2&&x.col!=null).sort((a,b)=>b.col-a.col)[0];
    if(P)L.push(["Tesouro: melhor ponto da curva","Prefixado de "+P.T+" anos ("+(new Date(VAL).getUTCFullYear()+P.T)+")",'rende '+fx(P.ret*100,2)+'% em 12 meses se a curva ficar parada; a taxa pode subir '+fx(P.col,2)+' p.p. antes de perder para o título de 1 ano',"ju"]);
    if(R)L.push(["Tesouro: melhor ponto da curva","IPCA+ de "+R.T+" anos ("+(new Date(VAL).getUTCFullYear()+R.T)+")",'IPCA + '+fx(R.yT*100,2)+'% hoje; colchão de '+fx(R.col,2)+' p.p.',"ju"])}catch(e){}
  try{const C=cbCredNota();if(C)C.filter(x=>x.dif!=null&&x.dif>0.3&&!x.est&&x.dur>=0.75).slice(0,3).forEach(x=>L.push(["Crédito que paga bem","<button type=\"button\" class=\"link\" data-crcalc=\""+esc(x.cod)+"\">"+esc(x.cod)+"</button>"+(x.isento?' (isenta)':''),(x.rf==="ipca"?'IPCA + ':'CDI + ')+fx(x.tx,2)+'%, '+fx(x.dif,2)+' p.p. acima de papéis parecidos, prazo médio de '+fx(x.dur,1)+' anos',"cr"]))}catch(e){}
  try{const C=AT.C,F=AT.idx.rows.filter(r=>r[C.tipo]==="FII"&&(r[C.liq]||0)>=2e6&&r[C.dy]>0&&r[C.dy]<25&&r[C.pvp]>=0.5&&r[C.pvp]<0.95).sort((a,b)=>(b[C.dy]/b[C.pvp])-(a[C.dy]/a[C.pvp])).slice(0,4);
    F.forEach(r=>L.push(["FII com desconto","<button type=\"button\" class=\"link\" data-atopen=\""+r[0]+"\">"+r[0]+"</button>",'rendimento de '+fx(r[C.dy],1)+'% em 12 meses e P/VP de '+fx(r[C.pvp],2)+' (cota '+fx((1-r[C.pvp])*100,0)+'% abaixo do patrimônio)',"af"]))}catch(e){}
  try{const N=cbFnNota();if(N){const I=FN.idx,b=[...N.values()].filter(x=>x.cot>=500&&x.nota>=85).sort((a,b)=>b.nota-a.nota).slice(0,3);b.forEach(x=>L.push(["Fundo bem avaliado","<button type=\"button\" class=\"link\" data-cbfn=\""+x.c+"\">"+esc(String(x.n).slice(0,46))+"</button>",'Nota WF '+x.nota+' entre '+x.np+' fundos de '+esc(I.anbima[x.a]),"fa"]))}}catch(e){}
  return L}
function opoHtml(){
  cbCarrega();if(!cbPronto()||typeof BT!=="object"||!BT.pn){cbEspera();return cbAguarde("Oportunidades","Analisando as ações do IBrX-100 e as outras classes…",1)}
  const A=opoAcoes();if(!A)return ['<h3>Oportunidades</h3><p class="sub">Carregando…</p>'];const out=[],ok=A.L.filter(x=>!x.fl.length),T=ok.slice(0,10);
  const bar=v=>'<span style="display:inline-block;width:46px;height:6px;border-radius:9px;background:var(--line);vertical-align:middle;overflow:hidden"><i style="display:block;height:100%;width:'+(v==null?0:v)+'%;background:'+(v==null?'var(--line)':cbNotaCor(v))+'"></i></span>';
  const motivo=x=>{const m=[];if(x.hist!=null&&x.hist>=70)m.push('P/L de '+fx(x.pl,1)+', abaixo da própria mediana de 5 anos (equivalente a '+fx(x.med,1)+' hoje)');if(x.P.valor>=70)m.push('barata contra o setor');if(x.P.qual>=70)m.push('alta qualidade');if(x.P.mom>=70)m.push('em tendência de alta');if(x.P.risco>=70)m.push('oscila pouco');if(x.dy>=7)m.push('proventos de '+fx(x.dy,1)+'%');return m.slice(0,3).join('; ')||'conjunto equilibrado'};
  let h='<h3>As 10 ações do IBrX-100 com mais potencial</h3><p class="sub">'+(A.I.oficial?'Composição oficial do IBrX-100 (B3, '+fdate(Date.parse(A.I.dt+"T00:00:00Z"))+')':'<b>Aproximação do IBrX-100:</b> as 100 ações mais negociadas (uma por empresa), que é o critério principal do índice; a composição oficial da B3 entra quando o robô rodar no servidor')+'. '+A.L.length+' ações avaliadas; ficam de fora as com prejuízo ou qualidade fraca.</p>'
    +'<div class="tablewrap" style="max-height:none"><table class="ctab" data-ordok="1"><thead><tr><th>#</th><th style="text-align:left">Ação</th><th>Potencial WF</th><th>Se o P/L voltar à<br>mediana de 5 anos</th><th>Desconto<br>histórico</th><th>Valor</th><th>Qualidade</th><th>Momento</th><th>Risco baixo</th><th style="text-align:left">Por quê</th><th></th></tr></thead><tbody>'
    +T.map((x,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:left"><button type="button" class="link" data-atopen="'+x.t+'"><b>'+x.t+'</b></button><small style="display:block;color:var(--muted)">'+esc(x.s)+'</small></td><td><b style="font-size:1.05rem;color:'+cbNotaCor(x.pot)+'">'+x.pot+'</b></td><td>'+(x.up==null?'—':'<b class="'+(x.up>=0?'pos':'neg')+'">'+(x.up>=0?'+':'−')+fx(Math.abs(x.up),0)+'%</b>')+'</td>'
      +[x.hist,x.P.valor,x.P.qual,x.P.mom,x.P.risco].map(v=>'<td>'+bar(v)+' <small>'+(v==null?'—':fx(v,0))+'</small></td>').join("")+'<td style="text-align:left"><small>'+motivo(x)+'</small></td><td><button type="button" class="btn sec" style="font-size:.78rem;padding:4px 8px" data-wsim=\''+esc(JSON.stringify({t:"a",k:x.t,n:x.t+" · "+String(x.n).slice(0,40)}))+'\'>E se?</button></td></tr>').join("")+'</tbody></table></div>'
    +'<p class="sub" style="font-size:.8rem;margin-top:6px"><b>Potencial WF</b> = 30% desconto contra a própria história (P/L de hoje contra os últimos 5 anos) + 20% desconto contra o setor + 25% qualidade + 15% momento + 10% risco baixo. <b>"Se o P/L voltar à mediana"</b> é um cálculo, não uma previsão: quanto o preço mudaria se o mercado voltasse a pagar pelo lucro de hoje o múltiplo que pagou em média nos últimos 5 anos (limitado a +150%). Ele supõe o lucro estável; se o lucro cair, o potencial some.</p>';
  out.push(h);
  // validação histórica
  const B=opoTeste();if(B&&B.car.length>=24){const ser=(F,L,lab,col,w)=>({lab,col,w,pts:L.map((p,i)=>[Date.UTC(+p[0].slice(0,4),+p[0].slice(5,7)-1,28),F[i]*100])});
    out.push('<h3>Esse critério funcionou no passado?</h3><p class="sub">As 10 melhores pelo mesmo critério, escolhidas todo mês desde '+B.ini.slice(5)+'/'+B.ini.slice(0,4)+' só com os dados disponíveis na época, entre as 100 ações mais negociadas.</p>'
      +'<div class="fnkpis">'+tecKp("10 do critério, ao ano",fx(B.an,1)+'%','contra '+fx(B.ai,1)+'% do Ibovespa',B.an>B.ai?'pos':'neg')+tecKp("Bateu o Ibovespa em 12 meses",B.pct==null?'—':fx(B.pct,0)+'%','das '+B.jan+' janelas de 12 meses')+tecKp("Pior queda do critério",fx(B.ddc,0)+'%','Ibovespa: '+fx(B.ddi,0)+'%')+'</div>'
      +fnChart([ser(B.fc,B.car,"10 do Potencial WF",FN_COLS[0],2),ser(B.fi,B.ib,"Ibovespa","var(--ink)",1.6)],{fmt:"num",h:220,aria:"R$ 100 nas 10 ações do critério contra o Ibovespa"})
      +'<p class="sub" style="font-size:.8rem;margin-top:6px">Pesos iguais, refeitos todo mês, retorno com proventos, sem custos nem impostos. O teste usa o P/L, o ROE, o momento e a volatilidade da época; não inclui as colunas que o histórico não guarda (margem e dívida). Desempenho passado não garante o futuro.</p>')}
  // outras oportunidades
  const O=opoOutras();if(O.length)out.push('<h3>Outras oportunidades</h3><p class="sub">O que os motores do cérebro destacam hoje nas outras classes.</p><div class="tablewrap" style="max-height:none"><table class="ctab" data-ordok="1"><thead><tr><th style="text-align:left">Tipo</th><th style="text-align:left">Onde</th><th style="text-align:left">Por quê</th></tr></thead><tbody>'
    +O.map(x=>'<tr><td style="text-align:left"><small><b>'+x[0]+'</b></small></td><td style="text-align:left">'+x[1]+'</td><td style="text-align:left"><small>'+x[2]+' <button type="button" class="link" data-mkgo="'+x[3]+'">ver</button></small></td></tr>').join("")+'</tbody></table></div>');
  // ações de qualidade que caíram fora do padrão (possível exagero) e dividendos
  try{const C=AT.C,Q=A.L.filter(x=>{const r=atRow(x.t),v=r[C.v12],r5=r[C.r5];return x.P.qual>=60&&v>0&&r5!=null&&r5/(v/Math.sqrt(52))<=-2}).slice(0,6),D=A.L.filter(x=>x.dy>=7&&x.P.qual>=50&&!x.fl.length).sort((a,b)=>b.dy-a.dy).slice(0,6);
    if(Q.length||D.length)out.push('<h3>Para olhar de perto</h3>'+(Q.length?'<p style="margin:6px 0"><b>Qualidade em queda forte na semana</b> (pode ser exagero do mercado ou notícia ruim: confira os fatos): '+Q.map(x=>{const r=atRow(x.t);return '<button type="button" class="link" data-atopen="'+x.t+'">'+x.t+'</button> ('+fx(r[C.r5],1)+'%, qualidade '+fx(x.P.qual,0)+')'}).join(', ')+'.</p>':'')
      +(D.length?'<p style="margin:6px 0"><b>Dividendos altos com qualidade</b>: '+D.map(x=>'<button type="button" class="link" data-atopen="'+x.t+'">'+x.t+'</button> ('+fx(x.dy,1)+'%)').join(', ')+'. Rendimento dos últimos 12 meses: pode incluir pagamentos extraordinários que não se repetem.</p>':''))}catch(e){}
  out.push('<p class="sub" style="font-size:.82rem;margin:0">Tudo calculado a partir de dados oficiais (B3, CVM, ANBIMA, Banco Central), por critérios explícitos. Não é recomendação de compra: é uma lista de partida para a sua análise, que deve considerar o perfil e a política de cada cliente.</p>');
  return out}
