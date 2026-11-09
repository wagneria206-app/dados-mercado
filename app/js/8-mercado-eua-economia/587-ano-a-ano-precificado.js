/* ---------- Ano a ano: juros e inflação que o mercado precifica para cada ano × Focus */
// Taxas a termo de cada ano civil lidas da ETTJ da ANBIMA (prefixada e IPCA+): o que os títulos pagam só por aquele ano.
// Inflação implícita do ano = (1 + pré a termo) ÷ (1 + real a termo) − 1. Inclui o prêmio de risco de inflação.
function mcTermo(b,t1,t2){const r=t=>t<=0?0:nssY(b,t)/100,f1=Math.pow(1+r(t1),t1),f2=Math.pow(1+r(t2),t2);return (Math.pow(f2/f1,1/(t2-t1))-1)*100}
function mcAnoHtml(F){
  let W=null;try{W=curvWins()}catch(e){}const w=W&&W[0];if(!w||!w.b||!w.b.pre||!w.b.ipca)return "";
  const t0=Date.parse(w.date+"T00:00:00Z"),y0=new Date(t0).getUTCFullYear(),L=[];
  for(let y=y0;y<=y0+5;y++){
    const a=Math.max(t0,Date.UTC(y,0,1)),z=Date.UTC(y+1,0,1),t1=du(t0,a)/252,t2=du(t0,z)/252;if(t2-t1<0.5)continue;   // ano corrente quase no fim: a ponta curta da curva não é confiável para isso
    const pre=mcTermo(w.b.pre,t1,t2),real=mcTermo(w.b.ipca,t1,t2),inf=((1+pre/100)/(1+real/100)-1)*100;
    const fs=F&&F.anuais?mcFocusSer(F,"IPCA",String(y)):null,fo=fs&&fs.length?+fs[fs.length-1][1]:null;
    L.push({y,parc:a>Date.UTC(y,0,1),pre,real,inf,fo});
  }
  if(!L.length)return "";
  let h='<div class="label" style="margin-top:12px">Ano a ano: o que os títulos públicos precificam para cada ano × Focus</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ano</th><th>Juro prefixado do ano</th><th>Juro real do ano</th><th>Inflação implícita do ano</th><th>IPCA do ano no Focus</th><th>Diferença</th></tr></thead><tbody>';
  L.forEach(x=>{h+='<tr><td style="text-align:left">'+x.y+(x.parc?' <small>(restante)</small>':'')+'</td><td>'+fx(x.pre,2)+'%</td><td>'+fx(x.real,2)+'%</td><td><b>'+fx(x.inf,2)+'%</b></td><td>'+(x.fo!=null?fx(x.fo,2)+'%':'—')+'</td><td>'+(x.fo!=null?mcSig(x.inf-x.fo,2," p.p."):'—')+'</td></tr>'});
  h+='</tbody></table></div><p class="sub" style="font-size:.8rem">Taxas a termo de cada ano civil, tiradas da curva de juros da ANBIMA de '+fdate(t0)+': quanto os títulos pagam só por aquele ano, já descontado o que pagam até o início dele. A inflação implícita inclui o prêmio que o investidor cobra pelo risco de a inflação surpreender; diferença positiva grande indica proteção contra inflação cara (IPCA+ caro, prefixado barato). O ano corrente só aparece enquanto faltam pelo menos seis meses; nesse caso, o Focus é o IPCA do ano inteiro e a implícita é só o que falta até dezembro.</p>';
  return h;
}
