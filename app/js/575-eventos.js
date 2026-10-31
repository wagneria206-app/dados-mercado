/* ---------- eventos */
document.addEventListener("click",e=>{const g=a=>e.target.closest&&e.target.closest("["+a+"]");let x;
  if((x=g("data-euper"))){EU.per=x.dataset.euper;euSave();if(activeMod==="au"){$("euPainel").innerHTML=painelHtml("eua")}else if(activeMod==="rs"&&typeof mkCalc==="function")mkCalc();return}
  if((x=g("data-eusort"))){const c=x.dataset.eusort;if(EU.rk.sort===c)EU.rk.dir*=-1;else{EU.rk.sort=c;EU.rk.dir=["t","setor","pl","pvp"].includes(c)?1:-1}EU.rk.n=50;euSave();euRkTable();return}
  if((x=g("data-eumore"))){EU.rk.n+=50;euRkTable();return}
});
document.addEventListener("change",e=>{const t=e.target;if(!(t&&t.dataset&&t.dataset.eurk))return;const m={euSet:"setor",euLiq:"liq"}[t.id];EU.rk[m]=t.value;EU.rk.n=50;euSave();euRkTable()});
let EU_QT=null;
document.addEventListener("input",e=>{const t=e.target;if(!t||t.id!=="euTxt")return;EU.rk.txt=t.value;EU.rk.n=50;clearTimeout(EU_QT);EU_QT=setTimeout(()=>{euSave();euRkTable()},200)});

