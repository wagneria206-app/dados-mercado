/* ---------- gestoras e administradoras */
FN.gp={tipo:"g",q:"",sort:"pl",dir:-1,n:50};
function fnGest(){
  const o=$("fnOut");if(!o)return;if(FN.view!=="fg"){FN.view="fg";o.innerHTML='<section class="panel"><h3>Gestoras e administradoras</h3><p class="sub">Patrimônio, número de fundos e captação de cada instituição (fundos com cota diária na CVM).</p>'+fnSeg("fngp",[["g","Gestoras"],["a","Administradoras"]],FN.gp.tipo)+'<div class="field" style="max-width:420px;margin-top:6px"><label for="fgQ">Buscar</label><input id="fgQ" autocomplete="off" value="'+esc(FN.gp.q)+'"></div><div id="fgT"></div></section>'}
  if(!FN.idx){$("fgT").innerHTML='<p class="sub">Carregando…</p>';fnBoot();return}
  fnGestTable();
}
function fnGestTable(){
  const t=$("fgT");if(!t||!FN.idx)return;const C=FN.C,I=FN.idx,g=FN.gp,col=g.tipo==="g"?C.gestor:C.adm,lista=g.tipo==="g"?I.gestores:(I.adms||[]);
  if(col==null){t.innerHTML='<p class="sub">A lista de administradoras aparece depois da próxima coleta do robô.</p>';return}
  const A=new Map();I.rows.forEach(r=>{const k=r[col];if(k==null||!lista[k])return;let a=A.get(k);if(!a){a={k,n:0,pl:0,cap:0,cot:0,ab:0};A.set(k,a)}a.n++;a.pl+=r[C.pl]||0;a.cap+=r[C.capt12]||0;a.cot+=r[C.cotistas]||0;if(!(r[C.flags]&1))a.ab++});
  const q=fnNorm(g.q);let L=[...A.values()].filter(a=>!q||fnNorm(lista[a.k]).includes(q));
  L.sort((a,b)=>g.sort==="nome"?g.dir*lista[a.k].localeCompare(lista[b.k]):g.dir*(a[g.sort]-b[g.sort]));
  const th=(c,l)=>'<th data-fgsort="'+c+'"'+(c==="nome"?' style="text-align:left"':'')+'>'+l+(g.sort===c?(g.dir<0?' ▾':' ▴'):'')+'</th>';
  let h='<p class="sub" style="margin:8px 0 4px">'+fx(L.length,0)+' '+(g.tipo==="g"?"gestoras":"administradoras")+'.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th>#</th>'+th("nome",g.tipo==="g"?"Gestora":"Administradora")+th("pl","Patrimônio")+th("n","Fundos")+'<th class="c-ph">Não exclusivos</th>'+th("cap","Captação 12m")+'<th class="c-ph">Cotistas</th></tr></thead><tbody>';
  L.slice(0,g.n).forEach((a,j)=>{h+='<tr><td><small>'+(j+1)+'</small></td><td style="text-align:left" class="tw"><button type="button" class="link" data-fgopen="'+g.tipo+'|'+a.k+'">'+esc(lista[a.k])+'</button></td><td>'+fnMoney(a.pl)+'</td><td>'+fx(a.n,0)+'</td><td class="c-ph">'+fx(a.ab,0)+'</td><td>'+fnMoney(a.cap)+'</td><td class="c-ph">'+fnInt(a.cot)+'</td></tr>'});
  h+='</tbody></table></div>'+(L.length>g.n?'<button type="button" class="btn sec" data-fgmore="1" style="margin-top:10px">Mostrar mais 50</button>':'');
  t.innerHTML=h;
}
document.addEventListener("click",e=>{if(!(e.target.closest&&e.target.closest("#modFn")))return;const g=a=>e.target.closest("["+a+"]");let x;
  if((x=g("data-fngp"))){FN.gp.tipo=x.dataset.fngp;FN.gp.n=50;FN.view=null;fnGest();return}
  if((x=g("data-fgsort"))){const c=x.dataset.fgsort;if(FN.gp.sort===c)FN.gp.dir*=-1;else{FN.gp.sort=c;FN.gp.dir=c==="nome"?1:-1}fnGestTable();return}
  if((x=g("data-fgmore"))){FN.gp.n+=50;fnGestTable();return}
  if((x=g("data-fgopen"))){const [tp,k]=x.dataset.fgopen.split("|");Object.assign(FN.rk,{tipo:"",cls:"",anb:"",txt:"",ges:tp==="g"?k:"",adm:tp==="a"?k:"",n:50,exc:1,qual:1,prof:1,pl:0,cot:0});fnSave();setMod("fr");return}
});
document.addEventListener("input",e=>{if(e.target&&e.target.id==="fgQ"){FN.gp.q=e.target.value;FN.gp.n=50;clearTimeout(FN_QT);FN_QT=setTimeout(fnGestTable,150)}});

