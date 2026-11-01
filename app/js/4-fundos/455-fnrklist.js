function fnRkList(){
  fnQuartis();const I=FN.idx,C=FN.C,rk=FN.rk,tx=fnNorm(rk.txt).split(/\s+/).filter(Boolean);
  const L=[];I.rows.forEach((r,j)=>{if(rk.tipo!==""&&r[C.tipo]!==+rk.tipo)return;if(rk.cls!==""&&r[C.classe]!==+rk.cls)return;if(rk.anb!==""&&r[C.anbima]!==+rk.anb)return;
    if((r[C.pl]||0)<+rk.pl||(r[C.cotistas]||0)<+rk.cot)return;const fl=r[C.flags];if(!rk.exc&&fl&1)return;if(!rk.prof&&fl&4)return;if(!rk.qual&&fl&2)return;
    if(tx.length&&!tx.every(w=>FN.sk[j].includes(w)))return;
    if(rk.ges!==""&&r[C.gestor]!==+rk.ges)return;if(rk.adm!==""&&C.adm!=null&&r[C.adm]!==+rk.adm)return;
    if(rk.tmax!==""&&(r[C.tadm]==null||r[C.tadm]>+rk.tmax))return;
    if(rk.amax!==""&&C.amin!=null&&(r[C.amin]==null||r[C.amin]>+rk.amax))return;
    if(rk.rmax!==""&&C.dres!=null&&(r[C.dres]==null||r[C.dres]>+rk.rmax))return;
    if(rk.idade!==""){const ini=r[C.inicio];if(!ini)return;const lim=(+ini.slice(0,4)+ +rk.idade)+ini.slice(4)+"-01";if(lim>(FN.idx.dt||""))return}
    if(!fnRkExtra(r))return;
    L.push(r)});
  const k=C[rk.sort],d=rk.dir;L.sort((a,b)=>{const x=a[k],y=b[k];if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return typeof x==="string"?d*x.localeCompare(y):d*(x-y)});
  return L;
}
function fnRkTable(){
  const t=$("fnRkT");if(!t)return;const C=FN.C,rk=FN.rk,L=fnRkList();
  const cols=[["nome","Fundo",""],["pl","PL",""],["cotistas","Cotistas","c-ph c-md"],["rm","Mês","c-ph c-sm"],["ra","Ano",""],["r12","12m",""],["r24","24m","c-ph c-sm"],["r36","36m",""],["v12","Vol. 12m","c-ph"],["sharpe","Sharpe 12m","c-ph c-sm"],["dd36","Perda máx. 36m","c-ph"],["capt12","Captação 12m","c-ph c-md"],["tadm","Taxa adm.","c-ph"],["amin","Aplic. mín.","c-ph c-md"],["dres","Resgate","c-ph c-md"],["q12","Quartil 12m","c-ph c-md"],["q36","Quartil 36m","c-ph c-md"]].concat(C.cons!=null?[["cons","Consist.","c-ph c-md"]]:[]);
  let h='<p class="sub" style="margin:8px 0 4px">'+fx(L.length,0)+' fundos. CDI em 12 meses: '+fnPctT(FN.idx.cdi12)+'.</p><div class="tablewrap" style="max-height:none"><table class="ctab fnrk"><thead><tr><th>#</th>'+cols.map(([c,l,cl])=>'<th data-fnsort="'+c+'" class="'+cl+'"'+(c==="nome"?' style="text-align:left"':'')+'>'+l+(rk.sort===c?(rk.dir<0?' ▾':' ▴'):'')+'</th>').join("")+'<th></th></tr></thead><tbody>';
  L.slice(0,rk.n).forEach((r,j)=>{h+='<tr><td><small>'+(j+1)+'</small></td><td class="tw" style="text-align:left;min-width:180px"><button type="button" class="link fnnm" data-fnopen="'+r[0]+'">'+esc(r[1])+'</button><small>'+esc(FN.idx.gestores[r[C.gestor]]||"")+(FN.idx.anbima[r[C.anbima]]?' · '+esc(FN.idx.anbima[r[C.anbima]]):'')+'</small></td>'
    +'<td>'+fnMoney(r[C.pl])+'</td><td class="c-ph c-md">'+fnInt(r[C.cotistas])+'</td><td class="c-ph c-sm">'+fnPct(r[C.rm])+'</td><td>'+fnPct(r[C.ra])+'</td><td><b>'+fnPct(r[C.r12])+'</b></td><td class="c-ph c-sm">'+fnPct(r[C.r24])+'</td><td>'+fnPct(r[C.r36])+'</td>'
    +'<td class="c-ph">'+(r[C.v12]!=null?fx(r[C.v12],2)+'%':'—')+'</td><td class="c-ph c-sm">'+(r[C.sharpe]!=null?fx(r[C.sharpe],2):'—')+'</td><td class="c-ph">'+fnPct(r[C.dd36])+'</td><td class="c-ph c-md">'+fnMoney(r[C.capt12])+'</td><td class="c-ph">'+(r[C.tadm]!=null?fx(r[C.tadm],2)+'%':'—')+'</td><td class="c-ph c-md">'+(C.amin!=null&&r[C.amin]!=null?(r[C.amin]?fnMoney(r[C.amin]):'—'):'—')+'</td><td class="c-ph c-md">'+(C.dres!=null&&r[C.dres]!=null?'D+'+fx(r[C.dres],0):'—')+'</td>'+'<td class="c-ph c-md">'+(r[C.q12]?'<span class="fnq fnq'+r[C.q12]+'">'+r[C.q12]+'º</span>':'—')+'</td><td class="c-ph c-md">'+(r[C.q36]?'<span class="fnq fnq'+r[C.q36]+'">'+r[C.q36]+'º</span>':'—')+'</td>'+(C.cons!=null?'<td class="c-ph c-md">'+(r[C.cons]!=null?fx(r[C.cons],0)+'%':'—')+'</td>':'')+''
    +'<td><button type="button" class="link" data-fncmp="'+r[0]+'" title="Adicionar ao comparador">'+(FN.cmp.includes(r[0])?'✓':'+')+'</button></td></tr>'});
  h+='</tbody></table></div>'+(L.length>rk.n?'<button type="button" class="btn sec" data-fnmore="1" style="margin-top:10px">Mostrar mais 50</button>':'');
  t.innerHTML=h;
}

