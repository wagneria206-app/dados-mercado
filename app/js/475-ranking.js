/* ---------- ranking */
const AT_RKCOLS={
  acao:[["t","Ativo",""],["preco","Preço",""],["d1","Dia","c-ph"],["ra","Ano","c-ph"],["r12","12m",""],["dy","DY",""],["pl","P/L",""],["pvp","P/VP","c-ph"],["roe","ROE","c-ph"],["ml","Marg. líq.","c-ph c-sm"],["dlebit","DL/EBIT","c-ph c-md"],["evebit","EV/EBIT","c-ph c-md"],["mcap","Valor de mercado","c-ph"],["liq","Liquidez/dia","c-ph c-sm"],["v12","Vol. 12m","c-ph c-md"]],
  fii:[["t","Ativo",""],["preco","Preço",""],["d1","Dia","c-ph"],["ra","Ano","c-ph"],["r12","12m",""],["dy","DY",""],["pvp","P/VP",""],["mcap","Valor de mercado","c-ph"],["cot","Cotistas","c-ph"],["liq","Liquidez/dia","c-ph"],["v12","Vol. 12m","c-ph"]],
  out:[["t","Ativo",""],["preco","Preço",""],["d1","Dia","c-ph"],["ra","Ano",""],["r12","12m",""],["r36","36m","c-ph"],["v12","Vol. 12m","c-ph"],["dd36","Perda máx. 36m","c-ph"],["beta","Beta","c-ph"],["liq","Liquidez/dia",""]]};
function atRk(){
  const f=$("atRkF");if(!f)return;const I=AT.idx,C=AT.C,rk=AT.rk;
  const tipos=[...new Set(I.rows.map(r=>r[C.tipo]))].sort();const set=new Map();I.rows.forEach(r=>{if((rk.tipo===""||r[C.tipo]===rk.tipo)&&I.setores[r[C.setor]])set.set(r[C.setor],(set.get(r[C.setor])||0)+1)});
  const sel=(id,lab,opts,v)=>'<div class="field"><label for="'+id+'">'+lab+'</label><select id="'+id+'" data-atrk="'+id+'">'+opts.map(([a,b])=>'<option value="'+esc(a)+'"'+(String(a)===String(v)?' selected':'')+'>'+esc(b)+'</option>').join("")+'</select></div>';
  f.innerHTML='<div class="fnfilt">'+sel("arTipo","Tipo",[["","Todos"]].concat(tipos.map(x=>[x,x])),rk.tipo)+sel("arSet","Setor ou segmento",[["","Todos"]].concat([...set.entries()].sort((a,b)=>I.setores[a[0]].localeCompare(I.setores[b[0]])).map(([j,n])=>[j,I.setores[j]+" ("+n+")"])),rk.setor)
    +sel("arLiq","Liquidez mínima por dia",[[0,"Qualquer"],[1e5,"R$ 100 mil"],[1e6,"R$ 1 milhão"],[1e7,"R$ 10 milhões"],[5e7,"R$ 50 milhões"]],rk.liq)
    +'<div class="field"><label for="arTxt">Código ou nome</label><input id="arTxt" value="'+esc(rk.txt)+'" autocomplete="off"></div></div>';
  atRkTable();
}
function atRkTable(){
  const t=$("atRkT");if(!t)return;const I=AT.idx,C=AT.C,rk=AT.rk,tx=fnNorm(rk.txt).split(/\s+/).filter(Boolean);
  const L=[];I.rows.forEach((r,j)=>{if(rk.tipo&&r[C.tipo]!==rk.tipo)return;if(rk.setor!==""&&r[C.setor]!==+rk.setor)return;if(r[C.tipo]!=="Tesouro Direto"&&(r[C.liq]||0)<+rk.liq)return;if(tx.length&&!tx.every(w=>AT.sk[j].includes(w)))return;L.push(r)});
  const k=C[rk.sort],d=rk.dir;L.sort((a,b)=>{const x=a[k],y=b[k];if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return typeof x==="string"?d*x.localeCompare(y):d*(x-y)});
  const cols=AT_RKCOLS[rk.tipo==="Ação"||rk.tipo==="Unit"?"acao":AT_FUNDO.has(rk.tipo)?"fii":rk.tipo===""?"acao":"out"];
  const cell=(r,c)=>{const v=r[C[c]];if(c==="t")return '<button type="button" class="link fnnm" data-atopen="'+r[0]+'">'+r[0]+'</button><small>'+esc(r[1])+'</small>';
    if(c==="preco")return 'R$ '+fx(v,2);if(["d1","ra","r12","r36","dy","roe","ml","dd36"].includes(c))return fnPct(v);if(c==="v12")return v!=null?fx(v,2)+'%':'—';
    if(c==="mcap"||c==="liq")return fnMoney(v);if(c==="cot")return fnInt(v);return v!=null?fx(v,c==="pl"||c==="evebit"?1:2):'—'};
  let h='<p class="sub" style="margin:8px 0 4px">'+fx(L.length,0)+' ativos.</p><div class="tablewrap" style="max-height:none"><table class="ctab fnrk"><thead><tr><th>#</th>'+cols.map(([c,l,cl])=>'<th data-atsort="'+c+'" class="'+cl+'"'+(c==="t"?' style="text-align:left"':'')+'>'+l+(rk.sort===c?(rk.dir<0?' ▾':' ▴'):'')+'</th>').join("")+'<th></th></tr></thead><tbody>';
  L.slice(0,rk.n).forEach((r,j)=>{h+='<tr><td><small>'+(j+1)+'</small></td>'+cols.map(([c,,cl])=>'<td class="'+cl+(c==="t"?' tw" style="text-align:left;min-width:150px':'')+'">'+cell(r,c)+'</td>').join("")+'<td><button type="button" class="link" data-atcmp="'+r[0]+'">'+(AT.cmp.includes(r[0])?'✓':'+')+'</button></td></tr>'});
  h+='</tbody></table></div>'+(L.length>rk.n?'<button type="button" class="btn sec" data-atmore="1" style="margin-top:10px">Mostrar mais 50</button>':'')+'<p class="sub" style="font-size:.8rem;margin-top:6px">Retornos com proventos. DY: proventos dos últimos 12 meses ÷ cotação. P/L, P/VP, ROE, margens e dívida pelos últimos balanços entregues à CVM.</p>';
  t.innerHTML=h;
}

function atCmpToggle(k){const i=AT.cmp.indexOf(k);if(i>=0)AT.cmp.splice(i,1);else{if(AT.cmp.length>=CMP_MAX){alertLite("O comparador aceita até "+CMP_MAX+" ativos. Remova um para incluir outro.");return}AT.cmp.push(k)}atSave()}

