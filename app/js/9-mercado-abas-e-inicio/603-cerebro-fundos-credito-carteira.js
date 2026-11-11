/* ---------- Cérebro, segunda parte: Nota WF dos fundos (contra os pares da mesma categoria ANBIMA), nota de crédito
   das debêntures (quanto pagam pelo risco) e a carteira de cada cliente comparada com o mapa tático e as notas. */
const CBF={n:null,k:null};
function cbFnNota(){
  if(typeof FN!=="object"||!FN.idx)return null;const I=FN.idx,C=FN.C,key=I.dt+"|"+I.rows.length;if(CBF.n&&CBF.k===key)return CBF.n;
  const R=I.rows.filter(r=>{const fl=r[C.flags]||0;return !(fl&1||fl&4||fl&16||fl&64)&&(r[C.pl]||0)>=10e6&&(r[C.cotistas]||0)>=20&&r[C.r12]!=null}),G=new Map();R.forEach(r=>{const a=r[C.anbima];if(a==null||!I.anbima[a])return;(G.get(a)||G.set(a,[]).get(a)).push(r)});
  const rk=v=>{const a=v.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y);return x=>x==null||!isFinite(x)||a.length<8?null:(()=>{let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>1;if(a[m]<x)lo=m+1;else hi=m}return lo/(a.length-1)*100})()};
  const F={r12:r=>r[C.r12],r36:r=>r[C.r36],sh:r=>r[C.sharpe],dd:r=>r[C.dd36],cap:r=>r[C.pl]>0&&r[C.capt12]!=null?r[C.capt12]/r[C.pl]:null,tx:r=>r[C.tadm]!=null?-r[C.tadm]:null};
  const out=new Map(),med=a=>{const v=a.filter(x=>x!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
  G.forEach((L,a)=>{if(L.length<10)return;const K={};Object.keys(F).forEach(k=>{K[k]=rk(L.map(F[k]))});
    L.forEach(r=>{const P={ret:med([K.r12(F.r12(r)),K.r36(F.r36(r))]),rr:med([K.sh(F.sh(r)),K.dd(F.dd(r))]),cap:K.cap(F.cap(r)),custo:K.tx(F.tx(r))},v=Object.values(P).filter(x=>x!=null);
      if(v.length>=3)out.set(r[0],{c:r[0],n:r[1],a,np:L.length,P,cot:r[C.cotistas]||0,nota:Math.round(v.reduce((s,x)=>s+x,0)/v.length)})})});
  CBF.n=out;CBF.k=key;return out}
const CBF_PIL=[["ret","Retorno"],["rr","Retorno pelo risco"],["cap","Captação"],["custo","Custo"]];
function cbFnNotaHtml(c){const N=cbFnNota(),x=N&&N.get(c);if(!x)return "";
  return '<section class="panel"><div class="label">Nota WF do fundo</div><p style="margin:4px 0"><b style="font-size:1.4rem;color:'+cbNotaCor(x.nota)+'">'+x.nota+'/100</b> <span class="sub">contra '+x.np+' fundos de '+esc(FN.idx.anbima[x.a])+'</span></p><p class="sub" style="margin:0">'+CBF_PIL.map(([k,n])=>n+' '+(x.P[k]==null?'—':fx(x.P[k],0))).join(' · ')+'. Retorno em 12 e 36 meses; retorno pelo risco (Sharpe e queda máxima); captação líquida de 12 meses sobre o patrimônio; taxa de administração (menor é melhor). Só fundos com patrimônio acima de R$ 10 milhões e 20 cotistas.</p></section>'}
/* ---- crédito: quanto cada debênture paga pelo risco (spread contra o grupo, prazo e rating) */
function cbCredNota(){
  if(!CRB.L)return null;const L=CRB.L.filter(x=>x.tipo==="Debênture"&&x.sp!=null&&x.dur>0.3&&(x.rf==="ipca"||x.rf==="cdimais"));if(L.length<20)return null;
  const pz=d=>d<2?0:d<4?1:d<7?2:3,G=new Map();L.forEach(x=>{const k=x.rf+"|"+(x.isento?1:0)+"|"+pz(x.dur);(G.get(k)||G.set(k,[]).get(k)).push(x.sp)});
  const md=a=>{const v=a.slice().sort((x,y)=>x-y);return v[v.length>>1]};
  return L.map(x=>{const g=G.get(x.rf+"|"+(x.isento?1:0)+"|"+pz(x.dur)),dif=g.length>=5?x.sp-md(g):null,a=typeof rtAg==="function"&&RT.r?rtAg(null,x.emissor||x.nome):null,nt=a?a.pior:null;
    const est=dif!=null&&dif>4,pRat=nt==null?50:Math.max(0,100-(nt-1)*9),pDif=dif==null?50:est?10:dif<=1.5?Math.min(95,50+dif*30):Math.max(20,95-(dif-1.5)*25),pPz=x.dur<1?60:x.dur<=5?100:Math.max(0,100-(x.dur-5)*12);
    return Object.assign({},x,{dif,nt,est,ntxt:a?((a.L.find(o=>o.v===a.pior)||{}).nota||""):"",nota:Math.round(pDif*0.6+pRat*0.25+pPz*0.15)})}).sort((a,b)=>b.nota-a.nota)}
function cbCredHtml(){const L=cbCredNota();if(!L){if(typeof RT==="object"&&!RT.r&&typeof rtLoad==="function")rtLoad();return ""}
  const t=L.filter(x=>x.dif!=null&&x.dif>0.3&&!x.est&&x.dur>=0.75).slice(0,12),es=L.filter(x=>x.est).sort((a,b)=>b.dif-a.dif);if(!t.length)return "";
  return '<h3>Crédito que paga bem pelo risco</h3><p class="sub">Debêntures com spread acima da mediana do seu grupo (mesmo indexador, mesmo tratamento de IR e prazo parecido), com peso para o rating e para prazos de 1 a 5 anos. A nota premia o prêmio moderado: até cerca de 1,5 p.p. acima do grupo, pagar mais é bom; muito acima disso, o mercado está cobrando por um risco maior, e a nota cai. Nota de 0 a 100.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Debênture</th><th>Taxa</th><th>Acima do grupo</th><th>Prazo médio</th><th>Rating</th><th>Nota</th></tr></thead><tbody>'
    +t.map(x=>'<tr><td style="text-align:left"><button type="button" class="link" data-crcalc="'+esc(x.cod)+'">'+esc(x.cod)+'</button>'+(x.isento?' <small>isenta</small>':'')+'<small style="display:block;color:var(--muted)">'+esc(x.nome).slice(0,38)+'</small></td><td>'+(x.rf==="ipca"?'IPCA + ':'CDI + ')+fx(x.tx,2)+'%</td><td class="pos">+'+fx(x.dif,2)+' p.p.</td><td>'+fx(x.dur,1)+' anos</td><td><small>'+esc(x.ntxt||'—')+'</small></td><td><b style="color:'+cbNotaCor(x.nota)+'">'+x.nota+'</b></td></tr>').join("")+'</tbody></table></div>'+(es.length?'<p style="margin:8px 0 0"><b class="neg">Spread de estresse</b> (mais de 4 p.p. acima do grupo, o mercado cobra como risco alto de calote): '+es.slice(0,10).map(x=>'<button type="button" class="link" data-crcalc="'+esc(x.cod)+'">'+esc(x.cod)+'</button> (+'+fx(x.dif,1)+')').join(', ')+'. Ficam fora da lista acima.</p>':'')+'<p class="sub" style="font-size:.8rem;margin-top:6px">Spread acima do grupo pode ser oportunidade ou risco que a nota ainda não mostra: confira garantias, cláusulas e a saúde do emissor na ficha do título antes de concluir. Taxas indicativas da ANBIMA; rating: pior nota em escala nacional informada pelos fundos à CVM, quando existe.</p>'}
/* ---- carteira × cérebro */
const CB_CLMAP={pos:"pos",pre:"pre",infl:"ipca",cred:"cred",acoes:"acoes",imob:"fii",intl:"usd",ouro:"usd"};
function spCerebroHtml(c,it){
  if(!it||!it.length)return "";if(!cbPronto()){cbCarrega();return ""}
  let Mp=null;try{const Pr=cbPremios()||[];Mp=cbMapa(Pr,cbExterno())}catch(e){return ""}
  const {w}=spPesos(c,it),cls=new Map();it.forEach((x,i)=>{const k=spCl(x);cls.set(k,(cls.get(k)||0)+w[i])});
  const linhas=[],alertas=[];
  Mp.C.forEach(m=>{const p=[...cls.entries()].filter(([k])=>CB_CLMAP[k]===m.k).reduce((a,[,v])=>a+v,0);
    let leit="";if(m.t>0&&p<0.05)leit='o cérebro vê a classe acima do peso e a carteira tem '+(p?'só '+fx(p*100,1)+'%':'nada');else if(m.t<0&&p>=0.15)leit='o cérebro vê a classe abaixo do peso e a carteira tem '+fx(p*100,1)+'%';
    linhas.push({m,p,leit})});
  const N=cbNota();it.forEach((x,i)=>{if(w[i]<0.01)return;if(x.t==="a"&&N){const n=N.get(x.k);if(n&&n.nota<=35)alertas.push(esc(x.k)+': Nota WF '+n.nota+' ('+CB_PIL.filter(([k])=>n.P[k]!=null&&n.P[k]<30).map(([,l])=>l.toLowerCase()).join(', ')+' fracos)')}
    if(x.t==="f"){const F=cbFnNota(),n=F&&F.get(x.k);if(n&&n.nota<=35)alertas.push(esc(spItemNome(x)).slice(0,40)+': Nota WF do fundo '+n.nota+' entre '+n.np+' pares')}});
  const CR=cbCredNota();if(CR)it.forEach((x,i)=>{if(!/^cr:/.test(x.k||"")||w[i]<0.01)return;const d=CR.find(o=>o.cod===x.k.slice(3));if(d&&d.dif!=null&&d.dif<-0.5)alertas.push(esc(d.cod)+': paga '+fx(-d.dif,2)+' p.p. abaixo do grupo: o risco pode estar mal remunerado')});
  const div=linhas.filter(l=>l.leit);
  return '<section class="panel" data-reltit="O que o cérebro diz desta carteira"><h3>O que o cérebro diz desta carteira</h3><p class="sub">A carteira comparada com o mapa tático da Visão WF e com as notas de ações, fundos e crédito. Ponto de partida para a conversa com o cliente, sempre dentro da política e do perfil dele.</p>'
    +'<div class="tablewrap" style="max-height:none"><table class="ctab" data-ordok="1"><thead><tr><th style="text-align:left">Classe</th><th>Na carteira</th><th>Mapa tático</th></tr></thead><tbody>'
    +linhas.map(l=>'<tr><td style="text-align:left">'+l.m.n+'</td><td>'+fx(l.p*100,1)+'%</td><td><b style="color:'+(l.m.t>0?'var(--gain)':l.m.t<0?'var(--loss)':'var(--muted)')+'">'+(l.m.t>0?'acima do peso':l.m.t<0?'abaixo do peso':'neutro')+'</b></td></tr>').join("")+'</tbody></table></div>'
    +(div.length?'<p style="margin:10px 0 0"><b>Onde a carteira destoa:</b> '+div.map(l=>l.m.n+' — '+l.leit).join('; ')+'.</p>':'<p style="margin:10px 0 0">A carteira não destoa do mapa tático em nenhuma classe.</p>')
    +(alertas.length?'<p style="margin:8px 0 0"><b>Itens para revisar:</b></p><ul style="margin:4px 0 0;padding-left:18px">'+alertas.map(a=>'<li>'+a+'</li>').join("")+'</ul>':'<p class="sub" style="margin:8px 0 0">Nenhum item com nota baixa ou crédito mal remunerado.</p>')
    +'<p class="sub" style="font-size:.8rem;margin-top:8px"><button type="button" class="link" data-mkgo="vw">Ver a Visão WF completa</button></p></section>'}
/* ---- fundos com melhor Nota WF nas categorias mais usadas */
const CBF_CAT=["Renda Fixa Duração Baixa Grau de Invest.","Renda Fixa Duração Livre Crédito Livre","Renda Fixa Indexados","Multimercados Livre","Multimercados Macro","Ações Livre","Ações Dividendos"];
function cbFnTopHtml(){const N=cbFnNota();if(!N)return "";const I=FN.idx,L=[...N.values()];
  const rows=CBF_CAT.map(nm=>{const a=I.anbima.indexOf(nm);if(a<0)return "";const t=L.filter(x=>x.a===a&&x.cot>=100).sort((x,y)=>y.nota-x.nota).slice(0,3);if(!t.length)return "";
    return '<tr><td style="text-align:left"><b>'+esc(nm)+'</b><small style="display:block;color:var(--muted)">'+t[0].np+' fundos</small></td><td style="text-align:left">'+t.map(x=>'<button type="button" class="link" data-cbfn="'+x.c+'">'+esc(String(x.n)).slice(0,42)+'</button> <b style="color:'+cbNotaCor(x.nota)+'">'+x.nota+'</b>').join('<br>')+'</td></tr>'}).filter(Boolean);
  if(!rows.length)return "";
  return '<h3>Fundos com melhor Nota WF</h3><p class="sub">Os três mais bem avaliados nas categorias mais usadas, contra os pares da mesma categoria ANBIMA: retorno em 12 e 36 meses, retorno pelo risco, captação e custo. A nota de cada fundo aparece também na página dele.</p><div class="tablewrap" style="max-height:none"><table class="ctab" data-ordok="1"><thead><tr><th style="text-align:left">Categoria</th><th style="text-align:left">Fundos (nota)</th></tr></thead><tbody>'+rows.join("")+'</tbody></table></div>'}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-cbfn]");if(!x)return;const c=x.dataset.cbfn;setMod("fa");setTimeout(()=>{if(typeof fnOpen==="function")fnOpen(c)},150)});
