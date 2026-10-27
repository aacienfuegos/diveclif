# Montaje del conector de Dive Clif

Pasos de Andrés para poner en marcha el conector (plan de CIE-221). Nadie del equipo los hace por ti: tocan tu cuenta de Cloudflare, tu GitHub y los secretos. Al terminar, las pruebas de `PRUEBAS.md`, antes de invitar a Pelayo.

## Antes de empezar: un worktree limpio en el SHA aprobado

Todo, `npm ci` y `wrangler` incluidos, desde un `git worktree` nuevo en el SHA que aprobó el `ciso`, no desde una copia de trabajo con otras ramas. Así los scripts de instalación que corren son los del árbol de dependencias que se revisó.

```sh
git fetch origin
git worktree add ../diveclif-montaje <SHA aprobado>
cd ../diveclif-montaje/conector
npm ci
```

En lo que sigue, `CONECTOR_HOST` y `PAGINA_HOST` son los dos hostnames del Worker en una zona de tu cuenta (por ejemplo `conector.<tu dominio>` y `propuestas.<tu dominio>`).

## 1. Cloudflare Pages

- El entorno Preview del proyecto de Pages de la web, sin secretos reales y sin recursos enlazados por `wrangler.*` (CIE-211 §2, puntos 2 y 3).
- Access delante de las vistas previas de Pages (la política de Access de las vistas previas, en los ajustes del proyecto), para que una vista previa sin sesión redirija a Access (prueba B10).

## 2. GitHub: Actions sin permisos de escritura ni secretos

- Settings > Actions > General > Workflow permissions: "Read repository contents and packages permissions", y "Allow GitHub Actions to create and approve pull requests" desactivado. Un workflow de un PR desde una rama del repo puede pedir `pull-requests: write` en su propio `permissions:` y corre antes de que nadie lo mergee; con esa casilla desactivada, su aprobación no vale.
- Settings > Secrets and variables > Actions: ningún secreto de repo. Settings > Environments: ninguno con secretos.

Lo comprueban B7 y B8 de `PRUEBAS.md`.

## 3. GitHub App publicadora

En tu cuenta: Settings > Developer settings > GitHub Apps > New GitHub App.

- Sin webhook (desmarca "Active").
- Permisos del repositorio: **Contents** y **Pull requests** en "Read and write"; **Actions** y **Checks** en "Read-only". Nada más: ni **Workflows**, ni **Administration**, ni **Commit statuses**. Workflows no se le da nunca, tampoco al pasar a publicación directa: con él la App podría escribir en `.github/workflows/` un job `cambio-pequeno` que siempre pasa.
- "Only on this account". Instálala solo en `aacienfuegos/diveclif` ("Only select repositories").
- **No generes todavía su clave privada.** Se genera en el paso 8, con R1 a R6 ya activos. Hasta entonces, a `main` solo lo protege `revision-andres` (el ruleset de CIE-251), y con la clave ya creada una aprobación de la App sobre un PR de `cienfuegos-agentes` que toque `functions/` o `package-lock.json` bastaría para mergearlo.
- Apunta el id de la App (página de la App, "App ID"), el id de la instalación (el número al final de la URL de Settings > Applications > la App > Configure) y el slug de la App (el de su URL pública, `github.com/apps/<slug>`).
- En `.github/cambio-pequeno/config.json`, cambia `"autor": "__slug-de-la-app-publicadora__[bot]"` por `"<slug>[bot]"`. Ese cambio es un PR al repo, con revisión del `ciso` antes de mergearlo: la regla decide qué PR son de la App.

## 4. Cloudflare Access: dos aplicaciones

Zero Trust > Access > Applications > Add an application > Self-hosted, dos veces. Cada una con una política "Allow" con tu correo como "Emails" (el de Pelayo, cuando toque) y el inicio de sesión con PIN al correo ("One-time PIN").

- **Conector**, dominio `CONECTOR_HOST`:
  - Managed OAuth activado, sin permitir localhost ni loopback.
  - URL de retorno permitida, solo `https://claude.ai/api/mcp/auth_callback`.
  - "Access token lifetime" (`grant.access_token_lifetime`) en `5m` y "Grant session duration" (`grant.session_duration`) en `168h`: Claude renueva el token cada 5 minutos con las políticas reevaluadas, y se vuelve a pedir el PIN cada 7 días. Si Access no admite alguno de los dos valores, el más corto que admita, y lo dices en CIE-210.
