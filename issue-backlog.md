# Good-first-issue backlog (wave 2+)

Candidates found in the 2026-08-07 code sweep, held back so the tracker isn't flooded.
Wave 1 (#763–#782) + the provider-removal epic (#783) are already open.
Open these in batches as the current ones get claimed/closed.

---

## Server consistency & hygiene

### Audit endpoint: unwrapped response shape + unvalidated pagination
`apps/server/src/api/v1/audit/controller.ts:10-20` — `res.json(result)` skips the `{ success, data }` envelope used everywhere else, and the error path returns `{ error }` without `success: false`. `parseInt(req.query.page) || 1` accepts negatives and there is no upper bound on `pageSize`, so `?pageSize=1000000` loads the whole audit table. Add a small zod schema with `.int().min(1)` and a max page size. *(easy — labels: good first issue, Server)*

### Handlers leak raw error.message in 500 responses
`apps/server/src/api/v1/services/controller.ts:249,285,314,343`; `providers/controller.ts:56,145`; `dashboards/controller.ts:39-43,65-69,85-86` — raw `error.message` (SSH stderr, host paths, SQL constraint text) goes into the response as `details`/`error`. Log it, return the generic `'Internal server error'` string like the majority of handlers. *(easy — note: the services/providers files may be deleted by #783 first; dashboards part stays valid)*

### OPTIONS listed as an edit method blocks Viewer CORS preflights
`apps/server/src/middleware/auth.ts:49-52` — `editMethods` includes `'OPTIONS'`; a Viewer-role user gets 403 on the preflight before any real request. Remove `'OPTIONS'`. Also drop the redundant `&& apiToken.length > 0` at line 34 (already guaranteed by `hasApiToken` at line 19). *(trivial)*

### [DEBUG] messages logged at info level
`apps/server/src/dal/sshClient.ts:343-345,359-361` — `[DEBUG]`-prefixed logs emitted via `logger.info` spam production logs on every poll; the shared `Logger` already exposes `.debug()`. *(trivial — superseded by #783 if sshClient is deleted)*

### Copy-pasted wrong logger contexts
`apps/server/src/api/v1/secrets/controller.ts:10` logs as `'v1/integrations/controller'`; `providers/controller.ts:10` logs as `'server'`. Rename to match the module-path convention. *(trivial — providers half superseded by #783)*

### bcrypt cost factor 10 repeated four times
`apps/server/src/bl/users/user.bl.ts:24,40,64,105` — extract a module-level `const SALT_ROUNDS = 10;` (ideally config-driven, matching `utils/encryption.ts`'s named crypto constants). *(trivial)*

### ServiceController receives an alertBL dependency it never uses
`apps/server/src/api/v1/services/controller.ts:33`, wired at `app.ts:187-194` — zero references in the class body. *(trivial — superseded by #783, which deletes the whole controller)*

## Client UX / accessibility

### Icon-only buttons missing aria-label
`CommentItem.tsx:82-100` (edit/delete), `AlertDetailsHeader.tsx:19-21` (close), `HttpActionForm.tsx:146-154` (remove header row), `DashboardRow.tsx:118,288`, `MyProviders.tsx:799,900` — unlabeled `<Button size="icon">` instances. `ServiceTable.tsx:381-383` models the `sr-only` fix. *(easy — drop the MyProviders/ServiceTable references once #783 lands)*

### Dashboard search suggestions can't be selected with the keyboard
`apps/client/src/components/Alerts/DashboardHeader.tsx:129-162` — suggestion list is mouse-only (`onMouseDown`), no arrow-key navigation, no Enter-to-select, no combobox/listbox roles; blur dismissed by a magic `setTimeout(..., 200)`. *(easy)*

### Replace "user(s)" / "row(s)" / "operation(s)" copy with real pluralization
`pages/Settings.tsx:648,655`, `RetentionSettings.tsx:184`, `AddServiceDialog.tsx:380` — the `${n !== 1 ? 's' : ''}` pattern already exists elsewhere (`AlertsSelectionBar.tsx:115`, `SelectedServicesInfo.tsx:14`, `Oncall.tsx:104`). Settings also mixes "user(s)" and "User(s)" casing in the same dialog. *(trivial — AddServiceDialog superseded by #783)*

### Audit-log filter state is dead and filtering breaks pagination
`pages/Settings.tsx:689,714,791-793,837` — `setFilter` is never called (the dropdown was never built), and `filteredLogs` filters only the current page while `total`/`totalPages` come from the server; pagination controls sit inside the non-empty branch so an empty filtered page strands the user. Either remove the dead state or build the filter properly. *(easy)*

## Client cleanup / dead code

### Remove or finish the orphaned AlertsHeatmap folder
`components/Alerts/AlertsHeatmap/` contains only utils/types/constants — no component, no index, referenced only internally. *(trivial)*

### Role enum declared three times
`types/index.ts:2-7`, `lib/permissions.ts:4-9`, plus the canonical one in `@OpsiMate/shared` — different modules import different copies. Standardize on the shared export, delete the two local copies. *(easy)*

### Duplicated getContrastColor using deprecated String.substr
`components/ui/tag-badge.tsx:39-47` + `components/Dashboards/Dashboards.utils.ts:74-80` — same luminance function copy-pasted, both using deprecated `.substr`. Extract one copy, switch to `.slice`. *(trivial)*

### Consolidate four hand-rolled relative-time formatters
`CommentItem.tsx:40-53` and `AlertLastCommentSection.tsx:13-23` are functionally identical; `Settings.tsx:671-680` and `MutePolicies.tsx:63-77` are variants; plus ~5 local absolute-date `formatDate` helpers. Extract a shared `formatRelativeTime` in `src/lib/date.utils.ts`. *(easy)*

### Extract copy-pasted handleCopy into a useCopyToClipboard hook
Six integration modals (`GCPSetupModal.tsx:23-41`, `UptimeKumaSetupModal.tsx:23-41`, `GrafanaSetupModal.tsx:29`, `DatadogSetupModal.tsx:50`, `CustomAlertsSetupModal.tsx:37`, `ZabbixSetupModal.tsx:151`) each define near-identical clipboard logic; GCP and UptimeKuma are byte-for-byte identical. Extract a hook with the 2000ms reset as a named constant. *(easy)*

### Extract the hardcoded 'jwt' localStorage key
10 call sites in 8 files (`lib/api.ts:62,95`, `lib/auth.ts:27`, `AuthGuard.tsx:22,94`, `Profile.tsx:13`, `useProfileEdit.ts:112`, `Login.tsx:23,66`, `Register.tsx:42`) — export `AUTH_TOKEN_STORAGE_KEY` from `lib/auth.ts`. *(trivial)*

### savedViews.ts re-hardcodes the active-view storage key
`lib/savedViews.ts:97,103,123,127` inline the literal that `hooks/queries/views/useActiveView.ts:8` already names (`ACTIVE_VIEW_STORAGE_KEY`); the two also duplicate the API-with-localStorage-fallback logic. At minimum share the constant. *(trivial)*

### Alerts auto-refresh interval is a magic 5000
`components/Alerts/hooks/useAlertsRefresh.ts:18-25` — extract `ALERTS_REFRESH_INTERVAL_MS = 5 * 1000` (pattern: `useAlertsFiltering.ts:14`'s `ROLLING_WINDOW_TICK_MS`). The unused `catch (error)` binding at line 38 can go too. *(trivial)*

## "Add unit tests for X" (Vitest; pattern: `apps/client/src/test/distributeWidths.test.ts`)

- **TagKey helpers** — `src/types/TagKey.ts`: round trip `extractTagKeyFromColumnId(getTagKeyColumnId(k)) === k`, false for ordinary ids, `null` (not `''`) for non-tag columns, colon-in-key and empty-key edges. *(trivial)*
- **profile.utils** — `getInitials` ('?' for blank, uppercase, 2-char cap, single word) + `formatDate` against a fixed ISO date. *(trivial)*
- **Dashboards.utils** — corrupt-localStorage → `[]`, toggleFavorite add/remove + persist, favorites-first sort without mutation, case-insensitive filter on name/description/tag, `getContrastColor` #ffffff→black. *(easy)*
- **errorMapper** — field-specific beats generic, HTTP-status mapping, `isValidationError` guard with null/undefined (may surface a real null-handling bug: unguarded property access on `response`). *(easy)*
- **Providers.utils** — case-insensitive filter on name+type, category tabs, `'all'` no-op, missing-name safety, switch-table fallbacks. *(easy — superseded by #783 if Providers.utils is deleted)*
- **IntegrationAvatar.utils** — the four-step fallback chain (type → primary tag → id → summary → 'custom'), substring + case-insensitive matching, label for every kind. *(easy)*
- **alertHistory.utils** — `filterHistoryByRange` inclusive bounds + null range; `selectHistoryEntries` synthesized-UPDATED fallback (only when the window hides every real event, never on "All time"). *(easy)*
- **DashboardContext.utils** — corrupt JSON → default state; non-custom preset drops frozen from/to dates while 'custom' keeps them as Dates; save→load round trip. *(easy)*
- **AlertsTable.utils** (`filterAlerts` + `sortAlerts`, optionally grouping) — no input mutation, per-field sorts (severity rank, epoch dates with invalid→0, owner key), group/flatten with collapsed groups, firing > muted > resolved rollup. *(easy, biggest of the set)*
- **Shared normalizeAlertSeverity** — `packages/shared/src/types.ts`: synonym table ('crit'/'P1'/'high'→critical, 'ok'/'P5'→info), case/whitespace insensitivity, null/''→default, prototype-key guard ('__proto__', 'constructor'→default). Note: `packages/shared` has no vitest setup — either place the test in `apps/client/src/test/` (alias resolves to source) or add a minimal config to the package. *(easy)*
- **useFilterPanel hook** — `renderHook`: initial cap of 6 facets with hasMore/remaining, +5 per `handleLoadMore`, case-insensitive search on value+displayValue, per-field independence. Pattern: `useServiceFilters.test.tsx`. *(easy)*
- **useFormErrors hook** — success clears errors, validation errors populate per-field via mapper, `showFieldErrors: false` (login) yields a single general error, non-validation failures route through `mapApiError`. *(easy)*
- **permissions.ts** — good "easy, uses vi.mock" task: mock `getUserRole` + `isPlaygroundMode`, assert the role × permission matrix. *(easy)*

## Security (ON HOLD — user decision 2026-08-07: no security issues for now)

- **CORS reflects any origin with credentials: true** — `apps/server/src/app.ts:130-140` — move to a config-driven allowlist.
- **No rate limiting on login/register/forgot-password/book-demo** — `apps/server/src/api/v1/v1.ts:59-68` — `express-rate-limit` per-IP window.
- **Hardcoded default secrets** — `'changeme-secret'` in `middleware/auth.ts:6` + `users/controller.ts:20` (JWT_SECRET duplicated), `'test-key-should-be-changed'` in `utils/encryption.ts:16`, `api_token: 'opsimate'` in `config/config.ts:109` — centralize in config, loud startup warning on fallback.
- **Multer secrets upload** — `api/v1/secrets/router.ts:15-24` — no size limit, unsanitized `originalname`, `req.file!` throws 500 when no file attached.

## Superseded by the provider-removal epic (#783) — do NOT open

- ~~Refresh job interval mismatch (10s vs "10 minutes" log)~~ → filed independently as #787; decision 2026-08-08: keep the job, set interval to 5s + fix comment/log (note: this conflicts with removing the job in #783 — resolve when scoping the epic)
- SSH password auth ignores configured port (`sshClient.ts:60-74`)
- SSH connection leak in `connectAndListContainers` (`sshClient.ts:120-137`)
- Docker log window says 24h, fetches 1h (`sshClient.ts:190,201`)
- `timeoutPromise` never clears its timer (`sshClient.ts:398-404`)
