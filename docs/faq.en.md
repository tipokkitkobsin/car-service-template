# Frequently asked questions

[ภาษาไทย](faq.md)

**"Data repo not found, or the token has no access"**
Check, in order:
1. the account and repository names on the connect page
2. the token's Repository access includes the data repository
3. Contents is set to Read and write

**"The GitHub token does not work"**
The token has expired or was deleted. Make a new one (README step 4) and connect again.

**I set up the car wrong and want to start over**
Either:
- edit the car name, delivery date and items in Settings > Manage car and items, or
- start from scratch: delete `data/car.json` in the data repository and open the site again.
  The first-run setup appears again. Everything you logged is lost.

**I cannot delete an item**
Items with visit history cannot be deleted, so the history stays correct. If you no longer use one,
change its reminder type to "Track age only".

**Which reminder type fits which item?**
- By km or months: engine oil, filters, spark plugs, gearbox oil (due at whichever comes first)
- By days: battery (a soft reminder, since battery life varies)
- Every year in a set month: cabin filter, road tax
- Track age only: tyres, brake pads, shock absorbers (shows how many km and years they have done)
- Event: mods, accidents, repairs (shown on the timeline)

**Does changing the language translate my items?**
No. Names you typed, and the starter items created at setup, stay as they were saved. Rename them in
Settings > Manage car and items if you like.

**How do I back up?**
Your data is on GitHub, which keeps every change. For a file copy, press Settings > Download backup.

**Can I use several devices?**
Yes. Open the site and enter a token on each one. The data is the same everywhere.

**I have two cars**
Make a second data repository, e.g. `car-service-data-2`, and a token that covers both.
When connecting, enter the repository of the car you want to see.

**The template has a new version. How do I update?**
A repository made from a template does not update on its own. Copy the `web/` folder from the template over yours.
Your car data is safe: it lives in the separate data repository.
