/* ---------- Ficha do título (debêntures): garantia, cláusulas, circulação, participantes, liquidez no secundário,
   histórico da taxa e saúde do emissor. Dados: catálogo do SND (ficha), negócios do SND, taxas ANBIMA e robô de emissores. */
const FT={neg:null,negLoad:null,tx:null,txLoad:null};
function ftLoad(){
  if(!FT.neg&&!FT.negLoad)FT.negLoad=roboJson("debentures_negocios.json").then(j=>{FT.neg=j&&j.p?j:{p:{}};FT.negLoad=null;ftRefaz()}).catch(()=>{FT.neg={p:{}};FT.negLoad=null});
  if(!FT.tx&&!FT.txLoad)FT.txLoad=(MK.taxas?Promise.resolve(MK.taxas):roboJson("taxas_hist.json")).then(j=>{FT.tx=j||{};FT.txLoad=null;ftRefaz()}).catch(()=>{FT.tx={};FT.txLoad=null});
  if(typeof emBoot==="function")emBoot();
}
function ftRefaz(){if(typeof activeMod!=="undefined"&&activeMod==="pc"&&typeof pcCurCode!=="undefined"&&pcCurCode){const P=pcP(pcCurCode);if(P)pcInfo(P,pcCurCode)}}
const FT_GAR={"quirografaria":["Sem garantia (quirografária)","em caso de falência, o investidor entra na fila junto com os demais credores sem garantia","neg"],
  "subordinada":["Subordinada","recebe depois de todos os outros credores: o risco mais alto da estrutura","neg"],
  "real":["Garantia real","bens específicos (imóveis, equipamentos, recebíveis) ficam vinculados ao pagamento","pos"],
  "flutuante":["Garantia flutuante","preferência geral sobre os ativos da empresa, sem bem específico","warn"],
  "fidejussoria":["Garantia fidejussória (aval ou fiança)","outra empresa do grupo ou sócio garante o pagamento",""],
  "adicional":["Com garantia adicional","além da espécie, há garantias extras previstas na escritura","pos"]};
