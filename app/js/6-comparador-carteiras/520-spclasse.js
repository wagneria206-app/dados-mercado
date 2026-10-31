function spClasse(x){
  if(x.t==="f"){const r=FN.idx&&fnRow(x.k);return r?(FN.idx.classes[r[FN.C.classe]]||"Fundo"):"Fundo"}
  if(x.t==="a"){const r=AT.idx&&atRow(x.k);return r?r[AT.C.tipo]:"Bolsa"}
  return /^renda fixa$/i.test(x.tipo||"")||!x.tipo?"Renda Fixa":x.tipo;
}
function spCompHtml(c,it,R){
  const v0=+c.valor||0,grp=new Map();it.forEach((x,i)=>{const g=spClasse(x),k=[...grp.keys()].find(y=>fnNorm(y)===fnNorm(g))||g;grp.set(k,(grp.get(k)||0)+R.w[i])});
  const G=[...grp.entries()].sort((a,b)=>b[1]-a[1]),cols=["var(--accent)","var(--s2)","var(--s3)","var(--s4)","var(--gold)","var(--loss)","#0e7490","#64748b"];
  let h='<section class="panel" data-reltit="Composição da carteira"><h3>Composição da carteira</h3><div class="spbar" role="img" aria-label="Composição por tipo">'+G.map(([g,w],j)=>'<i style="width:'+(w*100).toFixed(2)+'%;background:'+cols[j%cols.length]+'" title="'+esc(g)+' '+fx(w*100,1)+'%"></i>').join("")+'</div><div class="legend">'+G.map(([g,w],j)=>'<span><i style="background:'+cols[j%cols.length]+'"></i>'+esc(g)+' · '+fx(w*100,1)+'%</span>').join("")+'</div>';
  h+='<div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th style="text-align:left" class="c-ph">Tipo</th><th>Peso</th><th>Valor</th></tr></thead><tbody>'+it.map((x,i)=>'<tr><td style="text-align:left" class="tw"><i class="fndot" style="background:'+CMP_COLS[c.itens.indexOf(x)%CMP_COLS.length]+'"></i>'+esc(spItemNome(x))+(x.t==="f"?'<small style="display:block;color:var(--muted)">'+fnCnpjF(x.k)+'</small>':'')+'</td><td style="text-align:left" class="c-ph"><small>'+esc(spClasse(x))+'</small></td><td>'+fx(R.w[i]*100,1)+'%</td><td>'+brl(v0*R.w[i])+'</td></tr>').join("")+'<tr class="cmpbm"><td style="text-align:left"><b>Total</b></td><td class="c-ph"></td><td><b>100%</b></td><td><b>'+brl(v0)+'</b></td></tr></tbody></table></div></section>';
  return h;
}
function spItensHtml(c,it,R){
  const lin=x=>{
    if(x.t==="f"){const r=FN.idx&&fnRow(x.k),C=FN.C;if(!r)return null;const F=FN.files.get(x.k)||{};return {r12:r[C.r12],r24:r[C.r24],r36:r[C.r36],v:r[C.v12],sh:r[C.sharpe],dd:r[C.dd36],tx:(r[C.tadm]!=null?r[C.tadm]:F.tadm)!=null?"adm. "+fx(r[C.tadm]!=null?r[C.tadm]:F.tadm,2)+"%":"—",res:F.dcot!=null||F.dpag!=null?"D+"+fx((F.dcot||0)+(F.dpag||0),0):r[C.dres]!=null?"D+"+fx(r[C.dres],0):"—",pl:fnMoney(r[C.pl])}}
    if(x.t==="a"){const r=AT.idx&&atRow(x.k),C=AT.C;if(!r)return null;return {r12:r[C.r12],r24:r[C.r24],r36:r[C.r36],v:r[C.v12],sh:r[C.sharpe],dd:r[C.dd36],tx:r[C.dy]!=null?"DY "+fx(r[C.dy],2)+"%":"—",res:r[C.tipo]==="Tesouro Direto"?"D+1":"D+2",pl:r[C.liq]?fnMoney(r[C.liq])+"/dia":"—"}}
    return {r12:null,r24:null,r36:null,v:null,sh:null,dd:null,tx:spRfLab(x.rf,+x.x||0),res:"—",pl:"—"}};
  let h='<section class="panel" data-reltit="Rentabilidade e risco de cada item"><h3>Rentabilidade e risco de cada item</h3><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th>12 meses</th><th>24 meses</th><th>36 meses</th><th>Volatilidade 12m</th><th>Sharpe</th><th>Perda máx. 36m</th><th class="c-ph">Taxa / DY</th><th class="c-ph">Resgate</th><th class="c-ph">PL / liquidez</th></tr></thead><tbody>';
  it.forEach(x=>{const L=lin(x)||{};const P=v=>v==null?"—":fnPct(v);h+='<tr><td style="text-align:left" class="tw"><i class="fndot" style="background:'+CMP_COLS[c.itens.indexOf(x)%CMP_COLS.length]+'"></i>'+esc(spItemNome(x))+'</td><td>'+P(L.r12)+'</td><td>'+P(L.r24)+'</td><td>'+P(L.r36)+'</td><td>'+(L.v!=null?fx(L.v,2)+"%":"—")+'</td><td>'+(L.sh!=null?fx(L.sh,2):"—")+'</td><td>'+P(L.dd)+'</td><td class="c-ph">'+esc(L.tx||"—")+'</td><td class="c-ph">'+esc(L.res||"—")+'</td><td class="c-ph">'+esc(L.pl||"—")+'</td></tr>'});
  return h+'</tbody></table></div><p class="sub" style="font-size:.8rem">Números de cada item até a data mais recente da base (fundos: CVM; ativos: B3). Resgate: prazo de cotização mais pagamento informado na lâmina. Renda fixa aparece pela taxa contratada.</p></section>';
}
function spFichasHtml(c,it){
  const fs=it.filter(x=>(x.t==="f"&&FN.files.has(x.k))||(x.t==="a"&&AT.files.has(x.k)));if(!fs.length)return "";
  let h='<section class="panel" data-reltit="Ficha de cada fundo e ativo"><h3>Ficha de cada fundo e ativo</h3><p class="sub">Características, taxas, prazos, público-alvo e objetivo de cada item, segundo a CVM (cadastro e lâmina) e a B3.</p>';
  fs.forEach(x=>{let f="";try{f=x.t==="f"?fnHead(FN.files.get(x.k)):fnUse(AT,()=>atHead(AT.files.get(x.k)))}catch(e){f=""}
    h+='<details class="spficha"><summary>'+esc(spItemNome(x))+'</summary>'+f.replace(/^<section class="panel fnhead">/,'<div class="fnhead spfh">').replace(/<\/section>$/,'</div>')+'</details>'});
  return h+'</section>';
}

