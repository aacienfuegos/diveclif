"""Extrae las capturas del artefacto `capturas` de un run de `visual` (sección "Capturas de Actions"
de CLAUDE.md). Solo biblioteca estándar; se ejecuta con `python3 -I`, la versión de `main`.

Uso: python3 -I extraer_capturas.py <artefacto.zip> <directorio de salida, que no debe existir>

El artefacto entero se rechaza (no se escribe nada y sale con 1) si una entrada es un enlace o no es
un fichero regular, si hay más de 40 entradas, si una pasa de 5 MB al descomprimirla o todas juntas
de 40 MB (contando los bytes leídos, sin fiarse de los tamaños que dice el zip), si dos entradas se
llaman igual o si un PNG no tiene la cabecera PNG. Solo se escriben las entradas cuyo nombre es
exactamente `<pagina>-<ancho>.png`, el mismo patrón que usa el Worker; las demás se ignoran.
"""

import os
import re
import stat
import sys
import zipfile

MAX_ENTRADAS = 40
MAX_POR_ENTRADA = 5 * 1024 * 1024
MAX_TOTAL = 40 * 1024 * 1024
TROZO = 64 * 1024
NOMBRE_CAPTURA = re.compile(r"^[a-z0-9-]+-(1500|390|360)\.png$")
CABECERA_PNG = b"\x89PNG\r\n\x1a\n"


class Rechazo(Exception):
    pass


def es_regular(info):
    if info.is_dir():
        return False
    tipo = stat.S_IFMT(info.external_attr >> 16)
    # Sin tipo de Unix (zip creado fuera de Unix, o solo con permisos) solo se sabe que no es un
    # directorio; un enlace siempre lleva su tipo.
    return tipo == 0 or tipo == stat.S_IFREG


def leer(zf, info, total):
    """Lee la entrada con tope propio. Devuelve (bytes, total acumulado)."""
    trozos = []
    leidos = 0
    with zf.open(info) as f:
        while True:
            trozo = f.read(TROZO)
            if not trozo:
                break
            leidos += len(trozo)
            total += len(trozo)
            if leidos > MAX_POR_ENTRADA:
                raise Rechazo("entrada de más de 5 MB")
            if total > MAX_TOTAL:
                raise Rechazo("más de 40 MB en total")
            trozos.append(trozo)
    return b"".join(trozos), total


def validar(ruta_zip):
    """Todo el artefacto en memoria antes de escribir nada: si algo falla, no queda nada a medias."""
    capturas = {}
    with zipfile.ZipFile(ruta_zip) as zf:
        entradas = zf.infolist()
        if len(entradas) > MAX_ENTRADAS:
            raise Rechazo("más de 40 entradas")
        vistos = set()
        for info in entradas:
            if stat.S_ISLNK(info.external_attr >> 16):
                raise Rechazo("entrada que es un enlace")
            if not es_regular(info):
                raise Rechazo("entrada que no es un fichero regular")
            if info.filename in vistos:
                raise Rechazo("dos entradas con el mismo nombre")
            vistos.add(info.filename)
        total = 0
        for info in entradas:
            datos, total = leer(zf, info, total)
            if not NOMBRE_CAPTURA.match(info.filename):
                continue
            if not datos.startswith(CABECERA_PNG):
                raise Rechazo("PNG sin cabecera PNG")
            capturas[info.filename] = datos
    return capturas


def escribir(capturas, salida):
    os.mkdir(salida, 0o700)
    for nombre, datos in sorted(capturas.items()):
        fd = os.open(os.path.join(salida, nombre), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "wb") as f:
            f.write(datos)
        print(nombre)


def main(argv):
    if len(argv) != 3:
        print("uso: python3 -I extraer_capturas.py <artefacto.zip> <salida>", file=sys.stderr)
        return 2
    try:
        capturas = validar(argv[1])
    except Rechazo as e:
        print(f"artefacto rechazado: {e}", file=sys.stderr)
        return 1
    except (zipfile.BadZipFile, zipfile.LargeZipFile, NotImplementedError, RuntimeError, EOFError, OSError) as e:
        print(f"artefacto rechazado: zip ilegible ({type(e).__name__})", file=sys.stderr)
        return 1
    try:
        escribir(capturas, argv[2])
    except OSError as e:
        print(f"no se puede escribir en la salida ({type(e).__name__}); tiene que ser un directorio nuevo", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
