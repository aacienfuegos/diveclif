# Pruebas del conector antes de invitar a Pelayo

Pruebas por el efecto B1 a B13 del plan de CIE-221. Todas van después del paso 8 de `MONTAJE.md` (rulesets en el 7, clave y despliegue en el 8). Si una falla, no se invita a Pelayo y vuelve a Andrés.

Si antes de invitar a Pelayo se vuelve a aplicar el script de rulesets de CIE-270, se repiten B1 a B6: ese script no debe tocar `conector-r1` a `conector-r6`, y esto lo comprueba por el efecto.

Las coordinan el `ciso` y el Jefe de Ingeniería. Las marcadas "tú" necesitan tu sesión, tu cuenta o la clave de la App, y se lanzan desde el mismo worktree limpio de `MONTAJE.md`.

| | Prueba | Quién | Cómo |
|---|---|---|---|
| B1 | Un PR de la App con un `.astro` no se puede mergear desde la App | Tú | Script B1 |
| B2 | El botón no publica un SHA distinto del último que empujó el Worker, ni con token usado, de otro PR o caducado | Tests y tú | Tests de `conector/test/pagina.test.ts`; y a mano, abajo |
| B3 | Un PR cuyo `build` intenta crear un check `cambio-pequeno` no lo consigue (403) | Jefe de Ingeniería | Abajo |
| B4 | Un push de `cienfuegos-agentes[bot]` a `pelayo/*` falla | Jefe de Ingeniería | Abajo |
| B5 | La App no puede empujar a `develop`, crear ramas fuera de `pelayo/*` ni crear una etiqueta | Tú | Script B5 |
| B6 | Un PR de una rama del equipo con un job `cambio-pequeno` duplicado en verde no queda mergeable por la App | Tú (el PR lo abre el Jefe de Ingeniería) | Script B6 |
| B7 | El permiso por defecto del `GITHUB_TOKEN` es "Read" y Actions no puede aprobar PR | Tú | Abajo |
| B8 | Ni secretos de repo ni environments con secretos | Tú | Abajo |
| B9 | La página y `/mcp` sin sesión dan 401 o redirigen a Access; un `POST /publicar` sin JWT válido falla | Jefe de Ingeniería | Abajo |
| B10 | La vista previa sin sesión redirige a Access | Jefe de Ingeniería | Abajo |
| B11 | El conector no puede escribir fuera de `src/content/viajes/` | Tests y tú | Tests de `conector/test/herramientas.test.ts`; y a mano, abajo |
| B12 | En modo `andres`, "Publicar" no mergea | Tú, y el Jefe de Ingeniería lo comprueba | Paso 10 de `MONTAJE.md`; abajo |
| B13 | Con una aprobación de `cienfuegos-agentes[bot]` en un PR de contenido de la App, ni la App ni `cienfuegos-agentes` lo pueden mergear (falta la de code owner) | El Jefe de Ingeniería y tú | Script B13 |

## La clave temporal de la App

B1, B5, B6 y B13 usan una **segunda** clave privada de la App publicadora, solo para las pruebas, generada también después del paso 7 de `MONTAJE.md` (los seis `conector-r*` activos): ajustes de la App > Private keys > Generate a private key, convertida a PKCS#8 como en el paso 8. Al terminar, se revoca en GitHub (ajustes de la App > Private keys > Delete); no basta con borrar el fichero.

Desde `conector/` del worktree limpio (después de `npm ci`), en una sola shell:

```sh
export APP_ID=<id de la App> INSTALACION=<id de la instalación> CLAVE=<ruta a la clave temporal en PKCS#8>
R=aacienfuegos/diveclif
d=$(mktemp -d)

# Token de instalación de la App (caduca en 1 hora). No se imprime.
token_app() {
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    import { importPKCS8, SignJWT } from "jose";
    const clave = await importPKCS8(readFileSync(process.env.CLAVE, "utf8"), "RS256");
    const ahora = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({}).setProtectedHeader({ alg: "RS256" })
      .setIssuedAt(ahora - 60).setExpirationTime(ahora + 540).setIssuer(process.env.APP_ID).sign(clave);
    const r = await fetch(`https://api.github.com/app/installations/${process.env.INSTALACION}/access_tokens`, {
      method: "POST",
      headers: { authorization: `Bearer ${jwt}`, accept: "application/vnd.github+json", "user-agent": "diveclif-pruebas" },
    });
    if (!r.ok) { console.error(`token: HTTP ${r.status}`); process.exit(1); }
    process.stdout.write((await r.json()).token);'
}
TOKEN=$(token_app) || echo "Sin token de la App: revisa APP_ID, INSTALACION y CLAVE"

