#!/bin/sh
# One-time root setup for an Ubuntu laptop/mini-PC as Tempo home server.
# Usage: sudo sh infra/homeserver-setup.sh <user>
# Installs Docker + Tailscale, keeps the machine awake with the lid closed.
set -eu
USER_NAME="${1:?usage: sudo sh homeserver-setup.sh <user>}"

# Docker (official convenience script) + run without sudo
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$USER_NAME"
systemctl enable --now docker

# Tailscale: private HTTPS access from phone/laptop, no router ports
if ! command -v tailscale >/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
systemctl enable --now tailscaled
tailscale set --operator="$USER_NAME" 2>/dev/null || true

# Server behaviour: ignore lid, never sleep
mkdir -p /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/10-server.conf <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
EOF
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
# lid setting applies after the next reboot (restarting logind would end the desktop session)

# Deploy directory
mkdir -p /opt/tempo
chown "$USER_NAME":"$USER_NAME" /opt/tempo

echo
echo "Done. Next: run 'tailscale up' and open the login link it prints."
