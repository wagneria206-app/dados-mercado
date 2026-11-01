/* ---------- crédito, FGC e fluxo de caixa da carteira
   Renda fixa: produto (CDB, LCI, LCA… ou debênture, CRI, CRA), emissor e vencimento de cada item.
   FGC: garantia de até R$ 250 mil por CPF por instituição ou conglomerado financeiro (teto global de R$ 1 milhão a cada 4 anos).
   Fluxo de caixa: vencimentos e cupons do Tesouro, vencimentos da renda fixa, proventos anunciados na B3 e come-cotas dos fundos. */
const SP_PROD={CDB:1,RDB:1,LC:1,LCI:1,LCA:1,LIG:1,"Poupança":1,LCD:0,"Debênture":0,CRI:0,CRA:0,"Outro":0};
const SP_FGC=250000,SP_FGC_GLOBAL=1000000,SP_EMIS_LIM=10;
function spProd(x){if(x.prod&&x.prod in SP_PROD)return x.prod;if(x.t!=="s")return null;
  if(/^cr:/.test(x.k||""))return /CRI/.test(x.tipo||x.n||"")?"CRI":/CRA/.test(x.tipo||x.n||"")?"CRA":"Debênture";
  const n=" "+String(x.n||"").toUpperCase()+" ";const m=/\b(LCI|LCA|LCD|LIG|CDB|RDB|LC)\b/.exec(n);if(m)return m[1];if(/POUPAN/.test(n))return "Poupança";
  if(/\bDEB[EÊ]NTURE/.test(n))return "Debênture";if(/\bCRI\b/.test(n))return "CRI";if(/\bCRA\b/.test(n))return "CRA";return null}
