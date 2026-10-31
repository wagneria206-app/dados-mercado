/* ===== Bolsa › EUA: comparar formas de investir no S&P 500 a partir do Brasil ===== */
const EX={v:100000,anos:10,ret:9,dy:1.3,cam:0,spread:0.5,iof:1.1,iofv:0.38,terL:0.23,terD:0.03,ir:15,ret_us:30};
try{const s=JSON.parse(localStorage.getItem("exPar")||"null");if(s&&typeof s==="object")Object.assign(EX,s)}catch(e){}
function exCalc(){
  const N=+EX.anos||1,V=+EX.v||0,p=(+EX.ret-+EX.dy)/100,dy=+EX.dy/100,c=+EX.cam/100,ir=+EX.ir/100,wh=+EX.ret_us/100;
  const fx_=Math.pow(1+c,N);
  const op=[];
  // ETF local (ex.: IVVB11): fundo brasileiro que compra o ETF americano; dividendos reinvestidos dentro do fundo, com retenção nos EUA
  {const g=Math.pow(1+p+dy*(1-wh)-EX.terL/100,N),bruto=V*g*fx_,imp=Math.max(0,bruto-V)*ir;op.push({n:"ETF na B3",ex:"IVVB11",bruto,imp,liq:bruto-imp,custo:fx(EX.terL,2)+'% ao ano de taxa',div:'reinvestidos no fundo, já com '+fx(wh*100,0)+'% retidos nos EUA',ir:'15% sobre o ganho em reais, na venda (DARF no mês seguinte); sem isenção',iof:'não há',her:'não há',decl:'mensal, só nos meses com venda com lucro'})}
  // BDR do ETF americano (ex.: BIVB39): dividendos pagos em reais, já com a retenção americana
  {const g=Math.pow(1+p+dy*(1-wh)-EX.terD/100,N),bruto=V*g*fx_,imp=Math.max(0,bruto-V)*ir;op.push({n:"BDR do ETF americano",ex:"BIVB39",bruto,imp,liq:bruto-imp,custo:fx(EX.terD,2)+'% ao ano (taxa do ETF americano)',div:'pagos em reais, com '+fx(wh*100,0)+'% retidos nos EUA; o imposto brasileiro (carnê-leão, tabela progressiva) é compensado pelo retido lá fora, sem custo extra na prática',ir:'15% sobre o ganho em reais, na venda (DARF no mês seguinte); sem isenção',iof:'não há',her:'não há',decl:'mensal: DARF nas vendas com lucro e carnê-leão nos dividendos'})}
  // Conta em corretora nos EUA (ex.: IVV): IOF e spread na ida e na volta
  {const ida=V*(1-EX.iof/100-EX.spread/100),g=Math.pow(1+p+dy*(1-wh)-EX.terD/100,N),bruto=ida*g*fx_,imp=Math.max(0,bruto-ida)*ir,volta=(bruto-imp)*(1-EX.iofv/100-EX.spread/100);
    op.push({n:"Conta em corretora nos EUA",ex:"IVV",bruto,imp,liq:volta,custo:fx(EX.terD,2)+'% ao ano + IOF de '+fx(EX.iof,2)+'% e spread de câmbio na remessa',div:'em dólar, com '+fx(wh*100,0)+'% retidos nos EUA; no Brasil, 15% na declaração anual, compensado pelo retido lá fora',ir:'15% sobre o ganho em reais (inclui o câmbio), apurado na declaração anual; prejuízo compensa ganho',iof:fx(EX.iof,2)+'% na ida e '+fx(EX.iofv,2)+'% na volta, mais o spread',her:'sim: imposto sobre herança nos EUA de até 40% sobre o que passar de US$ 60 mil, para não residentes',decl:'anual (declaração de ajuste); só paga quando vende'})}
  op.forEach(o=>{o.aa=(Math.pow(o.liq/V,1/N)-1)*100});
  return op;
}
function exHtml(){
  const op=exCalc(),best=Math.max(...op.map(o=>o.liq));
  const inp=(id,lab,v,st,suf)=>'<div class="field"><label for="ex_'+id+'">'+lab+'</label><input id="ex_'+id+'" data-ex="'+id+'" type="number" step="'+st+'" value="'+v+'" inputmode="decimal">'+(suf?'<small class="sub">'+suf+'</small>':'')+'</div>';
  let h='<h3>Como investir no S&P 500 a partir do Brasil</h3><p class="sub">Compara as três formas mais comuns de ter o S&P 500 na carteira, com os mesmos números de retorno e câmbio, descontando taxas, IOF, câmbio e imposto. Ajuste as premissas: o resultado muda na hora.</p>';
  h+='<div class="fnfilt">'+inp("v","Valor aplicado (R$)",EX.v,1000)+inp("anos","Prazo (anos)",EX.anos,1)+inp("ret","Retorno total do S&P 500 em dólar (% ao ano)",EX.ret,0.1,"com dividendos; média histórica ≈ 10%")+inp("dy","Dividendos (% ao ano)",EX.dy,0.1)+inp("cam","Variação do dólar/real (% ao ano)",EX.cam,0.1,"positivo = real perdendo valor")+inp("spread","Spread de câmbio da corretora (%)",EX.spread,0.1)+'</div>';
  h+='<div class="tablewrap" style="max-height:none;margin-top:10px"><table class="ctab extab"><thead><tr><th style="text-align:left">'+fx(EX.anos,0)+' anos</th>'+op.map(o=>'<th>'+esc(o.n)+'<small style="display:block;font-weight:400">ex.: '+esc(o.ex)+'</small></th>').join("")+'</tr></thead><tbody>'
    +'<tr><td style="text-align:left">Valor bruto no fim</td>'+op.map(o=>'<td>R$ '+fx(o.bruto,0)+'</td>').join("")+'</tr>'
    +'<tr><td style="text-align:left">Imposto de renda na venda</td>'+op.map(o=>'<td>−R$ '+fx(o.imp,0)+'</td>').join("")+'</tr>'
    +'<tr><td style="text-align:left"><b>Valor líquido em reais</b></td>'+op.map(o=>'<td><b'+(o.liq===best?' class="pos"':'')+'>R$ '+fx(o.liq,0)+'</b></td>').join("")+'</tr>'
    +'<tr><td style="text-align:left">Retorno líquido ao ano</td>'+op.map(o=>'<td>'+fx(o.aa,2)+'%</td>').join("")+'</tr>'
    +[["Custos","custo"],["Dividendos","div"],["Imposto sobre o ganho","ir"],["IOF","iof"],["Imposto sobre herança nos EUA","her"],["Obrigações","decl"]].map(([l,k])=>'<tr><td style="text-align:left;vertical-align:top">'+l+'</td>'+op.map(o=>'<td style="text-align:left;vertical-align:top;font-size:.82rem">'+esc(o[k])+'</td>').join("")+'</tr>').join("")
    +'</tbody></table></div>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px"><b>Como ler:</b> com prazos longos as diferenças vêm sobretudo da taxa do ETF local e do IOF e câmbio da conta no exterior. A conta nos EUA dá acesso a milhares de ativos e mantém o dinheiro em dólar (sem precisar trazê-lo de volta), mas exige declarar tudo e expõe a herança ao imposto americano; o ETF e o BDR na B3 são mais simples, sem risco de herança nos EUA. Nenhuma das três protege do câmbio: para isso existem ETFs com proteção cambial (hedge), cujo retorno em reais fica perto do retorno em dólar mais a diferença entre o CDI e o juro americano.</p>'
    +'<p class="sub" style="font-size:.78rem">Premissas e regras usadas (pessoa física residente, regras de 2026): IR de 15% sobre o ganho em BDR e ETF na B3, sem a isenção de R$ 20 mil das ações; aplicações em conta no exterior pela Lei 14.754/2023 (15% na declaração anual, câmbio incluído no ganho, prejuízo compensável); retenção de 30% nos EUA sobre dividendos de não residentes, compensada no Brasil até o limite do imposto brasileiro; IOF de 1,10% na remessa para investimento e 0,38% no ingresso; taxa de administração de 0,23% ao ano no IVVB11 e 0,03% no IVV. Taxas de corretagem e custódia não entram. Regras tributárias mudam: confirme com um contador antes de recomendar. Não é recomendação de investimento.</p>';
  return h;
}
let EX_T=null;
document.addEventListener("input",e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.ex)return;const v=parseFloat(String(t.value).replace(",","."));if(!isFinite(v))return;EX[t.dataset.ex]=v;try{localStorage.setItem("exPar",JSON.stringify(EX))}catch(x){}
  clearTimeout(EX_T);EX_T=setTimeout(()=>{const el=$("euEx");if(!el)return;const f=document.activeElement&&document.activeElement.id;el.innerHTML=exHtml();if(f){const n=$(f);if(n){n.focus();try{const l=n.value.length;n.setSelectionRange&&n.type!=="number"&&n.setSelectionRange(l,l)}catch(x){}}}},400)});

{const m=/fundo=([0-9A-Za-z]{14,16})/.exec(location.hash||"");if(m){FN.cur=m[1];try{localStorage.setItem("mod2","fa")}catch(e){}}const a=/ativo=([A-Za-z0-9-]{4,16})/.exec(location.hash||"");if(a){AT.cur=a[1].toUpperCase();try{localStorage.setItem("mod2","aa")}catch(e){}}}

