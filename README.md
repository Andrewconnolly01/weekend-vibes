# Weekend Vibes 2.0

Plan your weekend tasks and activities around the weather, with flagged Hotmail emails and two-way Outlook calendar sync.

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The app's page and styling |
| `app.js` | Everything the app does |
| `config.js` | Your settings — this is the only file you edit |
| `manifest.json` | Lets the iPhone install it as a home-screen app |
| `sw.js` | Keeps the app working offline |
| `msal-browser.min.js` | Microsoft's official sign-in library (v2.38.3) |
| `icons/` | App icons |

## Before you start

This is a fresh build. It does not read the tasks stored by your old Weekend Vibes. To keep them, open the old app and export your list before you install this one.

Without Outlook set up, the app still works fully: tasks, activities, weather, recurring tasks and exports. Steps 3 and 4 only add the Outlook features.

---

## Step 1 — Put the app online with GitHub Pages (free, about 10 minutes)

Microsoft sign-in only works from a proper web address, so the app needs hosting.

1. Create a free account at https://github.com if you don't have one.
2. Click **New repository**. Name it `weekend-vibes`, set it to **Public**, and click **Create repository**.
3. Click **uploading an existing file**. Drag in **everything inside this folder**, including the `icons` folder, then click **Commit changes**.
4. Go to the repository's **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then click **Save**.
5. After a minute or two, the page shows your address, for example `https://yourname.github.io/weekend-vibes/`. Write it down exactly, including the final `/`.

## Step 2 — Install it on your iPhone

1. If the old Weekend Vibes is on your home screen, press and hold it, then remove it.
2. Open your GitHub Pages address in **Safari**.
3. Tap **Share**, then **Add to Home Screen**, then **Add**.

The app now works, without Outlook. Steps 3 and 4 connect Outlook.

## Step 3 — Register the app with Microsoft (free, about 10 minutes)

1. Go to https://portal.azure.com and sign in with your **Hotmail / Outlook.com** account.
   - If Microsoft asks you to set up a directory or free account first, follow its prompts. Microsoft changes this screen from time to time.
2. Search for **App registrations** and click **New registration**.
   - **Name:** `Weekend Vibes`
   - **Supported account types:** *Personal Microsoft accounts only*
   - **Redirect URI:** choose **Single-page application (SPA)**, then paste your GitHub Pages address exactly as written in Step 1, including the final `/`.
   - Click **Register**.
3. On the overview page, copy the **Application (client) ID**. It looks like `1a2b3c4d-....`.
4. Go to **API permissions → Add a permission → Microsoft Graph → Delegated permissions**. Tick **Mail.ReadWrite** and **Calendars.ReadWrite**, then click **Add permissions**. **User.Read** is already there. Personal accounts don't need admin consent.

## Step 4 — Add your ID and connect

1. On GitHub, open `config.js` in your repository and click the pencil icon to edit it.
2. Paste your ID between the quotes: `clientId: '1a2b3c4d-....',`
3. Click **Commit changes**. Wait a minute for GitHub to publish the change.
4. On your iPhone, fully close Weekend Vibes and reopen it. It updates itself in the background, so you may need to close and reopen it a second time.
5. Tap **Connect Outlook**, sign in, and accept the permissions.

---

## How it works

### Tasks

Each task can have:

- a due date and an optional time
- a duration
- a priority: High, Normal or Whenever
- a setting: Outdoor, Indoor or Anywhere
- a repeat: every weekend, weekly, fortnightly or monthly
- notes

Tap a task to edit it. When you tick off a repeating task, it moves to its next date.

### Activities

Activities are the fun side of the weekend. Each one has a day, a time of day and a setting, and sits in **Weekend plans**.

### Weather

The forecast comes from Open-Meteo, which is free and needs no account. It uses your phone's location, or a town you set in **Settings**.

Outdoor tasks and activities get a warning when the rain chance or wind passes your limits. Both limits are adjustable in Settings. The warning includes a button to move the item to a drier slot.

### Flagged emails

Flag an email in Outlook and it appears as a task. Ticking the task off marks the flag complete in Outlook. Clearing a flag in Outlook ticks the task off in the app.

### Calendar, app to Outlook

Tasks with **Add to Hotmail calendar** switched on become events, tagged with the **Weekend Vibes** category and including your chosen reminder. A task with no time becomes an all-day event.

When you move a task, the event moves. When you complete it, the event is marked "Done:". When you delete it, the event is removed.

### Calendar, Outlook to app

If you move, retime, resize or rename a Weekend Vibes event in Outlook, the task updates.

If you delete the event, the task is kept and simply unlinked. Open the task and switch the calendar back on to restore it.

Any event you create in Outlook with the **Weekend Vibes** category becomes a task.

### When it syncs

The app syncs each time you open it and when you tap the refresh button. The button turns amber when there are changes waiting to go up. After a sync, a purple card lists everything that changed.

If the same task was edited in both places between syncs, the most recent edit wins.

### Reminders

Calendar reminders come through iOS once your Hotmail account is added to the iPhone's Calendar or Outlook app. That gives you notifications even when Weekend Vibes is closed.

### Shortcuts

When using a keyboard: **N** adds a task, **A** adds an activity, **R** syncs, and **Esc** closes a panel.

## Privacy

Tasks and settings are stored only on your phone. Outlook data goes directly between your phone and Microsoft. The app reads only flagged emails and events tagged Weekend Vibes. You can disconnect at any time in **Settings**.

## Troubleshooting

**"AADSTS50011" or "redirect URI mismatch"**
The address in Azure must exactly match the one you open the app from, including `https://` and the final `/`.

**Sign-in goes round in a loop from the home-screen app**
Home-screen apps on iPhone sometimes mishandle sign-in redirects. Try the following in order:

1. Open the same address in Safari and connect there to confirm the setup works.
2. Remove the home-screen icon and add it again from Safari.
3. Connect from the home-screen app.

**Changes don't appear**
Tap the refresh button. Calendar sync looks from a week ago to four months ahead.

**The forecast doesn't load**
Check location access for Safari in iPhone Settings, or set a town in the app's Settings.

**The app doesn't update after you change files on GitHub**
Fully close the app and reopen it twice.
