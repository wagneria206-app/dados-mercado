/* ---------- saúde das fontes no cabeçalho: um ícone com a cor da situação (verde, amarelo, vermelho) que abre o painel completo */
function sdStatus(){const D=SD.d;if(!D)return SD.err?{c:"ruim",t:"Não deu para ler a saúde das fontes"}:{c:"",t:"Saúde das fontes: carregando…"};
  const rFal=(D.robos||[]).filter(r=>r.ultimo&&!r.ultimo.ok),ruins=(D.fontes||[]).filter(f=>!f.ok);
  if(rFal.length)return {c:"ruim",t:"Saúde das fontes: "+rFal.length+(rFal.length>1?" robôs":" robô")+" com falha na última execução"+(ruins.length?" e "+ruins.length+(ruins.length>1?" fontes":" fonte")+" com problema":"")};
  if(ruins.length)return {c:"aviso",t:"Saúde das fontes: "+ruins.length+(ruins.length>1?" fontes":" fonte")+" com problema"};
  return {c:"ok",t:"Saúde das fontes: tudo funcionando"}}
function sdIcone(){const b=$("btSaude");if(!b)return;const s=sdStatus();b.dataset.st=s.c;b.title=s.t;b.setAttribute("aria-label",s.t)}
function sdAbre(){let d=$("saudeDlg");if(!d){d=document.createElement("dialog");d.id="saudeDlg";d.className="ajdlg metdlg";d.setAttribute("aria-label","Saúde das fontes");document.body.appendChild(d)}
  const corpo=SD.d?saudeHtml().replace(/^<h3>Saúde das fontes<\/h3>/,""):(basesHtml()||'<p class="sub carregando">Carregando a saúde das fontes…</p>');
  d.innerHTML='<div class="ajhd"><h2>Saúde das fontes</h2><button type="button" class="hbtn" data-sdfecha="1" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><section class="sdcorpo">'+corpo+'</section>';
  if(!d.open){try{d.showModal()}catch(e){d.setAttribute("open","")}}}
document.addEventListener("click",e=>{const g=s=>e.target.closest&&e.target.closest(s);const d=$("saudeDlg");
  if(g("#btSaude")||g("[data-saude]")){e.stopImmediatePropagation();sdLoad();sdAbre();if(!SD.d&&SD.load)SD.load.then(()=>{const x=$("saudeDlg");if(x&&x.open)sdAbre()});return}
  if(d&&(g("[data-sdfecha]")||e.target===d)){try{d.close()}catch(x){d.removeAttribute("open")}}},true);
/* lê ao abrir o app e de novo a cada 30 minutos */
setTimeout(()=>{sdLoad();const p=SD.load;if(p&&p.then)p.then(sdIcone,sdIcone);else sdIcone()},1500);
setInterval(()=>{SD.d=null;SD.err=false;sdLoad();if(SD.load)SD.load.then(sdIcone,sdIcone)},30*60000);
