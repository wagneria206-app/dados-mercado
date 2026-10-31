/* ---------- segurança deste aparelho
   - token do GitHub protegido por senha: guardado criptografado (AES-GCM, chave PBKDF2-SHA-256 com 310 mil iterações);
     depois de desbloqueado fica só na memória, até fechar o app;
   - data de validade do token, com aviso 14 dias antes;
   - cópia em arquivo criptografada com senha;
   - apagar todos os dados do app deste aparelho (para aparelho perdido, trocado ou emprestado). */
const SEG={erro:"",tent:0,apagar:false,bkp:false,rest:null};
const segB64=u=>{let s="";const a=new Uint8Array(u);for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode.apply(null,a.subarray(i,i+8192));return btoa(s)};
const segU8=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
async function segChave(senha,sal){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(senha),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt:sal,iterations:310000,hash:"SHA-256"},k,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function segCifra(txt,senha){const s=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const c=await crypto.subtle.encrypt({name:"AES-GCM",iv},await segChave(senha,s),new TextEncoder().encode(txt));return {alg:"AES-GCM/PBKDF2-SHA256-310000",s:segB64(s),iv:segB64(iv),c:segB64(c)}}
async function segDecifra(o,senha){const p=await crypto.subtle.decrypt({name:"AES-GCM",iv:segU8(o.iv)},await segChave(senha,segU8(o.s)),segU8(o.c));return new TextDecoder().decode(p)}
function segTokC(){try{return JSON.parse(localStorage.getItem("ghTokC")||"null")}catch(e){return null}}
function segProtegido(){return !!segTokC()}
function segValidade(){try{return localStorage.getItem("ghTokVal")||""}catch(e){return ""}}
function segDiasValidade(){const v=segValidade();if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;return Math.floor((Date.parse(v+"T23:59:59Z")-Date.now())/864e5)}
/* aviso de validade (aparece uma vez por sessão, quando faltam 14 dias ou menos) */
setTimeout(()=>{const d=segDiasValidade();if(d!=null&&d<=14&&(SYNC.tok||segProtegido())){try{fvToast([d<0?"O token do GitHub deste aparelho venceu: crie um novo e conecte em Ajustes.":"O token do GitHub deste aparelho vence em "+d+(d===1?" dia":" dias")+": crie um novo e troque em Ajustes."])}catch(e){}}},9000);

function segHtml(){
  const P=segProtegido(),d=segDiasValidade(),v=segValidade();let h='';
  // token
  if(SYNC.tok||P){
    h+='<div class="segbl"><b>Token do GitHub</b>';
    if(P&&!SYNC.tok)h+='<p class="sub">Protegido por senha e bloqueado. Digite a senha para voltar a sincronizar.</p><div class="segrow"><input id="segSenha" type="password" autocomplete="current-password" placeholder="Senha"><button type="button" class="btn" data-segdesb="1">Desbloquear</button></div>';
    else if(P)h+='<p class="sub">Guardado criptografado e protegido por senha. Desbloqueado até fechar o app.</p><div class="segrow"><button type="button" class="btn sec" data-segbloq="1">Bloquear agora</button><button type="button" class="link" data-segsem="1">Tirar a proteção</button></div>';
    else h+='<p class="sub">Guardado neste navegador sem senha. Com uma senha, o token fica criptografado e só é usado depois de desbloqueado; quem pegar o aparelho ou uma extensão do navegador não consegue lê-lo.</p><div class="segrow"><input id="segNova" type="password" autocomplete="new-password" placeholder="Nova senha (mín. 8 caracteres)"><button type="button" class="btn" data-segprot="1">Proteger com senha</button></div>';
    h+='<div class="segrow"><label for="segVal" class="sub">Validade do token</label><input id="segVal" type="date" value="'+esc(v)+'"><span class="sub">'+(d==null?'informe a data que aparece no GitHub':d<0?'<span class="neg">vencido</span>':d<=14?'<span class="neg">vence em '+d+' dias</span>':'vence em '+d+' dias')+'</span></div></div>'}
  // cópia criptografada
  h+='<div class="segbl"><b>Cópia em arquivo</b><p class="sub">Favoritos, alertas e carteiras num arquivo criptografado com senha. Sem a senha ninguém consegue abrir.</p>';
  h+=SEG.bkp?'<div class="segrow"><input id="segBkpS" type="password" autocomplete="new-password" placeholder="Senha do arquivo (mín. 8 caracteres)"><button type="button" class="btn" data-segbkpok="1">Baixar</button><button type="button" class="link" data-segbkp="0">Cancelar</button></div>'
    :'<div class="segrow"><button type="button" class="btn sec" data-segbkp="1">Baixar cópia criptografada</button><label class="link" for="bkpIn" style="cursor:pointer">Restaurar de um arquivo</label><input id="bkpIn" type="file" accept=".json,application/json" hidden></div>';
  if(SEG.rest)h+='<div class="segrow"><input id="segRestS" type="password" autocomplete="current-password" placeholder="Senha do arquivo"><button type="button" class="btn" data-segrestok="1">Abrir arquivo</button></div>';
  h+='</div>';
  // apagar
  h+='<div class="segbl"><b>Apagar os dados deste aparelho</b><p class="sub">Tira deste navegador o token, favoritos, alertas, carteiras, ajustes e dados guardados. O que está no GitHub não é apagado. Use se o aparelho for trocado ou emprestado; se for perdido, revogue também o token no GitHub.</p><div class="segrow"><button type="button" class="btn sec segperigo" data-segapaga="1">'+(SEG.apagar?'Toque de novo para confirmar':'Apagar dados deste aparelho')+'</button></div></div>';
  if(SEG.erro)h+='<p class="warn">'+esc(SEG.erro)+'</p>';
  return h}
