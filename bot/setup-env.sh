#!/bin/bash
# Asks for the bot settings and writes bot/.env, readable by its owner only.
# Tokens are read from a hidden prompt, so they stay out of shell history.
set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")" && pwd)/.env"

ask() {
  local answer
  read -r -p "$1: " answer
  [ -n "$answer" ] || { echo "Value required: $1" >&2; exit 1; }
  printf '%s' "$answer"
}

ask_secret() {
  local answer
  read -r -s -p "$1 (hidden): " answer
  echo >&2
  [ -n "$answer" ] || { echo "Value required: $1" >&2; exit 1; }
  printf '%s' "$answer"
}

if [ -e "$ENV_FILE" ]; then
  read -r -p "$ENV_FILE exists. Replace it? [y/N] " replace
  [ "$replace" = "y" ] || { echo "Kept the existing file."; exit 0; }
fi

guild_id="$(ask 'Discord server ID')"
channel_id="$(ask 'Discord channel ID')"
owner_id="$(ask 'Your Discord user ID')"
data_owner="$(ask 'GitHub account that owns the data repo')"
data_repo="$(ask 'Data repo name (for example car-service-data)')"
bot_token="$(ask_secret 'Discord bot token')"
github_token="$(ask_secret 'GitHub fine-grained token')"

umask 077
cat > "$ENV_FILE" <<EOF
DISCORD_GUILD_ID=$guild_id
DISCORD_CHANNEL_ID=$channel_id
DISCORD_OWNER_ID=$owner_id
DATA_OWNER=$data_owner
DATA_REPO=$data_repo
DISCORD_BOT_TOKEN=$bot_token
GITHUB_TOKEN=$github_token
EOF
chmod 600 "$ENV_FILE"
echo "Wrote $ENV_FILE"
