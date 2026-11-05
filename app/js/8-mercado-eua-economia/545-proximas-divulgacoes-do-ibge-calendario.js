/* ===== Próximas divulgações do IBGE (calendário oficial, lido direto pelo navegador; se não carregar, a seção some) ===== */
const IBGECAL={d:null,load:null,err:false};
/* lista das divulgações do IBGE que interessam ao mercado (null enquanto carrega, [] se o calendário não respondeu) */
function ibgeCalItens(){let src;
  if(IBGECAL.d)src=Array.isArray(IBGECAL.d)?IBGECAL.d:IBGECAL.d.items||[];
  else{if(!IBGECAL.err)ibgeCalHtml();   // o navegador busca direto no IBGE; enquanto isso (ou se o IBGE não responder) vale a cópia do robô
    const R=typeof MC!=="undefined"&&MC.d&&MC.d.ibgecal;if(R&&R.length)src=R.map(x=>({titulo:x[0],data_divulgacao:x[1]}));else{if(typeof mcBoot==="function"&&typeof MC!=="undefined"&&!MC.d)mcBoot();return IBGECAL.err?[]:null}}
  return src.map(x=>{const tit=String(x.titulo||x.nome_produto||x.titulo_produto||""),dd=String(x.data_divulgacao||x.data||"");const m=/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(dd);return m?{tit,t:Date.UTC(+m[3],+m[2]-1,+m[1]),h:m[4]?m[4]+"h"+m[5]:""}:null})
    .filter(x=>x&&/IPCA|INPC|PIB|Contas Nacionais|PNAD|Produção Industrial|Pesquisa Mensal de Comércio|Pesquisa Mensal de Serviços|Desocupação|IPP/i.test(x.tit)).sort((a,b)=>a.t-b.t)
    .filter((x,i,a)=>a.findIndex(y=>y.tit===x.tit&&y.t===x.t)===i)}
function ibgeCalHtml(){
  if(IBGECAL.err)return "";
  if(!IBGECAL.d){if(!IBGECAL.load){const hj=new Date(),f=d=>String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+"-"+d.getFullYear(),ate=new Date(hj.getTime()+75*864e5);
      IBGECAL.load=fetch("https://servicodados.ibge.gov.br/api/v3/calendario/?qtd=300&de="+f(hj)+"&ate="+f(ate)).then(r=>r.ok?r.json():Promise.reject()).then(j=>{IBGECAL.d=j;if(typeof activeMod!=="undefined"&&(activeMod==="in"||activeMod==="ec"||activeMod==="agm"||activeMod==="rs")&&typeof mkCalc==="function")mkCalc()}).catch(()=>{IBGECAL.err=true})}
    return ""}
  const L=(Array.isArray(IBGECAL.d)?IBGECAL.d:IBGECAL.d.items||[]).map(x=>{const tit=String(x.titulo||x.nome_produto||x.titulo_produto||""),dd=String(x.data_divulgacao||x.data||"");const m=/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(dd);return m?{tit,t:Date.UTC(+m[3],+m[2]-1,+m[1]),h:m[4]?m[4]+"h"+m[5]:""}:null})
    .filter(x=>x&&/IPCA|INPC|PIB|Contas Nacionais|PNAD|Produção Industrial|Pesquisa Mensal de Comércio|Pesquisa Mensal de Serviços|Desocupação|IPP/i.test(x.tit)).sort((a,b)=>a.t-b.t);
  const vis=new Set(),U=L.filter(x=>{const k=x.tit+"|"+x.t;if(vis.has(k))return false;vis.add(k);return true}).slice(0,14);
  if(!U.length)return "";
  return '<h3>Próximas divulgações do IBGE</h3><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Data</th><th style="text-align:left">Divulgação</th></tr></thead><tbody>'+U.map(x=>'<tr><td style="text-align:left;white-space:nowrap">'+fdate(x.t)+(x.h?' <small>'+x.h+'</small>':'')+'</td><td style="text-align:left">'+esc(x.tit)+'</td></tr>').join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem">Fonte: calendário de divulgações do IBGE.</p>';
}

