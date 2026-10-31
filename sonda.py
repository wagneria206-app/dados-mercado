import urllib.request,json
MZ={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) Chrome/124 Safari/537.36"}
out=[]
for c in [24363,24364,24369,21859,21862,28503,1455,1473,1499,13762,4513,5793,5727,20631,21082,21084,21083,22099,22109,4380,4382,24082,24086,7326,28561]:
    try:
        j=json.load(urllib.request.urlopen(urllib.request.Request(f"https://dadosabertos.bcb.gov.br/api/3/action/package_search?q=name:{c}-*&rows=3",headers=MZ),timeout=30))
        out.append(f"{c}: "+" | ".join(r["name"][:110] for r in j["result"]["results"]))
    except Exception as e: out.append(f"{c}: ERRO {e}")
open("sonda.txt","w").write("\n".join(out))
