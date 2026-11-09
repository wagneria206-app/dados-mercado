/* ---------- Opções (volatilidade implícita e puts ÷ calls, robô scripts/opcoes.py) e mapa setorial com força relativa */
const OP={d:null,err:null,load:null};
function opBoot(){if(OP.d||OP.load||OP.err)return;OP.load=fetch(DADOS_RAIZ+"opcoes/opcoes.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(d=>{OP.d=d;OP.load=null;if(activeMod==="aa"&&typeof atAa==="function")atAa()}).catch(e=>{OP.err=e;OP.load=null})}
function atOpcHtml(A){
  if(!(A.tipo==="Ação"||A.tipo==="Unit"||A.tipo==="ETF"))return "";
  if(!OP.d){opBoot();return ""}const L=OP.d.t[A.t];if(!L||!L.length)return "";
  const u=L[L.length-1],iv=u[1]!=null&&u[2]!=null?(u[1]+u[2])/2:u[1]!=null?u[1]:u[2],T=tecCalc(A),hv=T?T.vol:null;
  const ivs=L.map(x=>x[1]!=null&&x[2]!=null?(x[1]+x[2])/2:x[1]!=null?x[1]:x[2]).filter(v=>v!=null),rk=iv!=null&&ivs.length>20?vqRank(ivs,iv):null;
  let h='<section class="panel"><h3>Opções</h3><div class="fnkpis">'
    +tecKp("Volatilidade implícita",iv!=null?fx(iv,1)+'%':'—','o que o mercado de opções espera de oscilação, ao ano')
    +tecKp("Volatilidade realizada (21 dias)",hv!=null?fx(hv,1)+'%':'—',iv!=null&&hv?'implícita '+(iv>hv*1.15?'acima':iv<hv*0.85?'abaixo':'perto')+' da realizada':'')
    +tecKp("Puts ÷ calls (volume)",u[3]!=null?fx(u[3],2):'—',u[3]==null?'':u[3]>1.2?'muita procura por proteção (puts)':u[3]<0.6?'mais apostas na alta (calls)':'equilibrado')
    +tecKp("Volume em opções",fnMoney(u[4]),'no pregão de '+fdate(Date.parse(u[0]+"T00:00:00Z")))+'</div>';
  if(rk!=null)h+='<p style="margin:2px 0 8px">A volatilidade implícita está mais alta que em '+fx(rk,0)+'% dos pregões guardados: '+(rk>=80?'o mercado está pagando caro por proteção (bom momento para quem vende opções, ruim para quem compra).':rk<=20?'proteção barata em relação ao histórico.':'dentro do normal.')+'</p>';
  if(L.length>5)h+='<div class="label">Volatilidade implícita no dinheiro (% ao ano)</div>'+fnChart([{lab:"Call",col:FN_COLS[0],w:1.8,pts:L.filter(x=>x[1]!=null).map(x=>[Date.parse(x[0]+"T00:00:00Z"),x[1]])},{lab:"Put",col:FN_COLS[1],w:1.8,pts:L.filter(x=>x[2]!=null).map(x=>[Date.parse(x[0]+"T00:00:00Z"),x[2]])}],{fmt:"pct",h:160,aria:"Volatilidade implícita"});
  return h+'<p class="sub" style="font-size:.8rem">Fonte: B3, negócios do dia com opções. Volatilidade implícita pelo modelo de Black-Scholes, na call e na put mais próximas do preço da ação, no primeiro vencimento com pelo menos 7 dias. Puts ÷ calls: volume financeiro negociado em opções de venda sobre o de compra.</p></section>';
}
function setoresHtml(){ // força relativa por setor: retorno mediano das ações de cada setor contra o Ibovespa
  if(!AT.idx)return "";const I=AT.idx,C=AT.C,G=new Map();
  I.rows.forEach(r=>{if(!(r[C.tipo]==="Ação"||r[C.tipo]==="Unit")||(r[C.liq]||0)<2e6)return;const s=I.setores[r[C.setor]];if(!s||/n[ãa]o classificad|^outros$/i.test(s))return;const g=G.get(s)||{s,k:r[C.setor],L:[]};g.L.push(r);G.set(s,g)});
  const med=(L,c)=>vqPct(L.map(r=>r[C[c]]).filter(v=>v!=null),.5);
  const ib=EU.S&&EU.S.ibov?{m1:semVar("ibov",30),m12:semVar("ibov",365)}:null;
  const S=[...G.values()].filter(g=>g.L.length>=3).map(g=>({s:g.s,k:g.k,n:g.L.length,d5:C.r5!=null?med(g.L,"r5"):null,m1:med(g.L,"r1m"),ra:med(g.L,"ra"),m12:med(g.L,"r12"),alta:C.tend!=null?g.L.filter(r=>r[C.tend]===1).length/g.L.length*100:null}));
  if(!S.length)return "";S.sort((a,b)=>(b.m1??-99)-(a.m1??-99));
  const cel=v=>{if(v==null)return '<td>—</td>';const a=Math.min(1,Math.abs(v)/15);return '<td style="background:color-mix(in srgb,'+(v>=0?'var(--gain)':'var(--loss)')+' '+Math.round(a*45)+'%,transparent)">'+(v>=0?'+':'')+fx(v,1)+'%</td>'};
  if(!EU.S)euBoot();
  return '<h3>Setores: força relativa</h3><p class="sub">Retorno mediano das ações de cada setor (liquidez acima de R$ 2 milhões por dia). Ordenado pelo último mês'+(ib&&ib.m1?'; o Ibovespa fez '+(ib.m1.r>=0?'+':'')+fx(ib.m1.r,1)+'% em um mês e '+(ib.m12.r>=0?'+':'')+fx(ib.m12.r,1)+'% em 12 meses':'')+'. Setores com mais ações em tendência de alta mostram força generalizada, não só de uma empresa.</p>'
    +'<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Setor</th><th class="c-ph">Ações</th>'+(C.r5!=null?'<th>Semana</th>':'')+'<th>1 mês</th><th>No ano</th><th>12 meses</th>'+(C.tend!=null?'<th class="c-ph">Em tendência de alta</th>':'')+'</tr></thead><tbody>'
    +S.map(x=>'<tr><td style="text-align:left"><button type="button" class="link" data-atrkcat="Ação|'+x.k+'">'+esc(x.s)+'</button></td><td class="c-ph">'+x.n+'</td>'+(C.r5!=null?cel(x.d5):'')+cel(x.m1)+cel(x.ra)+cel(x.m12)+(C.tend!=null?'<td class="c-ph">'+fx(x.alta,0)+'%</td>':'')+'</tr>').join("")+'</tbody></table></div>';
}
