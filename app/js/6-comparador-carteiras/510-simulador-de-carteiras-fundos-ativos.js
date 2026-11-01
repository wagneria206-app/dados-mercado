/* ===== Simulador de carteiras: fundos, ativos da B3 e renda fixa (dados mensais) ===== */
const SP={carts:[],cur:0,rf:{tipo:"cdi",taxa:""},q:""};
const SP_RF={cdi:"% do CDI",cdimais:"CDI + taxa",ipca:"IPCA + taxa",pre:"Prefixado"};
const SP_REB=[["0","Sem rebalanceamento"],["1","Mensal"],["3","Trimestral"],["6","Semestral"],["12","Anual"]];
try{const c=JSON.parse(localStorage.getItem("spCarts")||"null");if(Array.isArray(c)&&c.length)SP.carts=c;SP.cur=Math.min(+(localStorage.getItem("spCur")||0),Math.max(0,SP.carts.length-1))}catch(e){}
if(!SP.carts.length)SP.carts=[spNova("Carteira 1")];
function spNova(nome,cli){return {nome,cli:cli||"",sit:"proposta",criada:new Date().toISOString().slice(0,10),ver:1,obs:"",itens:[],valor:100000,aporte:0,ini:"",fim:"",reb:"12",base:"m",ir:1,hz:10,meta:"",omax:100,bm:{cdi:1,ibov:0,ipca:0,ifix:0,usd:0,spx:0},ipcax:""}}
function spSave(){try{localStorage.setItem("spCarts",JSON.stringify(SP.carts));localStorage.setItem("spCur",String(SP.cur))}catch(e){}if(typeof syncMark==="function")syncMark()}
const spC=()=>SP.carts[SP.cur];
function spBoot(){return Promise.all([FN.idx?null:fnBoot(),AT.idx?null:atBoot()])}
function spCalc(){
  const o=$("fnOut");if(!o)return;
  if(FN.view!=="sp"){FN.view="sp";o.innerHTML='<div id="spTop"></div><div id="spRes"></div>'}
  if(!FN.idx||!AT.idx){$("spTop").innerHTML='<section class="panel"><p class="sub">Carregando as bases de fundos (CVM) e de ativos (B3)…</p></section>';$("spRes").innerHTML="";if(!FN.load&&!AT.load&&(FN.err||AT.err)){$("spTop").innerHTML='<section class="panel"><p class="warn">Não deu para carregar as bases agora. Tente de novo em alguns minutos.</p><button type="button" class="btn sec" data-spretry="1">Tentar de novo</button></section>';return}
    spBoot().then(()=>{if(activeMod==="sp"&&FN.idx&&AT.idx)spCalc()});return}
  spTopHtml();spRun();
}
function spItemNome(it){return nomeCx(it.n)||it.k}
const spHoje=()=>new Date().toISOString().slice(0,10);
function spClientes(){return [...new Set(SP.carts.map(x=>String(x.cli||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"))}
function spRotulo(x){return (x.cli?x.cli+" · ":"")+x.nome+(x.sit==="efetivada"?" (efetivada)":" (proposta)")}
function spListaHtml(){
  const L=SP.carts.map((x,j)=>[x,j]).filter(([x])=>!SP.fcli||(SP.fcli==="__sem"?!x.cli:x.cli===SP.fcli)).sort((a,b)=>String(a[0].cli||"~").localeCompare(String(b[0].cli||"~"),"pt-BR")||String(b[0].criada||"").localeCompare(String(a[0].criada||"")));
  return '<details class="nota" style="margin-top:8px"><summary>'+(SP.fcli?'Carteiras deste cliente':'Todas as carteiras e propostas')+' ('+L.length+')</summary><div class="tablewrap" style="max-height:360px"><table class="ctab"><thead><tr><th style="text-align:left">Cliente</th><th style="text-align:left">Carteira</th><th style="text-align:left">Situação</th><th class="c-ph">Itens</th><th class="c-ph">Valor</th></tr></thead><tbody>'
    +L.map(([x,j])=>'<tr'+(j===SP.cur?' class="cmpbm"':'')+'><td style="text-align:left">'+esc(x.cli||"—")+'</td><td style="text-align:left"><button type="button" class="link" data-spgo="'+j+'">'+esc(x.nome)+'</button></td><td style="text-align:left">'+(x.sit==="efetivada"?'efetivada em '+fdate(Date.parse(x.ef.data+"T00:00:00Z")):'proposta'+(x.criada?' de '+fdate(Date.parse(x.criada+"T00:00:00Z")):''))+'</td><td class="c-ph">'+x.itens.length+'</td><td class="c-ph">'+brl(x.sit==="efetivada"?+x.ef.valor:+x.valor||0)+'</td></tr>').join("")
    +'</tbody></table></div></details>';
}
const spRfLab=(rf,x)=>rf==="cdi"?fx(x,1)+"% do CDI":rf==="cdimais"?"CDI + "+fx(x,2)+"% a.a.":rf==="ipca"?"IPCA + "+fx(x,2)+"% a.a.":"Prefixado "+fx(x,2)+"% a.a.";
function spRfEd(it,j){ // taxa da renda fixa editável (útil para CDB, LCI e LCA importados com taxa estimada)
  return '<span class="sprfe"><select data-sprfe="'+j+'" aria-label="Indexador">'+Object.keys(SP_RF).map(k=>'<option value="'+k+'"'+(it.rf===k?' selected':'')+'>'+SP_RF[k]+'</option>').join("")+'</select><span class="affix s"><input inputmode="decimal" data-sprfv="'+j+'" value="'+fx(+it.x||0,2)+'" aria-label="Taxa"><span class="suf">'+(it.rf==="cdi"?"% CDI":"% a.a.")+'</span></span>'+(it.est?'<small class="warn" style="display:block">taxa estimada na importação: ajuste para a taxa real</small>':'')+'</span>'}
function spTopHtml(){
  const c=spC(),tot=c.itens.reduce((a,x)=>a+(+x.w||0),0);
  let h='<section class="panel"><h3>Carteiras e propostas</h3><p class="sub">Monte propostas de carteira para cada cliente com fundos, ações, FIIs, ETFs, BDRs, Tesouro e renda fixa, e veja como a carteira e cada item teriam se saído. Identifique o cliente por um código ou apelido; o nome completo vai só no relatório. As carteiras ficam salvas '+(typeof SYNC!=="undefined"&&SYNC.tok?'no seu repositório privado do GitHub, em todos os aparelhos conectados':'só neste navegador (conecte o GitHub em Mercado › Favoritos e alertas para guardar em todos os aparelhos)')+'.</p>';
  const clis=spClientes(),vis=SP.carts.map((x,j)=>[x,j]).filter(([x,j])=>j===SP.cur||!SP.fcli||(SP.fcli==="__sem"?!x.cli:x.cli===SP.fcli));
  h+='<div class="sprow"><div class="field"><label for="spCliF">Cliente</label><select id="spCliF" data-spclif="1"><option value="">Todos os clientes</option>'+clis.map(k=>'<option value="'+esc(k)+'"'+(SP.fcli===k?' selected':'')+'>'+esc(k)+'</option>').join("")+'<option value="__sem"'+(SP.fcli==="__sem"?' selected':'')+'>Sem cliente</option></select></div>'
    +'<div class="field"><label for="spSel">Carteira</label><select id="spSel" data-spsel="1">'+vis.map(([x,j])=>'<option value="'+j+'"'+(j===SP.cur?' selected':'')+'>'+esc(spRotulo(x))+'</option>').join("")+'</select></div></div>';
  h+='<div class="sprow"><div class="field"><label for="spNome">Nome da carteira</label><input id="spNome" data-spnome="1" value="'+esc(c.nome)+'" maxlength="60" autocomplete="off"></div>'
    +'<div class="field"><label for="spCliI">Cliente (código ou apelido)</label><input id="spCliI" data-spcli="1" list="spCliL" value="'+esc(c.cli||"")+'" maxlength="40" autocomplete="off" placeholder="ex.: C014"><datalist id="spCliL">'+clis.map(k=>'<option value="'+esc(k)+'">').join("")+'</datalist></div>'
    +'<div class="field"><label>Situação</label><div class="spsit">'+(c.sit==="efetivada"?'<span class="fnq fnq1">Efetivada em '+fdate(Date.parse(c.ef.data+"T00:00:00Z"))+'</span>':'<span class="fnq fnq3">Proposta</span>')+(c.criada?' <small>criada em '+fdate(Date.parse(c.criada+"T00:00:00Z"))+(c.ver>1?' · versão '+c.ver:'')+'</small>':'')+'</div></div></div>';
  h+='<div class="spbtns"><button type="button" class="btn sec" data-spnew="1">Nova</button><button type="button" class="btn sec" data-spdup="1">Duplicar</button><button type="button" class="btn sec" data-spver="1">Nova versão</button>'
    +(c.sit==="efetivada"?'<button type="button" class="btn sec" data-spdesef="1">Voltar para proposta</button>':'<button type="button" class="btn sec" data-spefform="1">Efetivar carteira</button>')
    +'<button type="button" class="btn sec" data-spdel="1"'+(SP.carts.length<2?' disabled':'')+'>Excluir</button></div>';
  if(SP.efForm&&c.sit!=="efetivada")h+='<div class="spef"><p class="sub" style="margin:0 0 6px">A partir da data de efetivação o app acompanha o desempenho real desta carteira e compara com o que foi proposto.</p><div class="sprow"><div class="field"><label for="spEfD">Data da aplicação</label><input id="spEfD" type="date" value="'+new Date().toISOString().slice(0,10)+'" max="'+new Date().toISOString().slice(0,10)+'"></div><div class="field"><label for="spEfV">Valor aplicado</label><div class="affix s"><input id="spEfV" inputmode="decimal" value="'+fx(+c.valor||0,2)+'"><span class="suf">R$</span></div></div><div class="field" style="align-self:end"><div class="spbtns" style="margin:0"><button type="button" class="btn" data-spefok="1">Confirmar</button><button type="button" class="btn sec" data-spefno="1">Cancelar</button></div></div></div></div>';
  h+='<details class="nota" style="margin-top:10px"'+(c.obs?' open':'')+'><summary>Observações internas</summary><textarea id="spObs" data-spobs="1" rows="3" maxlength="2000" placeholder="Anotações suas sobre esta carteira (não vão para o relatório)">'+esc(c.obs||"")+'</textarea></details>';
  if(SP.carts.length>1)h+=spListaHtml();
  h+='<div class="spimp"><label class="btn sec" for="spImp">Importar posição da B3 (Excel)</label><input id="spImp" type="file" accept=".xlsx,.xls,.csv" hidden><span class="sub" style="font-size:.8rem">Arquivo de posição da Área do Investidor da B3. Fica só neste navegador.</span><span id="spImpMsg"></span></div>';
  h+='<div class="label" style="margin-top:12px">Composição</div><div class="fnqbox"><input id="spQ" autocomplete="off" placeholder="Adicionar fundo, ativo da B3 (PETR4, HGLG11…), debênture, CRI ou CRA (código ou emissor)"><div id="spRes2" class="fnres" hidden></div></div>';
  h+='<div class="sprf"><span class="sub">ou renda fixa:</span><select data-sprft="1">'+Object.keys(SP_RF).map(k=>'<option value="'+k+'"'+(SP.rf.tipo===k?' selected':'')+'>'+SP_RF[k]+'</option>').join("")+'</select><span class="affix s" style="max-width:130px"><input inputmode="decimal" data-sprfx="1" value="'+esc(SP.rf.taxa)+'" placeholder="'+(SP.rf.tipo==="cdi"?"ex.: 110":"ex.: 6,5")+'"><span class="suf">'+(SP.rf.tipo==="cdi"?"% CDI":"% a.a.")+'</span></span><button type="button" class="btn sec" data-sprfadd="1">Adicionar</button></div>';
  if(c.itens.length){
    h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab sptab"><thead><tr><th style="text-align:left">Item</th><th class="c-ph" style="text-align:left">Tipo</th><th>Peso</th><th class="c-ph">Valor inicial</th><th></th></tr></thead><tbody>';
    c.itens.forEach((it,j)=>{h+='<tr><td style="text-align:left" class="tw"><i class="fndot" style="background:'+CMP_COLS[j%CMP_COLS.length]+'"></i>'+(it.t==="f"?'<button type="button" class="link" data-fnopen="'+it.k+'">'+esc(spItemNome(it))+'</button>':it.t==="a"?'<button type="button" class="link" data-atopen="'+it.k+'">'+esc(spItemNome(it))+'</button>':esc(spItemNome(it))+spRfEd(it,j))+(c.sit==="efetivada"||(it.mov&&it.mov.length)?spMovBtn(it,j):'')+spAjItem(it,j)+'</td><td class="c-ph" style="text-align:left"><small>'+esc(it.tipo||"")+'</small>'+(it.t==="s"?'<label class="spiso"><input type="checkbox" data-spiso="'+j+'"'+(it.isento?' checked':'')+'>isento de IR</label>':'')+'</td><td><span class="affix s" style="width:112px;display:inline-flex"><input inputmode="decimal" data-spw="'+j+'" value="'+fx(+it.w||0,1)+'" style="text-align:right;min-width:0"><span class="suf">%</span></span></td><td class="c-ph">'+brl((+c.valor||0)*(+it.w||0)/100)+'</td><td><button type="button" class="fnx" data-sprm="'+j+'" aria-label="Remover">×</button></td></tr>'+(SP.movOpen===j?spMovRow(c,j):'')});
    h+='</tbody><tfoot><tr><td style="text-align:left"><b>Total</b></td><td class="c-ph"></td><td><b class="'+(Math.abs(tot-100)<0.05?'':'neg')+'">'+fx(tot,1)+'%</b></td><td class="c-ph">'+brl(+c.valor||0)+'</td><td></td></tr></tfoot></table></div>'
      +'<div class="spbtns" style="margin-top:6px"><button type="button" class="link" data-speq="1">Distribuir igualmente</button>'+(Math.abs(tot-100)>0.05&&tot>0?'<button type="button" class="link" data-spnorm="1">Ajustar para somar 100%</button>':'')+'<button type="button" class="link" data-spclear="1">Remover todos</button></div>';
  }
  h+='<div class="spparams"><div class="field"><label for="spV">Valor inicial</label><div class="affix s"><input id="spV" inputmode="decimal" data-spv="valor" value="'+fx(+c.valor||0,2)+'"><span class="suf">R$</span></div></div>'
    +'<div class="field"><label for="spA">Aporte mensal</label><div class="affix s"><input id="spA" inputmode="decimal" data-spv="aporte" value="'+fx(+c.aporte||0,2)+'"><span class="suf">R$</span></div></div>'
    +'<div class="field"><label for="spI">Início</label><input id="spI" type="month" data-spv="ini" value="'+esc(c.ini||"")+'"><small>Vazio = o mais antigo possível</small></div>'
    +'<div class="field"><label for="spF">Fim</label><input id="spF" type="month" data-spv="fim" value="'+esc(c.fim||"")+'"><small>Vazio = o mais recente</small></div>'
    +'<div class="field"><label for="spR">Rebalanceamento</label><select id="spR" data-spv="reb">'+SP_REB.map(([v,l])=>'<option value="'+v+'"'+(String(c.reb)===v?' selected':'')+'>'+l+'</option>').join("")+'</select></div>'
    +'<div class="field"><label for="spB">Base de cálculo</label><select id="spB" data-spv="base"><option value="m"'+(c.base!=="d"?' selected':'')+'>Mensal (desde 2005)</option><option value="d"'+(c.base==="d"?' selected':'')+'>Diária (desde 2019)</option></select></div>'
    +'<div class="field"><label>Imposto de renda</label><label class="spiso" style="margin-top:8px"><input type="checkbox" data-spir="1"'+(c.ir!==0?' checked':'')+'>Mostrar o resultado líquido de IR</label></div></div>';
  h+='<div class="cvsel fnbm" style="margin-top:6px"><span class="sub" style="margin-right:4px">Comparar com:</span>'+Object.keys(FN_BM).map(b=>'<label><input type="checkbox" data-spbm="'+b+'"'+(c.bm&&c.bm[b]?' checked':'')+'><i style="background:'+FN_BM[b].col+'"></i>'+FN_BM[b].lab+'</label>').join("")+'<label>IPCA + <span class="affix s" style="width:84px;display:inline-flex"><input inputmode="decimal" data-spv="ipcax" value="'+esc(c.ipcax||"")+'" placeholder="6"><span class="suf">%</span></span></label></div>';
  h+='</section>';
  $("spTop").innerHTML=h;
}
/* ----- dados de cada item: níveis mensais e diários, e regime de IR */
const SP_IR={lp:"Fundo de longo prazo (come-cotas 15%)",cp:"Fundo de curto prazo (come-cotas 20%)",acoes:"Ações, ETFs e BDRs (15% no resgate)",fii:"FII (rendimentos isentos; 20% sobre o ganho de preço)",rf:"Renda fixa (tabela regressiva)",isento:"Isento de IR",prev:"Previdência (IR no plano)"};
async function spItemData(it){
  if(it.t==="f"){const F=await fnFund(it.k);const m=new Map(),d=new Map();F.MK.forEach(k=>m.set(k,F.M.get(k).q));F.I.forEach((ix,j)=>d.set(FN.cal[ix],F.Q[j]));
    const txt=fnNorm((F.cls||"")+" "+(F.anb||"")+" "+(F.n||""));const reg=/^s/i.test(F.prev||"")||/previd/.test(txt)?"prev":/acoes/.test(txt)?"acoes":/^s/i.test(F.lp||"")?"lp":/^n/i.test(F.lp||"")?"cp":"lp";
    return {m,d,reg}}
  if(it.t==="a"){const A=await atFile(it.k);const m=new Map(),pm=new Map(),d=new Map();A.MK.forEach(k=>{m.set(k,A.M.get(k).q);pm.set(k,A.M.get(k).p)});A.I.forEach((ix,j)=>d.set(AT.cal[ix],A.Q[j]));
    const reg=A.tipo==="Tesouro Direto"?"rf":AT_FUNDO.has(A.tipo)?"fii":"acoes";return {m,d,pm,reg}}
  return {m:spRfSeries(it),d:spRfDaily(it),reg:it.isento?"isento":"rf"};
}
function spRfSeries(it){
  const L=FN.L,m=new Map(),x=num(String(it.x))||0;if(!L)return m;const cdi=L.m.cdi||{},ipca=L.m.ipca||{};
  const ks=Object.keys(cdi).map(Number).sort((a,b)=>a-b);let v=1;let prev=null;
  ks.forEach(k=>{if(prev==null){m.set(k,1);prev=k;return}const c=cdi[k]/cdi[prev]-1;let r;
    if(it.rf==="cdi")r=c*x/100;else if(it.rf==="cdimais")r=(1+c)*Math.pow(1+x/100,1/12)-1;else if(it.rf==="pre")r=Math.pow(1+x/100,1/12)-1;
    else{const i=ipca[k]!=null&&ipca[k-1]!=null?ipca[k]/ipca[k-1]-1:null;if(i==null){return}r=(1+i)*Math.pow(1+x/100,1/12)-1}
    v*=1+r;m.set(k,v);prev=k});
  return m;
}
function spRfDaily(it){
  const L=FN.L,d=new Map(),x=num(String(it.x))||0;if(!L||!L.d.cdi)return d;const C=L.d.cdi,I=L.d.ipca||[];let v=1;
  FN.cal.forEach((dt,i)=>{if(i===0){d.set(dt,1);return}const c=C[i]/C[i-1]-1;let r;
    if(it.rf==="cdi")r=c*x/100;else if(it.rf==="cdimais")r=(1+c)*Math.pow(1+x/100,1/252)-1;else if(it.rf==="pre")r=Math.pow(1+x/100,1/252)-1;
    else{const ii=I[i]&&I[i-1]?I[i]/I[i-1]-1:0;r=(1+ii)*Math.pow(1+x/100,1/252)-1}
    v*=1+r;d.set(dt,v)});
  return d;
}
function spBmSeries(b,c){
  const L=FN.L;if(!L)return null;if(b==="ipcax"){const x=num(String(c.ipcax||""));if(x==null)return null;return spRfSeries({rf:"ipca",x})}
  const o=L.m[b];if(!o)return null;const m=new Map();Object.keys(o).forEach(k=>{if(o[k]!=null)m.set(+k,o[k])});return m;
}
function spBmDaily(b,c){
  const L=FN.L;if(!L)return null;if(b==="ipcax"){const x=num(String(c.ipcax||""));if(x==null)return null;return spRfDaily({rf:"ipca",x})}
  const a=L.d[b];if(!a)return null;const d=new Map();FN.cal.forEach((dt,i)=>{if(a[i]!=null)d.set(dt,a[i])});return d;
}
let SP_TOKEN=0;
async function spRunCore(){
  const c=spC(),box=$("spRes"),tok=++SP_TOKEN;if(!box)return;
  const it=c.itens.filter(x=>(+x.w||0)>0);
  if(!it.length){box.innerHTML='<section class="panel"><p class="sub">Adicione fundos, ativos ou renda fixa e defina os pesos.</p></section>'+spAssHtml()+spCmpCartsHtml();if(SP_ASS)spAssRender();return}
  box.innerHTML='<section class="panel"><p class="sub">Calculando…</p></section>';
  const itM=c.itens.filter(x=>!((+x.w||0)>0)&&Array.isArray(x.mov)&&x.mov.length);
  let D,DM;try{[D,DM]=await Promise.all([Promise.all(it.map(spItemData)),Promise.all(itM.map(spItemData))])}catch(e){box.innerHTML='<section class="panel"><p class="err">Não deu para carregar um dos itens: '+esc(e.message)+'</p></section>';return}
  if(tok!==SP_TOKEN)return;
  try{const R=spSim(c,it,D);R.D=D;if(spTemMov(c))R.pos={its:it.concat(itM),Ds:D.concat(DM)};
    if(c.sit==="efetivada"&&c.ef&&c.ef.data){const d=c.ef.data,dia=FN.cal&&d>=FN.cal[0];R.ef=spSim(Object.assign({},c,{base:dia?"d":"m",ini:dia?"":d.slice(0,7),iniD:dia?d:"",fim:"",aporte:0,valor:+c.ef.valor||0}),it,D)}
    box.innerHTML=fnUse(FN,()=>spResHtml(c,it,R))+spAssHtml()+spCmpCartsHtml();if(SP_ASS)spAssRender()}catch(e){box.innerHTML='<section class="panel"><p class="err">'+esc(e.message)+'</p></section>';console.error(e)}
}
/* ----- grade de datas e simulação */
function spGrid(c,D){
  const diaria=c.base==="d",keys=[];
  if(diaria){FN.cal.forEach(d=>keys.push(d))}
  else{const all=new Set();D.forEach(x=>x.m.forEach((v,k)=>all.add(k)));const ks=[...all].sort((a,b)=>a-b);if(ks.length)for(let k=ks[0];k<=ks[ks.length-1];k++)keys.push(k)}
  const tOf=k=>diaria?Date.parse(k+"T00:00:00Z"):fnMt(k),mOf=k=>diaria?+k.slice(0,4)*12+(+k.slice(5,7))-1:k;
  const lv=D.map(x=>{const src=diaria?x.d:x.m;let last=null,seen=false;const arr=keys.map(k=>{const v=src.get(k);if(v!=null){last=v;seen=true}return seen?last:null});
    const ks=[...src.keys()].sort();return {arr,first:ks[0],lastKey:ks[ks.length-1]}});
  return {diaria,keys,tOf,mOf,lv};
}
function spSim(c,it,D){
  const G=spGrid(c,D),K=G.keys;if(!K.length)return {erro:"Sem dados."};
  let j0=0;for(;j0<K.length;j0++){if(G.lv.every(x=>x.arr[j0]!=null))break}
  if(c.ini){const [y,mm]=c.ini.split("-").map(Number);const want=y*12+mm-2;while(j0<K.length&&G.mOf(K[j0])<want)j0++}
  if(c.iniD&&G.diaria){let j=j0;while(j+1<K.length&&K[j+1]<=c.iniD)j++;j0=j}
  let j1=K.length-1;const lastItem=G.lv.map(x=>x.lastKey).reduce((a,b)=>a<b?a:b);while(j1>j0&&K[j1]>lastItem)j1--;
  if(!G.diaria){const cdi=FN.L.m.cdi||{},lc=Math.max(...Object.keys(cdi).map(Number));while(j1>j0&&K[j1]>lc)j1--}
  if(c.fim){const [y,mm]=c.fim.split("-").map(Number);const lim=y*12+mm-1;while(j1>j0&&G.mOf(K[j1])>lim)j1--}
  if(!(j1>j0))return {erro:"Não há período em comum para todos os itens"+(c.ini||c.fim?" nas datas escolhidas":"")+"."};
  const W=it.map(x=>+x.w/100),sw=W.reduce((a,x)=>a+x,0),w=W.map(x=>x/sw),reb=+c.reb||0,ap=+c.aporte||0,v0=+c.valor||0,ir=c.ir!==0;
  const reg=D.map(x=>x.reg),ccRate=r=>r==="lp"?0.15:r==="cp"?0.2:0;
  let V=w.map(x=>x*v0),idx=1,inv=v0,n=0;
  let Vn=V.slice(),base=V.slice(),ccb=V.slice(),cc=w.map(()=>0),nidx=1,lvPrev=null;
  const aliq=(i,meses)=>{const r=reg[i];if(r==="lp"||r==="rf")return meses<=6?0.225:meses<=12?0.2:meses<=24?0.175:0.15;if(r==="cp")return meses<=6?0.225:0.2;if(r==="acoes")return 0.15;if(r==="fii")return 0.2*(SP_FIIPRICE[i]==null?1:SP_FIIPRICE[i]);return 0};
  const liq=(meses)=>{let tot=0;Vn.forEach((v,i)=>{const ganho=v+cc[i]-base[i],devido=Math.max(0,ganho*aliq(i,meses)-cc[i]);tot+=v-devido});return tot};
  let irReb=0;
  const SP_FIIPRICE=D.map((x,i)=>{if(reg[i]!=="fii"||!x.pm)return null;const a0=G.mOf(K[j0]),a1=G.mOf(K[j1]);const p0=x.pm.get(a0),p1=x.pm.get(a1),q0=x.m.get(a0),q1=x.m.get(a1);if(!p0||!p1||!q0||!q1)return 1;const pr=p1/p0-1,tr=q1/q0-1;return tr>0?Math.max(0,Math.min(1,pr/tr)):0});
  const pts=[{k:K[j0],t:G.tOf(K[j0]),v:v0,idx:1,inv,liq:v0,nidx:1}],rets=[],contrib=w.map(()=>0),irets=w.map(()=>[]);
  lvPrev=v0;
  for(let j=j0+1;j<=j1;j++){
    const r=G.lv.map(x=>x.arr[j]/x.arr[j-1]-1);r.forEach((x,i)=>irets[i].push(x));
    const tot0=V.reduce((a,x)=>a+x,0);V=V.map((x,i)=>x*(1+r[i]));const tot1=V.reduce((a,x)=>a+x,0),rp=tot0?tot1/tot0-1:0;
    V.forEach((x,i)=>{contrib[i]+=tot0?(V[i]/(1+r[i]))/tot0*r[i]*idx:0});idx*=1+rp;
    Vn=Vn.map((x,i)=>x*(1+r[i]));
    const novoMes=G.mOf(K[j])!==G.mOf(K[j-1]);let aj=0;
    if(novoMes){n++;const mesAnt=G.mOf(K[j-1])%12;
      if(ir&&(mesAnt===4||mesAnt===10))Vn.forEach((x,i)=>{const t=ccRate(reg[i]);if(!t)return;const g=x-ccb[i];if(g>0){const tx=g*t;Vn[i]-=tx;cc[i]+=tx}ccb[i]=Vn[i]});
      if(ap>0){V=V.map((x,i)=>x+ap*w[i]);Vn=Vn.map((x,i)=>x+ap*w[i]);base=base.map((x,i)=>x+ap*w[i]);ccb=ccb.map((x,i)=>x+ap*w[i]);inv+=ap;aj=ap}
      if(reb&&n%reb===0){const T=V.reduce((a,x)=>a+x,0);V=w.map(x=>x*T);
        if(ir){const T0=Vn.reduce((a,x)=>a+x,0);Vn.forEach((x,i)=>{const alvo=w[i]*T0;if(alvo<x&&x>0){const fs=(x-alvo)/x,dev=fs*Math.max(0,(x+cc[i]-base[i])*aliq(i,n)-cc[i]);if(dev>0){Vn[i]-=dev;irReb+=dev}}})}
        const Tn=Vn.reduce((a,x)=>a+x,0);
        Vn.forEach((x,i)=>{const alvo=w[i]*Tn;if(alvo<x&&x>0){const f=alvo/x;base[i]*=f;ccb[i]*=f;cc[i]*=f}else{base[i]+=alvo-x;ccb[i]+=alvo-x}Vn[i]=alvo})}}
    rets.push({k:K[j],t:G.tOf(K[j]),m:G.mOf(K[j]),r:rp});
    const L=ir?liq(n):Vn.reduce((a,x)=>a+x,0);nidx*=lvPrev?(L-aj)/lvPrev:1;lvPrev=L;
    pts.push({k:K[j],t:G.tOf(K[j]),v:V.reduce((a,x)=>a+x,0),idx,inv,liq:L,nidx});
  }
  const per=G.lv.map(x=>(x.arr[j1]/x.arr[j0]-1)*100);
  return {G,j0,j1,k0:K[j0],last:K[j1],m0:G.mOf(K[j0]),m1:G.mOf(K[j1]),pts,rets,irets,contrib:contrib.map(x=>x*100),per,w,reg,meses:n,diaria:G.diaria,ir,irReb};
}
function spCdiLv(R){ // nível do CDI em cada ponto da grade
  if(R.diaria){const a=FN.L.d.cdi||[],ix=new Map(FN.cal.map((d,i)=>[d,i]));return k=>{const i=ix.get(k);return i==null?null:a[i]}}
  const m=FN.L.m.cdi||{};return k=>m[k]!=null?m[k]:null;
}
function spStats(R,rets,idxEnd){
  const n=rets.length;if(!n)return {};const ppy=R.diaria?252:12,cl=spCdiLv(R);
  const mu=rets.reduce((a,x)=>a+x.r,0)/n,sd=Math.sqrt(rets.reduce((a,x)=>a+(x.r-mu)**2,0)/Math.max(1,n-1));
  const c0=cl(R.k0),c1=cl(rets[n-1].k),cTot=c0&&c1?c1/c0-1:null,anos=R.diaria?n/252:n/12;
  const ann=Math.pow(idxEnd,1/anos)-1,cAnn=cTot!=null?Math.pow(1+cTot,1/anos)-1:null;
  let pk=1,v=1,dd=0;rets.forEach(x=>{v*=1+x.r;if(v>pk)pk=v;dd=Math.min(dd,v/pk-1)});
  // meses acima do CDI e melhor/pior mês (agrega a base diária em meses)
  const mm=new Map();let prevK=R.k0;rets.forEach(x=>{const o=mm.get(x.m)||{r:1,c0:cl(prevK)};o.r*=1+x.r;o.c1=cl(x.k);mm.set(x.m,o);prevK=x.k});
  let acima=0,nc=0;const mr=[];mm.forEach(o=>{const rr=o.r-1;mr.push(rr);if(o.c0&&o.c1){nc++;if(rr>o.c1/o.c0-1)acima++}});mr.sort((a,b)=>a-b);
  return {tot:(idxEnd-1)*100,ann:ann*100,vol:sd*Math.sqrt(ppy)*100,sharpe:cAnn!=null&&sd>0?(ann-cAnn)/(sd*Math.sqrt(ppy)):null,dd:dd*100,cdi:cTot!=null?cTot*100:null,pcdi:cTot>0?(idxEnd-1)/cTot*100:null,acima:nc?acima/nc*100:null,best:mr[mr.length-1]*100,worst:mr[0]*100,n,meses:mm.size};
}
function spResHtml(c,it,R){
  if(R.erro)return '<section class="panel"><p class="warn">'+esc(R.erro)+'</p></section>';
  const last=R.pts[R.pts.length-1],st=spStats(R,R.rets,last.idx),lbl=k=>R.diaria?fdate(Date.parse(k+"T00:00:00Z")):mname(k);
  const kp=(a,b,cc)=>'<div class="fnkp"><span>'+a+'</span><b>'+b+'</b>'+(cc?'<small>'+cc+'</small>':'')+'</div>';
  if(!R.pos)SP_POS=null;
  const pos=R.pos?spPosHtml(c,R.pos.its,R.pos.Ds):R.ef?spEfHtml(c,it,R.ef,st):'';   // a posição real vem antes: o painel usa os valores dela
  let h=spPainelHtml(c,it,R)+spPolHtml(c,it)+spCreditoHtml(c,it,R)+pos+'<section class="panel" id="spPanel" data-reltit="Resumo da carteira (histórico)"><div class="fnh1"><div><h3>'+esc(c.nome)+'</h3><div class="fnsub">De '+lbl(R.k0)+' a '+lbl(R.last)+' ('+st.meses+' meses, base '+(R.diaria?'diária':'mensal')+') · '+SP_REB.find(x=>x[0]===String(c.reb))[1].toLowerCase()+'</div></div><div class="fnacts"><button type="button" class="btn sec" data-relsp="1">Relatório PDF</button><button type="button" class="btn sec" data-spcsv="1">Baixar CSV</button></div></div>';
  const nst=R.ir?{tot:(last.nidx-1)*100}:null;
  h+='<div class="fnkpis">'+kp("Patrimônio final",brl(last.v),(R.ir?"líquido de IR "+brl(last.liq):"investido "+brl(last.inv)))+kp("Retorno no período",fnPct(st.tot),(st.pcdi!=null?fx(st.pcdi,0)+"% do CDI":"")+(R.ir?" · líquido de IR "+fnPctT(nst.tot):""))+kp("Retorno ao ano",fnPctT(st.ann),"volatilidade "+fx(st.vol,2)+"%")+kp("Sharpe",st.sharpe!=null?fx(st.sharpe,2):"—","meses acima do CDI "+(st.acima!=null?fx(st.acima,0)+"%":"—"))+kp("Perda máxima",fnPct(st.dd),"pior mês "+fnPctT(st.worst))+'</div>';
  const S=[{lab:c.nome,col:FN_COLS[0],w:2.4,pts:fnThin(R.pts,800).map(p=>[p.t,(p.idx-1)*100])}],bms=[];
  if(R.ir)S.push({lab:c.nome+" (líquida de IR)",col:FN_COLS[0],dash:"3 3",w:1.6,pts:fnThin(R.pts,800).map(p=>[p.t,(p.nidx-1)*100])});
  Object.keys(FN_BM).concat(["ipcax"]).forEach(b=>{if(b==="ipcax"?!(c.ipcax&&num(String(c.ipcax))!=null):!(c.bm&&c.bm[b]))return;const m=R.diaria?spBmDaily(b,c):spBmSeries(b,c);if(!m||!m.get(R.k0))return;const b0=m.get(R.k0);
    const lab=b==="ipcax"?"IPCA + "+c.ipcax+"%":FN_BM[b].lab,col=b==="ipcax"?"var(--s2)":FN_BM[b].col;
    S.push({lab,col,dash:b==="cdi"||b==="ipcax"?"5 4":null,w:1.5,pts:fnThin(R.pts,800).map(p=>{const v=m.get(p.k);return [p.t,v?(v/b0-1)*100:null]})});bms.push([b,lab,m])});
  h+='<div class="label" style="margin-top:6px">Rentabilidade acumulada (sem efeito dos aportes)</div>'+fnChart(S,{fmt:"pct",zero:true,months:!R.diaria,aria:"Rentabilidade da carteira"});
  h+='</section>'+spCompHtml(c,it,R)+spItensHtml(c,it,R)+spStressHtml(c,it,R);
  if(+c.aporte>0||R.ir)h+='<section class="panel" data-reltit="Patrimônio e valor investido"><h3>Patrimônio e valor investido</h3>'+fnChart([{lab:"Patrimônio bruto",col:FN_COLS[0],w:2.2,pts:fnThin(R.pts,600).map(p=>[p.t,p.v])}].concat(R.ir?[{lab:"Líquido de IR (se resgatar)",col:"var(--gain)",w:1.8,pts:fnThin(R.pts,600).map(p=>[p.t,p.liq])}]:[]).concat([{lab:"Total investido",col:"var(--flat)",dash:"5 4",w:1.5,pts:fnThin(R.pts,600).map(p=>[p.t,p.inv])}]),{fmt:"money",months:!R.diaria,aria:"Patrimônio"})+'</section>';
  let pk=1,v=1;const dd=[[R.pts[0].t,0]];R.rets.forEach(x=>{v*=1+x.r;pk=Math.max(pk,v);dd.push([x.t,(v/pk-1)*100])});
  h+='<section class="panel" data-reltit="Perda a partir do pico e metodologia"><h3>Perda a partir do pico (drawdown)</h3>'+fnChart([{lab:"Drawdown",col:"var(--loss)",pts:fnThin(dd.map(x=>({t:x[0],v:x[1]})),700).map(x=>[x.t,x.v])}],{fmt:"pct",zero:true,fill:true,h:160,months:!R.diaria,aria:"Drawdown"});
  if(it.some(x=>/^cr:/.test(x.k)))h+='<p class="warn" style="font-size:.84rem">Debêntures, CRI e CRA entram com a taxa indicativa atual da ANBIMA aplicada a todo o período: é uma estimativa do carrego, sem a oscilação de preço (marcação a mercado) nem o risco de crédito do emissor. A ANBIMA só publica os preços dos últimos dias.</p>';
  h+='<p class="sub" style="font-size:.8rem">Simulação '+(R.diaria?'diária (cotas e cotações de cada dia útil, desde 2019)':'mensal (fechamentos de fim de mês, desde 2005)')+': cota dos fundos (CVM), cotação com proventos dos ativos (B3), Tesouro Direto (preço de resgate) e índices do Banco Central. '+(R.ir?'O valor líquido estima o IR se tudo fosse resgatado na data: come-cotas em maio e novembro nos fundos, tabela regressiva na renda fixa, 15% em ações, ETFs e BDRs e 20% sobre o ganho de preço dos FIIs. Nos rebalanceamentos, a parte vendida de cada item paga IR sobre o ganho proporcional (sem a isenção de R$ 20 mil mensais em ações)'+(R.irReb>0?': '+brl(R.irReb)+' no período':'')+'. ':'Valores brutos, sem IR. ')+'Sem corretagem e custódia. Os pesos voltam ao alvo no rebalanceamento; os aportes seguem os pesos-alvo.</p></section>';
  // ano a ano
  const anos=[...new Set(R.rets.map(x=>Math.floor(x.m/12)))].sort((a,b)=>b-a);
  const yrC=y=>{let v2=1,ok=false;R.rets.forEach(x=>{if(Math.floor(x.m/12)!==y)return;v2*=1+x.r;ok=true});return ok?(v2-1)*100:null};
  const yrB=(m,y)=>{let a=null,z=null,prev=R.k0;R.rets.forEach(x=>{if(Math.floor(x.m/12)===y){if(a==null)a=m.get(prev);z=m.get(x.k)}prev=x.k});return a&&z?(z/a-1)*100:null};
  h+='<section class="panel" data-reltit="Ano a ano"><h3>Ano a ano</h3><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ano</th><th>Carteira</th>'+bms.map(b=>'<th>'+esc(b[1])+'</th>').join("")+'</tr></thead><tbody>';
  anos.forEach(y=>{h+='<tr><td style="text-align:left">'+y+'</td><td><b>'+fnPct(yrC(y))+'</b></td>'+bms.map(b=>'<td>'+fnPct(yrB(b[2],y))+'</td>').join("")+'</tr>'});
  h+='<tr class="cmpbm"><td style="text-align:left">Período</td><td><b>'+fnPct(st.tot)+'</b></td>'+bms.map(b=>{const a=b[2].get(R.k0),z=b[2].get(R.last);return '<td>'+(a&&z?fnPct((z/a-1)*100):'—')+'</td>'}).join("")+'</tr></tbody></table></div></section>';
  // contribuição por item
  const totC=R.contrib.reduce((a,x)=>a+x,0);
  h+='<section class="panel" data-reltit="Contribuição de cada item e correlação"><h3>Contribuição de cada item</h3><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th>Peso-alvo</th><th>Retorno do item</th><th>Contribuição</th><th class="c-ph">% do resultado</th>'+(R.ir?'<th class="c-ph" style="text-align:left">Tributação considerada</th>':'')+'</tr></thead><tbody>';
  it.forEach((x,i)=>{h+='<tr><td style="text-align:left" class="tw"><i class="fndot" style="background:'+CMP_COLS[c.itens.indexOf(x)%CMP_COLS.length]+'"></i>'+esc(spItemNome(x))+'</td><td>'+fx(R.w[i]*100,1)+'%</td><td>'+fnPct(R.per[i])+'</td><td>'+fnPct(R.contrib[i])+' <small>p.p.</small></td><td class="c-ph">'+(totC?fx(R.contrib[i]/totC*100,0)+'%':'—')+'</td>'+(R.ir?'<td class="c-ph tw" style="text-align:left"><small>'+esc(SP_IR[R.reg[i]]||"")+'</small></td>':'')+'</tr>'});
  h+='</tbody></table></div><p class="sub" style="font-size:.8rem">Contribuição: quanto cada item somou ao retorno da carteira, em pontos percentuais, considerando o peso que ele tinha a cada momento.</p>';
  if(it.length>1)h+=spCorHtml(it,R);
  h+='</section>';
  h+=spFichasHtml(c,it)+spProjHtml(c,R)+spOtimHtml(c,it,R);
  SP.last={c,it,R,st,bms};
  return h;
}
