# Investment Returns Dashboard

Single-page dashboard hosted on GitHub Pages. Compare stocks and ETFs by multi-period returns (1D through 10Y), mirroring the [invester-dashboard](https://github.com/colorage/invester-dashboard) Obsidian vault.

## Data updates

Market data is fetched **on GitHub Actions** during each deploy (~25–35 min for the full universe). No local machine or CORS proxy required.

Automatic refresh: **weekdays at 06:00 UTC** (GitHub-hosted cron). Also runs on every push to `main`, or manually via Actions → Run workflow.

## Live demo

After deploying: `https://colorage.github.io/investor-dashboard-site/`

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local — set VITE_YAHOO_PROXY_URL to your Cloudflare Worker URL
npm run dev
```

Dev mode loads only 5 symbols (AAPL, MSFT, SPY, VWCE.DE, PKN.WA) for quick testing.

## Cloudflare Worker proxy (required)

Yahoo Finance blocks direct browser requests (CORS). Deploy the proxy once:

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/): `npm install -g wrangler`
2. From this repo: create a minimal Worker project or copy [`proxy/worker.ts`](proxy/worker.ts)
3. Deploy: `wrangler deploy`
4. Set `VITE_YAHOO_PROXY_URL=https://your-worker.workers.dev` in `.env.local` (local) and as a GitHub Actions secret (production)

The worker accepts `GET /?symbol=AAPL` and returns Yahoo chart JSON with CORS headers.

## Build

```bash
npm run build        # generates public/universe.json + dist/
npm run preview      # preview production build locally
```

Universe symbols are built from CSV files in [`data/`](data/) (S&P 500 fallback, US ETFs, UCITS, EU stocks, WIG20, VWRA holdings).

## GitHub Pages deployment

1. Push this repo to GitHub (e.g. `colorage/investor-dashboard-site`)
2. Add repository secret `VITE_YAHOO_PROXY_URL` with your Worker URL
3. Settings → Pages → Source: **GitHub Actions**
4. Push to `main` — workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) deploys automatically

If your repo name differs from `investor-dashboard-site`, update `base` in [`vite.config.ts`](vite.config.ts).

## Dashboard sections

| Tab | Description |
|-----|-------------|
| All symbols | Full universe, sorted by 1Y return |
| Stocks | US/EU/PL stocks |
| ETFs | All ETFs |
| UCITS ETFs | EU-listed ETFs |
| Poland WIG20 | GPW stocks |
| EU stocks | European large caps |
| VWRA holdings | Top VWRA.L constituents |
| Top / Bottom 1D movers | Daily stock movers (25 each) |

Click column headers to sort. Data is cached in IndexedDB for 1 hour.

## Full universe refresh

~618 symbols are fetched in chunks of 45 with 1.5s delay between chunks (~25–35 min for a full refresh). The active tab loads first; remaining symbols prefetch in the background.

## Related project

Market data logic is ported from the Python CLI at [invester-dashboard](https://github.com/colorage/invester-dashboard), which writes an Obsidian vault with Dataview tables.
