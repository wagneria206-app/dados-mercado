/* ---------- buscador de crédito privado: debêntures, CRI e CRA com taxa indicativa da ANBIMA
   Filtra por indexador, isenção de IR, duration, spread e emissor; o spread do IPCA+ é sobre a NTN-B de mesmo vencimento
   (interpolada) e o do prefixado sobre a LTN; nos papéis DI+ a taxa já é o spread sobre o CDI. */
const CRB={L:null,load:null,err:null,f:{tipo:"",ind:"",isento:"",dmin:"",dmax:"",smin:"",txt:"",ext:"1"}};
try{const f=JSON.parse(localStorage.getItem("crbF")||"null");if(f&&typeof f==="object")Object.assign(CRB.f,f)}catch(e){}
function crbCurva(kind,venc){const L=(MKT[kind]||[]).filter(r=>isFinite(r[1])).map(r=>[parseDate(r[0]),r[1]]).sort((a,b)=>a[0]-b[0]);if(L.length<2)return null;const t=parseDate(venc);if(!isFinite(t))return null;
  if(t<=L[0][0])return L[0][1];if(t>=L[L.length-1][0])return L[L.length-1][1];for(let i=1;i<L.length;i++)if(t<=L[i][0]){const [a,ra]=L[i-1],[b,rb]=L[i];return ra+(rb-ra)*(t-a)/(b-a)}return null}
function crbCarrega(){if(CRB.L||CRB.load)return;
  CRB.load=Promise.all([roboGet("debentures.json").catch(()=>null),roboGet("cri_cra_anbima.json").catch(()=>null)]).then(([d,c])=>{const L=[];
    [[d,"Debênture"],[c,"CRI/CRA"]].forEach(([j,tipo])=>{if(!j||!j.papers)return;Object.entries(j.papers).forEach(([cod,p])=>{const ind=String(p.indice||""),tx=p.taxa;if(tx==null||!isFinite(tx))return;
      const rf=/^DI\s*\+/i.test(ind)?"cdimais":/%\s*do\s*DI/i.test(ind)?"cdi":/^IPCA/i.test(ind)?"ipca":/PREFIXADO/i.test(ind)?"pre":null;if(!rf)return;
      const inc=/\(\*\)/.test(String(p.nome||"")),nome=nomeCx(String(p.nome||p.risco||p.emissor||"").replace(/\s*\(\*+\)\s*/g," ").trim());
      const ref=rf==="ipca"?crbCurva("NTNB",p.venc):rf==="pre"?crbCurva("LTN",p.venc):null,sp=rf==="cdimais"?+tx:rf==="cdi"?null:ref!=null?+tx-ref:null;
      L.push({cod,tipo,rf,tx:+tx,ind,venc:p.venc,dur:p.duration!=null?p.duration/252:null,isento:tipo==="CRI/CRA"||inc,nome,emissor:nomeCx(String(p.emissor||"")),ref,sp,data:p.data||j.refDate,sk:fnNorm(cod+" "+nome+" "+(p.emissor||"")+" "+(p.risco||""))})})});
    CRB.L=L;CRB.ref=(d&&d.refDate)||(c&&c.refDate);CRB.load=null;if(activeMod==="cr"&&$("crBusca"))crbTabela();else if(activeMod==="rs"&&typeof mkCalc==="function")mkCalc()}).catch(e=>{CRB.err=e;CRB.load=null})}
