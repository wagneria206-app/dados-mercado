/* ---------- estado compartilhado e utilitários (reunidos aqui na limpeza do código da primeira versão do app) */
let POS={},HIST={},SILENT=false;
let cartRes={},SETTINGS={};
const RAWC=new Map();
const isoD=t=>new Date(t).toISOString().slice(0,10);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
/* histórico do Tesouro por título (índice) e poupança mensal embutida */
let TXIDX=null;
function txIndex(){if(TXIDX)return TXIDX;TXIDX=new Map();txSeries().list.forEach(s=>TXIDX.set(s.n+"|"+s.m,s));return TXIDX}
const POUP={};(function(){const a=POUP25.split(" "),b=POUP195.split(" ");let k=2005*12;a.forEach(v=>{POUP[k++]=+v});k=2012*12+5;b.forEach(v=>{POUP[k++]=+v})})();
/* parâmetros de risco: janela das medidas, probabilidade de inadimplência por rating e eventos de debêntures */
let RK_WIN="2y";try{RK_WIN=localStorage.getItem("rkWin")||"2y"}catch(e){}
const PD={AAA:0.0001,AA:0.0005,A:0.0015,BBB:0.005,BB:0.02,B:0.06,CCC:0.25,D:1,NR:0.03};
let DEBEV={};
/* liga os formulários das abas Bancários, Fundos e previdência, Equivalência e escada, Cenários e Mercado */
function extBind(){
  bkBind();fdBind();simBind();
  $("scVal").addEventListener("change",scCalc);
  $("mkOut").addEventListener("click",mkClick);
}
