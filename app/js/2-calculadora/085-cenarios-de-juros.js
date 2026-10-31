/* ================= Cenários de juros ================= */
const LAST={pub:null,pc:null,bank:null,fund:null};
let PI_PROJ=null; // IPCA projetado (% a.a.) para datas futuras; null = projeção escolhida (padrão: inflação implícita por prazo)
let SC_PI_SHIFT=0,SC_DI_SHIFT=0; // deslocamentos dos cenários levados ao vencimento
const scUserDate={pub:null,pc:null};
function dfScen(d){return dfCurve(d)*Math.pow(1+SC_DI_SHIFT/100,d/252)}
function ipca12(){const lk=Math.max(...Object.keys(IPCA).map(Number));return (IPCA[lk]/IPCA[lk-12]-1)*100}
let PI_MODE="impl";try{PI_MODE=localStorage.getItem("piMode2")||"impl"}catch(e){}if(PI_MODE!=="m12")PI_MODE="impl";
const PIF_CACHE=new Map();
function piProj(t){if(PI_PROJ!=null)return PI_PROJ+SC_PI_SHIFT;if(t>VAL+30*DAY&&PI_MODE!=="m12"){const y=(t-VAL)/DAY/365.25,f=piFactor(t);if(isFinite(f)&&f>0)return (Math.pow(f,1/y)-1)*100}if(PI_MODE==="m12")return ipca12()+SC_PI_SHIFT;try{const t=addMonths(VAL,36),f=piFactor(t),v=(Math.pow(f,1/((t-VAL)/DAY/365.25))-1)*100;return isFinite(v)?v:ipca12()+SC_PI_SHIFT}catch(e){return ipca12()+SC_PI_SHIFT}}
function vnaBFwd(t){return t<=VAL?vnaIpca(t):VNA_B*piFactor(t)}
function vnaLftFwd(t){return t<=VAL?vnaSelic(t):VNA_LFT*dfScen(du(VAL,t))}
function setLastPub(o){LAST.pub=o}
function setLastPc(o){LAST.pc=o}
function pubScenario(kind,d,K,buy){
  const vf=t=>!K.idx?null:K.fam==="selic"?vnaLftFwd(t):vnaBFwd(t);
  return {
    priceAt:(r,H)=>{const fl=flowsFrom(kind,H,d);if(!fl.length)return NaN;return price(kind,fl,r,vf(H)).pu},
    cashBetween:(H)=>{const mat=matOf(kind,d),U0=K.b1?flowsFrom(kind,buy,d).reduce((a,f)=>a+f.amt,0):1;return flowsFrom(kind,VAL,d).filter(f=>f.t<=H).map(f=>({t:f.t,amt:K.idx?vf(f.t)*f.amt/100:f.amt,f:K.b1?f.amt/U0:(f.t===mat?1:0)}))},
    usesIpca:K.fam==="ipca",driver:K.fam==="ipca"?"IPCA":K.fam==="selic"?"SELIC":"PRE"
  };
}
function pcScenario(P,rm,buy){
  return {
    priceAt:(r,H)=>{const x=pcPrice(P,H,r,H>VAL?(d=>dfScen(du(VAL,H)+d)/dfScen(du(VAL,H))):undefined);return x?x.pu:NaN},
    cashBetween:(H)=>{const x=pcPrice(P,VAL,rm,dfScen);if(!x)return [];const v0=ipcaFactor(P,VAL),sb=pcState(P,buy).saldo;return x.rows.filter(f=>f.t<=H).map(f=>({t:f.t,amt:f.flow*(P.index==="IPCA"?ipcaFactor(P,f.t)/v0:1),f:sb>0?(f.am/x.VF)/sb:0}))},
    usesIpca:P.index==="IPCA",driver:P.index==="IPCA"?"IPCA":(P.index==="DI_SPREAD"||P.index==="DI_PCT")?"CDI":"PRE"
  };
}
function irr(inv,flows,t0){ // taxa interna de retorno anual (dias corridos/365,25)
  const f=r=>flows.reduce((a,c)=>a+c.amt/Math.pow(1+r,(c.t-t0)/DAY/365.25),0)-inv;
  let lo=-0.95,hi=3;if(f(lo)*f(hi)>0)return NaN;
  for(let i=0;i<200;i++){const m=(lo+hi)/2;if(f(lo)*f(m)<=0)hi=m;else lo=m}
  return (lo+hi)/2*100;
}
let SCNET=true;
function scOutcome(L,items,H,sale){ // resultado e TIR, brutos ou líquidos de IR e custos
  if(SCNET){const tx=taxCalc(L.reg(H),L.inv,L.q,L.buy,items,H,sale);return {res:tx.net,tir:irr(L.inv/L.q,tx.flows,L.buy)}}
  const tot=items.reduce((a,c)=>a+c.amt,0)+sale;return {res:tot*L.q-L.inv,tir:irr(L.inv/L.q,items.concat(sale>0?[{t:H,amt:sale}]:[]),L.buy)};
}
function scMatSync(){
  const sm=$("scMat"),pub=$("scSrc").value==="pub";$("scMatField").hidden=!pub;if(!pub)return;
  if(sm.dataset.n!==String(sel.options.length)||!sm.options.length){sm.innerHTML=sel.innerHTML;sm.dataset.n=String(sel.options.length)}
  sm.value=sel.value;
}
function scCalc(){
  SCNET=$("scVal").value==="net";scMatSync();
  const src=$("scSrc").value,L=LAST[src],out=$("scOut");
  $("scPiField").hidden=true;
  if(!L){$("scCrossBox").hidden=true;out.innerHTML='<p class="err">Preencha primeiro a compra na aba '+(src==="pub"?"Títulos públicos":"Crédito privado")+'. Os cenários usam aquela posição.</p>';$("scChart").innerHTML="";$("scWhat").textContent="";return}
  $("scWhat").innerHTML='<b>'+L.name+'</b> · '+fx(L.q,L.q%1?2:0)+(L.q===1?' título':' títulos')+' · comprado em '+fdate(L.buy)+' a '+L.fmt(L.rc)+' · taxa de mercado atual '+L.fmt(L.rm)+' · último pagamento em '+fdate(L.end);
  // data da venda: padrão = vencimento (último pagamento), a menos que você tenha escolhido outra
  const iso=t=>new Date(t).toISOString().slice(0,10);
  let H=scUserDate[src]!=null?parseDate(scUserDate[src]):L.end;
  if(isNaN(H)||H<VAL)H=VAL;if(H>L.end)H=L.end;
  $("scDate").value=iso(H);$("scDate").max=iso(L.end);$("scDate").min=iso(VAL);
  $("scDateHint").innerHTML=H===L.end?'Vencimento do título (padrão).':'Venda antes do vencimento. <button type="button" class="link" id="scToEnd">Usar o vencimento</button>';
  const te=$("scToEnd");if(te)te.onclick=()=>{scUserDate[src]=null;scCalc()};
  $("scPiField").hidden=!L.sc.usesIpca;
  const piHor=t=>{const y=(t-VAL)/DAY/365.25;if(!(y>0.02))return ipca12();const s=SC_PI_SHIFT,pp=PI_PROJ;SC_PI_SHIFT=0;PI_PROJ=null;const f=piFactor(t);SC_PI_SHIFT=s;PI_PROJ=pp;return (Math.pow(f,1/y)-1)*100};
  const piDef=piHor(H);
  if(L.sc.usesIpca){$("scPi").placeholder=fx(piDef,2);$("scPiHint").textContent="Vazio = "+(PI_MODE==="impl"?"inflação implícita do mercado até "+fdate(H):"média dos últimos 12 meses")+" ("+fx(piDef,2)+"% a.a.). Troque em Mercado › Inflação implícita."}
  const piIn=num($("scPi").value);PI_PROJ=isFinite(piIn)&&$("scPi").value.trim()?piIn:null;
  const step=+$("scStep").value,span=+$("scSpan").value,atEnd=H>=L.end,drv=L.sc.driver;
  const unitInv=L.inv/L.q;
  const piBase=PI_PROJ!=null?PI_PROJ:piDef,cdiBase=(Math.pow(dfCurve(252),1)-1)*100;
  if(atEnd&&drv==="PRE"){
    const cl=L.sc.cashBetween(H).filter(c=>c.t>VAL),cash=cl.reduce((a,c)=>a+c.amt,0)*L.q,oc=scOutcome(L,L.pastList.concat(cl),H,0),res=oc.res,pct=res/L.inv*100,tir=oc.tir;
    out.innerHTML='<p class="sub" style="max-width:70ch">Prefixado levado ao vencimento: você recebe exatamente a taxa contratada ('+L.fmt(L.rc)+'), então o resultado não muda com os juros.</p><dl style="max-width:520px"><div class="row"><dt>Valor investido</dt><dd>'+brl(L.inv)+'</dd></div><div class="row"><dt>Total recebido até '+fdate(H)+'</dt><dd>'+brl(L.recvPast+cash)+'</dd></div><div class="row strong"><dt>Resultado total</dt><dd class="'+(res>=0?"pos":"neg")+'">'+signed(res,brl)+'</dd></div><div class="row"><dt>Rentabilidade no período / ao ano (TIR)</dt><dd>'+signed(pct,v=>fx(v,2))+'% / '+signed(tir,v=>fx(v,2))+'% a.a.</dd></div></dl><p class="sub" style="font-size:.88rem;margin-top:10px">Para ver o efeito de cada 0,5 ponto nos juros, escolha uma data de venda antes do vencimento.</p>';
    $("scChart").innerHTML="";scCross(L,src);return;
  }
  const rows=[];let h;
  if(atEnd){
    const lbl=drv==="IPCA"?"IPCA projetado":"CDI projetado";
    for(let dlt=-span;dlt<=span+1e-9;dlt+=step){
      const dd=Math.round(dlt*100)/100;
      if(drv==="IPCA")SC_PI_SHIFT=dd;else SC_DI_SHIFT=dd;
      const cl=L.sc.cashBetween(H).filter(c=>c.t>VAL),cash=cl.reduce((a,c)=>a+c.amt,0)*L.q,oc=scOutcome(L,L.pastList.concat(cl),H,0),tir=oc.tir;
      const lvl=drv==="IPCA"?piProj(H):(Math.pow(dfScen(252),1)-1)*100;
      SC_PI_SHIFT=0;SC_DI_SHIFT=0;
      const res=oc.res,pct=res/L.inv*100;
      rows.push({dd,lvl,cash,res,pct,ann:tir});
    }
    const base=rows.find(x=>x.dd===0);
    h='<div class="tablewrap" style="max-height:none"><table class="sctab end"><thead><tr><th>Variação do '+(drv==="IPCA"?"IPCA":"CDI")+'</th><th>'+lbl+'<br>(média a.a.)</th><th>A receber até o vencimento (R$)</th><th>'+(SCNET?'Resultado líquido (R$)':'Resultado total (R$)')+'</th><th>Rentab.<br>no período</th><th>'+(SCNET?'TIR líquida':'Rentab. ao ano<br>(TIR)')+'</th><th>vs. cenário base (R$)</th></tr></thead><tbody>';
    rows.forEach(x=>{h+='<tr'+(x.dd===0?' class="cur"':'')+'><td>'+(x.dd>0?"+":x.dd<0?"−":"")+fx(Math.abs(x.dd),2)+' p.p.</td><td>'+fx(x.lvl,2)+'%</td><td>'+fx(x.cash,2)+'</td><td class="'+(x.res>=0?"pos":"neg")+'"><b>'+signed(x.res,v=>fx(v,2))+'</b></td><td class="'+(x.pct>=0?"pos":"neg")+'">'+signed(x.pct,v=>fx(v,2))+'%</td><td>'+signed(x.ann,v=>fx(v,2))+'%</td><td>'+(x.dd===0?'—':signed(x.res-base.res,v=>fx(v,2)))+'</td></tr>'});
    h+='</tbody></table></div>';
    h+='<p class="sub" style="font-size:.88rem;margin-top:10px">Levando até o vencimento ('+fdate(H)+'), você recebe a taxa contratada sobre '+(drv==="IPCA"?"o IPCA":"o CDI")+'. Por isso a variação é aplicada '+(drv==="IPCA"?"à inflação projetada (cenário base: "+fx(piBase,2)+"% a.a.)":"ao CDI projetado pela curva da ANBIMA (cenário base: "+fx(cdiBase,2)+"% no primeiro ano)")+', e não à taxa de mercado do título. Valor investido: '+brl(L.inv)+'; já recebido: '+brl(L.recvPast)+'. Pagamentos futuros sem reinvestimento; '+(SCNET?'já descontados IR, IOF e custódia estimados.':'antes de IR e custos.')+'</p>';
  }else{
    const clF=L.sc.cashBetween(H).filter(c=>c.t>VAL),cashF=clF.reduce((a,c)=>a+c.amt,0)*L.q,recvTot=L.recvPast+cashF;
    const puCurveH=L.sc.priceAt(L.rc,H);
    for(let dlt=-span;dlt<=span+1e-9;dlt+=step){
      const dd=Math.round(dlt*100)/100,r=L.rm+dd,pu=L.sc.priceAt(r,H),val=pu*L.q,oc=scOutcome(L,L.pastList.concat(clF),H,pu),res=oc.res,pct=res/L.inv*100;
      rows.push({dd,r,pu,val,agio:(pu-puCurveH)*L.q,res,pct,ann:oc.tir});
    }
    const base=rows.find(x=>x.dd===0);
    h='<div class="tablewrap" style="max-height:none"><table class="sctab early"><thead><tr><th>Variação</th><th>Taxa de mercado</th><th>PU na venda</th><th>Valor da posição (R$)</th><th>Ágio / deságio vs. sua curva (R$)</th><th>'+(SCNET?'Resultado líquido (R$)':'Resultado total (R$)')+'</th><th>Rentab.<br>no período</th><th>'+(SCNET?'TIR líquida':'Rentab. ao ano<br>(TIR)')+'</th><th>vs. cenário atual (R$)</th></tr></thead><tbody>';
    rows.forEach(x=>{h+='<tr'+(x.dd===0?' class="cur"':'')+'><td>'+(x.dd>0?"+":x.dd<0?"−":"")+fx(Math.abs(x.dd),2)+' p.p.</td><td>'+L.fmt(x.r)+'</td><td>'+fx(x.pu,2)+'</td><td>'+fx(x.val,2)+'</td><td class="'+(x.agio>=0?"pos":"neg")+'">'+signed(x.agio,v=>fx(v,2))+'</td><td class="'+(x.res>=0?"pos":"neg")+'"><b>'+signed(x.res,v=>fx(v,2))+'</b></td><td class="'+(x.pct>=0?"pos":"neg")+'">'+signed(x.pct,v=>fx(v,2))+'%</td><td>'+signed(x.ann,v=>fx(v,2))+'%</td><td>'+(x.dd===0?'—':signed(x.res-base.res,v=>fx(v,2)))+'</td></tr>'});
    h+='</tbody></table></div>';
    const holdTxt=H>VAL?'Venda em '+fdate(H)+'. Os pagamentos até essa data ('+brl(cashF)+' previstos, sem reinvestimento) somam-se aos já recebidos ('+brl(L.recvPast)+').':'Venda hoje ('+fdate(VAL)+'). Pagamentos já recebidos: '+brl(L.recvPast)+'.';
    h+='<p class="sub" style="font-size:.88rem;margin-top:10px">'+holdTxt+' A variação é aplicada à taxa de mercado do título na data da venda. Valor investido: '+brl(L.inv)+'. Resultado total = valor da posição + pagamentos recebidos − valor investido, '+(SCNET?'já descontados IR, IOF e custódia estimados.':'antes de IR e custos.')+''+(L.sc.usesIpca&&H>VAL?' IPCA projetado até a venda: '+fx(piBase,2)+'% a.a.':'')+(L.isDI&&H>VAL?' CDI projetado pela curva da ANBIMA.':'')+'</p>';
  }
  out.innerHTML=h;
  drawScChart(rows,L,atEnd?(drv==="IPCA"?"Variação do IPCA projetado (p.p.)":"Variação do CDI projetado (p.p.)"):"Variação da taxa de mercado (p.p.)");
  scCross(L,src);
}
let scXUser={pub:null,pc:null};
function FAMDEC(L){return L.fmt(1.23456).includes("1,2346")?4:2}
function compactBRL(v){const a=Math.abs(v);return a>=1e6?fx(v/1e6,2)+" mi":a>=1e3?fx(v/1e3,1)+" mil":fx(v,0)} // mesmo formato em toda a tabela (9,3 mil e 10,2 mil, não 9.293 e 10,2 mil)
function scCross(L,src){
  const box=$("scCrossBox"),out=$("scCross"),drv=L.sc.driver,iso=t=>new Date(t).toISOString().slice(0,10);
  if(drv==="PRE"){box.hidden=false;$("scCrossTitle").textContent="Juros e inflação combinados";$("scCrossIntro").textContent="Prefixados não têm indexador: o resultado depende só da taxa de juros, que já aparece na tabela acima (escolha uma data de venda antes do vencimento).";out.innerHTML="";$("scXDate").parentElement.hidden=true;return}
  $("scXDate").parentElement.hidden=false;
  const idxName=drv==="IPCA"?"IPCA":"CDI";
  $("scCrossTitle").textContent=idxName+" e taxa de mercado combinados";
  // data própria: padrão = data da tabela acima se for antes do vencimento; senão, um ano à frente (ou o meio do prazo restante)
  const mainH=parseDate($("scDate").value);
  let dflt=mainH<L.end?mainH:Math.min(addMonths(VAL,12),VAL+Math.floor((L.end-VAL)/2/DAY)*DAY);
  let H=scXUser[src]!=null?parseDate(scXUser[src]):dflt;if(isNaN(H)||H<VAL)H=VAL;if(H>=L.end)H=dflt;
  $("scXDate").value=iso(H);$("scXDate").min=iso(VAL);$("scXDate").max=iso(L.end-DAY);
  $("scXHint").textContent=H===VAL?"Venda hoje: a inflação ainda não teve tempo de agir, só a taxa importa.":"Precisa ser antes do vencimento, quando a taxa de mercado ainda afeta o preço.";
  $("scCrossIntro").innerHTML='Cada célula mostra o <b>resultado total</b> vendendo em '+fdate(H)+', combinando a variação do '+(drv==="IPCA"?"IPCA projetado (linhas)":"CDI projetado (linhas)")+' com a variação da taxa de mercado do título (colunas), em passos de 0,5 ponto. Abaixo do valor, a rentabilidade ao ano (TIR). A célula destacada é o cenário atual.';
  const steps=[-2,-1.5,-1,-0.5,0,0.5,1,1.5,2],unitInv=L.inv/L.q;
  let h='<div class="tablewrap" style="max-height:none"><table class="xtab"><thead><tr><th class="rowh">'+idxName+' ↓ · Taxa →</th>';
  steps.forEach(c=>{h+='<th>'+fx(L.rm+c,FAMDEC(L))+'%<br><span style="font-weight:500">'+(c>0?"+":c<0?"−":"")+fx(Math.abs(c),1)+'</span></th>'});
  h+='</tr></thead><tbody>';
  steps.forEach(rd=>{
    if(drv==="IPCA")SC_PI_SHIFT=rd;else SC_DI_SHIFT=rd;
    const lvl=drv==="IPCA"?piProj(H):(dfScen(252)-1)*100;
    const cl=L.sc.cashBetween(H).filter(c=>c.t>VAL),recvTot=L.recvPast+cl.reduce((a,c)=>a+c.amt,0)*L.q;
    h+='<tr><td class="rowh"><b>'+fx(lvl,2)+'%</b><br><span class="sub">'+(rd>0?"+":rd<0?"−":"")+fx(Math.abs(rd),1)+'</span></td>';
    steps.forEach(c=>{
      const pu=L.sc.priceAt(L.rm+c,H),oc=scOutcome(L,L.pastList.concat(cl),H,pu),res=oc.res,tir=oc.tir;
      h+='<td class="'+(res>=0?"g":"l")+(rd===0&&c===0?" base":"")+'" data-info="'+idxName+' '+fx(lvl,2)+'% a.a. e taxa '+L.fmt(L.rm+c)+': resultado '+(isFinite(res)?signed(res,brl):'—')+(isFinite(tir)?', TIR '+fx(tir,2)+'% a.a.':'')+'">'+(isFinite(res)?signed(res,v=>compactBRL(v)):"—")+'<small>'+(isFinite(tir)?fx(tir,2)+'% a.a.':'')+'</small></td>';
    });
    h+='</tr>';
  });
  SC_PI_SHIFT=0;SC_DI_SHIFT=0;
  h+='</tbody></table></div><p id="scXInfo" class="readout" style="margin-top:8px">Toque numa célula para ver o valor exato.</p><p class="sub" style="font-size:.85rem;margin-top:8px">Resultados em reais (mil = milhares). Linhas: '+idxName+' projetado ao ano; colunas: taxa de mercado do título ('+L.fmt(L.rm)+' hoje) e a variação aplicada. '+(drv==="IPCA"?"Inflação mais alta aumenta os cupons e o valor corrigido do título; taxa de mercado mais alta reduz o preço de venda.":"CDI mais alto aumenta os juros recebidos até a venda; taxa de mercado (spread) mais alta reduz o preço de venda.")+' Valor investido: '+brl(L.inv)+'. '+(SCNET?'Já descontados IR, IOF e custódia estimados.':'Antes de IR e custos.')+'</p>';
  out.innerHTML=h;box.hidden=false;
}
function drawScChart(rows,L,xlabel){
  const svg=$("scChart"),[W,H]=svgFit(svg,300),PL=78,PR=16,PT=16,PB=46;
  let mn=Math.min(0,...rows.map(r=>r.res)),mx=Math.max(0,...rows.map(r=>r.res));
  const st=niceStep((mx-mn)/5||1);mn=Math.floor(mn/st)*st;mx=Math.ceil(mx/st)*st;if(mx===mn)mx=mn+st;
  const n=rows.length,bw=(W-PL-PR)/n,Y=v=>PT+(mx-v)/(mx-mn)*(H-PT-PB);
  let g='';
  for(let v=mn;v<=mx+st/2;v+=st){const y=Y(v),z=Math.abs(v)<st/1e3;g+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"'+(z?' stroke-width="1.4"':' stroke-dasharray="2 4"')+'/><text x="'+(PL-8)+'" y="'+(y+4)+'" text-anchor="end">'+compact(z?0:v)+'</text>'}
  rows.forEach((r,i)=>{const x=PL+i*bw+bw*0.18,w=bw*0.64,y0=Y(0),y1=Y(r.res);
    g+='<rect x="'+x.toFixed(1)+'" y="'+Math.min(y0,y1).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(1,Math.abs(y1-y0)).toFixed(1)+'" rx="2" fill="'+(r.res>=0?"var(--gain)":"var(--loss)")+'"'+(r.dd===0?' stroke="var(--accent)" stroke-width="2.5"':' fill-opacity=".85"')+'><title>'+(r.dd>0?"+":"")+fx(r.dd,2)+' p.p.: '+signed(r.res,brl)+'</title></rect>';
    if(n<=13||i%2===0)g+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(H-PB+17)+'" text-anchor="middle">'+(r.dd>0?"+":r.dd<0?"−":"")+fx(Math.abs(r.dd),r.dd%0.5?2:1)+'</text>'});
  g+='<text class="ttl" x="'+((PL+W-PR)/2)+'" y="'+(H-6)+'" text-anchor="middle">'+xlabel+'</text>';
  g+='<text class="ttl" x="14" y="'+((PT+H-PB)/2)+'" text-anchor="middle" transform="rotate(-90 14 '+((PT+H-PB)/2)+')">Resultado total (R$)</text>';
  svg.innerHTML=g;
}
function scBind(){
  ["scSrc","scStep","scSpan"].forEach(id=>$(id).addEventListener("change",scCalc));
  $("scDate").addEventListener("change",()=>{scUserDate[$("scSrc").value]=$("scDate").value||null;scCalc()});
  $("scMat").addEventListener("change",()=>{ // troca o título aqui e na aba Calcular título
    sel.value=$("scMat").value;manual=false;MBASE=null;scUserDate.pub=null;applyFam();
    const prev=activeMod;activeMod="pub";SILENT=true;try{calc()}catch(e){}SILENT=false;activeMod=prev;scCalc()});
  $("scPi").addEventListener("input",scCalc);
  $("scCross").addEventListener("click",e=>{const td=e.target.closest("td[data-info]");if(!td)return;document.querySelectorAll("#scCross td.sel").forEach(x=>x.classList.remove("sel"));td.classList.add("sel");$("scXInfo").innerHTML="<b>"+td.dataset.info+"</b>"});
  $("scXDate").addEventListener("change",()=>{scXUser[$("scSrc").value]=$("scXDate").value||null;scCalc()});
}
function scRefreshSources(){
  const prev=activeMod;
  activeMod="pub";try{calc()}catch(e){}
  activeMod="pc";try{pcCalc()}catch(e){}
  activeMod=prev;
}

