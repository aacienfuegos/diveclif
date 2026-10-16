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

- Settings > Actions > General > Workflow permissions: "Read repository contents and packages permissions", y sin "Allow GitHub Actions to create and approve pull requests".
- Settings > Secrets and variables > Actions: ningún secreto de repo. Settings > Environments: ninguno con secretos.

Lo comprueban B7 y B8 de `PRUEBAS.md`.

## 3. GitHub App publicadora

En tu cuenta: Settings > Developer settings > GitHub Apps > New GitHub App.

- Sin webhook (desmarca "Active").
- Permisos del repositorio: **Contents** y **Pull requests** en "Read and write"; **Actions** y **Checks** en "Read-only". Nada más: ni **Workflows**, ni **Administration**, ni **Commit statuses**. Workflows no se le da nunca, tampoco al pasar a publicación directa: con él la App podría escribir en `.github/workflows/` un job `cambio-pequeno` que siempre pasa.
- "Only on this account". Instálala solo en `aacienfuegos/diveclif` ("Only select repositories").
- Genera una clave privada y conviértela a PKCS#8, que es lo que lee el Worker:

  ```sh
  openssl pkcs8 -topk8 -nocrypt -in <descargada>.pem -out app-pkcs8.pem
  ```

  Borra la descargada cuando hayas puesto el secreto (paso 7).
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

## 7. Despliegue

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

Después, `shred -u app-pkcs8.pem` (o bórrala) y la `.pem` descargada.

## 8. `.github/` en `main` y rulesets

Antes de importar los rulesets, `.github/` tiene que estar en `main`: el PR a `main` con los commits del conector lo abre el Jefe de Ingeniería y lo mergeas tú. Compruébalo:

```sh
for f in .github/CODEOWNERS .github/cambio-pequeno/regla.mjs .github/workflows/cambio-pequeno.yml; do
  gh api "repos/aacienfuegos/diveclif/contents/$f?ref=main" --jq .path || echo "FALTA $f"
done
```

Sin eso, R2 no exige code owner y `cambio-pequeno` no corre.

Después, importa `.github/rulesets/r1-main.json` a `r6-etiquetas.json` (Settings > Rules > Rulesets > New ruleset > Import a ruleset), cada uno desde `main`. Antes de importar cada uno, cambia en el fichero (en tu worktree, sin subirlo) los marcadores de ids de Apps de `bypass_actors`:

- `__ID_APP_PUBLICADORA__`: el id de la App publicadora (paso 3);
- `__ID_APP_CIENFUEGOS_AGENTES__`: el id de la App `cienfuegos-agentes`, que sale con `gh api apps/cienfuegos-agentes --jq .id`.

Con `PUBLICACION=andres`, R2 sin bypass: es lo que impide que la App mergee.

Que GitHub admita R4 y R5 con una App en el bypass en una cuenta personal está **sin comprobar**. Si no los admite, para aquí y decides tú (CIE-215 §3.3).

## 9. El conector en Claude

En claude.ai, desde el ordenador: Ajustes > Conectores > Añadir conector personalizado, con `https://<CONECTOR_HOST>/mcp`. Inicia sesión con el PIN. En el móvil aparece solo.

Que Managed OAuth de Access funcione con el conector de Claude está **sin comprobar**: lo mide esta primera conexión. Si falla, dilo en CIE-210 (la alternativa es una ronda nueva del plan).

## 10. Primera prueba

Un viaje de ejemplo de principio a fin ("Añade un viaje...", "Prepáralo", el correo, la página, "Publicar") y después un cambio de precio sobre él. En modo `andres`, "Publicar" no mergea: te llega el correo con el PR y lo mergeas tú en GitHub (prueba B12).

## Pasar a publicación directa (después de probar, lo decides tú)

1. La App publicadora en el bypass de R2, con `PUBLICACION=andres` todavía.
2. Repetir B1 y B6 de `PRUEBAS.md` con la App en el bypass. B6 no es inocuo: si llega a mergear, primero sacas la App del bypass de R2 y después reviertes el workflow en `main`.
3. Solo con B1 y B6 en verde, `PUBLICACION` a `directa` en `wrangler.jsonc` y `npx wrangler deploy`. Si alguna falla, la App sale del bypass y no hay publicación directa.
