/* ---------- Bolsa › EUA */
function euCalc(){
  const o=$("fnOut");if(!o)return;
  if(FN.view!=="au"){FN.view="au";o.innerHTML='<section class="panel" id="euPainel"></section><section class="panel" id="euJuros"></section><section class="panel" id="euEx"></section><section class="panel"><h3>Empresas americanas com BDR na B3</h3><p class="sub">Indicadores calculados com os balanços entregues à SEC (órgão regulador dos EUA) e a cotação em Nova York. Clique no BDR para abrir a análise completa, com retorno em dólar e documentos.</p><div id="euRkF"></div><div id="euRkT"></div></section>'}
  if(!EU.S){$("euPainel").innerHTML=EU.err&&!EU.load?'<p class="warn">A base da Bolsa americana ainda não está disponível ('+esc(EU.err.message||EU.err)+'). Tente de novo mais tarde.</p>':'<p class="sub">Carregando os dados da Bolsa americana…</p>';euBoot();return}
  $("euPainel").innerHTML=painelHtml("eua");$("euJuros").innerHTML=euJurosHtml();if(!document.activeElement||!document.activeElement.dataset||!document.activeElement.dataset.ex)$("euEx").innerHTML=exHtml();
  if(!AT.idx){$("euRkT").innerHTML='<p class="sub">Carregando a lista de BDRs da B3…</p>';atBoot().then(()=>{if(activeMod==="au")euCalc()});return}
  euRk();
}
function euSer5(k){const S=EU.S,cut=Date.now()-5*365.25*DAY;return fnThin((S[k]||[]).filter(p=>p[0]>=cut).map(p=>({t:p[0],v:p[1]})),500).map(p=>[p.t,p.v])}
function euJurosHtml(){
  const S=EU.S;if(!S.vix)return "";
  return '<h3>Volatilidade nos EUA (VIX)</h3><div class="label">VIX, 5 anos (volatilidade esperada do S&P 500 para os próximos 30 dias)</div>'+fnChart([{lab:"VIX",col:"#9333ea",w:1.8,pts:euSer5("vix")}],{fmt:"num",h:180,aria:"VIX"})+'<p class="sub" style="font-size:.8rem">VIX acima de 30 costuma indicar estresse no mercado; abaixo de 15, calmaria. Os juros dos EUA (Treasuries, Fed e SOFR), com o histórico de 5 anos, estão em Mercado › Juros.</p>';
}
/* Mercado › Juros: histórico dos Treasuries, abaixo dos cartões de juros dos EUA */
function euTreasuryHtml(){
  if(!EU.S){euBoot();return ""}const S=EU.S;if(!S.t10)return "";
  const u10=S.t10[S.t10.length-1],u2=S.t2&&S.t2[S.t2.length-1];
  let h='<div class="label" style="margin-top:14px">Treasuries, 5 anos (% a.a.)</div>'+fnChart([{lab:"10 anos",col:"#2563eb",w:2,pts:euSer5("t10")},{lab:"2 anos",col:"#dc2626",w:2,pts:euSer5("t2")},{lab:"3 meses",col:"#16a34a",w:1.8,pts:euSer5("t3m")}],{fmt:"pct",h:220,aria:"Juros do Tesouro americano"});
  if(u2)h+='<p class="sub" style="font-size:.8rem">Inclinação da curva (10 anos − 2 anos) em '+fdate(u10[0])+': <b>'+(u10[1]-u2[1]>=0?'+':'−')+Math.abs(Math.round((u10[1]-u2[1])*100))+' bps</b>'+(u10[1]<u2[1]?'. Curva invertida: o mercado espera juros menores à frente, sinal que costuma anteceder desaceleração.':'.')+'</p>';
  return h;
}
const EU_RKCOLS=[["t","BDR",""],["setor","Setor","c-ph c-md"],["px","Preço US$","c-ph"],["d1","Dia (EUA)","c-ph c-sm"],["mcap","Valor de mercado","c-ph"],["pl","P/L",""],["pvp","P/VP","c-ph"],["roe","ROE","c-ph"],["ml","Marg. líq.","c-ph c-sm"],["crec","Receita 12m","c-ph c-sm"],["dy","DY (EUA)","c-ph c-md"],["r12","BDR 12m (R$)",""],["liq","Liquidez BDR","c-ph c-md"]];
function euRows(){const I=EU.idx,C=EU.C,A=AT.C;if(!I)return [];return I.rows.map(r=>{const a=atRow(r[0]);return {r,a,t:r[0],setor:r[C.setor]||"",px:r[C.px],d1:r[C.d1],mcap:r[C.mcap],pl:r[C.pl],pvp:r[C.pvp],roe:r[C.roe],ml:r[C.ml],crec:r[C.crec],dy:r[C.dy],r12:a?a[A.r12]:null,liq:a?a[A.liq]:null}})}
function euRk(){
  const f=$("euRkF");if(!f)return;if(!EU.idx){$("euRkT").innerHTML='<p class="sub">A lista de empresas aparece depois da primeira coleta do robô da Bolsa americana.</p>';return}
  const rk=EU.rk,L=euRows(),set=new Map();L.forEach(x=>{if(x.setor)set.set(x.setor,(set.get(x.setor)||0)+1)});
  const sel=(id,lab,opts,v)=>'<div class="field"><label for="'+id+'">'+lab+'</label><select id="'+id+'" data-eurk="'+id+'">'+opts.map(([a,b])=>'<option value="'+esc(a)+'"'+(String(a)===String(v)?' selected':'')+'>'+esc(b)+'</option>').join("")+'</select></div>';
  f.innerHTML='<div class="fnfilt">'+sel("euSet","Setor",[["","Todos"]].concat([...set.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([s,n])=>[s,s+" ("+n+")"])),rk.setor)
    +sel("euLiq","Liquidez mínima do BDR por dia",[[0,"Qualquer"],[1e4,"R$ 10 mil"],[1e5,"R$ 100 mil"],[1e6,"R$ 1 milhão"],[1e7,"R$ 10 milhões"]],rk.liq)
    +'<div class="field"><label for="euTxt">Código ou nome</label><input id="euTxt" value="'+esc(rk.txt)+'" autocomplete="off"></div></div>';
  euRkTable();
}
function euRkTable(){
  const t=$("euRkT");if(!t||!EU.idx)return;const rk=EU.rk,C=EU.C,tx=fnNorm(rk.txt).split(/\s+/).filter(Boolean);
  const L=euRows().filter(x=>(!rk.setor||x.setor===rk.setor)&&(x.liq||0)>=+rk.liq&&(!tx.length||tx.every(w=>fnNorm(x.t+" "+x.r[C.tk]+" "+x.r[C.nome]+" "+(x.a?x.a[1]:"")).includes(w))));
  const k=rk.sort,d=rk.dir;L.sort((a,b)=>{const x=a[k],y=b[k];if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return typeof x==="string"?d*x.localeCompare(y):d*(x-y)});
  const cell=(x,c)=>{const v=x[c];if(c==="t")return '<button type="button" class="link" style="font-weight:600;font-size:.84rem;text-align:left" data-atopen="'+x.t+'">'+x.t+'</button><small>'+esc(x.r[C.tk])+' · '+esc(x.r[C.nome]||"")+'</small>';
    if(c==="setor")return esc(v||"—");if(c==="px")return v!=null?"US$ "+fx(v,2):"—";if(c==="mcap")return euMoney(v);if(c==="liq")return fnMoney(v);
    if(["d1","roe","ml","crec","dy","r12"].includes(c))return fnPct(v,c==="dy"?2:1);return v!=null?fx(v,1):"—"};
  let h='<p class="sub" style="margin:8px 0 4px">'+fx(L.length,0)+' empresas.</p><div class="tablewrap" style="max-height:none"><table class="ctab fnrk"><thead><tr><th>#</th>'+EU_RKCOLS.map(([c,l,cl])=>'<th data-eusort="'+c+'" class="'+cl+'"'+(c==="t"?' style="text-align:left"':'')+'>'+l+(rk.sort===c?(rk.dir<0?' ▾':' ▴'):'')+'</th>').join("")+'<th></th></tr></thead><tbody>';
  L.slice(0,rk.n).forEach((x,j)=>{h+='<tr><td><small>'+(j+1)+'</small></td>'+EU_RKCOLS.map(([c,,cl])=>'<td class="'+cl+(c==="t"?'" style="text-align:left;min-width:110px;max-width:220px;white-space:normal;overflow-wrap:break-word':'')+'">'+cell(x,c)+'</td>').join("")+'<td><button type="button" class="link" data-atcmp="'+x.t+'">'+(AT.cmp.includes(x.t)?'✓':'+')+'</button></td></tr>'});
  h+='</tbody></table></div>'+(L.length>rk.n?'<button type="button" class="btn sec" data-eumore="1" style="margin-top:10px">Mostrar mais 50</button>':'')+'<p class="sub" style="font-size:.8rem;margin-top:6px">P/L, P/VP e DY usam o valor de mercado em Nova York e os últimos 12 meses dos balanços entregues à SEC; ficam em branco quando o balanço tem mais de 15 meses ou não é em dólar. DY (EUA) = dividendos pagos pela empresa em 12 meses ÷ valor de mercado, antes de impostos (o investidor de BDR recebe já com o imposto retido nos EUA, em geral 30%). Receita 12m = crescimento da receita sobre os 12 meses anteriores. BDR 12m = retorno do BDR na B3, em reais, com proventos. Setor pela classificação da Nasdaq.</p>';
  t.innerHTML=h;
}

