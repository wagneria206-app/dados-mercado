import urllib.request,urllib.parse,json,time
MZ={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) Chrome/124 Safari/537.36","Accept":"*/*"}
out=[]
def g(u,h=MZ,n=300,data=None):
    t=time.time()
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=h,data=data),timeout=40);b=r.read()
        out.append(f"OK {u[:150]} {len(b)}B {time.time()-t:.1f}s cors={r.headers.get('Access-Control-Allow-Origin')} :: {b[:n]!r}")
    except Exception as e: out.append(f"ERRO {u[:150]} {e!r}")
O="https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/"
q=lambda ent,f: O+ent+"?"+urllib.parse.urlencode({"$top":"3","$filter":f,"$orderby":"Data desc","$format":"json"})
g(q("ExpectativasMercadoAnuais","Indicador eq 'IPCA'"),n=500)
g(q("ExpectativasMercadoSelic","baseCalculo eq 0"),n=500)
g(q("ExpectativasMercadoInflacao12Meses","Indicador eq 'IPCA'"),n=500)
g(q("ExpectativasMercadoAnuais","Indicador eq 'Câmbio'"),n=400)
g(q("ExpectativasMercadoAnuais","Indicador eq 'PIB Total'"),n=400)
for s in [24363,24369,21859,1455,13762,5793,4513,21082,20631,22099,4380]:
    g(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{s}/dados/ultimos/2?formato=json",n=200)
g("https://servicodados.ibge.gov.br/api/v3/agregados/5932/periodos/-2/variaveis/6564?localidades=N1[all]&classificacao=11255[90707]",n=300)
g("https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0",n=300)
g("https://api.bls.gov/publicAPI/v2/timeseries/data/",h={**MZ,"Content-Type":"application/json"},data=json.dumps({"seriesid":["CES0000000001","LNS14000000","CUSR0000SA0","CUSR0000SA0L1E"],"startyear":"2024","endyear":"2026"}).encode(),n=400)
g("https://apps.bea.gov/api/data?UserID=x&method=GETDATASETLIST&ResultFormat=JSON",n=200)
g("https://www.federalreserve.gov/datadownload/Output.aspx?rel=H10&series=60f32914ab61dfab590e0e470153e3ae&lastobs=5&from=&to=&filetype=csv&label=include&layout=seriescolumn",n=400)
g("https://www.federalreserve.gov/releases/h10/current/default.htm",n=200)
g("https://www.eia.gov/dnav/pet/hist_xls/RBRTEd.xls",n=100)
g("https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=RBRTE&f=D",n=200)
g("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",n=100)
g("https://www.federalreserve.gov/monetarypolicy/files/fomcprojtabl20250917.htm",n=200)
open("sonda.txt","w").write("\n".join(out))
