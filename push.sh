#!/usr/bin/env bash
# Push E Don Do to a GitHub repo you have already created (empty, no README).
#
#   chmod +x push.sh
#   ./push.sh https://github.com/YOUR-USERNAME/edondo.git
#
set -euo pipefail

REMOTE="${1:-}"
if [ -z "$REMOTE" ]; then
  echo "Usage: ./push.sh <your-repo-url>"
  echo "Example: ./push.sh https://github.com/dan/edondo.git"
  exit 1
fi

cd "$(dirname "$0")"

if [ ! -f index.html ]; then
  echo "Run this from inside the unzipped 'reclaim' folder (index.html not found here)."
  exit 1
fi

if [ ! -d .git ]; then
  git init -q
  echo "Initialised a new repo."
fi

if ! git config user.email >/dev/null 2>&1; then
  echo "Git has no identity configured on this machine. Setting one for this repo only."
  read -rp "  Your name:  " GITNAME
  read -rp "  Your email: " GITMAIL
  git config user.name "$GITNAME"
  git config user.email "$GITMAIL"
fi

git add -A
git commit -qm "E Don Do: offline cannabis recovery tracker" || echo "Nothing new to commit."

git branch -M main

if git remote | grep -qx origin; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

echo "Pushing to $REMOTE ..."
git push -u origin main

echo
echo "Done. Next:"
echo "  Netlify  -> app.netlify.com -> Add new site -> Import from Git -> pick this repo"
echo "  Vercel   -> vercel.com/new -> Import -> pick this repo"
echo "  Build command: leave empty.  Publish directory: ."
