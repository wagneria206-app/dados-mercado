/* ---------- Consultor WF da carteira: junta tudo o que o app sabe (risco, concentração, crédito e FGC, liquidez,
   notas dos itens e mapa tático) numa nota de 0 a 100, num plano de ação por prioridade e num registro do que mudou
   desde a leitura anterior (guardado só no aparelho, "cbMem"). Regras explícitas; apoio à decisão, não recomendação. */
const CD_PIL=[["div","Diversificação"],["risco","Risco × perfil"],["qual","Qualidade dos itens"],["liq","Liquidez"],["cred","Crédito e FGC"],["cen","Aderência ao cenário"]];
function cdMem(){try{return JSON.parse(localStorage.getItem("cbMem")||"{}")}catch(e){return {}}}
function cdMemSet(m){try{localStorage.setItem("cbMem",JSON.stringify(m))}catch(e){}}
function cdDataRef(){return (AT.idx&&AT.idx.dt)||isoD(VAL)}
function cdItemNota(x){ // nota WF do item, quando existe
  if(x.t==="a"){const N=cbNota(),n=N&&N.get(x.k);return n?{n:n.nota,o:n}:null}
  if(x.t==="f"){const N=cbFnNota(),n=N&&N.get(x.k);return n?{n:n.nota,o:n}:null}
  if(/^cr:/.test(x.k||"")){const L=cbCredNota(),d=L&&L.find(o=>o.cod===x.k.slice(3));return d&&d.dif!=null?{n:d.est?5:d.nota,o:d,cred:true}:null}
  return null}
