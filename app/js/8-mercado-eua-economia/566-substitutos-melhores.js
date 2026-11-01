/* ---------- substitutos melhores: para cada fundo da carteira, fundos da mesma categoria que entregaram mais com menos
   Exige retorno em 36 meses (ou 12) e Sharpe pelo menos iguais e prazo de resgate não maior; pontua retorno, risco, taxa e liquidez. */
function spSubs(x){if(x.t!=="f"||!FN.idx)return null;const me=fnRow(x.k);if(!me)return null;const C=FN.C,I=FN.idx,anb=me[C.anbima],useA=anb!=null&&I.anbima[anb];
  const v=c=>me[C[c]],R=v("r36")!=null?"r36":"r12",nm3=fnNorm(me[1]).split(/\s+/).slice(0,3).join(" ");if(v(R)==null)return {me,L:[]};
  const L=[];I.rows.forEach(r=>{if(r===me||r[0]===x.k)return;if(r[C.tipo]!==me[C.tipo]||(useA?r[C.anbima]!==anb:r[C.classe]!==me[C.classe]))return;const fl=r[C.flags];if(fl&1||fl&4||fl&16||fl&64)return;
    if((r[C.pl]||0)<20e6||(r[C.cotistas]||0)<50||r[C[R]]==null||r[C[R]]<v(R))return;
    if(v("sharpe")!=null&&(r[C.sharpe]==null||r[C.sharpe]<v("sharpe")))return;
    if(v("dres")!=null&&(r[C.dres]==null||r[C.dres]>v("dres")))return;
    if(v("v12")!=null&&r[C.v12]!=null&&(r[C.v12]>v("v12")*1.5||r[C.v12]<v("v12")*0.5))return;   // perfil de risco parecido
    if(nm3&&fnNorm(r[1]).split(/\s+/).slice(0,3).join(" ")===nm3)return;   // outra classe ou cota do mesmo fundo
    let s=0;const gan=[];if(r[C.r12]!=null&&v("r12")!=null&&r[C.r12]>v("r12")){s++;gan.push("mais retorno em 12 meses")}if(R==="r36"&&r[C.r36]>v("r36")){s++;gan.push("mais retorno em 36 meses")}
    if(r[C.sharpe]!=null&&v("sharpe")!=null&&r[C.sharpe]>v("sharpe")+0.1){s++;gan.push("Sharpe maior")}if(r[C.v12]!=null&&v("v12")!=null&&r[C.v12]<v("v12")*0.9){s++;gan.push("menos volátil")}
    if(r[C.tadm]!=null&&v("tadm")!=null&&r[C.tadm]<v("tadm")-0.05){s++;gan.push("taxa menor")}if(r[C.dres]!=null&&v("dres")!=null&&r[C.dres]<v("dres")){s++;gan.push("resgate mais rápido")}
    if(C.cons!=null&&r[C.cons]!=null&&v("cons")!=null&&r[C.cons]>v("cons")+10){s++;gan.push("mais consistente")}
    if(s>=2)L.push({r,s,gan})});
  L.sort((a,b)=>b.s-a.s||(b.r[C.sharpe]||0)-(a.r[C.sharpe]||0));return {me,L:L.slice(0,3),R,cat:useA?I.anbima[anb]:I.classes[me[C.classe]]}}
function spSubsHtml(c,it){const F=it.map((x,j)=>[x,c.itens.indexOf(x)]).filter(([x])=>x.t==="f");if(!F.length||!FN.idx)return "";const C=FN.C;
  const S=F.map(([x,j])=>({x,j,S:spSubs(x)})).filter(o=>o.S&&o.S.L.length);
  let h='<section class="panel" data-reltit="Substitutos melhores"><h3>Substitutos melhores</h3><p class="sub">Para cada fundo da carteira, até 3 fundos da mesma categoria com retorno e Sharpe pelo menos iguais, resgate no mesmo prazo ou mais rápido, volatilidade parecida e vantagem em pelo menos dois pontos.'+(S.length?'':' <b class="pos">Nenhum fundo da carteira tem substituto claramente melhor na categoria.</b>')+'</p>';
  const cel=(r,k,f)=>r[C[k]]==null?'—':f(r[C[k]]);
  S.forEach(o=>{const me=o.S.me,lin=(r,eu)=>'<tr'+(eu?' class="cmpbm"':'')+'><td style="text-align:left" class="tw">'+(eu?'<b>Atual:</b> ':'')+'<button type="button" class="link" data-fnopen="'+r[0]+'">'+esc(nomeCx(r[1])).slice(0,52)+'</button>'+(eu?'':'<small style="display:block;color:var(--muted)">'+esc(o.S.L.find(y=>y.r===r).gan.join(", "))+'</small>')+'</td><td>'+cel(r,"r12",fnPct)+'</td><td>'+cel(r,"r36",fnPct)+'</td><td>'+cel(r,"sharpe",v=>fx(v,2))+'</td><td>'+cel(r,"v12",v=>fx(v,2)+'%')+'</td><td>'+cel(r,"tadm",v=>fx(v,2)+'%')+'</td><td>'+cel(r,"dres",v=>'D+'+fx(v,0))+'</td><td>'+(eu?'':(o.x.mov&&o.x.mov.length?'<button type="button" class="link" data-fncmp="'+r[0]+'">comparar</button>':'<button type="button" class="link" data-spsub="'+o.j+'|'+r[0]+'">trocar</button>'))+'</td></tr>';
    h+='<div class="label" style="margin-top:10px">'+esc(spItemNome(o.x)).slice(0,60)+' <small style="text-transform:none;font-weight:400">· '+esc(o.S.cat||"")+'</small></div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab"><thead><tr><th style="text-align:left">Fundo</th><th>12m</th><th>36m</th><th>Sharpe</th><th>Vol. 12m</th><th>Taxa adm.</th><th>Resgate</th><th></th></tr></thead><tbody>'
      +lin(me,true)+o.S.L.map(y=>lin(y.r,false)).join("")+'</tbody></table></div>'});
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Base: CVM (cotas, taxa e prazo de resgate) e categoria ANBIMA; só fundos abertos ao público geral ou qualificado, com patrimônio acima de R$ 20 milhões e 50 cotistas, sem saltos de cota. "Trocar" mantém o peso do item; em itens com aplicações informadas, use "comparar". Desempenho passado não garante o futuro: confira estratégia, gestor e tributação antes de trocar (a troca gera IR sobre o ganho).</p></section>';
  return h}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-spsub]");if(!b||activeMod!=="sp")return;const [j,k]=b.dataset.spsub.split("|"),c=spC(),it=c.itens[+j],r=fnRow(k);if(!it||!r)return;
  if(c.itens.some(x=>x.k===k)){alertLite("Esse fundo já está na carteira.");return}it.k=k;it.n=r[1];delete it.cl;delete it.liq;delete it.car;SP_CMP=null;SP_ASS=null;spSave();spCalc()});
