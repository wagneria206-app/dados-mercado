/* ---------- política de investimento da carteira e rebalanceamento sugerido
   c.pol = {perfil, alvo:{classe: %}, tol: tolerância em pontos percentuais, aporte: R$, vender: 0/1}
   Os perfis são modelos de referência do app (ajuste à política do seu escritório e ao perfil de cada cliente). */
const SP_PERFIS={
  conservador:{nome:"Conservador",alvo:{pos:55,infl:15,pre:5,cred:15,mm:5,intl:5}},
  moderado:{nome:"Moderado",alvo:{pos:30,infl:15,pre:5,cred:15,mm:10,acoes:10,intl:10,imob:5}},
  arrojado:{nome:"Arrojado",alvo:{pos:15,infl:10,pre:5,cred:10,mm:15,acoes:20,intl:15,imob:5,cripto:5}},
  pers:{nome:"Personalizado",alvo:null}};
function spPol(c){if(!c.pol)c.pol={perfil:"moderado",alvo:Object.assign({},SP_PERFIS.moderado.alvo),tol:5,aporte:0,vender:0};return c.pol}
/* situação de cada classe e sugestão de movimentos */
function spRebal(c,it){
  const P=spPol(c),{w,real,tot}=spPesos(c,it),ap=Math.max(0,+P.aporte||0),T=tot+ap,X=real?SP_POS.X:null;
  const cls=Object.keys(SP_CL),atual={},itens={};it.forEach((x,i)=>{const k=spCl(x);atual[k]=(atual[k]||0)+w[i]*tot;(itens[k]=itens[k]||[]).push({x,v:w[i]*tot})});
  const somaAlvo=cls.reduce((a,k)=>a+(+P.alvo[k]||0),0)||100;
  const L=cls.map(k=>{const a=+P.alvo[k]||0,va=atual[k]||0,pa=tot>0?va/tot*100:0;return {k,alvo:a/somaAlvo*100,va,pa,desv:pa-a/somaAlvo*100,meta:a/somaAlvo*T}}).filter(o=>o.alvo>0||o.va>0);
  const fora=L.filter(o=>Math.abs(o.desv)>(+P.tol||0));
  // movimentos por classe: só com aporte (compra o que falta, na proporção da falta) ou também vendendo o excesso
  const falta=L.map(o=>Math.max(0,o.meta-o.va)),sob=L.map(o=>Math.max(0,o.va-o.meta)),tf=falta.reduce((a,b)=>a+b,0);
  let caixa=ap;const mov=L.map(()=>0);
  if(P.vender){L.forEach((o,i)=>{mov[i]=-sob[i];caixa+=sob[i]})}
  if(tf>0){const f=Math.min(1,caixa/tf);L.forEach((o,i)=>{mov[i]+=falta[i]*f});caixa-=Math.min(caixa,tf)}
  if(caixa>0.005){const sa=L.reduce((a,o)=>a+o.alvo,0)||1;L.forEach((o,i)=>{mov[i]+=caixa*o.alvo/sa})}
  // dentro da classe: proporcional ao valor de cada item (vendas não mexem em itens em carência)
  const porItem=[];L.forEach((o,i)=>{const m=mov[i];if(Math.abs(m)<0.5)return;let lst=(itens[o.k]||[]).filter(y=>m>0||!spLiq(y.x).car);
    if(!lst.length){porItem.push({cl:o.k,x:null,v:m});return}
    const s=lst.reduce((a,y)=>a+y.v,0);lst.forEach(y=>{const v=m*(s>0?y.v/s:1/lst.length);const p=X?X.P.find(q=>q.x===y.x):null;
      porItem.push({cl:o.k,x:y.x,v,ir:v<0&&p&&p.v>0?p.ir*Math.min(1,-v/p.v):null,liq:spLiq(y.x)})})});
  return {P,L,fora,mov,porItem,tot,T,ap,real}}