function fnCmpToggle(k){const i=FN.cmp.indexOf(k);if(i>=0)FN.cmp.splice(i,1);else{if(FN.cmp.length>=CMP_MAX){alertLite("O comparador aceita até "+CMP_MAX+" fundos. Remova um para incluir outro.");return}FN.cmp.push(k)}fnSave()}
function alertLite(msg){const o=$("fnOut");if(!o)return;let d=document.querySelector(".fnmsg");if(!d){d=document.createElement("div");d.className="fnmsg";o.prepend(d)}d.textContent=msg;clearTimeout(alertLite.t);alertLite.t=setTimeout(()=>d.remove(),4000)}

/* eventos */
document.addEventListener("click",e=>{
  const root=e.target.closest&&e.target.closest("#modFn");if(!root)return;
  const g=(a)=>e.target.closest("["+a+"]");let x;
  if((x=g("data-fnopen"))){fnOpen(x.dataset.fnopen);return}
  if((x=g("data-fnretry"))){FN.err=null;fnCalc();return}
  if((x=g("data-fnper"))){FN.per=x.dataset.fnper;fnRender();return}
  if((x=g("data-fnrper"))){FN.rper=x.dataset.fnrper;fnRender();return}
  if((x=g("data-fntab"))){FN.tabCmp=x.dataset.fntab;fnRender();return}
  if((x=g("data-fncper"))){FN.cper=x.dataset.fncper;fnCmp();return}
  if((x=g("data-fncmp"))){fnCmpToggle(x.dataset.fncmp);if(activeMod==="fa")fnFa();else if(activeMod==="fr")fnRkTable();else fnCmp();return}
  if((x=g("data-fnrm"))){fnCmpToggle(x.dataset.fnrm);fnCmp();return}
  if((x=g("data-fnsort"))){const c=x.dataset.fnsort;if(FN.rk.sort===c)FN.rk.dir*=-1;else{FN.rk.sort=c;FN.rk.dir=c==="nome"||c==="v12"||c==="tadm"||c==="amin"||c==="dres"?1:-1}FN.rk.n=50;fnSave();fnRkTable();return}
  if((x=g("data-fnmore"))){FN.rk.n+=50;fnRkTable();return}
  if((x=g("data-fnrkx"))){FN.rk[x.dataset.fnrkx]="";FN.rk.n=50;fnSave();fnRk();return}
  if((x=g("data-fnrkcat"))){const [a,t]=x.dataset.fnrkcat.split("|");Object.assign(FN.rk,{tipo:t,cls:"",anb:"",txt:"",ges:"",adm:"",n:50,sort:"r12",dir:-1});if(a[0]==="a")FN.rk.anb=a.slice(1);else FN.rk.cls=a.slice(1);fnSave();setMod("fr");return}
  if((x=g("data-fncalc"))){const k=x.dataset.fncalc;setMod("fund");setTimeout(()=>{const i=$("fdCnpj");if(i){i.value=fnCnpjF(k);i.dispatchEvent(new Event("input",{bubbles:true}));const bt=$("fdFetch");if(bt)bt.click()}try{window.scrollTo({top:0,behavior:"smooth"})}catch(y){}},0);return}
  if(!e.target.closest(".fnqbox"))document.querySelectorAll("#modFn .fnres").forEach(r=>r.hidden=true);
});
document.addEventListener("click",e=>{if(!(e.target.closest&&e.target.closest("#modFn")))document.querySelectorAll("#modFn .fnres").forEach(r=>r.hidden=true)});
document.addEventListener("change",e=>{
  const t=e.target;if(!(t.closest&&t.closest("#modFn")))return;
  if(t.dataset.fnbm){FN.bm[t.dataset.fnbm]=t.checked?1:0;fnSave();fnRender();return}
  if(t.dataset.fnrkc){FN.rk[t.dataset.fnrkc]=t.checked?1:0;FN.rk.n=50;fnSave();fnRkTable();return}
  if(t.dataset.fnrk&&t.tagName==="SELECT"){const m=Object.assign({rkTipo:"tipo",rkCls:"cls",rkAnb:"anb",rkPl:"pl",rkCot:"cot",rkTmax:"tmax",rkAmax:"amax",rkRmax:"rmax",rkIdade:"idade"},FN_RKX)[t.id];FN.rk[m]=t.value;if(m==="tipo"||m==="cls")FN.rk.anb="";FN.rk.n=50;fnSave();if(m==="tipo"||m==="cls")fnRk();else fnRkTable()}
});
let FN_QT=null;
document.addEventListener("input",e=>{
  const t=e.target;if(!t||!FN.idx)return;
  if(t.id==="fnQ"||t.id==="fnCq"){FN.q=t.id==="fnQ"?t.value:FN.q;const box=$(t.id==="fnQ"?"fnRes":"fnCres");clearTimeout(FN_QT);FN_QT=setTimeout(()=>{const v=t.value.trim();if(v.length<2){box.hidden=true;return}
    const js=fnSearch(v,12);box.innerHTML=t.id==="fnQ"?fnResHtml(js):js.map(j=>{const r=FN.idx.rows[j];return '<button type="button" class="fnri" data-fnadd="'+r[0]+'"><b>'+esc(r[1])+'</b><small>'+fnCnpjF(r[0])+' · PL '+fnMoney(r[FN.C.pl])+'</small></button>'}).join("")||'<div class="fnri"><small>Nenhum fundo encontrado.</small></div>';box.hidden=false},120);return}
  if(t.id==="rkTxt"){FN.rk.txt=t.value;FN.rk.n=50;clearTimeout(FN_QT);FN_QT=setTimeout(()=>{fnSave();fnRkTable()},200)}
});
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-fnadd]");if(!x)return;const k=x.dataset.fnadd;if(!FN.cmp.includes(k))fnCmpToggle(k);const q=$("fnCq");if(q)q.value="";$("fnCres").hidden=true;fnCmp()});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target&&e.target.id==="fnQ"&&FN.idx){const js=fnSearch(e.target.value,1);if(js.length){e.preventDefault();fnOpen(FN.idx.rows[js[0]][0])}}});
window.addEventListener("hashchange",()=>{if(FN.idx)fnHash();else{const m=/fundo=([0-9A-Z]{14,16})/i.exec(location.hash||"");if(m){FN.cur=m[1];if(activeMod!=="fa")setMod("fa")}}if(FNM.has(activeMod)&&!/ativo=/.test(location.hash))fnCalc()});

