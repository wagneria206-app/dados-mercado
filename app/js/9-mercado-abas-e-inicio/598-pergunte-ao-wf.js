/* ---------- Pergunte ao WF: caixa de perguntas em português, respondida pelo cérebro. Não usa modelo de linguagem:
   reconhece o assunto por palavras-chave (e códigos de ações, fundos e debêntures) e monta a resposta com os números
   e as conclusões que o app já calculou. Quando não entende, mostra o que sabe responder. */
const PG={q:"",h:""};
const PG_EX=["IPCA+ ou prefixado?","Vale a pena entrar na Bolsa agora?","Como está a PETR4?","O que fazer com a minha carteira?","Como o exterior afeta o Brasil hoje?","Quais as melhores ações?","Onde o crédito paga melhor?","O dólar está caro?"];
function pgResp(q){
  const n=fnNorm(q),Pr=cbPremios()||[],X=cbExterno(),Mp=cbMapa(Pr,X),g=k=>Pr.find(x=>x.k===k),m=k=>Mp.C.find(x=>x.k===k),R=[];
  const leit=c=>c?(c.t>0?'<b class="pos">acima do peso</b>':c.t<0?'<b class="neg">abaixo do peso</b>':'<b>neutro</b>'):'',mot=c=>c&&c.s.length?' Motivos: '+c.s.map(x=>x[1]).join('; ')+'.':'';
  const ir=(mod,txt)=>' <button type="button" class="link" data-mkgo="'+mod+'">'+txt+'</button>';
  // código de ação
  const tk=(q.toUpperCase().match(/\b[A-Z]{4}\d{1,2}\b/g)||[]).filter(t=>AT.idx&&atRow(t));
  if(tk.length){tk.slice(0,2).forEach(t=>{const p=prAcao(t),r=atRow(t),C=AT.C;if(p)R.push('<b>'+t+'</b> ('+esc(r[1])+'): Nota WF <b style="color:'+cbNotaCor(p.n.nota)+'">'+p.n.nota+'/100</b>. '+p.ver+(p.F.length?' A favor: '+p.F.slice(0,3).join('; ')+'.':'')+(p.X.length?' Contra: '+p.X.slice(0,3).join('; ')+'.':'')+' <button type="button" class="link" data-atopen="'+t+'">Abrir a análise completa</button>');
      else R.push('<b>'+t+'</b>: cotação de '+brl(r[C.preco])+', '+(r[C.r12]!=null?fx(r[C.r12],1)+'% em 12 meses':'sem histórico de 12 meses')+'. Sem Nota WF (só ações e units com liquidez acima de R$ 2 milhões por dia). <button type="button" class="link" data-atopen="'+t+'">Abrir a página</button>')});return R}
  const tem=(...w)=>w.some(x=>n.includes(x));
  if(tem("carteira","rebalanc","meu portfolio","minha posicao","o que fazer")){const c=SP.carts&&SP.carts[SP.cur],it=c?(c.itens||[]).filter(x=>(+x.w||0)>0):[];
    if(!it.length)return ['Você ainda não tem uma carteira montada. Crie uma em Carteiras e Simulações e eu avalio diversificação, risco, liquidez, crédito e aderência ao cenário.'+ir("sp","Abrir a carteira")];
    const D=cdCalc(c,it,null);if(D)R.push('A carteira <b>'+esc(c.nome||"atual")+'</b> tem nota <b style="color:'+cbNotaCor(D.nota)+'">'+D.nota+'/100</b> (sem o pilar de risco, que depende da simulação). '+(D.A.length?'Prioridades: '+D.A.slice(0,4).map((a,i)=>(i+1)+') '+a.tit).join('; ')+'.':'Nenhum ajuste a sugerir com os dados de hoje.')+ir("sp","Ver o plano de ação completo"));
    try{const S=cdSentinela(c,it);if(S.length)R.push('Sentinela: '+S.slice(0,3).map(a=>a.tit).join('; ')+'.')}catch(e){}return R}
  if(tem("ipca+","ipca +","prefixad"," pre ","ntn","tesouro")||(tem("ipca")&&tem(" ou "))){const a=g("ipca"),b=g("pre");
    if(a)R.push('O <b>IPCA+</b> de 5 anos paga <b>'+fx(a.v,2)+'% acima da inflação</b>'+(a.p!=null?', mais que em '+fx(a.p,0)+'% dos meses desde 2010':'')+'. Mapa tático: '+leit(m("ipca"))+'.');
    if(b)R.push('O <b>prefixado</b> embute inflação de <b>'+fx(b.v,2)+'% ao ano</b>'+(b.p!=null?' (percentil '+fx(b.p,0)+')':'')+'. Se o IPCA médio ficar abaixo disso, o prefixado ganha; se ficar acima, o IPCA+ ganha. Mapa tático: '+leit(m("pre"))+'.');
    try{const fo=crFocusMedio(5,(()=>{const d=new Date(VAL);return [d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()]})());if(fo!=null&&b)R.push('O Focus espera IPCA médio de <b>'+fx(fo,2)+'%</b> em 5 anos, '+fx(b.v-fo,2)+' p.p. '+(b.v>fo?'abaixo':'acima')+' do que o prefixado embute. '+(b.v>fo+1?'Quem confia no Focus tende ao prefixado; quem quer se proteger de surpresas na inflação, ao IPCA+. Dividir entre os dois é a escolha de quem não quer apostar.':'Os dois estão próximos do empate.')+ir("ju","Ver carrego, rolagem e o quadro completo"))}catch(e){}
    return R}
  if(tem("bolsa","acoes","acao","ibovespa","renda variavel")&&!tem("melhor","top","ranking")){const a=g("acoes"),c=m("acoes");
    if(a)R.push('O lucro das empresas equivale a <b>'+fx(a.ey,1)+'%</b> do preço (P/L mediano de '+fx(100/a.ey,1)+'), '+a.fmt+' acima do juro real: '+a.txt.toLowerCase()+(a.p!=null?' (percentil '+fx(a.p,0)+' desde 2010)':'')+'.');
    if(Mp.reg)R.push('O termômetro está <b>'+Mp.reg.r[1].toLowerCase()+'</b>. Mapa tático para ações: '+leit(c)+'.'+mot(c));
    try{const L=fpBase(),C=AT.C;if(L)R.push('Amplitude: '+fx(L.filter(r=>r[C.mm200d]>0).length/L.length*100,0)+'% das ações líquidas estão acima da média de 200 dias.'+ir("rd","Ver o mercado fora do padrão"))}catch(e){}
    const po=g("pos");if(po)R.push('Lembre do concorrente: o CDI paga '+fx(po.v,2)+'% de juro real sem risco de mercado. Bolsa só compensa para prazos longos e dentro do perfil.');return R}
  if(tem("melhor","top","ranking","quais acoes","indica")&&!tem("credito","debenture","cri","cra","spread","fii","imobiliario")){if(tem("fundo")){const N=cbFnNota();if(N)return ['Os fundos com melhor Nota WF em cada categoria estão na Visão WF, contra os pares da mesma categoria ANBIMA.'+ir("vw","Ver a lista")]}
    const N=cbNota();if(N){const L=[...N.values()].sort((a,b)=>b.nota-a.nota).slice(0,8);R.push('Maiores Notas WF hoje: '+L.map(x=>'<button type="button" class="link" data-atopen="'+x.t+'">'+x.t+'</button> ('+x.nota+')').join(', ')+'. A nota junta valor, qualidade, momento, risco e dividendos; não é recomendação de compra.'+ir("vw","Ver as 25 primeiras"))}return R}
  if(tem("credito","debenture","cri","cra","spread")){const a=g("cred"),L=cbCredNota();if(a)R.push('O spread mediano das debêntures IPCA+ comuns é de <b>'+a.fmt+'</b>: '+a.txt+'. Mapa tático: '+leit(m("cred"))+'.');
    if(L){const t=L.filter(x=>x.dif>0.3&&!x.est&&x.dur>=0.75).slice(0,5),es=L.filter(x=>x.est).length;if(t.length)R.push('Papéis que pagam acima do seu grupo: '+t.map(x=>'<button type="button" class="link" data-crcalc="'+esc(x.cod)+'">'+esc(x.cod)+'</button> (+'+fx(x.dif,2)+' p.p.)').join(', ')+'.'+(es?' Há '+es+' papéis com spread de estresse, que ficam fora da lista.':'')+ir("cr","Ver a curva de crédito"))}return R}
  if(tem("dolar","cambio","exterior","eua","fed","estados unidos","la fora","internacional","vix","petroleo")){const a=g("usd");
    if(X)R.push('Lá fora, o placar é <b>'+(X.sc>0?'+':'')+X.sc+'</b> ('+X.lado[0]+'): '+X.S.filter(x=>x.sc!==0).map(x=>x.n.replace(/ \(.*\)/,'')+' '+(x.sc>0?'ajuda':'pesa')).join('; ')+'.');
    if(a)R.push('Dólar a '+a.fmt.replace(' hoje','')+': '+a.txt+' (percentil '+fx(a.p,0)+' do câmbio real desde 2010). Mapa tático: '+leit(m("usd"))+'.');
    if(tem("dolar","cambio")&&R.length>1)R.reverse();
    if(X&&X.cen.length)R.push('Sensibilidade: '+X.cen.slice(0,3).map(c=>c.n.toLowerCase()+' → '+c.alvo+' '+c.ef.replace(/<[^>]+>/g,'')).join('; ')+'.'+ir("vw","Ver o cenário externo completo"));return R}
  if(tem("fii","fundo imobiliario","imobiliario")){const a=g("fii");if(a)R.push('Nos FIIs: '+a.sub+'. '+a.txt.charAt(0).toUpperCase()+a.txt.slice(1)+'. Mapa tático: '+leit(m("fii"))+'.'+mot(m("fii"))+ir("af","Ver o panorama dos FIIs"));return R}
  if(tem("juro","selic","copom","cdi","pos-fixad","pos fixad","renda fixa")){const a=g("pos");if(a)R.push('O CDI paga <b>'+fx(a.v,2)+'% acima da inflação esperada</b>'+(a.p!=null?' (percentil '+fx(a.p,0)+')':'')+': '+a.txt+'. Mapa tático: '+leit(m("pos"))+'.'+mot(m("pos")));
    const b=g("ipca");if(b)R.push('Para prazos longos, o juro real de 5 anos está em '+fx(b.v,2)+'%.'+ir("ju","Ver juros, Copom e a curva"));return R}
  if(tem("inflacao","ipca")){const b=g("pre");if(b)R.push('O mercado embute inflação de <b>'+fx(b.v,2)+'% ao ano</b> em 5 anos nos títulos públicos'+(b.p!=null?', mais que em '+fx(b.p,0)+'% dos meses desde 2010':'')+'.'+ir("in","Ver a inflação em detalhe"));return R}
  if(tem("fundo")){return ['Para avaliar um fundo, abra a página dele em Fundos: o Parecer WF compara retorno, risco, captação e custo com os pares.'+ir("fa","Buscar um fundo")+ir("vw","Fundos com melhor nota")]}
  if(tem("cenario","mercado","momento","resumo","hoje","como esta")){return cbBriefing(Pr,Mp,X).slice(0,5)}
  return null}
