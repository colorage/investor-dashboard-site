# Custom domain: siaroza.com/invest

`siaroza.com` DNS (GoDaddy) already points to **Vercel**. Path routing is configured in **Vercel**, not GoDaddy.

## GoDaddy

**No changes needed** for `/invest`. Keep existing records:

| Host | Type | Value |
|------|------|-------|
| `@` | A | `76.76.21.21` (Vercel) |
| `www` | CNAME | your existing target (e.g. Super.so) |

Do **not** add a CNAME for `/invest` — DNS has no path concept.

## Vercel (siaroza.com project)

In the Vercel project that owns `siaroza.com`, add `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/invest",
      "destination": "https://colorage.github.io/investor-dashboard-site/index.html"
    },
    {
      "source": "/invest/",
      "destination": "https://colorage.github.io/investor-dashboard-site/index.html"
    },
    {
      "source": "/invest/:path*",
      "destination": "https://colorage.github.io/investor-dashboard-site/:path*"
    }
  ]
}
```

Redeploy the Vercel project after adding this file.

If `siaroza.com` currently shows a Vercel 404, attach any project to the domain first (even a minimal repo), then add the rewrites.

## Dashboard repo

This site is built with `base: "/invest/"` so assets load from `siaroza.com/invest/assets/...`.

GitHub Pages URL (origin): https://colorage.github.io/investor-dashboard-site/  
Public URL (after Vercel rewrites): https://siaroza.com/invest/
