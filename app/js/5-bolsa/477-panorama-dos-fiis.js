/* ---------- Bolsa › FIIs: panorama dos fundos imobiliários, Fiagros e FI-Infra por segmento, descontos e prêmio sobre o Tesouro IPCA+ */
const FII_ST={tipo:"FII",liq:5e5};
function fiiMed(a){const v=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y);if(!v.length)return null;const m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2}
function fiiNtnb5(){try{const v=realAt(VAL+5*365.25*DAY);return isFinite(v)?v:null}catch(e){return null}}
function fiiTela(){
  const o=$("fnOut");if(!o)return;
  if(FN.view!=="af"){FN.view="af";o.innerHTML='<section class="panel"><h3>Fundos imobiliários</h3><p class="sub">Panorama dos fundos listados na B3: rendimento, preço sobre o valor patrimonial e liquidez por segmento, os que negociam com desconto e quanto o rendimento paga acima do Tesouro IPCA+.</p><div id="fiiCtl"></div></section><div id="fiiBody"></div>'}
  const b=$("fiiBody");if(!b)return;
  if(!AT.idx){b.innerHTML='<section class="panel"><p class="sub">'+(AT.err?'A base de ativos ainda não está disponível.':'Carregando a base de ativos da B3…')+'</p></section>';if(!AT.err)atBoot();return}
  const I=AT.idx,C=AT.C,st=FII_ST;
  $("fiiCtl").innerHTML='<div style="display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:10px">'+fnSeg("fiitp",[["FII","FII"],["Fiagro","Fiagro"],["FI-Infra","FI-Infra"]],st.tipo)+fnSeg("fiiliq",[[0,"Qualquer liquidez"],[5e5,"R$ 500 mil/dia ou mais"],[2e6,"R$ 2 mi/dia ou mais"]],st.liq)+'</div>';
  const R=I.rows.filter(r=>r[C.tipo]===st.tipo&&(r[C.liq]||0)>=st.liq&&r[C.preco]);
  if(!R.length){b.innerHTML='<section class="panel"><p class="sub">Nenhum fundo com esses filtros.</p></section>';return}
  const dyOk=r=>r[C.dy]!=null&&r[C.dy]>0&&r[C.dy]<30;   // rendimentos acima de 30% ao ano costumam ser amortização ou evento único
  const seg=r=>{const s=I.setores[r[C.setor]];return s&&s!==st.tipo&&!/n[ãa]o classificad/i.test(s)?s:"Sem segmento informado"};
  const mDy=fiiMed(R.filter(dyOk).map(r=>r[C.dy])),mPvp=fiiMed(R.map(r=>r[C.pvp])),nb=fiiNtnb5();
  let h='<section class="panel"><div class="fnkpis">'
    +tecKp("Fundos",fx(R.length,0),'com os filtros escolhidos')
    +tecKp("Rendimento mediano (12 meses)",mDy!=null?fx(mDy,2)+'%':'—','proventos ÷ cotação')
    +tecKp("P/VP mediano",mPvp!=null?fx(mPvp,2):'—',mPvp!=null?(mPvp<1?'desconto de '+fx((1-mPvp)*100,0)+'% sobre o patrimônio':'ágio de '+fx((mPvp-1)*100,0)+'% sobre o patrimônio'):'')
    +tecKp("Prêmio sobre o Tesouro IPCA+",mDy!=null&&nb!=null?(mDy-nb>=0?'+':'')+fx(mDy-nb,2)+' p.p.':'—',nb!=null?'IPCA+ 5 anos: '+fx(nb,2)+'% ao ano':'')+'</div>';
  // por segmento
  const G=new Map();R.forEach(r=>{const k=seg(r);let g=G.get(k);if(!g){g={k,s:r[C.setor],L:[]};G.set(k,g)}g.L.push(r)});
  const S=[...G.values()].map(g=>({k:g.k,s:g.s,n:g.L.length,dy:fiiMed(g.L.filter(dyOk).map(r=>r[C.dy])),pvp:fiiMed(g.L.map(r=>r[C.pvp])),r12:fiiMed(g.L.map(r=>r[C.r12])),liq:g.L.reduce((a,r)=>a+(r[C.liq]||0),0),mc:g.L.reduce((a,r)=>a+(r[C.mcap]||0),0)})).sort((a,b)=>b.mc-a.mc);
  h+='<div class="label">Por segmento (medianas)</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Segmento</th><th>Fundos</th><th>Rendimento 12m</th><th>P/VP</th><th class="c-ph">Retorno 12m</th><th class="c-ph">Liquidez/dia</th><th class="c-ph c-sm">Valor de mercado</th></tr></thead><tbody>'
    +S.map(x=>'<tr><td style="text-align:left">'+(x.s!=null&&x.k!=="Sem segmento informado"?'<button type="button" class="link" data-atrkcat="'+esc(st.tipo)+'|'+x.s+'">'+esc(x.k)+'</button>':esc(x.k))+'</td><td>'+x.n+'</td><td>'+(x.dy!=null?fx(x.dy,2)+'%':'—')+'</td><td>'+(x.pvp!=null?fx(x.pvp,2):'—')+'</td><td class="c-ph">'+fnPct(x.r12)+'</td><td class="c-ph">'+fnMoney(x.liq)+'</td><td class="c-ph c-sm">'+(x.mc?fnMoney(x.mc):'—')+'</td></tr>').join("")+'</tbody></table></div>';
  // listas
  const segDy=new Map(S.map(x=>[x.k,x.dy]));
  const linha=r=>'<button type="button" class="fnri" data-atopen="'+r[0]+'"><b>'+r[0]+' · '+esc(r[1])+'</b><small>'+esc(seg(r))+' · rendimento '+(r[C.dy]!=null?fx(r[C.dy],2)+'%':'—')+' · P/VP '+(r[C.pvp]!=null?fx(r[C.pvp],2):'—')+' · liquidez '+fnMoney(r[C.liq])+'/dia</small></button>';
  const bloco=(tt,sub,L)=>'<section class="panel"><div class="label">'+tt+'</div><p class="sub" style="font-size:.82rem;margin:2px 0 6px">'+sub+'</p><div class="fnlist">'+(L.length?L.map(linha).join(""):'<p class="sub">Nenhum fundo com esses critérios.</p>')+'</div></section>';
  const desc=R.filter(r=>r[C.pvp]!=null&&r[C.pvp]<=0.95&&dyOk(r)&&segDy.get(seg(r))!=null&&r[C.dy]>=segDy.get(seg(r))).sort((a,b)=>a[C.pvp]-b[C.pvp]).slice(0,10);
  const agio=R.filter(r=>r[C.pvp]!=null&&r[C.pvp]>=1.1).sort((a,b)=>b[C.pvp]-a[C.pvp]).slice(0,10);
  const topDy=R.filter(dyOk).sort((a,b)=>b[C.dy]-a[C.dy]).slice(0,10);
  h+='</section>'+bloco("Com desconto e rendimento acima do segmento","P/VP de até 0,95 e rendimento de 12 meses maior que a mediana do próprio segmento. Desconto grande pode refletir risco (vacância, inadimplência, dívida): leia os relatórios do fundo.",desc)
    +bloco("Maiores rendimentos em 12 meses","Rendimentos acima de 30% ao ano ficam de fora, porque costumam ser amortização ou evento único.",topDy)
    +bloco("Negociando com ágio","P/VP de 1,10 ou mais: o mercado paga acima do valor patrimonial informado à CVM.",agio);
  h+='<section class="panel"><p class="sub" style="font-size:.8rem">Fontes: B3 (cotações e proventos) e CVM (informe mensal: valor patrimonial da cota e segmento). Rendimento: proventos dos últimos 12 meses ÷ cotação atual. Prêmio sobre o Tesouro IPCA+: rendimento mediano menos o juro real de 5 anos da ANBIMA (os rendimentos dos FIIs são isentos de IR para pessoa física e costumam acompanhar a inflação dos aluguéis). Dados de '+fdate(Date.parse(I.dt+"T00:00:00Z"))+'.</p></section>';
  b.innerHTML=h;
}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-fiitp],[data-fiiliq]");if(!x)return;if(x.dataset.fiitp)FII_ST.tipo=x.dataset.fiitp;if(x.dataset.fiiliq!=null)FII_ST.liq=+x.dataset.fiiliq;fiiTela()});
