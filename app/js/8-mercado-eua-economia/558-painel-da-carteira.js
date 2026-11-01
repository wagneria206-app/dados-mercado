/* ---------- painel de indicadores da carteira, classe de cada item e liquidez
   Classe: automática (CVM, ANBIMA, B3, tipo de renda fixa) ou escolhida pelo usuário (it.cl).
   Liquidez: dias até o dinheiro na conta. Fundos pelo prazo de cotização + pagamento da CVM; Bolsa D+2; Tesouro D+1;
   quando não há dado oficial, o usuário informa (it.liq, em dias corridos; it.car, carência até uma data). */
const SP_CL={pos:"Pós-fixado (CDI/Selic)",pre:"Prefixado",infl:"Inflação (IPCA+)",cred:"Crédito privado",mm:"Multimercado",acoes:"Ações Brasil",intl:"Internacional",imob:"Imobiliário (FII)",cripto:"Criptoativos",ouro:"Ouro, dólar e commodities",outros:"Outros"};
const SP_CL_COR={pos:"#2563eb",pre:"#0891b2",infl:"#7c3aed",cred:"#db2777",mm:"#f59e0b",acoes:"#16a34a",intl:"#0d9488",imob:"#b45309",cripto:"#9333ea",ouro:"#ca8a04",outros:"#64748b"};
function spClAuto(x){
  if(x.t==="f"){const r=FN.idx&&fnRow(x.k);if(!r)return "outros";const cls=fnNorm(FN.idx.classes[r[FN.C.classe]]||""),anb=fnNorm((FN.idx.anbima||[])[r[FN.C.anbima]]||""),nm=fnNorm(r[1]);
    if(/cripto|bitcoin/.test(anb+" "+nm))return "cripto";
    if(/exterior/.test(anb)&&/acoes/.test(cls+anb))return "intl";
    if(/acoes/.test(cls))return "acoes";
    if(/cambial/.test(cls))return "ouro";
    if(/multimercado/.test(cls))return /exterior/.test(anb)?"intl":"mm";
    if(/credito livre|credito privado|high yield|debentures|incentivad|infra/.test(anb+" "+nm))return "cred";
    if(/indices|inflacao|ima-b|imab|ipca/.test(anb+" "+nm))return "infl";
    if(/irf-m|prefixad/.test(anb+" "+nm))return "pre";
    return /renda fixa/.test(cls)?"pos":"outros"}
  if(x.t==="a"){const r=AT.idx&&atRow(x.k);if(!r)return "outros";const tp=r[AT.C.tipo],st=fnNorm(AT.idx.setores[r[AT.C.setor]]||""),nm=fnNorm(r[1]+" "+x.k);
    if(tp==="Ação"||tp==="Unit")return "acoes";
    if(tp==="FI-Infra")return "cred";
    if(tp==="FII"||tp==="Fiagro")return "imob";
    if(/^BDR/.test(tp))return "intl";
    if(tp==="Tesouro Direto")return /selic/.test(st)?"pos":/prefixado/.test(st)?"pre":"infl";
    if(tp==="ETF"){if(/renda fixa/.test(st))return /ima-?b|ipca|b5p|inflac/.test(nm)?"infl":/irf|fixa|pre/.test(nm)?"pre":"pos";
      return /internacional/.test(st)?"intl":/cripto/.test(st)?"cripto":/ouro/.test(st)?"ouro":/outros/.test(st)?"outros":"acoes"}
    return "outros"}
  if(/^cr:/.test(x.k||""))return "cred";
  return x.rf==="pre"?"pre":x.rf==="ipca"?"infl":"pos"}
const spCl=x=>x.cl&&SP_CL[x.cl]?x.cl:spClAuto(x);
/* liquidez: {d: dias (null = sem dado), fonte, car: carência até (data)} */
function spLiq(x){
  const car=x.car&&/^\d{4}-\d{2}-\d{2}$/.test(x.car)&&x.car>new Date().toISOString().slice(0,10)?x.car:null;
  if(x.liq!=null&&x.liq!==""&&isFinite(+x.liq))return {d:+x.liq,fonte:"informado",car};
  if(x.t==="f"){const F=FN.files.get(x.k)||{},r=FN.idx&&fnRow(x.k);const d=F.dcot!=null||F.dpag!=null?(+F.dcot||0)+(+F.dpag||0):r&&r[FN.C.dres]!=null?+r[FN.C.dres]:null;return {d,fonte:d!=null?"CVM":"sem dado",car}}
  if(x.t==="a"){const r=AT.idx&&atRow(x.k);return {d:r&&r[AT.C.tipo]==="Tesouro Direto"?1:2,fonte:"B3",car}}
  if(/^cr:/.test(x.k||""))return {d:null,fonte:"mercado secundário",car};
  return {d:null,fonte:"sem dado",car}}
