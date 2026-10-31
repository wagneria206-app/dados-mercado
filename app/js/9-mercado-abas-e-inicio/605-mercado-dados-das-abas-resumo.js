/* ---------- Mercado: dados das abas Resumo, Juros, Crédito, Inflação e Índices ---------- */
const MK={di:null,inf:null,ima:null,cred:null,tit:null,deb:null,loaded:0,loading:false};
async function mkLoad(force){if(MK.loading||(!force&&MK.loaded&&Date.now()-MK.loaded<25*60000))return;MK.loading=true;
  const g=f=>roboJson(f).catch(()=>null);
  try{const [di,inf,ima,cred,tit,taxas]=await Promise.all([g("di_futuro.json"),g("inflacao.json"),g("ima.json"),g("credito_hist.json"),g("titulos_hist.json"),g("taxas_hist.json")]);
    MK.di=di&&di.dias&&Object.keys(di.dias).length?di:null;MK.inf=inf;MK.ima=ima&&ima.indices?ima:null;MK.cred=cred&&cred.dias?cred:null;MK.tit=tit&&tit.dias?tit:null;MK.taxas=taxas;if(di||inf||ima||cred||tit)MK.loaded=Date.now();
    if(!FX)fxLoad()}finally{MK.loading=false}
  if(MKM.has(activeMod))mkCalc()}