function cdCalc(c,it,R){
  const {w,tot}=spPesos(c,it),P={},A=[],add=(pr,tit,det)=>A.push({pr,tit,det}),nm=x=>esc(String(spItemNome(x)).slice(0,44));
  const pos=it.map((x,i)=>({x,w:w[i]})).filter(o=>o.w>0.001);if(!pos.length)return null;
  // 1) diversificação
  {const hhi=pos.reduce((a,o)=>a+o.w*o.w,0),nef=1/hhi,mx=pos.slice().sort((a,b)=>b.w-a.w)[0],cls=new Set(pos.map(o=>spCl(o.x))).size;
    const arr=o=>!(spTd(o.x)||spCl(o.x)==="pos");const mxr=pos.filter(arr).sort((a,b)=>b.w-a.w)[0];
    P.div=Math.round(Math.min(100,nef/8*100)*0.5+(mxr&&mxr.w>0.2?Math.max(0,100-(mxr.w*100-20)*4):100)*0.3+Math.min(100,cls/4*100)*0.2);
    if(mxr&&mxr.w>0.25)add(mxr.w>0.4?1:2,'Reduzir a concentração em '+nm(mxr.x),'pesa '+fx(mxr.w*100,0)+'% da carteira; acima de 25% num único item de risco, um problema nele vira um problema da carteira');
    if(cls<3&&pos.length>=3)add(2,'Diversificar entre classes','a carteira está em só '+cls+' classe'+(cls>1?'s':'')+' de ativo');
    P._nef=nef}
  // 2) risco × perfil
  let st={};try{if(R&&R.rets&&R.rets.length)st=spStats(R,R.rets,R.pts[R.pts.length-1].idx)}catch(e){}
  {const pf=SP_SUIT[spPol(c).perfil]||SP_SUIT.moderado;if(st.vol!=null){const rv=st.vol/pf.vol,rd=st.dd!=null?Math.abs(st.dd)/Math.abs(pf.dd):rv,r=Math.max(rv,rd);
      P.risco=Math.round(r<=1?100:Math.max(0,100-(r-1)*120));
      if(rv>1.1)add(rv>1.5?1:2,'Risco acima do perfil '+spPol(c).perfil,'volatilidade de '+fx(st.vol,1)+'% ao ano, contra a referência de '+fx(pf.vol,0)+'%: reduza ações, FIIs ou prazos longos, ou revise o perfil com o cliente');
      else if(rv<0.35&&spPol(c).perfil!=="conservador")add(3,'Risco bem abaixo do perfil','volatilidade de '+fx(st.vol,1)+'% para um perfil '+spPol(c).perfil+' (referência '+fx(pf.vol,0)+'%): há espaço para buscar mais retorno, se for o objetivo')}}
  // 3) qualidade
  {let s=0,cw=0;pos.forEach(o=>{const n=cdItemNota(o.x);if(!n)return;s+=n.n*o.w;cw+=o.w;
      if(n.cred&&n.o.est)add(1,'Crédito em estresse: '+esc(n.o.cod),'o mercado cobra '+fx(n.o.dif,1)+' p.p. acima de papéis parecidos, sinal de risco alto de calote; reavalie a posição ('+fx(o.w*100,1)+'% da carteira)');
      else if(n.cred&&n.o.dif<-0.5)add(3,'Crédito mal remunerado: '+esc(n.o.cod),'paga '+fx(-n.o.dif,2)+' p.p. abaixo de papéis parecidos');
      else if(!n.cred&&n.n<=30){let sub="";if(o.x.t==="f"){try{const S=spSubs(o.x);if(S&&S.L.length)sub='; alternativa na mesma categoria: '+esc(String(S.L[0].r?S.L[0].r[1]:S.L[0][1]||"")).slice(0,40)}catch(e){}}
        add(o.w>0.1?1:2,'Revisar '+nm(o.x),'Nota WF '+n.n+' de 100'+(o.x.t==="a"?' ('+CB_PIL.filter(([k])=>n.o.P[k]!=null&&n.o.P[k]<30).map(([,l])=>l.toLowerCase()).join(', ')+' fracos)':' entre '+n.o.np+' fundos da categoria')+sub)}});
    if(cw>=0.2)P.qual=Math.round(s/cw);P._cob=cw}
  // 4) liquidez
  {let l5=0;pos.forEach(o=>{let d=30;try{d=spLiqDias(o.x,o.w*tot)}catch(e){}if(d<=5)l5+=o.w});P.liq=Math.round(Math.min(100,l5/0.3*100));P._l5=l5;
    if(l5<0.1)add(2,'Criar reserva de liquidez','só '+fx(l5*100,0)+'% da carteira vira dinheiro em até 5 dias úteis; uma emergência obrigaria a vender com perda')}
  // 5) crédito e FGC
  try{const C=spCredito(c,it);let s=100;if(C.acima>0){s-=Math.min(60,C.acima/Math.max(1,C.tot)*400);C.L.filter(g=>g.acima>0).forEach(g=>add(1,'Acima do FGC em '+esc(g.em).slice(0,36),brl(g.acima)+' sem cobertura: o FGC garante R$ 250 mil por CPF e por conglomerado'))}
    const g0=C.L.find(g=>g.cred>0&&g.pc>SP_EMIS_LIM);if(g0){s-=Math.min(40,(g0.pc-SP_EMIS_LIM)*3);add(g0.pc>20?1:2,'Concentração de crédito em '+esc(g0.em).slice(0,36),fx(g0.pc,1)+'% da carteira num emissor sem FGC (referência: até '+SP_EMIS_LIM+'%)')}
    if(C.L.length)P.cred=Math.round(Math.max(0,s));
    if(typeof bkAcha==="function"&&typeof BK==="object"&&BK.d)C.L.forEach(g=>{const b=bkAcha(g.em);if(!b)return;const k=bkSaudeCalc(b);if(k.nivel===3)add(1,'Banco frágil: '+esc(g.em).slice(0,36),'indicadores do Banco Central em nível frágil'+(k.al.length?' ('+esc(k.al[0])+')':'')+'; '+fx(g.pc,1)+'% da carteira')})}catch(e){}
  // 6) aderência ao cenário (mapa tático)
  let Mp=null;try{if(cbPronto())Mp=cbMapa(cbPremios()||[],cbExterno())}catch(e){}
  if(Mp){const cls=new Map();pos.forEach(o=>{const k=CB_CLMAP[spCl(o.x)];if(k)cls.set(k,(cls.get(k)||0)+o.w)});let s=70;
    Mp.C.forEach(m=>{const p=cls.get(m.k)||0;if(m.t>0){if(p<0.05){s-=15;add(3,'Avaliar posição em '+m.n,'o mapa tático vê a classe acima do peso e a carteira tem '+(p?fx(p*100,1)+'%':'zero')+'. Motivo: '+m.s.filter(x=>x[0]>0).map(x=>x[1]).join('; '))}else s+=10}
      else if(m.t<0){if(p>=0.15){s-=15;add(3,'Avaliar redução em '+m.n,'o mapa tático vê a classe abaixo do peso e a carteira tem '+fx(p*100,1)+'%')}else s+=10}});
    P.cen=Math.max(0,Math.min(100,Math.round(s)))}
  const v=CD_PIL.map(([k])=>P[k]).filter(x=>x!=null),nota=v.length?Math.round(v.reduce((a,x)=>a+x,0)/v.length):null;
  A.sort((a,b)=>a.pr-b.pr);
  return {P,A,nota,st,Mp,pos,itens:Object.fromEntries(pos.map(o=>{const n=cdItemNota(o.x);return [o.x.k,n?n.n:null]}))}}
