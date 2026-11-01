/* ---------- proposta: antes × depois
   Compara a carteira aberta (proposta) com outra carteira (em geral a atual do cliente): alocação, risco, retorno,
   custo médio das taxas, liquidez e o IR que a troca geraria. Entra no relatório em PDF junto com os demais blocos. */
let SP_ANT={key:"",res:null,tok:0};
async function spAntCalc(c,ref){const tok=++SP_ANT.tok,um=async x=>{const it=x.itens.filter(y=>(+y.w||0)>0);if(!it.length)return null;const D=await Promise.all(it.map(spItemData));const R=spSim(Object.assign({},x,{ini:"",fim:"",aporte:0,base:"m"}),it,D);
    let X=null;if(spTemMov(x)){const itM=x.itens.filter(y=>!((+y.w||0)>0)&&y.mov&&y.mov.length),DM=await Promise.all(itM.map(spItemData));try{X=spPosCalc(x,it.concat(itM),D.concat(DM))}catch(e){}if(X&&X.erro)X=null}return {x,it,R,X}};
  const [A,B]=await Promise.all([um(ref),um(c)]);if(tok!==SP_ANT.tok)return null;return {A,B}}
function spAntInd(o){if(!o||o.R.erro)return null;const {x,it,R,X}=o,antes=SP_POS;SP_POS=X?{c:x,X}:null;const {w,tot}=spPesos(x,it);SP_POS=antes;
  const n=R.rets.length,i12=Math.max(0,n-12);let v=1;for(let j=i12;j<n;j++)v*=1+R.rets[j].r;const st=spStats(R,R.rets,R.pts[R.pts.length-1].idx);
  const C=FN.C,taxa=it.reduce((a,y,i)=>{const r=y.t==="f"&&FN.idx?fnRow(y.k):null;return a+w[i]*(r&&r[C.tadm]!=null?r[C.tadm]:0)},0);
  const d30=it.reduce((a,y,i)=>{const l=spLiq(y);return a+(!l.car&&l.d!=null&&l.d<=30?w[i]:0)},0)*100,cl={};it.forEach((y,i)=>{const k=spCl(y);cl[k]=(cl[k]||0)+w[i]*100});
  return {v:X?X.T.v:tot,r12:n>=12?(v-1)*100:null,ann:st.ann,vol:st.vol,sh:st.sharpe,dd:st.dd,taxa,d30,nEf:1/w.reduce((a,b)=>a+b*b,0),cl,X,it,w}}
function spAntHtml(c,it){const outros=SP.carts.map((x,j)=>[x,j]).filter(([x])=>x!==c&&x.itens.some(y=>(+y.w||0)>0));if(!outros.length||!it.length)return "";
  const mesmo=outros.filter(([x])=>c.cli&&x.cli===c.cli),lista=mesmo.length?mesmo:outros;let ref=c.antes!=null&&SP.carts[c.antes]&&SP.carts[c.antes]!==c?+c.antes:null;
  let h='<section class="panel" data-reltit="Antes e depois"><h3>Proposta: antes × depois</h3><p class="sub">Compare esta carteira com a carteira atual do cliente (ou outra proposta).</p><div class="sprow" style="margin-top:6px"><div class="field"><label for="spAntes">Comparar com</label><select id="spAntes" data-spantes="1"><option value="">Escolha a carteira atual</option>'+lista.map(([x,j])=>'<option value="'+j+'"'+(ref===j?' selected':'')+'>'+esc(spRotulo(x))+'</option>').join("")+'</select></div></div><div id="spAntBox">';
  if(ref==null)return h+'</div></section>';
  const key=JSON.stringify([SP.cur,ref,c.itens.map(y=>[y.k,y.w]),SP.carts[ref].itens.map(y=>[y.k,y.w,(y.mov||[]).length])]);
  if(SP_ANT.key===key&&SP_ANT.res)h+=spAntRender(c,SP_ANT.res);
  else{SP_ANT.key=key;SP_ANT.res=null;h+='<p class="sub">Calculando as duas carteiras…</p>';setTimeout(()=>spAntCalc(c,SP.carts[ref]).then(r=>{if(!r||SP_ANT.key!==key)return;SP_ANT.res=r;const b=$("spAntBox");if(b)b.innerHTML=fnUse(FN,()=>spAntRender(c,r))}).catch(e=>{const b=$("spAntBox");if(b)b.innerHTML='<p class="warn">'+esc(e.message)+'</p>'}),0)}
  return h+'</div></section>'}