- **Página de las propuestas**, dominio `PAGINA_HOST`: sin Managed OAuth, "Session duration" en `24h`.

De cada aplicación, el "Application Audience (AUD) Tag" (Overview de la aplicación): el del conector va a `ACCESS_AUD_MCP` y el de la página a `ACCESS_AUD_PAGINA`. El nombre del equipo (`<equipo>` en `<equipo>.cloudflareaccess.com`, el dominio de la pantalla de inicio de sesión de Access) va a `ACCESS_EQUIPO`.

## 5. Resend

- El remitente (por ejemplo `conector@diveclif.es`, o el `web@diveclif.es` del formulario) en un dominio verificado en Resend. Que `web@diveclif.es` esté verificado hoy está **sin comprobar**.
- Una clave nueva con permiso "Sending access" y limitada a ese dominio. La cuenta es la del formulario de contacto: comparten 100 correos al día y 3.000 al mes, y el Worker se queda como mucho con 40 al día y 1.000 al mes.

## 6. Token de Cloudflare de solo lectura de Pages

My Profile > API Tokens > Create Token > Custom token: **Account > Cloudflare Pages > Read**, solo en tu cuenta. Es el que usa el Worker para encontrar la vista previa de cada commit.

## 7. `.github/` en `main` y rulesets

Todo este paso va antes de que exista la clave de la App (paso 8), en este orden.

**7.1. `.github/` en `main`.** El arreglo del ordenador de buceo y después el PR a `main` con los commits del conector, que abre el Jefe de Ingeniería y mergeas tú. Más el `CODEOWNERS` de CIE-269 por la vía de CIE-251, con la línea `/src/content/viajes/ @aacienfuegos` (opción (a) del plan): con ella GitHub te exige a ti en todo PR de contenido a `main`, lo apruebe quien lo apruebe. Compruébalo:

```sh
for f in .github/CODEOWNERS .github/cambio-pequeno/regla.mjs .github/workflows/cambio-pequeno.yml; do
  gh api "repos/aacienfuegos/diveclif/contents/$f?ref=main" --jq .path || echo "FALTA $f"
done
gh api 'repos/aacienfuegos/diveclif/contents/.github/CODEOWNERS?ref=main' -H 'Accept: application/vnd.github.raw' \
  | grep -x '/src/content/viajes/ @aacienfuegos' || echo "FALTA la línea de los viajes en CODEOWNERS"
```

Tienen que salir las tres rutas y la línea, sin ningún `FALTA`. Sin eso, R2 no exige code owner en `/.github/` ni en los viajes, y `cambio-pequeno` no corre.

**7.2. La medida de `cambio-pequeno`.** La hace el Jefe de Ingeniería, antes de que importes nada: abre un PR de prueba a `main` desde una rama del equipo, sin mergear, y cita en CIE-210 el `head_sha`, el `event` y los `pull_requests` de su run de `cambio-pequeno`. **Si el `head_sha` no es la cabeza del PR, el montaje para aquí**: el Worker busca los runs por la cabeza del PR, y el plan vuelve a una ronda con el `ciso`.

**7.3. Importar R1 a R6.** Importa `.github/rulesets/r1-main.json`, `r2-main.json`, `r3-main.json`, `r4-ramas.json`, `r5-pelayo.json` y `r6-etiquetas.json` (Settings > Rules > Rulesets > New ruleset > Import a ruleset), cada uno desde `main`. Se llaman `conector-r1` a `conector-r6`, para que el script de CIE-270, que busca por nombre, no los toque. Antes de importar `r4-ramas.json` y `r5-pelayo.json`, cambia en tu worktree (sin subirlo) los marcadores de `bypass_actors`, comillas incluidas, por el número:

- `"__ID_APP_PUBLICADORA__"` (en `r5-pelayo.json`): el id de la App publicadora (paso 3);
- `"__ID_APP_CIENFUEGOS_AGENTES__"` (en `r4-ramas.json`): el id de la App `cienfuegos-agentes`, que sale con `gh api apps/cienfuegos-agentes --jq .id`.

```sh
cd .github/rulesets
sed -i 's/"__ID_APP_PUBLICADORA__"/<id de la App publicadora>/' r5-pelayo.json
sed -i 's/"__ID_APP_CIENFUEGOS_AGENTES__"/<id de cienfuegos-agentes>/' r4-ramas.json
grep -n '__ID_' *.json   # sale vacío
```

