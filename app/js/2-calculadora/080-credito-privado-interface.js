/* ================= Crédito privado: interface ================= */
const PCF={
  DI_SPREAD:{pre:"CDI +",suf:"% a.a.",dec:2,ex:"2,00",axis:"Taxa de mercado (CDI + % a.a.)",span:1.5,txt:r=>"CDI + "+fx(r,2)+"% a.a."},
  DI_PCT:{pre:"",suf:"% do CDI",dec:2,ex:"110,00",axis:"Taxa de mercado (% do CDI)",span:15,txt:r=>fx(r,2)+"% do CDI"},
  IPCA:{pre:"IPCA +",suf:"% a.a.",dec:2,ex:"7,00",axis:"Taxa de mercado (IPCA + % a.a.)",span:2,txt:r=>"IPCA + "+fx(r,2)+"% a.a."},
  PRE:{pre:"",suf:"% a.a.",dec:2,ex:"13,00",axis:"Taxa de mercado (% a.a.)",span:2.5,txt:r=>fx(r,2)+"% a.a."}
};
const TYPE_NAME={DEB:"Debênture",CRI:"CRI",CRA:"CRA"};
let PAPERS=JSON.parse(JSON.stringify(PAPERS0)),pcDb=null,activeMod="pub";let PC_RATES_ON=false;
const pcMemo=new Map();
function codeClean(c){c=String(c||"").trim().toUpperCase().replace(/\s+/g,"");c=c.replace(/^(CRA|CRI|DEB|DEBENTURE)[-–_.\/]+/,"");c=c.replace(/^(CRA|CRI)(?=(CRA|CRI)[0-9])/,"");const d=c.match(/^DEB([A-Z]{4}[0-9]{2})$/);if(d)c=d[1];return c.replace(/[^A-Z0-9]/g,"")}
function pcCanon(c){c=codeClean(c);if(!c||PAPERS[c])return c;const m=c.match(/^(CRI|CRA)([0-9].*)$/);if(m&&PAPERS[m[2]])return m[2];if(/^[0-9]/.test(c)){if(PAPERS["CRI"+c])return "CRI"+c;if(PAPERS["CRA"+c])return "CRA"+c}return c}
function pcP(code){return PAPERS[code]||PAPERS[pcCanon(code)]}
function posLoad(code){try{return JSON.parse(localStorage.getItem("pos:"+code)||"null")}catch(e){return null}}
function posSave(code,o){try{localStorage.setItem("pos:"+code,JSON.stringify(o))}catch(e){}}
function pcList(){const dl=$("pcList");dl.innerHTML="";Object.keys(PAPERS).sort().forEach(k=>{const o=document.createElement("option");o.value=k;o.label=(PAPERS[k].name||"");dl.appendChild(o)})}
function lastDate(P){const s=(P.schedule||[]).map(r=>r[0]).sort();return s.length?parseDate(s[s.length-1]):NaN}
function pcValid(P){return P&&P.status!=="pending"&&PCF[P.index]&&Array.isArray(P.schedule)&&P.schedule.length&&isFinite(P.rate)&&P.vne>0&&!isNaN(parseDate(P.start))}

let pcCurCode=null,pcManual=false,PC_INIT=null;
function pcSetCode(code){
  pcCurCode=code;const P=pcP(code),pos=posLoad(code);PC_INIT=P&&PCF[P.index]?code:null;
  pcManual=false;
  if(pos){$("pcBuy").value=pos.buy||$("pcBuy").value;$("pcRate").value=pos.rate||"";$("pcQty").value=pos.qty||"1";$("pcPaid").value=pos.paid||"";if(pos.mrate){$("pcMrate").value=pos.mrate;pcManual=true}else $("pcMrate").value=""}
  else if(P&&PCF[P.index]){$("pcRate").value=fx(P.rate,2);$("pcMrate").value="";$("pcPaid").value="";
    const st=parseDate(P.start),b=parseDate($("pcBuy").value);if(isFinite(st)&&(isNaN(b)||b<st||b>=VAL)){let t=st;while(!isBiz(t))t+=DAY;if(t<VAL)$("pcBuy").value=isoD(t)}}
  pcAuto();
}

