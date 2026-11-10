/* ---------- Carteira › Imposto e liquidez: IR se vendesse hoje, próximo come-cotas, prejuízos para compensar e
   isenção de R$ 20 mil em ações; quanto da carteira vira dinheiro em 1, 5, 30 e 90 dias; quanto a carteira perde se os
   juros subirem 1 ponto; e (na subaba Crédito) a exposição somada por grupo econômico. */
function spFnRow(cnpj){if(!FN.idx)return null;if(!FN.byC){FN.byC=new Map();FN.idx.rows.forEach(r=>FN.byC.set(r[0],r))}return FN.byC.get(cnpj)||null}
function spComeCotas(dv){ // último dia útil de maio e de novembro: o próximo e o último
  const d=new Date(Date.parse(dv+"T00:00:00Z")),y=d.getUTCFullYear(),u=(yy,m)=>{let t=Date.UTC(yy,m+1,0);while(!isBiz(t))t-=DAY;return t};
  const L=[u(y-1,10),u(y,4),u(y,10),u(y+1,4)],t=d.getTime();return {ult:L.filter(x=>x<=t).pop(),prox:L.find(x=>x>t)};
}
function spIrHtml(c,it){
  const X=SP_POS&&SP_POS.c===c&&SP_POS.X&&!SP_POS.X.erro?SP_POS.X:null;
  let h='<section class="panel" data-reltit="Imposto da carteira"><h3>Imposto da carteira</h3>';
  if(!X)return h+'<p class="sub">Informe as aplicações de cada item (datas e valores) em Composição para o app calcular o imposto de verdade: IR se vendesse hoje, próximo come-cotas e prejuízos que podem ser compensados.</p></section>';
  const cc=spComeCotas(X.dv),reg={lp:"Fundo de longo prazo",cp:"Fundo de curto prazo",acoes:"Ações e fundos de ações",fii:"Fundos imobiliários",rf:"Renda fixa (tabela regressiva)",isento:"Isento",prev:"Previdência"};
  const L=X.P.map(p=>{const g=p.v-p.custo;let come=0;
    if((p.D.reg==="lp"||p.D.reg==="cp")&&p.p!==0&&cc.ult){const lu=spAt(p.S,new Date(cc.ult).toISOString().slice(0,10));p.lotes.forEach(l=>{const base=Math.max(l.lv,lu?lu[1]:0);if(p.lvF>base)come+=l.q*(p.lvF-base)*(p.D.reg==="lp"?0.15:0.2)})}
    return {p,g,come,nm:spItemNome(p.x),reg:p.D.reg}});
  const tot={v:0,ir:0,come:0};L.forEach(x=>{tot.v+=x.p.v;tot.ir+=x.p.ir;tot.come+=x.come});
  const perdaAc=L.filter(x=>x.reg==="acoes"&&x.p.x.t==="a"&&x.g<0).reduce((a,x)=>a-x.g,0),perdaFii=L.filter(x=>x.reg==="fii"&&x.g<0).reduce((a,x)=>a-x.g,0);
  const ganhoAc=L.filter(x=>x.reg==="acoes"&&x.p.x.t==="a"&&x.g>0);
  h+='<div class="fnkpis">'+tecKp("IR se vendesse tudo hoje <span class=\"tag est\" title=\"aproximação: veja a nota no fim do bloco\">estimado</span>",brl(tot.ir),tot.v>0?fx(tot.ir/tot.v*100,2)+'% do patrimônio':'')
    +tecKp("Próximo come-cotas",tot.come>0?brl(tot.come):'R$ 0',cc.prox?'estimado para '+fdate(cc.prox):'')
    +(perdaAc||perdaFii?tecKp("Prejuízo que pode compensar",brl(perdaAc+perdaFii),(perdaAc?'ações '+brl(perdaAc):'')+(perdaAc&&perdaFii?' · ':'')+(perdaFii?'FIIs '+brl(perdaFii):'')):'')+'</div>';
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th style="text-align:left" class="c-ph">Tributação</th><th>Valor</th><th>Ganho</th><th>IR se vender hoje</th><th class="c-ph">Come-cotas</th></tr></thead><tbody>'
    +L.sort((a,b)=>b.p.ir-a.p.ir).map(x=>'<tr><td style="text-align:left" class="tw">'+esc(x.nm).slice(0,46)+'</td><td style="text-align:left" class="c-ph"><small>'+(reg[x.reg]||x.reg||"—")+'</small></td><td>'+brl(x.p.v)+'</td><td><span class="'+(x.g<0?'neg':'pos')+'">'+brl(x.g)+'</span></td><td>'+(x.p.ir?brl(x.p.ir):'—')+'</td><td class="c-ph">'+(x.come?brl(x.come):'—')+'</td></tr>').join("")+'</tbody></table></div>';
  const dic=[];
  if(ganhoAc.length)dic.push('Vendas de ações (não vale para FIIs, ETFs e BDRs) que somem até R$ 20 mil no mês são isentas de IR: dá para realizar parte do lucro de '+ganhoAc.slice(0,3).map(x=>esc(x.p.x.k)).join(", ")+' sem imposto, respeitando esse limite por mês.');
  if(perdaAc)dic.push('Há '+brl(perdaAc)+' de prejuízo em ações. Vender e recomprar realiza o prejuízo, que pode abater lucros futuros em ações (o prejuízo não vence). O mesmo vale para FIIs, mas só contra lucro de FIIs.');
  if(tot.come>0)dic.push('O come-cotas antecipa o IR dos fundos em maio e novembro (15% nos de longo prazo, 20% nos de curto). Ele reduz a quantidade de cotas; o valor fica abatido do IR no resgate.');
  if(dic.length)h+='<ul class="tecler" style="margin-top:10px">'+dic.map(d=>'<li>'+d+'</li>').join("")+'</ul>';
  h+=spVendaHtml(X);
  return h+'<p class="sub" style="font-size:.8rem">Estimativa por lote de aplicação, com a tabela regressiva (22,5% a 15%) na renda fixa e nos fundos de longo prazo, 15% em ações e 20% no ganho de capital de FIIs; isentos: LCI, LCA, CRI, CRA, debêntures incentivadas e rendimentos de FIIs. IOF regressivo dos primeiros 30 dias incluído; regras de previdência (tabela progressiva ou regressiva escolhida no plano) não entram. Confirme com o informe de rendimentos.</p></section>';
}
function spLiqDias(x,v){ // dias para virar dinheiro na conta, aproximado
  if(spTd(x))return 1;
  if(x.t==="f"){const r=spFnRow(x.k),C=FN.C;const d=r&&C.dres!=null?r[C.dres]:null;return d!=null?Math.max(0,d):30}
  if(x.t==="a"){const r=AT.idx?atRow(x.k):null,liq=r?r[AT.C.liq]:null;if(!liq)return 30;return Math.max(2,Math.ceil(v/(liq*0.2))+1)}  // vende até 20% do volume do dia sem derrubar o preço
  const p=spProd(x);if(p==="Poupança")return 0;
  if(p&&/^(Debênture|CRI|CRA)$/.test(p)){const cod=String(x.k||"").replace(/^cr:/,""),n=typeof FT!=="undefined"&&FT.neg&&FT.neg.p[cod];return n&&n[2]>=10?5:n?30:9999}
  if(x.liqd)return 1;
  const vc=spVenc(x);if(vc&&vc.d){const dd=Math.round((Date.parse(vc.d+"T00:00:00Z")-Date.now())/DAY);return Math.max(1,dd)}
  return 9999;
}
function spLiqHtml(c,it){
  const {w,tot,real}=spPesos(c,it);if(!it.length)return "";
  const F=[[1,"1 dia"],[5,"5 dias"],[30,"30 dias"],[90,"90 dias"],[365,"1 ano"]],S=F.map(()=>0),L=[];
  it.forEach((x,i)=>{const v=w[i]*(tot||1);if(!(v>0))return;const d=spLiqDias(x,v);L.push({x,v,d});F.forEach((f,k)=>{if(d<=f[0])S[k]+=w[i]})});
  const lt=L.filter(x=>x.d>90).sort((a,b)=>b.v-a.v);
  let h='<section class="panel" data-reltit="Liquidez da carteira"><h3>Liquidez da carteira</h3><p class="sub">Quanto da carteira vira dinheiro na conta em cada prazo, pelo prazo de resgate dos fundos, pela liquidez diária das ações e pelo vencimento ou negociação no secundário da renda fixa.</p>'
    +'<div class="fnkpis">'+F.map((f,k)=>tecKp("Em até "+f[1]+(k===0?' <span class="tag est" title="aproximação: veja a nota no fim do bloco">estimado</span>':''),fx(S[k]*100,0)+'%',real&&tot?brl(S[k]*tot):'')).join("")+'</div>';
  if(lt.length)h+='<div class="label" style="margin-top:8px">Itens que levam mais de 90 dias</div><div class="tablewrap" style="max-height:none"><table class="ctab"><tbody>'
    +lt.slice(0,10).map(x=>'<tr><td style="text-align:left" class="tw">'+esc(spItemNome(x.x)).slice(0,50)+'</td><td>'+(x.d>=9999?'só no vencimento':'cerca de '+fx(x.d,0)+' dias')+'</td><td>'+fx(x.v/(tot||1)*100,1)+'%</td></tr>').join("")+'</tbody></table></div>';
  return h+'<p class="sub" style="font-size:.8rem">Aproximação: fundos pelo prazo de cotização e pagamento do resgate na CVM; ações vendendo até 20% do volume médio diário; Tesouro em 1 dia; CDB, LCI e LCA só no vencimento (marque "liquidez diária" no item quando houver); debêntures, CRI e CRA pelo número de dias com negócios no secundário.</p></section>';
}
function spJurosHtml(c,it){
  const {w,tot,real}=spPesos(c,it);const G={pre:{v:0,d:0},ipca:{v:0,d:0}},now=Date.now();
  it.forEach((x,i)=>{const v=w[i]*(tot||1);if(!(v>0))return;let tp=null,anos=null,cupom=false;
    const td=spTd(x);if(td){tp=/^(LTN|NTNF)$/.test(td.kind)?"pre":/^(NTNB|NTNBP|RENDA|EDUCA)$/.test(td.kind)?"ipca":null;anos=(td.mat-now)/DAY/365.25;cupom=/^(NTNF|NTNB|RENDA|EDUCA)$/.test(td.kind)}
    else if(x.t==="s"&&(x.rf==="pre"||x.rf==="ipca")){tp=x.rf;const vc=spVenc(x);anos=vc&&vc.d?(Date.parse(vc.d+"T00:00:00Z")-now)/DAY/365.25:null}
    if(!tp||!(anos>0))return;const tx=tp==="pre"?14:7.5,dur=(cupom?anos*0.65:anos)/(1+tx/100);G[tp].v+=v;G[tp].d+=v*dur});
  const it2=["pre","ipca"].filter(k=>G[k].v>0);if(!it2.length)return "";
  const lin=k=>{const g=G[k],d=g.d/g.v,perda=g.d*0.01;return '<tr><td style="text-align:left">'+(k==="pre"?"Prefixados":"Atrelados ao IPCA (juro real)")+'</td><td>'+fx(g.v/(tot||1)*100,1)+'%</td><td>'+fx(d,1)+' anos</td><td><span class="neg">−'+(real&&tot?brl(perda):fx(perda/(tot||1)*100,2)+'% da carteira')+'</span></td><td><span class="pos">+'+(real&&tot?brl(perda):fx(perda/(tot||1)*100,2)+'%')+'</span></td></tr>'};
  const tp=it2.reduce((a,k)=>a+G[k].d*0.01,0);
  return '<section class="panel" data-reltit="Sensibilidade a juros"><h3>Sensibilidade a juros</h3><p class="sub">Quanto o valor de mercado dos títulos prefixados e de inflação muda se as taxas subirem ou caírem 1 ponto percentual (marcação a mercado). Quem leva até o vencimento recebe a taxa contratada; a variação importa para quem vende antes.</p>'
    +'<div class="fnkpis">'+tecKp("Se os juros subirem 1 ponto <span class=\"tag est\" title=\"aproximação: veja a nota no fim do bloco\">estimado</span>",'<span class="neg">−'+(real&&tot?brl(tp):fx(tp/(tot||1)*100,2)+'%')+'</span>','perda na marcação a mercado')+tecKp("Se caírem 1 ponto",'<span class="pos">+'+(real&&tot?brl(tp):fx(tp/(tot||1)*100,2)+'%')+'</span>','ganho na marcação a mercado')+'</div>'
    +'<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Grupo</th><th>Peso</th><th>Duração média</th><th>Juros +1 ponto</th><th>Juros −1 ponto</th></tr></thead><tbody>'+it2.map(lin).join("")+'</tbody></table></div>'
    +'<p class="sub" style="font-size:.8rem">Duração modificada aproximada pelo prazo até o vencimento (títulos com cupom: cerca de 65% do prazo). Pós-fixados (CDI, Selic) quase não oscilam com a curva. Fundos de renda fixa e multimercados ficam no teste de estresse (subaba Risco), que usa a sensibilidade histórica de cada fundo.</p></section>';
}
function spGrupoHtml(c,it){ // exposição somada por grupo econômico: conglomerado (IF.data), raiz do CNPJ (emissores e companhias) ou nome
  const {w,tot,real}=spPesos(c,it),G=new Map();
  it.forEach((x,i)=>{const v=w[i];if(!(v>0))return;let k=null,nm=null;
    const EMP=(typeof RT==="object"&&RT.emp)||INS.emp;if(x.t==="a"&&EMP){const raiz=String(x.k).slice(0,4),e=EMP[raiz];if(e&&e.cnpj){k="cnpj:"+e.cnpj.slice(0,8);nm=nomeCx(e.nome||raiz)}}
    else if(x.t==="s"&&!spTd(x)){const em=spEmissor(x);if(!em||/não informado/.test(em))return;
      const b=typeof bkAcha==="function"?bkAcha(em):null;if(b){k="bk:"+b.cod;nm=nomeCx((b.n||[])[0]||em)}
      else{const cod=String(x.k||"").replace(/^cr:/,""),P=typeof PAPERS!=="undefined"&&PAPERS[cod],cn=P&&P.ficha&&P.ficha.cnpj;k=cn?"cnpj:"+cn.slice(0,8):"nm:"+bkNome(em);nm=nomeCx(em)}}
    if(!k)return;const g=G.get(k)||{nm,v:0,itens:[]};g.v+=v;g.itens.push(spItemNome(x));G.set(k,g)});
  const L=[...G.values()].filter(g=>g.itens.length>1||g.v>0.1).sort((a,b)=>b.v-a.v);if(!L.length)return "";
  return '<section class="panel" data-reltit="Crédito: grupos econômicos"><h3>Crédito: exposição por grupo econômico</h3><p class="sub">Soma do que a carteira tem no mesmo grupo: títulos bancários do mesmo conglomerado, debêntures e ações da mesma empresa (raiz do CNPJ). Concentração alta num só grupo amplia o estrago se ele tiver problemas.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Grupo</th><th>Peso</th>'+(real&&tot?'<th>Valor</th>':'')+'<th style="text-align:left">Itens</th></tr></thead><tbody>'
    +L.slice(0,15).map(g=>'<tr><td style="text-align:left">'+esc(g.nm)+'</td><td><span class="'+(g.v>0.15?'neg':'')+'">'+fx(g.v*100,1)+'%</span></td>'+(real&&tot?'<td>'+brl(g.v*tot)+'</td>':'')+'<td style="text-align:left"><small>'+g.itens.map(esc).join("; ").slice(0,160)+'</small></td></tr>').join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem">Bancos agrupados pelo conglomerado prudencial do Banco Central (IF.data); empresas pela raiz do CNPJ. Acima de 15% num só grupo aparece em vermelho. Fundos não entram (a exposição deles está no raio-X).</p></section>';
}

