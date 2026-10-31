/* ================= Histórico de taxas (Tesouro Direto, dia a dia) ================= */
const TX_KIND=["NTNB","NTNBP","RENDA","EDUCA","LTN","NTNF","LFT",null]; // índice do nome -> tipo da calculadora
const TX_PRE=["IPCA +","IPCA +","IPCA +","IPCA +","","","Selic +","IGP-M +"];
let TXB=null,TXSEL=null,TDH={};
function txDec(s,n){const out=new Array(n);let last=0,k=0;for(let i=0;i<s.length&&k<n;){const ch=s[i];if(ch===" "){out[k++]=null;i++}else if(ch==="!"){const j=s.indexOf(",",i);last=+s.slice(i+1,j);out[k++]=last/100;i=j+1}else{last+=ch.charCodeAt(0)-79;out[k++]=last/100;i++}}return out}
function txBase(){
  if(TXB)return TXB;
  const d0=Date.parse(TX.d0),dates=[];let off=0;
  for(const ch of TX.dd){off+=ch.charCodeAt(0)-48;dates.push(d0+off*DAY)}
  const ser=TX.s.map(([n,m,runs,c,v])=>{const t=[];runs.forEach(([s,l])=>{for(let i=0;i<l;i++)t.push(dates[s+i])});return {n,m,t,c:txDec(c,t.length),v:txDec(v,t.length)}});
  TXB={dates,ser,last:dates[dates.length-1]};return TXB;
}
function txMatFromKind(k,d){const y=+d.slice(0,4);if(k==="RENDA")return (y+19)+"-12-15";if(k==="EDUCA")return (y+4)+"-12-15";return d}
/* séries completas: base embutida + dias novos gravados pela atualização diária (fonte oficial) */
function txSeries(){
  const B=txBase(),map=new Map();
  B.ser.forEach(s=>map.set(s.n+"|"+s.m,{n:s.n,m:s.m,t:s.t.slice(),c:s.c.slice(),v:s.v.slice()}));
  const days=Object.keys(TDH).filter(d=>Date.parse(d)>B.last&&Array.isArray(TDH[d].rows)).sort();
  days.forEach(d=>{const t=Date.parse(d);TDH[d].rows.forEach(r=>{
    if(!Array.isArray(r)||r.length<4)return;const n=TX_KIND.indexOf(r[0]);if(n<0||isNaN(Date.parse(r[1])))return;
    const v=isFinite(r[2])?+r[2]:null,c=isFinite(r[3])&&r[3]!==null?+r[3]:null;if(v!==null&&(v<-5||v>40))return;
    const m=txMatFromKind(r[0],r[1]),key=n+"|"+m;let s=map.get(key);if(!s){s={n,m,t:[],c:[],v:[]};map.set(key,s)}
    if(s.t.length&&s.t[s.t.length-1]>=t)return;s.t.push(t);s.c.push(c);s.v.push(v)})});
  const now=days.length?Date.parse(days[days.length-1]):B.last;
  return {list:[...map.values()].sort((a,b)=>a.n-b.n||a.m.localeCompare(b.m)),now};
}

function txFull(s){const y=+s.m.slice(0,4);
  if(s.n===2)return "Tesouro Renda+ Aposentadoria Extra "+(y-19);if(s.n===3)return "Tesouro Educa+ "+(y-4);
  return TX.names[s.n]+" "+y}