/* taxa de mercado estimada: spread de crédito da emissão mantido sobre o título público de mesmo vencimento */
function pcBenchAt(fam,H,matT){
  const ns=fam==="IPCA"?[0,1]:[4,5],pts=[];
  txIndex().forEach(s=>{if(!ns.includes(s.n)||!s.t.length||H<s.t[0])return;const mt=Date.parse(s.m);if(!(mt>H+90*DAY))return;
    let lo=0,hi=s.t.length-1;if(s.t[hi]<=H)lo=hi;else{while(hi-lo>1){const m=(lo+hi)>>1;if(s.t[m]<=H)lo=m;else hi=m}}
    if(H-s.t[lo]>10*DAY)return;const v=s.v[lo]!=null?s.v[lo]:s.c[lo];if(v==null||!isFinite(v))return;pts.push([mt,+v])});
  if(!pts.length)return null;pts.sort((a,b)=>a[0]-b[0]);
  const M=[];pts.forEach(p=>{const l=M[M.length-1];if(l&&Math.abs(l[0]-p[0])<20*DAY){l[1]=(l[1]*l[2]+p[1])/(l[2]+1);l[2]++}else M.push([p[0],p[1],1])});
  if(matT<=M[0][0])return {r:M[0][1],a:M[0][0],b:M[0][0]};const L=M[M.length-1];if(matT>=L[0])return {r:L[1],a:L[0],b:L[0]};
  for(let i=1;i<M.length;i++)if(matT<=M[i][0]){const [x0,y0]=M[i-1],[x1,y1]=M[i];return {r:y0+(y1-y0)*(matT-x0)/(x1-x0),a:x0,b:x1}}
  return null;
}
const PCE_MEMO=new Map();
function pcDistress(P){
  if(!P)return null;try{const E=((DEBEV||{})[P.code]||{}).events||[];const ev=E.filter(e=>e&&/^(inadimplencia|vencimento_antecipado|repactuacao)$/.test(e.type)&&parseDate(e.date)>VAL-540*DAY).sort((a,b)=>String(a.date).localeCompare(String(b.date))).pop();if(ev)return ev}catch(e){}
  if(P.anbimaNA)return {date:P.anbimaNA,type:"na",desc:"A ANBIMA deixou de divulgar taxa indicativa para este papel."};return null;
}
function pcDzTxt(ev){return (ev.type==="na"?'<b>Atenção: a ANBIMA lista este papel, mas sem taxa indicativa.</b> Isso costuma indicar reestruturação, inadimplência ou falta de negócios.':'<b>Atenção: papel com evento de crédito.</b> ')+(ev.type==="na"?"":pcEsc(ev.desc||""))+(ev.date&&ev.type!=="na"?' ('+fdate(parseDate(ev.date))+')':'')+' A ANBIMA não divulga taxa indicativa e não há como estimar um preço confiável: o valor de mercado depende da negociação dos credores. Informe a taxa que a corretora mostra hoje (ou o preço de referência do extrato). Enquanto isso, o app avalia a posição na curva (pela taxa contratada), o que provavelmente superestima o valor.'}
function pcEst(P){
  if(!P||P.status!=="ok"||!isFinite(+P.rate))return null;const dz=pcDistress(P);if(dz)return {distress:dz};const k=P.code+"|"+VAL+"|"+P.rate+"|"+P.start+"|"+(P.updatedAt||"");if(PCE_MEMO.has(k))return PCE_MEMO.get(k);
  let out=null;try{
  const st=parseDate(P.start),mt=lastDate(P);
  if(P.index==="DI_SPREAD"||P.index==="DI_PCT")out={rate:+P.rate,di:true};
  else if(isFinite(st)&&isFinite(mt)){const fam=P.index==="IPCA"?"IPCA":"PRE",b0=pcBenchAt(fam,st,mt),b1=pcBenchAt(fam,VAL,mt);
    if(b0&&b1)out={rate:+P.rate+(b1.r-b0.r),fam,b0:b0.r,b1:b1.r,st,spread:+P.rate-b0.r};}
  }catch(e){out=null}
  PCE_MEMO.set(k,out);return out;
}
function pcEstTxt(P,e){
  if(!e)return "";const bn=e.fam==="IPCA"?"Tesouro IPCA+":"Tesouro Prefixado",m=fdate(lastDate(P)).slice(3);
  const nao=P&&P.anbima?'a taxa da ANBIMA não pôde ser usada (o cadastro disponível não reproduz o PU publicado)':'a ANBIMA não publica este papel';
  if(e.di)return 'Taxa <b>estimada</b>: '+nao+', então mantive o spread de crédito da emissão ('+PCF[P.index].txt(+P.rate)+'). Se a corretora mostrar a taxa de venda, digite-a aqui.';
  return 'Taxa <b>estimada</b>: '+nao+'. Na emissão ('+fdate(e.st)+'), a taxa de '+fx(+P.rate,2)+'% equivalia ao '+bn+' de vencimento próximo de '+m+' ('+fx(e.b0,2)+'%) mais um spread de crédito de '+fx(e.spread,2)+' p.p. Mantido esse spread sobre a taxa do '+bn+' de hoje ('+fx(e.b1,2)+'%), a taxa de mercado estimada é '+fx(e.rate,2)+'%. Se a corretora mostrar a taxa de venda, digite-a aqui.';
}
function pcAutoOk(P){return !!(P&&P.anbima&&isFinite(P.anbima.rate)&&pcCheck(P)!==false)}
function pcAuto(){const P=pcP(pcCurCode);if(pcManual)return;if(pcAutoOk(P))$("pcMrate").value=fx(P.anbima.rate,4);else{const e=pcEst(P);if(e&&isFinite(e.rate))$("pcMrate").value=fx(e.rate,4)}}
const PADJ=new Map();
const PADJ_BIG=new Map();
function pcAdjK(P){ // PU oficial / PU do modelo na taxa ANBIMA: até 0,5% é ajuste fino; acima disso, saldo devedor inferido pelo preço oficial
  if(!P||!P.anbima||!(P.anbima.pu>0)||!isFinite(P.anbima.rate)||parseDate(P.anbima.refDate)!==VAL)return 1;
  const key=P.code+"|"+P.anbima.refDate+"|"+P.anbima.rate+"|"+(P.schedule||[]).length+"|"+VAL;if(PADJ.has(key))return PADJ.get(key);
  const p=pcPrice(P,VAL,P.anbima.rate),k=p&&p.pu>0?P.anbima.pu/p.pu:1,v=Math.abs(k-1)<=0.005?k:(k>0.02&&k<50?k:1);PADJ.set(key,v);PADJ_BIG.set(P.code,Math.abs(v-1)>0.005?v:null);return v}
