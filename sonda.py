import urllib.request,json
H={"User-Agent":"Mozilla/5.0","Accept":"application/json"}
out=[]
for t,c in [("5932","/c11255/90707"),("6381",""),("8888","/c544/129314"),("8880","/c11046/56734"),("5906","/c11046/56726")]:
    u=f"https://apisidra.ibge.gov.br/values/t/{t}/n1/all/v/all/p/last%201{c}"
    try:
        j=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=60))
        out.append(t+" "+json.dumps(j[0],ensure_ascii=False)[:400]);[out.append("   "+r.get("D2C","")+" "+r.get("D2N","")[:90]+" | "+r.get("D3N","")+" = "+r.get("V","")+" "+r.get("MN","")) for r in j[1:]]
    except Exception as e: out.append(f"{t} ERRO {e} {getattr(e,'read',lambda:b'')()[:200]!r}")
open("sonda.txt","w").write("\n".join(out))
