# Security Minimal-Impact Upgrade Checklist

## Scope
- Project: `Momentography`
- Goal: first eliminate `critical` / most exposed `high` items with minimal functional change.
- Strategy: patch-level or minor-safe upgrades first, then controlled major where required.

## Current Risk Snapshot (from `npm audit`)
- Vulnerabilities: `critical=3`, `high=14`, `moderate=2`, `low=2`.
- Critical packages observed:
  - `next@15.2.1`
  - `swiper@11.2.5`
  - `vm2` via `proxy-agent -> pac-resolver -> degenerator` chain

## Proven Minimal Upgrade Set (validated in temp sandbox)
These upgrades were test-built successfully:
- `next: 15.2.1 -> 15.5.12`
- `swiper: 11.2.5 -> 12.1.2`
- `proxy-agent: 5.0.0 -> 6.5.0`
- `js-yaml: 4.1.0 -> 4.1.1`
- `react/react-dom: 19.0.0 -> 19.2.4` (optional but recommended patch update)

After this set, audit criticals were removed in sandbox (`npm audit --omit=dev`).

## Phase 0: Backup (mandatory)
```bash
cd /path/to/Momentography
cp package.json package.json.bak.$(date +%F_%H%M%S)
cp package-lock.json package-lock.json.bak.$(date +%F_%H%M%S)
```

## Phase 1: Apply Minimal Upgrade Set
```bash
cd /path/to/Momentography
npm install \
  next@15.5.12 \
  swiper@12.1.2 \
  proxy-agent@6.5.0 \
  js-yaml@4.1.1 \
  react@19.2.4 \
  react-dom@19.2.4
```

## Phase 2: Build + Security Gate
```bash
npm audit --omit=dev
npm run build
```
Acceptance gate:
- Build must pass.
- `critical` must be `0`.
- Any remaining `high` must be documented with compensating controls.

## Phase 3: Runtime Smoke Test
```bash
npm run start -- --port 3001 --hostname 0.0.0.0
```
Verify:
- `/` loads normally
- `/login` works
- `/admin` auth flow works
- Photo list / album list / map / webhook endpoints behave as expected

## Phase 4: Deploy (PM2 example)
```bash
# on server
cd /opt/1panel/www/sites/photo.icecms.cn/program/Momentography
npm ci
npm run build
pm2 restart momentphotos
pm2 save
curl -I http://127.0.0.1:3001/
```

## Residual Risk Notes (important)
- `qiniu -> urllib` chain may still produce `high` advisories (proxy/pac parsing path) depending on lock resolution.
- If these remain after Phase 1:
  - Keep outbound egress restricted (deny unknown destinations).
  - Do not set untrusted proxy env (`HTTP_PROXY/HTTPS_PROXY/ALL_PROXY`).
  - Track qiniu SDK updates and re-audit each release window.

## Rollback Plan
If build or runtime fails:
```bash
cd /path/to/Momentography
cp package.json.bak.<timestamp> package.json
cp package-lock.json.bak.<timestamp> package-lock.json
rm -rf node_modules .next
npm ci
npm run build
pm2 restart momentphotos
```

## Recommended Follow-up (non-blocking for this phase)
- Add auth guard for sensitive admin APIs (not just `/admin` page route guard).
- Rotate all leaked credentials immediately.
- Rebuild on clean host if compromise scope is uncertain.
