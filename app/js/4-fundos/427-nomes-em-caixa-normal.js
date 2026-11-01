/* ---------- nomes em caixa normal: a CVM e a B3 publicam os nomes em maiúsculas ("ITAU PRIVILEGE RENDA FIXA…");
   na tela ficam "Itaú Privilege Renda Fixa…", mantendo siglas (FIF, FIC, CIC, DI, RF, BTG, XP, S.A.…) em maiúsculas.
   Só muda o que veio todo em maiúsculas; a busca não muda (ela ignora maiúsculas e acentos). */
const NC_MIN=new Set(["de","da","do","das","dos","e","em","no","na","nos","nas","ao","aos","a","o","com","para","por","sem","à","às","que","ou","pelo","pela"]);
const NC_SIG=new Set(["FIF","FIC","FICFI","FIM","FIA","FII","FIDC","FIP","FIRF","FIAGRO","CIC","DTVM","CTVM","DTV","PGBL","VGBL","FGTS","IPCA","AGBI","HSBC","VIII","XIII","XVII","XVIII","S.A.","S.A","S/A","FI-INFRA","IMA-B","IRF-M","IGP-M","ESG","USD","EUA","CDI","CDB","LCI","LCA","CRI","CRA","ETF","SELIC","IBOV","B3","BDR","BDRS","REIT","REITS","MSCI","S&P"]);
const NC_PAL=new Set(["TOP","LOW","VOL","ALL","KEY","ACE","AIR","ART","FIT","JAZ","LIS","OPP","MAX","SUL","MIX","ONE","DUO","INC","LTD","PLC","CO","CIA","SUN","BOM","NEW","BIG","GAS","FOX","SKY","SEA","OAK","ZEN","PRO","LUZ","MAR","SOL","PAZ","RIO","FOZ","VIA","LOG","BEM","GOL","OUR","THE","AND","OF","MAIS","ALFA","BETA","GAMA"]);
const ncPal=(w,i)=>{
  if(!/[A-ZÀ-Ý]/.test(w))return w;                               // números e símbolos
  const lw=w.toLocaleLowerCase("pt-BR"),so=w.replace(/[^A-Za-zÀ-ÿ]/g,"");
  if(i>0&&NC_MIN.has(lw))return lw;
  if(NC_SIG.has(w)||NC_SIG.has(w.replace(/[.,;:]+$/,"")))return w;
  if(/\d/.test(w))return w;                                       // G5, C9, 2035
  if(so.length<=3&&!NC_PAL.has(so))return w;                      // BB, BTG, XP, UBS, RF, DI, LP, II, III
  if(w.includes("-"))return w.split("-").map((p,j)=>ncPal(p,i+j)).join("-");
  return lw.charAt(0).toLocaleUpperCase("pt-BR")+lw.slice(1)};
function nomeCx(s){
  if(s==null)return s;s=String(s).replace(/\s{2,}/g," ").trim();const L=s.replace(/[^A-Za-zÀ-ÿ]/g,"");if(L.length<4)return s;
  const mai=L.replace(/[^A-ZÀ-Ý]/g,"").length;if(mai/L.length<0.85)return s;   // já vem em caixa normal
  return s.split(" ").map((w,i)=>w.split("/").map((p,j)=>ncPal(p,i+j)).join("/")).join(" ").replace(/\bS\/a\b/g,"S/A")}
