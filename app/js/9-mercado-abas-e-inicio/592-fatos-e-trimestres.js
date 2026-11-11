/* ---------- Companhias: fatos relevantes e resultados trimestrais (robô "empresas", CVM). Aparecem na página da
   ação, alimentam o Parecer WF, a sentinela da carteira e o parecer do título (pelo CNPJ do emissor).
   Os temas dos fatos vêm de palavras do assunto (regras); o app não lê nem resume o documento. */
const EMP={f:null,t:null,emp:null,load:null,err:null};
const EMP_TEMA={recuperacao:"Recuperação judicial",inadimplencia:"Dívida: descumprimento ou renegociação",rating:"Rating",investigacao:"Investigação ou contabilidade",controle:"Controle e OPA",fusao:"Aquisição ou venda de ativo",emissao:"Emissão e captação",recompra:"Recompra de ações",proventos:"Proventos",gestao:"Mudança na administração",projecoes:"Projeções e prévias",acoes:"Grupamento ou desdobramento",processo:"Processo ou regulador",outros:"Outros"};
function empBoot(){if(EMP.load||EMP.f||EMP.err)return;const g=f=>fetch(DADOS_RAIZ+"empresas/"+f,{cache:"no-cache"}).then(r=>r.ok?r.json():null).catch(()=>null);
  EMP.load=Promise.all([g("fatos.json"),g("trimestral.json"),atGet("emp.json").catch(()=>null)]).then(([f,t,e])=>{EMP.f=f||{cias:{}};EMP.t=t||{e:{}};EMP.emp=e||{};EMP.vazio=!f&&!t;EMP.load=null;
    try{if(activeMod==="aa"&&AT.cur&&typeof atAa==="function")atAa();else if(activeMod==="sp"&&typeof spCalc==="function"&&!EMP.vazio)spCalc()}catch(x){}}).catch(e=>{EMP.err=e;EMP.load=null})}
function empCnpj(t){const e=EMP.emp&&EMP.emp[String(t).slice(0,4)];return e&&e.cnpj?String(e.cnpj).replace(/\D/g,""):null}
function empFatos(cnpj,dias){if(!EMP.f||!cnpj)return [];const L=EMP.f.cias[String(cnpj).replace(/\D/g,"")]||[];if(!dias)return L;const c=isoD(VAL-dias*DAY);return L.filter(x=>x[0]>=c)}
function empTri(cnpj){ // últimos trimestres com a variação contra o mesmo trimestre do ano anterior
  if(!EMP.t||!cnpj)return null;const q=EMP.t.e[String(cnpj).replace(/\D/g,"")];if(!q)return null;const ks=Object.keys(q).sort(),ant=k=>(+k.slice(0,4)-1)+k.slice(4);
  const L=ks.map(k=>{const a=q[k],b=q[ant(k)],v=i=>a[i]!=null&&b&&b[i]!=null&&b[i]!==0?(a[i]/Math.abs(b[i])-(b[i]>0?1:-1))*100:null;return {k,rec:a[0],ebit:a[1],ll:a[2],vr:v(0),ve:v(1),vl:b&&b[2]!=null&&b[2]>0&&a[2]!=null?(a[2]/b[2]-1)*100:null,la:b?b[2]:null}});
  return L.length?L:null}
const empTriNome=k=>({"03":"1º","06":"2º","09":"3º","12":"4º"}[k.slice(5,7)]||"")+" tri/"+k.slice(2,4);
function empTriLeit(L){const u=L[L.length-1],p=L[L.length-2];if(!u)return null;
  if(u.ll!=null&&u.la!=null){if(u.la>0&&u.ll<0)return [-1,'passou de lucro para prejuízo no '+empTriNome(u.k)];if(u.la<0&&u.ll>0)return [1,'voltou ao lucro no '+empTriNome(u.k)]}
  if(u.vl!=null){const ac=p&&p.vl!=null?u.vl-p.vl:null;if(u.vl>=20)return [1,'lucro do '+empTriNome(u.k)+' cresceu '+fx(u.vl,0)+'% sobre um ano antes'+(ac!=null&&ac>10?', acelerando':'')];if(u.vl<=-20)return [-1,'lucro do '+empTriNome(u.k)+' caiu '+fx(-u.vl,0)+'% sobre um ano antes'+(ac!=null&&ac<-10?', piorando':'')]}
  if(u.vr!=null&&u.vr<=-10)return [-1,'receita do '+empTriNome(u.k)+' caiu '+fx(-u.vr,0)+'% sobre um ano antes'];return null}
