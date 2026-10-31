/* ================= Painel de mercado ================= */
function tdBuyRate(k){const v=TD_ALL[k];if(v&&v.buy!=null&&isFinite(v.buy))return +v.buy;const [kind,d]=k.split("|");const b=txLastBuy(kind,d);return b!=null&&isFinite(b)?b:null}
function tdKeys(){const K=new Set(Object.keys(TD_ALL));txSeries().list.forEach(x=>{const kind=TX_KIND[x.n];if(!kind||kind==="RENDA"||kind==="EDUCA")return;const k=kind+"|"+x.m;if(!K.has(k)&&parseDate(x.m)>VAL&&[...sel.options].some(o=>o.value===k)&&txLastBuy(kind,x.m)!=null)K.add(k)});return [...K]}
function tdName(k){const o=[...sel.options].find(o=>o.value===k);return o?o.textContent.split(" · ")[0]:k.replace("|"," ")}
function oppData(){
  const out=[];tdKeys().forEach(k=>{const v={buy:tdBuyRate(k)};if(v.buy==null)return;const [kind,d]=k.split("|");const n=TX_KIND.indexOf(kind);if(n<0)return;
    const s=txIndex().get(n+"|"+txMatFromKind(kind,d));const vals=s?s.c.filter(x=>x!=null&&isFinite(x)):[];
    const below=vals.filter(x=>x<v.buy).length,pctl=vals.length>30?below/vals.length*100:NaN;
    const yr=s?s.c.filter((x,i)=>x!=null&&s.t[i]>VAL-365*DAY):[],avg=yr.length?yr.reduce((a,b)=>a+b,0)/yr.length:NaN;
    const ak=kind==="NTNBP"||kind==="RENDA"||kind==="EDUCA"?null:kind,arow=ak?(MKT[ak]||[]).find(x=>x[0]===d):null;
    const fam=KIND[kind]?KIND[kind].fam:"";
    out.push({k,kind,d,fam,name:tdName(k),buy:v.buy,pctl,min:vals.length?Math.min(...vals):NaN,max:vals.length?Math.max(...vals):NaN,avg,n:vals.length,since:s&&s.t.length?s.t[0]:NaN,anb:arow&&isFinite(arow[1])?arow[1]:NaN,mat:parseDate(d)})});
  return out;
}

function oppHtml(){
  const L=oppData().sort((a,b)=>(isFinite(b.pctl)?b.pctl:-1)-(isFinite(a.pctl)?a.pctl:-1));if(!L.length)return '<p class="sub">Sem taxas de compra do Tesouro Direto nos dados de hoje.</p>';
  const fr=(o,v)=>!isFinite(v)?"—":(o.fam==="ipca"?"IPCA + ":o.fam==="selic"?"Selic + ":"")+fx(v,2)+"%";
  let h='<span class="label">Oportunidades no Tesouro Direto</span><p class="sub" style="margin:4px 0 10px">Taxa de compra de hoje comparada com toda a história de cada título. Percentil 90 = a taxa de hoje é maior que em 90% dos dias desde o lançamento. Toque no nome do título para ver o histórico de taxas.</p><div class="tablewrap" style="max-height:none"><table class="ctab opptab"><thead><tr><th style="text-align:left">Título</th><th>Compra hoje</th><th>Percentil histórico</th><th class="c-ph">Mín. · máx.</th><th class="c-ph">Média 12m</th><th class="c-ph">vs ANBIMA</th></tr></thead><tbody>';
  L.forEach((o,i)=>{if(i===10)h+='</tbody><tbody class="oppmore" hidden>';const p=o.pctl,cls=p>=90?"hi":p>=70?"md":"";h+='<tr><td style="text-align:left"><button type="button" class="link opptx" data-txgo="'+TX_KIND.indexOf(o.kind)+'|'+txMatFromKind(o.kind,o.d)+'" data-oppk="'+o.k+'" title="Ver o histórico de taxas deste título"><b>'+o.name.replace(/^Tesouro /,"")+'</b> <small aria-hidden="true">›</small></button>'+(p>=90?' <span class="ttag k-bank">taxa alta</span>':'')+'<br><small>desde '+(isFinite(o.since)?txD2(o.since):"—")+'</small></td><td>'+fr(o,o.buy)+'</td><td><div class="pbar '+cls+'"><i style="width:'+(isFinite(p)?p.toFixed(0):0)+'%"></i></div><small>'+(isFinite(p)?fx(p,0):"—")+'</small></td><td class="c-ph">'+(isFinite(o.min)?fx(o.min,2)+' · '+fx(o.max,2):"—")+'</td><td class="c-ph">'+(isFinite(o.avg)?fx(o.avg,2):"—")+'</td><td class="c-ph">'+(isFinite(o.anb)?signed(o.buy-o.anb,v=>fx(v,2)):"—")+'</td></tr>'});
  return h+'</tbody></table></div>'+(L.length>10?'<p style="margin-top:8px"><button type="button" class="link" id="oppMore">Mostrar todos os '+L.length+' títulos</button></p>':'')+'<p class="sub" style="font-size:.82rem;margin-top:6px">Histórico oficial do Tesouro Transparente. "vs ANBIMA": taxa de compra do Tesouro menos a taxa indicativa da ANBIMA para o mesmo vencimento (positivo = o Tesouro vende mais barato que a referência de mercado). Taxa historicamente alta não é garantia de ganho: é o ponto de partida da análise.</p>';
}
function inflHtml(){
  const L=ntnbCurve();
  let h='<span class="label">Inflação implícita e projeção usada no aplicativo</span><div class="scctl" style="margin-top:8px"><div class="field"><label for="piMode">Projeção de IPCA</label><select id="piMode"><option value="impl">Inflação implícita do mercado, por prazo (ANBIMA) — recomendado</option><option value="m12">Média dos últimos 12 meses ('+fx(ipca12(),2)+'%)</option></select></div>';
  h+='</div><p class="sub" id="piMsg" style="margin-top:8px">Em uso: '+piModeName()+'.</p>';
  h+='<p class="sub" style="font-size:.82rem;margin-top:6px">A projeção vale para todo o aplicativo: valor futuro dos títulos IPCA+, cenários, escada e análise de troca.</p>';
  if(L.length){h+='<div class="tablewrap" style="max-height:none;margin-top:10px"><table class="ctab"><thead><tr><th style="text-align:left">Vencimento NTN-B</th><th>Juro real</th><th>Prefixado (curva)</th><th>Inflação implícita</th></tr></thead><tbody>';
    L.forEach(([t,r])=>{const n=zeroPre(du(VAL,t)),ii=((1+n/100)/(1+r/100)-1)*100;
      h+='<tr><td style="text-align:left">'+fdate(t)+'</td><td>'+fx(r,2)+'%</td><td>'+fx(n,2)+'%</td><td><b>'+fx(ii,2)+'%</b></td></tr>'});
    {const RR=L.map(([t,r])=>{const n=zeroPre(du(VAL,t));return {t,r,n,ii:((1+n/100)/(1+r/100)-1)*100,a:(t-VAL)/DAY/365.25}});
     const med=(lab,S,forte)=>{if(!S.length)return "";const m=k=>S.reduce((s,x)=>s+x[k],0)/S.length;
       return '<tr class="'+(forte?'mtot':'msub')+'"><td style="text-align:left">'+lab+' <small>('+S.length+' venc.)</small></td><td>'+fx(m("r"),2)+'%</td><td>'+fx(m("n"),2)+'%</td><td><b>'+fx(m("ii"),2)+'%</b></td></tr>'};
     h+='</tbody><tfoot>'+med("Média — até 5 anos",RR.filter(x=>x.a<=5))+med("Média — de 5 a 10 anos",RR.filter(x=>x.a>5&&x.a<=10))+med("Média — acima de 10 anos",RR.filter(x=>x.a>10))+med("Média de todos os vencimentos",RR,true)+'</tfoot>'}
    h+='</table></div><p class="sub" style="font-size:.82rem;margin-top:6px">Médias simples dos vencimentos de cada faixa (prazo contado a partir de hoje). Inflação implícita = (1 + taxa prefixada da curva ANBIMA) ÷ (1 + juro real da NTN-B) − 1, para cada prazo. Se o IPCA ficar acima dela, o IPCA+ rende mais que o prefixado de mesmo prazo; abaixo, o prefixado vence. IPCA dos últimos 12 meses: '+fx(ipca12(),2)+'%.</p>'}
  return h;
}


