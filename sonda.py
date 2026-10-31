import urllib.request,urllib.parse,json,time,re
MZ={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) Chrome/124 Safari/537.36","Accept":"*/*"}
out=[]
def g(u,n=300):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=MZ),timeout=40);b=r.read();out.append(f"OK {u[:160]} {len(b)}B :: {b[:n]!r}");return b
    except Exception as e: out.append(f"ERRO {u[:160]} {e!r} {getattr(e,'read',lambda:b'')()[:300]!r}")
O="https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/"
def q(ent,f,top=3):return O+ent+"?$top="+str(top)+"&$filter="+urllib.parse.quote(f)+"&$orderby="+urllib.parse.quote("Data desc")+"&$format=json"
g(q("ExpectativasMercadoAnuais","Indicador eq 'IPCA'"),600)
g(q("ExpectativasMercadoSelic","baseCalculo eq 0"),600)
g(q("ExpectativasMercadoInflacao12Meses","Indicador eq 'IPCA' and Suavizada eq 'S'"),600)
g(q("ExpectativasMercadoAnuais","Indicador eq 'Câmbio'"),300)
g(q("ExpectativasMercadoAnuais","Indicador eq 'PIB Total'"),300)
g(q("ExpectativasMercadoAnuais","Indicador eq 'Resultado primário'"),300)
g(O+"$metadata",200)
g("https://www.federalreserve.gov/releases/h10/summary/jrxwtfb_nb.htm",300)
b=g("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",10) or b""
L=sorted(set(re.findall(rb'fomcprojtabl\d{8}\.htm',b)));out.append(repr(L[-4:]))
if L: g("https://www.federalreserve.gov/monetarypolicy/"+L[-1].decode(),300)
g("https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000",200)
open("sonda.txt","w").write("\n".join(out))
