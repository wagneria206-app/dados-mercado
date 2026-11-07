/* ---------- onde ficam os dados dos robôs
   "github": lidos direto dos ramos de dados do repositório (raw.githubusercontent.com).
   "local": numa pasta dados/ junto do app (hospedagem fora do GitHub), com a mesma organização dos ramos;
   os arquivos de cada fundo, ativo e empresa americana vêm agrupados em pacotes (dados/<ramo>/pk/), porque
   os serviços de hospedagem limitam o número de arquivos. A escolha vem da etiqueta <meta name="wf-dados">. */
const DADOS_LOCAL=(document.querySelector('meta[name="wf-dados"]')||{}).content==="local";
const DADOS_RAIZ=DADOS_LOCAL?"dados/":"https://raw.githubusercontent.com/wagneria206-app/dados-mercado/";
/* chave do pacote: 2 primeiros dígitos do CNPJ (letras viram X, fundos) ou a 1ª letra do código (ativos, empresas americanas) */
function dadosPacoteChave(dir,nome){if(dir==="f")return [0,1].map(i=>/\d/.test(nome.charAt(i))?nome.charAt(i):"X").join("");const c=nome.charAt(0).toUpperCase();return /[A-Z0-9]/.test(c)?c:"_"}
const DADOS_PK={};
function dadosPacote(url){const k=url.split("?")[0];if(!DADOS_PK[k])DADOS_PK[k]=window.fetch(k,{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).catch(e=>{delete DADOS_PK[k];throw e});return DADOS_PK[k]}
/* no modo local, os pedidos de um arquivo por ativo são atendidos pelo pacote correspondente */
const fetch=(u,o)=>{if(DADOS_LOCAL&&typeof u==="string"){const m=/^dados\/(fundos|ativos|eua)\/(f|a|d|s)\/([^/?#]+)\.json/.exec(u);
    if(m)return dadosPacote("dados/"+m[1]+"/pk/"+m[2]+"-"+dadosPacoteChave(m[2],m[3])+".json").then(P=>{const x=P[m[3]];return x===undefined?new Response("não encontrado",{status:404}):new Response(JSON.stringify(x),{status:200,headers:{"Content-Type":"application/json"}})})}
  return window.fetch(u,o)};