function empHtml(A){
  if(!(A.tipo==="Ação"||A.tipo==="Unit"))return "";empBoot();if(!EMP.f||EMP.vazio)return "";const cn=(A.cnpj||empCnpj(A.t)||"").replace(/\D/g,"");if(!cn)return "";let h="";
  const T=empTri(cn);if(T){const L=T.slice(-6).reverse(),le=empTriLeit(T),v=x=>x==null?'—':'<span class="'+(x>=0?'pos':'neg')+'">'+(x>=0?'+':'−')+fx(Math.abs(x),0)+'%</span>';
    h+='<section class="panel"><div class="label">Resultados trimestrais</div>'+(le?'<p style="margin:6px 0"><b class="'+(le[0]>0?'pos':'neg')+'">'+le[1].charAt(0).toUpperCase()+le[1].slice(1)+'.</b></p>':'')
      +'<div class="tablewrap" style="max-height:none"><table class="ctab" data-ordok="1"><thead><tr><th style="text-align:left">Trimestre</th><th>Receita</th><th>um ano antes</th><th>EBIT</th><th>um ano antes</th><th>Lucro</th><th>um ano antes</th></tr></thead><tbody>'
      +L.map(x=>'<tr><td style="text-align:left">'+empTriNome(x.k)+'</td><td>'+(x.rec==null?'—':fnMoney(x.rec))+'</td><td>'+v(x.vr)+'</td><td>'+(x.ebit==null?'—':fnMoney(x.ebit))+'</td><td>'+v(x.ve)+'</td><td class="'+(x.ll<0?'neg':'')+'">'+(x.ll==null?'—':fnMoney(x.ll))+'</td><td>'+v(x.vl)+'</td></tr>').join("")
      +'</tbody></table></div><p class="sub" style="font-size:.8rem;margin:6px 0 0">Cada trimestre isolado, contra o mesmo trimestre do ano anterior. O 4º trimestre sai do resultado do ano menos os três primeiros. Variação do lucro só quando havia lucro um ano antes. Fonte: CVM (ITR e DFP).</p></section>'}
  const F=empFatos(cn);if(F.length){const n1=F.filter(x=>x[3]===1);
    h+='<section class="panel"><div class="label">Fatos relevantes e comunicados (últimos '+(EMP.f.dias||120)+' dias)</div>'+(n1.length?'<p style="margin:6px 0"><b class="neg">Atenção:</b> '+n1.length+' documento'+(n1.length>1?'s':'')+' sobre '+[...new Set(n1.map(x=>EMP_TEMA[x[2]].toLowerCase()))].join(', ')+'.</p>':'')
      +'<div class="tablewrap"><table class="ctab" data-ordok="1"><thead><tr><th style="text-align:left">Data</th><th style="text-align:left">Tema</th><th style="text-align:left">Assunto</th></tr></thead><tbody>'
      +F.map(x=>'<tr><td style="text-align:left;white-space:nowrap">'+fdate(Date.parse(x[0]+"T00:00:00Z"))+'</td><td style="text-align:left"><b style="color:'+(x[3]===1?'var(--loss)':x[3]===2?'var(--ink)':'var(--muted)')+'">'+EMP_TEMA[x[2]]+'</b><small style="display:block;color:var(--muted)">'+esc(x[1])+'</small></td><td style="text-align:left">'+(/^https:\/\//.test(x[5])?'<a href="'+esc(x[5])+'" target="_blank" rel="noopener">'+esc(x[4]||"abrir o documento")+'</a>':esc(x[4]))+'</td></tr>').join("")
      +'</tbody></table></div><p class="sub" style="font-size:.8rem;margin:6px 0 0">Lista oficial da CVM. O tema é atribuído por palavras do assunto; o app não lê nem resume o documento: abra o link para o texto completo.</p></section>'}
  return h}
function empAlertas(cnpj,nome){ // para a sentinela e os pareceres
  const out=[];if(!EMP.f||EMP.vazio||!cnpj)return out;const F=empFatos(cnpj,45),n1=F.filter(x=>x[3]===1);
  if(n1.length)out.push({nv:1,tit:nome+': '+EMP_TEMA[n1[0][2]].toLowerCase(),det:'documento de '+fdate(Date.parse(n1[0][0]+"T00:00:00Z"))+' na CVM: "'+esc(String(n1[0][4]).slice(0,90))+'"'});
  const r=F.filter(x=>x[3]===2&&x[0]>=isoD(VAL-10*DAY));if(r.length)out.push({nv:3,tit:nome+': '+r.length+' fato'+(r.length>1?'s':'')+' recente'+(r.length>1?'s':''),det:[...new Set(r.map(x=>EMP_TEMA[x[2]].toLowerCase()))].slice(0,3).join(', ')});
  const T=empTri(cnpj),le=T&&empTriLeit(T);if(le&&le[0]<0)out.push({nv:2,tit:nome+': resultado trimestral pior',det:le[1]});return out}
