/* ---------- relatório mensal do cliente: a posição real da carteira (aplicações e resgates informados) num mês
   Usa o mesmo cálculo da "Posição atual" (spPosCalc): rentabilidade por cotas, CDI, patrimônio e movimentações.
   O cliente aparece pelo código ou apelido; o nome completo só é digitado na hora do PDF e não fica salvo. */
let SP_POS=null;   // última posição calculada {c, X}
const RM_MES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const rmNome=m=>RM_MES[+m.slice(5,7)-1]+" de "+m.slice(0,4);
function rmMeses(X){const L=[];let y=+X.d0.slice(0,4),m=+X.d0.slice(5,7);const yF=+X.dv.slice(0,4),mF=+X.dv.slice(5,7);
  while(y<yF||(y===yF&&m<=mF)){L.push(y+"-"+String(m).padStart(2,"0"));m++;if(m>12){m=1;y++}}return L.reverse()}
function rmSel(X){const L=rmMeses(X);return '<div class="fnacts rmacts"><label class="sub" for="rmMes">Relatório mensal do cliente:</label><select id="rmMes">'+L.map(m=>'<option value="'+m+'">'+rmNome(m)+(m===X.dv.slice(0,7)?' (até '+fdate(Date.parse(X.dv+"T00:00:00Z")).slice(0,5)+')':'')+'</option>').join("")+'</select><button type="button" class="btn sec" data-rel="mes">Gerar PDF</button></div>'}
/* ponto da série (pts) no fim de um dia: o último com data ≤ d */
function rmPt(pts,d){let r=null;for(const p of pts){if(p.d<=d)r=p;else break}return r}
function rmVar(S,a,b){const x=spAt(S,a),y=spAt(S,b);return x&&y&&x[1]?(y[1]/x[1]-1)*100:null}
function rmHtml(c,X,mes){
  const {P,T,pts}=X,ini=mes+"-01",d1=new Date(Date.UTC(+mes.slice(0,4),+mes.slice(5,7),0)).toISOString().slice(0,10),fim=d1<X.dv?d1:X.dv;
  const vesp=new Date(Date.parse(ini+"T00:00:00Z")-DAY).toISOString().slice(0,10),jan=mes.slice(0,4)+"-01-01",vjan=(+mes.slice(0,4)-1)+"-12-31";
  const pF=rmPt(pts,fim),pI=rmPt(pts,vesp)||{idx:1,v:0,d:X.d0},pA=rmPt(pts,vjan)||{idx:1,v:0,d:X.d0};
  if(!pF)return '<section class="panel"><p class="warn">Sem dados da carteira em '+rmNome(mes)+'.</p></section>';
  const rM=(pF.idx/pI.idx-1)*100,rA=(pF.idx/pA.idx-1)*100,rT=(pF.idx-1)*100;
  const base=d=>d<X.d0?X.d0:d,cM=rmVar(T.cdiS,base(vesp),fim),cA=rmVar(T.cdiS,base(vjan),fim),cT=rmVar(T.cdiS,X.d0,fim);
  const fl=[];P.forEach(p=>p.mv.forEach(m=>{if(m.d>=ini&&m.d<=fim)fl.push({d:m.d,n:spItemNome(p.x),v:m.v})}));fl.sort((a,b)=>a.d<b.d?-1:1);
  const liqF=fl.reduce((a,m)=>a+m.v,0),ganho=pF.v-pI.v-liqF;
  const pc=v=>v==null||!isFinite(v)?'—':fnPct(v),pcd=(r,c0)=>r!=null&&c0>0&&r>0?fx(r/c0*100,0)+'% do CDI':c0!=null?'CDI '+fnPctT(c0):'';
  const kp=(a,b,cc)=>'<div class="fnkp"><span>'+a+'</span><b>'+b+'</b>'+(cc?'<small>'+cc+'</small>':'')+'</div>';
  let h='<section class="panel" data-reltit="Resumo do mês"><h3>Resumo de '+rmNome(mes)+'</h3><p class="sub">Carteira '+esc(c.nome)+(c.cli?' · cliente '+esc(c.cli):'')+', de '+fdate(Date.parse((ini<X.d0?X.d0:ini)+"T00:00:00Z"))+' a '+fdate(Date.parse(fim+"T00:00:00Z"))+'.</p>';
  h+='<div class="fnkpis">'+kp("Patrimônio no fim do mês",brl(pF.v),'no início '+brl(pI.v))+kp("Ganho no mês",'<span class="'+(ganho>=0?'pos':'neg')+'">'+brl(ganho)+'</span>',fl.length?'aplicações e resgates no mês: '+brl(liqF):'sem aplicações nem resgates')
    +kp("Rentabilidade no mês",pc(rM),pcd(rM,cM))+kp("No ano",pc(rA),pcd(rA,cA))+kp("Desde o início",pc(rT),pcd(rT,cT))+'</div>';
  // gráfico do ano: carteira × CDI
  const pa=pts.filter(p=>p.d>=(pA.d||X.d0)&&p.d<=fim),c0=spAt(T.cdiS,pa.length?pa[0].d:X.d0);
  if(pa.length>2){const S=[{lab:"Carteira",col:FN_COLS[0],w:2.2,pts:pa.map(p=>[p.t,(p.idx/pa[0].idx-1)*100])}];
    if(c0)S.push({lab:"CDI",col:FN_BM.cdi.col,w:1.5,pts:pa.map(p=>{const x=spAt(T.cdiS,p.d);return [p.t,x?(x[1]/c0[1]-1)*100:null]})});
    h+='<div class="label" style="margin-top:8px">Rentabilidade acumulada em '+mes.slice(0,4)+'</div>'+fnChart(S,{fmt:"pct",zero:true,h:200,aria:"Rentabilidade no ano"})}
  h+='</section>';
  // itens
  const cot=(p,d)=>p.mv.reduce((a,m)=>{if(m.d>d)return a;const lv=spAt(p.S,m.d);return lv?a+m.v/lv[1]:a},0);
  const rows=P.map(p=>{const lvF=spAt(p.S,fim),qF=cot(p,fim),vF=lvF?Math.max(0,qF)*lvF[1]:0,m1=p.mv.find(m=>m.d>=ini&&m.d<=fim),dI=p.mv[0].d<ini?vesp:(m1?m1.d:null);
    return {n:spItemNome(p.x),vF,r:dI&&p.mv[0].d<=fim?rmVar(p.S,dI,fim):null,ra:p.mv[0].d<=fim?rmVar(p.S,p.mv[0].d<jan?vjan:p.mv[0].d,fim):null}}).filter(r=>r.vF>0.005||r.r!=null);
  const tot=rows.reduce((a,r)=>a+r.vF,0)||1;
  h+='<section class="panel" data-reltit="Composição e rentabilidade por item"><h3>Composição no fim do mês</h3><div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th>Valor</th><th>Peso</th><th>No mês</th><th>No ano</th></tr></thead><tbody>'
    +rows.sort((a,b)=>b.vF-a.vF).map(r=>'<tr><td style="text-align:left" class="tw">'+esc(r.n)+'</td><td>'+brl(r.vF)+'</td><td>'+fx(r.vF/tot*100,1)+'%</td><td>'+pc(r.r)+'</td><td>'+pc(r.ra)+'</td></tr>').join("")
    +'<tr class="cmpbm"><td style="text-align:left"><b>Carteira</b></td><td><b>'+brl(pF.v)+'</b></td><td>100%</td><td><b>'+pc(rM)+'</b></td><td><b>'+pc(rA)+'</b></td></tr></tbody></table></div><p class="sub" style="font-size:.8rem;margin-top:6px">Rentabilidade de cada item pela cota ou cotação (com proventos reinvestidos nos ativos da Bolsa) no período em que esteve na carteira; a da carteira é por cotas (TWR), sem o efeito do momento das aplicações e resgates. Valores brutos de IR.</p></section>';
  // movimentações
  h+='<section class="panel" data-reltit="Movimentações do mês"><h3>Aplicações e resgates no mês</h3>'+(fl.length?'<div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th>Data</th><th>Valor</th></tr></thead><tbody>'+fl.map(m=>'<tr><td style="text-align:left" class="tw">'+esc(m.n)+'</td><td>'+fdate(Date.parse(m.d+"T00:00:00Z"))+'</td><td class="'+(m.v>=0?'':'neg')+'">'+(m.v>=0?'Aplicação ':'Resgate ')+brl(Math.abs(m.v))+'</td></tr>').join("")+'</tbody></table></div>':'<p class="sub">Nenhuma aplicação ou resgate no mês.</p>')+'</section>';
  // mercado no mês
  if(EU.S){const L=[["CDI","cdi"],["Ibovespa","ibov"],["IFIX","ifix"],["Dólar (PTAX)","usd"],["S&P 500","spx"],["S&P 500 em reais","spxbrl"]].map(([n,k])=>{const S=EU.S[k];if(!S||!S.length)return null;
      const at=d=>{let r=null;const t=Date.parse(d+"T00:00:00Z");for(const p of S){if(p[0]<=t)r=p;else break}return r},a=at(vesp),b=at(fim);return a&&b&&a[1]?[n,(b[1]/a[1]-1)*100]:null}).filter(Boolean);
    if(L.length)h+='<section class="panel" data-reltit="O mercado no mês"><h3>O mercado em '+rmNome(mes)+'</h3><div class="fnkpis">'+L.map(([n,v])=>kp(n,pc(v))).join("")+'</div><p class="sub" style="font-size:.8rem;margin-top:6px">Variação no mês. Fontes: B3 (Ibovespa e IFIX), Banco Central (CDI e dólar PTAX) e Cboe (S&amp;P 500).</p></section>'}
  else euBoot();
  return h}