const SP_LQ=[["d1","Até D+1",d=>d<=1],["d5","Até D+5",d=>d<=5],["d30","Até D+30",d=>d<=30],["dmais","Acima de D+30",d=>d>30]];

/* rentabilidade no mês, no ano, em 12 meses e desde o início (e o CDI de cada janela): posição real (cotas) ou simulação */
function spJanelas(X,R){
  let rM=null,rA=null,r12=null,rT=null,cM=null,cA=null,c12=null,cT=null;
  if(X&&X.pts.length>1){const pts=X.pts,u=pts[pts.length-1],at=d=>{let r=null;for(const p of pts){if(p.d<=d)r=p;else break}return r};
    const dv=u.d,m0=dv.slice(0,8)+"01",a0=dv.slice(0,4)+"-01-01",d12=new Date(Date.parse(dv)-365*DAY).toISOString().slice(0,10),ant=d=>new Date(Date.parse(d)-DAY).toISOString().slice(0,10);
    const w0=(d)=>at(ant(d))||pts[0],cv=(a,b)=>{const x=spAt(X.T.cdiS,a),y=spAt(X.T.cdiS,b);return x&&y?(y[1]/x[1]-1)*100:null};
    rM=(u.idx/w0(m0).idx-1)*100;cM=cv(w0(m0).d,dv);rA=(u.idx/w0(a0).idx-1)*100;cA=cv(w0(a0).d,dv);if(pts[0].d<=d12){const p=at(d12);r12=(u.idx/p.idx-1)*100;c12=cv(p.d,dv)}rT=(u.idx-1)*100;cT=X.T.cdi}
  else if(R&&R.rets&&R.rets.length){const cl=spCdiLv(R),rets=R.rets,n=rets.length,uk=rets[n-1].k,acc=(i0)=>{let v=1;for(let i=i0;i<n;i++)v*=1+rets[i].r;return (v-1)*100},cc=(i0)=>{const a=cl(i0>0?rets[i0-1].k:R.k0),b=cl(uk);return a&&b?(b/a-1)*100:null};
    const per=R.diaria?21:1,i12=Math.max(0,n-(R.diaria?252:12));rM=acc(Math.max(0,n-per));cM=cc(Math.max(0,n-per));r12=n>=(R.diaria?252:12)?acc(i12):null;c12=r12!=null?cc(i12):null;rT=acc(0);cT=cc(0);const y=Math.floor(rets[n-1].m/12),ia=rets.findIndex(x=>Math.floor(x.m/12)===y);if(ia>=0){rA=acc(ia);cA=cc(ia)}}
  return {rM,rA,r12,rT,cM,cA,c12,cT}}
/* pesos atuais: valor de mercado na posição real, senão o peso proposto */
function spPesos(c,it){
  const P=SP_POS&&SP_POS.c===c&&SP_POS.X&&!SP_POS.X.erro?SP_POS.X:null;
  if(P){const v=new Map();P.P.forEach(p=>v.set(p.x,(v.get(p.x)||0)+p.v));const tot=[...v.values()].reduce((a,b)=>a+b,0);if(tot>0)return {w:it.map(x=>(v.get(x)||0)/tot),real:true,tot}}
  const s=it.reduce((a,x)=>a+(+x.w||0),0)||1;return {w:it.map(x=>(+x.w||0)/s),real:false,tot:+c.valor||0}}

