/* ---------- Comparador: veredito. Para até 8 ações ou fundos lado a lado, diz quem leva cada pilar da Nota WF, quem
   tem o melhor conjunto e o que pesa contra cada um. Fundos de categorias diferentes não têm notas comparáveis: avisa. */
function cmpVeredito(K){
  try{const ks=K.list.slice(0,8);if(ks.length<2)return "";let L,PIL,nome,aviso="";
    if(K.kind==="a"){const N=cbNota();if(!N)return "";PIL=CB_PIL;L=ks.map(k=>{const n=N.get(k),p=n?prAcao(k):null;return n?{k,nm:k,n,p}:null}).filter(Boolean);
      const fora=ks.filter(k=>!N.get(k));if(fora.length)aviso='Sem Nota WF (FII, ETF, BDR ou pouca liquidez): '+esc(fora.join(', '))+'. '}
    else{const N=cbFnNota();if(!N)return "";PIL=CBF_PIL;L=ks.map(k=>{const n=N.get(k),p=n?prFundo(k):null;return n?{k,nm:String(n.n).slice(0,30),n,p}:null}).filter(Boolean);
      const cats=new Set(L.map(x=>x.n.a));if(cats.size>1)aviso='Atenção: os fundos são de categorias diferentes, e cada nota compara o fundo com os pares da própria categoria. Use para ver quem é melhor no que faz, não para comparar um com o outro. ';
      const fora=ks.length-L.length;if(fora)aviso+=fora+' fundo(s) sem Nota WF (restrito, pequeno ou sem 12 meses). '}
    if(L.length<2)return aviso?'<p class="sub" style="margin:8px 0">'+aviso+'</p>':"";
    const ord=L.slice().sort((a,b)=>b.n.nota-a.n.nota),top=ord[0],seg=ord[1],emp=top.n.nota-seg.n.nota<=3;
    const venc=PIL.map(([p,l])=>{const v=L.filter(x=>x.n.P[p]!=null).sort((a,b)=>b.n.P[p]-a.n.P[p]);return v.length>=2?[l,v[0],v[0].n.P[p]-v[1].n.P[p]]:null}).filter(Boolean);
    let h='<section class="panel" style="margin:10px 0"><div class="label">Veredito WF</div><p style="margin:6px 0"><b>'+(emp?'Empate técnico entre '+esc(top.nm)+' ('+top.n.nota+') e '+esc(seg.nm)+' ('+seg.n.nota+')':esc(top.nm)+' tem o melhor conjunto (nota '+top.n.nota+', contra '+seg.n.nota+' de '+esc(seg.nm)+')')+'.</b> '
      +venc.map(([l,w,d])=>l+': <b>'+esc(w.nm)+'</b>'+(d<5?' por pouco':'')).join(' · ')+'.</p>'
      +'<div class="tablewrap" style="max-height:none"><table class="ctab" data-ordok="1"><thead><tr><th style="text-align:left">'+(K.kind==="a"?'Ação':'Fundo')+'</th><th>Nota</th>'+PIL.map(p=>'<th>'+p[1]+'</th>').join("")+'<th style="text-align:left">Leitura</th></tr></thead><tbody>'
      +ord.map(x=>'<tr><td style="text-align:left"><b>'+esc(x.nm)+'</b></td><td><b style="color:'+cbNotaCor(x.n.nota)+'">'+x.n.nota+'</b></td>'+PIL.map(([p])=>{const v=x.n.P[p],mx=Math.max(...L.map(y=>y.n.P[p]==null?-1:y.n.P[p]));return '<td'+(v!=null&&v===mx?' style="font-weight:700"':'')+'>'+(v==null?'—':fx(v,0))+'</td>'}).join("")
        +'<td style="text-align:left"><small>'+(x.p?x.p.ver+(x.p.X.length?' <span class="neg">Contra:</span> '+x.p.X.slice(0,2).join('; ')+'.':''):'')+'</small></td></tr>').join("")+'</tbody></table></div>'
      +'<p class="sub" style="font-size:.8rem;margin:6px 0 0">'+aviso+'Em negrito, o melhor de cada pilar. Diferença de até 3 pontos na nota é empate. A nota resume critérios objetivos; a escolha depende também do papel de cada um na carteira: use o botão "E se eu incluir?" na página de cada um.</p></section>';
    return h}catch(e){console.error(e);return ""}}
