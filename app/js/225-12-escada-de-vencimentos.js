/* ---------- 12. escada de vencimentos ---------- */
let LADDER=null;
function nnls(A,b){ // mínimos quadrados com quantidades não negativas (Lawson-Hanson); A: m×n
  const m=A.length,n=A[0].length,x=new Array(n).fill(0),P=new Set();
  const resid=()=>b.map((bi,r)=>bi-A[r].reduce((s,a,c)=>s+a*x[c],0));
  const solveP=idx=>{const k=idx.length,M=[],v=[];for(let a=0;a<k;a++){M.push(new Array(k).fill(0));v.push(0)}
    for(let a=0;a<k;a++){for(let c=0;c<k;c++){let s=0;for(let r=0;r<m;r++)s+=A[r][idx[a]]*A[r][idx[c]];M[a][c]=s}let s=0;for(let r=0;r<m;r++)s+=A[r][idx[a]]*b[r];v[a]=s}
    for(let a=0;a<k;a++)M[a][a]+=1e-12;
    for(let p=0;p<k;p++){let mx=p;for(let r=p+1;r<k;r++)if(Math.abs(M[r][p])>Math.abs(M[mx][p]))mx=r;[M[p],M[mx]]=[M[mx],M[p]];[v[p],v[mx]]=[v[mx],v[p]];
      for(let r=p+1;r<k;r++){const f=M[r][p]/M[p][p];for(let c=p;c<k;c++)M[r][c]-=f*M[p][c];v[r]-=f*v[p]}}
    const z=new Array(k).fill(0);for(let p=k-1;p>=0;p--){let s=v[p];for(let c=p+1;c<k;c++)s-=M[p][c]*z[c];z[p]=s/M[p][p]}return z};
  for(let it=0;it<3*n+20;it++){
    const r=resid(),w=new Array(n).fill(0);for(let c=0;c<n;c++){let s=0;for(let q=0;q<m;q++)s+=A[q][c]*r[q];w[c]=s}
    let jb=-1,wm=1e-10;for(let c=0;c<n;c++)if(!P.has(c)&&w[c]>wm){wm=w[c];jb=c}if(jb<0)break;P.add(jb);
    for(let inner=0;inner<3*n+20;inner++){const idx=[...P],z=solveP(idx);
      if(z.every(v=>v>1e-14)){idx.forEach((c,k)=>x[c]=z[k]);break}
      let al=Infinity;idx.forEach((c,k)=>{if(z[k]<=1e-14){const t=x[c]/(x[c]-z[k]);if(t<al)al=t}});
      idx.forEach((c,k)=>{x[c]+=al*(z[k]-x[c]);if(x[c]<=1e-12){x[c]=0;P.delete(c)}})}}
  return x;
}
function ladderCalc(){
  const out=$("ldOut");if(!out)return;const tot=num($("ldAmt").value),typ=$("ldType").value,y0=+$("ldY0").value,y1=+$("ldY1").value,mode=$("ldMode").value;
  if(!(tot>0)){out.innerHTML='<p class="err">Informe o valor a investir.</p>';LADDER=null;return}
  if(y1<y0){out.innerHTML='<p class="err">O último ano precisa ser igual ou posterior ao primeiro.</p>';LADDER=null;return}
  const GRP={ALL:["LTN","NTNF","NTNBP","NTNB","LFT"],IPCA_ALL:["NTNBP","NTNB"],IPCA:["NTNBP"],IPCAJ:["NTNB"],
    PRE_ALL:["LTN","NTNF"],PRE:["LTN"],PREJ:["NTNF"],SELIC:["LFT"],BOTH:["NTNBP","LTN"]},kinds=GRP[typ]||GRP.ALL;
  const cand=new Map();Object.entries(TD_ALL).forEach(([k,v])=>{const [kind,d]=k.split("|");cand.set(k,{kind,d,buy:v.buy})});
  txSeries().list.forEach(x=>{const kind=TX_KIND[x.n];if(!kind||!kinds.includes(kind))return;const k=kind+"|"+x.m;if(!cand.has(k))cand.set(k,{kind,d:x.m,buy:null})});
  const Y=t=>new Date(t).getUTCFullYear(),defl=t=>piFactor(t);
  // entra o título que termina de pagar dentro do período (no RendA+ e no Educa+, também as parcelas precisam começar dentro dele)
  let C=[...cand.values()].map(c=>{const K=KIND[c.kind],mat=matOf(c.kind,c.d);return {kind:c.kind,d:c.d,K,mat,yr:Y(K.b1?parseDate(c.d):mat),buy:c.buy!=null?c.buy:txLastBuy(c.kind,c.d)}})
    .filter(c=>c.K&&!c.K.b1&&kinds.includes(c.kind)&&[...sel.options].some(o=>o.value===c.kind+"|"+c.d)&&c.buy!=null&&isFinite(c.buy)&&c.mat>VAL+60*DAY&&Y(c.mat)<=y1&&c.yr>=y0)
    .sort((a,b)=>a.yr-b.yr||a.mat-b.mat||a.kind.localeCompare(b.kind));
  if(!C.length){out.innerHTML='<p class="err">Nenhum título à venda no Tesouro Direto que pague dentro de '+y0+' a '+y1+' para essa escolha. Amplie o período.</p>';LADDER=null;return}
  C.forEach(c=>{const K=c.K,VD=(TD_DATE_K[c.kind]||TD_DATE)>VAL?(TD_DATE_K[c.kind]||TD_DATE):VAL;
    c.pu=price(c.kind,flowsFrom(c.kind,VD,c.d),c.buy,vnaFor(c.kind,VD)).pu;
    c.cash=pubScenario(c.kind,c.d,K,VAL).cashBetween(c.mat);
    const t1=taxCalc(pubRegime(c.kind,c.mat,c.mat),c.pu,1,VAL,c.cash,c.mat,0);c.netU=t1.flows||[];
    c.pag=K.b1?K.b1+' parcelas mensais de '+txD2(parseDate(c.d))+' a '+txD2(c.mat):K.cpn?'juros semestrais e principal em '+txD2(c.mat):'tudo no vencimento, '+txD2(c.mat)});
  const yrs=[];for(let y=y0;y<=y1;y++)yrs.push(y);
  let q;
  if(mode==="equal")q=C.map(c=>tot/C.length/c.pu);
  else{const A=yrs.map(y=>C.map(c=>c.netU.filter(f=>Y(f.t)===y).reduce((a,f)=>a+f.amt/defl(f.t),0)));
    // resolve de novo sem os títulos com fatia muito pequena (menos de 2% do total), para não espalhar centavos
    let on=C.map(()=>true),x=[];for(let k=0;k<6;k++){const idx=C.map((c,i)=>i).filter(i=>on[i]);const xs=nnls(A.map(r=>idx.map(i=>r[i])),yrs.map(()=>1));
      x=C.map(()=>0);idx.forEach((i,k2)=>x[i]=xs[k2]);const cost=x.reduce((a,v,i)=>a+v*C[i].pu,0);if(!(cost>0))break;
      const peq=idx.filter(i=>x[i]>0&&x[i]*C[i].pu/cost<0.02);if(!peq.length)break;peq.forEach(i=>on[i]=false)}
    const cost=x.reduce((a,v,i)=>a+v*C[i].pu,0);q=cost>0?x.map(v=>v*tot/cost):C.map(()=>0)}
  C.forEach((c,i)=>{let qq=Math.floor(q[i]*100)/100;if(qq*c.pu<30)qq=0;c.q=qq;c.inv=qq*c.pu;
    const tx=qq>0?taxCalc(pubRegime(c.kind,c.mat,c.mat),c.inv,qq,VAL,c.cash,c.mat,0):{tax:0,cust:0,flows:[]};
    c.gross=qq*c.cash.reduce((a,f)=>a+f.amt,0);c.tax=tx.tax;c.cust=tx.cust;c.net=c.gross-c.tax-c.cust;c.netF=(tx.flows||[]).map(f=>({t:f.t,amt:f.amt*qq}));c.grossF=c.cash.map(f=>({t:f.t,amt:f.amt*qq}));c.real=c.netF.reduce((a,f)=>a+f.amt/defl(f.t),0)});
  const U=C.filter(c=>c.q>0);LADDER=U;
  if(!U.length){out.innerHTML='<p class="err">O valor é pequeno demais para montar a escada com esses títulos (o Tesouro Direto exige pelo menos R$ 30 por título).</p>';return}
  // fluxo por ano-calendário
  const byY=new Map();const add=(y,k,v,fam)=>{const o=byY.get(y)||{y,gross:0,net:0,real:0,cpn:0,venc:0,tit:[],fam:{}};o[k]+=v;if(fam&&k==="net")o.fam[fam]=(o.fam[fam]||0)+v;byY.set(y,o)};
  U.forEach(c=>{c.grossF.forEach(f=>{const y=Y(f.t);add(y,"gross",f.amt);if(Math.abs(f.t-c.mat)<5*DAY){add(y,"venc",f.amt);byY.get(y).tit.push(c.K.td.replace("Tesouro ","")+" "+Y(c.mat))}else add(y,"cpn",f.amt)});c.netF.forEach(f=>{add(Y(f.t),"net",f.amt,c.K.fam);add(Y(f.t),"real",f.amt/defl(f.t))})});
  yrs.forEach(y=>{if(!byY.has(y))byY.set(y,{y,gross:0,net:0,real:0,cpn:0,venc:0,tit:[],fam:{}})});
  const YR=[...byY.values()].sort((a,b)=>a.y-b.y),inR=YR.filter(o=>o.y>=y0&&o.y<=y1),S=k=>U.reduce((a,c)=>a+c[k],0);
  const vazio=yrs.filter(y=>!(byY.get(y).gross>0)),mediaReal=inR.length?inR.reduce((a,o)=>a+o.real,0)/yrs.length:0;
  const piM=piProj(U[U.length-1].mat),tipos=[...new Set(U.map(c=>c.kind))].map(k=>KIND[k].td).join(", ");
  let h='<div class="tot" style="margin-top:4px"><div><span class="n">Aplicado</span><span class="v">'+brl(S("inv"))+'</span><span class="n">'+U.length+' títulos</span></div><div><span class="n">Recebe no total (líquido)</span><span class="v">'+brl(S("net"))+'</span><span class="n">bruto '+brl(S("gross"))+'</span></div><div><span class="n">Por ano, em valores de hoje</span><span class="v">'+brl(mediaReal)+'</span><span class="n">média de '+y0+' a '+y1+' · IPCA projetado '+fx(piM,2)+'% a.a.</span></div></div>';
  h+=ladderChartY(YR,y0,y1);
  if(vazio.length)h+='<p class="warn" style="font-size:.86rem">Sem pagamento em '+vazio.join(", ")+': nenhum título à venda dessa escolha paga nesses anos.</p>';
  const TT=k=>YR.reduce((a,o)=>a+o[k],0);
  h+='<div class="label" style="margin-top:12px">Quanto você recebe em cada ano</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab"><thead><tr><th style="text-align:left">Ano</th><th style="text-align:left">Vence</th><th>Juros<br><small>semestrais</small></th><th>Vencimentos</th><th>Bruto</th><th>IR e<br>custódia</th><th>Líquido</th><th>Em valores<br>de hoje</th></tr></thead><tbody>'
    +YR.map(o=>'<tr'+(o.y<y0||o.y>y1?' class="msub"':'')+'><td style="text-align:left"><b>'+o.y+'</b>'+(o.y<y0?'<br><small>antes do período</small>':'')+'</td><td style="text-align:left"><small>'+(o.tit.length?esc(o.tit.join(", ")):o.gross>0?'só juros':'nenhum pagamento')+'</small></td><td>'+brl(o.cpn)+'</td><td>'+brl(o.venc)+'</td><td>'+brl(o.gross)+'</td><td>'+brl(o.gross-o.net)+'</td><td><b>'+brl(o.net)+'</b></td><td><b>'+brl(o.real)+'</b></td></tr>').join("")
    +'</tbody><tfoot><tr><td style="text-align:left"><b>Total</b></td><td></td><td>'+brl(TT("cpn"))+'</td><td>'+brl(TT("venc"))+'</td><td>'+brl(TT("gross"))+'</td><td>'+brl(TT("gross")-TT("net"))+'</td><td><b>'+brl(TT("net"))+'</b></td><td><b>'+brl(TT("real"))+'</b></td></tr></tfoot></table></div>';
  h+='<div class="label" style="margin-top:12px">Títulos a comprar</div>';
  h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab"><thead><tr><th style="text-align:left">Título</th><th class="c-tx">Taxa de<br>compra</th><th>Qtd.</th><th>Aplicar</th><th>Recebe<br><small>líquido</small></th><th class="c-ph">Em valores<br>de hoje</th></tr></thead><tbody>'+U.map(c=>'<tr><td style="text-align:left"><b>'+esc(c.K.td)+' '+(c.K.b1?Y(parseDate(c.d)):Y(c.mat))+'</b><br><small>'+esc(c.pag)+' · PU '+fx(c.pu,2)+'</small></td><td class="c-tx">'+fr(c.K.fam,c.buy)+'</td><td>'+fx(c.q,2)+'</td><td>'+compactBRL(c.inv)+'</td><td>'+compactBRL(c.net)+'</td><td class="c-ph">'+compactBRL(c.real)+'</td></tr>').join("")+'</tbody></table></div>';
  h+='<p class="sub" style="font-size:.82rem;margin-top:8px">Títulos usados: '+esc(tipos)+'. '+(mode==="equal"?'Mesmo valor aplicado em cada título que paga dentro do período.':'O app escolhe quanto comprar de cada título para que o valor líquido recebido em cada ano, em reais de hoje, fique o mais igual possível no período (otimização com quantidades não negativas); títulos que não ajudam ficam de fora.')+' Entram os títulos que vencem de '+y0+' a '+y1+'. O RendA+ e o Educa+ ficam de fora: pagam em parcelas mensais e não se comparam aos demais (veja-os em Calcular título). Cupons de títulos com juros semestrais podem cair antes do período. Taxas de compra do Tesouro Direto de '+(TD_DATE?fdate(TD_DATE):fdate(VAL))+'; preço pela metodologia oficial; quantidades arredondadas para baixo em 0,01 título (mínimo de R$ 30 por título). Líquido: IR pela tabela regressiva em cada pagamento e custódia da B3. IPCA+ e Selic usam a projeção escolhida em Mercado › Inflação; hoje: '+esc(piModeName())+'.</p>';
  out.innerHTML=h;
}
function ladderChartY(YR,y0,y1){
  const W=760,H=210,PL=58,PR=10,PT=12,PB=30,mx=Math.max(...YR.map(o=>o.net),1),st=niceStep(mx/4),top=Math.ceil(mx/st)*st,n=YR.length,bw=(W-PL-PR)/n,Yp=v=>PT+(top-v)/top*(H-PT-PB);
  const COL={pre:"var(--s2)",ipca:"var(--accent)",selic:"var(--muted)"};
  let g='';for(let v=0;v<=top+st/2;v+=st){const y=Yp(v);g+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-dasharray="2 4"/><text x="'+(PL-6)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+compact(v)+'</text>'}
  const lab=Math.max(1,Math.ceil(n/18));
  YR.forEach((o,i)=>{const x=PL+i*bw+bw*.15,w=bw*.7,fora=o.y<y0||o.y>y1;let base=0;
    ["ipca","pre","selic"].forEach(f=>{const v=o.fam[f]||0;if(v<=0)return;const yT=Yp(base+v),yB=Yp(base);g+='<rect x="'+x.toFixed(1)+'" y="'+yT.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(0,yB-yT).toFixed(1)+'" fill="'+COL[f]+'"'+(fora?' opacity=".45"':'')+'><title>'+o.y+': '+brl(o.net)+' líquido ('+brl(o.real)+' em valores de hoje)</title></rect>';base+=v});
    g+='<rect x="'+x.toFixed(1)+'" y="'+Yp(o.real).toFixed(1)+'" width="'+w.toFixed(1)+'" height="2" fill="var(--ink)"/>';
    if(i%lab===0)g+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(H-PB+16)+'" text-anchor="middle">'+o.y+'</text>'});
  return '<div class="chartbox"><svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Valor líquido recebido por ano">'+g+'</svg></div><div class="legend"><span><i style="background:var(--accent)"></i>IPCA+ (líquido)</span><span><i style="background:var(--s2)"></i>Prefixado (líquido)</span><span><i style="background:var(--muted)"></i>Selic (líquido)</span><span><i style="background:var(--ink);border-radius:0;height:3px"></i>Em valores de hoje</span></div>';
}
function txLastBuy(kind,d){const n=TX_KIND.indexOf(kind);if(n<0)return null;const s=txIndex().get(n+"|"+txMatFromKind(kind,d));if(!s||!s.t.length)return null;const i=s.t.length-1;return VAL-s.t[i]<=10*DAY?s.c[i]:null}


function simCalc(){eqCalc();ladderCalc()}
function simBind(){
  ["eqIdx","eqDir"].forEach(id=>$(id).addEventListener("change",eqCalc));["eqRate","eqMat"].forEach(id=>$(id).addEventListener("input",eqCalc));
  ["ldType","ldMode","ldY0","ldY1"].forEach(id=>$(id).addEventListener("change",ladderCalc));$("ldAmt").addEventListener("input",()=>{clearTimeout(simBind.t);simBind.t=setTimeout(ladderCalc,250)});
  const y=new Date(VAL).getUTCFullYear();[$("ldY0"),$("ldY1")].forEach((s,i)=>{for(let k=y;k<=y+60;k++){const o=document.createElement("option");o.value=k;o.textContent=k;s.appendChild(o)}s.value=i?y+10:y+1});
  $("eqMat").value=isoD(addMonths(VAL,24));
}