const txD2=t=>{const d=new Date(t);return String(d.getUTCDate()).padStart(2,'0')+'/'+String(d.getUTCMonth()+1).padStart(2,'0')+'/'+String(d.getUTCFullYear()).slice(2)};
function txShort(s){const y=+s.m.slice(0,4);return s.n===2?'Renda+ '+(y-19):s.n===3?'Educa+ '+(y-4):String(y)}
const txFmt=(n,r)=>(TX_PRE[n]?TX_PRE[n]+" ":"")+fx(r,2)+"%";
function txStats(s,side,from){
  const a=s[side];let mn=null,mx=null,first=null,last=null;
  for(let i=0;i<s.t.length;i++){const r=a[i];if(r===null||s.t[i]<from)continue;
    if(!first)first={r,t:s.t[i]};last={r,t:s.t[i]};
    if(!mn||r<mn.r)mn={r,t:s.t[i]};if(!mx||r>mx.r)mx={r,t:s.t[i]}}
  return {mn,mx,first,last};
}
function txFillTypes(){
  const sel=$("txType");if(sel.options.length)return;
  TX.names.forEach((nm,i)=>{const o=document.createElement("option");o.value=i;o.textContent=nm+(i===7?" (fora de oferta)":"");sel.appendChild(o)});
}
function txFillMats(S,keep){
  const n=+$("txType").value,sel=$("txMat"),prev=keep||sel.value;sel.innerHTML="";
  const L=S.list.filter(s=>s.n===n),act=[],old=[];
  L.forEach(s=>(s.t[s.t.length-1]>=S.now?act:old).push(s));
  const add=(arr,lab)=>{if(!arr.length)return;const g=document.createElement("optgroup");g.label=lab;
    arr.forEach(s=>{const o=document.createElement("option");o.value=s.m;o.textContent=txShort(s)+" · venc. "+fdate(Date.parse(s.m));g.appendChild(o)});sel.appendChild(g)};
  add(act,"À venda hoje");add(old,"Vencidos ou fora de oferta");
  if([...sel.options].some(o=>o.value===prev))sel.value=prev;
  else if(act.length)sel.value=act[Math.floor((act.length-1)/2)].m;
}
function txPreset(){
  /* abre no título escolhido na aba Títulos públicos */
  try{const [k,d]=sel.value.split("|"),n=TX_KIND.indexOf(k);if(n>=0)return {n,m:txMatFromKind(k,d)}}catch(e){}
  return {n:0,m:"2035-05-15"};
}
function txCalc(){
  txFillTypes();
  const S=txSeries();
  if(!TXSEL){TXSEL=txPreset();$("txType").value=TXSEL.n}
  txFillMats(S,TXSEL.m);
  const n=+$("txType").value,m=$("txMat").value,side=$("txSide").value,per=$("txPer").value;
  TXSEL={n,m};
  const s=S.list.find(x=>x.n===n&&x.m===m);
  if(!s){$("txTot").innerHTML='<p class="err">Sem dados para este título.</p>';$("txChart").innerHTML="";return}
  const endT=s.t[s.t.length-1],yrs={all:0,"10y":10,"5y":5,"1y":1,"6m":.5,"1m":1/12}[per]||0;
  const from=yrs?endT-yrs*365.25*DAY:-Infinity;
  const st=txStats(s,side,from),full=txStats(s,side,-Infinity),sideTxt=side==="c"?"compra":"venda (resgate)";
  $("txTitle").textContent=txFull(s)+" · taxa de "+sideTxt;
  if(!st.mn){$("txTot").innerHTML='<p class="sub">Não houve taxa de '+sideTxt+' para este título no período escolhido. Troque para a taxa de '+(side==="c"?"venda":"compra")+' ou amplie o período.</p>';$("txChart").innerHTML="";$("txRead").textContent="";txTable(S,n,side);return}
  const perTxt=yrs?"no período":"desde o lançamento";
  $("txTot").innerHTML=
    '<div><span class="n">Menor taxa '+perTxt+'</span><span class="v pos">'+txFmt(n,st.mn.r)+'</span><span class="n">em '+fdate(st.mn.t)+'</span></div>'+
    '<div><span class="n">Maior taxa '+perTxt+'</span><span class="v neg">'+txFmt(n,st.mx.r)+'</span><span class="n">em '+fdate(st.mx.t)+'</span></div>'+
    '<div><span class="n">'+(endT>=S.now?'Última taxa de '+(side==="c"?"compra":"venda"):'Última taxa de '+(side==="c"?"compra":"venda")+' ofertada')+'</span><span class="v">'+txFmt(n,st.last.r)+'</span><span class="n">em '+fdate(st.last.t)+'</span></div>'+
    '<div><span class="n">'+(yrs?'Primeira taxa do período':'Primeira taxa (lançamento)')+'</span><span class="v">'+txFmt(n,st.first.r)+'</span><span class="n">em '+fdate(st.first.t)+(yrs?'':(full.first&&full.first.t<=Date.parse("2005-01-03")?' (início da série)':''))+'</span></div>';
  txDraw(s,side,from,st,n);
  txTable(S,n,side);try{watchRender()}catch(e){}
}
let TXPTS=[];
function txDraw(s,side,from,st,n){
  const svg=$("txChart"),cw=svg.clientWidth||(svg.parentNode&&svg.parentNode.clientWidth)||760,W=Math.round(Math.max(340,Math.min(1500,cw))),H=W<560?Math.round(W*0.78):chartH(340,W),PL=W<560?44:58,PR=W<560?10:18,PT=18,PB=40,a=s[side];
  svg.setAttribute("viewBox","0 0 "+W+" "+H);
  const pts=[];for(let i=0;i<s.t.length;i++){if(s.t[i]<from)continue;pts.push({t:s.t[i],r:a[i],brk:i>0&&s.t[i]-s.t[i-1]>12*DAY})}
  TXPTS=pts;
  const t0=pts[0].t,t1=Math.max(pts[pts.length-1].t,t0+DAY);
  let lo=st.mn.r,hi=st.mx.r;const pad=Math.max((hi-lo)*.08,.05);lo-=pad;hi+=pad;
  const ys=niceStep((hi-lo)/5);lo=Math.floor(lo/ys)*ys;hi=Math.ceil(hi/ys)*ys;if(hi-lo<ys)hi=lo+ys;
  const X=t=>PL+(t-t0)/(t1-t0)*(W-PL-PR),Y=r=>PT+(hi-r)/(hi-lo)*(H-PT-PB);
  let g='';
  const dec=ys<.1?2:ys<1?1:0;
  for(let v=lo;v<=hi+ys/2;v+=ys){const y=Y(v);g+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-dasharray="2 4"/><text x="'+(PL-8)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+fx(v,dec)+'</text>'}
  /* eixo x: anos ou meses */
  const span=(t1-t0)/DAY/365.25;
  if(span>1.5){const st0=new Date(t0).getUTCFullYear()+1,stp=Math.max(1,Math.ceil(span/(W<560?5:8)));for(let y=st0;Date.UTC(y,0,1)<=t1;y+=stp){const x=X(Date.UTC(y,0,1));if(x<PL+10||x>W-PR-10)continue;g+='<line x1="'+x.toFixed(1)+'" x2="'+x.toFixed(1)+'" y1="'+PT+'" y2="'+(H-PB)+'" stroke="var(--line)" stroke-dasharray="1 5"/><text x="'+x.toFixed(1)+'" y="'+(H-PB+17)+'" text-anchor="middle">'+y+'</text>'}}
  else{const MS=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];const d=new Date(t0);let y=d.getUTCFullYear(),mo=d.getUTCMonth()+1;const stp=span>.6?(W<560?3:2):(span>.3&&W<560?2:1);
    for(;Date.UTC(y,mo,1)<=t1;mo+=stp){const tt=Date.UTC(y,mo,1),x=X(tt);if(x<PL+10||x>W-PR-10)continue;const dd=new Date(tt);g+='<line x1="'+x.toFixed(1)+'" x2="'+x.toFixed(1)+'" y1="'+PT+'" y2="'+(H-PB)+'" stroke="var(--line)" stroke-dasharray="1 5"/><text x="'+x.toFixed(1)+'" y="'+(H-PB+17)+'" text-anchor="middle">'+MS[dd.getUTCMonth()]+'/'+String(dd.getUTCFullYear()).slice(2)+'</text>'}}
  /* linha, com quebras quando o título ficou fora de oferta */
  let d="",pen=false;
  pts.forEach(p=>{if(p.r===null){pen=false;return}const c=X(p.t).toFixed(1)+","+Y(p.r).toFixed(1);d+=(!pen||p.brk?"M":"L")+c;pen=true});
  g+='<path d="'+d+'" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round"/>';
  /* marcadores de mínimo e máximo */
  const mark=(p,cls,lab,below)=>{const x=X(p.t),y=Y(p.r),right=x<W/2,tx=right?x+10:x-10,ty=below?y+18:y-10;
    return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="5" fill="var(--'+cls+')" stroke="var(--surface)" stroke-width="2"/>'+
      '<text x="'+tx.toFixed(1)+'" y="'+Math.min(H-PB-4,Math.max(PT+10,ty)).toFixed(1)+'" text-anchor="'+(right?"start":"end")+'" style="fill:var(--'+cls+');font-weight:600">'+lab+' '+fx(p.r,2)+'% · '+(W<560?txD2(p.t):fdate(p.t))+'</text>'};
  g+=mark(st.mx,"loss","Máx.",false)+mark(st.mn,"gain","Mín.",true);
  g+='<g id="txHover"></g><rect x="'+PL+'" y="'+PT+'" width="'+(W-PL-PR)+'" height="'+(H-PT-PB)+'" fill="transparent" id="txHit"/>';
  g+='<text class="ttl" x="14" y="'+((PT+H-PB)/2)+'" text-anchor="middle" transform="rotate(-90 14 '+((PT+H-PB)/2)+')">'+(TX_PRE[n]?TX_PRE[n]+" ":"")+'% a.a.</text>';
  svg.innerHTML=g;
  const hov=$("txHover"),hit=$("txHit");
  const show=ev=>{const r=svg.getBoundingClientRect();if(!r.width)return;const xv=(ev.clientX-r.left)/r.width*W;const t=t0+(xv-PL)/(W-PL-PR)*(t1-t0);
    let lo2=0,hi2=pts.length-1;while(hi2-lo2>1){const mid=(lo2+hi2)>>1;if(pts[mid].t<t)lo2=mid;else hi2=mid}
    const p=Math.abs(pts[lo2].t-t)<Math.abs(pts[hi2].t-t)?pts[lo2]:pts[hi2];
    if(p.r===null){hov.innerHTML="";$("txRead").textContent=fdate(p.t)+": sem taxa";return}
    const x=X(p.t),y=Y(p.r);hov.innerHTML='<line x1="'+x+'" x2="'+x+'" y1="'+PT+'" y2="'+(H-PB)+'" stroke="var(--muted)" stroke-width="1"/><circle cx="'+x+'" cy="'+y+'" r="4" fill="var(--accent)"/>';
    $("txRead").innerHTML=fdate(p.t)+': <b>'+txFmt(n,p.r)+'</b>'};
  hit.addEventListener("pointermove",show);hit.addEventListener("pointerdown",show);
  hit.addEventListener("pointerleave",()=>{hov.innerHTML="";$("txRead").textContent="Toque ou passe o dedo no gráfico para ver cada dia."});
  $("txRead").textContent="Toque ou passe o dedo no gráfico para ver cada dia.";
}
function txTable(S,n,side){
  const L=S.list.filter(s=>s.n===n);
  let h='<thead><tr><th style="text-align:left">Título</th><th>Menor taxa</th><th>Maior taxa</th><th>Última</th></tr></thead><tbody>';
  L.forEach(s=>{const f=txStats(s,side,-Infinity);const cur=s.m===$("txMat").value;
    if(!f.mn){h+='<tr data-m="'+s.m+'"'+(cur?' class="cur"':'')+'><td style="text-align:left"><b>'+txShort(s)+'</b><br><small>sem taxa de '+(side==="c"?"compra":"venda")+'</small></td><td>—</td><td>—</td><td>—</td></tr>';return}
    h+='<tr data-m="'+s.m+'"'+(cur?' class="cur"':'')+' style="cursor:pointer"><td style="text-align:left"><b>'+txShort(s)+'</b><br><small>venc. '+txD2(Date.parse(s.m))+'<br>desde '+txD2(s.t[0])+'</small></td>'+
      '<td class="pos">'+fx(f.mn.r,2)+'%<br><small>'+txD2(f.mn.t)+'</small></td><td class="neg">'+fx(f.mx.r,2)+'%<br><small>'+txD2(f.mx.t)+'</small></td><td>'+fx(f.last.r,2)+'%<br><small>'+txD2(f.last.t)+'</small></td></tr>'});
  $("txTab").innerHTML=h+'</tbody>';
  $("txTabTtl").textContent="Todos os vencimentos: "+TX.names[n];
}
let txRT=null;window.addEventListener("resize",()=>{if(activeMod!=="tx")return;clearTimeout(txRT);txRT=setTimeout(txCalc,150)});
function txBind(){
  $("txOpp").addEventListener("click",mkClick);
  $("txBack").addEventListener("click",()=>{const k=TX_BACK;$("txBack").hidden=true;setTimeout(()=>{const el=k&&document.querySelector('[data-oppk="'+k+'"]');if(el){const tb=el.closest(".oppmore");if(tb&&tb.hidden){tb.hidden=false;const bm=$("oppMore");if(bm)bm.textContent="Mostrar só os 10 primeiros"}try{el.scrollIntoView({behavior:"smooth",block:"center"})}catch(x){}el.closest("tr").classList.add("opphl");setTimeout(()=>{const r=el.closest("tr");if(r)r.classList.remove("opphl")},1800)}},60)});
  $("txType").addEventListener("change",()=>{TXSEL={n:+$("txType").value,m:""};txCalc()});
  $("txMat").addEventListener("change",()=>{TXSEL={n:+$("txType").value,m:$("txMat").value};txCalc()});
  ["txSide","txPer"].forEach(id=>$(id).addEventListener("change",txCalc));
  $("txTab").addEventListener("click",e=>{const tr=e.target.closest("tr[data-m]");if(!tr)return;TXSEL={n:+$("txType").value,m:tr.dataset.m};txCalc();$("txChart").scrollIntoView({behavior:"smooth",block:"center"})});
}

