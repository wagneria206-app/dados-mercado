/* ---------- Diário de decisões (tese de cada compra ou venda e o resultado desde então) e Planejamento financeiro
   (simulação de Monte Carlo de acumulação e renda na aposentadoria). Tudo fica só neste aparelho. */
const DJ={L:[]};
try{const a=JSON.parse(localStorage.getItem("diario")||"[]");if(Array.isArray(a))DJ.L=a}catch(e){}
function djSave(){try{localStorage.setItem("diario",JSON.stringify(DJ.L))}catch(e){alertLite("Não deu para salvar o diário neste navegador.")}}
function djPreco(k){if(!AT.idx)return null;const r=atRow(k);return r?r[AT.C.preco]:null}
function djIbov(d){const P=EU.S&&EU.S.ibov;if(!P)return null;const a=euAt(P,Date.parse(d+"T00:00:00Z"));return a?a[1]:null}
function djTela(){
  const o=$("fnOut");if(!o)return;if(!AT.idx&&!AT.err)atBoot();if(!EU.S)euBoot();
  if(FN.view!=="dj"){FN.view="dj";o.innerHTML='<section class="panel"><h3>Diário de decisões</h3><p class="sub">Anote por que comprou, vendeu ou está observando um ativo, com preço-alvo e data para revisar. O app acompanha o resultado desde a anotação e compara com o Ibovespa. As anotações ficam só neste aparelho.</p><form id="djF" class="fnfilt" autocomplete="off" style="margin-top:8px">'
    +'<div class="field"><label for="djK">Código do ativo</label><input id="djK" placeholder="ex.: PETR4" maxlength="12" required></div>'
    +'<div class="field"><label for="djA">Decisão</label><select id="djA"><option value="compra">Compra</option><option value="venda">Venda</option><option value="observar">Observar</option></select></div>'
    +'<div class="field"><label for="djAlvo">Preço-alvo (opcional)</label><input id="djAlvo" inputmode="decimal"></div>'
    +'<div class="field"><label for="djRev">Revisar em (opcional)</label><input id="djRev" type="date"></div>'
    +'<div class="field" style="grid-column:1/-1"><label for="djT">Tese: por que tomou essa decisão?</label><textarea id="djT" rows="3" maxlength="1500" placeholder="o que precisa acontecer para a decisão estar certa, e o que faria você mudar de ideia"></textarea></div>'
    +'<div><button type="submit" class="btn">Anotar</button></div></form></section><section class="panel" id="djL"></section>'}
  djLista();
}
function djLista(){
  const b=$("djL");if(!b)return;
  if(!DJ.L.length){b.innerHTML='<p class="sub">Nenhuma anotação ainda. Comece pela decisão mais recente: escrever a tese ajuda a não mudar de ideia por impulso.</p>';return}
  const hj=new Date().toISOString().slice(0,10);
  const L=DJ.L.slice().sort((a,b)=>a.d<b.d?1:-1).map(x=>{const p=djPreco(x.k),r=p&&x.p0?(p/x.p0-1)*100:null,i0=djIbov(x.d),i1=EU.S&&EU.S.ibov?EU.S.ibov[EU.S.ibov.length-1][1]:null,ri=i0&&i1?(i1/i0-1)*100:null;
    const certo=r==null?null:x.a==="compra"?r>(ri||0):x.a==="venda"?r<(ri||0):null;const alvo=x.alvo&&p?(x.a==="venda"?p<=x.alvo:p>=x.alvo):false;
    return Object.assign({},x,{p,r,ri,certo,alvo,rev:x.rev&&x.rev<=hj})});
  const dec=L.filter(x=>x.certo!=null),acertos=dec.filter(x=>x.certo).length;
  let h='<h3>Anotações</h3>'+(dec.length?'<div class="fnkpis">'+tecKp("Decisões acompanhadas",fx(dec.length,0),'compras e vendas com preço')+tecKp("Melhores que o Ibovespa",fx(acertos/dec.length*100,0)+'%',acertos+' de '+dec.length+' (venda: acerta se o ativo foi pior que o índice)')+tecKp("Para revisar",fx(L.filter(x=>x.rev).length,0),'data de revisão chegou')+tecKp("Alvo atingido",fx(L.filter(x=>x.alvo).length,0),'preço-alvo alcançado')+'</div>':'');
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Data</th><th style="text-align:left">Ativo</th><th>Decisão</th><th>Preço na data</th><th>Agora</th><th>Desde então</th><th class="c-ph">Ibovespa</th><th></th></tr></thead><tbody>'
    +L.map(x=>'<tr><td style="text-align:left">'+fdate(Date.parse(x.d+"T00:00:00Z"))+'</td><td style="text-align:left"><button type="button" class="link" data-atopen="'+esc(x.k)+'">'+esc(x.k)+'</button>'+(x.rev?' <span class="tag est">revisar</span>':'')+(x.alvo?' <span class="tag">alvo atingido</span>':'')+'<small style="display:block;color:var(--muted);white-space:normal;max-width:420px">'+esc(x.t||"")+(x.alvo0?' · alvo R$ '+fx(x.alvo0,2):'')+'</small></td><td>'+{compra:"Compra",venda:"Venda",observar:"Observar"}[x.a]+'</td><td>'+(x.p0?'R$ '+fx(x.p0,2):'—')+'</td><td>'+(x.p?'R$ '+fx(x.p,2):'—')+'</td><td><span class="'+(x.certo===true?'pos':x.certo===false?'neg':'')+'">'+(x.r!=null?(x.r>=0?'+':'')+fx(x.r,1)+'%':'—')+'</span></td><td class="c-ph">'+(x.ri!=null?(x.ri>=0?'+':'')+fx(x.ri,1)+'%':'—')+'</td><td><button type="button" class="link" data-djdel="'+x.id+'" aria-label="Apagar anotação">apagar</button></td></tr>').join("")+'</tbody></table></div>'
    +'<p class="sub" style="font-size:.8rem">Preços de fechamento da B3 (sem proventos). As anotações ficam só no navegador deste aparelho.</p>';
  b.innerHTML=h;
}
document.addEventListener("submit",e=>{if(!e.target||e.target.id!=="djF")return;e.preventDefault();
  const k=($("djK").value||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");if(!k)return;const p=djPreco(k);
  if(AT.idx&&!atRow(k)){alertLite("Não encontrei "+k+" entre os ativos da B3.");return}
  DJ.L.push({id:Date.now().toString(36),d:new Date().toISOString().slice(0,10),k,a:$("djA").value,p0:p,t:($("djT").value||"").slice(0,1500),alvo0:num($("djAlvo").value)||null,alvo:num($("djAlvo").value)||null,rev:$("djRev").value||null});
  djSave();e.target.reset();djLista()});
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-djdel]");if(!x)return;DJ.L=DJ.L.filter(y=>y.id!==x.dataset.djdel);djSave();djLista()});

