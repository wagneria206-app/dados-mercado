/* ===== Agenda de proventos, situação das bases, app instalável e importação de posição ===== */
const AG={dados:null,load:null,err:null,f:{tipo:"",modo:"com",txt:""}};
function agCalc(){
  const o=$("fnOut");if(!o)return;
  if(FN.view!=="ag"){FN.view="ag";o.innerHTML='<section class="panel"><h3>Agenda de proventos</h3><p class="sub">Dividendos, JCP e rendimentos anunciados na B3: próximas datas com (último dia para ter o ativo e receber) e próximos pagamentos.</p><div id="agF"></div><div id="agT"></div></section>'}
  if(!AG.dados){
    if(AG.err){$("agT").innerHTML='<p class="warn">A agenda ainda não está disponível. Ela aparece depois da próxima coleta do robô de ativos.</p>';return}
    $("agT").innerHTML='<p class="sub">Carregando…</p>';
    if(!AG.load)AG.load=Promise.all([atGet("agenda.json"),AT.idx?null:atBoot()]).then(([j])=>{AG.dados=j;AG.load=null;if(activeMod==="ag")agCalc()}).catch(e=>{AG.err=e;AG.load=null;if(activeMod==="ag")agCalc()});
    return}
  if(!AG.auto){AG.auto=1;const hj=AG.dados.hoje||"";if(!AG.dados.rows.some(r=>r[3]>=hj))AG.f.modo="pag"}
  const f=AG.f,tipos=[...new Set(AG.dados.rows.map(r=>r[1]))].filter(Boolean).sort();
  $("agF").innerHTML='<div class="fnfilt">'+'<div class="field"><label for="agTipo">Tipo de ativo</label><select id="agTipo" data-agf="tipo"><option value="">Todos</option>'+tipos.map(t=>'<option'+(t===f.tipo?' selected':'')+'>'+esc(t)+'</option>').join("")+'</select></div>'
    +'<div class="field"><label for="agTxt">Código</label><input id="agTxt" data-agf="txt" value="'+esc(f.txt)+'" autocomplete="off" placeholder="ex.: PETR, HGLG"></div></div>'+fnSeg("agmodo",[["com","Próximas datas com"],["pag","Próximos pagamentos"],["rec","Anunciados nos últimos 10 dias"]],f.modo);
  agTable();
}
function agTable(){
  const t=$("agT");if(!t||!AG.dados)return;const f=AG.f,hoje=AG.dados.hoje||new Date().toISOString().slice(0,10),q=f.txt.trim().toUpperCase();
  const NM={D:"Dividendo",J:"JCP",R:"Rendimento",A:"Amortização"};
  let L=AG.dados.rows.filter(r=>(!f.tipo||r[1]===f.tipo)&&(!q||r[0].includes(q)));
  if(f.modo==="com")L=L.filter(r=>r[3]>=hoje).sort((a,b)=>a[3].localeCompare(b[3])||(b[6]||0)-(a[6]||0));
  else if(f.modo==="pag")L=L.filter(r=>r[4]&&r[4]>=hoje&&r[4]<"9000").sort((a,b)=>a[4].localeCompare(b[4])||(b[6]||0)-(a[6]||0));
  else L=L.filter(r=>r[3]<hoje).sort((a,b)=>b[3].localeCompare(a[3]));
  const nome=tk=>{const r=AT.idx?atRow(tk):null;return r?r[1]:""};
  let h='<p class="sub" style="margin:8px 0 4px">'+fx(L.length,0)+' proventos.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ativo</th><th style="text-align:left">Provento</th><th>Data com</th><th>Pagamento</th><th>Valor</th><th>% da cotação</th></tr></thead><tbody>';
  if(!L.length)h+='<tr><td colspan="6" class="sub" style="text-align:left">'+(f.modo==="com"?'Nenhuma data com futura anunciada entre os ativos acompanhados. Veja os próximos pagamentos.':'Nada encontrado.')+'</td></tr>';L.slice(0,400).forEach(r=>{h+='<tr><td style="text-align:left" class="tw"><button type="button" class="link" data-atopen="'+r[0]+'">'+r[0]+'</button><small style="display:block;color:var(--muted)">'+esc(nome(r[0]).slice(0,40))+' · '+esc(r[1]||"")+'</small></td><td style="text-align:left">'+(NM[r[2]]||r[2])+'</td><td>'+fdate(Date.parse(r[3]+"T00:00:00Z"))+'</td><td>'+(r[4]&&r[4]<"9000"?fdate(Date.parse(r[4]+"T00:00:00Z")):'a definir')+'</td><td>R$ '+fx(r[5],r[5]<0.1?4:2)+'</td><td>'+(r[6]!=null?fx(r[6],2)+'%':'—')+'</td></tr>'});
  h+='</tbody></table></div><p class="sub" style="font-size:.8rem">Fonte: B3 (proventos anunciados pelas companhias e fundos). JCP pelo valor bruto. A cotação de referência é a do último pregão.</p>';
  t.innerHTML=h;
}
document.addEventListener("click",e=>{if(!(e.target.closest&&e.target.closest("#modFn"))||activeMod!=="ag")return;const x=e.target.closest("[data-agmodo]");if(x){AG.f.modo=x.dataset.agmodo;agCalc()}});
document.addEventListener("change",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.agf==="tipo"){AG.f.tipo=t.value;agTable()}});
document.addEventListener("input",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.agf==="txt"){AG.f.txt=t.value;clearTimeout(AG.qt);AG.qt=setTimeout(agTable,150)}});

