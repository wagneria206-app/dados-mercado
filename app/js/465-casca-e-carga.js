/* ---------- casca e carga */
function atShell(m){
  const o=$("fnOut");if(!o)return null;
  if(FN.view!==m){FN.view=m;
    if(m==="aa")o.innerHTML='<section class="panel fnsrch"><label class="label" for="atQ">Buscar ativo</label><div class="fnqbox"><input id="atQ" autocomplete="off" placeholder="Código ou nome: PETR4, HGLG11, BOVA11, Itaú…" value="'+esc(AT.q)+'"><div id="atRes" class="fnres" hidden></div></div><p class="sub" style="margin-top:6px;font-size:.82rem">Ações, units, FIIs, Fiagros, ETFs e BDRs negociados na B3. Cotações e proventos da B3, balanços e informes dos FIIs da CVM e, nos BDRs, dados da empresa nos EUA (SEC).</p></section><div id="atBody"></div>';
    else if(m==="ar")o.innerHTML='<section class="panel"><h3>Ranking de ativos</h3><p class="sub">Filtre por tipo e setor e ordene por qualquer indicador. Clique no ativo para abrir a análise.</p><div id="atRkF"></div><div id="atRkT"></div></section>';
    else o.innerHTML='<section class="panel"><h3>Comparar ativos</h3><p class="sub">Escolha até 25 ativos (ações, FIIs, ETFs ou BDRs) para comparar retorno com proventos, risco e indicadores no mesmo período.</p><div class="fnqbox" style="margin-top:8px"><input id="atCq" autocomplete="off" placeholder="Adicionar ativo: código ou nome"><div id="atCres" class="fnres" hidden></div></div><div id="atCbody"></div></section>';
  }
  return o;
}
function atCalc(m){
  const o=atShell(m);if(!o)return;const body=m==="aa"?$("atBody"):m==="ar"?$("atRkT"):$("atCbody");
  if(!AT.idx){
    if(AT.err)body.innerHTML='<section class="panel"><p class="warn">A base de ativos ainda não está disponível ('+esc(AT.err.message||AT.err)+'). Na primeira vez o robô leva cerca de uma hora para montar o histórico de cotações desde 2005. Tente de novo mais tarde.</p><button type="button" class="btn sec" data-atretry="1">Tentar de novo</button></section>';
    else{body.innerHTML='<section class="panel"><p class="sub">Carregando a base de ativos da B3…</p></section>';atBoot()}
    return;
  }
  if(m==="aa")atAa();else if(m==="ar")atRk();else atCmp();
}
function atSearch(q,max){const t=fnNorm(q).split(/\s+/).filter(Boolean);if(!t.length)return [];const R=AT.idx.rows,C=AT.C,Q=q.trim().toUpperCase(),out=[];
  for(let j=0;j<R.length;j++){if(t.every(w=>AT.sk[j].includes(w)))out.push(j)}
  out.sort((a,b)=>{const ea=R[a][0]===Q?1:0,eb=R[b][0]===Q?1:0;if(ea!==eb)return eb-ea;const sa=R[a][0].startsWith(Q)?1:0,sb=R[b][0].startsWith(Q)?1:0;if(sa!==sb)return sb-sa;return (R[b][C.liq]||0)-(R[a][C.liq]||0)});return out.slice(0,max||12)}
function atResHtml(js,attr){const R=AT.idx.rows,C=AT.C;if(!js.length)return '<div class="fnri"><small>Nenhum ativo encontrado.</small></div>';
  return js.map(j=>{const r=R[j];return '<button type="button" class="fnri" data-'+(attr||"atopen")+'="'+r[0]+'"><b>'+r[0]+' · '+esc(r[1])+'</b><small>'+esc(r[C.tipo])+(AT.idx.setores[r[C.setor]]?' · '+esc(AT.idx.setores[r[C.setor]]):'')+' · R$ '+fx(r[C.preco],2)+' · 12m '+fnPctT(r[C.r12])+'</small></button>'}).join("")}

