/* ---------- Fundos › Fluxo: captação líquida da indústria por categoria e por tipo ANBIMA (informes da CVM) */
// Os números vêm de fluxo.json, somado pelo robô de fundos (scripts/fluxo_fundos.py) sem os fundos de cotas.
const FF_MES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const FF={d:null,err:null,load:null,vis:"cat",per:12};
function ffBoot(){if(FF.d||FF.load)return FF.load;FF.err=null;FF.load=fnGet("fluxo.json").then(d=>{FF.d=d;FF.load=null;if(activeMod==="ff")ffTela()}).catch(e=>{FF.err=e;FF.load=null;if(activeMod==="ff")ffTela()});return FF.load}
function fnFluxo(){
  const o=$("fnOut");if(!o)return;
  if(FN.view!=="ff"){FN.view="ff";o.innerHTML='<section class="panel" id="ffTop"><h3>Fluxo dos fundos</h3><p class="sub">Para onde o dinheiro está indo: captação líquida (aplicações menos resgates) e patrimônio de cada categoria, mês a mês, pelos informes diários dos fundos à CVM.</p><div id="ffCtl"></div></section><div id="ffBody"></div>'}
  ffTela();
}
function ffTela(){
  const b=$("ffBody"),ctl=$("ffCtl");if(!b)return;
  if(!FF.d){if(FF.err)b.innerHTML='<section class="panel"><p class="warn">O fluxo dos fundos aparece depois da próxima coleta do robô de fundos ('+esc(FF.err.message||FF.err)+').</p></section>';else{b.innerHTML='<section class="panel"><p class="sub">Carregando o fluxo dos fundos…</p></section>';ffBoot()}return}
  ctl.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:10px">'+fnSeg("ffvis",[["cat","Por categoria"],["anb","Por tipo ANBIMA"]],FF.vis)+fnSeg("ffper",[[3,"3 meses"],[12,"12 meses"],[36,"36 meses"]],FF.per)+'</div>';
  const D=FF.d,M=D.meses,n=M.length,ult=n-2;  // último mês completo (o último da lista é o corrente, parcial)
  const G=FF.vis==="anb"?D.anbima:D.grupos,per=Math.min(FF.per,ult+1);
  const s=(a,i0,i1)=>{let t=0;for(let i=i0;i<=i1;i++)t+=a[i]||0;return t};
  const L=Object.entries(G).map(([k,g])=>({k,pl:g.pl[ult],n:g.n[ult],m:g.cap[ult],p:s(g.cap,ult-per+1,ult),cur:g.cap[n-1],g})).filter(x=>x.pl>=1e8||Math.abs(x.p)>=1e8);
  const T={pl:L.reduce((a,x)=>a+x.pl,0),p:L.reduce((a,x)=>a+x.p,0),m:L.reduce((a,x)=>a+x.m,0),n:L.reduce((a,x)=>a+x.n,0)};
  const mlab=i=>{const [y,m]=M[i].split("-");return FF_MES[+m-1]+"/"+y.slice(2)};
  const sg=v=>'<span class="'+(v>0?'pos':v<0?'neg':'')+'">'+(v>0?'+':'')+fnMoney(v)+'</span>';
  let h='<section class="panel"><div class="fnkpis">'
    +tecKp("Captação líquida em "+per+(per>1?" meses":" mês"),sg(T.p),'até '+mlab(ult))
    +tecKp("Captação em "+mlab(ult),sg(T.m),'mês completo mais recente')
    +tecKp("Patrimônio",fnMoney(T.pl),fx(T.n,0)+' fundos em '+mlab(ult))
    +tecKp("Captação no ano",sg(L.reduce((a,x)=>a+s(x.g.cap,M.findIndex(z=>z.startsWith(M[ult].slice(0,4))),ult),0)),'janeiro a '+mlab(ult))+'</div>';
  // gráfico: captação acumulada no período por grupo (as 6 maiores em valor absoluto)
  const top=L.slice().sort((a,b)=>Math.abs(b.p)-Math.abs(a.p)).slice(0,6);
  const t=i=>{const [y,m]=M[i].split("-");return Date.UTC(+y,+m-1,15)};
  h+='<div class="label">Captação líquida acumulada no período (R$ bilhões)</div>'+fnChart(top.map((x,j)=>{let acc=0;const pts=[];for(let i=ult-per+1;i<=ult;i++){acc+=x.g.cap[i]||0;pts.push([t(i),acc/1e9])}return {lab:x.k,col:FN_COLS[j%FN_COLS.length],w:2,pts}}),{fmt:"num",months:true,aria:"Captação acumulada"});
  const tot=[];for(let i=ult-per+1;i<=ult;i++)tot.push([t(i),L.reduce((a,x)=>a+(x.g.cap[i]||0),0)/1e9]);
  h+='<div class="label" style="margin-top:10px">Captação líquida de todos os fundos, mês a mês (R$ bilhões)</div>'+fnChart([{lab:"Captação líquida",col:"var(--accent)",pts:tot}],{fmt:"num",bars:true,zero:true,h:170,months:true,aria:"Captação mensal"});
  // tabela
  L.sort((a,b)=>b.p-a.p);
  h+='<div class="tablewrap" style="max-height:none;margin-top:10px"><table class="ctab"><thead><tr><th style="text-align:left">'+(FF.vis==="anb"?"Tipo ANBIMA":"Categoria")+'</th><th>Patrimônio</th><th>'+mlab(ult)+'</th><th>'+per+(per>1?' meses':' mês')+'</th><th class="c-ph">% do patrimônio</th><th class="c-ph">Fundos</th><th class="c-ph c-sm">'+mlab(n-1)+' <small>(parcial)</small></th></tr></thead><tbody>'
    +L.map(x=>'<tr><td style="text-align:left">'+esc(x.k)+'</td><td>'+fnMoney(x.pl)+'</td><td>'+sg(x.m)+'</td><td><b>'+sg(x.p)+'</b></td><td class="c-ph">'+(x.pl?fnPct(x.p/x.pl*100):'—')+'</td><td class="c-ph">'+fx(x.n,0)+'</td><td class="c-ph c-sm">'+sg(x.cur)+'</td></tr>').join("")
    +'</tbody></table></div>';
  h+='<p class="sub" style="font-size:.8rem">Fonte: CVM, informes diários e cadastro de '+fx(D.fundos,0)+' fundos de investimento (FIF), somados pelo robô em '+fdate(Date.parse(D.geradoEm))+'. Ficam de fora os '+fx(D.fic_fora,0)+' fundos de cotas, cujo dinheiro já aparece nos fundos em que aplicam. Previdência (PGBL, VGBL e FAPI) é um grupo à parte. O mês corrente é parcial.'+(FF.vis==="anb"?' Tipos ANBIMA: os '+Object.keys(D.anbima).length+' de maior patrimônio.':'')+'</p></section>';
  b.innerHTML=h;
}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-ffvis],[data-ffper]");if(!x)return;if(x.dataset.ffvis)FF.vis=x.dataset.ffvis;if(x.dataset.ffper)FF.per=+x.dataset.ffper;ffTela()});
