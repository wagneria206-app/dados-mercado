/* ---------- Mercado › Crédito: saúde financeira dos emissores de debêntures (balanços na CVM) */
// Dados do robô scripts/emissores.py (ramo "emissores"). Colunas de cada balanço:
// receita, ebitda, ebit, desp_fin, lucro, caixa, divida_cp, divida_lp, pl, ativo_circ, passivo_circ, fim
const EM={d:null,err:null,load:null,q:"",abre:null,ord:"risco"};
function emBoot(){if(EM.d||EM.load||EM.err)return;EM.load=fetch(DADOS_RAIZ+"emissores/emissores.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(d=>{EM.d=d;EM.load=null;if(activeMod==="cr")mkCalc()}).catch(e=>{EM.err=e;EM.load=null})}
function emCalc(e){
  const A=Object.keys(e.a||{}).sort(),Q=Object.keys(e.q||{}).sort();if(!A.length&&!Q.length)return null;
  const ua=A.length?e.a[A[A.length-1]]:null;
  // EBIT, despesa financeira e receita dos últimos 12 meses: 4 trimestres seguidos mais novos que o último balanço anual; senão, o anual
  let ebit=ua?ua[2]:null,dfin=ua?ua[3]:null,rec=ua?ua[0]:null,base=ua?ua[11]:null;
  const q4=Q.slice(-4);if(q4.length===4&&(!ua||q4[3]>ua[11])){const mes=k=>+k.slice(0,4)*12+(+k.slice(5,7));if(mes(q4[3])-mes(q4[0])===9){const s=i=>q4.reduce((a,k)=>a+(e.q[k][i]||0),0);ebit=s(2);dfin=s(3);rec=s(0);base=q4[3]}}
  const da=ua&&ua[1]!=null&&ua[2]!=null?ua[1]-ua[2]:null,ebitda=ebit!=null&&da!=null?ebit+da:ebit;
  const bk=Q.length&&(!ua||Q[Q.length-1]>ua[11])?e.q[Q[Q.length-1]]:ua,dv=(bk[6]||0)+(bk[7]||0),dl=dv-(bk[5]||0);
  const lev=ebitda>0?dl/ebitda:null,cob=dfin>0&&ebitda!=null?ebitda/dfin:null,liq=bk[10]>0?bk[9]/bk[10]:null,cp=dv>0?(bk[6]||0)/dv*100:null;
  const hist=A.slice(-5).map(y=>{const r=e.a[y],d=(r[6]||0)+(r[7]||0)-(r[5]||0);return {y,lev:r[1]>0?d/r[1]:null,rec:r[0],ebitda:r[1],ll:r[4],dl:d}});
  let s=0;const alerta=[];
  if(ebitda==null||ebitda<=0){s+=3;alerta.push("EBITDA negativo")}else if(lev>4){s+=3;alerta.push("dívida alta")}else if(lev>3){s+=2}else if(lev>2){s+=1}
  if(cob!=null&&cob<1.5){s+=2;alerta.push("juros pesam no resultado")}else if(cob!=null&&cob<3)s+=1;
  if(liq!=null&&liq<0.8){s+=1;alerta.push("pouco caixa de curto prazo")}
  if(cp!=null&&cp>40&&(liq==null||liq<1.2)){s+=1;alerta.push("muita dívida vencendo em 12 meses")}
  const h2=hist.filter(x=>x.lev!=null);if(h2.length>=2&&h2[h2.length-1].lev-h2[h2.length-2].lev>1){s+=1;alerta.push("alavancagem subindo")}
  return {lev,cob,liq,cp,dl,ebitda,rec,base,hist,s,alerta,nivel:s<=1?1:s<=3?2:3};
}
const EM_NV=["","Confortável","Atenção","Frágil"],EM_COR=["","var(--gain)","var(--warn)","var(--loss)"];
function emHtml(){
  if(!EM.d){emBoot();return EM.err?'<h3>Saúde financeira dos emissores</h3><p class="sub">Esta análise aparece depois da primeira coleta do robô de emissores no servidor (balanços da CVM).</p>':'<h3>Saúde financeira dos emissores</h3><p class="sub">Carregando os balanços dos emissores…</p>'}
  const L=[];Object.entries(EM.d.e).forEach(([cnpj,e])=>{const c=emCalc(e);if(c)L.push(Object.assign({cnpj,n:e.n,deb:e.deb},c))});
  const q=fnNorm(EM.q);const V=L.filter(x=>!q||fnNorm(x.n+" "+x.deb.join(" ")).includes(q));
  V.sort(EM.ord==="risco"?(a,b)=>b.s-a.s||(b.lev||99)-(a.lev||99):EM.ord==="lev"?(a,b)=>(b.lev==null?99:b.lev)-(a.lev==null?99:a.lev):(a,b)=>a.n.localeCompare(b.n));
  const cnt=[1,2,3].map(n=>L.filter(x=>x.nivel===n).length);
  const f=(v,d,suf)=>v==null||!isFinite(v)?'—':fx(v,d)+(suf||'');
  let h='<h3>Saúde financeira dos emissores</h3><p class="sub">Balanços entregues à CVM pelos emissores das debêntures do app: dívida líquida sobre EBITDA (quantos anos de geração de caixa pagam a dívida), cobertura de juros, liquidez e dívida que vence em 12 meses. Últimos 12 meses quando há quatro trimestres; senão, o último balanço anual.</p>'
    +'<div class="fnkpis">'+tecKp("Emissores analisados",fx(L.length,0),'com balanço na CVM')+[1,2,3].map(n=>tecKp(EM_NV[n],fx(cnt[n-1],0),n===1?'dívida baixa e juros cobertos':n===2?'algum indicador no limite':'dívida alta, juros pesados ou prejuízo')).join("")+'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:end;margin:8px 0"><div class="field" style="min-width:220px;flex:1"><label for="emQ">Emissor ou código da debênture</label><input id="emQ" value="'+esc(EM.q)+'" autocomplete="off"></div>'+fnSeg("emord",[["risco","Mais frágeis primeiro"],["lev","Maior alavancagem"],["nome","Nome"]],EM.ord)+'</div>';
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Emissor</th><th>Situação</th><th>Dívida líq./EBITDA</th><th class="c-ph">Cobertura de juros</th><th class="c-ph">Liquidez corrente</th><th class="c-ph c-sm">Dívida em 12 meses</th><th class="c-ph c-md">Balanço</th></tr></thead><tbody>';
  V.slice(0,80).forEach(x=>{
    h+='<tr><td style="text-align:left"><button type="button" class="link" data-emabre="'+x.cnpj+'">'+esc(x.n)+'</button><br><small>'+x.deb.length+' debênture'+(x.deb.length>1?'s':'')+(x.alerta.length?' · '+esc(x.alerta.join(", ")):'')+'</small></td>'
      +'<td><b style="color:'+EM_COR[x.nivel]+'">'+EM_NV[x.nivel]+'</b></td><td>'+(x.ebitda!=null&&x.ebitda<=0?'EBITDA negativo':f(x.lev,1,'x'))+'</td><td class="c-ph">'+f(x.cob,1,'x')+'</td><td class="c-ph">'+f(x.liq,2)+'</td><td class="c-ph c-sm">'+f(x.cp,0,'%')+'</td><td class="c-ph c-md">'+(x.base?fdate(Date.parse(x.base+"T00:00:00Z")):'—')+'</td></tr>';
    if(EM.abre===x.cnpj)h+='<tr><td colspan="7" style="text-align:left"><div class="label">Histórico anual</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ano</th><th>Receita</th><th>EBITDA</th><th>Lucro</th><th>Dívida líquida</th><th>Dív. líq./EBITDA</th></tr></thead><tbody>'
      +x.hist.map(r=>'<tr><td style="text-align:left">'+r.y+'</td><td>'+fnMoney(r.rec)+'</td><td>'+fnMoney(r.ebitda)+'</td><td>'+fnMoney(r.ll)+'</td><td>'+fnMoney(r.dl)+'</td><td>'+f(r.lev,1,'x')+'</td></tr>').join("")+'</tbody></table></div><p class="sub" style="font-size:.8rem">Debêntures: '+x.deb.map(esc).join(", ")+'.</p></td></tr>';
  });
  h+='</tbody></table></div>'+(V.length>80?'<p class="sub">Mostrando 80 de '+V.length+'. Use a busca para achar os demais.</p>':'')
    +'<p class="sub" style="font-size:.8rem">Fonte: CVM (cadastro de companhias abertas, DFP e ITR), coletados em '+fdate(Date.parse(EM.d.geradoEm))+'. EBITDA = resultado antes do financeiro + depreciação e amortização do fluxo de caixa do último ano. Emissores sem registro de companhia aberta na CVM (como muitas debêntures de infraestrutura de empresas fechadas) e securitizadoras ficam de fora. Situação: classificação do app pelos indicadores, não é nota de agência.</p>';
  return h;
}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-emabre],[data-emord]");if(!x)return;if(x.dataset.emabre)EM.abre=EM.abre===x.dataset.emabre?null:x.dataset.emabre;if(x.dataset.emord)EM.ord=x.dataset.emord;mkCalc()});
document.addEventListener("input",e=>{if(e.target&&e.target.id==="emQ"){EM.q=e.target.value;clearTimeout(EM.tq);EM.tq=setTimeout(()=>{mkCalc();const i=$("emQ");if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},350)}});
