/* ---------- dados do robô (GitHub) lidos direto pela página ---------- */
const PAGES=/github\.io$/.test(location.hostname)||!(window.claude&&typeof window.claude.use==="function");
const ROBO="https://raw.githubusercontent.com/wagneria206-app/dados-mercado/site/data/";
let ROBO_ST={ok:null,at:null,refDate:null,erro:null,papeis:0};
async function roboJson(f){const r=await fetch(ROBO+f+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(f+": HTTP "+r.status);return r.json()}
function roboStat(){
  const L=ROBO_ST,nx=new Date(Date.now()+30*60000).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  if(!L.ok){setStat("Não foi possível ler os dados agora ("+L.erro+"). Valem os últimos dados carregados. Nova tentativa às "+nx+".","bad");return}
  const td=L.td||{},d=s=>s?s.slice(8,10)+"/"+s.slice(5,7):"—";
  const sp=td.suspenso&&td.suspenso.data===td.date?td.suspenso:null;
  setStat("ANBIMA, CDI e IPCA de "+d(L.refDate)+" · Tesouro Direto de "+d(td.date)+(td.hora?" às "+td.hora:"")+(sp?" (negociação suspensa em parte dos títulos)":"")+" · nova leitura às "+nx+".",sp?"bad":"ok");
  tdSuspShow(sp);
}
const TDN={LTN:"Prefixado",NTNF:"Prefixado com Juros Semestrais",NTNB:"IPCA+ com Juros Semestrais",NTNBP:"IPCA+",LFT:"Selic",RENDA:"Renda+",EDUCA:"Educa+"};
function tdSuspShow(sp){
  let el=document.getElementById("tdSusp");
  if(!sp){if(el)el.remove();return}
  if(!el){el=document.createElement("div");el.id="tdSusp";el.className="tdsusp";const box=document.querySelector("#modMk .tdlink");if(box)box.after(el);else return}
  const nomes=sp.suspensos.map(k=>"Tesouro "+(TDN[k]||k)).join(", ");
  el.textContent="Negociação suspensa no Tesouro Direto desde "+sp.desde+" para: "+nomes+". Isso acontece em dias de forte volatilidade. Para esses títulos o app mostra a última taxa publicada"+(sp.ultimaCompleta?" ("+new Date(sp.ultimaCompleta).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+")":"")+"; o Tesouro só volta a publicar quando reabrir a negociação.";
}

const ROBO_MEMO={};
function roboGet(f){if(!ROBO_MEMO[f])ROBO_MEMO[f]=roboJson(f).catch(e=>{delete ROBO_MEMO[f];throw e});return ROBO_MEMO[f]}
async function pcRoboFetch(code){
  const info=$("pcInfo"),b=$("pcFetch");b.disabled=true;info.innerHTML='<p class="sub">Procurando '+pcEsc(code)+' nas bases do robô (SND, CVM e ANBIMA)…</p>';
  try{
    const isCR=/^(CRA|CRI)/.test(code)||/^\d{2}[A-Z]\d{7}$/.test(code);
    if(!isCR){const [cat,deb]=await Promise.all([roboGet("catalogo_debentures.json"),roboGet("debentures.json").catch(()=>null)]);
      const P0=(cat.papers||{})[code];
      if(P0){const P=pcRebase(P0),a=deb&&deb.papers&&deb.papers[code];if(a&&a.taxa!=null)P.anbima={refDate:deb.refDate,rate:a.taxa,pu:a.pu};
        P.status="ok";P.sources=["SND – características e agenda (debentures.com.br)","ANBIMA – taxa indicativa"];PAPERS[code]=P;pcMemo.clear();try{PCE_MEMO.clear()}catch(e){}pcList();pcManual=false;pcAuto();pcCalc();return}}
    const [cvm,anb]=await Promise.all([roboGet("cri_cra_cvm.json").catch(()=>null),roboGet("cri_cra_anbima.json").catch(()=>null)]);
    const cc=c=>{c=c.replace(/^CRA(?=CRA)/,"");const x=c.match(/^(?:CRI|CRA)(\d{2}[A-Z]\d{7})$/);return x?x[1]:c},k=cc(code);
    const C=cvm&&cvm.certificados&&(cvm.certificados[k]||cvm.certificados[code]),A=anb&&anb.papers&&(anb.papers[k]||anb.papers[code]);
    const P=pcP(code);
    const CRO0=await roboGet("cri_cra_cronogramas.json").catch(()=>null),temTermo=!!(CRO0&&(CRO0[k]||CRO0[code])&&C);
    if(P&&P.schedule&&P.schedule.length&&(!temTermo||P.rulesVerified===true)){if(A&&A.taxa!=null){P.anbima={refDate:A.data||anb.refDate,rate:A.taxa,pu:A.pu};pcMemo.clear()}pcManual=false;pcAuto();pcCalc();return}
    const CRO=await roboGet("cri_cra_cronogramas.json").catch(()=>null),G=CRO&&(CRO[k]||CRO[code]);
    if(C&&G&&G.schedule&&["IPCA","DI_SPREAD","DI_PCT","PRE"].includes(C.index)&&isFinite(C.rate)){
      const P2={code,type:C.type,name:(C.type+" "+(C.nomeEmissao||"")+" – "+(C.securitizadora||"")+", "+(C.emissao||"")+"ª emissão, "+(C.serie||"")+"ª série").replace(/\s+/g," ").trim(),
        index:C.index,rate:+C.rate,vne:1000,start:C.dataEmissao,basis:G.basis,schedule:G.schedule,annivDay:G.annivDay,status:"ok",official:true,
        rulesVerified:C.index!=="IPCA"||(G.ipcaLag!=null&&!!G.prorata),rulesSource:{doc:"Termo de securitização (Fundos.NET, entregue em "+(G.entrega||"")+")",url:G.url||"",clausula:"tabela de pagamentos"},
        sources:["CVM – informe mensal de "+C.type,"Termo de securitização – cronograma lido automaticamente","ANBIMA – taxas de CRI e CRA"],
        notes:"Cronograma lido automaticamente do termo de securitização ("+G.linhas+" pagamentos). Valor nominal de emissão presumido em R$ 1.000 e início da remuneração na data de emissão informada à CVM."+(G.aviso?" Atenção: "+G.aviso+".":"")+(C.index==="IPCA"&&G.ipcaLag==null?" Regra do IPCA não localizada no termo: usado o padrão (mês anterior, dias úteis).":"")};
      if(G.ipcaLag!=null)P2.ipcaLag=G.ipcaLag;if(G.prorata)P2.prorata=G.prorata;if(G.dayBasis)P2.dayBasis=G.dayBasis;
      if(A&&A.taxa!=null)P2.anbima={refDate:A.data||anb.refDate,rate:A.taxa,pu:A.pu};
      if(P2.anbima&&P2.anbima.pu>0){const tA=parseDate(P2.anbima.refDate);let x=null;try{x=pcPrice(P2,tA,P2.anbima.rate)}catch(e){}
        const dif=x&&x.pu>0?Math.abs(x.pu/P2.anbima.pu-1):1;
        if(dif>0.005){$("pcMrateHint").innerHTML="";info.innerHTML='<div class="alertbox" style="margin-top:8px"><b>'+pcEsc(code)+'</b> · '+pcEsc(P2.name)+'<br>O robô leu uma tabela de pagamentos no termo, mas ela não reproduz o PU oficial da ANBIMA de '+fdate(tA)+' (diferença de '+fx(dif*100,1)+'%). Por segurança o cálculo não é feito com ela.<br><b>ANBIMA:</b> taxa indicativa '+fx(A.taxa,4)+'%, PU R$ '+fx(A.pu,6)+(A.puPar?' = '+fx(A.puPar,2)+'% do valor na curva (par)':'')+'.</div>';return}
        P2.notes+=" Conferido: com este cronograma o app reproduz o PU oficial da ANBIMA de "+fdate(tA)+" (diferença de "+fx(dif*100,3)+"%)."}
      else P2.notes+=" A ANBIMA não precifica esta série; o cronograma passou nas verificações de coerência (datas, 100% amortizado, juros periódicos), mas não pôde ser conferido contra um preço oficial.";
      PAPERS[code]=P2;pcMemo.clear();try{PCE_MEMO.clear()}catch(e){}pcList();pcManual=false;pcAuto();pcCalc();return}
    if(!C&&!A){$("pcMrateHint").innerHTML="";info.innerHTML='<p class="err">'+pcEsc(code)+' não está no catálogo de debêntures do SND nem nos informes de CRI/CRA da CVM. Confira o código (debêntures: 6 letras e números, como MOVI27; CRI: 10 caracteres, como 24A2720884; CRA: começa com CRA).</p>';return}
    let t='<div class="alertbox" style="margin-top:8px"><b>'+pcEsc(code)+'</b>'+(C?' · '+pcEsc(C.nomeEmissao||"")+'<br>'+pcEsc(C.securitizadora||"")+', '+pcEsc(C.emissao||"")+'ª emissão, '+pcEsc(C.serie||"")+'ª série · '+pcEsc(C.taxaTexto||"")+' · vence '+(C.vencimento?fdate(parseDate(C.vencimento)):"—"):"");
    if(A&&A.taxa!=null)t+='<br><b>ANBIMA em '+fdate(parseDate(A.data||anb.refDate))+':</b> taxa indicativa '+fx(A.taxa,4)+'% ('+pcEsc(A.indice||"")+'), PU R$ '+fx(A.pu,6)+(A.puPar?' = '+fx(A.puPar,2)+'% do valor na curva (par)':'')+(A.duration?', duration '+fx(A.duration/252,2)+' anos':'')+'.';
    else if(A)t+='<br>A ANBIMA lista o papel, mas sem taxa indicativa (sem preço de mercado confiável).';
    else t+='<br>A ANBIMA não precifica este papel.';
    t+='<br><span class="sub">O robô ainda não conseguiu ler a tabela de pagamentos do termo de securitização desta série (ou o termo ainda está na fila de leitura), por isso o cálculo completo não está disponível para este código'+(A&&A.taxa!=null?'; o preço de mercado oficial está acima':'')+'.</span></div>';
    info.innerHTML=t;$("pcMrateHint").innerHTML="";
  }catch(e){info.innerHTML='<p class="err">Não foi possível ler as bases do robô agora ('+pcEsc(String(e&&e.message||e))+'). Tente de novo em instantes.</p>'}
  finally{b.disabled=false}
}
async function fdRoboFetch(c){
  const info=$("fdInfo"),b=$("fdFetch");b.disabled=true;
  try{const sh=await roboGet("fundos/"+c.slice(0,2)+".json"),F=sh&&sh.funds&&sh.funds[c];
    if(!F){info.insertAdjacentHTML("beforeend",'<p class="err">CNPJ não encontrado no informe diário da CVM (fundos sem cota diária recente não aparecem).</p>');return}
    const t=(F.t||"")+" "+(F.n||""),tl=t.toLowerCase();
    const type=/previd/.test(tl)?"PREV":/a[çc][õo]es|\bfia\b/.test(tl)?"ACOES":"RF_LP";
    FUNDS[c]=Object.assign({},FUNDS[c]||{},{cnpj:c,name:F.n,admin:F.a,cls:F.t,type:(FUNDS[c]||{}).type||type,status:"ok",quotes:(F.q||[]).map(x=>[x[0],x[1],"CVM – informe diário"]),sources:["CVM – cadastro e informe diário de fundos"],notes:"Tipo de tributação estimado pela classe da CVM; confira no regulamento."});
    fdCalc()}
  catch(e){info.insertAdjacentHTML("beforeend",'<p class="err">Não foi possível ler a base da CVM agora.</p>')}
  finally{b.disabled=false}
}
async function papeisLoad(){try{const D=await roboGet("papeis_cadastrados.json");for(const [c,P] of Object.entries(D.papers||{}))if(P&&P.code&&P.schedule&&P.schedule.length){const o=PAPERS[c];PAPERS[c]=Object.assign({},P,o&&o.anbima&&(!P.anbima||o.anbima.refDate>P.anbima.refDate)?{anbima:o.anbima}:{})}pcMemo.clear();pcList();if(activeMod==="pc")pcCalc();if(MKM.has(activeMod))mkCalc()}catch(e){}}
async function taxasHistLoad(){try{const T=await roboGet("taxas_hist.json");for(const [c,L] of Object.entries(T||{}))for(const [d,tx] of L){const H=HIST[d]||(HIST[d]={date:d,deb:{}});H.deb=H.deb||{};H.deb[c]=tx;if(/^\d{2}[A-Z]\d{7}$/.test(c))H.deb["CRI"+c]=tx}if(MKM.has(activeMod))mkCalc()}catch(e){}}
async function tdHistLoad(){try{const H=await roboGet("td_historico.json");for(const [d,rows] of Object.entries(H||{}))if(!TDH[d])TDH[d]={date:d,source:"Robô (Tesouro)",rows:rows.map(r=>[r[0],r[1],r[2],r.length>4?r[4]:null])};if(activeMod==="tx"){oppRender();txCalc()}if(MKM.has(activeMod))mkCalc()}catch(e){}}
async function roboLoad(db){
  const log={at:new Date().toISOString(),ok:false,refDate:null,erro:null,papeis:0,gravouMercado:false};
  try{
    const m=await roboJson("mercado.json");log.refDate=m.refDate||null;
    if(m&&m.refDate&&m.anbima){
      const td=m.td||{};if(td.ALL){td.RENDA=td.RENDA||td.ALL.filter(r=>r[0]==="RENDA").map(r=>[+r[1].slice(0,4),r[2],r[3]]);td.EDUCA=td.EDUCA||td.ALL.filter(r=>r[0]==="EDUCA").map(r=>[+r[1].slice(0,4),r[2],r[3]])}
      const doc=Object.assign({},m,{status:"ok",source:"Robô dados-mercado (GitHub): ANBIMA, Tesouro, Banco Central, IBGE"});
      const antes=DATA_INFO.refDate||"";
      if(m.refDate>=antes){onDoc(doc);if(db&&m.refDate>antes){try{await db.doc("market/current").set(doc);log.gravouMercado=true}catch(e){log.erroGravar=String(e&&e.message||e).slice(0,200)}}}
    }
    let n=0;
    const [deb,cri]=PC_RATES_ON||db?await Promise.all([roboJson("debentures.json").catch(()=>null),roboJson("cri_cra_anbima.json").catch(()=>null)]):[null,null];
    const cc=c=>{c=String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/^CRA(?=CRA)/,"");const x=c.match(/^(?:CRI|CRA)(\d{2}[A-Z]\d{7})$/);return x?x[1]:c};
    for(const code of Object.keys(PAPERS)){
      const P=PAPERS[code];if(!P||!P.code)continue;
      let r=null,ref=null;
      if(P.type==="DEB"&&deb&&deb.papers){r=deb.papers[String(P.code).toUpperCase()];ref=deb.refDate}
      else if((P.type==="CRI"||P.type==="CRA")&&cri&&cri.papers){r=cri.papers[cc(P.code)]||cri.papers[String(P.code).toUpperCase()];ref=r&&(r.data||cri.refDate)}
      if(!r||!ref)continue;
      const old=(P.anbima&&P.anbima.refDate)||"";
      if(r.taxa==null){if(P.anbimaNA!==ref&&db){try{await db.doc("papers/"+P.code).update({anbimaNA:ref})}catch(e){}}continue}
      if(ref>old||(ref===old&&P.anbima&&P.anbima.rate!==r.taxa)){
        const a={refDate:ref,rate:r.taxa,pu:r.pu};P.anbima=a;delete P.anbimaNA;n++;
        if(db){try{await db.doc("papers/"+P.code).update({anbima:a})}catch(e){}}
      }
    }
    if(n){pcMemo.clear();try{PCE_MEMO.clear()}catch(e){}try{RAWC.clear()}catch(e){}try{if(!pcManual)pcAuto()}catch(e){}refreshAll()}
    log.papeis=n;log.ok=true;log.td=m&&m.td?{date:m.td.date,hora:m.td.hora||null,suspenso:m.td.suspenso||null}:null;
  }catch(e){log.erro=String(e&&e.message||e).slice(0,300)}
  ROBO_ST=log;if(PAGES)roboStat();
  if(db){try{await db.doc("synclog/pagina").set(log)}catch(e){}}
}
const cl=window.claude&&typeof window.claude.use==="function"?window.claude:null;
{document.documentElement.classList.add("pages");setTimeout(()=>{papeisLoad().then(()=>roboLoad(null));tdHistLoad();taxasHistLoad();curvasLoad()},300);setInterval(()=>{roboLoad(null);curvasLoad();if(FX)fxLoad();if(MK.loaded)mkLoad(true)},30*60000)}

})();
