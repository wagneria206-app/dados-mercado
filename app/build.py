"""Monta o index.html do app a partir dos módulos em app/.

Estrutura:
  app/shell.html   página (cabeçalho, menus e marcação), com os marcadores /*@CSS*/ e /*@JS*/
  app/css/*.css    estilos, na ordem alfabética dos arquivos
  app/js/**/*.js   código, em pastas por área; a ordem de montagem é a do número no início do nome do arquivo

Todo o código roda dentro de uma única função (aberta em js/000 e fechada no último arquivo), então os
nomes são compartilhados entre os arquivos como num arquivo só. O hash do script vai para a política de
segurança (CSP) do cabeçalho, para que o navegador só execute este código.

A montagem também confere o código e mantém o guia em dia:
  - erro de sintaxe no código é recusado (com o Node.js, quando instalado);
  - duas funções com o mesmo nome em módulos diferentes são recusadas (num arquivo só, a segunda apagaria a
    primeira sem aviso);
  - a lista de módulos e estilos de app/LEIA-ME.md é refeita a partir dos arquivos (a descrição de cada um vem
    do guia atual ou, num arquivo novo, do comentário da primeira linha).

Uso:
  python app/build.py            gera index.html e atualiza a lista de módulos do guia
  python app/build.py --check    só confere se index.html e o guia estão iguais ao que os módulos geram (usado no CI)
"""
import base64
import collections
import glob
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(RAIZ, "app")


def ler(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()


GUIA = os.path.join(APP, "LEIA-ME.md")
PASTAS = {
    "1-nucleo": "Núcleo: datas, calendário, VNA, preços dos títulos, dados embutidos",
    "2-calculadora": "Calculadora de títulos, crédito privado, IR/IOF, cenários, estado compartilhado e utilitários",
    "3-tesouro-bancarios-e-mercado": "Histórico do Tesouro, bancários, fundos e previdência, equivalência e escada, curvas de juros e dados do cabeçalho",
    "4-fundos": "Fundos (CVM)",
    "5-bolsa": "Bolsa (B3 e CVM)",
    "6-comparador-carteiras": "Comparador, simulador de carteiras e relatório em PDF",
    "7-saude-favoritos-alertas": "Agenda, saúde das fontes, favoritos, alertas e sincronização",
    "8-mercado-eua-economia": "Mercado › Resumo, posição real, Bolsa americana, economia, estresse e exterior",
    "9-mercado-abas-e-inicio": "Mercado: abas Juros, Crédito, Inflação, Índices e Dólar; dados dos robôs; busca, ajustes e apresentação; inicialização",
}


def js_arquivos():
    return sorted(glob.glob(os.path.join(APP, "js", "**", "*.js"), recursive=True), key=os.path.basename)


def conferir_funcoes(arqs):
    onde = collections.defaultdict(list)
    for p in arqs:
        for m in re.finditer(r"(?m)^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(", ler(p)):
            onde[m.group(1)].append(os.path.basename(p))
    rep = {k: v for k, v in onde.items() if len(v) > 1}
    if rep:
        raise SystemExit("funções com o mesmo nome em mais de um lugar (a última apagaria as outras): "
                         + "; ".join(f"{k} em {', '.join(v)}" for k, v in sorted(rep.items())))


def descricao(p, atuais):
    nome = os.path.basename(p)
    if nome in atuais:
        return atuais[nome]
    for linha in ler(p).splitlines()[:3]:
        m = re.match(r"\s*/\*\s*-*\s*(.+?)\s*\*/", linha)
        if m:
            return m.group(1)
    return ""


def guia_novo():
    texto = ler(GUIA)
    i = texto.index("## Módulos")
    atuais = {m.group(1): m.group(2) for m in re.finditer(r"^- `([^`]+)`(?: — (.*?))? \(\d+ KB\)$", texto[i:], re.M) if m.group(2)}
    linhas = ["## Módulos", "", "Lista refeita pela montagem (`python app/build.py`) a cada mudança.", "",
              "**`css/`** — estilos, na ordem dos números", ""]
    for p in sorted(glob.glob(os.path.join(APP, "css", "*.css"))):
        d = descricao(p, atuais)
        linhas.append(f"- `{os.path.basename(p)}`" + (f" — {d}" if d else "") + f" ({max(1, round(os.path.getsize(p) / 1024))} KB)")
    por_pasta = collections.defaultdict(list)
    for p in js_arquivos():
        por_pasta[os.path.basename(os.path.dirname(p))].append(p)
    for pasta in sorted(por_pasta):
        linhas += ["", f"**`js/{pasta}/`** — {PASTAS.get(pasta, '')}", ""]
        for p in por_pasta[pasta]:
            d = descricao(p, atuais)
            linhas.append(f"- `{os.path.basename(p)}`" + (f" — {d}" if d else "") + f" ({max(1, round(os.path.getsize(p) / 1024))} KB)")
    return texto[:i] + "\n".join(linhas) + "\n"


def conferir_sintaxe(js):
    """Erro de digitação no código (parêntese a mais, vírgula faltando) aparece aqui, antes de abrir o navegador."""
    node = shutil.which("node")
    if not node:
        return
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js)
    try:
        r = subprocess.run([node, "--check", f.name], capture_output=True, text=True)
    finally:
        os.unlink(f.name)
    if r.returncode:
        raise SystemExit("erro de sintaxe no código do app:\n" + (r.stderr or r.stdout)[-1500:])


def montar():
    shell = ler(os.path.join(APP, "shell.html"))
    css = "".join(ler(p) for p in sorted(glob.glob(os.path.join(APP, "css", "*.css"))))
    arqs = js_arquivos()
    conferir_funcoes(arqs)
    nums = [os.path.basename(p)[:3] for p in arqs]
    if len(set(nums)) != len(nums):
        raise SystemExit("há dois módulos com o mesmo número: " + ", ".join(sorted({n for n in nums if nums.count(n) > 1})))
    js = "".join(ler(p) for p in arqs)
    conferir_sintaxe(js)
    for m in ("/*@CSS*/", "/*@JS*/", "'sha256-@HASH'"):
        if shell.count(m) != 1:
            raise SystemExit(f"shell.html precisa ter exatamente um marcador {m}")
    h = base64.b64encode(hashlib.sha256(js.encode("utf-8")).digest()).decode()
    return shell.replace("/*@CSS*/", css).replace("/*@JS*/", js).replace("'sha256-@HASH'", f"'sha256-{h}'")


def main():
    html = montar()
    guia = guia_novo()
    alvo = os.path.join(RAIZ, "index.html")
    if "--check" in sys.argv:
        atual = ler(alvo) if os.path.exists(alvo) else ""
        if atual != html:
            print("index.html está diferente do que os módulos em app/ geram. Rode: python app/build.py")
            sys.exit(1)
        if ler(GUIA) != guia:
            print("A lista de módulos de app/LEIA-ME.md está desatualizada. Rode: python app/build.py")
            sys.exit(1)
        print("index.html e guia conferem com os módulos.")
        return
    with open(alvo, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    with open(GUIA, "w", encoding="utf-8", newline="") as f:
        f.write(guia)
    print(f"index.html gerado ({len(html) // 1024} KB, {len(glob.glob(os.path.join(APP, 'js', '**', '*.js'), recursive=True))} módulos JS).")


if __name__ == "__main__":
    main()
