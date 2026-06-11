# Custom domain: siaroza.com/invest (without Vercel)

## Current DNS (GoDaddy)

| Host | Type | Current value | Action |
|------|------|---------------|--------|
| `@` | A | `76.76.21.21` (Vercel) | **Remove or replace** — you no longer use Vercel |
| `www` | CNAME | `cname.super.so` | Keep if your site is on Super.so |

GoDaddy cannot route a **path** like `/invest` by DNS alone. You need either a **subdomain** or a **proxy** (e.g. Cloudflare).

---

## Option A — Easiest: `invest.siaroza.com` (GoDaddy only)

No Vercel, no Cloudflare. Works with GitHub Pages directly.

### GoDaddy → DNS → Add record

| Type | Name | Value | TTL |
|------|------|-------|-----|
| **CNAME** | `invest` | `colorage.github.io` | 1 hour |

### GitHub

Repo **Settings → Pages → Custom domain:** `invest.siaroza.com` → Save → Enforce HTTPS

### Dashboard repo

Set `vite.config.ts` `base` to `'/'` (not `/invest/`).

**Result:** https://invest.siaroza.com

---

## Option B — Keep `siaroza.com/invest` (needs Cloudflare)

Use this if the URL must stay `siaroza.com/invest`.

### 1. GoDaddy — point domain to Cloudflare

- Create free account at [cloudflare.com](https://cloudflare.com)
- Add site `siaroza.com`
- Cloudflare gives you two nameservers (e.g. `ada.ns.cloudflare.com`)
- GoDaddy → **Domain → Nameservers → Change → Custom** → paste Cloudflare NS

### 2. Cloudflare DNS

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `www` | `cname.super.so` | DNS only (grey cloud) if Super.so requires it |
| A or CNAME | `@` | your main site target | as needed |

### 3. Cloudflare Redirect / Rewrite rule

**Rules → Redirect Rules** (or **Bulk Redirects**):

- If URL path starts with `/invest` → rewrite/proxy to  
  `https://colorage.github.io/investor-dashboard-site/$1`

Or use a **Worker** to proxy `/invest/*` → GitHub Pages (same idea as the old Vercel `vercel.json`).

### 4. Dashboard repo

Keep `vite.config.ts` `base: '/invest/'` (already set).

**Result:** https://siaroza.com/invest/

---

## Option C — Redirect only (simple, URL changes)

GoDaddy **Domain Forwarding** or Super.so redirect:

`siaroza.com/invest` → `https://colorage.github.io/investor-dashboard-site/`

Browser URL will **leave** siaroza.com (not ideal, but zero infra).

---

## Recommendation

| Goal | Setup |
|------|--------|
| Minimal hassle | **Option A** — `invest.siaroza.com` + one GoDaddy CNAME |
| Must use `/invest` path | **Option B** — Cloudflare in front of GoDaddy |
| Quick test | Keep using https://colorage.github.io/investor-dashboard-site/ |

After you pick A or B, the dashboard `base` path in Vite can be aligned and redeployed.
