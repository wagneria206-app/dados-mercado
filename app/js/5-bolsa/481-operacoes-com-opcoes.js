/* ---------- Operações com opções: venda coberta de CALL, venda de PUT garantida por caixa e as duas combinadas no mesmo
   ativo e vencimento. Registro no aparelho (localStorage "opOps", entra na cópia de segurança), apuração por perna,
   retorno anualizado por dias úteis e comparado ao CDI do período, cenários, probabilidade de exercício pelo modelo
   lognormal com a volatilidade de 12 meses e tabela de resultado no vencimento. */
const OPS={L:[],ed:null,f:null,A:null};
try{const x=JSON.parse(localStorage.getItem("opOps")||"[]");if(Array.isArray(x))OPS.L=x}catch(e){}
function opSave(){try{localStorage.setItem("opOps",JSON.stringify(OPS.L));localStorage.setItem("opOpsT",String(Date.now()))}catch(e){}}
const OP_TIPOS=[["call","Venda coberta (CALL)"],["put","Venda de PUT"],["combo","Combinada: CALL coberta + PUT"]];
function opNovo(){const v=isoD(VAL);return {id:null,tipo:"call",at:"",pr:"",ab:v,venc:isoD(addMonths(VAL,1)),pv:"",obs:"",
  c:{cod:"",q:"100",k:"",p:"",dv:"0",sit:"levar",ex:"auto",dz:"",pz:""},p:{cod:"",q:"100",k:"",p:"",sit:"levar",ex:"auto",dz:"",pz:""}}}
const opN=v=>{const x=num(v);return isFinite(x)?x:null};
function opNcdf(x){const t=1/(1+0.2316419*Math.abs(x)),d=0.3989423*Math.exp(-x*x/2),p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p}
function opPerna(o,L,lado){ // resultado de uma perna
  const q=opN(L.q)||0,k=opN(L.k),p=opN(L.p)||0,pr=opN(o.pr),pv=opN(o.pv),dv=lado==="c"?opN(L.dv)||0:0;
  const R={q,k,p,dv,prem:p*q,div:dv*q,cap:lado==="c"?(pr||0)*q:(k||0)*q,st:"pendente",res:null,fim:L.sit==="zerar"?L.dz:o.venc,mtm:null};
  if(L.sit==="zerar"){const pz=opN(L.pz);if(pz!=null&&L.dz){R.res=(p-pz)*q+R.div;R.st="zerada"}return R}
  R.st=L.ex!=="auto"?L.ex:pv==null||k==null?"pendente":lado==="c"?(pv>=k?"sim":"nao"):(pv<=k?"sim":"nao");
  if(lado==="c"){if(R.st==="nao"){R.res=R.prem+R.div;if(pv!=null&&pr!=null)R.mtm=(pv-pr)*q+R.prem+R.div}else if(R.st==="sim"&&pr!=null&&k!=null)R.res=(k-pr)*q+R.prem+R.div}
  else{if(R.st==="nao")R.res=R.prem;else if(R.st==="sim"&&pv!=null&&k!=null)R.res=(pv-(k-p))*q}
  return R}
function opCalc(o){
  const temC=o.tipo!=="put",temP=o.tipo!=="call",C=temC?opPerna(o,o.c,"c"):null,P=temP?opPerna(o,o.p,"p"):null,pr=opN(o.pr),ab=parseDate(o.ab),vc=parseDate(o.venc);
  const base=C?C.cap:P?P.cap:0,cap2=(C?C.cap:0)+(P?P.cap:0),prem=(C?C.prem+C.div:0)+(P?P.prem:0);
  const pernas=[C,P].filter(Boolean),fim=pernas.every(x=>x.res!=null)?Math.max(...pernas.map(x=>parseDate(x.fim)).filter(isFinite)):NaN;
  const res=pernas.every(x=>x.res!=null)?pernas.reduce((s,x)=>s+x.res,0):null,d=isFinite(fim)&&isFinite(ab)?du(ab,fim):null,n0=isFinite(ab)&&isFinite(vc)?du(ab,vc):null;
  const an=(r,n)=>r!=null&&n>0&&r>-1?(Math.pow(1+r,252/n)-1)*100:null,cdi=(a,b)=>{try{const f=cdiFactor(a,b);return isFinite(f)&&f>0?f-1:null}catch(e){return null}};
  const r=res!=null&&base>0?res/base:null,r0=base>0?prem/base:null,cdiP=d&&res!=null?cdi(ab,fim):null,cdi0=n0?cdi(ab,vc):null;
  const X={C,P,base,cap2,prem,res,r,d,n0,fim,an:an(r,d),r0,an0:an(r0,n0),cdiP,cdi0,pr,feita:res!=null};
  if(C&&pr!=null&&C.k!=null){X.eqC=pr-C.p-C.dv;X.maxC=(C.k-pr+C.p+C.dv)/pr*100}
  if(P&&P.k!=null){X.eqP=P.k-P.p;if(pr)X.quedaP=(P.k/pr-1)*100}
  if(C&&P&&pr!=null&&P.k!=null&&C.q+P.q>0){X.pmP=(pr*C.q-(C.p+C.dv)*C.q+(P.k-P.p)*P.q)/(C.q+P.q);X.pm0=C.q?pr-C.p-C.dv-P.p*P.q/C.q:null}
  return X}