function spPolHtml(c,it){
  if(!it.length)return "";
  const R=spRebal(c,it),P=R.P,pc=v=>fx(v,1)+'%';
  let h='<section class="panel" data-reltit="Política e rebalanceamento"><h3>Política de investimento e rebalanceamento</h3><p class="sub">Alocação-alvo por classe para esta carteira e o que fazer para voltar a ela.'+(R.fora.length?' <b class="neg">Fora da política em '+R.fora.length+(R.fora.length>1?' classes':' classe')+'.</b>':' <b class="pos">Dentro da política.</b>')+'</p>';
  h+='<div class="sprow" style="margin-top:8px"><div class="field"><label for="spPerf">Perfil</label><select id="spPerf" data-sppolperf="1">'+Object.entries(SP_PERFIS).map(([k,v])=>'<option value="'+k+'"'+(P.perfil===k?' selected':'')+'>'+v.nome+'</option>').join("")+'</select><small>Modelos de referência; ajuste cada classe abaixo.</small></div>'
    +'<div class="field"><label for="spTol">Tolerância</label><div class="affix s"><input id="spTol" inputmode="decimal" data-sppol="tol" value="'+fx(+P.tol||0,1)+'"><span class="suf">p.p.</span></div><small>Desvio aceito antes de rebalancear</small></div>'
    +'<div class="field"><label for="spApR">Aporte para rebalancear</label><div class="affix s"><input id="spApR" inputmode="decimal" data-sppol="aporte" value="'+fx(+P.aporte||0,2)+'"><span class="suf">R$</span></div></div>'
    +'<div class="field"><label>Vendas</label><label class="spiso" style="margin-top:8px"><input type="checkbox" data-sppolvend="1"'+(P.vender?' checked':'')+'>Permitir vender o excesso</label></div></div>';
  h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab"><thead><tr><th style="text-align:left">Classe</th><th>Atual</th><th>Alvo</th><th>Desvio</th><th>Movimento sugerido</th></tr></thead><tbody>'
    +R.L.map((o,i)=>'<tr><td style="text-align:left"><i class="fndot" style="background:'+SP_CL_COR[o.k]+'"></i>'+esc(SP_CL[o.k])+'</td><td>'+pc(o.pa)+'<small style="display:block;color:var(--muted)">'+brl(o.va)+'</small></td><td><span class="affix s" style="width:84px;display:inline-flex"><input inputmode="decimal" data-sppolalvo="'+o.k+'" value="'+fx(+P.alvo[o.k]||0,1)+'"><span class="suf">%</span></span></td><td class="'+(Math.abs(o.desv)>(+P.tol||0)?'neg':'')+'">'+(o.desv>0?'+':o.desv<0?'−':'')+fx(Math.abs(o.desv),1)+' p.p.</td><td>'+(Math.abs(R.mov[i])<0.5?'—':(R.mov[i]>0?'<span class="pos">Aplicar ':'<span class="neg">Resgatar ')+brl(Math.abs(R.mov[i]))+'</span>')+'</td></tr>').join("")
    +'</tbody></table></div>';
  h+='<div class="spbtns" style="margin-top:4px"><span class="sub" style="font-size:.82rem">Incluir classe na política:</span>'+Object.keys(SP_CL).filter(k=>!R.L.find(o=>o.k===k)).map(k=>'<button type="button" class="link" data-sppoladd="'+k+'">'+esc(SP_CL[k])+'</button>').join("")+'</div>';
  if(R.porItem.length){
    h+='<div class="label" style="margin-top:12px">Movimentos por item</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th style="text-align:left">Classe</th><th>Movimento</th><th>Prazo</th><th>IR estimado</th></tr></thead><tbody>'
      +R.porItem.sort((a,b)=>a.v-b.v).map(o=>'<tr><td style="text-align:left" class="tw">'+(o.x?esc(spItemNome(o.x)):'<i>nenhum item desta classe na carteira: escolha um produto (Fundos › Ranking ou Bolsa › Ranking)</i>')+'</td><td style="text-align:left"><small>'+esc(SP_CL[o.cl])+'</small></td><td>'+(o.v>0?'<span class="pos">Aplicar ':'<span class="neg">Resgatar ')+brl(Math.abs(o.v))+'</span></td><td>'+(o.liq?(o.liq.car?'carência até '+fdate(Date.parse(o.liq.car+"T00:00:00Z")):o.liq.d!=null?'D+'+o.liq.d:'—'):'—')+'</td><td>'+(o.ir!=null?brl(o.ir):'—')+'</td></tr>').join("")+'</tbody></table></div>';
  }
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Sem vendas, o aporte vai primeiro para as classes abaixo do alvo, na proporção do que falta; o que sobrar segue a alocação-alvo. Com vendas, o excesso de cada classe acima do alvo também é resgatado. Dentro de cada classe, o movimento é dividido na proporção do valor de cada item; itens em carência não são vendidos. IR estimado só na posição real (aplicações informadas), aplicação por aplicação; considere também IOF (resgate antes de 30 dias), come-cotas já pago e o prazo de resgate antes de executar. Os perfis são modelos de referência do app, não recomendação.</p></section>';
  return h}

document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||activeMod!=="sp")return;const c=spC(),P=spPol(c);
  if(t.dataset.sppolperf){P.perfil=t.value;if(SP_PERFIS[t.value].alvo)P.alvo=Object.assign({},SP_PERFIS[t.value].alvo);spSave();spCalc();return}
  if(t.dataset.sppolalvo){const v=num(t.value);P.alvo[t.dataset.sppolalvo]=isFinite(v)?Math.max(0,v):0;P.perfil="pers";spSave();spCalc();return}
  if(t.dataset.sppol){const v=num(t.value);P[t.dataset.sppol]=isFinite(v)?Math.max(0,v):0;spSave();spCalc();return}
  if(t.dataset.sppolvend){P.vender=t.checked?1:0;spSave();spCalc();return}});
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-sppoladd]");if(!x||activeMod!=="sp")return;const P=spPol(spC());P.alvo[x.dataset.sppoladd]=+P.alvo[x.dataset.sppoladd]||5;P.perfil="pers";spSave();spCalc()});