function crBuscaHtml(){crbCarrega();if(CRB.L)setTimeout(crbTabela,0);const f=CRB.f,sel=(id,lab,k,opts)=>'<div class="field"><label for="'+id+'">'+lab+'</label><select id="'+id+'" data-crbf="'+k+'">'+opts.map(([a,b])=>'<option value="'+a+'"'+(String(f[k])===String(a)?' selected':'')+'>'+b+'</option>').join("")+'</select></div>';
  return '<span class="label">Buscador de crédito privado</span><p class="sub" style="margin-top:4px">Debêntures, CRI e CRA com taxa indicativa da ANBIMA: filtre pelo indexador, isenção, prazo médio (duration) e spread.</p><div class="fnfilt" style="margin-top:6px">'
    +sel("crbTipo","Tipo","tipo",[["","Todos"],["Debênture","Debêntures"],["CRI/CRA","CRI e CRA"]])
    +sel("crbInd","Indexador","ind",[["","Todos"],["cdimais","CDI + spread"],["cdi","% do CDI"],["ipca","IPCA +"],["pre","Prefixado"]])
    +sel("crbIs","Imposto de renda","isento",[["","Todos"],["1","Só isentos para pessoa física"],["0","Só tributados"]])
    +sel("crbDmin","Duration mínima","dmin",[["","Qualquer"],[1,"1 ano"],[2,"2 anos"],[3,"3 anos"],[5,"5 anos"]])
    +sel("crbDmax","Duration máxima","dmax",[["","Qualquer"],[1,"1 ano"],[2,"2 anos"],[3,"3 anos"],[5,"5 anos"],[8,"8 anos"]])
    +sel("crbSmin","Spread mínimo","smin",[["","Qualquer"],[0.5,"0,5 p.p."],[1,"1 p.p."],[1.5,"1,5 p.p."],[2,"2 p.p."],[3,"3 p.p."]])
    +sel("crbExt","Spreads extremos","ext",[["1","Ocultar os 5% mais altos"],["0","Mostrar todos"]])
    +'<div class="field"><label for="crbTxt">Código, emissor ou devedor</label><input id="crbTxt" data-crbtxt="1" value="'+esc(f.txt)+'" autocomplete="off" placeholder="ex.: Petrobras, Eletrobras"></div></div><div id="crBusca"><p class="sub">Carregando as taxas da ANBIMA…</p></div>'}
