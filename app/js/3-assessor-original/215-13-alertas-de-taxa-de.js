/* ---------- 13. alertas de taxa de qualquer título do Tesouro ---------- */
let WATCH={};

function txKey(n,m){const k=TX_KIND[n];if(!k)return null;const y=+m.slice(0,4);return {kind:k,d:n===2?(y-19)+"-01-15":n===3?(y-4)+"-01-15":m}}
function watchRender(){
  const box=$("txWatch");if(!box||!TXSEL)return;const n=+$("txType").value,m=$("txMat").value,key=txKey(n,m),side=$("txSide").value;
  const S=txSeries(),s=S.list.find(x=>x.n===n&&x.m===m),act=s&&s.t[s.t.length-1]>=S.now;
  let h='';
  if(!key||!act)h+='<p class="sub" style="font-size:.88rem">Alertas de taxa estão disponíveis para títulos à venda no Tesouro Direto.</p>';
  else{const cur=side==="c"?s.c[s.c.length-1]:s.v[s.v.length-1];
    h+='<div class="watchrow"><span>Avisar no celular quando a taxa de <b>'+(side==="c"?"compra":"venda")+'</b> deste título</span><select id="wDir"><option value="ge">subir até</option><option value="le">cair até</option></select><div class="affix s" style="width:120px"><input id="wRate" inputmode="decimal" placeholder="'+(cur!=null?fx(cur,2):"")+'"><span class="suf">%</span></div><button type="button" class="btn sec" id="wSave">Criar alerta</button><span class="sub" id="wMsg"></span></div>'}
  const L=Object.values(WATCH).filter(w=>w.active).sort((a,b)=>(a.setAt||"").localeCompare(b.setAt||""));
  if(L.length)h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab"><tbody>'+L.map(w=>'<tr><td style="text-align:left">🔔 '+esc(w.desc)+(w.lastFired?'<br><small>último aviso em '+fdt(w.lastFired)+(w.lastRate!=null?' (taxa '+fx(+w.lastRate,2)+'%)':'')+'</small>':'')+'</td><td><button type="button" class="link" data-wdel="'+esc(w.id)+'">Remover</button></td></tr>').join("")+'</tbody></table></div>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Conferido a cada atualização diária de dados (dias úteis, 20h10) com as taxas oficiais do Tesouro; repete no máximo a cada 3 dias.</p>';
  box.innerHTML=h;
}


