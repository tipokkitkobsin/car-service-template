# Car service: your own maintenance log

[ภาษาไทย](README.th.md)

A web app to log garage visits and odometer readings, and to remind you when oil, filters, spark plugs, tyres,
the battery and more are due. Works for any make and model. Free.

- See every item at a glance: overdue, due soon or OK
- Log visits, several shops per service round, with cost, brand and notes
- A timeline of the car's life, lifespans of tyres, brake pads and batteries, and an odometer chart
- Add, edit or remove items in the app, no coding
- Optional daily reminders in Discord
- Thai or English: switch any time in Settings

Your car data stays private in your own GitHub account.

## What you need

- A free GitHub account ([sign up](https://github.com/signup))
- About 20 minutes for the first setup
- A computer for the setup; after that, your phone is enough

The app uses two repositories:

| Repository | Visibility | Holds |
|---|---|---|
| `car-service` (any name) | Public | The website, copied from this template |
| `car-service-data` | **Private** | Your car data |

The website must be public because free GitHub Pages only serves public repositories.
Your data lives in a separate private repository, so nobody else can see it.

## Step 1: Create the site from this template

1. Press the green **Use this template** button at the top of this page, then **Create a new repository**.
2. **Repository name**: `car-service`, or any name. It becomes part of your site's address.
3. Choose **Public**, then press **Create repository**.

## Step 2: Turn on GitHub Pages

1. In the new repository, open **Settings**, then **Pages** in the left menu.
2. Under Build and deployment, set **Source** to **GitHub Actions**.
3. Open the **Actions** tab, choose **Test and deploy** on the left, press **Run workflow**, then **Run workflow** again.
4. Wait 1-2 minutes for a green tick.

Your site is now at `https://<your-account>.github.io/car-service/`.

A workflow may have run on its own when the repository was created and shown a red cross, because Pages was not on yet.
That is fine: run it again as in item 3. If it still fails, check that item 2 is set to GitHub Actions.

## Step 3: Create the private data repository

1. Go to [github.com/new](https://github.com/new).
2. **Repository name**: `car-service-data`.
3. Choose **Private**. This matters: it keeps your car data hidden.
4. Turn on **Add a README file** (or Add README).
5. Press **Create repository**.

Add nothing else. The site creates the data file in step 5.

## Step 4: Create a key (token) for the site

A token is a key that only opens your data repository.

1. Open [new fine-grained token](https://github.com/settings/personal-access-tokens/new)
   (or account Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token).
2. **Token name**: `car-service-web`.
3. **Expiration**: 1 year is a good choice. Note the date: make a new token before it expires.
4. **Repository access**: **Only select repositories**, then pick `car-service-data` only.
5. **Permissions** > **Repository permissions** > **Contents**: **Read and write**
   (Metadata: Read-only is added automatically).
6. Press **Generate token** and copy the token that starts with `github_pat_`.

The token is shown only once. To keep it, store it in a password manager.

> **Never send the token in a chat, email, issue or file.** Anyone who has it can change your car data.
> Paste it in only two places: the connect page of your own site, and GitHub Secrets (for reminders).

## Step 5: Connect and set up your car

1. Open `https://<your-account>.github.io/car-service/`.
2. **GitHub account** is filled in for you. Check that it is your account name.
3. **Data repo**: `car-service-data` (or the name from step 3).
4. Paste the token and press **Connect**.
5. **Set up your car** appears. Fill in:
   - Car name, e.g. `Toyota Yaris 1.2 white`
   - Delivery date (for a used car, the first registration date)
   - Current odometer
   - Service interval in km and months, from your service book. Many cars use 10,000 km or 6 months.
   - Automatic or manual gearbox
6. Tick the items to track. If you remember when one was last done, open **Last done** and enter the date and odometer.
   Items left blank count from today.
7. Press **Create car data**.

On a personal device, tick **Remember on this personal device** when connecting, so you do not need the token each time.

The starter intervals are typical values. **Check them against your car's service book** and change them in
Settings > Manage car and items.

## Everyday use

| To | Go to |
|---|---|
| See what is due | **Overview** |
| Log the odometer | **Overview**, Today's odometer (once a month is enough; the app estimates in between) |
| Log a visit | **Log**: date, odometer, work done, shop and cost |
| Fix or delete a mistake | **History**, then tap the entry |
| See the car's whole story | **Timeline** |
| Add an item or change an interval | **Settings** > **Manage car and items** |
| Change the language | **Settings** > Language (also used for Discord messages) |

Install it as an app:
- iPhone: open in Safari, then Share > Add to Home Screen
- Android: open in Chrome, then menu > Install app

## Extras (optional)

- [Daily Discord reminders and an odometer bot](docs/discord.md)
- [Frequently asked questions](docs/faq.md)

## Security

- Keep the data repository **Private**.
- The token only reaches the data repository, and only its contents.
- The token stays in your browser and is cleared when the browser closes, unless you tick remember.
  The site sends it nowhere except `api.github.com`.
- If you think a token has leaked, delete it on the [Fine-grained tokens](https://github.com/settings/personal-access-tokens) page and make a new one.

## For developers

Node.js 22 or later. The website has no dependencies.

```bash
npm test
```

```bash
npm run serve
```

- `web/`: the site (plain ES modules). `web/core/` holds the schedule logic shared with the notifier and the bot.
- `web/core/i18n.js` and `web/core/lang/en.js`: Thai is the source text; English is keyed by the Thai text.
  The tests fail if any text in the code has no English translation.
- `web/core/starter-items.js`: the items offered on first setup.
- `notifier/`: the daily reminder job, run by `.github/workflows/remind.yml`.
- `bot/`: Discord bot for `/km` and `/status`, run in Docker.