function crbTabela(){const box=$("crBusca");if(!box)return;if(!CRB.L){box.innerHTML=CRB.err?'<p class="warn">Não deu para carregar as taxas agora.</p>':'<p class="sub">Carregando as taxas da ANBIMA…</p>';return}
  const f=CRB.f,t=fnNorm(f.txt).split(/\s+/).filter(Boolean),p95={};
  if(f.ext==="1")["cdimais","cdi","ipca","pre"].forEach(k=>{const s=CRB.L.filter(x=>x.rf===k&&x.sp!=null).map(x=>x.sp).sort((a,b)=>a-b);if(s.length>=20)p95[k]=s[Math.floor(s.length*0.95)]});
  const L=CRB.L.filter(x=>(!f.tipo||x.tipo===f.tipo)&&(!f.ind||x.rf===f.ind)&&(f.isento===""||(f.isento==="1")===!!x.isento)&&(f.dmin===""||(x.dur!=null&&x.dur>=+f.dmin))&&(f.dmax===""||(x.dur!=null&&x.dur<=+f.dmax))&&(f.smin===""||(x.sp!=null&&x.sp>=+f.smin))&&(p95[x.rf]==null||x.sp==null||x.sp<=p95[x.rf])&&t.every(w=>x.sk.includes(w)))
    .sort((a,b)=>(b.sp==null?-99:b.sp)-(a.sp==null?-99:a.sp));
  const spT=x=>x.sp==null?'—':x.rf==="cdimais"?'CDI + '+fx(x.sp,2)+'%':(x.sp>=0?'+':'−')+fx(Math.abs(x.sp),2)+' p.p.',txT=x=>x.rf==="cdi"?fx(x.tx,2)+'% do CDI':x.rf==="cdimais"?'CDI + '+fx(x.tx,2)+'%':x.rf==="ipca"?'IPCA + '+fx(x.tx,2)+'%':fx(x.tx,2)+'% a.a.';
  let h='<p class="sub" style="margin:8px 0 4px">'+fx(L.length,0)+' papéis'+(L.length>300?' (os 300 de maior spread abaixo)':'')+(CRB.ref?' · taxas ANBIMA de '+fdate(Date.parse(CRB.ref+"T00:00:00Z")):'')+'.</p>';
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab ordenavel"><thead><tr><th style="text-align:left">Papel</th><th style="text-align:left">Tipo</th><th>Taxa ANBIMA</th><th>Spread</th><th>Duration</th><th>Vencimento</th><th>IR</th><th></th></tr></thead><tbody>'
    +L.slice(0,300).map(x=>'<tr><td style="text-align:left" class="tw"><button type="button" class="link" data-deb="'+esc(x.cod)+'"><b>'+esc(x.cod)+'</b></button><small style="display:block;color:var(--muted)">'+esc(x.nome).slice(0,46)+(x.emissor&&x.tipo!=="Debênture"?' · '+esc(x.emissor).slice(0,30):'')+'</small></td><td style="text-align:left"><small>'+x.tipo+'</small></td><td data-ordem="'+x.tx+'">'+txT(x)+'</td><td data-ordem="'+(x.sp==null?-99:x.sp)+'"><b>'+spT(x)+'</b></td><td data-ordem="'+(x.dur==null?-1:x.dur)+'">'+(x.dur!=null?fx(x.dur,1)+' anos':'—')+'</td><td data-ordem="'+(parseDate(x.venc)||0)+'">'+(x.venc?fdate(parseDate(x.venc)):'—')+'</td><td>'+(x.isento?'<span class="pos">isento PF</span>':'tributado')+'</td><td><button type="button" class="link" data-crbadd="'+esc(x.cod)+'" title="Incluir na carteira aberta">+ carteira</button></td></tr>').join("")+'</tbody></table></div>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Fonte: taxas indicativas da ANBIMA (debêntures e CRI/CRA do dia). Spread: IPCA+ menos a taxa da NTN-B de mesmo vencimento (interpolada, ANBIMA); prefixado menos a LTN de mesmo vencimento; DI+ é o próprio spread sobre o CDI. Duration em anos (dias úteis ÷ 252). Isenção para pessoa física: debêntures incentivadas (Lei 12.431, marcadas com * pela ANBIMA), CRI e CRA. Taxa alta costuma refletir risco de crédito maior: veja o emissor, as garantias e a liquidez antes de investir.</p>';
  box.innerHTML=h}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.crbf)return;CRB.f[t.dataset.crbf]=t.value;try{localStorage.setItem("crbF",JSON.stringify(CRB.f))}catch(x){}crbTabela()});
let CRB_T=0;document.addEventListener("input",e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.crbtxt)return;CRB.f.txt=t.value;clearTimeout(CRB_T);CRB_T=setTimeout(()=>{try{localStorage.setItem("crbF",JSON.stringify(CRB.f))}catch(x){}crbTabela()},200)});
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-crbadd]");if(!b||!CRB.L)return;const x=CRB.L.find(o=>o.cod===b.dataset.crbadd);if(!x)return;
  const c=spC(),lab=spRfLab(x.rf,x.tx),item={t:"s",k:"cr:"+x.cod,rf:x.rf,x:x.tx,isento:x.isento?1:0,n:x.cod+" · "+x.nome.slice(0,40)+" ("+lab+")",tipo:x.tipo,venc:x.venc,prod:x.tipo==="Debênture"?"Debênture":undefined};
  if(c.itens.some(y=>y.k===item.k)){b.textContent="já está na carteira";return}if(c.itens.length>=CMP_MAX){b.textContent="carteira cheia";return}
  const n=c.itens.length+1;c.itens.forEach(y=>y.w=Math.round(+y.w*(n-1)/n*10)/10);item.w=Math.round((100-c.itens.reduce((a,y)=>a+(+y.w||0),0))*10)/10;c.itens.push(item);SP_CMP=null;SP_ASS=null;spSave();
  if(typeof FN!=="undefined"&&FN.view==="sp")FN.view=null;b.textContent="incluído em "+c.nome.slice(0,24)});