const bps=x=>isFinite(x)?(x>0?'+':x<0?'−':'')+fx(Math.abs(x)*100,0)+'\u00a0bps':'—';
const bpsC=(x,inv)=>isFinite(x)?'<span class="'+((inv?-x:x)>0.004?'neg':(inv?-x:x)<-0.004?'pos':'')+'">'+bps(x)+'</span>':'—';
// DI futuro: taxa de cada vencimento e Copom
function diCurve(dk){if(!MK.di)return [];const t=Date.parse(dk+"T00:00:00Z");return (MK.di.dias[dk]||[]).map(r=>{const e=fxExp(r[0]),n=du(t,e);return {c:r[0],e,n,pu:+r[1],tx:r[3]!=null&&isFinite(r[3])?+r[3]:n>0?(Math.pow(1e5/+r[1],252/n)-1)*100:NaN}}).filter(x=>x.n>0&&isFinite(x.tx)).sort((a,b)=>a.e-b.e)}
const COPOM=[["2026-11-04"],["2026-12-09"],["2027-01-27"],["2027-03-17"],["2027-04-28"],["2027-06-16"],["2027-08-04"],["2027-09-22"],["2027-10-27"],["2027-12-08"]].map(x=>Date.parse(x[0]+"T00:00:00Z"));
const FOMC=["2026-10-28","2026-12-09","2027-01-27","2027-03-17","2027-04-28","2027-06-09","2027-07-28","2027-09-15","2027-10-27","2027-12-08"].map(x=>Date.parse(x+"T00:00:00Z"));
function cdiNow(){const ks=Object.keys(CDI_DAILY).sort();const v=ks.length?CDI_DAILY[ks[ks.length-1]]:null;return v!=null?(Math.pow(1+v/100,252)-1)*100:SELIC_OVER-0.1}
function copomImpl(dk){
  const C=diCurve(dk),t0=Date.parse(dk+"T00:00:00Z");if(!C.length)return null;const r0=cdiNow();
  const eff=COPOM.filter(d=>d>=t0).map(d=>{let t=d+DAY;while(!isBiz(t))t+=DAY;return {d,t}});
  const out=[];let fac=(e)=>{ // fator do CDI de hoje até e, com as taxas já encontradas
    let f=1,a=t0,r=r0;for(const s of out){if(e<=s.t)break;f*=Math.pow(1+r/100,du(a,s.t)/252);a=s.t;r=s.r}f*=Math.pow(1+r/100,du(a,e)/252);return f};
  // para cada reunião, o primeiro DI que vence pelo menos 15 dias úteis depois da nova taxa entrar em vigor e antes da reunião seguinte
  for(let i=0;i<eff.length&&out.length<6;i++){const s=eff[i],nx=eff[i+1]?eff[i+1].t:Infinity,k=C.find(x=>x.e>s.t&&x.e<=nx&&du(s.t,x.e)>=15);if(!k)break;
    const Fk=Math.pow(1+k.tx/100,k.n/252),Fs=fac(s.t),n2=du(s.t,k.e),r=(Math.pow(Fk/Fs,252/n2)-1)*100;
    const pr=out.length?out[out.length-1].r:r0;if(!isFinite(r)||Math.abs(r-pr)>3)break;     // salto implausível: leitura não confiável
    out.push({d:s.d,t:s.t,r,ct:k.c})}
  let prev=r0;return out.map(o=>{const ch=o.r-prev;prev=o.r;return Object.assign(o,{ch})});
}
function diHtml(){
  if(!MK.di)return '<span class="label">Juros futuros (DI) e Copom</span><p class="sub">Os preços de ajuste do DI futuro da B3 aparecem aqui depois da próxima coleta do robô.</p>';
  const ks=Object.keys(MK.di.dias).sort(),dk=ks[ks.length-1],pv=ks.length>1?ks[ks.length-2]:null,C=diCurve(dk),P=pv?diCurve(pv):[],t=Date.parse(dk+"T00:00:00Z");
  const sel=MK.inf&&MK.inf.selic_meta?MK.inf.selic_meta:null;
  let h='<span class="label">Juros futuros (DI1 da B3) e Copom</span><p class="sub" style="margin-top:4px">Taxa de ajuste de cada vencimento do DI futuro de '+fdate(t)+' e o que o mercado precifica para a Selic em cada reunião do Copom.</p>';
  const cp=copomImpl(dk);
  if(cp&&cp.length){h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">Reunião do Copom</th><th>Selic implícita depois</th><th>Mudança precificada</th><th style="text-align:left">Leitura</th></tr></thead><tbody>'
    +cp.slice(0,8).map(o=>{const meta=o.r+0.10,ch=o.ch,lab=Math.abs(ch)<0.125?'manutenção':ch>0?'alta de ~'+fx(Math.round(ch*4)/4,2)+' p.p.':'corte de ~'+fx(Math.round(-ch*4)/4,2)+' p.p.';return '<tr><td style="text-align:left">'+fdate(o.d)+'</td><td>'+fx(meta,2)+'%</td><td>'+(ch>0?'+':ch<0?'−':'')+fx(Math.abs(ch),2)+' p.p.</td><td style="text-align:left"><small>'+lab+' (pelo '+esc(o.ct)+')</small></td></tr>'}).join("")+'</tbody></table></div>';
    h+='<p class="sub" style="font-size:.8rem;margin-top:4px">Selic meta hoje: '+(sel?fx(sel.valor,2)+'%':'—')+'; CDI '+fx(cdiNow(),2)+'% a.a. Cálculo: taxa constante entre reuniões, ajustada para que cada DI futuro que vence depois de uma reunião tenha o preço de ajuste da B3; Selic ≈ CDI + 0,10. A tabela mostra só as reuniões que têm um DI vencendo entre elas e a reunião seguinte, com pelo menos 15 dias úteis de distância; contratos com pouco negócio podem distorcer a leitura.</p>'}
  h+='<div class="tablewrap" style="max-height:none;margin-top:10px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">Contrato</th><th>Vence</th><th>Dias úteis</th><th>Taxa</th><th>No dia</th></tr></thead><tbody>'
   +C.filter((x,i)=>i<8||/^F/.test(x.c)).slice(0,22).map(x=>{const p=P.find(y=>y.c===x.c);return '<tr><td style="text-align:left"><b>DI1'+esc(x.c)+'</b></td><td>'+txD2(x.e)+'</td><td>'+x.n+'</td><td><b>'+fx(x.tx,3)+'%</b></td><td>'+(p?bpsC(x.tx-p.tx):'—')+'</td></tr>'}).join("")+'</tbody></table></div>';
  const pick=b=>{let r=null;for(const k of ks)if(Date.parse(k+"T00:00:00Z")<=t-b*DAY)r=k;return r};const ser=[];new Set([dk,pick(7),pick(30)].filter(Boolean)).forEach(k=>{const L=diCurve(k).filter(x=>x.n<=2520);if(L.length>1)ser.push({lab:(k===dk?"Hoje":k===pick(7)?"1 semana atrás":"1 mês atrás")+" ("+txD2(Date.parse(k+"T00:00:00Z"))+")",col:k===dk?"var(--accent)":k===pick(7)?"var(--s4)":"var(--s2)",w:k===dk?2.4:1.6,pts:L.map(x=>[x.e,x.tx])})});
  if(ser.length)h+='<div class="label" style="margin-top:10px">Curva do DI futuro (% a.a.)</div>'+fxMulti(ser,{months:false,unit:"%"}).replace(/R\$ /g,"");
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Fonte: B3, arquivo consolidado de negócios do dia (taxa de ajuste do DI1). Atualizado no fim da tarde.</p>';
  return h;
}
// Juros dos EUA
function euaHtml(){const U=FXJ&&FXJ.ultimo;if(!U)return "";const R=[["fed_funds","Fed funds (juro do Fed)"],["juro_eua","SOFR (overnight)"],["treasury_2a","Treasury 2 anos"],["treasury_10a","Treasury 10 anos"],["juro_real_eua_10a","Juro real 10 anos (TIPS)"]].filter(x=>U[x[0]]);if(!R.length)return "";
  const M=FXJ.mensal||{},m1=k=>{const s=M[k];if(!s)return NaN;const ks=Object.keys(s).sort();return ks.length>1?s[ks[ks.length-2]]:NaN};
  return '<span class="label">Juros dos EUA</span><div class="rsgrid">'+R.map(([k,l])=>{const v=U[k].valor,p=m1(k);return '<div><span>'+l+'</span><b>'+fx(v,2)+'%</b><small>'+fdate(Date.parse(U[k].data))+(isFinite(p)?' · '+bpsC(v-p)+' sobre a média do mês anterior':'')+'</small></div>'}).join("")+'</div><p class="sub" style="font-size:.8rem;margin-top:6px">Fontes: Tesouro americano (Treasuries e juro real) e Fed de Nova York (juro do Fed e SOFR). Juro alto nos EUA tende a fortalecer o dólar e pressionar os juros longos no Brasil.</p>'}
