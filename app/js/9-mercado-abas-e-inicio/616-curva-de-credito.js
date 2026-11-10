/* ---------- Mercado de crédito: curva de crédito (spread mediano por rating e prazo) e valor relativo entre papéis
   do mesmo emissor. Spread: taxa indicativa ANBIMA menos a NTN-B (IPCA+) do mesmo vencimento, ou o próprio "DI +".
   Rating: a pior nota em escala nacional que os fundos informam à CVM para o emissor (CDA). */
const CC={ind:"ipca",inc:"nao",por:"setor"};
function ccSetor(x){const e=RT.emp||{},r=String(x.cod||"").slice(0,4).toUpperCase();let o=e[r];if(!o&&RT.en&&(x.emissor||x.nome)){const c=RT.en.get(rtNome(x.emissor||x.nome));o=c&&e[c]}return o&&o.setor||"Sem setor"}
const CC_FX=[["AAA",1,1],["AA",2,4],["A",5,7],["BBB",8,10],["Abaixo de BBB",11,99]],CC_PZ=[["até 2 anos",0,2],["2 a 4",2,4],["4 a 7",4,7],["mais de 7",7,99]];
function ccFaixa(v){if(v==null)return "Sem rating";const f=CC_FX.find(x=>v>=x[1]&&v<=x[2]);return f?f[0]:"Sem rating"}
function ccMed(a){const v=a.slice().sort((x,y)=>x-y);if(!v.length)return null;const m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2}
function ccHtml(){return '<div id="ccBox">'+ccIn()+'</div>'}
function ccEspera(){setTimeout(()=>{const b=$("ccBox");if(b&&(CRB.L||CRB.err)&&RT.r)b.innerHTML=ccIn();else if(b)ccEspera()},700)}
function ccIn(){
  if(CRB.err)return '<h3>Curva de crédito</h3><p class="sub">Não foi possível carregar as taxas.</p>';if(!CRB.L){crbCarrega();ccEspera();return '<h3>Curva de crédito</h3><p class="sub">Carregando as taxas das debêntures…</p>'}
  if(!RT.r){rtLoad();ccEspera();return '<h3>Curva de crédito</h3><p class="sub">Carregando os ratings…</p>'}
  const rf=CC.ind==="ipca"?"ipca":"cdimais";
  const L=CRB.L.filter(x=>x.tipo==="Debênture"&&x.rf===rf&&x.sp!=null&&x.dur!=null&&x.dur>0.2&&(CC.inc==="todas"||(CC.inc==="sim")===!!x.isento)).map(x=>{const a=rtAg(null,x.emissor||x.nome);return Object.assign({},x,{nota:a?a.pior:null,fx:ccFaixa(a?a.pior:null),ntxt:a?((a.L.find(o=>o.v===a.pior)||{}).nota||""):"",st:ccSetor(x)})});
  if(L.length<10)return '<h3>Curva de crédito</h3><p class="sub">Poucas debêntures com taxa e prazo para montar a curva.</p>';
  const gk=x=>CC.por==="setor"?x.st:x.fx,cel=(f,p)=>L.filter(x=>gk(x)===f&&x.dur>=p[1]&&x.dur<p[2]).map(x=>x.sp),fmt=v=>v==null?'—':fx(v,2);
  let h='<h3>Curva de crédito</h3><p class="sub">Quanto as debêntures pagam acima da referência, por '+(CC.por==="setor"?"setor":"rating")+' e por prazo: a mediana mostra o preço do risco em cada faixa. Um papel muito acima da mediana do seu grupo paga mais pelo mesmo risco aparente, ou carrega um risco que a nota ainda não mostra.</p>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px 16px;margin:8px 0">'+fnSeg("ccind",[["ipca","IPCA + (sobre a NTN-B)"],["di","DI +"]],CC.ind)+fnSeg("ccpor",[["setor","Por setor"],["rating","Por rating"]],CC.por)+fnSeg("ccinc",[["nao","Comuns"],["sim","Incentivadas (isentas)"],["todas","Todas"]],CC.inc)+'</div>';
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">'+(CC.por==="setor"?"Setor do emissor":"Rating")+'</th>'+CC_PZ.map(p=>'<th>'+p[0]+'</th>').join("")+'<th>Papéis</th></tr></thead><tbody>'
    +(CC.por==="setor"?[...new Set(L.map(x=>x.st))].sort((a,b)=>(a==="Sem setor")-(b==="Sem setor")||L.filter(x=>x.st===b).length-L.filter(x=>x.st===a).length):CC_FX.map(f=>f[0]).concat(["Sem rating"])).map(f=>{const n=L.filter(x=>gk(x)===f).length;if(!n)return "";return '<tr><td style="text-align:left">'+f+'</td>'+CC_PZ.map(p=>{const a=cel(f,p);return '<td>'+fmt(ccMed(a))+(a.length?' <small>('+a.length+')</small>':'')+'</td>'}).join("")+'<td>'+n+'</td></tr>'}).join("")
    +'</tbody></table></div><p class="sub" style="font-size:.8rem">Spread mediano em pontos percentuais ao ano (entre parênteses, quantos papéis). '+(CC.por==="rating"?'Rating: pior nota em escala nacional informada pelos fundos à CVM; cobre '+fx(L.filter(x=>x.fx!=="Sem rating").length/L.length*100,0)+'% destes papéis. ':'Setor da companhia aberta na B3 pela raiz do código do papel. ')+'Taxas indicativas da ANBIMA de '+(CRB.ref?fdate(Date.parse(CRB.ref+"T00:00:00Z")):"—")+'.</p>';
  // acima da curva: spread bem maior que a mediana do grupo (rating × prazo)
  const grp=x=>{const p=CC_PZ.find(q=>x.dur>=q[1]&&x.dur<q[2]);return gk(x)+"|"+(p?p[0]:"")};const G=new Map();L.forEach(x=>{const k=grp(x);(G.get(k)||G.set(k,[]).get(k)).push(x.sp)});
  const acima=L.map(x=>{const a=G.get(grp(x));return a.length>=4?Object.assign(x,{dif:x.sp-ccMed(a)}):null}).filter(x=>x&&!/^Sem /.test(gk(x))&&x.dif>=0.75).sort((a,b)=>b.dif-a.dif).slice(0,10);
  if(acima.length)h+='<div class="label" style="margin-top:12px">Pagando bem acima do seu grupo</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Debênture</th><th>'+(CC.por==="setor"?"Setor":"Rating")+'</th><th>Prazo médio</th><th>Spread</th><th>Acima da mediana</th></tr></thead><tbody>'
    +acima.map(x=>'<tr><td style="text-align:left"><button type="button" class="link" data-crcalc="'+esc(x.cod)+'">'+esc(x.cod)+'</button><small style="display:block;color:var(--muted)">'+esc(x.nome).slice(0,40)+'</small></td><td><small>'+esc(CC.por==="setor"?x.st:x.ntxt)+'</small></td><td>'+fx(x.dur,1)+' anos</td><td>'+fx(x.sp,2)+'</td><td><b>+'+fx(x.dif,2)+'</b></td></tr>').join("")+'</tbody></table></div>';
  // valor relativo: papéis do mesmo emissor e prazo parecido com spreads diferentes
  const E=new Map();L.forEach(x=>{const k=String(x.cod||"").slice(0,4).toUpperCase();(E.get(k)||E.set(k,[]).get(k)).push(x)});
  const pares=[];E.forEach(a=>{for(let i=0;i<a.length;i++)for(let j=0;j<a.length;j++){const x=a[i],y=a[j];if(x!==y&&Math.abs(x.dur-y.dur)<=1.5&&x.sp-y.sp>=0.4)pares.push({x,y,d:x.sp-y.sp})}});
  pares.sort((a,b)=>b.d-a.d);
  if(pares.length)h+='<div class="label" style="margin-top:12px">Valor relativo: mesmo emissor, prazo parecido, spreads diferentes</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Paga mais</th><th style="text-align:left">Paga menos</th><th>Diferença</th></tr></thead><tbody>'
    +pares.slice(0,10).map(p=>'<tr><td style="text-align:left"><button type="button" class="link" data-crcalc="'+esc(p.x.cod)+'">'+esc(p.x.cod)+'</button> <small>'+fx(p.x.sp,2)+' · '+fx(p.x.dur,1)+' anos</small></td><td style="text-align:left"><button type="button" class="link" data-crcalc="'+esc(p.y.cod)+'">'+esc(p.y.cod)+'</button> <small>'+fx(p.y.sp,2)+' · '+fx(p.y.dur,1)+' anos</small></td><td><b>'+fx(p.d,2)+' p.p.</b></td></tr>').join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem">O mesmo emissor com o mesmo prazo deveria pagar parecido. A diferença pode vir de garantia, liquidez, cláusulas ou incentivo fiscal: confira a ficha do título antes de concluir. Toque no código para abrir a calculadora.</p>';
  return h;
}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-ccind],[data-ccinc],[data-ccpor],[data-crcalc]");if(!x)return;
  if(x.dataset.ccind){CC.ind=x.dataset.ccind;const b=$("ccBox");if(b)b.innerHTML=ccIn();return}if(x.dataset.ccpor){CC.por=x.dataset.ccpor;const b=$("ccBox");if(b)b.innerHTML=ccIn();return}if(x.dataset.ccinc){CC.inc=x.dataset.ccinc;const b=$("ccBox");if(b)b.innerHTML=ccIn();return}
  if(x.dataset.crcalc){const c=x.dataset.crcalc;setMod("pc");setTimeout(()=>{const i=$("pcCode");if(i){i.value=c;const b=$("pcFetch");if(b)b.click()}},80)}});
