/* ---------- gráfico ---------- */
const W=760,H=330,PL=78,PR=20,PT=18,PB=44;
let geo=null;
function drawChart(){
  const s=state,svg=$("chart");if(!s)return;
  const F=s.F;
  let lo=Math.min(s.rc,s.rm)-F.span,hi=Math.max(s.rc,s.rm)+F.span;
  const xs=niceStep((hi-lo)/6);lo=Math.floor(lo/xs)*xs;hi=Math.ceil(hi/xs)*xs;
  const N=s.n||160,pts=[];
  for(let i=0;i<=N;i++){const r=lo+(hi-lo)*i/N;pts.push([r,(s.priceAt(r)-s.puC)*s.q])}
  let ymin=Math.min(0,...pts.map(p=>p[1])),ymax=Math.max(0,...pts.map(p=>p[1]));
  const step=niceStep((ymax-ymin)/5);ymin=Math.floor(ymin/step)*step;ymax=Math.ceil(ymax/step)*step;if(ymax===ymin)ymax=ymin+step;
  const X=r=>PL+(r-lo)/(hi-lo)*(W-PL-PR),Y=v=>PT+(ymax-v)/(ymax-ymin)*(H-PT-PB);
  geo={lo,hi,X,Y,pts,fmt:s.fmt};
  const xd=xs>=1?0:xs>=.1?1:2;
  let g='';
  for(let v=ymin;v<=ymax+step/2;v+=step){const y=Y(v),z=Math.abs(v)<step/1e3;g+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)" stroke-width="'+(z?1.4:1)+'"'+(z?'':' stroke-dasharray="2 4"')+'/><text x="'+(PL-8)+'" y="'+(y+4)+'" text-anchor="end">'+compact(z?0:v)+'</text>'}
  for(let r=lo;r<=hi+xs/2;r+=xs){const x=X(r);g+='<line x1="'+x+'" x2="'+x+'" y1="'+(H-PB)+'" y2="'+(H-PB+5)+'" stroke="var(--muted)"/><text x="'+x+'" y="'+(H-PB+19)+'" text-anchor="middle">'+fx(r,xd)+'%</text>'}
  g+='<text class="ttl" x="'+((PL+W-PR)/2)+'" y="'+(H-6)+'" text-anchor="middle">'+F.axis+'</text>';
  g+='<text class="ttl" x="14" y="'+((PT+H-PB)/2)+'" text-anchor="middle" transform="rotate(-90 14 '+((PT+H-PB)/2)+')">Ágio / deságio total (R$)</text>';
  const y0=Y(0),xc=X(s.rc);
  const gain=pts.filter(p=>p[0]<=s.rc),loss=pts.filter(p=>p[0]>=s.rc);
  const area=arr=>'M'+X(arr[0][0])+' '+y0+arr.map(p=>' L'+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join("")+' L'+X(arr[arr.length-1][0])+' '+y0+'Z';
  const line=arr=>'M'+arr.map(p=>X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join(" L");
  if(gain.length>1)g+='<path d="'+area(gain)+'" fill="var(--gain)" fill-opacity=".16"/><path d="'+line(gain)+'" fill="none" stroke="var(--gain)" stroke-width="2.4"/>';
  if(loss.length>1)g+='<path d="'+area(loss)+'" fill="var(--loss)" fill-opacity=".16"/><path d="'+line(loss)+'" fill="none" stroke="var(--loss)" stroke-width="2.4"/>';
  g+='<line x1="'+xc+'" x2="'+xc+'" y1="'+PT+'" y2="'+(H-PB)+'" stroke="var(--muted)" stroke-dasharray="4 4"/>';
  const cRight=xc>W-170;
  g+='<text x="'+(cRight?xc-6:xc+6)+'" y="'+(PT+12)+'" text-anchor="'+(cRight?"end":"start")+'" style="fill:var(--ink)">contratada '+fx(s.rc,F.dec)+'%</text>';
  const vm=(s.priceAt(s.rm)-s.puC)*s.q,xm=X(s.rm),ym=Y(vm),right=xm>W-230;
  g+='<line x1="'+xm+'" x2="'+xm+'" y1="'+ym+'" y2="'+(H-PB)+'" stroke="var(--accent)" stroke-width="1.2"/>';
  g+='<circle cx="'+xm+'" cy="'+ym+'" r="6" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>';
  g+='<text x="'+(right?xm-10:xm+10)+'" y="'+(ym<PT+40?ym+20:ym-10)+'" text-anchor="'+(right?"end":"start")+'" style="fill:var(--accent);font-weight:600">mercado '+fx(s.rm,F.dec)+'%: '+signed(vm,brl)+'</text>';
  g+='<g id="hov" visibility="hidden"><line id="hl" y1="'+PT+'" y2="'+(H-PB)+'" stroke="var(--ink)" stroke-opacity=".35"/><circle id="hc" r="4.5" fill="var(--ink)"/></g>';
  g+='<rect x="'+PL+'" y="'+PT+'" width="'+(W-PL-PR)+'" height="'+(H-PT-PB)+'" fill="transparent" id="hit"/>';
  svg.innerHTML=g;
  const rest='Na taxa de mercado atual: <b>'+signed(vm,brl)+'</b>. Passe o cursor ou o dedo para simular outras taxas.';
  $("readout").innerHTML=rest;
  const hit=$("hit");
  hit.addEventListener("pointermove",hover);hit.addEventListener("pointerdown",hover);
  hit.addEventListener("pointerleave",()=>{$("hov").setAttribute("visibility","hidden");$("readout").innerHTML=rest});
}
function hover(e){
  const svg=$("chart"),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
  const p=pt.matrixTransform(svg.getScreenCTM().inverse());
  const {lo,hi,X,Y,pts,fmt}=geo;let r=lo+(p.x-PL)/(W-PL-PR)*(hi-lo);r=Math.max(lo,Math.min(hi,r));
  const i=Math.round((r-lo)/(hi-lo)*(pts.length-1)),q=pts[i];
  $("hov").setAttribute("visibility","visible");$("hl").setAttribute("x1",X(q[0]));$("hl").setAttribute("x2",X(q[0]));$("hc").setAttribute("cx",X(q[0]));$("hc").setAttribute("cy",Y(q[1]));
  $("readout").innerHTML='Se o mercado estiver em <b>'+fmt(q[0])+'</b>: <b>'+signed(q[1],brl)+'</b> ('+(q[1]>0.0049?"ágio":q[1]<-0.0049?"deságio":"na curva")+')';
}
function niceStep(x){if(!(x>0))return 1;const e=Math.pow(10,Math.floor(Math.log10(x))),f=x/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e}
function compact(v){const a=Math.abs(v);return a>=1e6?fx(v/1e6,1)+" mi":a>=1e3?fx(v/1e3,a>=1e4?0:1)+" mil":fx(v,a<10&&a>0?1:0)}