// Taxas indicativas dos títulos públicos (ANBIMA), com variação
function titHtml(){
  const T=MK.tit&&MK.tit.dias,ks=T?Object.keys(T).sort():[];if(!ks.length)return "";const dk=ks[ks.length-1],D=T[dk],pv=ks.length>1?T[ks[ks.length-2]]:null,t=Date.parse(dk+"T00:00:00Z");
  let m1=null;for(const k of ks)if(Date.parse(k+"T00:00:00Z")<=t-28*DAY)m1=T[k];
  const NM={LTN:"Prefixado (LTN)",NTNF:"Prefixado com juros (NTN-F)",NTNB:"IPCA+ com juros (NTN-B)",LFT:"Selic (LFT)"};
  let h='<span class="label">Taxas indicativas da ANBIMA (títulos públicos)</span><p class="sub" style="margin-top:4px">Taxa de mercado secundário de '+fdate(t)+', com a variação no dia'+(m1?' e em cerca de 1 mês':'')+'. O histórico cresce um dia por coleta (começou em '+fdate(Date.parse(ks[0]+"T00:00:00Z"))+').</p>';
  ["NTNB","LTN","NTNF","LFT"].forEach(k=>{const L=D[k];if(!L||!L.length)return;const f=(S,v)=>{const r=S&&S[k]&&S[k].find(x=>x[0]===v);return r?r[1]:NaN};
    h+='<details style="margin-top:8px"'+(k==="NTNB"?' open':'')+'><summary class="label" style="cursor:pointer">'+NM[k]+'</summary><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">Vencimento</th><th>Taxa</th><th>No dia</th>'+(m1?'<th>1 mês</th>':'')+'</tr></thead><tbody>'
     +L.map(([v,r])=>'<tr><td style="text-align:left">'+fdate(Date.parse(v+"T00:00:00Z"))+'</td><td><b>'+fx(r,k==="LFT"?4:2)+'%</b></td><td>'+bpsC(r-f(pv,v))+'</td>'+(m1?'<td>'+bpsC(r-f(m1,v))+'</td>':'')+'</tr>').join("")+'</tbody></table></div></details>'});
  return h+'<p class="sub" style="font-size:.8rem;margin-top:6px">Taxa subindo = preço do título caindo. LFT: ágio (−) ou deságio (+) sobre a Selic.</p>';
}
// Crédito privado
function crHtml(){
  const C=MK.cred&&MK.cred.dias,ks=C?Object.keys(C).sort():[];if(!ks.length)return '<span class="label">Spread do crédito privado</span><p class="sub">O spread das debêntures aparece aqui depois da próxima coleta do robô.</p>';
  const dk=ks[ks.length-1],D=C[dk],pv=ks.length>1?C[ks[ks.length-2]]:null,t=Date.parse(dk+"T00:00:00Z");let m1=null;for(const k of ks)if(Date.parse(k+"T00:00:00Z")<=t-28*DAY)m1=C[k];
  const card=(lab,k,suf)=>{const x=D[k];if(!x)return "";const d=pv&&pv[k]?x.mediana-pv[k].mediana:NaN,d1=m1&&m1[k]?x.mediana-m1[k].mediana:NaN;return '<div><span>'+lab+'</span><b>'+suf(x.mediana)+'</b><small>metade entre '+fx(x.p25,2)+' e '+fx(x.p75,2)+' · '+x.n+' papéis<br>no dia '+bpsC(d)+(isFinite(d1)?' · 1 mês '+bpsC(d1):'')+'</small></div>'};
  let h='<span class="label">Spread do crédito privado (debêntures)</span><p class="sub" style="margin-top:4px">Quanto as debêntures pagam acima da referência, pela taxa indicativa da ANBIMA de '+fdate(t)+'. Spread abrindo (subindo) = mercado cobrando mais pelo risco de crédito e preços das debêntures caindo; fechando (caindo) = papéis mais caros, com retorno menor para quem compra agora.</p><div class="rsgrid">'
   +card("DI+ · spread sobre o CDI (mediana)","di",v=>"CDI + "+fx(v,2)+"%")+card("IPCA+ · spread sobre a NTN-B (mediana)","ipca",v=>fx(v,2)+" p.p.")+card("IPCA+ incentivadas (Lei 12.431)","ipca_incentivadas",v=>fx(v,2)+" p.p.")+'</div>';
  if(ks.length>2){const T=k=>Date.parse(k+"T00:00:00Z"),S=(g,f)=>ks.filter(k=>C[k][g]).map(k=>[T(k),C[k][g][f]]);
    const span=(T(ks[ks.length-1])-T(ks[0]))/DAY,mo=span>75;
    h+='<div class="label" style="margin-top:14px">DI+ · spread sobre o CDI (% a.a.)</div>'+fxMulti([{lab:"Mediana",col:"var(--accent)",w:2.4,pts:S("di","mediana")},{lab:"1º quartil",col:"var(--muted)",dash:"4 4",w:1.2,pts:S("di","p25")},{lab:"3º quartil",col:"var(--muted)",dash:"4 4",w:1.2,pts:S("di","p75")}],{months:mo,unit:"%"}).replace(/R\$ /g,"");
    const inc=S("ipca_incentivadas","mediana");
    h+='<div class="label" style="margin-top:14px">IPCA+ · spread sobre a NTN-B (pontos percentuais)</div>'+fxMulti([{lab:"Mediana",col:"var(--s2)",w:2.4,pts:S("ipca","mediana")}].concat(inc.length?[{lab:"Mediana das incentivadas",col:"var(--s3)",w:1.6,pts:inc}]:[]).concat([{lab:"1º quartil",col:"var(--muted)",dash:"4 4",w:1.2,pts:S("ipca","p25")},{lab:"3º quartil",col:"var(--muted)",dash:"4 4",w:1.2,pts:S("ipca","p75")}]),{months:mo,unit:"pp"}).replace(/R\$ /g,"");
    h+='<p class="sub" style="font-size:.8rem;margin-top:4px">Metade das debêntures fica entre o 1º e o 3º quartil. Linhas subindo = spreads abrindo (crédito mais arriscado na visão do mercado, preços caindo). Histórico desde '+fdate(T(ks[0]))+'.</p>'}
  else h+='<p class="sub" style="font-size:.82rem;margin-top:8px">O gráfico do spread ao longo do tempo aparece quando houver alguns dias de histórico (começou em '+fdate(Date.parse(ks[0]+"T00:00:00Z"))+').</p>';
  return h+'<p class="sub" style="font-size:.8rem;margin-top:6px">IPCA+: taxa da debênture menos a taxa indicativa da NTN-B de mesmo vencimento (interpolada). Mediana e quartis de todas as debêntures com taxa ANBIMA no dia.</p>';
}
function debHtml(){
  const T=MK.taxas||{};let movers=[];for(const [c,L] of Object.entries(T)){if(!Array.isArray(L)||L.length<2||/^\d{2}[A-Z]\d{7}$/.test(c))continue;const a=L[L.length-1],b=L[L.length-2];if(a[0]===b[0])continue;movers.push({c,d:a[1]-b[1],v:a[1],dt:a[0]})}
  movers.sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));
  let h='<span class="label">Debêntures: histórico das taxas ANBIMA</span><div class="debq" style="margin-top:8px"><div class="field"><label for="debCode">Código da debênture</label><input id="debCode" list="pcList" autocapitalize="characters" spellcheck="false" placeholder="ex.: MOVI27" value="'+esc(MK.debc||"")+'"></div><button type="button" class="btn" data-debgo="1">Ver histórico</button></div><div id="debOut" style="margin-top:8px">'+(MK.debc?debOne(MK.debc):'')+'</div>';
  if(movers.length)h+='<div class="label" style="margin-top:14px">Maiores variações de taxa no último dia</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">Debênture</th><th>Taxa</th><th>Variação</th></tr></thead><tbody>'+movers.slice(0,12).map(m=>'<tr><td style="text-align:left"><button type="button" class="link" data-deb="'+esc(m.c)+'"><b>'+esc(m.c)+'</b></button> <small>'+fdate(Date.parse(m.dt+"T00:00:00Z"))+'</small></td><td>'+fx(m.v,2)+'%</td><td>'+bpsC(m.d)+'</td></tr>').join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem;margin-top:4px">Taxa subindo forte costuma indicar piora na percepção de risco do emissor. Clique no código para ver o histórico.</p>';
  return h;
}
function debOne(code){code=String(code||"").toUpperCase().trim();const L=(MK.taxas||{})[code];if(!L||!L.length)return '<p class="sub">Sem taxa ANBIMA guardada para '+esc(code)+'.</p>';
  const pts=L.map(x=>[Date.parse(x[0]+"T00:00:00Z"),+x[1]]),a=pts[pts.length-1],b=pts[0];
  return '<p class="sub"><b>'+esc(code)+'</b>: '+fx(a[1],4)+'% em '+fdate(a[0])+(pts.length>1?' · '+bpsC(a[1]-b[1])+' desde '+fdate(b[0]):'')+'</p>'+(pts.length>1?fxMulti([{lab:"Taxa indicativa ANBIMA (%)",col:"var(--accent)",pts}],{months:false,unit:"%"}).replace(/R\$ /g,""):'')}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-debgo],[data-deb]");if(!b)return;const c=b.dataset.deb||($("debCode")&&$("debCode").value)||"";MK.debc=c.toUpperCase().trim();const o=$("debOut");if(o){o.innerHTML=debOne(MK.debc);if(b.dataset.deb){$("debCode").value=MK.debc;try{o.scrollIntoView({behavior:"smooth",block:"center"})}catch(x){}}}});
