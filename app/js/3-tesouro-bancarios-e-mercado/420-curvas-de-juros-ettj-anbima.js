/* ---------- Curvas de juros (ETTJ ANBIMA): atual, 1 dia, 1 semana, 1 mês e 1 ano atrás ---------- */
let CURV=null;
let CURV_SEL={d0:1,d1:1,d7:0,d30:1,d365:1};
try{const s=JSON.parse(localStorage.getItem("curvSel")||"null");if(s&&typeof s==="object")CURV_SEL=Object.assign(CURV_SEL,s)}catch(e){}
async function curvasLoad(){try{CURV=await roboJson("curvas_hist.json");if(MKM.has(activeMod))mkCalc()}catch(e){}}
const CV_WIN=[["d0","Atual","var(--accent)",""],["d1","1 dia atrás","var(--s3)",""],["d7","1 semana atrás","var(--s4)",""],["d30","1 mês atrás","var(--s2)",""],["d365","1 ano atrás","var(--muted)","5 4"]];
function nssY(b,t){const [b1,b2,b3,b4,l1,l2]=b,e1=Math.exp(-l1*t),e2=Math.exp(-l2*t),f1=(1-e1)/(l1*t);return (b1+b2*f1+b3*(f1-e1)+b4*((1-e2)/(l2*t)-e2))*100}
function solve4(A,b){const n=4,M=A.map((r,i)=>r.concat([b[i]]));for(let p=0;p<n;p++){let mx=p;for(let r=p+1;r<n;r++)if(Math.abs(M[r][p])>Math.abs(M[mx][p]))mx=r;[M[p],M[mx]]=[M[mx],M[p]];if(Math.abs(M[p][p])<1e-14)return null;for(let r=p+1;r<n;r++){const f=M[r][p]/M[p][p];for(let c=p;c<=n;c++)M[r][c]-=f*M[p][c]}}const x=[0,0,0,0];for(let p=n-1;p>=0;p--){let s=M[p][n];for(let c=p+1;c<n;c++)s-=M[p][c]*x[c];x[p]=s/M[p][p]}return x}
let CV_TDL=null,CV_TDK="";
function curvTd(dateKey,ref){ // ajuste da fórmula da ANBIMA às taxas do Tesouro Direto do dia (média entre compra e resgate)
  const k=CALC_GEN+"|"+Object.keys(TDH).length;if(k!==CV_TDK){CV_TDL=txSeries().list;CV_TDK=k}
  const D=Date.parse(dateKey+"T00:00:00Z"),out={span:{}};let used=null;
  for(const [key,ns] of [["pre",[4,5]],["ipca",[0,1]]]){
    const P=[];CV_TDL.forEach(s=>{if(!ns.includes(s.n))return;let i=-1;for(let j=s.t.length-1;j>=0;j--)if(s.t[j]<=D){i=j;break}if(i<0||D-s.t[i]>5*DAY)return;
      const c=s.c[i],v=s.v[i],r=c!=null&&v!=null?(c+v)/2:v!=null?v:c;const t=(parseDate(s.m)-D)/DAY/365.25;if(r==null||!(t>0.25))return;P.push([t,r]);if(!used||s.t[i]>used)used=s.t[i]});
    if(P.length<5)return null;
    const rb=ref[key],l1=rb[4],l2=rb[5],bas=t=>{const e1=Math.exp(-l1*t),e2=Math.exp(-l2*t),f1=(1-e1)/(l1*t);return [1,f1,f1-e1,(1-e2)/(l2*t)-e2]};
    const A=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],y=[0,0,0,0],lam=1e-4*P.length;
    P.forEach(([t,r])=>{const x=bas(t),res=r/100-nssY(rb,t)/100;for(let a=0;a<4;a++){y[a]+=x[a]*res;for(let c=0;c<4;c++)A[a][c]+=x[a]*x[c]}});for(let a=0;a<4;a++)A[a][a]+=lam;
    const d=solve4(A,y);if(!d)return null;out[key]=[rb[0]+d[0],rb[1]+d[1],rb[2]+d[2],rb[3]+d[3],l1,l2];
    const ts=P.map(p=>p[0]);out.span[key]=[Math.min(...ts),Math.max(...ts)];
  }
  out.used=used;return out;
}
function curvWins(){
  const D=CURV&&CURV.dias?CURV.dias:{},ks=Object.keys(D).filter(k=>D[k]&&D[k].pre&&D[k].ipca).sort();
  if(!ks.length)return null;
  const ref=ks[ks.length-1],T=k=>Date.parse(k+"T00:00:00Z"),R=T(ref);
  const pick=(target,tol)=>{let best=null;for(const k of ks){if(T(k)<=target)best=k;else break}return best&&target-T(best)<=tol*DAY?best:null};
  const mAgo=n=>{const d=new Date(R);d.setUTCMonth(d.getUTCMonth()-n);return d.getTime()};
  const yAgo=()=>{const d=new Date(R);d.setUTCFullYear(d.getUTCFullYear()-1);return d.getTime()};
  const at={d0:ref,d1:ks.length>1?ks[ks.length-2]:null,d7:pick(R-7*DAY,6),d30:pick(mAgo(1),7),d365:pick(yAgo(),7)};
  const tgt={d7:R-7*DAY,d30:mAgo(1),d365:yAgo()},refB=D[ref];
  return CV_WIN.map(([k,lab,col,dash])=>{if(at[k])return {k,lab,col,dash,date:at[k],b:D[at[k]]};
    if(tgt[k]){let t=tgt[k];while([0,6].includes(new Date(t).getUTCDay()))t-=DAY;const b=curvTd(isoD(t),refB);if(b)return {k,lab,col,dash,date:isoD(b.used||t),b,approx:true,span:b.span}}
    return {k,lab,col,dash,date:null,b:null}});
}
function curvSeries(W,kind){
  const tmax=kind==="real"?30:10,pts=[];for(let t=1;t<=tmax+1e-9;t+=0.25)pts.push(+t.toFixed(2));
  const inS=(w,key,t)=>!w.approx||(t>=w.span[key][0]-0.25&&t<=w.span[key][1]+0.25);
  const f=(w,t)=>{const b=w.b,p=nssY(b.pre,t),r=nssY(b.ipca,t);if(kind==="pre")return inS(w,"pre",t)?p:NaN;if(kind==="real")return inS(w,"ipca",t)?r:NaN;return inS(w,"pre",t)&&inS(w,"ipca",t)?((1+p/100)/(1+r/100)-1)*100:NaN};
  return W.filter(w=>w.b&&CURV_SEL[w.k]).map(w=>Object.assign({},w,{lab:w.lab+(w.approx?" ≈":""),pts:pts.map(t=>[t,f(w,t)]).filter(p=>isFinite(p[1])),at:t=>f(w,t)}));
}
function curvChart(S,kind){
  S=S.filter(s=>s.pts.length>1);if(!S.length)return '<p class="sub">Marque ao menos uma curva acima.</p>';
  const NW=window.innerWidth<640,W=NW?420:chartW(),H=NW?290:chartH(250,W),PL=NW?44:50,PR=NW?10:14,PT=12,PB=30,tmax=kind==="real"?30:10,tmin=1;
  let lo=Infinity,hi=-Infinity;S.forEach(s=>s.pts.forEach(p=>{lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1])}));
  const pad=Math.max(0.15,(hi-lo)*0.08);lo-=pad;hi+=pad;const st=niceStep((hi-lo)/5);lo=Math.floor(lo/st)*st;hi=Math.ceil(hi/st)*st;
  const X=t=>PL+(t-tmin)/(tmax-tmin)*(W-PL-PR),Y=v=>PT+(hi-v)/(hi-lo)*(H-PT-PB);
  let g='';for(let v=lo;v<=hi+st/2;v+=st){const y=Y(v);g+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-dasharray="2 4"/><text x="'+(PL-6)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+fx(v,st<0.5?2:1)+'%</text>'}
  (kind==="real"?(NW?[1,5,10,20,30]:[1,3,5,10,15,20,25,30]):(NW?[1,2,4,6,8,10]:[1,2,3,4,5,6,7,8,9,10])).forEach(t=>{const x=X(t);g+='<text x="'+x.toFixed(1)+'" y="'+(H-PB+16)+'" text-anchor="middle">'+t+(t===1?' ano':'')+'</text>'});
  g+='<text x="'+(W-PR)+'" y="'+(H-4)+'" text-anchor="end" style="font-size:10px">prazo (anos)</text>';
  [...S].reverse().forEach(s=>{const d=s.pts.map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join(' ');
    g+='<path d="'+d+'" fill="none" stroke="'+s.col+'" stroke-width="'+(s.k==="d0"?2.6:1.8)+'"'+(s.dash?' stroke-dasharray="'+s.dash+'"':'')+' stroke-linejoin="round"/>'});
  g+='<line class="cvx" x1="0" x2="0" y1="'+PT+'" y2="'+(H-PB)+'" stroke="var(--ink)" stroke-width="1" opacity="0" />';
  const meta={kind,tmin,tmax,PL,PR,W,S:S.map(s=>({lab:s.lab,date:s.date,col:s.col,pts:s.pts}))};
  return '<div class="cvchart" data-cv=\''+JSON.stringify(meta).replace(/'/g,"&#39;")+'\'><svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Curva '+kind+'">'+g+'<rect class="cvhit" x="'+PL+'" y="'+PT+'" width="'+(W-PL-PR)+'" height="'+(H-PT-PB)+'" fill="transparent"/></svg><div class="cvtip" hidden></div></div>';
}
function curvTable(S,kind){
  if(!S.length)return "";
  const V=kind==="real"?[1,2,3,5,10,20,30]:[1,2,3,5,10],base=S.find(s=>s.k==="d0");
  return '<div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab cvtab"><thead><tr><th style="text-align:left">Prazo</th>'+S.map(s=>'<th>'+esc(s.lab)+'<br><small>'+fdate(Date.parse(s.date))+'</small></th>').join("")+'</tr></thead><tbody>'
   +V.map(t=>'<tr><td style="text-align:left">'+t+(t===1?' ano':' anos')+'</td>'+S.map(s=>{const v=s.at(t);if(!isFinite(v))return '<td class="sub">—</td>';let d="";if(base&&s!==base){const x=base.at(t)-v;if(isFinite(x))d=' <small>('+(x>=0?'+':'−')+fx(Math.abs(x),2)+')</small>'}return '<td>'+(s.k==="d0"?'<b>':'')+fx(v,2)+'%'+(s.k==="d0"?'</b>':'')+d+'</td>'}).join("")+'</tr>').join("")
   +'</tbody></table></div>'+(base&&S.length>1?'<p class="sub" style="font-size:.8rem;margin-top:4px">Entre parênteses: quanto a curva atual está acima (+) ou abaixo (−) daquela data, em pontos percentuais.</p>':'');
}
function curvHtml(){
  const W=curvWins();
  let h='<h3>Curvas de juros</h3><p class="sub">Estrutura a termo da ANBIMA (ETTJ), calculada com os títulos públicos: prefixada, juro real (IPCA) e inflação implícita. Marque as datas que quer comparar.</p>';
  if(!W){
    return h+'<p class="warn" style="font-size:.88rem">O histórico das curvas ainda está sendo montado pelo robô. Ele aparece aqui depois da próxima coleta.</p>';
  }
  h+='<div class="cvsel" role="group" aria-label="Curvas exibidas">'+W.map(w=>'<label'+(w.b?'':' style="opacity:.5" title="Ainda sem dado dessa data no histórico"')+'><input type="checkbox" data-cvsel="'+w.k+'"'+(w.b&&CURV_SEL[w.k]?' checked':'')+(w.b?'':' disabled')+'><i style="background:'+w.col+'"></i>'+esc(w.lab)+(w.approx?' ≈':'')+(w.date?' <small>'+fdate(Date.parse(w.date))+'</small>':' <small>sem dado</small>')+'</label>').join("")+'</div>';
  [["pre","Prefixada (juro nominal)"],["real","Juro real (IPCA+)"],["impl","Inflação implícita"]].forEach(([k,t])=>{const S=curvSeries(W,k);h+='<div class="cvblock"><h4>'+t+'</h4>'+curvChart(S,k)+curvTable(S,k)+'</div>'});
  const faltam=W.filter(w=>!w.b).map(w=>w.lab.toLowerCase()),aprox=W.filter(w=>w.approx);
  h+='<p class="sub" style="font-size:.8rem;margin-top:8px">Fonte: ANBIMA, ETTJ do dia (parâmetros Nelson-Siegel-Svensson publicados), taxas zero-cupom em % a.a., base 252 dias úteis. Inflação implícita = (1 + prefixada) ÷ (1 + real) − 1. Prazos de 1 a 10 anos (juro real até 30 anos), como a ANBIMA publica. Datas sem curva publicada (fim de semana e feriado) usam o dia útil anterior.'+(aprox.length?' <b>≈ Aproximada</b> ('+aprox.map(w=>w.lab.toLowerCase()).join(", ")+'): o site da ANBIMA só disponibiliza os últimos dias; para datas mais antigas, a curva foi estimada com as taxas do Tesouro Direto daquele dia (média entre compra e resgate), ajustadas pela mesma fórmula da ANBIMA, e aparece só na faixa de prazos dos títulos negociados. Num dia normal, fica a até cerca de 0,05 p.p. da curva oficial. Quando o histórico oficial tiver a data, o app passa a usá-lo.':'')+(faltam.length?' Ainda sem dado para '+faltam.join(", ")+': o robô está completando o histórico.':'')+'</p>';
  return h;
}
document.addEventListener("change",e=>{const c=e.target.closest&&e.target.closest("[data-cvsel]");if(!c)return;CURV_SEL[c.dataset.cvsel]=c.checked?1:0;try{localStorage.setItem("curvSel",JSON.stringify(CURV_SEL))}catch(x){}const y=window.scrollY;mkCalc();window.scrollTo(0,y)});
let CV_NW=window.innerWidth<640;window.addEventListener("resize",()=>{const n=window.innerWidth<640;if(n!==CV_NW){CV_NW=n;if(MKM.has(activeMod))mkCalc()}});
document.addEventListener("mousemove",e=>{const box=e.target.closest&&e.target.closest(".cvchart");if(!box){document.querySelectorAll(".cvtip").forEach(t=>{if(!t.hidden)t.hidden=true});document.querySelectorAll(".cvx").forEach(l=>l.setAttribute("opacity","0"));return}
  let M;try{M=JSON.parse(box.dataset.cv)}catch(x){return}const svg=box.querySelector("svg"),R=svg.getBoundingClientRect(),sx=R.width/M.W,px=(e.clientX-R.left)/sx;
  let t=M.tmin+(px-M.PL)/(M.W-M.PL-M.PR)*(M.tmax-M.tmin);t=Math.max(M.tmin,Math.min(M.tmax,t));t=Math.round(t*4)/4;
  const X=M.PL+(t-M.tmin)/(M.tmax-M.tmin)*(M.W-M.PL-M.PR),ln=box.querySelector(".cvx");ln.setAttribute("x1",X);ln.setAttribute("x2",X);ln.setAttribute("opacity",".35");
  const tip=box.querySelector(".cvtip");tip.innerHTML='<b>'+fx(t,2).replace(/,00$/,"").replace(/0$/,"")+(t===1?' ano':' anos')+'</b>'+M.S.map(s=>{const p=s.pts.find(q=>Math.abs(q[0]-t)<1e-6);return '<span><i style="background:'+s.col+'"></i>'+esc(s.lab)+': '+(p?fx(p[1],2)+'%':'—')+'</span>'}).join("");
  tip.hidden=false;const bx=box.getBoundingClientRect(),left=X*sx+12;tip.style.top="8px";tip.style.left=(left+tip.offsetWidth>bx.width?Math.max(0,X*sx-tip.offsetWidth-12):left)+"px"});

document.addEventListener("change",e=>{if(e.target&&e.target.id==="piMode")mkClick({target:{id:"piSave",closest:()=>null}})});
let FX_TOP=null;