function spPainelHtml(c,it,R){
  if(!it.length)return "";
  const {w,real,tot}=spPesos(c,it),X=real?SP_POS.X:null,kp=(a,b,cc,cls)=>'<div class="fnkp'+(cls?' '+cls:'')+'"><span>'+a+'</span><b>'+b+'</b>'+(cc?'<small>'+cc+'</small>':'')+'</div>';
  const pc=v=>v==null||!isFinite(v)?'—':fnPct(v),pcdi=(r,c0)=>r!=null&&c0>0&&r>0?fx(r/c0*100,0)+'% do CDI':'';
  const {rM,rA,r12,rT,cM,cA,c12,cT}=spJanelas(X,R);
  const st=R&&R.rets?spStats(R,R.rets,R.pts[R.pts.length-1].idx):{};
  // liquidez e concentração
  const L=it.map((x,i)=>({x,w:w[i],l:spLiq(x)})),semLiq=L.filter(o=>o.l.d==null&&o.w>0),carencia=L.filter(o=>o.l.car&&o.w>0);
  const lq=SP_LQ.map(([k,lab,f])=>[lab,L.reduce((a,o)=>a+(o.l.d!=null&&!o.l.car&&f(o.l.d)?o.w:0),0)*100]);
  const ws=w.slice().sort((a,b)=>b-a),hhi=w.reduce((a,v)=>a+v*v,0),nEf=hhi>0?1/hhi:0;
  const maior=it[w.indexOf(ws[0])];
  // alocação por classe
  const cl={};it.forEach((x,i)=>{const k=spCl(x);cl[k]=(cl[k]||0)+w[i]});const CL=Object.entries(cl).filter(([,v])=>v>0.00005).sort((a,b)=>b[1]-a[1]);
  let h='<section class="panel sppainel" data-reltit="Painel da carteira"><div class="fnh1"><div><h3>Painel da carteira</h3><div class="fnsub">'+esc(c.nome)+(c.cli?' · cliente '+esc(c.cli):'')+' · '+(real?'posição real em '+fdate(Date.parse(X.dv+"T00:00:00Z"))+' (aplicações informadas)':'proposta: números da simulação histórica e pesos propostos')+'</div></div></div>';
  h+='<div class="label" style="margin-top:8px">Resultado</div><div class="fnkpis">'
    +kp("Patrimônio",brl(real?X.T.v:(R&&R.pts?R.pts[R.pts.length-1].v:tot)),real?'aplicado '+brl(X.T.apl)+(X.T.resg?' · resgatado '+brl(X.T.resg):''):'valor simulado')
    +(real?kp("Ganho",'<span class="'+(X.T.ganho>=0?'pos':'neg')+'">'+brl(X.T.ganho)+'</span>',X.T.tir!=null?'TIR '+fnPctT(X.T.tir*100)+' a.a.':''):'')
    +kp("No mês",pc(rM),pcdi(rM,cM))+kp("No ano",pc(rA),pcdi(rA,cA))+kp("12 meses",pc(r12),pcdi(r12,c12))+kp("Desde o início",pc(rT),pcdi(rT,cT))+'</div>';
  h+='<div class="label" style="margin-top:10px">Risco</div><div class="fnkpis">'
    +kp("Volatilidade",st.vol!=null?fx(st.vol,2)+'%':'—','ao ano'+(real?' (simulação dos pesos)':''))+kp("Perda máxima",pc(st.dd),'maior queda desde um pico')+kp("Sharpe",st.sharpe!=null?fx(st.sharpe,2):'—','retorno acima do CDI por unidade de risco')
    +kp("Meses acima do CDI",st.acima!=null?fx(st.acima,0)+'%':'—',st.worst!=null?'pior mês '+fnPctT(st.worst):'')+'</div>';
  h+='<div class="label" style="margin-top:10px">Liquidez e concentração</div><div class="fnkpis">'
    +lq.slice(0,3).map(([lab,v])=>kp("Resgatável "+lab.replace(/^Até/,"até"),fx(v,0)+'%','da carteira')).join("")
    +kp("Maior item",fx(ws[0]*100,1)+'%',esc(spItemNome(maior)).slice(0,40))+(()=>{const rb=spRebal(c,it);return kp("Política ("+esc(SP_PERFIS[rb.P.perfil].nome.toLowerCase())+")",rb.fora.length?'<span class="neg">Fora</span>':'<span class="pos">Dentro</span>',rb.fora.length?rb.fora.length+(rb.fora.length>1?' classes':' classe')+' além da tolerância de '+fx(+rb.P.tol||0,1)+' p.p.':'todas as classes dentro da tolerância',rb.fora.length?'kpalerta':'')})()+(()=>{const C=spCredito(c,it);if(!C.fgc&&!C.L.length)return "";return kp("FGC",C.acima>0?'<span class="neg">'+brl(C.acima)+' descoberto</span>':'<span class="pos">Dentro do limite</span>',C.acima>0?'acima de R$ 250 mil por instituição':brl(C.fgc)+' cobertos',C.acima>0?'kpalerta':'')})()
    +kp("Nº efetivo de itens",fx(nEf,1),'de '+it.filter((x,i)=>w[i]>0).length+' itens · '+(nEf<4?'concentrada':nEf<8?'moderada':'diversificada'),nEf<4?'kpalerta':'')+'</div>';
  if(semLiq.length||carencia.length)h+='<p class="warn" style="font-size:.84rem;margin-top:6px">'+(semLiq.length?'Sem prazo de resgate oficial para '+semLiq.length+(semLiq.length>1?' itens':' item')+' ('+fx(semLiq.reduce((a,o)=>a+o.w,0)*100,0)+'% da carteira): '+semLiq.slice(0,4).map(o=>esc(spItemNome(o.x)).slice(0,34)).join("; ")+(semLiq.length>4?'…':'')+'. Informe o prazo em cada item, na composição (campo "Resgate em D+"). ':'')+(carencia.length?carencia.length+(carencia.length>1?' itens em carência':' item em carência')+' (contam como não resgatáveis até a data).':'')+'</p>';
  h+='<div class="label" style="margin-top:10px">Alocação por classe</div><div class="spbar" role="img" aria-label="Alocação por classe">'+CL.map(([k,v])=>'<i style="width:'+(v*100).toFixed(2)+'%;background:'+SP_CL_COR[k]+'" title="'+esc(SP_CL[k])+' '+fx(v*100,1)+'%"></i>').join("")+'</div><div class="legend">'+CL.map(([k,v])=>'<span><i style="background:'+SP_CL_COR[k]+'"></i>'+esc(SP_CL[k])+' · '+fx(v*100,1)+'%</span>').join("")+'</div>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">'+(real?'Rentabilidade por cotas (sem efeito do momento das aplicações), com as aplicações e resgates informados; risco pela simulação histórica dos pesos atuais.':'Proposta: rentabilidade e risco pela simulação histórica dos pesos propostos.')+' Liquidez: fundos pelo prazo de cotização mais pagamento informado à CVM; Bolsa em D+2; Tesouro Direto em D+1; os demais, pelo prazo informado no item. Nº efetivo de itens = 1 ÷ soma dos pesos ao quadrado (10 itens iguais = 10; um item com 90% puxa para perto de 1). Classe de cada item: automática pela CVM, ANBIMA e B3, ajustável na composição.</p></section>';
  return h}

