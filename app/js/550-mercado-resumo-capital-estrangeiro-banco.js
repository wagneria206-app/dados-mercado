/* ===== Mercado › Resumo: capital estrangeiro (Banco Central) e risco-país implícito ===== */
const FLX={d:null,load:null};
function fluxoLoad(){
  if(FLX.load)return;const g=f=>fetch(ROBO+f,{cache:"no-cache"}).then(r=>r.ok?r.json():null).catch(()=>null);
  FLX.load=Promise.all([g("fluxo_estrangeiro.json"),FXF?null:g("dolar_futuro.json"),FXJ?null:g("dolar_fundamentos.json"),(typeof MK==="object"&&MK.di)||RISCO.di?null:g("di_futuro.json")]).then(([f,a,b,c])=>{FLX.d=f||{};if(a)RISCO.fxf=a;if(b)RISCO.fxj=b;if(c)RISCO.di=c;if(typeof activeMod!=="undefined"&&activeMod==="rs"&&typeof mkCalc==="function")mkCalc()});
}
function fluxoHtml(){
  if(!FLX.d){fluxoLoad();return ""}
  let h='<h3>Capital estrangeiro e risco-país</h3>';const M=FLX.d.mensal||{},A=M.acoes||{},RF=M.renda_fixa||{},ks=Object.keys(A).sort();
  const t=k=>Date.UTC(+k.slice(0,4),+k.slice(5,7)-1,15),bi=v=>(v<0?"−":"")+"US$ "+fx(Math.abs(v)/1000,1)+" bi";
  if(ks.length>24){const u=ks[ks.length-1],soma=(D,n)=>{const kk=Object.keys(D).sort().slice(-n);return kk.reduce((a,k)=>a+(+D[k]||0),0)},ano=(D)=>Object.keys(D).filter(k=>k.slice(0,4)===u.slice(0,4)).reduce((a,k)=>a+(+D[k]||0),0);
    const kp=(a,b,c)=>'<div class="fnkp"><span>'+a+'</span><b class="'+(/−/.test(b)?'neg':'pos')+'">'+b+'</b><small>'+c+'</small></div>';
    h+='<div class="fnkpis">'+kp("Ações · "+mname((+u.slice(0,4))*12+(+u.slice(5,7))-1),bi(+A[u]),"no ano "+bi(ano(A)))+kp("Ações · 12 meses",bi(soma(A,12)),"entrada líquida de estrangeiros")+kp("Renda fixa · "+mname((+u.slice(0,4))*12+(+u.slice(5,7))-1),RF[u]!=null?bi(+RF[u]):"—","no ano "+bi(ano(RF)))+kp("Renda fixa · 12 meses",bi(soma(RF,12)),"títulos no mercado doméstico")+'</div>';
    const ult=ks.slice(-36);h+='<div class="label" style="margin-top:8px">Investimento estrangeiro em ações no Brasil, por mês (US$ bilhões)</div>'+fnChart([{lab:"Ações",col:"var(--gain)",pts:ult.map(k=>[t(k),(+A[k]||0)/1000])}],{bars:true,zero:true,months:true,h:180,fmt:"num",aria:"Fluxo estrangeiro mensal em ações"});
    const roll=D=>{const kk=Object.keys(D).sort();return kk.map((k,i)=>i<11?null:[t(k),kk.slice(i-11,i+1).reduce((a,x)=>a+(+D[x]||0),0)/1000]).filter(Boolean).filter(p=>p[0]>=Date.UTC(2010,0,1))};
    h+='<div class="label" style="margin-top:8px">Acumulado em 12 meses (US$ bilhões)</div>'+fnChart([{lab:"Ações",col:"var(--gain)",w:2,pts:roll(A)},{lab:"Renda fixa",col:"var(--s3)",w:1.6,pts:roll(RF)}],{zero:true,months:false,h:200,fmt:"num",aria:"Fluxo estrangeiro acumulado em 12 meses"});
    h+='<p class="sub" style="font-size:.8rem">Fonte: Banco Central, balanço de pagamentos (investimentos em carteira de não residentes: ações e cotas de fundos no país; títulos de dívida negociados no mercado doméstico), saldo líquido mensal, divulgado com cerca de um mês de defasagem. O saldo diário por tipo de investidor da B3 não entra aqui: o site da B3 não permite coleta automática.</p>'}
  else h+='<p class="sub">O fluxo do capital estrangeiro aparece depois da próxima coleta do robô de mercado.</p>';
  const R=fxRiscoHtml();if(R&&R!=='<div id="fxRisco"></div>')h+=R.replace('margin-top:16px','margin-top:18px');
  return h;
}

