"""Monta o index.html do app a partir dos módulos em app/.

Estrutura:
  app/shell.html   página (cabeçalho, menus e marcação), com os marcadores /*@CSS*/ e /*@JS*/
  app/css/*.css    estilos, na ordem alfabética dos arquivos
  app/js/**/*.js   código, em pastas por área; a ordem de montagem é a do número no início do nome do arquivo

Todo o código roda dentro de uma única função (aberta em js/000 e fechada no último arquivo), então os
nomes são compartilhados entre os arquivos como num arquivo só. O hash do script vai para a política de
segurança (CSP) do cabeçalho, para que o navegador só execute este código.

Uso:
  python app/build.py            gera index.html
  python app/build.py --check    só confere se index.html está igual ao que os módulos geram (usado no CI)
"""
import base64
import glob
import hashlib
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(RAIZ, "app")


def ler(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()


def montar():
    shell = ler(os.path.join(APP, "shell.html"))
    css = "".join(ler(p) for p in sorted(glob.glob(os.path.join(APP, "css", "*.css"))))
    arqs = sorted(glob.glob(os.path.join(APP, "js", "**", "*.js"), recursive=True), key=os.path.basename)
    nums = [os.path.basename(p)[:3] for p in arqs]
    if len(set(nums)) != len(nums):
        raise SystemExit("há dois módulos com o mesmo número: " + ", ".join(sorted({n for n in nums if nums.count(n) > 1})))
    js = "".join(ler(p) for p in arqs)
    for m in ("/*@CSS*/", "/*@JS*/", "'sha256-@HASH'"):
        if shell.count(m) != 1:
            raise SystemExit(f"shell.html precisa ter exatamente um marcador {m}")
    h = base64.b64encode(hashlib.sha256(js.encode("utf-8")).digest()).decode()
    return shell.replace("/*@CSS*/", css).replace("/*@JS*/", js).replace("'sha256-@HASH'", f"'sha256-{h}'")


def main():
    html = montar()
    alvo = os.path.join(RAIZ, "index.html")
    if "--check" in sys.argv:
        atual = ler(alvo) if os.path.exists(alvo) else ""
        if atual != html:
            print("index.html está diferente do que os módulos em app/ geram. Rode: python app/build.py")
            sys.exit(1)
        print("index.html confere com os módulos.")
        return
    with open(alvo, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    print(f"index.html gerado ({len(html) // 1024} KB, {len(glob.glob(os.path.join(APP, 'js', '**', '*.js'), recursive=True))} módulos JS).")


if __name__ == "__main__":
    main()