function pgHtml(){
  return '<h3>Pergunte ao WF</h3><p class="sub">Escreva uma pergunta ou um código de ação. As respostas saem dos dados e das conclusões do próprio app.</p>'
    +'<form id="pgForm" style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><input id="pgQ" autocomplete="off" placeholder="Ex.: IPCA+ ou prefixado? Como está a VALE3?" value="'+esc(PG.q)+'" style="flex:1;min-width:220px"><button type="submit" class="btn">Perguntar</button></form>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap">'+PG_EX.map(x=>'<button type="button" class="btn sec" style="font-size:.82rem;padding:5px 10px" data-pgex="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div><div id="pgOut" aria-live="polite" style="margin-top:10px">'+PG.h+'</div>'}
function pgRun(q){PG.q=q;let R=null;try{R=cbPronto()?pgResp(q):["Ainda estou carregando os dados de mercado. Tente de novo em alguns segundos."]}catch(e){console.error(e);R=["Não consegui montar essa resposta agora."]}
  PG.h=R&&R.length?'<div style="border-left:3px solid var(--accent);padding:2px 0 2px 12px">'+R.map(x=>'<p style="margin:6px 0;line-height:1.5">'+x+'</p>').join("")+'<p class="sub" style="font-size:.78rem;margin:8px 0 0">Resposta montada por regras sobre os dados de '+fdate(VAL)+'. Apoio à decisão, não recomendação.</p></div>':'<p class="sub">Não entendi a pergunta. Sei responder sobre: uma ação pelo código (ex.: ITUB4), IPCA+ ou prefixado, Bolsa, crédito privado, FIIs, juros e CDI, inflação, dólar e cenário externo, melhores ações e fundos, e a sua carteira.</p>';
  const o=$("pgOut");if(o)o.innerHTML=PG.h;const i=$("pgQ");if(i&&i.value!==q)i.value=q}
document.addEventListener("submit",e=>{if(e.target&&e.target.id==="pgForm"){e.preventDefault();const q=$("pgQ").value.trim();if(q)pgRun(q)}});
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-pgex]");if(x)pgRun(x.dataset.pgex)});