/* ----- Planejamento: Monte Carlo mensal com retornos reais (acima da inflação) ----- */
const PJ={c:{idade:40,apos:60,vida:90,pat:200000,aporte:3000,renda:10000,perfil:"mod"}};
try{const c=JSON.parse(localStorage.getItem("pjCfg")||"null");if(c)Object.assign(PJ.c,c)}catch(e){}
const PJ_PERF={cons:["Conservador",3.0,3],mod:["Moderado",4.5,8],arr:["Arrojado",6.0,15]};
function pjRand(seed){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function pjSim(c,saque,n){ // devolve trajetórias de patrimônio por ano e a fração que chegou ao fim da vida com dinheiro
  const [,mu,sd]=PJ_PERF[c.perfil],mm=Math.log(1+mu/100)/12-Math.pow(sd/100,2)/24,ms=sd/100/Math.sqrt(12),rnd=pjRand(12345);
  const anos=c.vida-c.idade,P=[];let ok=0;
  for(let i=0;i<n;i++){let v=c.pat;const tr=[v];let vivo=true;
    for(let m=1;m<=anos*12;m++){let u1=rnd()||1e-9,u2=rnd();const z=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);v*=Math.exp(mm+ms*z);
      const idade=c.idade+m/12;if(idade<=c.apos)v+=c.aporte;else v-=saque;if(v<=0){v=0;vivo=false}if(m%12===0)tr.push(v)}
    if(vivo)ok++;P.push(tr)}
  return {P,ok:ok/n};
}
function pjPct(P,k,p){const v=P.map(t=>t[k]).sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.floor(p*v.length))]}
function pjTela(){
  const o=$("fnOut");if(!o)return;const c=PJ.c;
  if(FN.view!=="pj"){FN.view="pj";const inp=(id,l,v)=>'<div class="field"><label for="'+id+'">'+l+'</label><input id="'+id+'" data-pj="'+id.slice(2)+'" inputmode="decimal" value="'+v+'"></div>';
    o.innerHTML='<section class="panel"><h3>Planejamento financeiro</h3><p class="sub">Quanto o patrimônio pode crescer até a aposentadoria e se ele sustenta a renda desejada até o fim da vida, em 2.000 cenários de mercado. Todos os valores em reais de hoje (o retorno é acima da inflação). Os números ficam só neste aparelho.</p><div class="fnfilt" style="margin-top:8px">'
      +inp("pjidade","Idade hoje",c.idade)+inp("pjapos","Idade para parar de aportar e começar a usar",c.apos)+inp("pjvida","Planejar até a idade",c.vida)+inp("pjpat","Patrimônio hoje (R$)",fx(c.pat,0))+inp("pjaporte","Aporte por mês até lá (R$)",fx(c.aporte,0))+inp("pjrenda","Renda desejada por mês depois (R$)",fx(c.renda,0))
      +'<div class="field"><label for="pjperfil">Perfil da carteira</label><select id="pjperfil" data-pj="perfil">'+Object.entries(PJ_PERF).map(([k,v])=>'<option value="'+k+'"'+(k===c.perfil?' selected':'')+'>'+v[0]+' (IPCA + '+fx(v[1],1)+'%, oscilação '+v[2]+'%)</option>').join("")+'</select></div></div></section><section class="panel" id="pjR"></section>'}
  const b=$("pjR");if(!b)return;
  if(!(c.vida>c.apos&&c.apos>=c.idade)){b.innerHTML='<p class="warn">Confira as idades: hoje ≤ aposentadoria < fim do planejamento.</p>';return}
  const S=pjSim(c,c.renda,2000),ka=Math.round(c.apos-c.idade),anos=c.vida-c.idade;
  // renda que se sustenta com 90% de chance e aporte necessário para a renda desejada com 90% de chance
  let lo=0,hi=c.renda*4+50000;for(let i=0;i<16;i++){const m=(lo+hi)/2;if(pjSim(c,m,500).ok>=0.9)lo=m;else hi=m}const renda90=lo;
  let alo=0,ahi=Math.max(1000,c.aporte*6+20000);for(let i=0;i<16;i++){const m=(alo+ahi)/2;if(pjSim(Object.assign({},c,{aporte:m}),c.renda,500).ok>=0.9)ahi=m;else alo=m}const ap90=ahi;
  const pc=v=>fx(v*100,0)+'%';
  let h='<div class="fnkpis">'+tecKp("Chance de manter a renda até os "+c.vida,'<span class="'+(S.ok>=0.85?'pos':S.ok<0.6?'neg':'')+'">'+pc(S.ok)+'</span>','R$ '+fx(c.renda,0)+' por mês a partir dos '+c.apos)
    +tecKp("Patrimônio aos "+c.apos+" (mediana)",brl(pjPct(S.P,ka,.5)),'90% dos cenários acima de '+brl(pjPct(S.P,ka,.1)))
    +tecKp("Renda segura (90% de chance)",brl(renda90)+'/mês','até os '+c.vida+' anos')
    +tecKp("Aporte para a renda desejada",ap90>=Math.max(1000,c.aporte*6+20000)*0.99?'acima de '+brl(ap90):brl(ap90)+'/mês','para 90% de chance')+'</div>';
  const t0=new Date().getUTCFullYear(),ser=(p,lab,col,w,dash)=>({lab,col,w,dash,pts:Array.from({length:anos+1},(_,k)=>[Date.UTC(t0+k,0,1),pjPct(S.P,k,p)/1000])});
  h+='<div class="label">Patrimônio ao longo do tempo (R$ mil, em valores de hoje)</div>'+fnChart([ser(.5,"Mediana",FN_COLS[0],2.2),ser(.1,"Cenário ruim (10%)",FN_COLS[1],1.5,"5 4"),ser(.9,"Cenário bom (90%)",FN_COLS[2],1.5,"5 4")],{fmt:"num",aria:"Planejamento"});
  h+='<p class="sub" style="font-size:.8rem">Simulação de Monte Carlo com retornos mensais aleatórios (distribuição lognormal) para o perfil escolhido, em termos reais. Não considera IR, taxas, INSS ou outras rendas. Serve para comparar caminhos (aportar mais, adiar a aposentadoria, mudar o perfil), não como promessa de resultado.</p>';
  b.innerHTML=h;
}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.pj)return;const k=t.dataset.pj;PJ.c[k]=k==="perfil"?t.value:(num(t.value)||0);try{localStorage.setItem("pjCfg",JSON.stringify(PJ.c))}catch(x){}pjTela()});
