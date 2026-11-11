/* ---------- Juros: carrego e rolagem por vencimento e "IPCA+ ou prefixado?".
   Carrego e rolagem: quanto um título sem cupom de prazo T rende em 12 meses se a curva da ANBIMA ficar parada
   (= taxa a termo entre T−1 e T), contra o título de 1 ano; o colchão é quanto a taxa pode subir em 12 meses antes
   de o vencimento longo render menos que o de 1 ano (excesso ÷ duration modificada no fim do período).
   IPCA+ ou prefixado: inflação implícita até cada vencimento contra a média do Focus para o mesmo prazo e contra a meta. */
const CR_PZ=[1,2,3,4,5,6,7,8,10],CR_PZR=[1,2,3,5,7,10,15,20];
function crRoll(b,PZ){const y=t=>t<=0?0:nssY(b,t)/100,y1=y(1);
  return PZ.map(T=>{const yT=y(T),ret=T<=1?yT:Math.pow(1+yT,T)/Math.pow(1+y(T-1),T-1)-1,ex=ret-y1,D=T<=1?0:(T-1)/(1+y(T-1));return {T,yT,ret,ex,D,col:D?ex/D*100:null}})}
function crFocusMedio(T,y0){ // inflação média esperada pelo Focus para os próximos T anos (último ano do Focus repetido depois)
  const F=MC.d&&MC.d.focus;if(!F||!F.anuais||!F.anuais.IPCA)return null;const A=F.anuais.IPCA,ks=Object.keys(A).sort(),val=y=>{const k=A[y]?y:ks.filter(x=>x<=y).pop()||ks[ks.length-1];const s=A[k];return s&&s.length?+s[s.length-1][1]:null};
  const hoje=new Date(Date.UTC(y0[0],y0[1],y0[2])),f0=1-(hoje.getUTCMonth()+hoje.getUTCDate()/31)/12;let f=1,rest=T,y=y0[0],frac=f0;
  while(rest>1e-9){const w=Math.min(frac,rest),v=val(String(y));if(v==null)return null;f*=Math.pow(1+v/100,w);rest-=w;y++;frac=1}
  return (Math.pow(f,1/T)-1)*100}
function crCarryHtml(){
  let W=null;try{W=curvWins()}catch(e){}const w=W&&W[0];if(!w||!w.b||!w.b.pre||!w.b.ipca)return "";
  const P=crRoll(w.b.pre,CR_PZ),R=crRoll(w.b.ipca,CR_PZR),d=w.date.split("-").map(Number),y0=[d[0],d[1]-1,d[2]];
  const best=L=>L.filter(x=>x.T>=2&&x.col!=null).sort((a,b)=>b.col-a.col)[0];const bp=best(P),br=best(R);
  const tab=(L,tit,real)=>'<div class="label" style="margin-top:10px">'+tit+'</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Prazo</th><th>Taxa hoje</th><th>Rende em 12 meses<br><small>curva parada</small></th><th>Acima do título de 1 ano</th><th>Colchão</th></tr></thead><tbody>'
    +L.map(x=>{const bb=x===(real?br:bp);return '<tr'+(bb?' style="font-weight:700"':'')+'><td style="text-align:left">'+x.T+(x.T===1?' ano':' anos')+' <small>('+(y0[0]+x.T)+')</small>'+(bb?' ★':'')+'</td><td>'+(real?'IPCA + ':'')+fx(x.yT*100,2)+'%</td><td>'+(real?'IPCA + ':'')+fx(x.ret*100,2)+'%</td><td class="'+(x.ex>=0?'pos':'neg')+'">'+(x.T===1?'—':mcSig(x.ex*100,2))+'</td><td>'+(x.col==null?'—':fx(x.col,2)+' p.p.')+'</td></tr>'}).join("")+'</tbody></table></div>';
  let h='<h3>Onde a curva paga melhor: carrego e rolagem</h3><p class="sub">Quanto cada prazo rende nos próximos 12 meses se as taxas não mudarem: além da taxa, o título "desce" a curva e ganha com isso. O <b>colchão</b> é quanto a taxa pode subir em 12 meses antes de o prazo longo render menos que um título de 1 ano. Mais colchão = mais proteção pelo mesmo risco.</p>';
  if(bp)h+='<p style="margin:6px 0">Melhor relação hoje: <b>prefixado de '+bp.T+' anos</b> (colchão de '+fx(bp.col,2)+' p.p.)'+(br?' e <b>IPCA+ de '+br.T+' anos</b> (colchão de '+fx(br.col,2)+' p.p.)':'')+'.</p>';
  h+=tab(P,"Prefixados (Tesouro Prefixado, LTN)",false)+tab(R,"Juro real (Tesouro IPCA+, NTN-B)",true);
  // IPCA+ ou prefixado
  const L=CR_PZ.filter(T=>T>=1).map(T=>{const pr=nssY(w.b.pre,T),re=nssY(w.b.ipca,T),im=((1+pr/100)/(1+re/100)-1)*100,fo=crFocusMedio(T,y0);return {T,pr,re,im,fo}});
  h+='<div class="label" style="margin-top:14px">IPCA+ ou prefixado?</div><p class="sub" style="margin:2px 0 6px">A inflação implícita é o IPCA médio que faz os dois empatarem. Se a inflação vier abaixo dela, o prefixado ganha; acima, o IPCA+ ganha.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Prazo</th><th>Prefixado</th><th>IPCA +</th><th>Inflação implícita</th><th>Focus, média do prazo</th><th>Se o IPCA vier como o Focus</th></tr></thead><tbody>'
    +L.map(x=>'<tr><td style="text-align:left">'+x.T+(x.T===1?' ano':' anos')+'</td><td>'+fx(x.pr,2)+'%</td><td>'+fx(x.re,2)+'%</td><td><b>'+fx(x.im,2)+'%</b></td><td>'+(x.fo==null?'—':fx(x.fo,2)+'%')+'</td><td>'+(x.fo==null?'—':x.im>x.fo+0.05?'prefixado ganha '+fx(x.im-x.fo,2)+' p.p. ao ano':x.im<x.fo-0.05?'IPCA+ ganha '+fx(x.fo-x.im,2)+' p.p. ao ano':'empate')+'</td></tr>').join("")+'</tbody></table></div>';
  const lo=L.filter(x=>x.T>=3);if(lo.length){const m=lo.reduce((a,x)=>a+x.im,0)/lo.length;h+='<p style="margin:8px 0 0">Nos prazos de 3 anos ou mais, a inflação implícita média é de <b>'+fx(m,2)+'%</b>, '+(m>4.5?'acima do teto da meta (4,5%): o mercado cobra um prêmio alto pelo risco de inflação, o que favorece o <b>prefixado</b> para quem acredita na convergência do IPCA, e o <b>IPCA+</b> para quem quer proteção':m>3?'entre a meta (3%) e o teto (4,5%)':'perto da meta de 3%: a proteção do <b>IPCA+</b> está barata')+'.</p>'}
  return h+'<p class="sub" style="font-size:.8rem">Curvas de juros prefixados e reais da ANBIMA de '+fdate(Date.parse(w.date+"T00:00:00Z"))+' (taxas zero-cupom; títulos com cupom semestral têm duration menor). Focus: medianas do Banco Central para o IPCA de cada ano; depois do último ano publicado, repete-se o último valor. Prazo em anos úteis (252 dias). A inflação implícita inclui um prêmio pelo risco de inflação, por isso tende a ficar um pouco acima da expectativa pura.</p>'}
