/* ---------- onde ficam os dados dos robôs (etiqueta <meta name="wf-dados">)
   "github": ramos de dados do repositório no GitHub (raw.githubusercontent.com).
   "local": pasta dados/ junto do app (cópia congelada, publicada com o app).
   um endereço (https://…/): o servidor dos robôs; se ele não responder, o app usa a cópia dados/ publicada junto.
   Fora do GitHub, os arquivos de cada fundo, ativo e empresa americana vêm agrupados em pacotes (<ramo>/pk/),
   porque os serviços de hospedagem limitam o número de arquivos. */
const DADOS_META=(document.querySelector('meta[name="wf-dados"]')||{}).content||"github";
const DADOS_LOCAL=DADOS_META!=="github";
const DADOS_RAIZ=DADOS_META==="github"?"https://raw.githubusercontent.com/wagneria206-app/dados-mercado/":DADOS_META==="local"?"dados/":DADOS_META.replace(/\/?$/,"/");
const DADOS_RESERVA=DADOS_LOCAL&&DADOS_RAIZ!=="dados/";   // servidor com a cópia publicada como reserva
const DADOS_EST={reserva:false};
/* chave do pacote: 2 primeiros dígitos do CNPJ (letras viram X, fundos) ou a 1ª letra do código (ativos, empresas americanas) */
function dadosPacoteChave(dir,nome){if(dir==="f")return [0,1].map(i=>/\d/.test(nome.charAt(i))?nome.charAt(i):"X").join("");const c=nome.charAt(0).toUpperCase();return /[A-Z0-9]/.test(c)?c:"_"}
/* busca no servidor; se ele falhar (fora do ar, erro 5xx), busca a mesma coisa na cópia publicada com o app */
function dadosBusca(u,o){const rel=DADOS_RESERVA&&typeof u==="string"&&u.startsWith(DADOS_RAIZ)?u.slice(DADOS_RAIZ.length):null;
  if(rel==null)return window.fetch(u,o);
  return window.fetch(u,o).then(r=>{if(r.status>=500)throw new Error("HTTP "+r.status);return r}).catch(()=>{DADOS_EST.reserva=true;return window.fetch("dados/"+rel.split("?")[0],o)})}
const DADOS_PK={};
function dadosPacote(url){const k=url.split("?")[0];if(!DADOS_PK[k])DADOS_PK[k]=dadosBusca(k,{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).catch(e=>{delete DADOS_PK[k];throw e});return DADOS_PK[k]}
/* fora do GitHub, os pedidos de um arquivo por ativo são atendidos pelo pacote correspondente */
const fetch=(u,o)=>{if(DADOS_LOCAL&&typeof u==="string"&&u.startsWith(DADOS_RAIZ)){const m=/^(fundos|ativos|eua)\/(f|a|d|s)\/([^/?#]+)\.json/.exec(u.slice(DADOS_RAIZ.length));
    if(m)return dadosPacote(DADOS_RAIZ+m[1]+"/pk/"+m[2]+"-"+dadosPacoteChave(m[2],m[3])+".json").then(P=>{const x=P[m[3]];return x===undefined?new Response("não encontrado",{status:404}):new Response(JSON.stringify(x),{status:200,headers:{"Content-Type":"application/json"}})});
    return dadosBusca(u,o)}
  return window.fetch(u,o)};