function pcCheck(P){ // confere a taxa ANBIMA reproduzindo o PU publicado
  if(!P||!P.anbima||!(P.anbima.pu>0)||parseDate(P.anbima.refDate)!==VAL)return null;
  const p=pcPrice(P,VAL,P.anbima.rate);if(!p)return null;
  if(Math.abs(p.pu-P.anbima.pu)/P.anbima.pu<=(P.index==="IPCA"?0.0005:0.0002))return true;
  const k=pcAdjK(P);return k===1?false:Math.abs(k-1)<=0.005?true:"adj";
}
function pcEsc(s){return String(s==null?"":s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
function pcAgeTxt(ms){const s=Math.max(0,Math.round(ms/1000));return "há "+(s>=60?Math.floor(s/60)+" min "+(s%60)+" s":s+" s")}
setInterval(()=>{const a=document.getElementById("pcAge");if(a)a.textContent=pcAgeTxt(Date.now()-(+a.dataset.t))},1000);
document.addEventListener("click",e=>{if(e.target.closest("[data-pcgo]")){e.preventDefault();if(!$("pcFetch").disabled)pcFetch()}});
function pcInfo(P,code){
  const box=$("pcInfo");
  if(!code){box.innerHTML='<p class="sub">Digite o código de uma debênture, CRI ou CRA.</p>';return}
  if(!P){box.innerHTML='<div class="alertbox"><p><b>'+pcEsc(code)+'</b> ainda não está na base do app.</p><p class="sub" style="font-size:.86rem;margin-top:4px">Na primeira vez, o Claude pesquisa as características do papel (taxa, datas e fluxo de pagamentos) em fontes como XP, ANBIMA, debentures.com.br e documentos da emissão. Leva de 3 a 6 minutos e a tela atualiza sozinha. Depois disso, o papel abre na hora.</p><p style="margin-top:8px"><button type="button" class="btn" data-pcgo="1">Buscar agora</button> <span class="sub" style="font-size:.82rem">ou tecle Enter no código</span></p></div>';return}
  if(P.status==="pending"){const age=Date.now()-Date.parse(P.requestedAt||0);box.innerHTML=age>20*60000?'<p class="err">A busca de <b>'+pcEsc(code)+'</b> não terminou. <button type="button" class="link" data-pcgo="1">Tentar de novo</button></p>':'<p class="sub run">Pesquisando <b>'+pcEsc(code)+'</b>… <span id="pcAge" data-t="'+Date.parse(P.requestedAt||0)+'">'+pcAgeTxt(age)+'</span>. Costuma levar de 3 a 6 minutos; pode continuar usando o app, a tela atualiza sozinha.</p>';return}
  if(!pcValid(P)){box.innerHTML='<p class="err">Não foi possível montar o cadastro de '+code+'. '+(P.notes||"")+' Você pode preencher em "Corrigir características".</p>';return}
  const F=PCF[P.index],S=sched(P),fut=S.filter(e=>e.d>VAL),amorts=S.filter(e=>e.a>0&&e.a<0.999999).length;
  const per=S.length>1?Math.round((S[S.length-1].d-S[0].d)/DAY/30.4/(S.length-1)):0;
  const perTxt=per<=1?"mensais":per<=3?"trimestrais":per<=6?"semestrais":"anuais";
  const chk=pcCheck(P);
  let h='<div class="pchead"><span class="chip flat">'+(TYPE_NAME[P.type]||P.type)+'</span>'+(P.official?'<span class="tag">fonte oficial</span>':'<span class="tag est">fonte não oficial · confira</span>')+'</div>';
  h+='<p class="pcname">'+(P.name||code)+'</p><dl class="pcdl">';
  h+='<div class="row"><dt>Remuneração da emissão</dt><dd>'+F.txt(P.rate)+'</dd></div>';
  h+='<div class="row"><dt>Último pagamento</dt><dd>'+fdate(lastDate(P))+'</dd></div>';
  h+='<div class="row"><dt>Pagamentos</dt><dd>juros '+perTxt+(amorts?', '+amorts+' amortizações':', principal no fim')+'</dd></div>';
  h+='<div class="row"><dt>Pagamentos a receber</dt><dd>'+fut.length+'</dd></div>';
  if(P.anbima&&isFinite(P.anbima.rate))h+='<div class="row"><dt>Taxa indicativa ANBIMA ('+fdate(parseDate(P.anbima.refDate))+')</dt><dd>'+F.txt(P.anbima.rate)+(chk===true?' <span class="tag">preço conferido</span>':chk==="adj"?' <span class="tag est">saldo ajustado ao preço oficial</span>':chk===false?' <span class="tag est">preço não confere</span>':'')+'</dd></div>'+(chk==="adj"?'<div class="row"><dt>Preço oficial (PU ANBIMA)</dt><dd>R$ '+fx(P.anbima.pu,6)+'</dd></div><p class="warn" style="font-size:.84rem;margin:6px 0">A agenda publicada no SND não fecha com o preço oficial (diferença de '+fx(Math.abs((PADJ_BIG.get(P.code)?1/PADJ_BIG.get(P.code)-1:0)*100),1)+'%), em geral porque amortizações antigas não aparecem. O app usa o preço oficial da ANBIMA e ajusta o saldo devedor na mesma proporção. Os pagamentos já recebidos e o valor na data da compra não puderam ser conferidos: use o preço pago da nota.</p>':'');
  h+='</dl>';
  if(P.notes)h+='<p class="sub" style="font-size:.85rem;margin-top:8px">'+P.notes+'</p>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Fontes: '+(P.sources||[]).join("; ")+'</p>';
  box.innerHTML=h;
}
function pcPrefix(F){
  $("pcRatePre").textContent=F?F.pre:"";$("pcMratePre").textContent=F?F.pre:"";
  $("pcRatePre").hidden=!(F&&F.pre);$("pcMratePre").hidden=!(F&&F.pre);
  $("pcRateSuf").textContent=F?F.suf:"%";$("pcMrateSuf").textContent=F?F.suf:"%";
  [$("pcRate").parentElement,$("pcMrate").parentElement].forEach(a=>a.classList.toggle("p",!!(F&&F.pre)));
}
function pcClear(msg,isErr){LAST.pc=null;$("pcOut").innerHTML='<span class="label">Resultado</span><p class="'+(isErr?"err":"sub")+'">'+msg+'</p>';$("flow").innerHTML="";$("chart").innerHTML="";$("flowSub").textContent="";$("readout").textContent="";state=null}

function pcCalc(){
  let code=($("pcCode").value||"").trim().toUpperCase().replace(/\s+/g,"");const cn=pcCanon(code);if(cn!==code&&PAPERS[cn]){code=cn;$("pcCode").value=cn}
  if(code!==pcCurCode||(pcP(code)&&PC_INIT!==code))pcSetCode(code);
  const P=pcP(code);pcInfo(P,code);
  $("pcFetch").textContent=P&&P.status!=="pending"?"Atualizar dados do papel":"Buscar dados do papel";
  if(!code)return pcClear("Digite o código do papel para começar.");
  if(!P)return pcClear("Cadastre o papel para calcular.");
  if(P.status==="pending")return pcClear("Aguardando os dados do papel.");
  if(!pcValid(P))return pcClear("Faltam características para calcular este papel.",true);
  const F=PCF[P.index];pcPrefix(F);
  let buy=parseDate($("pcBuy").value),rc=num($("pcRate").value),rm=num($("pcMrate").value),noMkt=false;
  const q=num($("pcQty").value),paid=num($("pcPaid").value);
  if(!SILENT)posSave(code,{buy:$("pcBuy").value,rate:$("pcRate").value,qty:$("pcQty").value,paid:$("pcPaid").value,mrate:pcManual?$("pcMrate").value:""});
  const auto=pcAutoOk(P);if(!auto&&!pcManual&&P.anbima&&$("pcMrate").value===fx(P.anbima.rate,4))$("pcMrate").value="";const est=!auto&&!pcManual?pcEst(P):null;if(est&&isFinite(est.rate)&&!$("pcMrate").value.trim())$("pcMrate").value=fx(est.rate,4);const isEst=!!(est&&isFinite(est.rate)&&$("pcMrate").value===fx(est.rate,4));
  $("pcMrateHint").innerHTML=(P.anbima&&!auto?'<b>A taxa ANBIMA lida para este papel não reproduz o PU publicado, por isso não foi usada.</b> ':'')+(auto?(pcManual?'Taxa informada por você. <button type="button" class="link" id="pcReset">Voltar à taxa ANBIMA</button>':'Taxa indicativa ANBIMA de '+fdate(parseDate(P.anbima.refDate))+'. Troque pela taxa de venda da sua corretora, se quiser.'):pcManual?'Taxa informada por você.'+(pcEst(P)?' <button type="button" class="link" id="pcReset">Voltar à taxa estimada</button>':''):isEst?pcEstTxt(P,est):est&&est.distress?pcDzTxt(est.distress):'A ANBIMA não publica taxa deste papel em formato que a calculadora consiga ler. Informe a taxa de venda que sua corretora mostra hoje.');
  const rb=$("pcReset");if(rb)rb.onclick=()=>{pcManual=false;pcAuto();pcCalc()};
  const errs=[],bw=$("pcBuyWarn");bw.hidden=true;
  const start=parseDate(P.start),end=lastDate(P);
  if(isNaN(buy))errs.push("Informe a data da compra.");
  else if(buy<start)errs.push("A compra precisa ser depois do início da remuneração ("+fdate(start)+").");
  else if(buy>=VAL)errs.push("A compra precisa ser anterior a "+fdate(VAL)+", a data dos dados de mercado.");
  else if(!isBiz(buy)){bw.textContent="Essa data não é dia útil. Confira a data de liquidação na nota da corretora.";bw.hidden=false}
  if(VAL>=end)errs.push("Este papel já venceu.");
  if(!isFinite(rc))errs.push("Informe a taxa contratada, por exemplo "+F.ex+".");
  if(!isFinite(rm)&&isFinite(rc)){rm=rc;noMkt=true}
  if(!(q>0))errs.push("Informe a quantidade (maior que zero).");
  if($("pcPaid").value.trim()&&!(paid>0))errs.push("O preço pago precisa ser um valor em reais, por exemplo 1.045,78.");
  if(errs.length)return pcClear(errs.join("<br>"),true);

  const isDI=P.index==="DI_SPREAD"||P.index==="DI_PCT";
  let pm=pcPrice(P,VAL,rm),pc=pcPrice(P,VAL,rc);const pb=pcPrice(P,buy,rc,isDI?dfFlat(buy):undefined);const ADJ=pcAdjK(P);
  if(pm&&pc&&ADJ!==1){pm=Object.assign({},pm,{pu:pm.pu*ADJ});pc=Object.assign({},pc,{pu:pc.pu*ADJ})}
  if(!pm||!pc||!pb)return pcClear("Não há pagamentos futuros para calcular.",true);
  const usePaid=paid>0,past=pcHistory(P,buy,VAL),recv=past.reduce((a,x)=>a+x.amt,0)*q,inv=(usePaid?paid:pb.pu)*q,unk=!!PADJ_BIG.get(P.code)&&!usePaid;
  const diff=pm.pu-pc.pu,diffT=diff*q,resM=pm.pu*q+recv-inv,resC=pc.pu*q+recv-inv;
  const reg=()=>pcRegime(P),scn=pcScenario(P,rm,buy);
  const txNow=taxCalc(reg(),inv,q,buy,past,VAL,pm.pu);
  const hv=holdVsSell({reg,inv,q,buy,past,future:scn.cashBetween(end).filter(c=>c.t>VAL),puNow:pm.pu,end,piBase:piProj(end),isIpca:P.index==="IPCA"});
  const cl=Math.abs(diff)<0.005?"flat":diff>0?"gain":"loss",word=cl==="flat"?"Na curva":cl==="gain"?"Ágio":"Deságio";
  const mtag=auto&&!pcManual?'<span class="tag">ANBIMA</span>':isEst?'<span class="tag est">estimada</span>':noMkt?'<span class="tag man">na curva</span>':'<span class="tag man">informada</span>';
  let h='<div class="verdict"><span class="label">Venda hoje, '+fx(q,q%1?2:0)+(q===1?' título':' títulos')+'</span><span class="chip '+cl+'">'+word+'</span></div>';
  h+='<div class="big '+cl+'">'+signed(diffT,brl)+'</div>';
  h+='<p class="sub">'+signed(diff,brl)+' por título ('+signed(diff/pc.pu*100,x=>fx(x,2))+'%). '+(cl==="gain"?"O mercado paga mais do que o papel vale na sua taxa contratada.":cl==="loss"?"O mercado paga menos do que o papel vale na sua taxa contratada. Levando até o fim, você recebe a taxa contratada.":"O preço de mercado coincide com o da sua curva.")+'</p>';
  h+='<div class="cmp"><div><span class="n">Taxa contratada</span><span class="v">'+F.txt(rc)+'</span></div><div><span class="n">Taxa de mercado '+mtag+'</span><span class="v">'+F.txt(rm)+'</span></div></div>';
  h+='<dl>';
  h+='<div class="row head"><dt>'+code+' em '+fdate(VAL)+'</dt><dd></dd></div>';
  h+='<div class="row"><dt>PU a mercado</dt><dd>R$ '+fx(pm.pu,6)+'</dd></div>';
  h+='<div class="row"><dt>PU na taxa contratada (curva)</dt><dd>R$ '+fx(pc.pu,6)+'</dd></div>';
  h+='<div class="row"><dt>PU par (taxa da emissão)</dt><dd>R$ '+fx(pm.par,6)+'</dd></div>';
  h+='<div class="row"><dt>Preço a mercado em % do PU par</dt><dd>'+fx(pm.pu/pm.par*100,4)+'%</dd></div>';
  h+='<div class="row"><dt>Saldo do valor nominal'+(P.index==="IPCA"?' atualizado (estimado)':'')+'</dt><dd>R$ '+fx(pm.saldo,2)+'</dd></div>';
  h+='<div class="row head"><dt>Sua posição</dt><dd></dd></div>';
  if(!unk)h+='<div class="row"><dt>Valor investido em '+fdate(buy)+(usePaid?' (preço da nota)':' (estimado)')+'</dt><dd>'+brl(inv)+'</dd></div>';
  if(!unk)h+='<div class="row"><dt>PU calculado na compra</dt><dd>R$ '+fx(pb.pu,6)+'</dd></div>';
  if(usePaid)h+='<div class="row"><dt>Preço pago (nota)</dt><dd>R$ '+fx(paid,2)+'</dd></div>';
  if(!unk)h+='<div class="row"><dt>Pagamentos recebidos ('+past.length+')</dt><dd>'+brl(recv)+'</dd></div>';
  h+='<div class="row"><dt>Valor a mercado hoje</dt><dd>'+brl(pm.pu*q)+'</dd></div>';
  h+='<div class="row"><dt>Valor na curva hoje</dt><dd>'+brl(pc.pu*q)+'</dd></div>';
  if(unk)h+='<div class="row"><dt>Resultado da posição</dt><dd><small>informe o preço pago (nota) para calcular</small></dd></div>';
  if(!unk)h+='<div class="row strong"><dt>Resultado se vender hoje</dt><dd class="'+(resM>=0?"pos":"neg")+'">'+signed(resM,brl)+'</dd></div>';
  if(!unk)h+='<div class="row"><dt>Resultado na curva</dt><dd>'+signed(resC,brl)+'</dd></div>';
  if(!unk)h+='<div class="row"><dt>IR, IOF e custódia estimados (venda hoje)</dt><dd>−'+brl(txNow.tax+txNow.cust)+'</dd></div>';
  if(!unk)h+='<div class="row strong"><dt>Resultado líquido se vender hoje</dt><dd class="'+(txNow.net>=0?"pos":"neg")+'">'+signed(txNow.net,brl)+'</dd></div>';
  h+='<div class="row"><dt>Dias úteis até o último pagamento</dt><dd>'+pm.rows[pm.rows.length-1].du+'</dd></div>';
  h+='</dl>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:8px">'+taxNote(reg())+(P.type==="DEB"&&P.incentivada==null?' Confira se a debênture é incentivada (Lei 12.431): se for, é isenta.':'')+' Estimativa.</p>';
  if(!unk)h+=holdHtml(hv,{end,piBase:piProj(end)});
  if(isDI)h+='<p class="sub" style="font-size:.82rem;margin-top:10px">CDI futuro projetado pela curva de juros da ANBIMA. Na data da compra, o preço é estimado com o CDI da época.</p>';
  $("pcOut").innerHTML=h;

  state={priceAt:r=>{const x=pcPrice(P,VAL,r);return x?x.pu*ADJ:NaN},puC:pc.pu,q,rc,rm,F,fmt:F.txt,n:isDI?60:100};
  setLastPc({name:(TYPE_NAME[P.type]||'')+' '+code,q,buy,rc,rm,pastList:past.map(x=>({t:x.t,amt:x.amt,f:x.f})),fmt:F.txt,inv,recvPast:recv,end,isDI,sc:scn,reg,valM:pm.pu*q,agio:diffT,res:resM,net:txNow.net,hv,srcTag:auto&&!pcManual?"ANBIMA":isEst?"estimada":noMkt?"na curva":"informada",alertSrc:auto&&!pcManual&&P.type==="DEB"?{src:"DEB",lookup:{code}}:null});
  if(!SILENT){drawChart();drawFlowPc(past,pm.rows,pc.rows)}
}
function drawFlowPc(past,rm,rc){
  let t='<thead><tr><th>Pagamento</th><th>Dias úteis</th><th>Juros (R$)</th><th>Amortização (R$)</th><th>Fator<br>mercado</th><th>Valor presente<br>a mercado</th><th>Valor presente<br>na curva</th><th>Diferença</th></tr></thead><tbody>';
  if(past.length){
    t+='<tr class="sep"><td colspan="8">Pagamentos já recebidos (estimados, por título)</td></tr>';
    past.forEach(p=>{t+='<tr class="past"><td>'+fdate(p.t)+'</td><td>—</td><td>'+fx(p.jur,2)+'</td><td>'+fx(p.am,2)+'</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>'});
    t+='<tr class="sep"><td colspan="8">A receber, descontados em '+fdate(VAL)+'</td></tr>';
  }
  let sm=0,sc=0;
  rm.forEach((f,i)=>{const c=rc[i];sm+=f.pv;sc+=c.pv;t+='<tr><td>'+fdate(f.t)+'</td><td>'+f.du+'</td><td>'+fx(f.jur,2)+'</td><td>'+fx(f.am,2)+'</td><td>'+fx(f.fac,6)+'</td><td>'+fx(f.pv,2)+'</td><td>'+fx(c.pv,2)+'</td><td class="'+(f.pv-c.pv>=0?"pos":"neg")+'">'+signed(f.pv-c.pv,x=>fx(x,2))+'</td></tr>'});
  t+='</tbody><tfoot><tr><td>Total por título</td><td></td><td></td><td></td><td></td><td>'+fx(sm,2)+'</td><td>'+fx(sc,2)+'</td><td class="'+(sm-sc>=0?"pos":"neg")+'">'+signed(sm-sc,x=>fx(x,2))+'</td></tr></tfoot>';
  $("flow").className="pcflow";$("flow").innerHTML=t;
  $("flowSub").textContent=rm.length+(rm.length>1?" pagamentos a receber":" pagamento a receber")+" · juros projetados e valores por título";
}
/* correção manual das características */
function fmtSched(P){return (P.schedule||[]).map(r=>{const t=parseDate(r[0]);return fdate(t)+";"+(r[1]?"S":"N")+";"+fx(+r[2],4)}).join("\n")}
function parseSched(txt){const out=[];for(const line of txt.split(/\n+/)){const l=line.trim();if(!l)continue;const p=l.split(/[;\t]/).map(s=>s.trim());const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(p[0]||"");if(!m)return null;out.push([m[3]+"-"+m[2]+"-"+m[1],/^n/i.test(p[1]||"S")?0:1,num(p[2]||"0")||0])}return out.length?out:null}
function pcFillEdit(){
  const P=pcP(pcCurCode)||{};$("peIdx").value=P.index||"DI_SPREAD";$("peRate").value=isFinite(P.rate)?fx(P.rate,4):"";$("peVne").value=P.vne?fx(P.vne,2):"1.000,00";
  $("peStart").value=P.start||"";$("peBasis").value=P.basis||"SALDO";$("peLag").value=P.ipcaLag==null?"1":String(P.ipcaLag);$("peSched").value=fmtSched(P);$("peMsg").textContent="";
}
async function pcSaveEdit(){
  const code=pcCurCode;if(!code)return;
  const sch=parseSched($("peSched").value),rate=num($("peRate").value),vne=num($("peVne").value),start=$("peStart").value;
  if(!sch){$("peMsg").textContent="Confira o cronograma: uma linha por pagamento, no formato dd/mm/aaaa;S;0,00.";return}
  if(!isFinite(rate)||!(vne>0)||isNaN(parseDate(start))){$("peMsg").textContent="Preencha taxa, valor nominal e início da remuneração.";return}
  const old=pcP(code)||{};
  const doc=Object.assign({},old,{code,type:old.type||(/^CRI/.test(code)?"CRI":/^CRA/.test(code)?"CRA":"DEB"),index:$("peIdx").value,rate,vne,start,basis:$("peBasis").value,ipcaLag:+$("peLag").value,schedule:sch,official:false,status:"ok",updatedAt:new Date().toISOString(),notes:"Características corrigidas manualmente."});
  if(!(old.sources||[]).includes("Correção manual"))doc.sources=(old.sources||[]).concat(["Correção manual"]);
  PAPERS[code]=doc;pcMemo.clear();
  $("peMsg").textContent="Salvo só nesta sessão.";
  pcList();pcCalc();
}



document.addEventListener("click",e=>{const o=e.target.closest("[data-pcopen]");if(o){$("pcCode").value=o.dataset.pcopen;pcCalc();return}});
async function pcFetch(){
  const code=codeClean($("pcCode").value);
  if(!code){setStat("Digite o código do papel.","bad");return}
  return pcRoboFetch(code);
}
const AREA_OF={pub:"calc",pc:"calc",bank:"calc",fund:"calc",sc:"simu",sim:"simu",tx:"mkt",mk:"mkt",fx:"mkt",rs:"mkt",ju:"mkt",cr:"mkt",in:"mkt",ix:"mkt",cart:"cart",fa:"fnd",fr:"fnd",fc:"fnd",fg:"fnd",sp:"simu",ag:"bolsa",aa:"bolsa",ar:"bolsa",ac:"bolsa",au:"bolsa",fv:"mkt",ec:"mkt",mu:"mkt"},AREA_T={calc:"Calcular título",simu:"Carteiras e Simulações",mkt:"Mercado",cart:"Carteira",fnd:"Fundos",bolsa:"Bolsa"},AREA_LAST={calc:"pub",simu:"sc",mkt:"rs",cart:"cart",fnd:"fa",bolsa:"aa"};
const MKM=new Set(["rs","fv","ec","mu","ju","cr","in","ix"]);
function setMod(m){
  if(m==="mk")m="rs";activeMod=m;try{fonteAviso(m)}catch(e){}if(MKM.has(m)||m==="tx")setTimeout(()=>mkLoad(),0);if((m==="pc"||m==="sc")&&!PC_RATES_ON&&typeof roboLoad==="function"&&document.documentElement.classList.contains("pages")){PC_RATES_ON=true;setTimeout(()=>roboLoad(null),0)}const ar=AREA_OF[m]||"calc";AREA_LAST[ar]=m;const W=document.querySelector(".wrap");if(W)W.dataset.area=ar;
  document.querySelectorAll(".areas button").forEach(b=>b.setAttribute("aria-selected",b.dataset.area===ar?"true":"false"));
  if($("areaTitle"))$("areaTitle").textContent=AREA_T[ar];
  document.querySelectorAll(".tabs button").forEach(b=>{b.setAttribute("aria-selected",b.dataset.mod===m?"true":"false");b.hidden=(AREA_OF[b.dataset.mod]||"calc")!==ar});
  $("modPub").hidden=m!=="pub";$("modPc").hidden=m!=="pc";$("modBank").hidden=m!=="bank";$("notesBank").hidden=m!=="bank";$("modFund").hidden=m!=="fund";$("notesFund").hidden=m!=="fund";$("modSim").hidden=m!=="sim";$("notesSim").hidden=m!=="sim";$("modSc").hidden=m!=="sc";$("notesPub").hidden=m!=="pub";$("notesPc").hidden=m!=="pc";$("notesSc").hidden=m!=="sc";$("modTx").hidden=m!=="tx";$("modFx").hidden=m!=="fx";$("modMk").hidden=!MKM.has(m);$("modFn").hidden=!FNM.has(m);$("notesTx").hidden=m!=="tx";
  $("secChart").hidden=FNM.has(m)||m==="sc"||m==="cart"||m==="tx"||m==="bank"||m==="sim"||MKM.has(m)||m==="fund";$("secFlow").hidden=FNM.has(m)||m==="sc"||m==="cart"||m==="tx"||m==="bank"||m==="sim"||MKM.has(m)||m==="fund";
  if(m==="fx"){$("secChart").hidden=true;$("secFlow").hidden=true}{const mb=$("methodBox");if(mb)mb.style.display=m==="pub"?"":"none"}
  try{localStorage.setItem("mod2",m)}catch(e){}
  if(FNM.has(m))fnCalc(m);else if(MKM.has(m))mkCalc();else if(m==="pub")calc();else if(m==="pc")pcCalc();else if(m==="bank")bkCalc();else if(m==="fund")fdCalc();else if(m==="sim")simCalc();else if(m==="tx"){oppRender();txCalc()}else if(m==="fx")fxCalc();else{scRefreshSources();if(!LAST.pub&&LAST.pc)$("scSrc").value="pc";scCalc()}
}
function pcBind(){
  document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click",()=>setMod(b.dataset.mod)));
  document.querySelectorAll(".areas button").forEach(b=>b.addEventListener("click",()=>{setMod(AREA_LAST[b.dataset.area]);try{window.scrollTo({top:0,behavior:"smooth"})}catch(e){}}));
  $("pcCode").addEventListener("change",pcCalc);$("pcCode").addEventListener("input",()=>{if(pcP(($("pcCode").value||"").trim().toUpperCase()))pcCalc()});$("pcCode").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();pcCalc();const c=($("pcCode").value||"").trim();if(c&&!pcP(c.toUpperCase())&&!$("pcFetch").disabled)pcFetch()}});
  ["pcBuy","pcRate","pcQty","pcPaid"].forEach(id=>$(id).addEventListener("input",pcCalc));
  $("pcMrate").addEventListener("input",()=>{pcManual=true;pcCalc()});
  $("pcFetch").addEventListener("click",pcFetch);
  $("pcEdit").addEventListener("toggle",()=>{if($("pcEdit").open)pcFillEdit()});
  $("peSave").addEventListener("click",pcSaveEdit);
  $("pcForm").addEventListener("submit",e=>e.preventDefault());
}


