
(function(){
"use strict";
const DAY=86400000;
const clean=s=>String(s==null?"":s).replace(/[<>"`]/g,"").slice(0,400);

const utc=(y,m,d)=>Date.UTC(y,m,d);
const $=id=>document.getElementById(id);