function cdMudou(c,D){ // compara com a leitura anterior desta carteira
  const key=(c.criada||"")+"|"+(c.nome||""),M=cdMem(),m=M[key]||{},ref=cdDataRef(),L=[];
  const snap={d:ref,nota:D.nota,P:D.P,it:D.itens,reg:D.Mp&&D.Mp.reg?D.Mp.reg.r[1]:null,tl:D.Mp?Object.fromEntries(D.Mp.C.map(x=>[x.k,x.t])):null};
  if(!m.cur||m.cur.d!==ref){if(m.cur)m.prev=m.cur;m.cur=snap;M[key]=m;cdMemSet(M)}else{m.cur=snap;M[key]=m;cdMemSet(M)}
  const a=m.prev;if(!a)return {L,desde:null};
  if(a.nota!=null&&D.nota!=null&&Math.abs(D.nota-a.nota)>=3)L.push('Nota da carteira: de '+a.nota+' para <b>'+D.nota+'</b>');
  CD_PIL.forEach(([k,n])=>{if(a.P&&a.P[k]!=null&&D.P[k]!=null&&Math.abs(D.P[k]-a.P[k])>=10)L.push(n+': de '+a.P[k]+' para <b>'+D.P[k]+'</b>')});
  if(a.reg&&snap.reg&&a.reg!==snap.reg)L.push('Termômetro de mercado: de '+a.reg.toLowerCase()+' para <b>'+snap.reg.toLowerCase()+'</b>');
  if(a.tl&&snap.tl&&D.Mp)D.Mp.C.forEach(x=>{const o=a.tl[x.k];if(o!=null&&o!==x.t)L.push('Mapa tático de '+x.n+': de '+(o>0?'acima':o<0?'abaixo':'neutro')+' para <b>'+(x.t>0?'acima do peso':x.t<0?'abaixo do peso':'neutro')+'</b>')});
  D.pos.forEach(o=>{const o0=a.it&&a.it[o.x.k],n=D.itens[o.x.k];if(o0!=null&&n!=null&&Math.abs(n-o0)>=10)L.push(esc(String(spItemNome(o.x)).slice(0,36))+': nota de '+o0+' para <b class="'+(n>o0?'pos':'neg')+'">'+n+'</b>')});
  return {L,desde:a.d}}
