/* ---------- telas longas mais enxutas: índice no topo, blocos que se recolhem e tabelas compridas resumidas
   Vale para as abas de Mercado com vários blocos (Juros, Economia, EUA e mundo) e para Carteira de investimentos.
   O que fica recolhido é lembrado neste aparelho. Na carteira, na primeira vez, só os dois primeiros blocos ficam abertos. */
const RCL_ABAS=new Set(["ju","ec","mu","sp"]),RCL_LINHAS=12;
function rclChave(){return "rcl_"+activeMod}
function rclFechados(){try{return new Set(JSON.parse(localStorage.getItem(rclChave())||"[]"))}catch(e){return new Set()}}
function rclSalvo(){try{return localStorage.getItem(rclChave())!=null}catch(e){return false}}
function rclGuarda(S){try{localStorage.setItem(rclChave(),JSON.stringify([...S]))}catch(e){}}
function rclTitulo(sec){if(sec.dataset.reltit)return sec.dataset.reltit.replace(/\s*\(.*\)$/,"");const el=sec.querySelector(":scope>h3")||sec.querySelector(":scope>.label")||sec.querySelector("h3");return el?el.textContent.replace(/\s+/g," ").trim():""}
function rclMonta(root){
  if(!root||!RCL_ABAS.has(activeMod)||root.querySelector(":scope>.tlidx"))return;
  const secs=[...root.querySelectorAll(":scope>section.panel")].filter(s=>rclTitulo(s));if(secs.length<2)return;
  const F=rclFechados();
  if(activeMod==="sp"&&!rclSalvo())secs.slice(2).forEach(s=>F.add(rclTitulo(s)));   // carteira: primeira vez, só os dois primeiros abertos
  secs.forEach((s,i)=>{const t=rclTitulo(s);s.id=s.id||"bl-"+activeMod+"-"+i;s.dataset.rcl=t;s.classList.add("rcl");s.classList.toggle("rclsemt",!s.querySelector(":scope>h3,:scope>.label"));s.classList.toggle("fechado",F.has(t));
    if(!s.querySelector(":scope>.rcltg")){const b=document.createElement("button");b.type="button";b.className="rcltg";b.setAttribute("aria-expanded",F.has(t)?"false":"true");b.setAttribute("aria-label","Recolher ou abrir: "+t);b.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';s.prepend(b)}
    // tabelas compridas: mostra as primeiras linhas e um botão para ver todas
    if(activeMod!=="sp")s.querySelectorAll("table").forEach(tb=>{const R=tb.tBodies[0]?[...tb.tBodies[0].rows]:[];if(R.length<=RCL_LINHAS+4||tb.dataset.rclT)return;tb.dataset.rclT="1";R.slice(RCL_LINHAS).forEach(r=>r.classList.add("rclx"));tb.classList.add("rclcurta");
      const b=document.createElement("button");b.type="button";b.className="link rclmais";b.textContent="Mostrar todas as "+R.length+" linhas";(tb.closest(".tablewrap")||tb).after(b)})});
  const nav=document.createElement("nav");nav.className="tlidx";nav.setAttribute("aria-label","Índice desta tela");
  nav.innerHTML='<span class="tlidxl">Nesta tela</span>'+secs.map(s=>'<button type="button" data-rclir="'+s.id+'">'+esc(s.dataset.rcl.length>42?s.dataset.rcl.slice(0,40).replace(/\s\S*$/,"")+"…":s.dataset.rcl)+'</button>').join("")
    +'<span class="tlidxa"><button type="button" class="link" data-rcltodos="0">Recolher tudo</button><button type="button" class="link" data-rcltodos="1">Abrir tudo</button></span>';
  root.prepend(nav)}
function rclAlterna(s,abre){const F=rclFechados(),t=s.dataset.rcl;s.classList.toggle("fechado",!abre);const b=s.querySelector(":scope>.rcltg");if(b)b.setAttribute("aria-expanded",abre?"true":"false");if(abre)F.delete(t);else F.add(t);rclGuarda(F)}
let RCL_RAF=0;
new MutationObserver(()=>{cancelAnimationFrame(RCL_RAF);RCL_RAF=requestAnimationFrame(()=>rclMonta($("mkOut")))}).observe($("mkOut")||document.createElement("div"),{childList:true});
let RCL_RAF2=0;   // carteira: os blocos ficam em #spRes, refeito a cada cálculo
new MutationObserver(()=>{cancelAnimationFrame(RCL_RAF2);RCL_RAF2=requestAnimationFrame(()=>{if(activeMod==="sp")rclMonta($("spRes"))})}).observe($("fnOut")||document.createElement("div"),{childList:true,subtree:true});
document.addEventListener("click",e=>{const g=s=>e.target.closest&&e.target.closest(s);let x;
  if((x=g(".rcltg"))){const s=x.closest("section.rcl");rclAlterna(s,s.classList.contains("fechado"));return}
  if((x=g("section.rcl.fechado"))&&!g("button,a,input,select")){rclAlterna(x,true);return}
  if((x=g("[data-rclir]"))){const s=$(x.dataset.rclir);if(!s)return;if(s.classList.contains("fechado"))rclAlterna(s,true);const y=s.getBoundingClientRect().top+window.scrollY-(document.querySelector(".areas")||{offsetHeight:0}).offsetHeight-8;window.scrollTo({top:y,behavior:"smooth"});return}
  if((x=g("[data-rcltodos]"))){const abre=x.dataset.rcltodos==="1";const raiz=x.closest(".tlidx").parentElement;raiz.querySelectorAll(":scope>section.rcl").forEach(s=>rclAlterna(s,abre));return}
  if((x=g(".rclmais"))){const tb=x.previousElementSibling&&(x.previousElementSibling.matches("table")?x.previousElementSibling:x.previousElementSibling.querySelector("table"));if(!tb)return;const curta=tb.classList.toggle("rclcurta");x.textContent=curta?"Mostrar todas as "+tb.tBodies[0].rows.length+" linhas":"Mostrar menos";return}
});

/* ---------- Agenda de proventos: grupos por período, com índice no topo e grupos que se recolhem */
function agGrupo(d,hoje,rec){
  const t=Date.parse(d+"T00:00:00Z"),h=Date.parse(hoje+"T00:00:00Z"),dw=(new Date(h).getUTCDay()+6)%7,seg=h-dw*DAY,dif=Math.floor((t-seg)/(7*DAY));
  if(!rec){if(dif<=0)return ["s0","Esta semana"];if(dif===1)return ["s1","Próxima semana"]}
  else{if(dif>=0)return ["s0","Esta semana"];if(dif===-1)return ["s1","Semana passada"]}
  const x=new Date(t);return ["m"+x.getUTCFullYear()+String(x.getUTCMonth()).padStart(2,"0"),RM_MES[x.getUTCMonth()].replace(/^./,c=>c.toUpperCase())+" de "+x.getUTCFullYear()]}