function segRefaz(){SEG.tent=SEG.tent||0;const el=$("segBox");if(el)el.innerHTML=segHtml()}
function segBaixa(nome,obj){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(obj)],{type:"application/json"}));a.download=nome;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
async function segRestaura(D){syncApply(syncMerge(syncLocal(),D));fvSave();try{localStorage.setItem("spCarts",JSON.stringify(SP.carts))}catch(x){}}

document.addEventListener("click",async e=>{const g=s=>e.target.closest&&e.target.closest(s);let x;
  if(g("[data-segprot]")){const s=($("segNova").value||"");if(s.length<8){SEG.erro="A senha precisa ter pelo menos 8 caracteres.";segRefaz();return}
    try{localStorage.setItem("ghTokC",JSON.stringify(await segCifra(SYNC.tok,s)));localStorage.removeItem("ghTok");SEG.erro="";segRefaz()}catch(x){SEG.erro="Não deu para criptografar neste navegador: "+x.message;segRefaz()}return}
  if(g("[data-segdesb]")){const o=segTokC();if(!o)return;try{SYNC.tok=await segDecifra(o,$("segSenha").value||"");SEG.erro="";SEG.tent=0;segRefaz();syncNow()}
    catch(x){SEG.tent++;SEG.erro=SEG.tent>=5?"Senha errada 5 vezes: o token protegido foi apagado deste aparelho. Conecte de novo com o token.":"Senha errada.";if(SEG.tent>=5){try{localStorage.removeItem("ghTokC")}catch(y){}}segRefaz()}return}
  if(g("[data-segbloq]")){SYNC.tok=null;segRefaz();try{fvRefresh()}catch(y){}return}
  if(g("[data-segsem]")){if(!SYNC.tok)return;try{localStorage.removeItem("ghTokC");localStorage.setItem("ghTok",SYNC.tok)}catch(y){}segRefaz();return}
  if((x=g("[data-segbkp]"))){SEG.bkp=x.dataset.segbkp==="1";SEG.erro="";segRefaz();const i=$("segBkpS");if(i)i.focus();return}
  if(g("[data-segbkpok]")){const s=$("segBkpS").value||"";if(s.length<8){SEG.erro="A senha do arquivo precisa ter pelo menos 8 caracteres.";segRefaz();return}
    const txt=JSON.stringify(Object.assign(syncLocal(),{v:1,exportadoEm:new Date().toISOString()}));segBaixa("mercado-copia-"+new Date().toISOString().slice(0,10)+".json",{v:2,app:"Mercado e Investimentos",cifrado:await segCifra(txt,s)});SEG.bkp=false;SEG.erro="";segRefaz();return}
  if(g("[data-segrestok]")){try{const D=JSON.parse(await segDecifra(SEG.rest,$("segRestS").value||""));if(!D||!Array.isArray(D.favs))throw new Error("arquivo inválido");await segRestaura(D);SEG.rest=null;SEG.erro="";segRefaz()}catch(x){SEG.erro="Senha errada ou arquivo inválido.";segRefaz()}return}
  if(g("[data-segapaga]")){if(!SEG.apagar){SEG.apagar=true;segRefaz();setTimeout(()=>{SEG.apagar=false;segRefaz()},6000);return}
    try{localStorage.clear();sessionStorage.clear()}catch(y){}try{if(window.caches)(await caches.keys()).forEach(k=>caches.delete(k))}catch(y){}
    try{if(navigator.serviceWorker)(await navigator.serviceWorker.getRegistrations()).forEach(r=>r.unregister())}catch(y){}
    location.replace(location.pathname);return}
});
document.addEventListener("change",async e=>{const t=e.target;if(!t)return;
  if(t.id==="segVal"){try{if(t.value)localStorage.setItem("ghTokVal",t.value);else localStorage.removeItem("ghTokVal")}catch(x){}segRefaz();return}
  if(t.id==="bkpIn"&&t.files&&t.files[0]){e.stopImmediatePropagation();
    try{const D=JSON.parse(await t.files[0].text());if(D&&D.cifrado){SEG.rest=D.cifrado;SEG.erro="";segRefaz();const i=$("segRestS");if(i)i.focus()}
      else if(D&&Array.isArray(D.favs)){await segRestaura(D);SEG.erro=""}else throw new Error("arquivo inválido")}
    catch(x){SEG.erro="Não deu para ler o arquivo: "+x.message;segRefaz()}t.value=""}},true);
