/* ---------- EUA e mundo */
function mundoHtml(){
  const w=mcWait();if(w)return [w];if(!EU.S){euBoot();if(!EU.err)return ['<p class="sub">Carregando os índices…</p>']}
  return [mcTransHtml(),mcEuaHtml(),euaCalHtml(),mcFedHtml(),mcGlobalHtml()].filter(Boolean);
}
const MC_W0=Date.UTC(1970,0,5);
function mcWk(P){const m=new Map();(P||[]).forEach(p=>{if(p[1]!=null&&isFinite(p[1]))m.set(Math.floor((p[0]-MC_W0)/(7*DAY)),p[1])});return m}
function mcCm(k){const C=MC.d&&MC.d.cm;if(!C||!C[k])return [];const o=[];C.d.forEach((d,i)=>{const v=C[k][i];if(v!=null)o.push([mcTd(d),v])});return o}
function mcSer(k){if(k==="dxy"||k==="brent")return MC.d[k]?MC.d[k].s.map(p=>[mcTd(p[0]),p[1]]):[];if(k==="real10"||k==="pre5"||k==="real5"||k==="pre3")return mcCm(k);return (EU.S&&EU.S[k])||[]}
/* regressão das variações semanais: y = a + b·x */
function mcReg(kx,ky,tx,ty,semanas){
  const X=mcWk(mcSer(kx)),Y=mcWk(mcSer(ky)),ks=[...X.keys()].filter(k=>Y.has(k)&&X.has(k-1)&&Y.has(k-1)).sort((a,b)=>a-b).slice(-semanas);
  if(ks.length<30)return null;const ch=(M,k,t)=>t==="p"?(M.get(k)/M.get(k-1)-1)*100:t==="b"?(M.get(k)-M.get(k-1))*100:M.get(k)-M.get(k-1);
  const x=ks.map(k=>ch(X,k,tx)),y=ks.map(k=>ch(Y,k,ty)),n=x.length,mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n;
  let sxy=0,sxx=0,syy=0;for(let i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)**2;syy+=(y[i]-my)**2}
  return {b:sxy/sxx,r:sxy/Math.sqrt(sxx*syy),n}}
function mcRollCorr(kx,ky,jan){
  const X=mcWk(mcSer(kx)),Y=mcWk(mcSer(ky)),ks=[...X.keys()].filter(k=>Y.has(k)&&X.has(k-1)&&Y.has(k-1)).sort((a,b)=>a-b);
  const rx=ks.map(k=>(X.get(k)/X.get(k-1)-1)),ry=ks.map(k=>(Y.get(k)/Y.get(k-1)-1)),out=[];
  for(let i=jan;i<ks.length;i++){let sx=0,sy=0,sxy=0,sxx=0,syy=0;for(let j=i-jan+1;j<=i;j++){sx+=rx[j];sy+=ry[j]}const mx=sx/jan,my=sy/jan;for(let j=i-jan+1;j<=i;j++){sxy+=(rx[j]-mx)*(ry[j]-my);sxx+=(rx[j]-mx)**2;syy+=(ry[j]-my)**2}out.push([MC_W0+ks[i]*7*DAY+4*DAY,sxy/Math.sqrt(sxx*syy)])}
  return out}
