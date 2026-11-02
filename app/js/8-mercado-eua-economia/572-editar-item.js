/* ---------- editar qualquer item da carteira: nome exibido, código do ativo, valor ou peso, renda fixa e cada aplicação
   Os demais ajustes (classe, prazo de resgate, carência, produto, emissor, vencimento, indexador e taxa) continuam
   logo abaixo do nome do item, na composição. */
/* resumo de uma linha do item na composição (o detalhe fica no painel de edição) */
function spItemResumo(it){const P=[SP_CL[spCl(it)]];const l=spLiq(it);if(l.car)P.push("carência até "+fdate(Date.parse(l.car+"T00:00:00Z")));else if(l.d!=null)P.push("D+"+l.d);
  if(it.t==="s"){P.push(spRfLab(it.rf,+it.x||0));const p=spProd(it);if(p)P.push(p);const em=spEmissor(it);if(em)P.push(em);const v=spVenc(it);if(v)P.push("vence "+fdate(Date.parse(v.d+"T00:00:00Z")));if(it.isento)P.push("isento")}
  return '<small class="spitres">'+esc(P.filter(Boolean).join(" · "))+'</small>'}
function spEditBtn(j){return '<button type="button" class="link spmovb" data-spedit="'+j+'">'+(SP.edOpen===j?'Fechar edição':'Editar')+'</button>'}
function spEditRow(c,j){const it=c.itens[j];if(!it)return "";const val=(+c.valor||0)*(+it.w||0)/100,mv=(it.mov||[]).map((m,i)=>[m,i]).filter(([m])=>m&&m.d!=null).sort((a,b)=>String(a[0].d).localeCompare(String(b[0].d))),hoje=spHoje();
  const cod=it.t==="f"?fnCnpjF(it.k):it.t==="a"?it.k:/^cr:/.test(it.k||"")?it.k.slice(3):"";
  let h='<tr class="spmovrow"><td colspan="5" style="text-align:left"><div class="spmov"><div class="label">Editar · '+esc(spItemNome(it))+'</div><div class="sprow">'
    +'<div class="field"><label for="spEdN">Nome exibido</label><input id="spEdN" data-sped="n" maxlength="90" value="'+esc(it.n||"")+'"></div>'
    +(it.t==="f"||it.t==="a"?'<div class="field"><label for="spEdK">'+(it.t==="f"?'CNPJ do fundo':'Código na B3')+'</label><input id="spEdK" data-sped="k" maxlength="20" value="'+esc(cod)+'" autocapitalize="characters"><small>Para trocar o ativo; as aplicações são mantidas.</small></div>':'')
    +'<div class="field"><label for="spEdW">Peso</label><div class="affix s"><input id="spEdW" inputmode="decimal" data-sped="w" value="'+fx(+it.w||0,2)+'"><span class="suf">%</span></div></div>'
    +'<div class="field"><label for="spEdV">Valor na proposta</label><div class="affix s"><input id="spEdV" inputmode="decimal" data-sped="val" value="'+fx(val,2)+'"><span class="suf">R$</span></div><small>Muda o peso (sobre '+brl(+c.valor||0)+')</small></div></div>';
  h+='<div class="label" style="margin-top:8px">Classe, liquidez'+(it.t==="s"?' e renda fixa':'')+'</div>'+(it.t==="s"?'<div style="margin:4px 0">'+spRfEd(it,j)+' <label class="spiso"><input type="checkbox" data-spiso="'+j+'"'+(it.isento?' checked':'')+'>isento de IR</label></div>':'')+spAjItem(it,j);
  h+='<div class="label" style="margin-top:8px">Aplicações e resgates</div>'+(mv.length?'<table class="ctab"><thead><tr><th style="text-align:left">Data</th><th style="text-align:left">Movimento</th><th>Valor (R$)</th><th></th></tr></thead><tbody>'
    +mv.map(([m,i])=>'<tr><td style="text-align:left"><input type="date" max="'+hoje+'" data-spedmd="'+i+'" value="'+esc(m.d||"")+'"></td><td style="text-align:left"><select style="min-width:130px" data-spedmt="'+i+'"><option value="1"'+(+m.v>=0?' selected':'')+'>Aplicação</option><option value="-1"'+(+m.v<0?' selected':'')+'>Resgate</option></select></td><td><span class="affix s" style="width:150px;display:inline-flex"><input inputmode="decimal" data-spedmv="'+i+'" value="'+fx(Math.abs(+m.v||0),2)+'" style="text-align:right;min-width:0"><span class="suf">R$</span></span></td><td><button type="button" class="fnx" data-spedmx="'+i+'" aria-label="Apagar movimento">×</button></td></tr>').join("")+'</tbody></table>':'<p class="sub" style="margin:4px 0">Nenhuma aplicação informada.</p>')
    +'<div class="spbtns" style="margin-top:6px"><button type="button" class="btn sec" data-spedmadd="1">+ Aplicação</button><button type="button" class="btn" data-spedok="1">Concluir</button></div>'
    +'<p class="sub" style="font-size:.78rem;margin:4px 0 0">As mudanças valem na hora e ficam salvas. Prazo de resgate: preencha só quando não houver dado oficial ou para corrigir.</p></div></td></tr>';
  return h}
