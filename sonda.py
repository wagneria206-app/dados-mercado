import urllib.request,re
MZ={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) Chrome/124 Safari/537.36"}
out=[]
for c in [24363,24364,24369,21859,21862,28503,1455,1473,1499,13762,4513,5793,5727,5364,20631,20633,21082,21084,21083,22099,22109,4380,4382,1207,189,28763,23987,24082,24086]:
    try:
        b=urllib.request.urlopen(urllib.request.Request(f"https://dadosabertos.bcb.gov.br/dataset/{c}",headers=MZ),timeout=30).read().decode("utf8","ignore")
        t=re.search(r"<title>(.*?)</title>",b,re.S);out.append(f"{c}: {t.group(1).strip() if t else '?'}")
    except Exception as e: out.append(f"{c}: ERRO {e}")
open("sonda.txt","w").write("\n".join(out))