function opNoVenc(o,X,s){ // resultado das pernas levadas até o vencimento se a ação fechar em s (pernas zeradas entram pelo resultado)
  let t=0;[["c",X.C],["p",X.P]].forEach(([l,R])=>{if(!R)return;const L=o[l];if(L.sit==="zerar"){t+=R.res||0;return}const pr=X.pr||0;
    if(l==="c")t+=(s>=R.k?(R.k-pr)*R.q:(s-pr)*R.q)+R.prem+R.div;else t+=(s<=R.k?(s-(R.k-R.p))*R.q:R.prem)});return t}
function opProb(o,X){ // probabilidade de exercício no vencimento: lognormal, volatilidade de 12 meses, juro da curva
  const vc=parseDate(o.venc);if(!(vc>VAL)||!AT.idx)return null;const r=atRow(String(o.at).toUpperCase());if(!r)return null;const S=r[AT.C.preco],v=r[AT.C.v12];if(!(S>0&&v>0))return null;
  const T=du(VAL,vc)/252;if(!(T>0))return null;let rf=0.1;try{rf=Math.log(cdiFactor(VAL,vc))/T}catch(e){}const sg=v/100,d2=K=>(Math.log(S/K)+(rf-sg*sg/2)*T)/(sg*Math.sqrt(T));
  return {S,v,T,c:X.C&&X.C.k?opNcdf(d2(X.C.k)):null,p:X.P&&X.P.k?opNcdf(-d2(X.P.k)):null}}
