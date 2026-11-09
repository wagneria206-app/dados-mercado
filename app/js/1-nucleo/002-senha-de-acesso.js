/* Senha de acesso: barra quem só digita o endereço. Os dados do app são públicos; a senha não fica no código, só o hash dela */
// A configuração vem de <meta name="wf-senha" content="v1:<iterações>:<sal base64>:<hash base64>">, gerada fora do app
// pela página gerar-senha.html. Sem essa meta (ou vazia) o app abre direto.
// Conta: K = PBKDF2-SHA256(senha, sal, iterações); a meta guarda SHA-256(K). Ao lembrar o aparelho, guarda-se K no
// navegador: quem só tem o código público não consegue fabricar um K válido sem saber a senha.
const SENHA_CFG=(()=>{const m=/^v1:(\d{4,7}):([A-Za-z0-9+/=]{16,}):([A-Za-z0-9+/=]{40,})$/.exec(((document.querySelector('meta[name="wf-senha"]')||{}).content||"").trim());return m?{it:+m[1],sal:m[2],h:m[3]}:null})();
const SENHA_LS="wf-acesso";
function senhaB64(buf){return btoa(String.fromCharCode(...new Uint8Array(buf)))}
function senhaDeB64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function senhaChave(senha){
  const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(senha.normalize("NFC")),"PBKDF2",false,["deriveBits"]);
  return crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:senhaDeB64(SENHA_CFG.sal),iterations:SENHA_CFG.it},base,256);
}
async function senhaConfere(chave){
  const h=senhaB64(await crypto.subtle.digest("SHA-256",chave));
  if(h.length!==SENHA_CFG.h.length)return false;
  let d=0;for(let i=0;i<h.length;i++)d|=h.charCodeAt(i)^SENHA_CFG.h.charCodeAt(i);return d===0;
}
function senhaLivre(){document.documentElement.classList.add("wf-livre");const t=document.getElementById("wfTrava");if(t)t.remove();const b=document.getElementById("btTrava");if(b)b.hidden=!SENHA_CFG}
function senhaBloquear(){try{localStorage.removeItem(SENHA_LS)}catch(e){}location.reload()}
function senhaTela(){
  if(document.getElementById("wfTrava"))return;
  const d=document.createElement("div");d.id="wfTrava";
  d.innerHTML='<form class="wftr-box" autocomplete="off"><div class="logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 19h16M6 16v-5M10 16V8M14 16v-3M18 16V6"/></svg></div>'
    +'<h1>WF Investimentos</h1><p>Digite a senha de acesso.</p>'
    +'<input type="password" id="wftrSenha" aria-label="Senha de acesso" autocomplete="current-password" required>'
    +'<label class="wftr-lb"><input type="checkbox" id="wftrLembrar" checked> Lembrar neste aparelho</label>'
    +'<button type="submit" class="btn">Entrar</button><p class="wftr-msg" id="wftrMsg" role="alert"></p></form>';
  document.body.appendChild(d);
  const f=d.querySelector("form"),inp=d.querySelector("#wftrSenha"),msg=d.querySelector("#wftrMsg"),bt=d.querySelector("button");
  let erros=0;
  f.addEventListener("submit",async ev=>{
    ev.preventDefault();if(bt.disabled)return;
    bt.disabled=true;msg.textContent="Conferindo…";
    try{
      const k=await senhaChave(inp.value);
      if(await senhaConfere(k)){
        if(d.querySelector("#wftrLembrar").checked){try{localStorage.setItem(SENHA_LS,senhaB64(k))}catch(e){}}
        senhaLivre();return;
      }
      erros++;msg.textContent="Senha incorreta.";inp.value="";
      await new Promise(r=>setTimeout(r,Math.min(8000,500*2**Math.max(0,erros-3))));
    }catch(e){msg.textContent="Este navegador não conseguiu conferir a senha."}
    bt.disabled=false;inp.focus();
  });
  setTimeout(()=>inp.focus(),50);
}
async function senhaInicio(){
  if(!SENHA_CFG){senhaLivre();return}
  let k=null;try{k=localStorage.getItem(SENHA_LS)}catch(e){}
  if(k){try{if(await senhaConfere(senhaDeB64(k))){senhaLivre();return}}catch(e){}try{localStorage.removeItem(SENHA_LS)}catch(e){}}
  senhaTela();
}
senhaInicio();
document.addEventListener("click",ev=>{if(ev.target.closest&&ev.target.closest("#btTrava"))senhaBloquear()});
