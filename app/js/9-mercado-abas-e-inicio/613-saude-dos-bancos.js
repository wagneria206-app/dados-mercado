/* ---------- Saúde dos bancos (IF.data do Banco Central): Basileia, capital, rentabilidade e qualidade do crédito
   Dados do robô scripts/bancos.py (ramo "bancos"). Usado na aba Crédito e na carteira (ao lado do FGC de cada instituição). */
const BK={d:null,err:null,load:null,q:"",abre:null,ord:"risco",nm:null};
function bkBoot(){if(BK.d||BK.load||BK.err)return;BK.load=fetch(DADOS_RAIZ+"bancos/bancos.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(d=>{BK.d=d;BK.load=null;BK.nm=null;bkRefaz()}).catch(e=>{BK.err=e;BK.load=null})}
function bkRefaz(){if(typeof activeMod==="undefined")return;if(activeMod==="cr"&&typeof mkCalc==="function")mkCalc();else if(activeMod==="sp"&&typeof spRun==="function")spRun();else if(activeMod==="bank"&&typeof bkCalc==="function"){bkCalc();if(typeof fgCalc==="function")fgCalc()}}
const bkNome=s=>(typeof rtNome==="function"?rtNome(s):fnNorm(s||"")).replace(/\b(banco|bco|conglomerado|prudencial|multiplo|financeira|credito|financiamento|investimento|investimentos|s a)\b/g," ").replace(/\s+/g," ").trim();
function bkSaudeCalc(b){
  const ds=Object.keys(b.h).sort(),u=b.h[ds[ds.length-1]],a=ds.length>1?b.h[ds[ds.length-2]]:null;
  const al=[];let s=0;
  if(u.basileia!=null){if(u.basileia<11){s+=3;al.push("Basileia perto do mínimo")}else if(u.basileia<13)s+=1}
  if(u.capital_principal!=null&&u.capital_principal<8){s+=1;al.push("pouco capital principal")}
  if(u.risco_eh!=null){if(u.risco_eh>12){s+=3;al.push("muito crédito em risco (E a H)")}else if(u.risco_eh>7){s+=1;al.push("crédito em risco acima do normal")}}
  if(u.roe!=null&&u.roe<0){s+=a&&a.roe!=null&&a.roe<0?3:2;al.push(a&&a.roe!=null&&a.roe<0?"prejuízo em dois trimestres seguidos":"prejuízo no trimestre")}
  if(u.alavancagem!=null&&u.alavancagem<4){s+=1;al.push("alavancagem alta")}
  if(a&&u.basileia!=null&&a.basileia!=null&&a.basileia-u.basileia>2){s+=1;al.push("Basileia caindo")}
  return {d:ds[ds.length-1],u,a,ds,s,al,nivel:s<=1?1:s<=3?2:3};
}
function bkAcha(nome){ // conglomerado pelo nome do emissor (CDB, LCI, LCA, LF…)
  if(!BK.d||!nome)return null;
  if(!BK.nm){BK.nm=[];Object.entries(BK.d.b).forEach(([cod,b])=>(b.n||[]).forEach(n=>{const k=bkNome(n);if(k.length>=3)BK.nm.push([k,cod])}));BK.nm.sort((x,y)=>y[0].length-x[0].length)}
  const k=bkNome(nome);if(k.length<3)return null;
  let hit=BK.nm.find(([n])=>n===k)||BK.nm.find(([n])=>n.length>=5&&(k.startsWith(n+" ")||n.startsWith(k+" ")||k===n));
  if(!hit)hit=BK.nm.find(([n])=>n.length>=6&&(k.includes(n)||n.includes(k)));
  return hit?Object.assign({cod:hit[1]},BK.d.b[hit[1]]):null;
}
const bkMoney=v=>v!=null&&Math.abs(v)>=1e12?'R$ '+fx(v/1e12,2)+' tri':fnMoney(v);
const BK_NV=["","Confortável","Atenção","Frágil"],BK_COR=["","var(--gain)","var(--warn)","var(--loss)"];
function bkSelo(nome){ // selo curto para a carteira
  if(!BK.d){bkBoot();return ""}const b=bkAcha(nome);if(!b)return "";const c=bkSaudeCalc(b);
  return '<span style="display:block;font-size:.8rem"><b style="color:'+BK_COR[c.nivel]+'">Banco: '+BK_NV[c.nivel]+'</b> · Basileia '+(c.u.basileia!=null?fx(c.u.basileia,1)+'%':'—')+(c.al.length?' · '+esc(c.al[0]):'')+'</span>';
}
function bkHtml(){
  if(!BK.d){bkBoot();return BK.err?'<h3>Saúde dos bancos</h3><p class="sub">Esta análise aparece depois da primeira coleta do robô dos bancos no servidor (IF.data do Banco Central).</p>':'<h3>Saúde dos bancos</h3><p class="sub">Carregando os dados dos bancos…</p>'}
  const L=Object.entries(BK.d.b).map(([cod,b])=>Object.assign({cod,n:(b.n||[])[0]||cod,nomes:b.n||[]},bkSaudeCalc(b))).filter(x=>x.u.ativo>=5e8);
  const q=fnNorm(BK.q),V=L.filter(x=>!q||fnNorm(x.nomes.join(" ")).includes(q));
  V.sort(BK.ord==="risco"?(a,b)=>b.s-a.s||(a.u.basileia||99)-(b.u.basileia||99):BK.ord==="tam"?(a,b)=>(b.u.ativo||0)-(a.u.ativo||0):(a,b)=>(a.u.basileia||99)-(b.u.basileia||99));
  const cnt=[1,2,3].map(n=>L.filter(x=>x.nivel===n).length),f=(v,d,s)=>v==null||!isFinite(v)?'—':fx(v,d)+(s||''),dd=d=>d?d.slice(4)+"/"+d.slice(0,4):"—";
  let h='<h3>Saúde dos bancos</h3><p class="sub">Indicadores que o Banco Central publica de cada banco (conglomerado prudencial): capital (índice de Basileia), rentabilidade, tamanho e qualidade da carteira de crédito. Útil para CDB, LCI, LCA e LF acima do limite do FGC e para letras financeiras, que não têm FGC.</p>'
    +'<div class="fnkpis">'+tecKp("Bancos analisados",fx(L.length,0),'ativo acima de R$ 500 milhões · data-base '+dd(BK.d.datas[0]))+[1,2,3].map(n=>tecKp(BK_NV[n],fx(cnt[n-1],0),n===1?'capital folgado e crédito saudável':n===2?'algum indicador no limite':'capital apertado, prejuízo ou crédito ruim')).join("")+'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:end;margin:8px 0"><div class="field" style="min-width:220px;flex:1"><label for="bkQ">Banco</label><input id="bkQ" value="'+esc(BK.q)+'" autocomplete="off" placeholder="nome do banco"></div>'+fnSeg("bkord",[["risco","Mais frágeis primeiro"],["bas","Menor Basileia"],["tam","Maiores"]],BK.ord)+'</div>'
    +'<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Banco</th><th>Situação</th><th>Basileia</th><th class="c-ph">Capital principal</th><th>Rentabilidade (ROE)</th><th class="c-ph">Crédito E a H</th><th class="c-ph c-sm">Ativo total</th></tr></thead><tbody>';
  V.slice(0,80).forEach(x=>{const u=x.u;
    h+='<tr><td style="text-align:left"><button type="button" class="link" data-bkabre="'+esc(x.cod)+'">'+esc(nomeCx(x.n))+'</button>'+(x.al.length?'<br><small>'+esc(x.al.join(", "))+'</small>':'')+'</td><td><b style="color:'+BK_COR[x.nivel]+'">'+BK_NV[x.nivel]+'</b></td><td>'+f(u.basileia,1,'%')+'</td><td class="c-ph">'+f(u.capital_principal,1,'%')+'</td><td><span class="'+(u.roe<0?'neg':'')+'">'+f(u.roe,1,'%')+'</span></td><td class="c-ph">'+f(u.risco_eh,1,'%')+'</td><td class="c-ph c-sm">'+bkMoney(u.ativo)+'</td></tr>';
    if(BK.abre===x.cod)h+='<tr><td colspan="7" style="text-align:left"><div class="label">Evolução por trimestre</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Data-base</th><th>Basileia</th><th>Capital principal</th><th>ROE</th><th>Crédito E a H</th><th>Carteira de crédito</th><th>Patrimônio</th></tr></thead><tbody>'
      +x.ds.slice().reverse().map(d=>{const r=BK.d.b[x.cod].h[d];return '<tr><td style="text-align:left">'+dd(d)+'</td><td>'+f(r.basileia,1,'%')+'</td><td>'+f(r.capital_principal,1,'%')+'</td><td>'+f(r.roe,1,'%')+'</td><td>'+f(r.risco_eh,1,'%')+'</td><td>'+bkMoney(r.credito)+'</td><td>'+bkMoney(r.pl)+'</td></tr>'}).join("")
      +'</tbody></table></div><p class="sub" style="font-size:.8rem">Instituições do conglomerado: '+x.nomes.map(n=>esc(nomeCx(n))).join(", ").replace(/\.$/,"")+'.</p></td></tr>'});
  h+='</tbody></table></div>'+(V.length>80?'<p class="sub">Mostrando 80 de '+V.length+'. Use a busca para achar os demais.</p>':'')
    +'<p class="sub" style="font-size:.8rem">Fonte: Banco Central, IF.data (relatórios Resumo, Informações de Capital e Carteira de crédito por nível de risco), coletado em '+fdate(Date.parse(BK.d.geradoEm))+'. Basileia: patrimônio de referência sobre os ativos ponderados pelo risco; o mínimo exigido com o adicional de conservação é 10,5%. Crédito E a H: parte da carteira nos níveis de risco mais altos da classificação do Banco Central. ROE: lucro do semestre anualizado sobre o patrimônio (aproximado). Situação: classificação do app pelos indicadores, não é nota de agência.</p>';
  return h;
}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-bkabre],[data-bkord]");if(!x)return;if(x.dataset.bkabre)BK.abre=BK.abre===x.dataset.bkabre?null:x.dataset.bkabre;if(x.dataset.bkord)BK.ord=x.dataset.bkord;mkCalc()});
document.addEventListener("input",e=>{if(e.target&&e.target.id==="bkQ"){BK.q=e.target.value;clearTimeout(BK.tq);BK.tq=setTimeout(()=>{mkCalc();const i=$("bkQ");if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},350)}});