const opSt={sim:'<b class="neg">exercida</b>',nao:'<b class="pos">não exercida</b>',zerada:'<b>zerada</b>',pendente:'<span style="color:var(--muted)">em aberto</span>'};
function opPct(v,d){return v==null||!isFinite(v)?'—':fx(v,d==null?2:d)+'%'}
function opResHtml(o){
  const X=opCalc(o),kp=(l,v,s,c)=>tecKp(l,v,s,c);let h='';
  h+='<div class="fnkpis">'+kp(o.tipo==="put"?"Capital reservado (garantia)":"Capital na ação",brl(X.base),o.tipo==="combo"?'mais '+brl(X.P?X.P.cap:0)+' de garantia da PUT, aplicado em renda fixa':'base do retorno')
    +kp("Prêmios recebidos"+(X.C&&X.C.div?' e proventos':''),brl(X.prem),X.r0!=null?opPct(X.r0*100)+' do capital':'')
    +kp("Se nada for exercido",X.an0!=null?opPct(X.an0)+' ao ano':'—',X.n0?X.n0+' dias úteis até o vencimento'+(X.cdi0!=null&&X.r0!=null?' · '+fx(X.r0/X.cdi0*100,0)+'% do CDI do período':''):'')
    +(X.feita?kp("Resultado apurado",brl(X.res),X.an!=null?opPct(X.an)+' ao ano em '+X.d+' dias úteis'+(X.cdiP?' · '+fx(X.r/X.cdiP*100,0)+'% do CDI':''):'',X.res>=0?'pos':'neg'):'')+'</div>';
  const cen=[];
  if(X.eqC!=null)cen.push(["Ponto de equilíbrio da ação",brl(X.eqC),"abaixo disso, a operação dá prejuízo"]);
  if(X.maxC!=null)cen.push(["Ganho máximo se a CALL for exercida",opPct(X.maxC),"a alta acima do strike fica com quem comprou a CALL"]);
  if(X.quedaP!=null)cen.push(["Queda até o strike da PUT",opPct(X.quedaP),"a partir daí, a PUT tende a ser exercida"]);
  if(X.eqP!=null&&o.tipo==="put")cen.push(["Preço efetivo de compra se exercida",brl(X.eqP),"strike menos o prêmio"]);
  if(X.pm0!=null)cen.push(["Preço médio se nada for exercido",brl(X.pm0),"os dois prêmios abatem o custo da ação"]);
  if(X.pmP!=null)cen.push(["Preço médio se a PUT for exercida",brl(X.pmP),"compra mais ações no strike da PUT"]);
  const pb=opProb(o,X);if(pb){if(pb.c!=null)cen.push(["Chance de a CALL ser exercida",opPct(pb.c*100,0),"modelo, com a ação a "+brl(pb.S)+" hoje"]);if(pb.p!=null)cen.push(["Chance de a PUT ser exercida",opPct(pb.p*100,0),"modelo, volatilidade de "+fx(pb.v,0)+"% ao ano"])}
  if(cen.length)h+='<div class="fnkpis" style="margin-top:8px">'+cen.map(x=>kp(x[0],x[1],x[2])).join("")+'</div>';
  [["c","CALL",X.C],["p","PUT",X.P]].forEach(([l,n,R])=>{if(!R)return;h+='<p style="margin:6px 0 0">Perna '+n+': '+opSt[R.st]+(R.res!=null?' · resultado '+brl(R.res):'')+(R.mtm!=null?' · <span class="sub">com a variação da ação até o vencimento: '+brl(R.mtm)+'</span>':'')+'</p>'});
  // resultado no vencimento por preço da ação
  if(X.pr&&[X.C,X.P].some(R=>R&&R.k!=null)&&[["c",X.C],["p",X.P]].some(([l,R])=>R&&o[l].sit!=="zerar")){
    const pts=[-20,-15,-10,-5,0,5,10,15,20].map(v=>X.pr*(1+v/100)),ks=[X.C&&X.C.k,X.P&&X.P.k].filter(v=>v!=null);ks.forEach(k=>{if(!pts.some(s=>Math.abs(s-k)<0.005))pts.push(k)});pts.sort((a,b)=>a-b);
    h+='<div class="label" style="margin-top:12px">Resultado no vencimento conforme o preço da ação</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ação no vencimento</th><th>Variação</th><th>Resultado</th><th>Sobre o capital</th></tr></thead><tbody>'
      +pts.map(s=>{const t=opNoVenc(o,X,s),k=ks.some(v=>Math.abs(v-s)<0.005);return '<tr'+(k?' style="font-weight:700"':'')+'><td style="text-align:left">'+brl(s)+(k?' <small>(strike)</small>':'')+'</td><td>'+mcSig((s/X.pr-1)*100,1)+'</td><td class="'+(t>=0?'pos':'neg')+'">'+brl(t)+'</td><td>'+(X.base?opPct(t/X.base*100,1):'—')+'</td></tr>'}).join("")+'</tbody></table></div>'}
  return h}
function opCampo(id,rot,v,o){o=o||{};return '<div class="field"><label for="'+id+'">'+rot+'</label>'+(o.sel?'<select id="'+id+'">'+o.sel.map(([a,b])=>'<option value="'+a+'"'+(a===v?' selected':'')+'>'+b+'</option>').join("")+'</select>':'<input id="'+id+'"'+(o.date?' type="date"':' inputmode="'+(o.txt?'text':'decimal')+'" autocomplete="off"')+(o.ph?' placeholder="'+o.ph+'"':'')+' value="'+esc(v||"")+'"'+(o.up?' style="text-transform:uppercase"':'')+'>')+'</div>'}
function opPernaHtml(l,o){const L=o[l],c=l==="c",n=c?"CALL":"PUT";
  return '<fieldset id="opF'+l+'" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0"><legend style="font-weight:700;padding:0 6px">'+(c?'Venda coberta de CALL':'Venda de PUT garantida por caixa')+'</legend><div class="scctl">'
    +opCampo("op"+l+"cod","Código da "+n,L.cod,{txt:1,up:1,ph:c?"ex.: PETRK37":"ex.: PETRW33"})+opCampo("op"+l+"q",c?"Ações cobertas":"Quantidade (lote)",L.q)+opCampo("op"+l+"k","Strike (R$)",L.k)+opCampo("op"+l+"p","Prêmio recebido por ação (R$)",L.p)
    +(c?opCampo("opcdv","Proventos no período (R$/ação)",L.dv):'')
    +opCampo("op"+l+"sit","Situação",L.sit,{sel:[["levar","Levar até o vencimento"],["zerar","Zerar antes (recompra)"]]})
    +'<span data-opv="'+l+'"'+(L.sit==="zerar"?' hidden':'')+'>'+opCampo("op"+l+"ex","Foi exercida?",L.ex,{sel:[["auto","Pelo preço no vencimento"],["sim","Sim"],["nao","Não"]]})+'</span>'
    +'<span data-opz="'+l+'"'+(L.sit==="zerar"?'':' hidden')+'>'+opCampo("op"+l+"dz","Data da recompra",L.dz,{date:1})+opCampo("op"+l+"pz","Prêmio pago na recompra (R$/ação)",L.pz)+'</span></div></fieldset>'}