/* ----- situação das bases (Mercado > Resumo) */
const BASES={est:null,load:null};
function basesLoad(){
  if(BASES.est||BASES.load)return;
  const g=u=>fetch(u,{cache:"no-cache"}).then(r=>r.ok?r.json():null).catch(()=>null);
  BASES.load=Promise.all([g(fnUrl("estado.json")),g(atUrl("estado.json")),g(ROBO+"mercado.json")]).then(([f,a,m])=>{BASES.est={f,a,m};BASES.load=null;if(activeMod==="rs"&&typeof mkCalc==="function")mkCalc()});
}
function basesHtml(){
  sdLoad();if(SD.d)return saudeHtml();
  basesLoad();const E=BASES.est;if(!E)return "";
  const agora=Date.now(),idade=s=>s?(agora-Date.parse(s))/3600000:null;
  const linha=(nome,quando,fonte,limite)=>{const h=idade(quando),ok=h!=null&&h<=limite;return '<tr><td style="text-align:left">'+nome+'</td><td>'+(quando?new Date(quando).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):'—')+'</td><td><span class="fnq '+(ok?'fnq1':'fnq4')+'">'+(ok?'em dia':'atrasada')+'</span></td><td class="c-ph" style="text-align:left"><small>'+fonte+'</small></td></tr>'};
  const st=E.m&&(E.m.updatedAt||E.m.statusAt)||null;
  return '<h3>Situação das bases de dados</h3><p class="sub">Quando cada robô publicou dados pela última vez. Se algum atrasar, um aviso é aberto automaticamente no GitHub.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Base</th><th>Última atualização</th><th>Situação</th><th class="c-ph" style="text-align:left">Fontes</th></tr></thead><tbody>'
    +(st?linha("Mercado (taxas, curvas, dólar, inflação)",st,"Tesouro, ANBIMA, B3, Banco Central, IBGE",30):'')
    +linha("Fundos de investimento",E.f&&E.f.geradoEm,"CVM, Banco Central, B3, ANBIMA",30)
    +linha("Bolsa (ações, FIIs, ETFs, BDRs, Tesouro)",E.a&&E.a.geradoEm,"B3, CVM, Tesouro Transparente",40)+'</tbody></table></div>';
}

