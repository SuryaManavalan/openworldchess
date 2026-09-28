#!/usr/bin/env bash
# Build the client and ship the app to the Lightsail box, then restart services.
# Usage: deploy/deploy.sh [host]   (default: the static IP)
set -euo pipefail
HOST=${1:-98.88.175.192}
KEY=${KEY:-~/.ssh/owc_lightsail}
# CI pins the host (STRICT=yes, with its known_hosts); locally a first connection is accepted.
SSH="ssh -i $KEY -o StrictHostKeyChecking=${STRICT:-accept-new} ubuntu@$HOST"
cd "$(dirname "$0")/.."
pnpm --filter @owc/client build
rsync -az --delete -e "ssh -i $KEY -o StrictHostKeyChecking=${STRICT:-accept-new}" \
  --exclude node_modules --exclude .git --exclude data --exclude 'art/out' --exclude 'packages/worldgen/sim/out' \
  ./ ubuntu@$HOST:/tmp/owc-app/
$SSH 'set -e
sudo rsync -a --delete --exclude node_modules /tmp/owc-app/ /opt/owc/app/
sudo chown -R owc:owc /opt/owc/app
cd /opt/owc/app && sudo -u owc -H pnpm install --frozen-lockfile --prod --config.confirmModulesPurge=false >/dev/null
sudo cp deploy/owc-server.service deploy/owc-bots.service /etc/systemd/system/
sudo mkdir -p /etc/owc && sudo touch /etc/owc/env && sudo chmod 600 /etc/owc/env
sudo systemctl daemon-reload
sudo systemctl enable --now owc-server owc-bots >/dev/null 2>&1
sudo systemctl restart owc-server && sleep 2 && sudo systemctl restart owc-bots
systemctl is-active owc-server owc-bots
# The server warms up its world before it listens: wait for it (up to 2 minutes) rather than
# failing on the first try.
for i in $(seq 1 60); do curl -sf localhost/health && exit 0; sleep 2; done
echo "server did not come up"; exit 1'