function opFormHtml(o){
  return '<section class="panel"><h3>'+(o.id?'Editando operação':'Nova operação')+'</h3><p class="sub">Registre a operação ao abrir e complete ao encerrar. Fica guardada só neste aparelho e entra na cópia de segurança.</p>'
    +'<div class="scctl">'+opCampo("optipo","Estrutura",o.tipo,{sel:OP_TIPOS})+opCampo("opat","Ativo-objeto",o.at,{txt:1,up:1,ph:"ex.: PETR4"})+opCampo("oppr","Preço da ação na abertura (R$)",o.pr)+opCampo("opab","Data de abertura",o.ab,{date:1})+opCampo("opvenc","Vencimento",o.venc,{date:1})+opCampo("oppv","Ação no vencimento (R$)",o.pv,{ph:"preencha depois"})+'</div>'
    +'<div id="opDica" class="sub" style="font-size:.85rem;margin:6px 0"></div>'
    +'<div data-opleg="c"'+(o.tipo==="put"?' hidden':'')+'>'+opPernaHtml("c",o)+'</div><div data-opleg="p"'+(o.tipo==="call"?' hidden':'')+'>'+opPernaHtml("p",o)+'</div>'
    +opCampo("opobs","Anotação (opcional)",o.obs,{txt:1,ph:"por que fiz, plano de saída"})
    +'<div id="opRes" aria-live="polite" style="margin-top:12px"></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn" data-opsalva="1">'+(o.id?'Salvar alterações':'Salvar no histórico')+'</button><button type="button" class="btn sec" data-oplimpa="1">'+(o.id?'Cancelar edição':'Limpar')+'</button></div></section>'}
function opLer(){const g=id=>{const e=$(id);return e?e.value.trim():""},o=OPS.f;
  ["tipo","at","pr","ab","venc","pv","obs"].forEach(k=>{const e=$("op"+k);if(e)o[k]=k==="at"?g("op"+k).toUpperCase():g("op"+k)});
  ["c","p"].forEach(l=>["cod","q","k","p","dv","sit","ex","dz","pz"].forEach(k=>{const e=$("op"+l+k);if(e)o[l][k]=k==="cod"?e.value.trim().toUpperCase():e.value.trim()}));return o}
function opDica(){const d=$("opDica");if(!d)return;const o=OPS.f,t=o.at,put=h=>{if(d.innerHTML!==h)d.innerHTML=h};if(!t||!AT.idx){put("");return}const r=atRow(t);if(!r){put("");return}
  let h='Cotação de '+esc(t)+': <b>'+brl(r[AT.C.preco])+'</b> · volatilidade de 12 meses '+(r[AT.C.v12]!=null?fx(r[AT.C.v12],0)+'%':'—')+' <button type="button" class="link" data-oppx="'+r[AT.C.preco]+'">usar na abertura</button>';
  const A=AT.files.get(t);if(A&&o.tipo!=="put"){const a=parseDate(o.ab),b=parseDate(o.venc);if(isFinite(a)&&isFinite(b)){const dv=(A.adj||[]).filter(e=>/^[DJRE]$/.test(String(e[2]))&&e[3]>0).filter(e=>{const t2=AT.T[e[0]];return t2>a&&t2<=b}).reduce((s,e)=>s+e[3],0);
    if(dv>0)h+=' · proventos com data-ex no período: <b>R$ '+fx(dv,4)+'</b>/ação <button type="button" class="link" data-opdv="'+dv.toFixed(4)+'">usar</button>'}
    if(isFinite(b)&&b<=AT.T[AT.T.length-1]){let s=null;for(let x=A.I.length-1;x>=0;x--)if(AT.T[A.I[x]]<=b){s=A.R[x];break}if(s!=null)h+=' · fechamento no vencimento: <b>'+brl(s)+'</b> <button type="button" class="link" data-oppv="'+s+'">usar</button>'}}
  else if(!A)atFile(t).then(()=>{if(activeMod==="op"&&OPS.f.at===t)opDica()}).catch(()=>{});
  if(d.dataset.h!==h){d.dataset.h=h;d.innerHTML=h}}