R2 se queda sin bypass y la App publicadora fuera del bypass de `revision-andres`: con `PUBLICACION=andres`, es lo que impide que la App mergee.

**7.4. Comprobar lo importado** (condición C12 del `ciso`). Los seis, `active`:

```sh
gh api repos/aacienfuegos/diveclif/rulesets --jq '.[] | select(.name | startswith("conector-")) | "\(.id) \(.name) \(.enforcement)"'
```

El listado no trae reglas ni bypass, así que después, uno a uno:

```sh
for id in $(gh api repos/aacienfuegos/diveclif/rulesets --jq '.[] | select(.name | startswith("conector-")) | .id'); do
  gh api "repos/aacienfuegos/diveclif/rulesets/$id" \
    --jq '{name, enforcement, bypass_actors, checks: [.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[]]}'
done
```

Tiene que salir:

| Ruleset | `bypass_actors` | Checks |
|---|---|---|
| `conector-r1` | vacío | `build` y `visual`, los dos con `integration_id` 15368 (GitHub Actions) |
| `conector-r2` | vacío | ninguno |
| `conector-r3` | solo `{"actor_id": 5, "actor_type": "RepositoryRole"}` (rol de administrador) | `cambio-pequeno` con `integration_id` 15368 |
| `conector-r4` | el rol de administrador y la App `cienfuegos-agentes` | ninguno |
| `conector-r5` | solo la App publicadora | ninguno |
| `conector-r6` | solo el rol de administrador | ninguno |

Y en `revision-andres` (el ruleset de `main` de CIE-251), ningún `actor_id` con el id de la App publicadora en `bypass_actors`. Pega la salida en CIE-210.

Que GitHub admita R4 y R5 con una App en el bypass en una cuenta personal está **sin comprobar**. Si no los admite, para aquí y decides tú (CIE-215 §3.3).

## 8. Clave de la App y despliegue

Solo con el paso 7 terminado (los seis `conector-r*` activos, comprobado con `gh api`).

Genera la clave privada de la App publicadora (ajustes de la App > Private keys > Generate a private key) y conviértela a PKCS#8, que es lo que lee el Worker:

```sh
openssl pkcs8 -topk8 -nocrypt -in <descargada>.pem -out app-pkcs8.pem
```

Un token de API propio para desplegar, en vez de `wrangler login` (Custom token, solo tu cuenta y solo la zona de los dos hostnames):

- **Account > Workers Scripts > Edit** y **Account > D1 > Edit**.
- **Zone > Workers Routes > Edit** en la zona de `CONECTOR_HOST` y `PAGINA_HOST`. La documentación de permisos de Workers dice: "To add, update, or remove Routes or Custom Domains, you need `Editor` access to the Worker and `Workers Routes Write` permission for every affected zone" y "Creating a new Worker requires Workers Admin because per-Worker permissions can only apply to Workers that already exist" ([Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/workers/), actualizada el 2026-09-15). Por eso Workers Scripts va a nivel de cuenta y no de un Worker.
- Con `workers_dev: false` y solo dominios propios, wrangler anterior a 4.143.1 pedía además **Zone > Workers Routes > Read** a partir del segundo despliegue ([wrangler 4.143.1](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler%404.143.1)). `conector/package.json` fija wrangler 4.151.0, así que no hace falta.
- Si el dominio propio necesita también **Zone > DNS > Edit** para crear el registro está **sin comprobar**: la documentación de permisos no lo pide. Si `wrangler deploy` falla al crear el dominio con "No access" o "Authentication error", añádelo y dilo en CIE-210.
- Los dos hostnames no pueden tener ya un registro CNAME: si lo tienen, bórralo antes ([Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)).

Desde `conector/` del worktree limpio, con el token en el entorno solo para estos comandos:

```sh
export CLOUDFLARE_API_TOKEN=<token de despliegue>
export CLOUDFLARE_ACCOUNT_ID=<id de tu cuenta>

npx wrangler d1 create diveclif-conector
```

Rellena los marcadores `__..__` de `wrangler.jsonc` (sin secretos: todos son valores públicos o ids):

