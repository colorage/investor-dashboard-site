#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.local/node/bin:${PATH}"
cd "$ROOT"
npm run build:static
cd dist
git init -q
git checkout -B gh-pages
git add -A
git commit -q -m "Deploy dashboard to GitHub Pages"
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/colorage/investor-dashboard-site.git"
git push -f origin gh-pages
echo "Deployed: https://colorage.github.io/investor-dashboard-site/"