/* comparador -> nova proposta com os mesmos itens e pesos iguais */
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-cmp2sp]");if(!x)return;const k=x.dataset.cmp2sp,L=(k==="f"?FN.cmp:AT.cmp).slice(0,CMP_MAX);if(!L.length)return;
  const cli=SP.fcli&&SP.fcli!=="__sem"?SP.fcli:"",c=spNova("Proposta "+new Date().toLocaleDateString("pt-BR"),cli),n=L.length;
  c.itens=L.map((id,j)=>{if(k==="f"){const r=FN.idx&&fnRow(id);return {t:"f",k:id,n:r?r[1]:id,tipo:"Fundo · "+(r&&FN.idx.classes[r[FN.C.classe]]||""),w:Math.round(100/n*10)/10}}const r=AT.idx&&atRow(id);return {t:"a",k:id,n:id+(r?" · "+r[1]:""),tipo:r?r[AT.C.tipo]:"",w:Math.round(100/n*10)/10}});
  const d=100-c.itens.reduce((a,y)=>a+y.w,0);c.itens[0].w=Math.round((c.itens[0].w+d)*10)/10;
  SP.carts.push(c);SP.cur=SP.carts.length-1;SP_CMP=null;spSave();setMod("sp");try{$("fnOut").scrollIntoView({behavior:"smooth"})}catch(y){}alertLite("Carteira criada com "+n+(k==="f"?" fundos":" ativos")+" em pesos iguais. Ajuste os pesos e o cliente.")});

