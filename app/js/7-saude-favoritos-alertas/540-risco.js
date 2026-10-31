/* ===== Risco-país implícito: cupom cambial de 1 ano (DI futuro × dólar futuro, B3) menos o juro dos EUA (SOFR) =====
   Substitui o EMBI+ Brasil, cuja série pública (Ipeadata/J.P. Morgan) foi encerrada em 2024. */
const RISCO={di:null,load:null,fxf:null,fxj:null,load2:null};
function riscoSerie(){
  const DI=(typeof MK==="object"&&MK.di)||RISCO.di,FF=FXF||RISCO.fxf,FJ=FXJ||RISCO.fxj;if(!FF||!FF.dias||!DI||!DI.dias)return null;
  const J=FJ&&FJ.mensal?FJ.mensal:{},us={};[J.treasury_2a,J.fed_funds,J.juro_eua].forEach(o=>Object.assign(us,o||{}));const out=[];
  Object.keys(FF.dias).sort().forEach(d=>{const Ld=DI.dias[d],Lf=FF.dias[d];if(!Array.isArray(Ld)||!Array.isArray(Lf))return;
    const t=Date.parse(d+"T00:00:00Z"),pu={},fw={};Ld.forEach(r=>{if(r&&+r[1]>0)pu[r[0]]=+r[1]});Lf.forEach(r=>{if(r&&+r[1]>0)fw[r[0]]=+r[1]});
    const cs=Object.keys(fw).filter(c=>pu[c]).map(c=>({c,e:fxExp(c)})).filter(x=>x.e>t+20*DAY).sort((a,b)=>a.e-b.e);if(cs.length<2)return;
    const m1=cs[0];let m2=null;cs.forEach(x=>{if(!m2||Math.abs(x.e-m1.e-365*DAY)<Math.abs(m2.e-m1.e-365*DAY))m2=x});if(!m2||m2.e-m1.e<300*DAY||m2.e-m1.e>430*DAY)return;
    const dc=(m2.e-m1.e)/DAY,cupom=((pu[m1.c]/pu[m2.c])/(fw[m2.c]/fw[m1.c])-1)*360/dc*100,ym=d.slice(0,7);
    let u=us[ym];if(u==null){const ks=Object.keys(us).filter(k=>k<=ym).sort();u=ks.length?us[ks[ks.length-1]]:null}
    if(!isFinite(cupom)||u==null)return;out.push({t,d,cupom,us:+u,premio:(cupom-u)*100,m1:m1.c,m2:m2.c})});
  return out.length?out:null;
}
function fxRiscoHtml(){
  if(!FXF&&!RISCO.fxf)return "";
  if(!(typeof MK==="object"&&MK.di)&&!RISCO.di){if(!RISCO.load)RISCO.load=fetch(ROBO+"di_futuro.json",{cache:"no-cache"}).then(r=>r.ok?r.json():null).then(j=>{RISCO.di=j;const el=$("fxRisco");if(el)el.outerHTML=fxRiscoHtml()}).catch(()=>{});return '<div id="fxRisco"></div>'}
  const S=riscoSerie();if(!S)return '<div id="fxRisco"></div>';const u=S[S.length-1],a30=S.find(x=>x.t>=u.t-30*DAY),a1y=S[0];
  let h='<div id="fxRisco"><div class="label" style="margin-top:16px">Risco-país implícito (cupom cambial de 1 ano − juro dos EUA)</div>';
  h+='<div class="fnkpis" style="margin-top:6px"><div class="fnkp"><span>Prêmio implícito</span><b>'+fx(u.premio,0)+' pontos</b><small>'+fdate(u.t)+(a30?' · 30 dias atrás '+fx(a30.premio,0):'')+'</small></div><div class="fnkp"><span>Cupom cambial 1 ano</span><b>'+fx(u.cupom,2)+'%</b><small>'+u.m1+' → '+u.m2+', ao ano (360)</small></div><div class="fnkp"><span>Juro dos EUA</span><b>'+fx(u.us,2)+'%</b><small>SOFR, média do mês</small></div></div>';
  h+=fxMulti([{lab:"Prêmio implícito (pontos-base)",col:"var(--loss)",w:2.2,pts:S.map(x=>[x.t,x.premio])}],{months:false,unit:""});
  h+='<p class="sub" style="font-size:.8rem;margin-top:4px">Quanto o mercado de câmbio paga a mais, em dólar, para ficar 1 ano no Brasil em vez de nos EUA: taxa do cupom cambial entre dois vencimentos do dólar futuro e do DI futuro da B3 com cerca de 1 ano de distância, menos o juro americano (SOFR do Fed de Nova York; nos meses mais antigos, sem SOFR publicado na base, o Treasury de 2 anos). Sobe quando cresce a percepção de risco do país. Serve como substituto do EMBI+ Brasil, cuja série pública foi encerrada em 2024; os níveis não são iguais aos do EMBI, mas o movimento é parecido. Histórico desde '+fdate(a1y.t)+'.</p></div>';
  return h;
}