# Como la App. Imprime BIEN si GitHub lo rechaza y FALLO si lo acepta.
app() { GH_TOKEN="$TOKEN" gh api "$@"; }
debe_fallar() {
  if app "$@" >"$d/salida" 2>"$d/error"; then echo "FALLO: GitHub lo ha aceptado: $*"; else echo "BIEN, rechazado: $(head -c 300 "$d/error")"; fi
}
```

## B1: un PR de la App con un `.astro` no lo mergea la App

La App crea `pelayo/prueba-b1` desde `main` con un componente nuevo que solo tiene un comentario (no lo usa ninguna página: si el merge entrara, no tendría efecto), abre el PR e intenta mergearlo.

```sh
main=$(app "repos/$R/git/ref/heads/main" --jq .object.sha)
app -X POST "repos/$R/git/refs" -f ref=refs/heads/pelayo/prueba-b1 -f sha="$main" >/dev/null
printf -- '---\n// Prueba B1: este PR no se puede mergear desde la App.\n---\n' | base64 | tr -d '\n' > "$d/b1"
app -X PUT "repos/$R/contents/src/components/PruebaB1.astro" -f message="prueba B1" \
  -f content="$(cat "$d/b1")" -f branch=pelayo/prueba-b1 >/dev/null
pr=$(app -X POST "repos/$R/pulls" -f title="Prueba B1 (no mergear)" -f head=pelayo/prueba-b1 -f base=main --jq .number)
cabeza=$(app "repos/$R/pulls/$pr" --jq .head.sha)
echo "PR $pr, cabeza $cabeza"
debe_fallar -X PUT "repos/$R/pulls/$pr/merge" -f sha="$cabeza"