/* controles de cada item na composição: classe e liquidez (quando faltar o dado oficial) */
function spAjItem(it,j){const l=spLiq(Object.assign({},it,{liq:null,car:null})),auto=spClAuto(it);
  return '<div class="spaj"><select data-spcl="'+j+'" aria-label="Classe do item">'+Object.keys(SP_CL).map(k=>'<option value="'+k+'"'+(spCl(it)===k?' selected':'')+'>'+SP_CL[k]+(k===auto?' (automática)':'')+'</option>').join("")+'</select>'
    +'<label class="spajl">Resgate em D+<input inputmode="numeric" data-spliq="'+j+'" value="'+(it.liq!=null&&it.liq!==""?esc(String(it.liq)):'')+'" placeholder="'+(l.d!=null?String(l.d):'?')+'" title="'+(l.d!=null?'Oficial: D+'+l.d+' ('+l.fonte+'). Preencha só para corrigir.':'Sem dado oficial: informe em quantos dias o dinheiro cai na conta')+'"></label>'
    +'<label class="spajl">Carência até<input type="date" data-spcar="'+j+'" value="'+esc(it.car||"")+'"></label></div>'+spAjRf(it,j)}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||activeMod!=="sp")return;const c=spC();let j;
  if((j=t.dataset.spcl)!=null){const it=c.itens[+j];if(!it)return;it.cl=t.value===spClAuto(it)?undefined:t.value;spSave();spCalc();return}
  if((j=t.dataset.spliq)!=null){const it=c.itens[+j];if(!it)return;const v=t.value.trim();it.liq=v===""?undefined:Math.max(0,Math.round(num(v)));if(it.liq!=null&&!isFinite(it.liq))it.liq=undefined;spSave();spCalc();return}
  if((j=t.dataset.spcar)!=null){const it=c.itens[+j];if(!it)return;it.car=t.value||undefined;spSave();spCalc();return}});