function mcForca(r){const a=Math.abs(r);return a>=0.6?"forte":a>=0.3?"moderada":"fraca"}
function mcTransHtml(){
  let h='<h3>Como o exterior afeta o Brasil</h3><p class="sub">Sensibilidade dos mercados brasileiros aos movimentos lá fora, medida com as variações semanais dos últimos 2 anos. Ajuda a responder perguntas como "se os juros americanos subirem, o que acontece com o meu IPCA+?".</p>';
  const R=[["spx","p","ibov","p","Ibovespa × S&P 500","Quando o S&P 500 sobe ou cai 1% na semana, o Ibovespa varia em média",v=>mcSig(v,2)],
    ["dxy","p","usd","p","Dólar/real × dólar no mundo","Quando o dólar se valoriza 1% contra as principais moedas, o dólar/real varia em média",v=>mcSig(v,2)],
    ["vix","n","usd","p","Dólar/real × aversão a risco (VIX)","Quando o VIX sobe 1 ponto, o dólar/real varia em média",v=>mcSig(v,2)],
    ["t10","b","real10","b","Juro real 10 anos (Brasil) × Treasury 10 anos","Quando o Treasury de 10 anos sobe 10 bps, o juro real de 10 anos no Brasil varia em média",v=>mcSig(v*10,0," bps")],
    ["t10","b","pre5","b","Prefixado 5 anos (Brasil) × Treasury 10 anos","Quando o Treasury de 10 anos sobe 10 bps, o prefixado de 5 anos varia em média",v=>mcSig(v*10,0," bps")],
    ["brent","p","ibov","p","Ibovespa × petróleo (Brent)","Quando o petróleo sobe 1% na semana, o Ibovespa varia em média",v=>mcSig(v,2)]];
  const rows=R.map(([kx,tx,ky,ty,tit,txt,f])=>{const g=mcReg(kx,ky,tx,ty,104);return g?'<tr><td style="text-align:left"><b>'+tit+'</b><small style="display:block;color:var(--muted)">'+txt+' <b>'+f(g.b)+'</b>.</small></td><td>'+fx(g.r,2)+'</td><td class="c-ph">'+mcForca(g.r)+'</td></tr>':''}).filter(Boolean);
  if(rows.length)h+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Relação</th><th>Correlação</th><th class="c-ph">Força</th></tr></thead><tbody>'+rows.join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem">Correlação de −1 a +1: perto de zero = os dois andam sem relação; acima de 0,6 (ou abaixo de −0,6) = relação forte. É uma média do passado recente: em crises a ligação costuma ficar mais forte.</p>';
  const c=mcRollCorr("spx","ibov",26).filter(p=>p[0]>=Date.UTC(2010,0,1));
  if(c.length>20)h+='<div class="label" style="margin-top:12px">Correlação entre S&P 500 e Ibovespa (janela móvel de 6 meses, retornos semanais)</div>'+fnChart([{lab:"Correlação",col:"#2563eb",w:1.8,pts:c}],{fmt:"num",zero:true,h:180,aria:"Correlação S&P 500 e Ibovespa"});
  const t10=mcCut(mcSer("t10"),10),r10=mcCut(mcSer("real10"),10),p5=mcCut(mcSer("pre5"),10);
  if(t10.length&&r10.length){const th=P=>fnThin(P.map(p=>({t:p[0],v:p[1]})),600).map(p=>[p.t,p.v]);
    h+='<div class="label" style="margin-top:12px">Juros longos: EUA × Brasil, 10 anos (% a.a.)</div>'+fnChart([{lab:"Treasury 10 anos (EUA)",col:"#64748b",w:1.8,pts:th(t10)},{lab:"Juro real 10 anos (Brasil, IPCA+)",col:"#dc2626",w:2,pts:th(r10)},{lab:"Prefixado 5 anos (Brasil)",col:"#2563eb",w:1.8,pts:th(p5)}],{fmt:"pct",h:230,aria:"Juros longos EUA e Brasil"})
      +'<p class="sub" style="font-size:.8rem">Juro real e prefixado do Brasil com prazo constante, calculados com as taxas do Tesouro Direto (interpolação entre os vencimentos vizinhos). O juro real brasileiro paga muito acima do americano por causa do risco-país; os dois tendem a subir juntos quando os juros nos EUA sobem.</p>'}
  const dx=mcCut(mcSer("dxy"),5),us=mcCut(mcSer("usd"),5);
  if(dx.length&&us.length){const b=(P)=>{const t0=Math.max(dx[0][0],us[0][0]),p0=euAt(P,t0);return p0?fnThin(P.filter(p=>p[0]>=t0).map(p=>({t:p[0],v:p[1]/p0[1]*100})),500).map(p=>[p.t,p.v]):[]};
    h+='<div class="label" style="margin-top:12px">Dólar no mundo × dólar/real, 5 anos (base 100)</div>'+fnChart([{lab:"Índice amplo do dólar (Fed)",col:"#64748b",w:1.8,pts:b(dx)},{lab:"Dólar/real (PTAX)",col:"#16a34a",w:2,pts:b(us)}],{fmt:"num",h:210,aria:"Dólar global e real"})
      +'<p class="sub" style="font-size:.8rem">Quando as duas linhas sobem juntas, o real está só acompanhando o dólar forte no mundo; quando o dólar/real sobe sozinho, a causa é doméstica (fiscal, política, juros).</p>'}
  return h+'<p class="sub" style="font-size:.8rem">Fontes: Cboe (S&P 500 e VIX), B3 (Ibovespa), Banco Central (PTAX), Federal Reserve (índice amplo do dólar, H.10), Departamento do Tesouro dos EUA (Treasuries), Tesouro Nacional (Tesouro Direto) e EIA (Brent).</p>';
}
function mcEuaHtml(){
  const U=MC.d.us;if(!U||!U.cpi)return "";const L=mcLast,k=[],cy=mcYoY(U.cpi),co=mcYoY(U.core),sa=U.cpi_sa||[],pay=U.payroll||[],sal=mcYoY(U.salario||[]);
  const u=L(cy);if(u)k.push(mcKp("Inflação (CPI) · "+mcMes(u[0]),fx(u[1],1)+'% em 12 meses',sa.length>1?mcSig((sa[sa.length-1][1]/sa[sa.length-2][1]-1)*100,2)+' no mês':''));
  const c=L(co);if(c)k.push(mcKp("Núcleo da inflação",fx(c[1],1)+'% em 12 meses','sem alimentos e energia'));
  if(pay.length>3){const d=(pay[pay.length-1][1]-pay[pay.length-2][1]),m3=(pay[pay.length-1][1]-pay[pay.length-4][1])/3;k.push(mcKp("Empregos criados (payroll) · "+mcMes(pay[pay.length-1][0]),(d>=0?'+':'−')+fx(Math.abs(d),0)+' mil','média de 3 meses: '+(m3>=0?'+':'−')+fx(Math.abs(m3),0)+' mil'))}
  const de=L(U.desemp);if(de)k.push(mcKp("Desemprego",fx(de[1],1)+'%',U.desemp.length>12?mcSig(de[1]-U.desemp[U.desemp.length-13][1],1," p.p.").replace('"pos"','"x"').replace('"neg"','"pos"').replace('"x"','"neg"')+' em 12 meses':''));
  const s=L(sal);if(s)k.push(mcKp("Salário por hora",fx(s[1],1)+'% em 12 meses','pressão de custos sobre a inflação'));
  const m=S=>S.map(p=>[mcTm(p[0]),p[1]]).filter(p=>p[0]>=Date.UTC(new Date().getUTCFullYear()-10,0,1));
  let h='<h3>Economia americana</h3><p class="sub">Inflação e emprego nos EUA decidem os juros do Fed, que movem o dólar, os Treasuries e o apetite por risco no mundo — e, por tabela, o câmbio, os juros e a Bolsa no Brasil.</p><div class="fnkpis">'+k.join("")+'</div>';
  h+='<div class="label" style="margin-top:12px">Inflação nos EUA em 12 meses (%)</div>'+fnChart([{lab:"CPI",col:"#dc2626",w:2,pts:m(cy)},{lab:"Núcleo",col:"#2563eb",w:2,pts:m(co)}],{fmt:"pct",h:200,aria:"Inflação EUA"});
  if(pay.length>40){const ch=[];for(let i=1;i<pay.length;i++)ch.push([mcTm(pay[i][0]),pay[i][1]-pay[i-1][1]]);h+='<div class="label" style="margin-top:12px">Empregos criados por mês (payroll, milhares)</div>'+fnChart([{lab:"Empregos",col:"var(--gain)",pts:ch.slice(-36)}],{bars:true,zero:true,h:170,fmt:"num",aria:"Payroll"})}
  if(U.desemp)h+='<div class="label" style="margin-top:12px">Desemprego nos EUA (%)</div>'+fnChart([{lab:"Desemprego",col:"#9333ea",w:2,pts:m(U.desemp)}],{fmt:"pct",h:170,aria:"Desemprego EUA"});
  return h+'<p class="sub" style="font-size:.8rem">Fonte: U.S. Bureau of Labor Statistics (CPI-U, núcleo sem alimentos e energia, emprego não agrícola e taxa de desemprego; dados com ajuste sazonal na variação mensal).</p>';
}
function mcFedHtml(){
  const F=MC.d.fed;if(!F||!F.mediana||!F.anos)return "";const N={ffr:"Juro do Fed (fim de ano)",pce:"Inflação (PCE)",core:"Núcleo da inflação (PCE)",pib:"Crescimento do PIB",desemp:"Desemprego (fim de ano)"};
  const ff=FXJ&&FXJ.ultimo&&FXJ.ultimo.fed_funds;
  let h='<h3>Projeções do Fed</h3><p class="sub">Mediana das projeções dos dirigentes do banco central americano, divulgadas em '+fdate(mcTd(F.data))+'. O juro de fim de ano mostra quantos cortes ou altas o próprio Fed espera'+(ff?' (hoje: '+fx(ff.valor,2)+'% ao ano)':'')+'.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">%</th>'+F.anos.map((a,j)=>'<th'+(j>=3?' class="c-ph"':'')+'>'+esc(a)+'</th>').join("")+'</tr></thead><tbody>';
  ["ffr","pce","core","pib","desemp"].forEach(n=>{const v=F.mediana[n],a=(F.anterior||{})[n];if(!v)return;h+='<tr><td style="text-align:left">'+N[n]+'</td>'+v.map((x,j)=>'<td'+(j>=3?' class="c-ph"':'')+'>'+(x==null?'—':fx(x,1)+(a&&a[j]!=null&&a[j]!==x?' <small>('+(x>a[j]?'+':'−')+fx(Math.abs(x-a[j]),1)+')</small>':''))+'</td>').join("")+'</tr>'});
  return h+'</tbody></table></div><p class="sub" style="font-size:.8rem">Entre parênteses, a mudança sobre a projeção anterior (reunião de 3 meses antes). Fonte: Federal Reserve, Summary of Economic Projections. A próxima atualização sai na reunião do Fed de março, junho, setembro ou dezembro — veja a agenda no Resumo.</p>';
}
function mcGlobalHtml(){
  const br=mcSer("brent"),dx=mcSer("dxy");if(!br.length&&!dx.length)return "";const k=[];
  const v=(P,n)=>{const u=P[P.length-1],a=euAt(P,u[0]-n*DAY);return a?(u[1]/a[1]-1)*100:null};
  if(br.length){const u=br[br.length-1];k.push(mcKp("Petróleo Brent · "+fdate(u[0]).slice(0,5),'US$ '+fx(u[1],2),mcSig(v(br,30),1)+' em 30 dias · '+mcSig(v(br,365),1)+' em 12 meses'))}
  if(dx.length){const u=dx[dx.length-1];k.push(mcKp("Dólar no mundo (índice do Fed) · "+fdate(u[0]).slice(0,5),fx(u[1],2),mcSig(v(dx,30),1)+' em 30 dias · '+mcSig(v(dx,365),1)+' em 12 meses'))}
  const th=P=>fnThin(mcCut(P,5).map(p=>({t:p[0],v:p[1]})),500).map(p=>[p.t,p.v]);
  return '<h3>Petróleo e dólar no mundo</h3><p class="sub">Petróleo caro ajuda Petrobras e a balança comercial, mas pressiona a inflação. Dólar forte no mundo costuma tirar dinheiro de países emergentes como o Brasil.</p><div class="fnkpis">'+k.join("")+'</div>'
    +(br.length?'<div class="label" style="margin-top:12px">Petróleo Brent, 5 anos (US$ por barril)</div>'+fnChart([{lab:"Brent",col:"#0f172a",w:1.8,pts:th(br)}],{fmt:"num",h:190,aria:"Brent"}):'')
    +'<p class="sub" style="font-size:.8rem">Fontes: EIA (Brent à vista) e Federal Reserve (índice amplo nominal do dólar contra as moedas dos principais parceiros comerciais dos EUA, jan/2006 = 100). Commodities em geral (IC-Br) estão na aba Dólar.</p>';
}

