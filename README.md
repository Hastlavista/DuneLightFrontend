# DuneLight — Frontend

Angular frontend for the DuneLight multi-tenant wellness/fitness studio platform. This
first slice ships the application shell, authentication, and the design system every
future module (schedule, clients, finance, ...) will be built on top of. No feature
modules yet — just the skeleton, login, and empty placeholder screens.

## Stack

- Angular 21, standalone components, signals for local/shared state (no NgRx)
- PrimeNG 21 + PrimeIcons, themed via a custom preset (`src/app/core/design/dune-preset.ts`)
- `@ngx-translate/core` + `@ngx-translate/http-loader` for UI text — see [Internationalization](#internationalization)
- Functional HTTP interceptors + functional route guards

> **Node version note:** this repo was scaffolded with `@angular/cli@21` because the
> installed Node (24.14) is one patch below what Angular CLI 22 requires (24.15+).
> Once Node is upgraded, the project can be moved to Angular 22 by bumping the
> `@angular/*`, `primeng`, `@primeuix/themes` and `@angular/cdk` versions together.

## Getting started

```bash
npm install
npm start        # ng serve, http://localhost:4200
```

The app expects the .NET backend at the URL configured in
`src/environments/environment.development.ts` (defaults to `https://localhost:6001`).
CORS is fully open on the backend in dev, so no proxy config is needed.

```bash
npm run build     # production build → dist/
npm test          # unit tests (Vitest)
```

## Environments

- `src/environments/environment.ts` — used for production builds
- `src/environments/environment.development.ts` — used by `ng serve` / dev builds
  (wired up via the `development` configuration's `fileReplacements` in `angular.json`)

Both just expose `{ production, apiUrl }`. Point `apiUrl` at the real backend before
deploying.

## Project structure

```
src/app/
  core/                     # cross-cutting, singleton stuff — no UI
    auth/auth.service.ts    # login/logout/changePassword, session signal, localStorage persistence
    guards/                 # authGuard, adminGuard, guestGuard (functional CanActivateFn)
    interceptors/           # auth (Bearer token) + error (parsing, toasts, 401 handling)
    services/               # CurrentEmployeeService, LocationContextService, NotificationService
    models/                 # DTOs + the UserRole type + role → translation-key map
    design/dune-preset.ts   # PrimeNG theme preset (palette → design tokens)
    http/                   # HttpContext tokens shared by interceptors/services

  layout/                   # the app shell
    shell/                  # sidebar + topbar + <router-outlet>, one instance for /admin and /app
    sidebar/                # nav list (per section) + logged-in user card
    topbar/                 # page title, location switcher, admin/trainer view switch
    nav-items.ts            # nav item definitions (path, icon, translation key) per section

  features/
    auth/login/             # the login screen
    admin/                  # admin.routes.ts + pages/<name> (all placeholders today)
    trainer/                # trainer.routes.ts + pages/<name> (all placeholders today)

  shared/components/
    page-placeholder/       # "title + coming soon" card used by every placeholder page

src/assets/i18n/hr.json      # Croatian UI text (see below)
```

### Adding a new module (e.g. "Schedule")

1. Replace the placeholder component in `features/admin/pages/schedule` (or
   `features/trainer/pages/...`) with the real screen — the route, nav entry, and
   title translation key are already wired up.
2. If it needs the selected location, inject `LocationContextService` and read
   `selectedLocation()` / `selectedLocationId()`.
3. Add any new backend calls as their own service under `core/services` or a
   feature-local service — the auth and error interceptors apply automatically to
   every `HttpClient` call.
4. Add its strings to `src/assets/i18n/hr.json` under a new top-level key.

## Authentication

- `POST /api/public/Auth/Login` → `AuthService.login()`. The full `AuthResponse`
  (token, role, org info) is kept in a signal and mirrored to `localStorage` so a page
  refresh doesn't log the user out. Only the organization slug is separately
  remembered (`getRememberedOrganizationSlug()`) and pre-fills the login form; email
  and password are never persisted.
- The auth interceptor (`core/interceptors/auth.interceptor.ts`) attaches
  `Authorization: Bearer <token>` to every request once a session exists — no route
  matching needed, since only the (tokenless) login call happens before a session
  exists.
- The error interceptor (`core/interceptors/error.interceptor.ts`) parses every
  backend error as the same structured shape: `{ error: { code, message, details } }`
  (including `/api/public/Auth/*`). The backend's `message` is kept on `AppError`
  only for logging/debugging — **it is never shown to the user**. Instead, the UI
  always translates `error.code` via `errors.<CODE>` in `src/assets/i18n/hr.json`
  (`core/utils/error-translation.util.ts`), falling back to `errors.UNKNOWN` when a
  code has no translation yet. `details` (per-field validation) is preserved on
  `AppError` for forms that want to surface it, though none does yet.

  A 401 from any *non*-auth route is treated as "session expired": it logs the user
  out and redirects to `/login`. A 401 from `/api/public/Auth/Login` or
  `/ChangePassword` is a normal business error (wrong password) and is left for the
  calling component to display inline — it does **not** log anyone out.
- `GET /api/employees/me` is fetched once the shell mounts
  (`CurrentEmployeeService`) via the `SUPPRESS_ERROR_TOAST` HttpContext token, which
  any future "expected error" call can reuse. A 404 means two different things
  depending on role: for Admin it's handled quietly (Owner/Admin without an Employee
  record yet, e.g. right after Register — no toast, the user just doesn't get a
  trainer profile); for Member/Reception it means the Employee record backing an
  already-logged-in session was deleted, so the session itself is invalid — that logs
  the user out and redirects to `/login`, same as a 401 session-expiry.

### Roles

The backend uses one role value in both directions: `"Admin" | "Member" | "Reception"`
(see `core/models/role.ts`). That value is used as-is everywhere in code — guards,
comparisons, request bodies. The Croatian on-screen label (Admin/Trener/Recepcija)
only exists as a translation key (`ROLES.ADMIN` etc.), resolved via the `translate`
pipe — never hardcoded.

- `/admin/**` — `authGuard` + `adminGuard` (role must be `"Admin"`)
- `/app/**` — `authGuard` only (any logged-in role, including `Reception`, per the
  current spec — there's no dedicated Reception UI yet)
- `/login` — `guestGuard` redirects an already-logged-in user to their section

## Internationalization

Only `src/assets/i18n/hr.json` exists today; the app defaults to `hr`
(`provideTranslateService({ defaultLanguage: 'hr' })` in `app.config.ts`). To add
English later, drop an `en.json` with the same key structure next to it and wire up a
language switcher that calls `TranslateService.use('en')` — no other code changes
needed.

Rules followed throughout the codebase:

- All identifiers, comments, and code are in English.
- No UI string is ever hardcoded in a component — templates use the `translate` pipe
  (`{{ 'SOME.KEY' | translate }}`), and the few places that need translated text in
  TypeScript (toasts, the login error message) call `TranslateService.instant(key)`.
- Enum-like display values (role labels) are stored as translation-key maps, not
  literal strings, so the "translatable text lives only in JSON" rule has no
  exceptions.

## Design system

Palette, fonts, and base card styles live in `src/styles.scss` as CSS custom
properties (`--paper`, `--clay`, `--gold`, `--emerald`, `--red`, ...). PrimeNG is
themed to follow the same palette via `core/design/dune-preset.ts`, which extends
PrimeNG's Aura preset with our colors mapped onto its primitive/semantic design
tokens (primary = gold/ochre, surface = paper/sand/clay ramp, success = emerald,
danger = red). The theme is intentionally single-mode (`color-scheme: light` is
forced) since the design has no dark variant.

Fonts (Google Fonts, loaded in `index.html`): **Spectral** for headings, **Instrument
Sans** for body/UI text.

## Location context

`core/services/location-context.service.ts` holds the globally selected location
(`null` = "All locations") as a signal, persisted to `localStorage`. It loads the
catalog once from `GET /api/catalog/locations` (failure just leaves the switcher on
"All locations"). Future screens that need to filter by location just inject the
service and read `selectedLocation()` / `selectedLocationId()`.
