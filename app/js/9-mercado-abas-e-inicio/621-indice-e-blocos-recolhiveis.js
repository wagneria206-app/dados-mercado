/* ---------- recolher e abrir blocos em todas as telas: índice no topo (telas com 3 ou mais blocos), blocos que se recolhem
   e tabelas compridas resumidas (abas de Mercado). O que fica recolhido é lembrado neste aparelho, tela por tela.
   Só entram blocos com título; telas de um bloco só não ganham o botão (não há o que recolher). */
const RCL_LINHAS=12,RCL_SEMIDX=new Set(["sp","pub","pc","bank","fund","sim","sc"]);
function rclChave(){return "rcl_"+activeMod}
function rclFechados(){try{return new Set(JSON.parse(localStorage.getItem(rclChave())||"[]"))}catch(e){return new Set()}}
function rclGuarda(S){try{localStorage.setItem(rclChave(),JSON.stringify([...S]))}catch(e){}}
function rclTitulo(sec){if(sec.dataset.reltit)return sec.dataset.reltit.replace(/\s*\(.*\)$/,"");const el=sec.querySelector(":scope>h2")||sec.querySelector(":scope>h3")||sec.querySelector(":scope>.label")||sec.querySelector(":scope>.fnh1 h3,:scope>div>h3,:scope>div>h2,:scope>div>.label")||sec.querySelector("h3,h2");return el?el.textContent.replace(/\s+/g," ").trim():(sec.getAttribute("aria-label")||"")}
/* blocos da tela atual: painéis visíveis com título, sem contar painel dentro de painel */
function rclBlocos(){const W=document.querySelector(".wrap")||document.body;
  return [...W.querySelectorAll("section.panel,section.notes")].filter(s=>(s.offsetParent!==null||s.classList.contains("fechado"))&&!s.hidden&&!s.classList.contains("spvazio")&&!s.parentElement.closest("section.panel,section.notes")&&!s.closest("header,.tlidx,[hidden],details")&&rclTitulo(s))}