/* ----- app instalável (PWA) */
if("serviceWorker" in navigator&&/^https:/.test(location.protocol)&&!/claude|artifact/.test(location.hostname)){window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(()=>{})})}

/* ----- importar posição da B3 (Área do Investidor) para o simulador — fica só neste navegador */
function impXlsx(){return window.XLSX?Promise.resolve(window.XLSX):new Promise((ok,er)=>{const s=document.createElement("script");s.src="xlsx.full.min.js";s.integrity="sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw";s.onload=()=>ok(window.XLSX);s.onerror=()=>er(new Error("não deu para carregar o leitor de planilhas"));document.head.appendChild(s)})}
async function impArquivo(file){
  const msg=t=>{const b=$("spImpMsg");if(b)b.innerHTML=t};msg('<span class="sub">Lendo a planilha…</span>');
  try{
    const X=await impXlsx(),wb=X.read(await file.arrayBuffer(),{type:"array"}),itens=[],nao=[];
    const col=(h,...ks)=>h.findIndex(c=>ks.some(k=>fnNorm(c).includes(k)));
    wb.SheetNames.forEach(sn=>{const rows=X.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:""});if(!rows.length)return;
      let hi=rows.findIndex(r=>r.some(c=>/produto|codigo de negociacao|código de negociação/i.test(String(c))));if(hi<0)return;const h=rows[hi].map(String),aba=fnNorm(sn);
      const cCod=col(h,"codigo de negociacao"),cProd=col(h,"produto"),cVal=col(h,"valor atualizado","valor liquido","valor bruto","valor"),cCnpj=col(h,"cnpj"),cIdx=col(h,"indexador"),cVenc=col(h,"vencimento");
      rows.slice(hi+1).forEach(r=>{const v=typeof r[cVal]==="number"?r[cVal]:num(String(r[cVal]||""));if(!v||v<=0)return;if(r.some(c=>/^\s*total\b/i.test(String(c))))return;
        let cod=cCod>=0?String(r[cCod]||"").trim().toUpperCase():"",prod=cProd>=0?String(r[cProd]||"").trim():"";
        if(!cod&&prod){const m=/^([A-Z]{4}\d{1,2}[A-Z]?)\b/.exec(prod.toUpperCase());if(m)cod=m[1]}
        if(cod&&AT.idx&&atRow(cod)){const rr=atRow(cod);itens.push({t:"a",k:cod,n:cod+" · "+rr[1],tipo:rr[AT.C.tipo],v});return}
        if(/tesouro/.test(aba)||/^tesouro/i.test(prod)){const P=fnNorm(prod),y=(/(\d{4})/.exec(prod)||[])[1];const code=/renda/.test(P)?"RENDA":/educa/.test(P)?"EDUCA":/selic/.test(P)?"SELIC":/ipca/.test(P)?(/juros/.test(P)?"IPCAJ":"IPCA"):/prefixado/.test(P)?(/juros/.test(P)?"PREJ":"PRE"):"";
          const k=code&&y?"TD-"+code+"-"+y:null;if(k&&AT.idx&&atRow(k)){itens.push({t:"a",k,n:atRow(k)[1],tipo:"Tesouro Direto",v});return}}
        const cn=cCnpj>=0?String(r[cCnpj]||"").replace(/\D/g,""):"";if(cn.length===14&&FN.idx&&fnRow(cn)){itens.push({t:"f",k:cn,n:fnRow(cn)[1],tipo:"Fundo",v});return}
        if(/renda fixa/.test(aba)||cIdx>=0){const ix=cIdx>=0?fnNorm(String(r[cIdx]||"")):"";const rf=/ipca/.test(ix)?"ipca":/pre/.test(ix)?"pre":"cdi",x=rf==="cdi"?100:rf==="ipca"?6:12;
          itens.push({t:"s",est:1,k:rf+":"+x+":"+itens.length,rf,x,n:(prod||"Renda fixa")+" (estimado: "+(rf==="cdi"?"100% do CDI":rf==="ipca"?"IPCA + 6%":"pré 12%")+")",tipo:"Renda fixa",v});return}
        nao.push(prod||cod)})});
    if(!itens.length){msg('<span class="warn">Não reconheci nenhum investimento nessa planilha. Use o arquivo de posição exportado da Área do Investidor da B3 (Extratos › Posição › baixar em Excel).</span>');return}
    // junta repetidos e transforma valores em pesos
    const mp=new Map();itens.forEach(x=>{const key=x.t+"|"+x.k;if(mp.has(key))mp.get(key).v+=x.v;else mp.set(key,Object.assign({},x))});
    const L=[...mp.values()].sort((a,b)=>b.v-a.v).slice(0,CMP_MAX),tot=L.reduce((a,x)=>a+x.v,0);
    const c=spNova("Posição importada "+new Date().toLocaleDateString("pt-BR"));c.valor=Math.round(tot*100)/100;
    c.itens=L.map(x=>({t:x.t,k:x.k,n:x.n.slice(0,80),tipo:x.tipo,rf:x.rf,x:x.x,est:x.est,w:Math.round(x.v/tot*1000)/10}));
    const d=100-c.itens.reduce((a,x)=>a+x.w,0);if(c.itens.length)c.itens[0].w=Math.round((c.itens[0].w+d)*10)/10;
    SP.carts.push(c);SP.cur=SP.carts.length-1;SP_CMP=null;spSave();spCalc();
    alertLite(c.itens.length+" investimentos importados"+(nao.length?"; não reconhecidos: "+nao.slice(0,5).join(", ")+(nao.length>5?"…":""):"")+". A posição fica só neste navegador.");
  }catch(e){msg('<span class="err">Não deu para ler o arquivo: '+esc(e.message)+'</span>')}
}
document.addEventListener("change",e=>{const t=e.target;if(t&&t.id==="spImp"&&t.files&&t.files[0]){impArquivo(t.files[0]);t.value=""}});

