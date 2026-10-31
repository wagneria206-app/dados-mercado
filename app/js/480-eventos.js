/* ---------- eventos */
document.addEventListener("click",e=>{
  if(!(e.target.closest&&e.target.closest("#modFn")))return;const g=a=>e.target.closest("["+a+"]");let x;
  if((x=g("data-atopen"))){atOpen(x.dataset.atopen);return}
  if((x=g("data-atretry"))){AT.err=null;atCalc(activeMod);return}
  if((x=g("data-atcmp"))){atCmpToggle(x.dataset.atcmp);if(activeMod==="aa")atAa();else if(activeMod==="ar")atRkTable();else if(activeMod==="au")euRkTable();else atCmp();return}
  if((x=g("data-atrm"))){atCmpToggle(x.dataset.atrm);atCmp();return}
  if((x=g("data-atadd"))){const k=x.dataset.atadd;if(!AT.cmp.includes(k))atCmpToggle(k);const q=$("atCq");if(q)q.value="";$("atCres").hidden=true;atCmp();return}
  if((x=g("data-atsort"))){const c=x.dataset.atsort;if(AT.rk.sort===c)AT.rk.dir*=-1;else{AT.rk.sort=c;AT.rk.dir=["t","pl","pvp","evebit","dlebit","v12"].includes(c)?1:-1}AT.rk.n=50;atSave();atRkTable();return}
  if((x=g("data-atmore"))){AT.rk.n+=50;atRkTable();return}
  if((x=g("data-atrkcat"))){const [tp,st]=x.dataset.atrkcat.split("|");Object.assign(AT.rk,{tipo:tp,setor:st,txt:"",n:50,sort:"r12",dir:-1,liq:1e5});atSave();setMod("ar");return}
});
document.addEventListener("change",e=>{const t=e.target;if(!(t&&t.dataset&&t.dataset.atrk))return;const m={arTipo:"tipo",arSet:"setor",arLiq:"liq"}[t.id];AT.rk[m]=t.value;if(m==="tipo")AT.rk.setor="";AT.rk.n=50;atSave();if(m==="tipo")atRk();else atRkTable()});
let AT_QT=null;
document.addEventListener("input",e=>{
  const t=e.target;if(!t||!AT.idx)return;
  if(t.id==="atQ"||t.id==="atCq"){if(t.id==="atQ")AT.q=t.value;const box=$(t.id==="atQ"?"atRes":"atCres");clearTimeout(AT_QT);AT_QT=setTimeout(()=>{const v=t.value.trim();if(v.length<2){box.hidden=true;return}box.innerHTML=atResHtml(atSearch(v,12),t.id==="atQ"?"atopen":"atadd");box.hidden=false},100);return}
  if(t.id==="arTxt"){AT.rk.txt=t.value;AT.rk.n=50;clearTimeout(AT_QT);AT_QT=setTimeout(()=>{atSave();atRkTable()},200)}
});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target&&e.target.id==="atQ"&&AT.idx){const js=atSearch(e.target.value,1);if(js.length){e.preventDefault();atOpen(AT.idx.rows[js[0]][0])}}});
window.addEventListener("hashchange",()=>{if(AT.idx)atHash();else{const m=/ativo=([A-Z0-9-]{4,16})/i.exec(location.hash||"");if(m){AT.cur=m[1].toUpperCase();if(activeMod!=="aa")setMod("aa")}}});