function opAtual(){if(!OPS.f)return;opLer();const o=OPS.f;
  document.querySelectorAll("[data-opleg]").forEach(e=>e.hidden=(e.dataset.opleg==="c"&&o.tipo==="put")||(e.dataset.opleg==="p"&&o.tipo==="call"));
  ["c","p"].forEach(l=>{const z=o[l].sit==="zerar";document.querySelectorAll('[data-opz="'+l+'"]').forEach(e=>e.hidden=!z);document.querySelectorAll('[data-opv="'+l+'"]').forEach(e=>e.hidden=z)});
  const r=$("opRes");if(r){try{r.innerHTML=opResHtml(o)}catch(e){r.innerHTML='<p class="err">'+esc(e.message)+'</p>'}}opDica()}
function opHistHtml(){
  if(!OPS.L.length)return '<section class="panel"><h3>Histórico</h3><p class="sub">Nenhuma operação salva ainda.</p></section>';
  const L=OPS.L.map(o=>({o,X:opCalc(o)})).sort((a,b)=>(b.o.ab||"").localeCompare(a.o.ab||"")),F=L.filter(x=>x.X.feita),soma=F.reduce((s,x)=>s+x.X.res,0),premT=L.reduce((s,x)=>s+x.X.prem,0);
  const tx=l=>{const v=L.filter(x=>x.X[l]&&x.X[l].st!=="pendente");return v.length?fx(v.filter(x=>x.X[l].st==="sim").length/v.length*100,0)+'% de '+v.length:'—'};
  const anM=F.filter(x=>x.X.an!=null),cdiM=F.filter(x=>x.X.cdiP>0);
  let h='<section class="panel"><h3>Histórico e resultados</h3><div class="fnkpis">'+tecKp("Operações",L.length+'',F.length+' encerradas · '+(L.length-F.length)+' em aberto')+tecKp("Prêmios e proventos",brl(premT),'todas as operações')
    +tecKp("Resultado das encerradas",brl(soma),F.length?'':'nenhuma encerrada',soma>=0?'pos':'neg')+tecKp("Retorno anualizado médio",anM.length?opPct(anM.reduce((s,x)=>s+x.X.an,0)/anM.length):'—',cdiM.length?'média de '+fx(cdiM.reduce((s,x)=>s+x.X.r/x.X.cdiP*100,0)/cdiM.length,0)+'% do CDI':'')
    +tecKp("CALLs exercidas",tx("C"))+tecKp("PUTs exercidas",tx("P"))+'</div>';
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ativo</th><th style="text-align:left">Estrutura</th><th>Strikes</th><th>Abertura</th><th>Vencimento</th><th>Situação</th><th>Prêmios</th><th>Resultado</th><th>Ao ano</th><th></th></tr></thead><tbody>'
    +L.map(({o,X})=>'<tr><td style="text-align:left"><b>'+esc(o.at||'—')+'</b>'+(o.obs?'<small style="display:block;color:var(--muted)">'+esc(o.obs).slice(0,50)+'</small>':'')+'</td><td style="text-align:left"><small>'+[X.C?esc(o.c.cod||'CALL'):'',X.P?esc(o.p.cod||'PUT'):''].filter(Boolean).join(' + ')+'</small></td><td>'+[X.C&&X.C.k,X.P&&X.P.k].filter(v=>v!=null).map(v=>fx(v,2)).join(' / ')+'</td><td>'+(o.ab?fdate(parseDate(o.ab)):'—')+'</td><td>'+(o.venc?fdate(parseDate(o.venc)):'—')+'</td>'
      +'<td><small>'+[X.C?'C: '+opSt[X.C.st]:'',X.P?'P: '+opSt[X.P.st]:''].filter(Boolean).join('<br>')+'</small></td><td>'+brl(X.prem)+'</td><td class="'+(X.res==null?'':X.res>=0?'pos':'neg')+'">'+(X.res==null?'—':brl(X.res))+'</td><td>'+opPct(X.an,1)+'</td>'
      +'<td style="white-space:nowrap"><button type="button" class="link" data-opedita="'+esc(o.id)+'">editar</button> · <button type="button" class="link" data-opapaga="'+esc(o.id)+'">apagar</button></td></tr>').join("")+'</tbody></table></div>'
    +'<p class="sub" style="font-size:.8rem;margin-top:8px">Imposto: o ganho líquido com opções paga 15% de IR (operação comum) ou 20% (day trade), em DARF até o último dia útil do mês seguinte; a isenção de vendas de até R$ 20 mil por mês vale só para ações, não para opções. CALL exercida: o prêmio entra no preço de venda das ações. PUT exercida: o prêmio reduz o custo das ações compradas. Confira com o seu informe de corretagem.</p></section>';
  return h}