document.addEventListener("keydown",e=>{if(e.target&&e.target.id==="debCode"&&e.key==="Enter"){e.preventDefault();MK.debc=e.target.value.toUpperCase().trim();const o=$("debOut");if(o)o.innerHTML=debOne(MK.debc)}});
// Inflação em detalhe
function m12(L,i){let f=1;for(let k=i-11;k<=i;k++){if(k<0||!L[k])return NaN;f*=1+L[k][1]/100}return (f-1)*100}
function ipcaHtml(){
  const I=MK.inf;if(!I||!I.sgs||!I.sgs.ipca)return '<span class="label">Inflação</span><p class="sub">Os dados detalhados de inflação aparecem aqui depois da próxima coleta do robô.</p>';
  const S=I.sgs,ip=S.ipca,n=ip.length-1,last=ip[n],ym=last[0],k=(+ym.slice(0,4))*12+(+ym.slice(5,7))-1;
  const yr=ip.filter(x=>x[0].slice(0,4)===ym.slice(0,4)).reduce((f,x)=>f*(1+x[1]/100),1);
  const META=3,TOL=1.5;let h='<span class="label">Inflação (IPCA) · '+mname(k)+'</span><div class="rsgrid">'
   +'<div><span>IPCA no mês</span><b>'+fx(last[1],2)+'%</b><small>mês anterior '+fx(ip[n-1][1],2)+'%</small></div>'
   +'<div><span>IPCA em 12 meses</span><b class="'+(m12(ip,n)>META+TOL?'neg':m12(ip,n)<META-TOL?'pos':'')+'">'+fx(m12(ip,n),2)+'%</b><small>meta '+fx(META,1)+'% (tolerância de '+fx(META-TOL,1)+'% a '+fx(META+TOL,1)+'%)</small></div>'
   +'<div><span>No ano</span><b>'+fx((yr-1)*100,2)+'%</b><small>'+ym.slice(0,4)+'</small></div>';
  if(I.ipca15){const ms=Object.keys(I.ipca15).sort(),u=ms[ms.length-1],G=I.ipca15[u],v=Object.values(G)[0]||{},mv=Object.entries(v).find(([a])=>/varia\S*o mensal/i.test(a)),a12=Object.entries(v).find(([a])=>/12 meses/i.test(a));if(mv)h+='<div><span>IPCA-15 · '+mname((+u.slice(0,4))*12+(+u.slice(4,6))-1)+'</span><b>'+fx(mv[1],2)+'%</b><small>'+(a12?'12 meses '+fx(a12[1],2)+'%':'prévia do IPCA')+'</small></div>'}
  const sel=I.selic_meta;if(sel)h+='<div><span>Selic meta</span><b>'+fx(sel.valor,2)+'%</b><small>juro real ex-post ≈ '+fx(((1+sel.valor/100)/(1+m12(ip,n)/100)-1)*100,2)+'%</small></div>';
  h+='</div>';
  const R=[["ipca","IPCA (cheio)"],["nucleo_ms","Núcleo médias aparadas (MS)"],["nucleo_dp","Núcleo dupla ponderação (DP)"],["servicos","Serviços"],["livres","Preços livres"],["monitorados","Preços monitorados (administrados)"],["comercializaveis","Comercializáveis"]].filter(x=>S[x[0]]&&S[x[0]].length>12);
  h+='<div class="tablewrap" style="max-height:none;margin-top:12px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">Medida</th><th>No mês</th><th>Mês anterior</th><th>12 meses</th></tr></thead><tbody>'+R.map(([k2,l])=>{const L=S[k2],j=L.length-1;return '<tr><td style="text-align:left">'+l+(L[j][0]!==ym?' <small>('+mname((+L[j][0].slice(0,4))*12+(+L[j][0].slice(5,7))-1)+')</small>':'')+'</td><td><b>'+fx(L[j][1],2)+'%</b></td><td>'+fx(L[j-1][1],2)+'%</td><td>'+fx(m12(L,j),2)+'%</td></tr>'}).join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem;margin-top:4px">Núcleos tiram os itens mais voláteis e mostram a tendência; o Banco Central olha muito para eles e para serviços.</p>';
  // gráfico: IPCA 12 meses × núcleos × meta
  const ser=[{lab:"IPCA 12 meses",col:"var(--accent)",w:2.2,pts:ip.map((x,i)=>[Date.UTC(+x[0].slice(0,4),+x[0].slice(5,7)-1,15),m12(ip,i)])}];
  ["nucleo_ms","servicos"].forEach((k2,j)=>{const L=S[k2];if(L)ser.push({lab:(k2==="servicos"?"Serviços":"Núcleo MS")+" 12 meses",col:j?"var(--s3)":"var(--s2)",pts:L.map((x,i)=>[Date.UTC(+x[0].slice(0,4),+x[0].slice(5,7)-1,15),m12(L,i)])})});
  ser.push({lab:"Teto da meta",col:"var(--muted)",dash:"4 4",w:1.2,pts:ser[0].pts.filter(p=>isFinite(p[1])).map(p=>[p[0],META+TOL])});
  h+=fxMulti(ser.map(s=>Object.assign(s,{pts:s.pts.filter(p=>isFinite(p[1]))})),{months:true,unit:"%"}).replace(/R\$ /g,"");
  // grupos
  if(I.grupos){const ms=Object.keys(I.grupos).sort(),u=ms[ms.length-1],G=I.grupos[u],row=Object.entries(G).filter(([c])=>/^\d\./.test(c));
    if(row.length){const gv=(o,re)=>{const e=Object.entries(o).find(([a])=>re.test(a));return e?e[1]:NaN};
      h+='<div class="label" style="margin-top:14px">IPCA por grupo · '+mname((+u.slice(0,4))*12+(+u.slice(4,6))-1)+'</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">Grupo</th><th>No mês</th><th>12 meses</th><th>Peso</th><th>Contribuição no mês</th></tr></thead><tbody>'
       +row.map(([c,o])=>{const v=gv(o,/varia\S*o mensal/i),a=gv(o,/12 meses/i),w=gv(o,/peso/i);return [c,v,a,w,v*w/100]}).sort((a,b)=>(b[4]||0)-(a[4]||0)).map(([c,v,a,w,ct])=>'<tr><td style="text-align:left">'+esc(c.replace(/^\d\.\s*/,""))+'</td><td>'+(isFinite(v)?fx(v,2)+'%':'—')+'</td><td>'+(isFinite(a)?fx(a,2)+'%':'—')+'</td><td>'+(isFinite(w)?fx(w,1)+'%':'—')+'</td><td>'+(isFinite(ct)?(ct>=0?'+':'−')+fx(Math.abs(ct),2)+' p.p.':'—')+'</td></tr>').join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem;margin-top:4px">Contribuição = variação do grupo × peso; mostra quem mais empurrou o índice no mês.</p>'}}
  return h+'<p class="sub" style="font-size:.8rem;margin-top:6px">Fontes: IBGE (IPCA, grupos e IPCA-15, via SIDRA) e Banco Central (núcleos, serviços, livres e monitorados, via SGS). Meta de inflação contínua de 3% (CMN).</p>';
}
// Índices ANBIMA
function imaHtml(){
  const M=MK.ima;if(!M)return '<span class="label">Índices de renda fixa (ANBIMA)</span><p class="sub">Os índices IMA aparecem aqui depois da próxima coleta do robô.</p>';
  const ord=["IRF-M 1","IRF-M 1+","IRF-M","IMA-B 5","IMA-B 5+","IMA-B","IMA-S","IMA-GERAL","IMA-GERAL EX-C","IMA-GERAL-EX-C","IMA-C"],rows=M.indices.slice().sort((a,b)=>{const ia=ord.indexOf(String(a.nome).toUpperCase()),ib=ord.indexOf(String(b.nome).toUpperCase());return (ia<0?99:ia)-(ib<0?99:ib)});
  const pc=x=>isFinite(x)&&x!==null?'<span class="'+(x>0?'pos':x<0?'neg':'')+'">'+(x>0?'+':x<0?'−':'')+fx(Math.abs(x),2)+'%</span>':'—';
  const DESC={"IRF-M 1":"prefixados até 1 ano","IRF-M 1+":"prefixados acima de 1 ano","IRF-M":"todos os prefixados","IMA-B 5":"IPCA+ até 5 anos","IMA-B 5+":"IPCA+ acima de 5 anos","IMA-B":"todos os IPCA+","IMA-S":"Tesouro Selic","IMA-GERAL":"todos os títulos públicos","IMA-GERAL EX-C":"todos, sem os IGP-M","IMA-GERAL-EX-C":"todos, sem os IGP-M"};
  let h='<span class="label">Índices de renda fixa da ANBIMA · '+(M.data?fdate(Date.parse(M.data+"T00:00:00Z")):'')+'</span><p class="sub" style="margin-top:4px">Carteiras teóricas de títulos públicos que servem de referência para fundos e carteiras de renda fixa.</p>'
   +'<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab fxstat"><thead><tr><th style="text-align:left">Índice</th><th>Dia</th><th>Mês</th><th>Ano</th><th>12 meses</th><th class="c-ph">24 meses</th><th class="c-ph">Duration</th><th class="c-ph">Taxa média</th></tr></thead><tbody>'
   +rows.map(x=>{const nm=String(x.nome);return '<tr><td style="text-align:left"><b>'+esc(nm)+'</b>'+(DESC[nm.toUpperCase()]?' <small>'+DESC[nm.toUpperCase()]+'</small>':'')+'</td><td>'+pc(x.dia)+'</td><td>'+pc(x.mes)+'</td><td>'+pc(x.ano)+'</td><td>'+pc(x.m12)+'</td><td class="c-ph">'+pc(x.m24)+'</td><td class="c-ph">'+(isFinite(x.duration)&&x.duration!==null?fx(x.duration/252,1)+' anos':'—')+'</td><td class="c-ph" style="white-space:nowrap">'+(isFinite(x.taxa)&&x.taxa!==null?(/^IMA-B/i.test(nm)?'IPCA + ':'')+fx(x.taxa,2)+'%':'—')+'</td></tr>'}).join("")+'</tbody></table></div>';
  const H=M.historico||{},hk=Object.keys(H).sort();if(hk.length>2){const nm=["IMA-B","IRF-M","IMA-S","IMA-B 5"],cols=["var(--accent)","var(--s2)","var(--muted)","var(--s3)"];
    const ser=nm.map((n,i)=>{const b=hk.find(k=>H[k][n]);if(!b)return null;return {lab:n+" (base 100)",col:cols[i],pts:hk.filter(k=>H[k][n]).map(k=>[Date.parse(k+"T00:00:00Z"),H[k][n]/H[b][n]*100])}}).filter(Boolean);h+=fxMulti(ser,{months:false,unit:""}).replace(/R\$ /g,"")}
  else h+='<p class="sub" style="font-size:.82rem;margin-top:8px">O gráfico de desempenho aparece com alguns dias de histórico guardado (começou em '+fdate(Date.parse((hk[0]||M.data)+"T00:00:00Z"))+').</p>';
  return h+'<p class="sub" style="font-size:.8rem;margin-top:6px">Fonte: ANBIMA, resultados diários do IMA. Duration em anos (dias úteis ÷ 252): quanto maior, mais o índice oscila com os juros. Taxa média = redemption yield da carteira do índice.</p>';
}
// Resumo do dia
function rsHtml(){
  const W=curvWins(),cv=w=>w&&w.b&&!w.approx?w.b:null,b0=W?cv(W[0]):null,b1=W?cv(W[1]):null,card=[];
  const add=(l,v,sub)=>card.push('<div><span title="'+l.replace(/<[^>]+>/g,'')+'">'+l+'</span><b>'+v+'</b><small>'+(sub||'')+'</small></div>');
  const sel=MK.inf&&MK.inf.selic_meta;if(sel)add("Selic meta",fx(sel.valor,2)+"%","CDI "+fx(cdiNow(),2)+"% a.a.");
  if(MK.di){const ks=Object.keys(MK.di.dias).sort(),dk=ks[ks.length-1],cp=copomImpl(dk);if(cp&&cp[0]){const o=cp[0],ch=o.ch;add("Próximo Copom",(Math.abs(ch)<0.125?"manutenção":(ch>0?"+":"−")+fx(Math.abs(ch),2)+" p.p."),txD2(o.d)+" · precificado no DI")}
    const C=diCurve(dk),P=ks.length>1?diCurve(ks[ks.length-2]):[],j=C.find(x=>x.c==="F"+String(new Date(Date.parse(dk)).getUTCFullYear()+2).slice(2));if(j){const p=P.find(y=>y.c===j.c);add("DI janeiro/"+(2000+(+j.c.slice(1))),fx(j.tx,2)+"%",p?bpsC(j.tx-p.tx)+" no dia":"")}}
  if(b0){[["Prefixado 5 anos",t=>nssY(b0.pre,t),t=>nssY(b1.pre,t),5],["Prefixado 10 anos",t=>nssY(b0.pre,t),t=>nssY(b1.pre,t),10],["Juro real 5 anos",t=>nssY(b0.ipca,t),t=>nssY(b1.ipca,t),5],["Juro real 10 anos",t=>nssY(b0.ipca,t),t=>nssY(b1.ipca,t),10]].forEach(([l,f,g,t])=>add(l,fx(f(t),2)+"%",b1?bpsC(f(t)-g(t))+" no dia":""));
    const im=b=>((1+nssY(b.pre,5)/100)/(1+nssY(b.ipca,5)/100)-1)*100;add("Inflação implícita 5 anos",fx(im(b0),2)+"%",b1?bpsC(im(b0)-im(b1))+" no dia":"")}
  if(MK.ima){["IMA-B","IRF-M","IMA-S"].forEach(n=>{const x=MK.ima.indices.find(r=>String(r.nome).toUpperCase()===n);if(x&&isFinite(x.dia)&&x.dia!==null){const v=x.dia;add(n+" no dia",'<span class="'+(v>0?'pos':v<0?'neg':'')+'">'+(v>0?'+':v<0?'−':'')+fx(Math.abs(v),2)+'%</span>',isFinite(x.mes)?"no mês "+fx(x.mes,2)+"%":"")}})}
  if(MK.cred){const ks=Object.keys(MK.cred.dias).sort(),D=MK.cred.dias[ks[ks.length-1]],P=ks.length>1?MK.cred.dias[ks[ks.length-2]]:null;if(D.ipca)add("Spread de debêntures",fx(D.ipca.mediana,2)+" p.p.","IPCA+ · "+(P&&P.ipca?bpsC(D.ipca.mediana-P.ipca.mediana)+" no dia":"mediana sobre a NTN-B"))}
  if(MK.inf&&MK.inf.sgs&&MK.inf.sgs.ipca){const L=MK.inf.sgs.ipca,j=L.length-1;add("IPCA 12 meses",fx(m12(L,j),2)+"%",mname((+L[j][0].slice(0,4))*12+(+L[j][0].slice(5,7))-1)+": "+fx(L[j][1],2)+"% no mês")}
  // Tesouro Direto: título com maior percentil de taxa
  try{const O=oppData().filter(o=>isFinite(o.pctl)).sort((a,b)=>b.pctl-a.pctl)[0];if(O)add("Tesouro: taxa alta na história",esc(O.name.replace(/^Tesouro /,"")),fr(O,O.buy)+" · percentil "+fx(O.pctl,0))}catch(e){}
  return '<span class="label">Resumo do mercado</span><p class="sub" style="margin-top:4px">O que mais importa hoje, com a variação sobre o dia anterior. Toque nas abas para ver cada assunto em detalhe.</p><div class="rsgrid">'+card.join("")+'</div><p class="sub" style="font-size:.8rem;margin-top:8px">bps = centésimos de ponto percentual (+25 bps = taxa 0,25 ponto mais alta). Taxas subindo = preços dos títulos prefixados e IPCA+ caindo.</p>';
}
function agendaHtml(){
  const t0=Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate()),lim=t0+45*DAY,E=[];
  COPOM.forEach(d=>{if(d>=t0&&d<=lim){E.push([d-DAY,"Copom: começa a reunião"]);E.push([d,"Copom: decisão da Selic (fim da tarde)"]);let a=d+DAY;let n=0;while(n<4){if(isBiz(a))n++;if(n<4)a+=DAY}E.push([a,"Ata do Copom"])}});
  FOMC.forEach(d=>{if(d>=t0&&d<=lim)E.push([d,"Fed (EUA): decisão de juros (FOMC), 15h de Brasília"])});
  euaCalProx(45).forEach(x=>E.push([Date.parse(x[0]+"T00:00:00Z"),"EUA: "+EUA_CAL_T[x[1]][0].replace(/,.*$/,"")+" ("+x[2]+"), "+euaHoraBr(x[0])]));
  for(let k=0;k<3;k++){const m=new Date(t0);let t=Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+k,1);while(!isBiz(t))t+=DAY;if(t>=t0&&t<=lim)E.push([t,"Vencimento do DI futuro e do dólar futuro (B3)"])}
  E.sort((a,b)=>a[0]-b[0]);
  return '<span class="label">Agenda (próximas semanas)</span>'+(E.length?'<ul class="agl">'+E.map(([d,l])=>'<li><b>'+["dom","seg","ter","qua","qui","sex","sáb"][new Date(d).getUTCDay()]+' '+txD2(d)+'</b><span>'+esc(l)+'</span></li>').join("")+'</ul>':'<p class="sub">Nada marcado nas próximas semanas.</p>')+'<p class="sub" style="font-size:.8rem;margin-top:6px">Datas do Copom e do Fed pelos calendários oficiais de 2026 e 2027 (Banco Central e Federal Reserve). A ata do Copom sai na terça-feira seguinte à reunião. IPCA e IPCA-15: o IBGE divulga por volta do dia 10 e do dia 25 de cada mês, às 9h.</p>';
}

