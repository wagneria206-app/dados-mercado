/* ---------- evolução ---------- */
let TXIDX=null;
function txIndex(){if(TXIDX)return TXIDX;TXIDX=new Map();txSeries().list.forEach(s=>TXIDX.set(s.n+"|"+s.m,s));return TXIDX}

const POUP={};(function(){const a=POUP25.split(" "),b=POUP195.split(" ");let k=2005*12;a.forEach(v=>{POUP[k++]=+v});k=2012*12+5;b.forEach(v=>{POUP[k++]=+v})})();