const spCr=x=>{if(!/^cr:/.test(x.k||"")||!SP_CRED.L)return null;const cod=x.k.slice(3);return SP_CRED.L.find(o=>o.cod===cod)||null};
function spEmissor(x){if(x.em)return String(x.em).trim();const c=spCr(x);if(c)return nomeCx(c.nome);if(/^cr:/.test(x.k||"")){const m=/·\s*([^(]+)/.exec(x.n||"");return m?m[1].trim():""}return ""}
/* Tesouro Direto: tipo e data de vencimento pelo código do item (TD-IPCA-2035…) */
const SP_TDK={SELIC:"LFT",PRE:"LTN",PREJ:"NTNF",IPCA:"NTNBP",IPCAJ:"NTNB",EDUCA:"EDUCA",RENDA:"RENDA"};
function spTd(x){const m=/^TD-([A-Z]+)-(\d{4})$/.exec(x.k||"");if(!m||!SP_TDK[m[1]])return null;const kind=SP_TDK[m[1]],y=+m[2];
  let d=Object.keys(typeof TD_ALL==="object"&&TD_ALL||{}).map(k=>k.split("|")).find(([k,dd])=>k===kind&&dd.slice(0,4)===String(y));d=d?d[1]:null;
  if(!d)d=kind==="LFT"?y+"-03-01":kind==="LTN"||kind==="NTNF"?y+"-01-01":kind==="EDUCA"||kind==="RENDA"?y+"-01-15":y+(y%2?"-05-15":"-08-15");
  return {kind,d,ini:parseDate(d),mat:matOf(kind,d),K:KIND[kind]}}
function spVenc(x){if(x.venc&&/^\d{4}-\d{2}-\d{2}$/.test(x.venc))return {d:x.venc,fonte:"informado"};const c=spCr(x);if(c&&c.venc)return {d:c.venc,fonte:"ANBIMA"};
  const t=spTd(x);if(t)return {d:new Date(t.mat).toISOString().slice(0,10),fonte:"Tesouro"};return null}

/* exposição por emissor: FGC (produtos cobertos) e crédito privado (concentração por emissor) */
function spCredito(c,it){
  const {w,tot,real}=spPesos(c,it),G=new Map(),sem=[];
  it.forEach((x,i)=>{const v=w[i]*tot;if(!(v>0))return;const p=spProd(x);if(!p&&x.t==="s"&&!/^cr:/.test(x.k||"")){sem.push(x);return}if(!p)return;
    const em=spEmissor(x)||"(emissor não informado)",k=fnNorm(em),g=G.get(k)||{em,fgc:0,cred:0,itens:[]};if(SP_PROD[p])g.fgc+=v;else g.cred+=v;g.itens.push({x,p,v});G.set(k,g)});
  const L=[...G.values()].map(g=>Object.assign(g,{tot:g.fgc+g.cred,pc:tot>0?(g.fgc+g.cred)/tot*100:0,acima:Math.max(0,g.fgc-SP_FGC)})).sort((a,b)=>b.tot-a.tot);
  const fgc=L.reduce((a,g)=>a+g.fgc,0);
  return {L,tot,real,fgc,acima:L.reduce((a,g)=>a+g.acima,0),semEm:L.filter(g=>/não informado/.test(g.em)),sem,global:Math.min(fgc,SP_FGC_GLOBAL)}}

/* eventos de caixa previstos nos próximos 12 meses */
function spFluxo(c,it,R){
  const {w,tot}=spPesos(c,it),h=Date.parse(spHoje()+"T00:00:00Z"),fim=addMonths(h,12),E=[];
  const add=(t,x,ev,v,obs)=>{if(t>=h&&t<=fim)E.push({t,x,ev,v,obs})};
  if(!AG.dados&&!AG.load&&!AG.err){AG.load=atGet("agenda.json").then(j=>{AG.dados=j;AG.load=null;if(activeMod==="sp")spCalc()}).catch(e=>{AG.err=e;AG.load=null})}
  const cc=new Set();
  it.forEach((x,i)=>{const v=w[i]*tot;if(!(v>0))return;
    const td=spTd(x);
    if(td){const K=td.K,r=AT.idx&&atRow(x.k),pu=r&&r[AT.C.preco]>0?r[AT.C.preco]:null,q=pu?v/pu:null;
      if(K.b1){const n=K.b1,ini=td.ini;let k=0;for(let j=0;j<n;j++){const t=addMonths(ini,j);if(t>=h&&t<=fim)k++}
        const rest=Math.max(1,n-Math.max(0,Math.round((h-ini)/(30.44*DAY))));if(k)add(Math.max(ini,h+DAY),x,k+" parcelas mensais (dia 15)",v/rest*k,"estimado: valor de hoje ÷ parcelas restantes")}
      else{if(K.cpn)couponDates(td.mat,h,fim).forEach(t=>{const vna=K.fam==="ipca"&&typeof vnaFor==="function"?vnaFor(td.kind,h):null;
          const cup=td.kind==="NTNF"?(q?q*CPN_F:v*0.0488):(q&&vna?q*vna*CPN_B/100:v*CPN_B/100);add(t,x,"Cupom de juros",cup,"estimado")});
        add(td.mat,x,"Vencimento",td.kind==="LTN"||td.kind==="NTNF"?(q?q*1000:v):v,td.kind==="LTN"||td.kind==="NTNF"?"R$ 1.000 por título":"valor de hoje")}
      return}
    if(x.t==="s"){const vc=spVenc(x);if(vc)add(Date.parse(vc.d+"T00:00:00Z"),x,"Vencimento",v,"valor de hoje; no vencimento soma os juros");return}
    if(x.t==="a"&&AG.dados){const hj=spHoje();AG.dados.rows.filter(r=>r[0]===x.k&&((r[4]&&r[4]>=hj&&r[4]<"9000")||r[3]>=hj)).forEach(r=>{const NM={D:"Dividendo",J:"JCP",R:"Rendimento",A:"Amortização"};
        const t=r[4]&&r[4]<"9000"?Date.parse(r[4]+"T00:00:00Z"):Date.parse(r[3]+"T00:00:00Z");add(t,x,(NM[r[2]]||"Provento")+(r[4]&&r[4]<"9000"?"":" (data com; pagamento a definir)"),r[6]!=null?v*r[6]/100:null,"estimado pelo % da cotação"+(r[2]==="J"?"; JCP tem 15% de IR na fonte":""))});return}
    if(x.t==="f"){const D=R&&R.D?R.D[it.indexOf(x)]:null;if(D&&(D.reg==="lp"||D.reg==="cp"))cc.add(x)}});
  // come-cotas: último dia útil de maio e de novembro
  if(cc.size){for(let m=0;m<13;m++){const d=new Date(addMonths(h,m)),mo=d.getUTCMonth();if(mo!==4&&mo!==10)continue;let t=utc(d.getUTCFullYear(),mo+1,1)-DAY;while(!isBiz(t))t-=DAY;
    add(t,null,"Come-cotas em "+cc.size+(cc.size>1?" fundos":" fundo"),null,[...cc].map(x=>spItemNome(x).slice(0,30)).slice(0,3).join("; ")+(cc.size>3?"…":"")+" · 15% (longo prazo) ou 20% (curto prazo) sobre o ganho do semestre")}}
  return E.sort((a,b)=>a.t-b.t)}

function spCreditoHtml(c,it,R){
  if(!it.length)return "";if(!SP_CRED.L&&it.some(x=>/^cr:/.test(x.k||"")))spCredLoad();
  const C=spCredito(c,it),F=spFluxo(c,it,R),pc=v=>fx(v,1)+'%',kp=(a,b,cc,cls)=>'<div class="fnkp'+(cls?' '+cls:'')+'"><span>'+a+'</span><b>'+b+'</b>'+(cc?'<small>'+cc+'</small>':'')+'</div>';
  const h30=Date.parse(spHoje()+"T00:00:00Z")+30*DAY,s=a=>a.reduce((t,e)=>t+(e.v||0),0),prox=F[0];
  let h='<section class="panel" data-reltit="Crédito, FGC e fluxo de caixa"><h3>Crédito, FGC e fluxo de caixa</h3><p class="sub">Exposição por instituição e por emissor de crédito, cobertura do FGC e o que deve cair na conta nos próximos 12 meses.'+(C.real?'':' Valores pela proposta (valor inicial × pesos).')+'</p>';
  h+='<div class="fnkpis">'+kp("Coberto pelo FGC",brl(C.fgc),C.tot>0?pc(C.fgc/C.tot*100)+' da carteira':'')
    +kp("Acima do limite do FGC",C.acima>0?'<span class="neg">'+brl(C.acima)+'</span>':'<span class="pos">R$ 0</span>',C.acima>0?'em '+C.L.filter(g=>g.acima>0).length+' instituição(ões), acima de R$ 250 mil cada':'nenhuma instituição acima de R$ 250 mil',C.acima>0?'kpalerta':'')
    +kp("Maior emissor",C.L.length?pc(C.L[0].pc):'—',C.L.length?esc(C.L[0].em).slice(0,36):'sem renda fixa de emissor privado',C.L.length&&C.L[0].pc>SP_EMIS_LIM&&C.L[0].cred>0?'kpalerta':'')
    +kp("Caixa nos próximos 30 dias",brl(s(F.filter(e=>e.t<=h30))),F.filter(e=>e.t<=h30).length+' evento(s)')
    +kp("Caixa em 12 meses",brl(s(F)),F.length+' evento(s) previstos')
    +kp("Próximo evento",prox?fdate(prox.t):'—',prox?esc(prox.ev).slice(0,40):'nenhum evento previsto')+'</div>';
  if(C.L.length)h+='<div class="label" style="margin-top:10px">Por instituição ou emissor</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab"><thead><tr><th style="text-align:left">Instituição / emissor</th><th>Coberto pelo FGC</th><th>Sem FGC (crédito)</th><th>% da carteira</th><th style="text-align:left">Situação</th></tr></thead><tbody>'
    +C.L.map(g=>'<tr><td style="text-align:left" class="tw">'+esc(g.em)+'<small style="display:block;color:var(--muted)">'+g.itens.map(o=>o.p).filter((v,i,a)=>a.indexOf(v)===i).join(", ")+' · '+g.itens.length+(g.itens.length>1?' itens':' item')+'</small></td><td>'+(g.fgc?brl(g.fgc):'—')+'</td><td>'+(g.cred?brl(g.cred):'—')+'</td><td>'+pc(g.pc)+'</td><td style="text-align:left">'
      +(g.acima>0?'<span class="neg">'+brl(g.acima)+' sem garantia do FGC</span>':g.fgc?'<span class="pos">dentro do limite do FGC</span>':'')+(g.cred>0&&g.pc>SP_EMIS_LIM?(g.acima>0||g.fgc?'<br>':'')+'<span class="neg">concentração acima de '+SP_EMIS_LIM+'% em um só emissor</span>':'')+(/não informado/.test(g.em)?'<span class="warn">informe o emissor no item</span>':'')+'</td></tr>').join("")+'</tbody></table></div>';
  if(C.sem.length)h+='<p class="warn" style="font-size:.84rem;margin-top:6px">'+C.sem.length+(C.sem.length>1?' itens de renda fixa sem o tipo de produto':' item de renda fixa sem o tipo de produto')+' ('+C.sem.slice(0,3).map(x=>esc(spItemNome(x)).slice(0,30)).join("; ")+'): escolha na composição se é CDB, LCI, LCA, debênture… e o emissor, para calcular o FGC.</p>';
  if(F.length)h+='<div class="label" style="margin-top:12px">Fluxo de caixa previsto (12 meses)</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab"><thead><tr><th style="text-align:left">Data</th><th style="text-align:left">Item</th><th style="text-align:left">Evento</th><th>Valor estimado</th></tr></thead><tbody>'
    +F.map(e=>'<tr><td style="text-align:left">'+fdate(e.t)+'</td><td style="text-align:left" class="tw">'+(e.x?esc(spItemNome(e.x)).slice(0,48):'—')+'</td><td style="text-align:left">'+esc(e.ev)+(e.obs?'<small style="display:block;color:var(--muted)">'+esc(e.obs)+'</small>':'')+'</td><td>'+(e.v!=null?brl(e.v):'—')+'</td></tr>').join("")+'</tbody></table></div>';
  else h+='<p class="sub" style="margin-top:8px">Nenhum vencimento, cupom ou provento anunciado nos próximos 12 meses para os itens desta carteira'+(AG.load?' (carregando a agenda de proventos…)':'')+'. Informe o vencimento dos itens de renda fixa na composição.</p>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">FGC: garante até R$ 250 mil por CPF por instituição ou conglomerado financeiro (somando principal e juros) e até R$ 1 milhão no total a cada 4 anos; cobre CDB, RDB, LC, LCI, LCA, LIG e poupança, não cobre debêntures, CRI, CRA, fundos nem Tesouro (que tem garantia do Tesouro Nacional). Escreva o emissor pelo nome do conglomerado para somar corretamente bancos do mesmo grupo. Concentração: alerta quando um só emissor de crédito passa de '+SP_EMIS_LIM+'% da carteira. Fluxo: cupons e vencimentos do Tesouro pelo calendário oficial dos títulos (valores estimados pela posição de hoje); renda fixa pelo vencimento informado ou da ANBIMA; proventos anunciados na B3 (estimados pelo % da cotação); come-cotas no último dia útil de maio e de novembro.</p></section>';
  return h}

/* campos de renda fixa de cada item na composição: produto, emissor e vencimento */
function spAjRf(it,j){if(it.t!=="s"||spTd(it))return "";const p=spProd(it),cr=/^cr:/.test(it.k||""),vc=spVenc(Object.assign({},it,{venc:null}));
  const ems=[...new Set(SP.carts.flatMap(c=>c.itens.map(x=>x.em)).filter(Boolean))].sort();
  return '<div class="spaj"><select data-spprod="'+j+'" aria-label="Tipo de produto"><option value="">Produto?</option>'+Object.keys(SP_PROD).map(k=>'<option value="'+k+'"'+(p===k?' selected':'')+'>'+k+(SP_PROD[k]?' (FGC)':'')+'</option>').join("")+'</select>'
    +'<label class="spajl">Emissor<input data-spem="'+j+'" list="spEmL" maxlength="50" value="'+esc(it.em||"")+'" placeholder="'+esc(cr?spEmissor(Object.assign({},it,{em:""}))||"emissor":"banco ou conglomerado")+'" style="width:150px"></label>'
    +'<label class="spajl">Vencimento<input type="date" data-spvenc="'+j+'" value="'+esc(it.venc||"")+'"'+(vc?' title="ANBIMA: '+vc.d+'"':'')+'></label>'
    +(j===spC().itens.findIndex(x=>x.t==="s"&&!spTd(x))?'<datalist id="spEmL">'+ems.map(e=>'<option value="'+esc(e)+'">').join("")+'</datalist>':'')+'</div>'}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||activeMod!=="sp")return;const c=spC();let j;
  if((j=t.dataset.spprod)!=null){const it=c.itens[+j];if(!it)return;it.prod=t.value||undefined;spSave();spCalc();return}
  if((j=t.dataset.spem)!=null){const it=c.itens[+j];if(!it)return;it.em=t.value.trim()||undefined;spSave();spCalc();return}
  if((j=t.dataset.spvenc)!=null){const it=c.itens[+j];if(!it)return;it.venc=t.value||undefined;spSave();spCalc();return}});