function oppRender(){const o=$("txOpp");if(o)o.innerHTML=oppHtml()}
function mkCalc(){const o=$("mkOut");if(!o)return;const P=x=>x?'<section class="panel">'+x+'</section>':'';let h="";
  try{if(activeMod==="rs")h=P(painelHtml())+P(rsHtml())+P(fluxoHtml())+P(agendaHtml())+P(basesHtml());
  else if(activeMod==="fv")h=favHtml();
  else if(activeMod==="ec")h=economiaHtml().map(P).join("");
  else if(activeMod==="mu")h=mundoHtml().map(P).join("");
  else if(activeMod==="ju")h=P(diHtml())+P(curvHtml())+P(titHtml())+P(euaHtml()+euTreasuryHtml());
  else if(activeMod==="cr")h=P(crHtml())+P(debHtml());
  else if(activeMod==="in")h=P(ipcaHtml())+P(inflHtml())+'<p class="sub" style="margin:4px 4px 12px">O calendário das próximas divulgações do IBGE está na aba Economia.</p>';
  else if(activeMod==="ix")h=P(imaHtml())}catch(e){h=P('<p class="err">Não deu para montar esta tela: '+esc(String(e&&e.message||e))+'</p>')}
  o.innerHTML=h;const s=$("piMode");if(s)s.value=PI_MODE}
let TX_BACK=null;
async function mkClick(e){
  const g=e.target.closest&&e.target.closest("[data-txgo]");if(g){const [n,m]=g.dataset.txgo.split("|");TX_BACK=g.dataset.oppk;
    txFillTypes();$("txType").value=n;$("txSide").value="c";TXSEL={n:+n,m};txCalc();const b=$("txBack");if(b)b.hidden=false;try{$("txHistTop").scrollIntoView({behavior:"smooth",block:"start"})}catch(x){}return}
  if(e.target.id==="oppMore"){const b=(e.target.closest("#txOpp,#mkOut")||document).querySelector(".oppmore");if(b){b.hidden=!b.hidden;e.target.textContent=b.hidden?"Mostrar todos os "+(10+b.rows.length)+" títulos":"Mostrar só os 10 primeiros"}return}
  if(e.target.id==="piSave"){
    PI_MODE=$("piMode").value;if(PI_MODE!=="m12")PI_MODE="impl";
    try{localStorage.setItem("piMode2",PI_MODE)}catch(x){}SETTINGS.piMode=PI_MODE;PIF_CACHE.clear();RAWC.clear();
    mkCalc();$("piMsg").textContent="Em uso: "+piModeName()+". Vale para todo o aplicativo.";return}
}

