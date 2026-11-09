/* ---------- Insiders: compras e vendas de controladores, conselheiros e diretores (CVM, Resolução 44) */
// Dados do robô scripts/insiders.py, ramo "insiders". Sem o arquivo (antes da primeira coleta), as seções somem.
const INS={d:null,err:null,load:null,emp:null};
function insBoot(){
  if(INS.d||INS.load||INS.err)return INS.load;
  INS.load=Promise.all([fetch(DADOS_RAIZ+"insiders/insiders.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}),atGet("emp.json").catch(()=>null)])
    .then(([d,e])=>{INS.d=d;INS.emp=e;INS.load=null;if(activeMod==="aa"&&typeof atAa==="function")atAa();else if(activeMod==="sem")mkCalc()})
    .catch(e=>{INS.err=e;INS.load=null});
  return INS.load;
}
function insTicker(cnpj){ // ação mais líquida da companhia
  if(!INS.emp||!AT.idx)return null;const C=AT.C;let raiz=null;for(const k in INS.emp){if(INS.emp[k]&&INS.emp[k].cnpj===cnpj){raiz=k;break}}if(!raiz)return null;
  let best=null;AT.idx.rows.forEach(r=>{if(r[0].startsWith(raiz)&&(r[C.tipo]==="Ação"||r[C.tipo]==="Unit")&&(!best||(r[C.liq]||0)>(best[C.liq]||0)))best=r});return best;
}
function insSaldo(c,meses,grupos){ // compras − vendas nos últimos "meses" meses com dados
  const ks=Object.keys(c.m).sort().slice(-meses);let cp=0,vd=0;ks.forEach(k=>{const m=c.m[k];Object.keys(m).forEach(g=>{if(grupos&&!grupos.includes(g))return;cp+=m[g][0];vd+=m[g][1]})});return {cp,vd,s:cp-vd};
}
function atInsHtml(A){
  if(!A.cnpj||A.tipo==="ETF"||AT_FUNDO.has(A.tipo))return "";
  if(!INS.d){insBoot();return ""}
  const c=INS.d.cias[A.cnpj];
  if(!c)return '<section class="panel"><h3>Negociações de administradores e controladores</h3><p class="sub">Nenhuma compra ou venda de ações informada à CVM nos últimos 24 meses por controladores, conselheiros ou diretores desta companhia.</p></section>';
  const G=INS.d.grupos,sg=v=>'<span class="'+(v>0?'pos':v<0?'neg':'')+'">'+(v>0?'+':'')+fnMoney(v)+'</span>';
  const p=["ctl","cons","dir","out"],s3=insSaldo(c,3,p),s12=insSaldo(c,12,p),rc=insSaldo(c,12,["cia"]);
  let h='<section class="panel"><h3>Negociações de administradores e controladores</h3><div class="fnkpis">'
    +tecKp("Saldo em 3 meses",sg(s3.s),'compras '+fnMoney(s3.cp)+' · vendas '+fnMoney(s3.vd))
    +tecKp("Saldo em 12 meses",sg(s12.s),'compras '+fnMoney(s12.cp)+' · vendas '+fnMoney(s12.vd))
    +(rc.cp||rc.vd?tecKp("Recompra pela companhia (12 meses)",fnMoney(rc.cp),rc.vd?'vendas da tesouraria '+fnMoney(rc.vd):'ações compradas pela própria empresa'):'')+'</div>';
  const ks=Object.keys(c.m).sort(),pts=ks.map(k=>{const m=c.m[k];let v=0;p.forEach(g=>{if(m[g])v+=m[g][0]-m[g][1]});return [Date.UTC(+k.slice(0,4),+k.slice(4)-1,15),v/1e6]});
  if(pts.length>1)h+='<div class="label">Compras menos vendas por mês (R$ milhões; sem a recompra da companhia)</div>'+fnChart([{lab:"Saldo",col:"var(--accent)",pts}],{fmt:"num",bars:true,zero:true,h:160,months:true,aria:"Saldo de insiders"});
  if(c.ult&&c.ult.length)h+='<div class="label" style="margin-top:10px">Maiores negociações nos últimos 6 meses</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Data</th><th style="text-align:left">Quem</th><th>Operação</th><th class="c-ph">Quantidade</th><th class="c-ph">Preço</th><th>Volume</th></tr></thead><tbody>'
    +c.ult.map(x=>'<tr><td style="text-align:left">'+fdate(Date.parse(x[0]+"T00:00:00Z"))+'</td><td style="text-align:left">'+esc(G[x[1]]||x[1])+'</td><td><span class="'+(x[2]>0?'pos':'neg')+'">'+(x[2]>0?'Compra':'Venda')+'</span></td><td class="c-ph">'+(x[3]!=null?fx(x[3],0):'—')+'</td><td class="c-ph">'+(x[4]!=null?'R$ '+fx(x[4],2):'—')+'</td><td>'+fnMoney(x[5])+'</td></tr>').join("")+'</tbody></table></div>';
  return h+'<p class="sub" style="font-size:.8rem">Fonte: CVM, formulários mensais de valores mobiliários negociados e detidos (Resolução CVM 44, art. 11), atualizados até '+fdate(Date.parse(INS.d.ate+"T00:00:00Z"))+'. A companhia entrega o formulário até 10 dias depois do fim de cada mês; os nomes das pessoas não são divulgados.</p></section>';
}
function insSemanaHtml(){ // maiores saldos de compra e de venda nos 2 meses mais recentes, para o Resumo da semana
  if(!INS.d){insBoot();return ""}if(!AT.idx)return "";
  const C=AT.C,L=[];Object.entries(INS.d.cias).forEach(([cnpj,c])=>{const s=insSaldo(c,2,["ctl","cons","dir","out"]);if(Math.abs(s.s)<1e6)return;const r=insTicker(cnpj);if(r)L.push({r,s:s.s})});
  if(!L.length)return "";L.sort((a,b)=>b.s-a.s);
  const lin=x=>'<tr><td style="text-align:left"><button type="button" class="link" data-atopen="'+x.r[0]+'">'+x.r[0]+'</button> <small>'+esc(x.r[1])+'</small></td><td><span class="'+(x.s>0?'pos':'neg')+'">'+(x.s>0?'+':'')+fnMoney(x.s)+'</span></td></tr>';
  const cp=L.filter(x=>x.s>0).slice(0,5),vd=L.filter(x=>x.s<0).slice(-5).reverse();
  return '<h3>Insiders: quem está comprando e vendendo</h3><p class="sub" style="font-size:.82rem">Saldo de compras menos vendas de controladores, conselheiros e diretores nos 2 meses mais recentes informados à CVM (acima de R$ 1 milhão).</p>'
    +(cp.length?'<div class="label" style="margin-top:8px">Maiores compras líquidas</div><div class="tablewrap" style="max-height:none"><table class="ctab"><tbody>'+cp.map(lin).join("")+'</tbody></table></div>':'')
    +(vd.length?'<div class="label" style="margin-top:8px">Maiores vendas líquidas</div><div class="tablewrap" style="max-height:none"><table class="ctab"><tbody>'+vd.map(lin).join("")+'</tbody></table></div>':'');
}