/* venda com menos imposto: para levantar um valor, vende primeiro os lotes que pagam menos IR por real vendido */
const SPV={v:""};
function spVendaHtml(X){
  let h='<div class="label" style="margin-top:12px">Preciso resgatar: venda com menos imposto</div><div class="fnfilt"><div class="field"><label for="spVenda">Valor que precisa (R$)</label><input id="spVenda" data-spvenda="1" inputmode="decimal" value="'+esc(SPV.v)+'" placeholder="ex.: 50.000"></div></div>';
  const alvo=num(String(SPV.v||""));if(!alvo||alvo<=0)return h+'<p class="sub" style="font-size:.82rem">O app escolhe os lotes que pagam menos IR por real vendido, entre os itens que viram dinheiro em até 5 dias.</p>';
  const dv=X.dv,L=[];
  X.P.forEach(p=>{if(spLiqDias(p.x,p.v)>5)return;p.lotes.forEach(l=>{const dias=(Date.parse(dv)-Date.parse(l.d))/DAY,val=l.q*p.lvF;if(!(val>0))return;const g=val-l.custo,ir=g>0?g*spAliq(p.D.reg,dias):0;L.push({p,val,ir,g,taxa:ir/val,d:l.d})})});
  L.sort((a,b)=>a.taxa-b.taxa||a.val-b.val);let falta=alvo,ir=0;const usa=[];
  for(const l of L){if(falta<=0)break;const v=Math.min(falta,l.val),f=v/l.val;usa.push(Object.assign({},l,{v,irv:l.ir*f}));ir+=l.ir*f;falta-=v}
  const pior=L.slice().sort((a,b)=>b.taxa-a.taxa);let f2=alvo,ir2=0;for(const l of pior){if(f2<=0)break;const v=Math.min(f2,l.val);ir2+=l.ir*v/l.val;f2-=v}
  h+=falta>0?'<p class="warn">Os itens que viram dinheiro em até 5 dias somam menos que '+brl(alvo)+'; faltam '+brl(falta)+'.</p>':'';
  h+='<div class="fnkpis">'+tecKp("IR com esta ordem",brl(ir),fx(ir/Math.max(1,alvo-Math.max(0,falta))*100,2)+'% do valor')+tecKp("IR vendendo na pior ordem",brl(ir2),'economia de '+brl(ir2-ir))+'</div>';
  const G=new Map();usa.forEach(u=>{const k=u.p.x,g=G.get(k)||{x:k,v:0,ir:0};g.v+=u.v;g.ir+=u.irv;G.set(k,g)});
  return h+'<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Vender</th><th>Valor</th><th>IR</th></tr></thead><tbody>'+[...G.values()].map(g=>'<tr><td style="text-align:left">'+esc(spItemNome(g.x)).slice(0,46)+'</td><td>'+brl(g.v)+'</td><td>'+brl(g.ir)+'</td></tr>').join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem">Primeiro os lotes com prejuízo ou isentos, depois os de menor alíquota e menor ganho. Vendas de ações até R$ 20 mil no mês são isentas e não entram nesta conta; confira também a política de alocação antes de vender.</p>';
}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.spvenda)return;SPV.v=t.value;if(typeof spRun==="function")spRun()});