function ftGar(g){const n=fnNorm(g||"");for(const k in FT_GAR)if(n.includes(k))return FT_GAR[k];return g?[g,"",""]:null}
function ftSpark(pts){ // gráfico compacto para a coluna estreita da ficha (desenhado em 340 × 110, perto do tamanho real)
  const W=340,H=110,PL=42,PR=8,PT=10,PB=22,ys=pts.map(p=>p[1]),lo=Math.min(...ys),hi=Math.max(...ys),pad=(hi-lo)*0.15||0.05,a=lo-pad,b=hi+pad,t0=pts[0][0],t1=pts[pts.length-1][0];
  const X=t=>PL+(t-t0)/Math.max(1,t1-t0)*(W-PL-PR),Y=v=>PT+(b-v)/(b-a)*(H-PT-PB);
  const d=pts.map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join(' ');
  const tx=(x,y,t,an)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+(an||'start')+'" font-size="11" fill="var(--muted)">'+t+'</text>';
  return '<svg role="img" aria-label="Histórico da taxa" viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:'+W+'px;height:auto;display:block">'
    +'<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+Y(hi)+'" y2="'+Y(hi)+'" stroke="var(--line)" stroke-dasharray="2 4"/><line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+Y(lo)+'" y2="'+Y(lo)+'" stroke="var(--line)" stroke-dasharray="2 4"/>'
    +tx(PL-4,Y(hi)+4,fx(hi,2)+'%','end')+tx(PL-4,Y(lo)+4,fx(lo,2)+'%','end')+tx(PL,H-6,fdate(t0).slice(0,5))+tx(W-PR,H-6,fdate(t1).slice(0,5),'end')
    +'<path d="'+d+'" fill="none" stroke="var(--accent)" stroke-width="2"/><circle cx="'+X(t1).toFixed(1)+'" cy="'+Y(pts[pts.length-1][1]).toFixed(1)+'" r="3" fill="var(--accent)"/></svg>';
}
function pcFicha(P,code){
  if(!P||P.type!=="DEB")return "";ftLoad();
  const f=P.ficha||{},it=[],row=(a,b)=>'<div class="row"><dt>'+a+'</dt><dd>'+b+'</dd></div>';
  try{if(!CRB.L)crbCarrega();const L=typeof cbCredNota==="function"?cbCredNota():null,d=L&&L.find(o=>o.cod===String(code||"").toUpperCase());if(d&&d.dif!=null)it.push(row("Nota de crédito WF",'<b style="color:'+cbNotaCor(d.est?0:d.nota)+'">'+(d.est?'estresse':d.nota+'/100')+'</b><small style="display:block;color:var(--muted)">spread '+(d.dif>=0?'+':'−')+fx(Math.abs(d.dif),2)+' p.p. contra papéis parecidos'+(d.est?': o mercado cobra como risco alto de calote':d.dif<-0.5?': paga menos que os pares':d.dif>1.5?': paga bem acima dos pares; confira o porquê':'')+'</small>'))}catch(e){}
  const g=ftGar(f.garantia);if(g)it.push(row("Garantia",'<b class="'+g[2]+'">'+esc(g[0])+'</b>'+(g[1]?'<small style="display:block;color:var(--muted)">'+g[1]+'</small>':'')));
  if(f.classe)it.push(row("Classe",esc(f.classe)+(/convers/i.test(f.classe)?' <small>(pode virar ações)</small>':'')));
  if(f.resgateAntecipado!=null)it.push(row("Resgate antecipado pelo emissor",f.resgateAntecipado?'<span class="warn">previsto</span><small style="display:block;color:var(--muted)">o emissor pode devolver o dinheiro antes do vencimento, em geral quando os juros caem</small>':'não previsto'));
  if(f.repactuacao)it.push(row("Próxima repactuação",'<span class="warn">'+fdate(Date.parse(f.repactuacao+"T00:00:00Z"))+'</span><small style="display:block;color:var(--muted)">a taxa pode ser renegociada nessa data; quem não aceitar pode vender ao emissor</small>'));
  if(f.qtdEmitida){const em=f.qtdEmitida,mc=f.qtdMercado,rs=f.qtdResgatada;it.push(row("Em circulação",mc!=null?fx(mc/em*100,0)+'% da emissão'+(rs?' <small>('+fx(rs/em*100,0)+'% já resgatado)</small>':''):'—'))}
  if(f.agenteFiduciario)it.push(row("Agente fiduciário",esc(nomeCx(f.agenteFiduciario))+'<small style="display:block;color:var(--muted)">representa os investidores e fiscaliza as obrigações do emissor</small>'));
  if(f.coordenador)it.push(row("Coordenador líder da oferta",esc(nomeCx(f.coordenador))));
  if(f.escrituraPadrao)it.push(row("Escritura","padronizada (modelo simplificado da ANBIMA)"));
  // liquidez no secundário
  let liq="";
  if(FT.neg){const n=FT.neg.p[code];
    liq=n?row("Negócios no secundário (90 dias)",'<b>'+fx(n[0],0)+'</b> negócio'+(n[0]>1?'s':'')+' em '+fx(n[2],0)+' dia'+(n[2]>1?'s':'')+' · último em '+fdate(Date.parse(n[3]+"T00:00:00Z"))+(n[5]!=null?' a '+fx(n[5],2)+'% do PU da curva':'')+'<small style="display:block;color:var(--muted)">'+(n[2]>=20?'boa liquidez: negocia com frequência':n[2]>=5?'liquidez moderada':'pouca liquidez: vender antes do vencimento pode exigir desconto')+'</small>')
      :(FT.neg.de?row("Negócios no secundário (90 dias)",'<span class="warn">nenhum negócio registrado</span><small style="display:block;color:var(--muted)">o preço é só de modelo (ANBIMA); vender antes do vencimento pode ser difícil</small>'):"")}
  // histórico da taxa ANBIMA
  let hist="";const L=FT.tx&&FT.tx[code];
  if(L&&L.length>1){const pts=L.map(x=>[Date.parse(x[0]+"T00:00:00Z"),+x[1]]),a=pts[pts.length-1],b=pts[0],d=a[1]-b[1];
    hist='<div class="label" style="margin-top:10px">Taxa indicativa ANBIMA guardada pelo app</div>'+ftSpark(pts)
      +'<p class="sub" style="font-size:.82rem">'+(Math.abs(d)<0.05?'Taxa estável':'A taxa '+(d>0?'subiu':'caiu')+' '+fx(Math.abs(d)*100,0)+' bps')+' desde '+fdate(b[0])+(d>0.5?': o mercado passou a cobrar mais para carregar este papel, o que pode indicar mais risco percebido.':d<-0.5?': o mercado passou a aceitar menos, sinal de risco percebido menor.':'.')+'</p>'}
  // emissor
  let emis="";
  if(f.cnpj&&typeof EM!=="undefined"&&EM.d&&EM.d.e[f.cnpj]){const c=emCalc(EM.d.e[f.cnpj]);if(c)emis='<div class="label" style="margin-top:10px">Saúde financeira do emissor</div><p style="margin:4px 0"><b style="color:'+EM_COR[c.nivel]+'">'+EM_NV[c.nivel]+'</b> · dívida líquida/EBITDA '+(c.lev!=null?fx(c.lev,1)+'x':'—')+' · cobertura de juros '+(c.cob!=null?fx(c.cob,1)+'x':'—')+' · liquidez corrente '+(c.liq!=null?fx(c.liq,2):'—')+(c.alerta.length?'<br><small class="warn">'+esc(c.alerta.join(", "))+'</small>':'')+'</p><p class="sub" style="font-size:.8rem">Balanço de '+(c.base?fdate(Date.parse(c.base+"T00:00:00Z")):'—')+' na CVM. Histórico completo em Mercado › Crédito.</p>'}
  else if(f.cnpj)emis='<p class="sub" style="font-size:.82rem;margin-top:8px">Emissor: CNPJ '+f.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5")+(typeof EM!=="undefined"&&EM.d?' · sem balanço na CVM (empresa fechada ou ainda não coletada).':'.')+'</p>';
  let par="";try{par=prTitulo(P,code)}catch(e){}
  if(!it.length&&!liq&&!hist&&!emis)return par;
  return par+'<div class="label" style="margin-top:12px">Ficha do título</div><dl class="pcdl">'+it.join("")+liq+'</dl>'+hist+emis
    +(it.length?'<p class="sub" style="font-size:.78rem">Características: SND (debentures.com.br). Para cláusulas de vencimento antecipado (covenants), consulte a escritura no site da CVM ou do agente fiduciário.</p>':'');
}