function spDiagHtml(c,it,R){
  if(!it||!it.length)return "";cbCarrega();if(!cbPronto())return '<section class="panel"><h3>Consultor WF</h3><p class="sub">Juntando os dados de mercado para avaliar a carteira…</p></section>';
  let D=null;try{D=cdCalc(c,it,R)}catch(e){console.error(e);return ""}if(!D||D.nota==null)return "";
  const cor=cbNotaCor(D.nota),leit=D.nota>=75?'carteira bem construída':D.nota>=55?'carteira razoável, com pontos a ajustar':'carteira com problemas relevantes',mu=cdMudou(c,D);
  const barra=(n,v)=>'<div style="display:grid;grid-template-columns:minmax(120px,170px) 1fr 34px;gap:8px;align-items:center;margin:5px 0"><span style="font-size:.88rem">'+n+'</span><span style="height:8px;border-radius:99px;background:var(--line);overflow:hidden"><i style="display:block;height:100%;width:'+(v==null?0:v)+'%;background:'+(v==null?'var(--line)':cbNotaCor(v))+'"></i></span><b style="text-align:right;font-size:.88rem">'+(v==null?'—':v)+'</b></div>';
  const P1=D.A.filter(a=>a.pr===1),PR=["","Agir agora","Ajustar","Avaliar"],PC=["","var(--loss)","var(--warn)","var(--accent)"];
  let h='<section class="panel" data-reltit="Consultor WF"><h3>Consultor WF</h3><div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;margin:4px 0 8px"><div style="text-align:center;min-width:96px"><b style="font-size:2.4rem;line-height:1;color:'+cor+'">'+D.nota+'</b><small style="display:block;color:var(--muted)">de 100</small></div>'
    +'<div style="flex:1;min-width:240px"><p style="margin:0 0 4px"><b>'+leit.charAt(0).toUpperCase()+leit.slice(1)+'.</b> '+(D.A.length?(P1.length?P1.length+' ponto'+(P1.length>1?'s pedem':' pede')+' ação imediata':'Nenhum ponto urgente')+'; '+D.A.length+' no total.':'Nenhum ajuste a sugerir com os dados de hoje.')+'</p>'+CD_PIL.map(([k,n])=>barra(n,D.P[k])).join("")+'</div></div>';
  if(D.A.length)h+='<div class="label" style="margin-top:6px">Plano de ação</div><ol style="margin:6px 0 0;padding-left:20px;line-height:1.5">'+D.A.slice(0,10).map(a=>'<li style="margin:6px 0"><b style="color:'+PC[a.pr]+'">'+PR[a.pr]+':</b> <b>'+a.tit+'.</b> <span class="sub">'+a.det.charAt(0).toUpperCase()+a.det.slice(1)+'.</span></li>').join("")+'</ol>';
  {let S=[];try{S=cdSentinela(c,it)}catch(e){}if(S.length)h+='<div class="label" style="margin-top:12px">Sentinela: o que mudou nos ativos e no cenário</div><ul style="margin:4px 0 0;padding-left:4px;list-style:none;line-height:1.45">'+S.slice(0,10).map(a=>'<li style="margin:5px 0"><b style="color:'+PC[a.nv]+'">●</b> <b>'+a.tit+'.</b> <span class="sub">'+a.det.charAt(0).toUpperCase()+a.det.slice(1)+'.</span></li>').join("")+'</ul>'}
  if(mu.desde)h+='<div class="label" style="margin-top:12px">O que mudou desde '+fdate(Date.parse(mu.desde+"T00:00:00Z"))+'</div>'+(mu.L.length?'<ul style="margin:4px 0 0;padding-left:18px">'+mu.L.map(x=>'<li>'+x+'</li>').join("")+'</ul>':'<p class="sub" style="margin:4px 0 0">Nada relevante mudou na avaliação desta carteira.</p>');
  h+='<p class="sub" style="font-size:.8rem;margin-top:10px">Nota = média dos pilares disponíveis. Diversificação: número efetivo de itens ('+fx(D.P._nef,1)+'), maior posição de risco e classes. Risco: volatilidade e perda máxima contra a referência do perfil. Qualidade: Nota WF dos itens, ponderada pelo peso ('+fx((D.P._cob||0)*100,0)+'% da carteira tem nota). Liquidez: '+fx(D.P._l5*100,0)+'% em até 5 dias úteis (30% = nota cheia). Crédito: FGC e concentração por emissor. Cenário: mapa tático da <button type="button" class="link" data-mkgo="vw">Visão WF</button>. A comparação "o que mudou" fica guardada só neste aparelho. Apoio à decisão: confirme sempre com a política e o perfil do cliente.</p></section>';
  return h}