| Marcador | Valor |
|---|---|
| `__CONECTOR_HOST__` (dos veces) | `CONECTOR_HOST`, sin `https://` |
| `__PAGINA_HOST__` (dos veces) | `PAGINA_HOST` |
| `__ID_DE_D1__` | el `database_id` que da `d1 create` |
| `__EQUIPO_DE_ACCESS__` | el equipo de Access (paso 4) |
| `__AUD_DE_LA_APLICACION_DEL_CONECTOR__` | AUD de la aplicación de `CONECTOR_HOST` |
| `__AUD_DE_LA_APLICACION_DE_LA_PAGINA__` | AUD de la aplicación de `PAGINA_HOST` |
| `__CORREO_DE_ANDRES__` (dos veces) | tu correo. `CORREOS_PERMITIDOS` lleva los correos que pueden usar el conector, separados por comas: de momento solo el tuyo |
| `__REMITENTE_VERIFICADO_EN_RESEND__` | el remitente del paso 5 |
| `__PROYECTO_DE_PAGES__` | el nombre del proyecto de Pages de la web |
| `__ID_DE_CUENTA_DE_CLOUDFLARE__` | el id de tu cuenta |

`PUBLICACION` se queda en `andres` y `REPO` en `aacienfuegos/diveclif`. Comprueba que no queda ningún marcador con `grep -n '__[A-Z_]*__' wrangler.jsonc` (sale vacío). Este `wrangler.jsonc` relleno se queda en tu worktree; no lo subas al repo.

```sh
npx wrangler d1 migrations apply diveclif-conector --remote

npx wrangler secret put GITHUB_APP_ID           # id de la App
npx wrangler secret put GITHUB_APP_INSTALACION  # id de la instalación
npx wrangler secret put GITHUB_APP_CLAVE < app-pkcs8.pem
npx wrangler secret put RESEND_API_KEY          # clave del paso 5
npx wrangler secret put PAGES_TOKEN             # token del paso 6

npx wrangler deploy
unset CLOUDFLARE_API_TOKEN
```

Después, `shred -u app-pkcs8.pem <descargada>.pem` (o bórralas).

## 9. El conector en Claude

En claude.ai, desde el ordenador: Ajustes > Conectores > Añadir conector personalizado, con `https://<CONECTOR_HOST>/mcp`. Inicia sesión con el PIN. En el móvil aparece solo.

En los permisos del conector, `proponer_viaje`, `cambiar_viaje` y `pedir_a_andres` nunca en "Permitir siempre": que Claude pida permiso en cada llamada y la mires antes de aceptarla. Las dos primeras suben lo que reciben a un PR del repositorio público desde el primer commit, y la tercera manda un correo; si en la conversación hay contenido de fuera (una web, un PDF, un correo) con instrucciones escondidas, una llamada aceptada sin mirar puede sacar por ahí datos de la conversación. Lo mismo se le dice a Pelayo al invitarle.

Que Managed OAuth de Access funcione con el conector de Claude está **sin comprobar**: lo mide esta primera conexión. Si falla, dilo en CIE-210 (la alternativa es una ronda nueva del plan).

## 10. Primera prueba

Un viaje de ejemplo de principio a fin ("Añade un viaje...", "Prepáralo", el correo, la página, "Publicar") y después un cambio de precio sobre él. En modo `andres`, "Publicar" no mergea: te llega el correo con el PR y lo mergeas tú en GitHub (prueba B12).

## Pasar a publicación directa (después de probar, lo decides tú)

1. La App publicadora en el bypass de R2 **y** en el de `revision-andres`, el ruleset de `main` de CIE-251, con `PUBLICACION=andres` todavía. Sin los dos, GitHub rechaza el merge aunque el Worker lo intente. El de `revision-andres` va en su JSON de `homelab-docs` (`scripts/github-rulesets/`), con PR y revisión del `ciso`, y lo aplica el script de CIE-270; nunca a mano, porque la siguiente pasada del script lo quitaría sin avisar.
2. Repetir B1 y B6 de `PRUEBAS.md` con la App en los dos bypass. B6 no es inocuo: si llega a mergear, primero sacas la App de los dos bypass y después reviertes el workflow en `main`.
3. Solo con B1 y B6 en verde, `PUBLICACION` a `directa` en `wrangler.jsonc` y `npx wrangler deploy`. Si alguna falla, la App sale de los dos bypass (el de `revision-andres`, por el mismo JSON de `homelab-docs`) y no hay publicación directa.
