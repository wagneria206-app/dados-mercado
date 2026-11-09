"""Exporta os ramos de dados (repositório git local do servidor) para a pasta servida ao app.

Uso:
  python exportar.py <repo de dados> <pasta de saída> [ramo ...]
  python exportar.py --pacote <repo> <pasta> <index.html> <meta>   # pacote do app para a Cloudflare (app + dados)

A pasta de saída tem a mesma organização dos ramos (site/data/…, fundos/idx.json, …). Os arquivos de cada fundo,
ativo e empresa americana são agrupados em pacotes (<ramo>/pk/<dir>-<chave>.json), com a mesma chave que o app
usa (app/js/1-nucleo/001-onde-ficam-os-dados.js). A troca é atômica: cada ramo é montado numa pasta nova e só
então substitui a anterior, para o app nunca ler um ramo pela metade.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

RAMOS = ["site", "ativos", "fundos", "eua", "macro", "saude", "insiders", "emissores", "bancos", "aluguel"]
POR_ATIVO = {"fundos", "ativos", "eua"}


def chave(d, n):
    if d == "f":
        return "".join(ch if ch.isdigit() else "X" for ch in n[:2])
    c = n[:1].upper()
    return c if re.match(r"[A-Z0-9]", c) else "_"


def git(repo, *a):
    return subprocess.run(["git", "--git-dir", repo, *a], check=True, capture_output=True).stdout


def existe(repo, ramo):
    return subprocess.run(["git", "--git-dir", repo, "rev-parse", "-q", "--verify", "refs/heads/" + ramo],
                          capture_output=True).returncode == 0


def exportar_ramo(repo, ramo, destino):
    """Monta <destino>/<ramo> a partir do ramo; devolve o número de arquivos."""
    tmp = tempfile.mkdtemp(prefix=f".{ramo}-", dir=destino)
    sub = subprocess.run(["git", "--git-dir", repo, "archive", "--format=tar", "refs/heads/" + ramo], check=True, capture_output=True)
    subprocess.run(["tar", "-x", "-C", tmp], input=sub.stdout, check=True)
    n = 0
    if ramo in POR_ATIVO:
        pk = {}
        for d in ("f", "a", "d", "s"):
            pasta = os.path.join(tmp, d)
            if not os.path.isdir(pasta):
                continue
            for arq in os.listdir(pasta):
                if arq.endswith(".json"):
                    with open(os.path.join(pasta, arq), encoding="utf-8") as f:
                        pk.setdefault(f"{d}-{chave(d, arq[:-5])}", {})[arq[:-5]] = json.load(f)
            shutil.rmtree(pasta)
        os.makedirs(os.path.join(tmp, "pk"), exist_ok=True)
        for k, v in pk.items():
            with open(os.path.join(tmp, "pk", k + ".json"), "w", encoding="utf-8") as f:
                json.dump(v, f, ensure_ascii=False, separators=(",", ":"))
    for r, _, fs in os.walk(tmp):
        n += len(fs)
    final = os.path.join(destino, ramo)
    velho = final + ".velho"
    shutil.rmtree(velho, ignore_errors=True)
    if os.path.exists(final):
        os.rename(final, velho)
    os.rename(tmp, final)
    shutil.rmtree(velho, ignore_errors=True)
    return n


def main():
    a = sys.argv[1:]
    if a and a[0] == "--pacote":
        repo, saida, index, meta = a[1:5]
        shutil.rmtree(saida, ignore_errors=True)
        os.makedirs(os.path.join(saida, "dados"))
        html = open(index, encoding="utf-8").read()
        assert '<meta name="wf-dados" content="github">' in html
        open(os.path.join(saida, "index.html"), "w", encoding="utf-8").write(html.replace('<meta name="wf-dados" content="github">', f'<meta name="wf-dados" content="{meta}">'))
        raiz = os.path.dirname(os.path.abspath(index))
        for f in ["manifest.webmanifest", "sw.js", "icone-192.png", "icone-512.png"]:
            shutil.copy(os.path.join(raiz, f), saida)
        for r in RAMOS:
            if existe(repo, r):
                print(r, exportar_ramo(repo, r, os.path.join(saida, "dados")), "arquivos")
        return
    repo, saida, *ramos = a
    os.makedirs(saida, exist_ok=True)
    for r in ramos or RAMOS:
        if existe(repo, r):
            print(r, exportar_ramo(repo, r, saida), "arquivos")


if __name__ == "__main__":
    main()