function cdRadarHtml(){ // carteiras com pontos que pedem ação, no topo do Radar
  if(!(SP.carts||[]).length||!cbPronto())return "";const L=[];
  SP.carts.forEach((c,ci)=>{const it=(c.itens||[]).filter(x=>(+x.w||0)>0);if(!it.length)return;let D=null;try{D=cdCalc(c,it,null)}catch(e){}if(!D||D.nota==null)return;
    let S=[];try{S=cdSentinela(c,it)}catch(e){}L.push({ci,nm:c.nome||("Carteira "+(ci+1)),D,u:D.A.filter(a=>a.pr===1).concat(S.filter(a=>a.nv===1))})});
  if(!L.length)return "";L.sort((a,b)=>b.u.length-a.u.length||a.D.nota-b.D.nota);
  return '<h3>Suas carteiras pelo Consultor WF</h3><div class="tablewrap" style="max-height:none"><table class="ctab" data-ordok="1"><thead><tr><th style="text-align:left">Carteira</th><th>Nota</th><th style="text-align:left">O que pede ação</th></tr></thead><tbody>'
    +L.slice(0,8).map(x=>'<tr><td style="text-align:left"><button type="button" class="link" data-rdcart="'+x.ci+'">'+esc(x.nm)+'</button></td><td><b style="color:'+cbNotaCor(x.D.nota)+'">'+x.D.nota+'</b></td><td style="text-align:left"><small>'+(x.u.length?x.u.slice(0,3).map(a=>a.tit).join('; '):(x.D.A.length?x.D.A.length+' ajuste(s) sem urgência':'nada urgente'))+'</small></td></tr>').join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem;margin-top:6px">Nota sem o pilar de risco (que precisa da simulação): abra a carteira para a avaliação completa e o plano de ação.</p>'}
/* ---- sentinela: mudanças nos emissores e títulos da carteira que podem afetá-la */
function cdSentinela(c,it){
  const L=[],add=(nv,tit,det)=>L.push({nv,tit,det}),{w}=spPesos(c,it),C=AT.C;
  if(typeof SP_TXH!=="object"||!SP_TXH){SP_TXH="carregando";roboGet("taxas_hist.json").then(j=>{SP_TXH=j||{};if(activeMod==="sp")spCalc()}).catch(()=>{SP_TXH={}})}
  it.forEach((x,i)=>{if(!(w[i]>0.001))return;const nm=esc(String(spItemNome(x)).slice(0,40));
    // crédito: a taxa exigida pelo mercado subiu (o emissor ficou mais arriscado aos olhos do mercado)
    if(/^cr:/.test(x.k||"")&&SP_TXH&&typeof SP_TXH==="object"){const H=SP_TXH[x.k.slice(3)];if(H&&H.length>=5){const a=H[0],b=H[H.length-1],d=b[1]-a[1];
      if(d>=0.5)add(d>=1.5?1:2,nm+': o mercado passou a exigir mais','taxa indicativa subiu '+fx(d,2)+' p.p. desde '+fdate(Date.parse(a[0]+"T00:00:00Z"))+' ('+fx(a[1],2)+'% → '+fx(b[1],2)+'%): o papel perdeu valor e o emissor é visto como mais arriscado');
      else if(d<=-0.5)add(3,nm+': taxa caiu '+fx(-d,2)+' p.p.','o papel ganhou valor desde '+fdate(Date.parse(a[0]+"T00:00:00Z"))+'; se a tese se cumpriu, pode ser hora de realizar')}}
    // ações: semana fora do padrão, mínima de 52 semanas, cruzamento de baixa
    if(x.t==="a"&&AT.idx){const r=atRow(x.k);if(r){const v=r[C.v12],r5=r[C.r5],z=v>0&&r5!=null?r5/(v/Math.sqrt(52)):null;
      if(z!=null&&z<=-2.5)add(1,nm+': queda fora do padrão na semana','−'+fx(-r5,1)+'%, '+fx(-z,1)+' vezes o movimento normal da ação: costuma haver notícia por trás; confira fatos relevantes');
      else if(z!=null&&z>=2.5)add(3,nm+': alta fora do padrão na semana','+'+fx(r5,1)+'%, '+fx(z,1)+' vezes o normal');
      if(r[C.min52d]!=null&&r[C.min52d]<=1)add(2,nm+': na mínima de 52 semanas','a ação está no menor preço do último ano');
      if(r[C.cruz]===-1)add(2,nm+': média de 50 dias cruzou para baixo a de 200','sinal técnico de piora da tendência')}}
    // fundos: resgates fortes ou queda relevante
    if(x.t==="f"&&typeof FN==="object"&&FN.idx){const r=fnRow(x.k),FC=FN.C;if(r){const cap=r[FC.pl]>0&&r[FC.capt12]!=null?r[FC.capt12]/r[FC.pl]*100:null;
      if(cap!=null&&cap<=-40)add(2,nm+': resgates fortes','saíram '+fx(-cap,0)+'% do patrimônio em 12 meses: fundo encolhendo pode ter de vender ativos em hora ruim');
      if(r[FC.rm]!=null&&r[FC.v12]>0&&r[FC.rm]<-2*r[FC.v12]/Math.sqrt(12))add(2,nm+': mês muito abaixo do normal','rendeu '+fx(r[FC.rm],2)+'% no mês, bem abaixo da oscilação típica do fundo')}}});
  // cenário: classes da carteira contra o mapa e o termômetro
  try{const B=tmBase();if(B){const hj=tmSinais(B,B.M.length-1),rg=tmReg(hj.s),acoes=it.reduce((a,x,i)=>a+(["acoes","imob"].includes(spCl(x))?w[i]:0),0);if(rg===TM_REG[2]&&acoes>=0.25)add(3,'Cenário defensivo com '+fx(acoes*100,0)+'% em renda variável','o termômetro está defensivo; historicamente a Bolsa não piorou depois dessas leituras, mas a oscilação aumenta: confirme o horizonte do cliente')}}catch(e){}
  return L.filter((a,i)=>L.findIndex(b=>b.tit===a.tit)===i).sort((a,b)=>a.nv-b.nv)}
