/* ===== Relatório em PDF com a identidade do escritório ===== */
const REL={cfg:{nome:"",resp:"",contato:"",rodape:"",logo:"",cor:"#12294A"},para:"",obs:"",kind:null};
try{const c=JSON.parse(localStorage.getItem("relCfg")||"null");if(c&&typeof c==="object")Object.assign(REL.cfg,c)}catch(e){}
function relSave(){try{localStorage.setItem("relCfg",JSON.stringify(REL.cfg))}catch(e){alertLite("Não deu para guardar o logo neste navegador (espaço insuficiente). Use uma imagem menor.")}}
const REL_T={fa:"Análise de fundo",aa:"Análise de ativo",fc:"Comparação de fundos",ac:"Comparação de ativos",sp:"Simulação de carteira",mk:"Relatório de mercado"};
function relOpen(kind){
  REL.kind=kind;let d=document.querySelector(".reldlg");if(d)d.remove();
  REL.box=relConteudo(kind);if(!REL.box){alertLite(kind==="mk"?"Carregando os dados de mercado. Tente de novo em alguns segundos.":"Abra a análise antes de gerar o relatório.");return}
  d=document.createElement("div");d.className="reldlg";
  const c=REL.cfg,secs=relSecoes(REL.box),fora=relFora(kind);
  d.innerHTML='<div class="relbox" role="dialog" aria-modal="true" aria-labelledby="relT"><h3 id="relT">Relatório em PDF · '+REL_T[kind]+'</h3><p class="sub">Os dados do escritório ficam guardados só neste navegador. O relatório abre pronto para imprimir: escolha “Salvar como PDF”.</p>'
    +'<div class="relgrid"><div class="field"><label for="relNome">Escritório ou empresa</label><input id="relNome" data-relcfg="nome" value="'+esc(c.nome)+'" maxlength="80"></div>'
    +'<div class="field"><label for="relResp">Responsável</label><input id="relResp" data-relcfg="resp" value="'+esc(c.resp)+'" maxlength="80" placeholder="nome e certificação"></div>'
    +'<div class="field"><label for="relCont">Contato</label><input id="relCont" data-relcfg="contato" value="'+esc(c.contato)+'" maxlength="120" placeholder="site, e-mail ou telefone"></div>'
    +'<div class="field"><label for="relCor">Cor principal</label><input id="relCor" type="color" data-relcfg="cor" value="'+esc(c.cor||"#12294A")+'"></div>'
    +'<div class="field"><label for="relLogo">Logo</label><input id="relLogo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-rellogo="1">'+(c.logo?'<small><img src="'+c.logo+'" alt="" style="max-height:28px;vertical-align:middle"> <button type="button" class="link" data-relnologo="1">remover</button></small>':'<small>PNG, JPG ou SVG</small>')+'</div>'
    +'<div class="field"><label for="relPara">Preparado para <span style="color:var(--muted);font-weight:400">(opcional, não fica salvo)</span></label><input id="relPara" data-relx="para" value="'+esc(REL.para)+'" maxlength="80"></div></div>'
    +'<div class="field"><label for="relObs">Comentário do assessor <span style="color:var(--muted);font-weight:400">(opcional, não fica salvo)</span></label><textarea id="relObs" data-relx="obs" rows="3" maxlength="1500">'+esc(REL.obs)+'</textarea></div>'
    +(secs.length>1?'<div class="field"><label>O que vai no relatório</label><div class="spbtns" style="margin:2px 0 6px"><button type="button" class="link" data-relpre="tudo">Completo</button><button type="button" class="link" data-relpre="resumo">Resumido</button><button type="button" class="link" data-relpre="nada">Desmarcar tudo</button></div><div class="relsecs">'+secs.map((t,i)=>'<label><input type="checkbox" data-relsec="'+i+'"'+(fora.includes(t)?'':' checked')+'>'+esc(t)+'</label>').join("")+'</div><small>A escolha fica lembrada para o próximo relatório deste tipo.</small></div>':'')
    +'<div class="field"><label for="relRod">Texto de rodapé</label><input id="relRod" data-relcfg="rodape" value="'+esc(c.rodape)+'" maxlength="300" placeholder="ex.: aviso legal do escritório"></div>'
    +'<div class="spbtns" style="margin-top:12px"><button type="button" class="btn" data-relgo="1">Gerar PDF</button><button type="button" class="btn sec" data-relclose="1">Cancelar</button></div></div>';
  ($("modFn")||document.body).appendChild(d);setTimeout(()=>{const i=$("relNome");if(i)i.focus()},30);
}
function relTit(el){return (el.dataset&&el.dataset.reltit)||((el.querySelector("h3")||el.querySelector(".label")||{}).textContent||"").trim().replace(/\s+/g," ").slice(0,70)||"Seção"}
function relSecoes(box){return [...box.children].filter(e=>/^(SECTION|DIV)$/.test(e.tagName)&&(e.classList.contains("panel")||e.classList.contains("relsec"))).map(relTit)}
function relFora(kind){try{const a=JSON.parse(localStorage.getItem("relFora_"+kind)||"[]");return Array.isArray(a)?a:[]}catch(e){return []}}
const REL_RESUMO=/^(Painel de índices|Resumo do mercado|Expectativas do mercado|Como o exterior|Resumo|Composição|Rentabilidade e risco de cada item|Desde a efetivação|Rentabilidade$|Rentabilidade acumulada|Risco$)/;
function relClean(root){
  root.querySelectorAll(".fnseg,.fnacts,.cvsel,.fnqbox,.fnsrch,select,input,textarea,.btn,.fnx,.cmphead,.fnrow,[data-cmpaddmany],[data-fnrkcat],[data-atrkcat],.cmpleg .link,.cvtip,.sprf,.spbtns,.spparams,#spCmpBox button").forEach(e=>e.remove());
  root.querySelectorAll("button").forEach(b=>{const s=document.createElement("span");s.innerHTML=b.innerHTML;s.className=b.className.replace(/\b(link|off)\b/g,"").trim();if(b.classList.contains("off"))s.style.opacity=".4";b.replaceWith(s)});
  root.querySelectorAll("details").forEach(d=>d.setAttribute("open",""));
  root.querySelectorAll(".tablewrap").forEach(t=>{t.style.maxHeight="none";t.style.overflow="visible"});
  return root;
}
function relConteudo(kind){
  const box=document.createElement("div");
  if(kind==="mk"){if(!EU.S||!MC.d){euBoot();mcBoot();return null}const P=x=>x?'<section class="panel">'+x+'</section>':'';let h="";
    try{h=P(painelHtml())+P(rsHtml())+P(fluxoHtml())+economiaHtml().map(P).join("")+mundoHtml().map(P).join("")}catch(e){console.error(e);return null}box.innerHTML=h;return relClean(box)}
  if(kind==="fa"||kind==="aa"){const b=$(kind==="fa"?"fnBody":"atBody");if(!b)return null;box.innerHTML=b.innerHTML}
  else if(kind==="sp"){const b=$("spRes");if(!b)return null;box.innerHTML=b.innerHTML;const cb=box.querySelector("#spCmpBox");if(cb&&!SP_CMP)cb.closest("section").remove()}
  else{const k=kind==="fc"?"f":"a",X=CMP_CTX[k];if(!X)return null;const b=$(kind==="fc"?"fnCbody":"atCbody");if(!b)return null;
    const tmp=document.createElement("div");tmp.innerHTML=b.innerHTML;tmp.querySelectorAll(".tablewrap,.cmpwrap").forEach(e=>e.remove());tmp.querySelectorAll("p.sub").forEach(e=>{if(/Correlação dos retornos|Cada janela|No período escolhido|Para comparar com LCI/.test(e.textContent))e.remove()});
    let h=tmp.innerHTML;const nomes={ret:"Rentabilidade",risk:"Risco",jan:"Janelas móveis",info:"Características",cor:"Correlação"};
    fnUse(X.K.X,()=>{["ret","risk","jan","info","cor"].forEach(tab=>{const T=cmpTable(X.K,Object.assign({},X.st,{tab}),X.rows,X.bmRows,X.ref);h+='<section class="relsec"><h3>'+nomes[tab]+'</h3>'+T.html+'</section>'})});
    box.innerHTML=h}
  return relClean(box);
}
function relTitulo(kind){
  if(kind==="fa"&&FN.cur&&FN.files.get(FN.cur)){const F=FN.files.get(FN.cur);return [F.fan||F.n||"",fnCnpjF(F.c)]}
  if(kind==="aa"&&AT.cur&&AT.files.get(AT.cur)){const A=AT.files.get(AT.cur);return [A.t+" · "+(A.nome||""),A.tipo+(A.setor?" · "+A.setor:"")]}
  if(kind==="sp"){const c=spC();return [c.nome,c.itens.length+" itens"]}
  if(kind==="mk")return ["Panorama do mercado","Brasil, EUA e mundo · "+new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"})];
  const L=kind==="fc"?FN.cmp:AT.cmp;return [REL_T[kind],L.length+(kind==="fc"?" fundos":" ativos")];
}
function relGerar(){
  const kind=REL.kind,cont=REL.box;if(!cont){alertLite("Abra a análise antes de gerar o relatório.");return}
  {const els=[...cont.children].filter(e=>/^(SECTION|DIV)$/.test(e.tagName)&&(e.classList.contains("panel")||e.classList.contains("relsec"))),fora=[];
    document.querySelectorAll(".reldlg [data-relsec]").forEach(cb=>{const el=els[+cb.dataset.relsec];if(el&&!cb.checked){fora.push(relTit(el));el.remove()}});
    try{localStorage.setItem("relFora_"+kind,JSON.stringify(fora))}catch(e){}
    if(!cont.querySelector(".panel,.relsec")){alertLite("Escolha pelo menos uma parte para o relatório.");return}}
  const c=REL.cfg,[tit,sub]=relTitulo(kind),hoje=new Date().toLocaleDateString("pt-BR");
  const css=[...document.querySelectorAll("style")].map(s=>s.textContent).join("\n");
  const cor=/^#[0-9a-f]{6}$/i.test(c.cor||"")?c.cor:"#12294A";
  const doc='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>'+esc(tit)+' · '+esc(REL_T[kind])+'</title><style>'+css+`
:root{--bg:#fff!important;--surface:#fff!important;--sunk:#F2F4F7!important;--ink:#0E1B2C!important;--muted:#5A6577!important;--line:#E1E5EB!important;--accent:#1D4E89!important;--primary:#12294A!important;--gain:#0B7A53!important;--loss:#B4372B!important;--flat:#5A6577!important;--gold:#B08A3E!important;--s2:#B08A3E!important;--s3:#6E4FA3!important;--s4:#17694A!important;--warn:#8A5A00!important;--shadow:none!important;color-scheme:light}
html,body{background:#fff!important;color:#0E1B2C}body{margin:0;padding:0 2px;font-size:12px}
@page{size:A4;margin:12mm 11mm 14mm}
.relhead{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:3px solid ${cor};padding:4px 0 10px;margin-bottom:12px}
.relhead img{max-height:52px;max-width:200px}.relhead .of{font-weight:700;font-size:15px;color:${cor}}.relhead .ct{font-size:11px;color:#5A6577}
.reltit h1{font-size:19px;margin:0 0 2px;color:#0E1B2C}.reltit p{margin:0;color:#5A6577;font-size:12px}
.relmeta{display:flex;gap:18px;flex-wrap:wrap;font-size:11px;color:#5A6577;margin:6px 0 12px}
.relobs{border-left:3px solid ${cor};background:#F6F7F9;padding:8px 12px;margin:0 0 12px;font-size:12px;white-space:pre-wrap}
.panel,.relsec{box-shadow:none!important;border:1px solid #E1E5EB!important;border-radius:8px!important;padding:12px 14px!important;margin:0 0 10px!important;break-inside:auto}
.fnchart,.fnkpis,.fninfo div,tr,.fnh1,.label,.legend,.cmpleg{break-inside:avoid;page-break-inside:avoid}.label{break-after:avoid;page-break-after:avoid}.panel h3,.relsec h3{break-after:avoid;page-break-after:avoid}
.panel h3,.relsec h3{color:${cor};font-size:14px;margin:0 0 6px}
.ctab{font-size:10px!important}.ctab th,.ctab td{padding:3px 4px!important}.ctab .c-ph,.ctab .c-md,.ctab .c-sm,.ctab .c-lg{display:table-cell!important}
.tablewrap{max-height:none!important;overflow:visible!important}
.cmptab .cmpn,.cmpcor .cmpn{position:static!important;max-width:none!important}.cmptab .cmpn span{white-space:normal!important;max-width:none!important}
.fnkpis{grid-template-columns:repeat(5,1fr)!important}.fninfo{grid-template-columns:repeat(3,1fr)!important}.fnrisk{grid-template-columns:repeat(4,1fr)!important}
svg.chart{max-height:250px}
.relfoot{border-top:1px solid #E1E5EB;margin-top:14px;padding-top:8px;font-size:9.5px;color:#5A6577;line-height:1.45}
@media screen{body{max-width:980px;margin:0 auto;padding:18px}}
</style></head><body>`
    +'<div class="relhead"><div>'+(c.logo?'<img src="'+c.logo+'" alt="">':'')+(c.nome?'<div class="of">'+esc(c.nome)+'</div>':'')+'</div><div class="ct" style="text-align:right">'+(c.resp?esc(c.resp)+'<br>':'')+(c.contato?esc(c.contato)+'<br>':'')+hoje+'</div></div>'
    +'<div class="reltit"><h1>'+esc(tit)+'</h1><p>'+esc(REL_T[kind])+(sub?' · '+esc(sub):'')+'</p></div>'
    +'<div class="relmeta">'+(REL.para?'<span>Preparado para: <b>'+esc(REL.para)+'</b></span>':'')+'<span>Dados até '+esc(kind==="mk"?fdate(Date.now()):kind==="aa"||kind==="ac"?(AT.idx&&AT.idx.dt?fdate(Date.parse(AT.idx.dt+"T00:00:00Z")):""):(FN.idx&&FN.idx.dt?fdate(Date.parse(FN.idx.dt+"T00:00:00Z")):""))+'</span></div>'
    +(REL.obs?'<div class="relobs">'+esc(REL.obs)+'</div>':'')
    +cont.innerHTML
    +'<div class="relfoot">'+(c.rodape?esc(c.rodape)+'<br>':'')+'Fontes: CVM (informe diário, cadastro, lâmina, carteira, demonstrações financeiras e informe dos FIIs), B3 (cotações, proventos e índices) e Banco Central (CDI, IPCA e dólar). Rentabilidade passada não é garantia de rentabilidade futura. Os valores são brutos de impostos, salvo indicação. Este material tem caráter informativo e não constitui recomendação de investimento.</div>'
    +'</body></html>';
  const w=window.open("","_blank");
  if(w){w.document.open();w.document.write(doc);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch(e){}},600)}
  else{const f=document.createElement("iframe");f.style.cssText="position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";document.body.appendChild(f);f.contentWindow.document.open();f.contentWindow.document.write(doc.replace(/<script>[\s\S]*?<\/script>/,""));f.contentWindow.document.close();setTimeout(()=>{f.contentWindow.focus();f.contentWindow.print();setTimeout(()=>f.remove(),60000)},500)}
  const d=document.querySelector(".reldlg");if(d)d.remove();
}
function relLogo(file){
  if(!file)return;const rd=new FileReader();rd.onload=()=>{
    if(file.type==="image/svg+xml"){if(rd.result.length>150000){alertLite("Logo muito grande. Use um arquivo menor.");return}REL.cfg.logo=rd.result;relSave();relOpen(REL.kind);return}
    const img=new Image();img.onload=()=>{const k=Math.min(1,400/img.width,160/img.height),cv=document.createElement("canvas");cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);REL.cfg.logo=cv.toDataURL("image/png");relSave();relOpen(REL.kind)};img.src=rd.result};
  rd.readAsDataURL(file);
}
document.addEventListener("click",e=>{
  const x=e.target.closest&&e.target.closest("[data-rel],[data-relsp],[data-relgo],[data-relclose],[data-relnologo],[data-relpre]");if(!x){if(e.target.classList&&e.target.classList.contains("reldlg"))e.target.remove();return}
  if(x.dataset.relsp){relOpen("sp");return}
  if(x.dataset.rel){relOpen(x.dataset.rel);return}
  if(x.dataset.relgo){relGerar();return}
  if(x.dataset.relpre){const p=x.dataset.relpre,els=REL.box?relSecoes(REL.box):[];document.querySelectorAll(".reldlg [data-relsec]").forEach(cb=>{cb.checked=p==="tudo"?true:p==="nada"?false:REL_RESUMO.test(els[+cb.dataset.relsec]||"")});return}
  if(x.dataset.relclose){const d=document.querySelector(".reldlg");if(d)d.remove();return}
  if(x.dataset.relnologo){REL.cfg.logo="";relSave();relOpen(REL.kind)}
});
document.addEventListener("input",e=>{const t=e.target;if(!t||!t.dataset)return;if(t.dataset.relcfg){REL.cfg[t.dataset.relcfg]=t.value;relSave()}else if(t.dataset.relx){REL[t.dataset.relx]=t.value}});
document.addEventListener("change",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.rellogo)relLogo(t.files&&t.files[0])});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){const d=document.querySelector(".reldlg");if(d)d.remove()}});