function rclMonta(){
  const secs=rclBlocos();if(secs.length<2){secs.forEach(s=>{if(s.classList.contains("rcl")){s.classList.remove("rcl","fechado");const b=s.querySelector(":scope>.rcltg");if(b)b.remove()}});return}
  const F=rclFechados(),mk=typeof MKM!=="undefined"&&MKM.has(activeMod);
  secs.forEach((s,i)=>{const t=rclTitulo(s),fixo=s.id&&!/^bl-/.test(s.id);s.id=s.id||"bl-"+activeMod+"-"+i;s.dataset.rcl=t;s.dataset.rclk=fixo?"#"+s.id:t;const k=s.dataset.rclk;s.classList.add("rcl");s.classList.toggle("rclsemt",!s.querySelector(":scope>h2,:scope>h3,:scope>.label"));s.classList.toggle("fechado",F.has(k));
    let b=s.querySelector(":scope>.rcltg");if(!b){b=document.createElement("button");b.type="button";b.className="rcltg";b.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';s.prepend(b)}
    b.setAttribute("aria-expanded",F.has(k)?"false":"true");b.setAttribute("aria-label","Recolher ou abrir: "+t);
    // tabelas compridas (abas de Mercado): mostra as primeiras linhas e um botão para ver todas
    if(mk)s.querySelectorAll("table").forEach(tb=>{const R=tb.tBodies[0]?[...tb.tBodies[0].rows]:[];if(R.length<=RCL_LINHAS+4||tb.dataset.rclT)return;tb.dataset.rclT="1";R.slice(RCL_LINHAS).forEach(r=>r.classList.add("rclx"));tb.classList.add("rclcurta");
      const m=document.createElement("button");m.type="button";m.className="link rclmais";m.textContent="Mostrar todas as "+R.length+" linhas";(tb.closest(".tablewrap")||tb).after(m)})});
  // índice "Nesta tela": refeito quando os blocos mudam
  const key=activeMod+"|"+secs.map(s=>s.dataset.rcl).join("|");let nav=document.querySelector(".wrap nav.rclidx");
  if(secs.length<3||RCL_SEMIDX.has(activeMod)){if(nav)nav.remove();return}
  if(nav&&nav.dataset.k===key&&nav.nextElementSibling===secs[0])return;if(nav)nav.remove();
  nav=document.createElement("nav");nav.className="tlidx rclidx";nav.dataset.k=key;nav.setAttribute("aria-label","Índice desta tela");
  nav.innerHTML='<span class="tlidxl">Nesta tela</span>'+secs.map(s=>'<button type="button" data-rclir="'+s.id+'">'+esc(s.dataset.rcl.length>42?s.dataset.rcl.slice(0,40).replace(/\s\S*$/,"")+"…":s.dataset.rcl)+'</button>').join("")
    +'<span class="tlidxa"><button type="button" class="link" data-rcltodos="0">Recolher tudo</button><button type="button" class="link" data-rcltodos="1">Abrir tudo</button></span>';
  secs[0].before(nav)}
function rclAlterna(s,abre){const F=rclFechados(),t=s.dataset.rclk||s.dataset.rcl;s.classList.toggle("fechado",!abre);const b=s.querySelector(":scope>.rcltg");if(b)b.setAttribute("aria-expanded",abre?"true":"false");if(abre)F.delete(t);else F.add(t);rclGuarda(F)}
let RCL_RAF=0;   // qualquer tela que se redesenha passa de novo pela montagem (só mudanças de conteúdo, não de classe)
new MutationObserver(()=>{cancelAnimationFrame(RCL_RAF);RCL_RAF=requestAnimationFrame(rclMonta)}).observe(document.querySelector(".wrap")||document.body,{childList:true,subtree:true});
document.addEventListener("click",e=>{const g=s=>e.target.closest&&e.target.closest(s);let x;
  if((x=g(".rcltg"))){const s=x.closest("section.rcl");rclAlterna(s,s.classList.contains("fechado"));return}
  if((x=g("section.rcl.fechado"))&&!g("button,a,input,select")){rclAlterna(x,true);return}
  if((x=g("[data-rclir]"))){const s=$(x.dataset.rclir);if(!s)return;if(s.classList.contains("fechado"))rclAlterna(s,true);const y=s.getBoundingClientRect().top+window.scrollY-(document.querySelector(".areas")||{offsetHeight:0}).offsetHeight-8;window.scrollTo({top:y,behavior:"smooth"});return}
  if((x=g("[data-rcltodos]"))){const abre=x.dataset.rcltodos==="1";rclBlocos().forEach(s=>{if(s.classList.contains("rcl"))rclAlterna(s,abre)});return}
  if((x=g(".rclmais"))){const tb=x.previousElementSibling&&(x.previousElementSibling.matches("table")?x.previousElementSibling:x.previousElementSibling.querySelector("table"));if(!tb)return;const curta=tb.classList.toggle("rclcurta");x.textContent=curta?"Mostrar todas as "+tb.tBodies[0].rows.length+" linhas":"Mostrar menos";return}
});

/* ---------- Agenda de proventos: grupos por período, com índice no topo e grupos que se recolhem */
function agGrupo(d,hoje,rec){
  const t=Date.parse(d+"T00:00:00Z"),h=Date.parse(hoje+"T00:00:00Z"),dw=(new Date(h).getUTCDay()+6)%7,seg=h-dw*DAY,dif=Math.floor((t-seg)/(7*DAY));
  if(!rec){if(dif<=0)return ["s0","Esta semana"];if(dif===1)return ["s1","Próxima semana"]}
  else{if(dif>=0)return ["s0","Esta semana"];if(dif===-1)return ["s1","Semana passada"]}
  const x=new Date(t);return ["m"+x.getUTCFullYear()+String(x.getUTCMonth()).padStart(2,"0"),RM_MES[x.getUTCMonth()].replace(/^./,c=>c.toUpperCase())+" de "+x.getUTCFullYear()]}