function spEditAplica(fn){const c=spC(),j=SP.edOpen,it=c.itens[j];if(!it)return;const r=fn(it,c);if(r===false)return;SP_CMP=null;if(typeof SP_ASS!=="undefined")SP_ASS=null;spSave();setTimeout(spCalc,0)}   // depois do evento: refazer a tela durante a troca de foco quebra o navegador
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||activeMod!=="sp"||SP.edOpen==null)return;let i;
  if(t.dataset.sped){const k=t.dataset.sped,v=t.value.trim();spEditAplica((it,c)=>{
      if(k==="n"){if(!v)return false;it.n=v.slice(0,90);return}
      if(k==="w"){const x=num(v);if(x==null||x<0)return false;it.w=Math.round(x*100)/100;return}
      if(k==="val"){const x=num(v);if(x==null||x<0||!(+c.valor>0))return false;it.w=Math.round(x/(+c.valor)*10000)/100;return}
      if(k==="k"){if(it.t==="f"){const kk=v.replace(/\D/g,"");const r=FN.idx&&fnRow(kk);if(!r){alertLite("CNPJ não encontrado na base de fundos da CVM.");return false}if(c.itens.some(y=>y!==it&&y.k===kk)){alertLite("Esse fundo já está na carteira.");return false}it.k=kk;it.n=r[1]}
        else{const kk=v.toUpperCase().replace(/\s/g,"");const r=AT.idx&&atRow(kk);if(!r){alertLite("Código não encontrado na base da B3.");return false}if(c.itens.some(y=>y!==it&&y.k===kk)){alertLite("Esse ativo já está na carteira.");return false}it.k=kk;it.n=r[1]}
        delete it.cl;delete it.liq;return}})}
  else if((i=t.dataset.spedmd)!=null){if(!/^\d{4}-\d{2}-\d{2}$/.test(t.value))return;spEditAplica(it=>{it.mov[+i].d=t.value})}
  else if((i=t.dataset.spedmv)!=null){const x=num(t.value);if(x==null||x<=0)return;spEditAplica(it=>{const s=+it.mov[+i].v<0?-1:1;it.mov[+i].v=s*x})}
  else if((i=t.dataset.spedmt)!=null){spEditAplica(it=>{it.mov[+i].v=Math.abs(+it.mov[+i].v||0)*(+t.value)})}});
document.addEventListener("click",e=>{const g=s=>e.target.closest&&e.target.closest(s);let x;if(activeMod!=="sp")return;
  if((x=g("[data-spedit]"))){const j=+x.dataset.spedit;SP.edOpen=SP.edOpen===j?null:j;SP.movOpen=null;SP.compAb=true;spTopHtml();const n=$("spEdN");if(n)n.focus();return}
  if(g("[data-spedok]")){SP.edOpen=null;spTopHtml();return}
  if((x=g("[data-spedmx]"))){spEditAplica(it=>{it.mov.splice(+x.dataset.spedmx,1)});return}
  if(g("[data-spedmadd]")){spEditAplica((it,c)=>{it.mov=it.mov||[];const d=c.ef&&c.ef.data||spHoje(),v=(+c.valor||0)*(+it.w||0)/100||1000;it.mov.push({d,v:Math.round(v*100)/100})})}});
document.addEventListener("click",e=>{if(e.target.closest&&e.target.closest("[data-sprm],[data-spclear],[data-spsel],[data-spgo],[data-spnew],[data-spdup],[data-spdel]"))SP.edOpen=null},true);
document.addEventListener("change",e=>{if(e.target&&e.target.dataset&&(e.target.dataset.spsel||e.target.dataset.spclif))SP.edOpen=null},true);