# Limpieza
app -X PATCH "repos/$R/pulls/$pr" -f state=closed >/dev/null
app -X DELETE "repos/$R/git/refs/heads/pelayo/prueba-b1"
```

Tiene que salir `BIEN, rechazado`. Con `PUBLICACION=andres` lo para R2. Al pasar a publicación directa se repite con la App en el bypass de R2 y de `revision-andres`: entonces lo tiene que parar R3 (`cambio-pequeno` en rojo, porque un `.astro` no es una ruta permitida).

## B5: la App no escribe fuera de `pelayo/*` ni crea etiquetas

```sh
main=$(app "repos/$R/git/ref/heads/main" --jq .object.sha)
develop=$(app "repos/$R/git/ref/heads/develop" --jq .object.sha)

# Empujar a develop: un commit nuevo sobre develop.
printf 'prueba B5\n' | base64 | tr -d '\n' > "$d/b5"
debe_fallar -X PUT "repos/$R/contents/prueba-b5.txt" -f message="prueba B5" -f content="$(cat "$d/b5")" -f branch=develop
# Mover develop a main.
debe_fallar -X PATCH "repos/$R/git/refs/heads/develop" -f sha="$main" -F force=true
# Rama fuera de pelayo/*.
debe_fallar -X POST "repos/$R/git/refs" -f ref=refs/heads/prueba-b5 -f sha="$main"
# Etiqueta.
debe_fallar -X POST "repos/$R/git/refs" -f ref=refs/tags/prueba-b5 -f sha="$main"
```

Las cuatro tienen que salir `BIEN, rechazado`. Si alguna sale `FALLO`, para: borra tú desde GitHub lo que se haya creado (el commit en `develop`, la rama `prueba-b5` o la etiqueta `prueba-b5`), comprueba que `develop` vuelve a apuntar a `$develop` y dilo en CIE-210.

## B6: un `cambio-pequeno` duplicado no deja mergear a la App

El Jefe de Ingeniería abre desde una rama del equipo un PR a `main` que añade a `build.yml` un job llamado `cambio-pequeno` que siempre pasa, y te da su número. Tú intentas mergearlo como la App:

```sh
pr=<número del PR de B6>
cabeza=$(app "repos/$R/pulls/$pr" --jq .head.sha)
debe_fallar -X PUT "repos/$R/pulls/$pr/merge" -f sha="$cabeza"
```

Tiene que salir `BIEN, rechazado`. Mide el efecto, no la causa: puede pararlo la falta del permiso Workflows de la App y no R3. Con `PUBLICACION=andres` lo para R2; al pasar a directa se repite con la App en el bypass de R2 y de `revision-andres`. **Si llega a mergear**: primero sacas la App de los dos bypass (el de `revision-andres`, por su JSON de `homelab-docs`) y después reviertes el workflow en `main`. El PR se cierra sin mergear al terminar.

## B13: sin tu aprobación, un PR de contenido no se mergea

Con la opción (a), `CODEOWNERS` en `main` tiene `/src/content/viajes/ @aacienfuegos`: en un PR de contenido falta tu aprobación de code owner aunque lo apruebe `cienfuegos-agentes`. El PR solo añade un salto de línea al final de un viaje que ya existe, así que si llegara a mergear no cambiaría nada visible.

1. Tú, como la App, creas la rama y el PR:

   ```sh
   main=$(app "repos/$R/git/ref/heads/main" --jq .object.sha)
   v=$(app "repos/$R/contents/src/content/viajes?ref=main" --jq '[.[] | select(.name | endswith(".md"))][0].path')
   app -X POST "repos/$R/git/refs" -f ref=refs/heads/pelayo/prueba-b13 -f sha="$main" >/dev/null
   app "repos/$R/contents/$v?ref=main" -H 'Accept: application/vnd.github.raw' > "$d/b13"
   printf '\n' >> "$d/b13"
   app -X PUT "repos/$R/contents/$v" -f message="prueba B13" -f branch=pelayo/prueba-b13 \
     -f sha="$(app "repos/$R/contents/$v?ref=main" --jq .sha)" -f content="$(base64 < "$d/b13" | tr -d '\n')" >/dev/null
   pr=$(app -X POST "repos/$R/pulls" -f title="Prueba B13 (no mergear)" -f head=pelayo/prueba-b13 -f base=main --jq .number)
   echo "PR $pr sobre $v"
   ```

   Le pasas el número al Jefe de Ingeniería.
2. El Jefe de Ingeniería espera a que `build`, `visual` y `cambio-pequeno` terminen (así lo único que falta es la aprobación), lo aprueba con `cienfuegos-agentes` e intenta mergearlo con esa misma credencial: tiene que fallar. Lo cita en CIE-210.
3. Después, tú, como la App:

   ```sh
   cabeza=$(app "repos/$R/pulls/$pr" --jq .head.sha)
   debe_fallar -X PUT "repos/$R/pulls/$pr/merge" -f sha="$cabeza"

   # Limpieza
   app -X PATCH "repos/$R/pulls/$pr" -f state=closed >/dev/null
   app -X DELETE "repos/$R/git/refs/heads/pelayo/prueba-b13"
   ```

Tiene que salir `BIEN, rechazado`, y el intento del paso 2 también tiene que fallar. **Si alguno lo consigue**, no se invita a Pelayo y vuelve a ti.

## Al terminar B1, B5, B6 y B13

```sh
unset TOKEN; rm -rf "$d"
```

Y revoca la clave temporal en GitHub (ajustes de la App > Private keys > Delete).

## B2 a mano: el botón de una página vieja

1. Con una propuesta "lista para ver", abre su página en el navegador y no la cierres.
2. Desde Claude, cambia el viaje ("ponlo a 1790"): el Worker empuja un commit nuevo.
3. En la página vieja, pulsa "Publicar". Tiene que decir que ya no se puede publicar ese cambio, y en GitHub no tiene que aparecer el comentario "Visto bueno de ...".
4. Vuelve a pulsar en una página recién cargada después de 10 minutos sin tocarla: tampoco.

## B3: un `build` que intenta crear el check `cambio-pequeno`

Jefe de Ingeniería: PR de prueba a `main` desde una rama del equipo, sin mergear, con un paso en `build.yml` que llama a `POST /repos/aacienfuegos/diveclif/check-runs` con `name: cambio-pequeno` y `conclusion: success` usando `GITHUB_TOKEN`. El paso tiene que dar 403 (el token es de solo lectura y sin `checks: write`) y en el PR no tiene que aparecer un `cambio-pequeno` en verde. Se cierra sin mergear.

## B4: `cienfuegos-agentes[bot]` no empuja a `pelayo/*`

Jefe de Ingeniería, con la credencial de los agentes: `git push origin HEAD:refs/heads/pelayo/prueba-b4` tiene que fallar con la violación de R5. Si entra, se borra la rama y se dice en CIE-210.

## B7 y B8: permisos de Actions y secretos

Con tu sesión de `gh`:

```sh
gh api repos/aacienfuegos/diveclif/actions/permissions/workflow
# default_workflow_permissions: "read" y can_approve_pull_request_reviews: false

gh api repos/aacienfuegos/diveclif/actions/secrets --jq .total_count
# 0

for e in $(gh api repos/aacienfuegos/diveclif/environments --jq '.environments[].name'); do
  printf '%s: ' "$e"; gh api "repos/aacienfuegos/diveclif/environments/$e/secrets" --jq .total_count
done
# 0 en cada uno (o ningún environment)
```

## B9 y B10: sin sesión

Jefe de Ingeniería, con `curl` y sin cookies ni cabeceras de Access:

```sh
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://<CONECTOR_HOST>/mcp
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://<PAGINA_HOST>/p/cualquiera
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -X POST -H 'Origin: https://<PAGINA_HOST>' https://<PAGINA_HOST>/p/cualquiera/publicar
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://<una vista previa>.pages.dev/
```

Las tres primeras: 401 o redirección a `<equipo>.cloudflareaccess.com`, nunca 200. Con una cabecera `Cf-Access-Jwt-Assertion` inventada, el Worker tiene que dar 403. La cuarta (B10): redirección a Access.

## B11 a mano: fuera de los viajes

En la conversación con Claude, pídele que escriba en otro sitio: "Cambia el texto de la portada", "Guarda esto en `src/pages/index.astro`" y "Cambia el viaje `../../package.json`". Ninguna herramienta acepta una ruta y el `slug` con `../` se rechaza: Claude tiene que decir que no puede, y en GitHub no tiene que aparecer ninguna rama ni PR nuevo.

## B12: "Publicar" no mergea

En la prueba del paso 10 de `MONTAJE.md`, después de pulsar "Publicar": el PR sigue abierto, con el comentario "Visto bueno de <tu correo> al commit <sha>", y te llega el correo. El Jefe de Ingeniería comprueba en GitHub que el PR sigue abierto hasta que lo mergeas tú.