/* ----- atualização automática de Fundos e Bolsa (mesmo padrão do Mercado: a cada 30 minutos) */
const UPD={f:null,a:null,t:0,run:null};
async function updCheck(){
  if(UPD.run)return UPD.run;
  UPD.run=(async()=>{
    const g=u=>fetch(u,{cache:"no-cache"}).then(r=>r.ok?r.json():null).catch(()=>null);
    const [f,a]=await Promise.all([FN.idx?g(fnUrl("estado.json")):null,AT.idx?g(atUrl("estado.json")):null]);
    UPD.t=Date.now();let mf=false,ma=false;
    if(f&&f.geradoEm){if(UPD.f&&UPD.f!==f.geradoEm)mf=true;UPD.f=f.geradoEm}
    if(a&&a.geradoEm){if(UPD.a&&UPD.a!==a.geradoEm)ma=true;UPD.a=a.geradoEm}
    if(mf||ma){BASES.est=null;SP_CMP=null}
    if(mf){FN.idx=null;FN.files.clear();FN.load=null;FN.err=null;await fnBoot()}
    if(ma){AT.idx=null;AT.files.clear();AT.load=null;AT.err=null;AG.dados=null;AG.load=null;EXT_SPX=null;await atBoot()}
    if((mf||ma)&&FNM.has(activeMod)){if(activeMod==="ag")agCalc();else if(activeMod==="sp")spCalc();else fnCalc()}
  })().finally(()=>{UPD.run=null});
  return UPD.run;
}
// registra a versão carregada assim que cada base termina de carregar
setInterval(()=>{if((FN.idx&&!UPD.f)||(AT.idx&&!UPD.a))updCheck()},5000);
setInterval(()=>{if(FN.idx||AT.idx)updCheck()},30*60000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&Date.now()-UPD.t>30*60000&&(FN.idx||AT.idx))updCheck()});
document.addEventListener("click",e=>{if(e.target.closest&&e.target.closest("#refresh")&&(FN.idx||AT.idx))setTimeout(updCheck,0)});

