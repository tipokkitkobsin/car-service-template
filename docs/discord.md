# Discord reminders (optional)

[ภาษาไทย](discord.th.md)

When turned on, GitHub checks your items every morning at 09:00 (Bangkok time). If something is due soon or overdue,
it posts to the Discord channel you choose. If no odometer reading has been logged for 30 days, it asks for one.
Messages use the language set in the app's Settings.

No computer needs to stay on: this runs on free GitHub Actions.

## 1. Create a Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), press **New Application** and name it, e.g. `Car service`.
2. In **Bot** on the left, press **Reset Token** and copy the token for step 3.
3. In **OAuth2** > **URL Generator**:
   - Scopes: tick `bot` and `applications.commands`
   - Bot Permissions: tick `View Channels` and `Send Messages`
4. Copy the link at the bottom, open it in a browser and choose your server.

## 2. Find the channel ID

1. In Discord, open User Settings > Advanced and turn on **Developer Mode**.
2. Right-click the channel for reminders and press **Copy Channel ID**.

## 3. Add the values in GitHub

GitHub Actions needs its own token to read your car data. Create it like step 4 of the README:
name it `car-service-actions`, select only the data repository, and give Contents: Read and write.

In the **website** repository (not the data repository), open **Settings** > **Secrets and variables** > **Actions**.

On the **Secrets** tab, press **New repository secret** for each:

| Name | Value |
|---|---|
| `DATA_TOKEN` | the GitHub token `car-service-actions` |
| `DISCORD_BOT_TOKEN` | the bot token from step 1 |
| `DISCORD_CHANNEL_ID` | the channel ID from step 2 |

On the **Variables** tab, press **New repository variable**:

| Name | Value |
|---|---|
| `REMINDERS_ENABLED` | `true` |
| `DATA_REPO` | your data repository name, if it is not `car-service-data` |

## 4. Test it

1. **Actions** tab > **Daily reminder** > **Run workflow**.
2. Tick **Send one test message only** and press **Run workflow**.
3. The Discord channel should get a test message.

If not, open the failed run to see why. Common causes:
- a secret name is misspelled
- the bot cannot post in that channel
- a token has expired

To turn reminders off, set `REMINDERS_ENABLED` to `false`.

### If reminders stop on their own

GitHub pauses scheduled workflows in a public repository after 60 days without any change, and emails you first.
If that happens, open **Actions** > **Daily reminder** and press **Enable workflow**.
Or change any file in the website repository, such as a note in the README, before the 60 days are up.

---

# Odometer bot in Discord (optional, needs an always-on machine)

Use `/km 85000` to log the odometer and `/status` to see what is due, right in Discord.
You need a machine that runs Docker and stays on: a NAS (Synology, QNAP), a Raspberry Pi, or a VPS.
The bot only connects out to Discord and GitHub, so no port needs to be opened.

You can reuse the bot from step 1. You also need:
- the server ID: right-click the server name, then Copy Server ID
- your user ID: right-click your own name, then Copy User ID
- a GitHub token with access to the data repository: make a new one named `car-service-bot`

The bot only answers you, and only in the channel you set.

On the machine that will run the bot (replace `<your-account>` and the repository name with yours):

```bash
curl -L https://github.com/<your-account>/car-service/archive/refs/heads/main.tar.gz | tar xz
```

```bash
cd car-service-main/bot && bash setup-env.sh
```

`setup-env.sh` asks for each value. Tokens are typed hidden and stay out of the shell history. Then run:

```bash
sudo docker compose up -d --build
```

Check that it runs:

```bash
sudo docker logs --tail 5 car-service-bot
```

You should see `Bot ready`.

Never share `bot/.env`: it holds your tokens.
