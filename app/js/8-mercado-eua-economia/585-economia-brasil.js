/* ---------- Economia (Brasil) */
function economiaHtml(){
  const w=mcWait();if(w)return [w];const D=MC.d,F=D.focus||{},B=D.br||{},out=[];
  out.push(mcFocusHtml(F));out.push(mcAtivHtml(B));out.push(mcFiscalHtml(B,F));out.push(mcCredHtml(B));
  if(typeof ibgeCalHtml==="function")out.push(ibgeCalHtml());
  return out.filter(Boolean);
}
function mcFocusSer(F,ind,ref){const A=F.anuais&&F.anuais[ind];return A&&A[ref]?A[ref]:null}
function mcFocusVar(L){if(!L||L.length<2)return null;const u=L[L.length-1],t=mcTd(u[0])-28*DAY;let a=null;for(const p of L)if(mcTd(p[0])<=t)a=p;return a?{u:u[1],a:a[1],d:u[1]-a[1]}:null}
function mcFocusHtml(F){
  if(!F||!F.anuais)return "";const y=new Date().getUTCFullYear(),Y=[String(y),String(y+1),String(y+2)];
  let h='<h3>Expectativas do mercado (Focus) × preços de mercado</h3><p class="sub">O Boletim Focus reúne as projeções de cerca de 150 bancos, gestoras e consultorias, coletadas pelo Banco Central. Os preços de mercado (DI futuro e títulos públicos) mostram o que os investidores de fato estão pagando. Quando os dois divergem, um deles está errado — e é aí que surgem oportunidades e riscos na renda fixa. A inflação implícita nos títulos inclui um prêmio pelo risco de a inflação surpreender, por isso costuma ficar acima do Focus; quando a diferença é grande, o mercado está pagando caro por proteção contra inflação (IPCA+ relativamente mais caro, prefixado relativamente mais barato).</p>';
  // IPCA 12 meses: Focus × inflação implícita
  const i12=mcLast(F.ipca12);let impl=null;try{const W=curvWins(),b=W&&W[0]&&W[0].b;if(b&&b.pre&&b.ipca)impl=((1+nssY(b.pre,1)/100)/(1+nssY(b.ipca,1)/100)-1)*100}catch(e){}
  const k=[];
  if(i12)k.push(mcKp("IPCA nos próximos 12 meses",'Focus '+fx(i12[1],2)+'%',impl!=null?'mercado (inflação implícita de 1 ano): '+fx(impl,2)+'%':'Focus de '+fdate(mcTd(i12[0]))));
  const ip=mcFocusVar(mcFocusSer(F,"IPCA",Y[0])),ip2=mcFocusVar(mcFocusSer(F,"IPCA",Y[1]));
  if(ip)k.push(mcKp("IPCA "+Y[0]+" (Focus)",fx(ip.u,2)+'%',mcSig(ip.d,2," p.p.")+' em 4 semanas'+(ip2?' · '+Y[1]+': '+fx(ip2.u,2)+'%':'')));
  const se=mcFocusVar(mcFocusSer(F,"Selic",Y[0])),se2=mcFocusVar(mcFocusSer(F,"Selic",Y[1]));
  if(se)k.push(mcKp("Selic no fim de "+Y[0]+" (Focus)",fx(se.u,2)+'%',(se2?Y[1]+': '+fx(se2.u,2)+'%':'')+(MK&&MK.inf&&MK.inf.selic_meta?' · hoje '+fx(MK.inf.selic_meta.valor,2)+'%':'')));
  const pb=mcFocusVar(mcFocusSer(F,"PIB Total",Y[0])),pb2=mcFocusVar(mcFocusSer(F,"PIB Total",Y[1]));
  if(pb)k.push(mcKp("PIB "+Y[0]+" (Focus)",fx(pb.u,2)+'%',mcSig(pb.d,2," p.p.")+' em 4 semanas'+(pb2?' · '+Y[1]+': '+fx(pb2.u,2)+'%':'')));
  const cb=mcFocusVar(mcFocusSer(F,"Câmbio",Y[0]));
  if(cb)k.push(mcKp("Dólar no fim de "+Y[0]+" (Focus)",'R$ '+fx(cb.u,2),FX_TOP&&FX_TOP.venda?'PTAX hoje R$ '+fx(+FX_TOP.venda,2):''));
  h+='<div class="fnkpis">'+k.join("")+'</div>';
  // Selic por reunião: Focus × DI
  const S=F.selic;if(S&&S.reunioes&&S.reunioes.length){
    let di=[];try{if(MK.di){const ks=Object.keys(MK.di.dias).sort();di=copomImpl(ks[ks.length-1])||[]}}catch(e){}
    const porAno={};COPOM.forEach(t=>{const yy=new Date(t).getUTCFullYear();(porAno[yy]=porAno[yy]||[]).push(t)});
    const dataR=r=>{const m=/R(\d)\/(\d{4})/.exec(r);if(!m)return null;const L=(porAno[+m[2]]||[]).slice().sort((a,b)=>a-b),i=+m[1]-(8-L.length)-1;return i>=0&&i<L.length?L[i]:null};
    const ant={};(S.ant&&S.ant.reunioes||[]).forEach(r=>ant[r[0]]=r[1]);
    const rows=S.reunioes.slice(0,8).map(r=>{const t=dataR(r[0]),m=t!=null?di.find(o=>o.d===t):null;return {r:r[0],t,f:r[1],a:ant[r[0]],m:m?m.r+0.1:null}});
    h+='<div class="label" style="margin-top:12px">Selic em cada reunião do Copom: Focus × juros futuros</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Reunião</th><th>Focus hoje</th><th class="c-ph">Focus 4 semanas antes</th><th>Precificado no DI</th><th>Diferença</th></tr></thead><tbody>'
      +rows.map(x=>'<tr><td style="text-align:left">'+(x.t!=null?fdate(x.t):esc(x.r))+'</td><td>'+fx(x.f,2)+'%</td><td class="c-ph">'+(x.a!=null?fx(x.a,2)+'%':'—')+'</td><td>'+(x.m!=null?fx(x.m,2)+'%':'—')+'</td><td>'+(x.m!=null?mcSig(x.m-x.f,2," p.p."):'—')+'</td></tr>').join("")+'</tbody></table></div>'
      +'<p class="sub" style="font-size:.8rem">Focus de '+fdate(mcTd(S.data))+(S.ant?' e de '+fdate(mcTd(S.ant.data)):'')+' (mediana). "Precificado no DI": Selic que torna os contratos de DI futuro da B3 coerentes entre uma reunião e a seguinte (mesmo cálculo da aba Juros). Diferença positiva = o mercado cobra juros mais altos do que os economistas projetam.</p>'}
  // gráficos
  const ser=[[Y[0],"#2563eb"],[Y[1],"#dc2626"],[Y[2],"#16a34a"]].map(([r,c])=>{const L=mcFocusSer(F,"IPCA",r);return L?{lab:"IPCA "+r,col:c,w:2,pts:L.map(p=>[mcTd(p[0]),p[1]])}:null}).filter(Boolean);
  if(ser.length)h+='<div class="label" style="margin-top:12px">Projeção do Focus para o IPCA de cada ano (%)</div>'+fnChart(ser,{fmt:"pct",h:200,aria:"Focus IPCA"});
  const IPC=(MC.d.br&&MC.d.br.ipca)||(MK.inf&&MK.inf.sgs&&MK.inf.sgs.ipca);
  if(F.ipca12&&IPC){const ipc=IPC,real=[];for(let i=11;i<ipc.length;i++){const v=m12(ipc,i);if(isFinite(v))real.push([mcTm(ipc[i][0]),v])}
    const exp=F.ipca12.map(p=>[mcTd(p[0])+365*DAY,p[1]]);const c0=Date.UTC(2015,0,1);
    h+='<div class="label" style="margin-top:12px">Inflação esperada × inflação que aconteceu (IPCA em 12 meses, %)</div>'+fnChart([{lab:"IPCA realizado em 12 meses",col:"#dc2626",w:2,pts:real.filter(p=>p[0]>=c0)},{lab:"Esperado pelo Focus 12 meses antes",col:"#2563eb",w:2,pts:exp.filter(p=>p[0]>=c0&&p[0]<=Date.now()+400*DAY)}],{fmt:"pct",h:220,aria:"IPCA esperado e realizado"})
      +'<p class="sub" style="font-size:.8rem">Cada ponto azul é o que o Focus esperava, 12 meses antes, para a inflação daquela data; a linha avança um ano à frente de hoje. Quando a vermelha fica acima da azul, a inflação surpreendeu para cima — o que historicamente favoreceu títulos IPCA+ sobre prefixados.</p>'}
  h+='<p class="sub" style="font-size:.8rem">Fonte: Banco Central (Sistema de Expectativas de Mercado — Focus, medianas; última pesquisa de '+(i12?fdate(mcTd(i12[0])):'—')+'), B3 (DI futuro) e ANBIMA (inflação implícita).</p>';
  return h;
}
function mcAtivHtml(B){
  if(!B||!B.pib_aa)return "";const L=mcLast,k=[];
  const pa=L(B.pib_aa),pt=L(B.pib_tt);if(pa)k.push(mcKp("PIB · "+mcTri(pa[0]),mcSig(pt?pt[1]:null,1),'sobre o trimestre anterior · '+mcSig(pa[1],1)+' em 12 meses'));
  if(B.ibcbr&&B.ibcbr.length>2){const I=B.ibcbr,u=I[I.length-1],p=I[I.length-2],y=mcYoY(B.ibcbr_ns||[]);k.push(mcKp("IBC-Br · "+mcMes(u[0]),mcSig((u[1]/p[1]-1)*100,1),'no mês (dessazonalizado)'+(y.length?' · '+mcSig(mcLast(y)[1],1)+' em 12 meses':'')))}
  const de=L(B.desemp);if(de){const a=B.desemp.length>12?B.desemp[B.desemp.length-13]:null;k.push(mcKp("Desemprego · trimestre até "+mcMes(de[0]),fx(de[1],1)+'%',a?mcSig(de[1]-a[1],1," p.p.").replace('class="pos"','class="tmp"').replace('class="neg"','class="pos"').replace('class="tmp"','class="neg"')+' em 12 meses':''))}
  [["pim","Indústria"],["pmc","Varejo"],["pms","Serviços"]].forEach(([n,l])=>{const m=L(B[n+"_mm"]),a=L(B[n+"_aa"]);if(m)k.push(mcKp(l+" · "+mcMes(m[0]),mcSig(m[1],1),'no mês (dessazonalizado) · '+(a?mcSig(a[1],1):'—')+' em 12 meses'))});
  let h='<h3>Atividade econômica</h3><p class="sub">Como está a economia real: produção, consumo, serviços e emprego. Atividade forte sustenta lucros das empresas (bom para a Bolsa), mas pode pressionar a inflação e manter os juros altos.</p><div class="fnkpis">'+k.join("")+'</div>';
  if(B.pib_aa)h+='<div class="label" style="margin-top:12px">PIB: crescimento sobre o mesmo trimestre do ano anterior (%)</div>'+fnChart([{lab:"PIB",col:"var(--gain)",pts:B.pib_aa.slice(-24).map(p=>[mcTq(p[0]),p[1]])}],{bars:true,zero:true,h:180,fmt:"pct",aria:"PIB"});
  const yy=n=>(B[n+"_aa"]||[]).map(p=>[mcTm(p[0]),p[1]]).filter(p=>p[0]>=Date.UTC(new Date().getUTCFullYear()-5,0,1));
  h+='<div class="label" style="margin-top:12px">Indústria, varejo e serviços: variação sobre o mesmo mês do ano anterior (%)</div>'+fnChart([{lab:"Indústria",col:"#2563eb",w:1.8,pts:yy("pim")},{lab:"Varejo",col:"#dc2626",w:1.8,pts:yy("pmc")},{lab:"Serviços",col:"#16a34a",w:1.8,pts:yy("pms")}],{fmt:"pct",zero:true,h:210,aria:"Atividade"});
  if(B.desemp)h+='<div class="label" style="margin-top:12px">Taxa de desemprego (%, trimestre móvel)</div>'+fnChart([{lab:"Desemprego",col:"#9333ea",w:2,pts:B.desemp.map(p=>[mcTm(p[0]),p[1]])}],{fmt:"pct",h:180,aria:"Desemprego"});
  return h+'<p class="sub" style="font-size:.8rem">Fontes: IBGE (Contas Nacionais Trimestrais, PNAD Contínua, Pesquisa Industrial Mensal, Pesquisa Mensal de Comércio — varejo restrito — e Pesquisa Mensal de Serviços) e Banco Central (IBC-Br, prévia mensal do PIB).</p>';
}
function mcFiscalHtml(B,F){
  if(!B||!B.dbgg)return "";const L=mcLast,y=String(new Date().getUTCFullYear()),k=[];
  const db=L(B.dbgg),dl=L(B.dlsp),pr=L(B.nfsp_prim),no=L(B.nfsp_nom);
  const a12=(S)=>S&&S.length>12?S[S.length-13][1]:null;
  if(db)k.push(mcKp("Dívida bruta · "+mcMes(db[0]),fx(db[1],1)+'% do PIB',a12(B.dbgg)!=null?mcSig(db[1]-a12(B.dbgg),1," p.p.").replace('"pos"','"x"').replace('"neg"','"pos"').replace('"x"','"neg"')+' em 12 meses':''));
  if(dl){const fd=mcFocusSer(F,"Dívida líquida do setor público",y);k.push(mcKp("Dívida líquida",fx(dl[1],1)+'% do PIB',fd?'Focus para dez/'+y.slice(2)+': '+fx(mcLast(fd)[1],1)+'%':''))}
  if(pr){const fp=mcFocusSer(F,"Resultado primário",y);k.push(mcKp("Resultado primário em 12 meses",mcSig(-pr[1],2,"% do PIB"),(fp?'Focus '+y+': '+fx(mcLast(fp)[1],2)+'% do PIB':'')))}
  if(no)k.push(mcKp("Resultado nominal em 12 meses",mcSig(-no[1],2,"% do PIB"),'inclui os juros da dívida'));
  let h='<h3>Contas públicas</h3><p class="sub">O risco fiscal é hoje o principal motor do risco-país e dos juros longos: dívida subindo e déficit persistente fazem o mercado cobrar taxas maiores nos títulos IPCA+ e prefixados longos.</p><div class="fnkpis">'+k.join("")+'</div>';
  const m=S=>(S||[]).map(p=>[mcTm(p[0]),p[1]]);
  h+='<div class="label" style="margin-top:12px">Dívida pública (% do PIB)</div>'+fnChart([{lab:"Dívida bruta do governo geral",col:"#dc2626",w:2,pts:m(B.dbgg)},{lab:"Dívida líquida do setor público",col:"#2563eb",w:2,pts:m(B.dlsp)}],{fmt:"pct",h:200,aria:"Dívida pública"});
  h+='<div class="label" style="margin-top:12px">Resultado do setor público em 12 meses (% do PIB; negativo = déficit)</div>'+fnChart([{lab:"Primário",col:"#16a34a",w:2,pts:m(B.nfsp_prim).map(p=>[p[0],-p[1]])},{lab:"Nominal (com juros)",col:"#9333ea",w:2,pts:m(B.nfsp_nom).map(p=>[p[0],-p[1]])}],{fmt:"pct",zero:true,h:200,aria:"Resultado fiscal"});
  return h+'<p class="sub" style="font-size:.8rem">Fonte: Banco Central (estatísticas fiscais; resultado = necessidade de financiamento do setor público com sinal invertido, sem desvalorização cambial; dívida bruta pela metodologia de 2008) e Focus.</p>';
}
function mcCredHtml(B){
  if(!B||!B.inad)return "";const L=mcLast,k=[],c=B.concessoes||[];
  if(c.length>24){const s12=i=>c.slice(i-11,i+1).reduce((a,p)=>a+p[1],0),n=c.length-1;k.push(mcKp("Concessões de crédito · "+mcMes(c[n][0]),fnMoney(c[n][1]*1e6),'12 meses: '+fnMoney(s12(n)*1e6)+' · '+mcSig((s12(n)/s12(n-12)-1)*100,1)+' sobre os 12 meses anteriores'))}
  [["inad","Inadimplência total"],["inad_pf","Pessoas físicas"],["inad_pj","Empresas"]].forEach(([n,l])=>{const u=L(B[n]);if(u){const a=B[n].length>12?B[n][B[n].length-13][1]:null;k.push(mcKp(l+" · "+mcMes(u[0]),fx(u[1],2)+'%',a!=null?mcSig(u[1]-a,2," p.p.").replace('"pos"','"x"').replace('"neg"','"pos"').replace('"x"','"neg"')+' em 12 meses':''))}});
  const m=S=>(S||[]).map(p=>[mcTm(p[0]),p[1]]);
  return '<h3>Crédito</h3><p class="sub">Inadimplência subindo costuma anteceder spreads maiores no crédito privado (debêntures, CRI, CRA) e lucros menores dos bancos.</p><div class="fnkpis">'+k.join("")+'</div>'
    +'<div class="label" style="margin-top:12px">Inadimplência (% da carteira com atraso acima de 90 dias)</div>'+fnChart([{lab:"Total",col:"#2563eb",w:2,pts:m(B.inad)},{lab:"Pessoas físicas",col:"#dc2626",w:1.8,pts:m(B.inad_pf)},{lab:"Empresas",col:"#16a34a",w:1.8,pts:m(B.inad_pj)}],{fmt:"pct",h:200,aria:"Inadimplência"})
    +'<p class="sub" style="font-size:.8rem">Fonte: Banco Central (estatísticas de crédito do sistema financeiro).</p>';
}

