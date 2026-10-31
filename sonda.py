import urllib.request
MZ={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) Chrome/124 Safari/537.36"}
for u,f in [("https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260916.htm","sep.html"),("https://www.federalreserve.gov/releases/h10/summary/jrxwtfb_nb.htm","h10.html"),("https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=RBRTE&f=D","brent.html"),("https://www.bls.gov/schedule/news_release/bls.ics","bls.ics"),("https://www.bls.gov/schedule/2026_sched.htm","blssched.html")]:
    try: open(f,"wb").write(urllib.request.urlopen(urllib.request.Request(u,headers=MZ),timeout=60).read())
    except Exception as e: open(f,"w").write("ERRO "+repr(e))
open("sonda.txt","w").write("ok")
