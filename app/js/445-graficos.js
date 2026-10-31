/* ---------- gráficos */
function fnChart(S,opt){
  opt=opt||{};const NW=window.innerWidth<640,W=NW?420:760,H=opt.h||(NW?260:230),PL=NW?50:58,PR=10,PT=12,PB=26;
  S=S.filter(s=>s.pts&&s.pts.length);const BML=FN_BML();let lo=Infinity,hi=-Infinity,t0=Infinity,t1=-Infinity;
  S.forEach(s=>s.pts.forEach(([t,v])=>{if(v==null||!isFinite(v))return;lo=Math.min(lo,v);hi=Math.max(hi,v);t0=Math.min(t0,t);t1=Math.max(t1,t)}));
  if(!isFinite(lo))return '<p class="sub">Sem dados para o período.</p>';
  if(opt.zero){lo=Math.min(lo,0);hi=Math.max(hi,0)}
  const pad=(hi-lo)*0.06||Math.abs(hi)*0.05||1;lo-=pad;hi+=pad;const st=niceStep((hi-lo)/5);lo=Math.floor(lo/st)*st;hi=Math.ceil(hi/st)*st;
  if(opt.bars){t0-=15*DAY;t1+=15*DAY}
  const X=t=>PL+(t-t0)/Math.max(1,t1-t0)*(W-PL-PR),Y=v=>PT+(hi-v)/(hi-lo)*(H-PT-PB);
  const fv=v=>opt.fmt==="num"?fx(v,Number.isInteger(st)?0:1):opt.fmt==="brl"?fx(v,v>=100?0:2):opt.fmt==="money"?fnMoney(v).replace("R$ ",""):opt.fmt==="int"?fx(v,0):fx(v,st>=1?0:st>=0.1?1:2)+(opt.fmt==="pct"?"%":"");
  let g='';for(let v=lo;v<=hi+st/2;v+=st){const y=Y(v);g+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)"'+(Math.abs(v)<st/1e6?'':' stroke-dasharray="2 4"')+'/><text x="'+(PL-6)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+fv(Math.abs(v)<st/1e6?0:v)+'</text>'}
  const ny=(t1-t0)/DAY/365.25,ticks=[];
  if(ny<0.4){const nd=Math.max(1,Math.round((t1-t0)/DAY/(NW?4:7)));for(let t=t0;t<=t1;t+=nd*DAY)ticks.push([t,fdate(t).slice(0,5)])}
  else if(ny<3){const d=new Date(t0);let k=d.getUTCFullYear()*12+d.getUTCMonth()+1;const sm=Math.max(1,Math.ceil(ny*12/(NW?4:8)));for(;;k+=sm){const t=Date.UTC(Math.floor(k/12),k%12,1);if(t>t1)break;ticks.push([t,mname(k)])}}
  else{const sy=ny>16?4:ny>8?2:1;for(let y=Math.ceil(new Date(t0).getUTCFullYear()/sy)*sy;y<=new Date(t1).getUTCFullYear();y+=sy){const t=Date.UTC(y,0,1);if(t>=t0)ticks.push([t,String(y)])}}
  ticks.forEach(([t,l])=>{g+='<text x="'+X(t).toFixed(1)+'" y="'+(H-PB+16)+'" text-anchor="middle">'+l+'</text>'});
  if(opt.bars){const s=S[0],bw=Math.max(2,Math.min(18,(W-PL-PR)/Math.max(1,s.pts.length)*0.7));s.pts.forEach(([t,v])=>{if(v==null)return;const y0=Y(0),y=Y(v);g+='<rect x="'+(X(t)-bw/2).toFixed(1)+'" y="'+Math.min(y,y0).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,Math.abs(y-y0)).toFixed(1)+'" fill="'+(v>=0?"var(--gain)":"var(--loss)")+'" opacity=".85"/>'})}
  else S.slice().reverse().forEach(s=>{let d='',pen=false;s.pts.forEach(([t,v])=>{if(v==null||!isFinite(v)){pen=false;return}d+=(pen?'L':'M')+X(t).toFixed(1)+' '+Y(v).toFixed(1)+' ';pen=true});
    if(opt.fill&&s===S[0]){const f=s.pts.filter(p=>p[1]!=null);if(f.length)g+='<path d="'+d+'L'+X(f[f.length-1][0]).toFixed(1)+' '+Y(0).toFixed(1)+' L'+X(f[0][0]).toFixed(1)+' '+Y(0).toFixed(1)+' Z" fill="'+s.col+'" opacity=".14"/>'}
    const bm=BML.has(String(s.lab).replace(/ \(.*$/,"")),dash=s.dash||(bm?"4 3":null);g+='<path d="'+d+'" fill="none" stroke="'+s.col+'" stroke-width="'+((s.w||1.8)*(bm?0.6:0.7)).toFixed(2)+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+' stroke-linejoin="round" stroke-linecap="round"/>'});
  g+='<line class="cvx" x1="0" x2="0" y1="'+PT+'" y2="'+(H-PB)+'" stroke="var(--ink)" stroke-width="1" opacity="0"/>';
  const meta={W,H,PT,PB,lo,hi,PL,PR,t0,t1,f:opt.fmt||"pct",m:!!opt.months,b:!!opt.bars,S:S.map(s=>({l:s.lab,c:s.col,p:s.pts.filter(p=>p[1]!=null&&isFinite(p[1])).map(p=>[p[0],+p[1].toFixed(opt.fmt==="money"||opt.fmt==="int"?0:opt.fmt==="brl"?4:3)])}))};
  return ((S.length>1||opt.legend)&&!opt.noLegend?'<div class="legend fnleg">'+S.map(s=>'<span><i style="background:'+s.col+'"></i>'+esc(s.lab)+'</span>').join("")+'</div>':'')+'<div class="fnchart" data-fnc=\''+JSON.stringify(meta).replace(/'/g,"&#39;")+'\'><svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(opt.aria||"Gráfico")+'">'+g+'<rect x="'+PL+'" y="'+PT+'" width="'+(W-PL-PR)+'" height="'+(H-PT-PB)+'" fill="transparent"/></svg><div class="cvtip" hidden></div></div>';
}
function fnTip(e){
  const box=e.target.closest&&e.target.closest(".fnchart");
  document.querySelectorAll(".fnchart").forEach(b=>{if(b!==box){const t=b.querySelector(".cvtip");if(t&&!t.hidden)t.hidden=true;const l=b.querySelector(".cvx");if(l)l.setAttribute("opacity","0");const g=b.querySelector(".cvdots");if(g)g.remove()}});
  if(!box)return;let M;try{M=JSON.parse(box.dataset.fnc)}catch(x){return}
  const svg=box.querySelector("svg"),R=svg.getBoundingClientRect(),sx=R.width/M.W,cx=(e.touches?e.touches[0].clientX:e.clientX),px=(cx-R.left)/sx,t=M.t0+(px-M.PL)/(M.W-M.PL-M.PR)*(M.t1-M.t0);
  let bt=null;M.S.forEach(s=>s.p.forEach(p=>{if(bt==null||Math.abs(p[0]-t)<Math.abs(bt-t))bt=p[0]}));if(bt==null)return;
  const X=M.PL+(bt-M.t0)/Math.max(1,M.t1-M.t0)*(M.W-M.PL-M.PR),ln=box.querySelector(".cvx");ln.setAttribute("x1",X);ln.setAttribute("x2",X);ln.setAttribute("opacity",".35");
  const F=v=>M.f==="num"?(v<0?"−":"")+fx(Math.abs(v),2):M.f==="brl"?"R$ "+fx(v,2):M.f==="money"?fnMoney(v):M.f==="int"?fx(v,0):(v<0?"−":"")+fx(Math.abs(v),2)+"%";
  const rows=[];M.S.forEach(s=>{let q=null;s.p.forEach(p=>{if(q==null||Math.abs(p[0]-bt)<Math.abs(q[0]-bt))q=p});if(q&&Math.abs(q[0]-bt)<20*DAY)rows.push({s,v:q[1]})});
  rows.sort((a,b)=>b.v-a.v);
  // bolinhas sobre as linhas no ponto do mouse
  let g=svg.querySelector(".cvdots");if(g)g.remove();
  if(!M.b&&M.H&&M.hi>M.lo){g=document.createElementNS("http://www.w3.org/2000/svg","g");g.setAttribute("class","cvdots");
    rows.forEach(r=>{const c=document.createElementNS("http://www.w3.org/2000/svg","circle"),Y=M.PT+(M.hi-r.v)/(M.hi-M.lo)*(M.H-M.PT-M.PB);c.setAttribute("cx",X.toFixed(1));c.setAttribute("cy",Y.toFixed(1));c.setAttribute("r","3.4");c.setAttribute("fill",r.s.c);c.setAttribute("stroke","var(--surface)");c.setAttribute("stroke-width","1.5");g.appendChild(c)});svg.appendChild(g)}
  const tip=box.querySelector(".cvtip");tip.innerHTML='<b>'+(M.m?mname(new Date(bt).getUTCFullYear()*12+new Date(bt).getUTCMonth()):fdate(bt))+'</b>'+rows.map(r=>'<span><i class="cvbar" style="background:'+r.s.c+'"></i><strong style="color:'+r.s.c+'">'+F(r.v)+'</strong><em>'+esc(r.s.l)+'</em></span>').join("");
  tip.hidden=false;const bx=box.getBoundingClientRect(),left=X*sx+14;tip.style.top="8px";tip.style.left=(left+tip.offsetWidth>bx.width?Math.max(0,X*sx-tip.offsetWidth-14):left)+"px";
}
document.addEventListener("mousemove",fnTip);document.addEventListener("touchstart",fnTip,{passive:true});