function opTela(){const o=$("fnOut");if(!o)return;if(!AT.idx){atBoot();if(!AT.load){}}
  if(!OPS.f)OPS.f=opNovo();
  if(FN.view!=="op"){FN.view="op";o.innerHTML='<div id="opForm"></div><div id="opHist"></div><section class="panel notes" style="font-size:.85rem"><b>Como ler.</b> Venda coberta: você tem as ações e vende o direito de alguém comprá-las no strike; recebe o prêmio e abre mão da alta acima do strike. Venda de PUT: você se compromete a comprar as ações no strike, com o dinheiro reservado; recebe o prêmio e, se a ação cair abaixo do strike, compra mais caro que o mercado. Retornos anualizados por dias úteis, comparados ao CDI do mesmo período. As chances de exercício saem de um modelo (preço de hoje, volatilidade dos últimos 12 meses e juro da curva) e não são previsão. Material de apoio à decisão, não recomendação.</section>'}
  $("opForm").innerHTML=opFormHtml(OPS.f);$("opHist").innerHTML=opHistHtml();opAtual()}
document.addEventListener("input",e=>{if(e.target.closest&&e.target.closest("#opForm")){clearTimeout(opTela.t);opTela.t=setTimeout(opAtual,200)}});
document.addEventListener("change",e=>{if(e.target.closest&&e.target.closest("#opForm"))opAtual()});
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-opsalva],[data-oplimpa],[data-opedita],[data-opapaga],[data-oppx],[data-opdv],[data-oppv]");if(!x)return;
  if(x.dataset.oppx){$("oppr").value=fx(+x.dataset.oppx,2);opAtual();return}if(x.dataset.opdv){const i=$("opcdv");if(i){i.value=fx(+x.dataset.opdv,4);opAtual()}return}if(x.dataset.oppv){$("oppv").value=fx(+x.dataset.oppv,2);opAtual();return}
  if(x.dataset.opsalva){const o=opLer();if(!o.at){alertLite("Informe o ativo-objeto.");return}const X=opCalc(o);if([X.C,X.P].some(R=>R&&(R.k==null||!R.q))){alertLite("Informe strike e quantidade de cada perna.");return}
    const c=JSON.parse(JSON.stringify(o));if(!c.id){c.id=Date.now().toString(36);OPS.L.push(c)}else{const i=OPS.L.findIndex(y=>y.id===c.id);if(i>=0)OPS.L[i]=c;else OPS.L.push(c)}
    opSave();OPS.f=opNovo();FN.view=null;opTela();alertLite("Operação salva.");return}
  if(x.dataset.oplimpa){OPS.f=opNovo();FN.view=null;opTela();return}
  if(x.dataset.opedita){const y=OPS.L.find(o=>o.id===x.dataset.opedita);if(y){OPS.f=JSON.parse(JSON.stringify(y));FN.view=null;opTela();try{$("opForm").scrollIntoView({behavior:"smooth"})}catch(e){}}return}
  if(x.dataset.opapaga){if(x.dataset.conf!=="1"){x.dataset.conf="1";x.textContent="confirmar?";return}OPS.L=OPS.L.filter(o=>o.id!==x.dataset.opapaga);opSave();FN.view=null;opTela()}});