function spAntRender(c,res){const a=spAntInd(res.A),b=spAntInd(res.B);if(!a||!b)return '<p class="warn">Não há histórico em comum suficiente para comparar.</p>';
  const pc=v=>v==null||!isFinite(v)?'—':fx(v,1)+'%',dif=(x,y,bom,f)=>x==null||y==null?'—':'<span class="'+((y-x)*(bom?1:-1)>0.0001?'pos':(y-x)*(bom?1:-1)<-0.0001?'neg':'')+'">'+(y>=x?'+':'−')+f(Math.abs(y-x))+'</span>';
  const linhas=[["Retorno em 12 meses (simulado)",a.r12,b.r12,true,v=>fx(v,2)+' p.p.',pc],["Retorno ao ano (histórico)",a.ann,b.ann,true,v=>fx(v,2)+' p.p.',pc],["Volatilidade",a.vol,b.vol,false,v=>fx(v,2)+' p.p.',pc],["Sharpe",a.sh,b.sh,true,v=>fx(v,2),v=>v==null?'—':fx(v,2)],["Perda máxima",a.dd,b.dd,true,v=>fx(v,2)+' p.p.',pc],["Taxa de administração média",a.taxa,b.taxa,false,v=>fx(v,2)+' p.p.',v=>fx(v,2)+'%'],["Resgatável até D+30",a.d30,b.d30,true,v=>fx(v,1)+' p.p.',pc],["Nº efetivo de itens",a.nEf,b.nEf,true,v=>fx(v,1),v=>fx(v,1)]];
  // IR da troca: itens da carteira atual (com posição real) que saem ou diminuem na proposta
  let ir=null;if(a.X){ir=0;const P=new Map();res.B.it.forEach((y,i)=>P.set(y.t+"|"+y.k,b.w[i]));a.X.P.forEach(p=>{const nw=P.get(p.x.t+"|"+p.x.k)||0,ia=res.A.it.indexOf(p.x),wa=ia>=0?a.w[ia]:0;if(p.v>0&&wa>nw)ir+=p.ir*Math.min(1,(wa-nw)/wa)})}
  const cls=[...new Set(Object.keys(a.cl).concat(Object.keys(b.cl)))].filter(k=>(a.cl[k]||0)+(b.cl[k]||0)>0.05).sort((x,y)=>(b.cl[y]||0)-(b.cl[x]||0));
  let h='<div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Indicador</th><th>Antes ('+esc(res.A.x.nome).slice(0,24)+')</th><th>Depois ('+esc(c.nome).slice(0,24)+')</th><th>Diferença</th></tr></thead><tbody>'
    +linhas.map(([l,x,y,bom,fd,f])=>'<tr><td style="text-align:left">'+l+'</td><td>'+f(x)+'</td><td><b>'+f(y)+'</b></td><td>'+dif(x,y,bom,fd)+'</td></tr>').join("")
    +(ir!=null?'<tr><td style="text-align:left">IR estimado da troca</td><td colspan="2">'+brl(ir)+'</td><td><small>sobre os ganhos das posições vendidas</small></td></tr>':'')+'</tbody></table></div>';
  h+='<div class="label" style="margin-top:10px">Alocação por classe</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab"><thead><tr><th style="text-align:left">Classe</th><th>Antes</th><th>Depois</th><th>Diferença</th></tr></thead><tbody>'
    +cls.map(k=>'<tr><td style="text-align:left"><i class="fndot" style="background:'+SP_CL_COR[k]+'"></i>'+esc(SP_CL[k])+'</td><td>'+pc(a.cl[k]||0)+'</td><td><b>'+pc(b.cl[k]||0)+'</b></td><td>'+((b.cl[k]||0)-(a.cl[k]||0)>=0?'+':'−')+fx(Math.abs((b.cl[k]||0)-(a.cl[k]||0)),1)+' p.p.</td></tr>').join("")+'</tbody></table></div>';
  return h+'<p class="sub" style="font-size:.8rem;margin-top:6px">As duas carteiras simuladas no histórico mensal com os pesos de cada uma (sem aportes, sem IR). Verde = melhor na proposta. IR da troca pela posição real informada na carteira atual, aplicação por aplicação. Taxa média só dos fundos (taxa de administração da CVM; Tesouro, ações e renda fixa direta contam como zero). Desempenho passado não garante o futuro.</p>'}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.spantes||activeMod!=="sp")return;const c=spC();c.antes=t.value===""?undefined:+t.value;spSave();spCalc()});
