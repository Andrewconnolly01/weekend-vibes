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

Without Outlook set up, the app still works fully: tasks, activities, weather, recurring tasks and exports. Steps 3 to 6 only add the Outlook features.

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

The app now works, without Outlook. Steps 3 to 6 connect Outlook.

## Step 3 — Create a free Microsoft directory (about 10 minutes, once only)

Since June 2024, Microsoft only lets apps be registered inside a "directory". A Hotmail account doesn't come with one, but a free Azure account does. This step is easier on a computer than on a phone.

1. Go to **https://azure.microsoft.com/free** and click **Try Azure for free** (sometimes labelled **Start free**).
2. Sign in with your **Hotmail / Outlook.com** account.
3. Fill in your profile:
   - Country/region: **New Zealand**
   - Your name, and a mobile number for a text verification code
4. Enter a **credit or debit card**. Prepaid cards aren't accepted.
   - This only verifies your identity. You might see a small temporary authorisation hold, which disappears.
   - You are **not charged** unless you choose to upgrade to pay-as-you-go later. Don't upgrade.
5. Agree to the terms and click **Sign up**. When the Azure portal opens, this step is done.

What happens after 30 days: the free Azure credit expires, and Microsoft emails asking you to upgrade. Ignore those emails. Your directory and the app registration stay, are free, and keep working.

## Step 4 — Register Weekend Vibes (about 5 minutes)

1. Go to **https://entra.microsoft.com** and sign in with your Hotmail account.
   - The top-right corner should show **Default Directory**. If it doesn't, click your account picture, then **Switch directory**, and choose it.
2. In the left menu, open **Entra ID → App registrations**, then click **New registration**.
3. Fill in the form:
   - **Name:** `Weekend Vibes`
   - **Supported account types:** choose **Personal Microsoft accounts only**. If that option isn't listed, choose **Accounts in any organizational directory and personal Microsoft accounts**.
     - Do **not** choose "this organizational directory only". Hotmail can't sign in with that option.
   - **Redirect URI:** in the dropdown, pick **Single-page application (SPA)**, not "Web". Paste your GitHub Pages address from Step 1 exactly, including `https://` and the final `/`.
4. Click **Register**.
5. On the overview page that opens, copy the **Application (client) ID**.
   - Ignore "Directory (tenant) ID" and "Object ID". They look similar but won't work.
6. Click **API permissions → Add a permission → Microsoft Graph → Delegated permissions**.
   - Search for and tick **Mail.ReadWrite**.
   - Search for and tick **Calendars.ReadWrite**.
   - Search for and tick **Tasks.ReadWrite**. This is for your Microsoft To Do lists.
   - Click **Add permissions**. **User.Read** is already in the list.
   - Ignore **Grant admin consent**. You don't need it, because you approve the permissions yourself when you sign in.
7. Click **Authentication** and check that your address is listed under **Single-page application**.
   - Leave the "Access tokens" and "ID tokens" boxes **unticked**.

## Step 5 — Add your ID to the app

1. On GitHub, open your `weekend-vibes` repository and click `config.js`.
2. Click the pencil icon to edit it.
3. Paste your ID between the quotes, so the line reads `clientId: '1a2b3c4d-…',`. Keep the quotes and the comma.
4. Click **Commit changes**.
5. Open the repository's **Actions** tab and wait for the green tick, usually about a minute.

## Step 6 — Connect on your iPhone

1. Fully close Weekend Vibes by swiping it away, then reopen it. Do this twice so it picks up the new settings.
2. Tap **Connect Outlook** and sign in with your Hotmail account.
3. Microsoft shows a permissions screen, and may label the app **unverified**.
   - That's expected for a personal app you registered yourself.
   - It asks to read and write your mail. Write access is only used to mark flags complete when you tick off a task.
4. Tap **Accept**. You return to the app, connected.

**Check it works:**

1. Flag an email in Outlook, then tap refresh in the app. The email should appear as a task.
2. Add a task with a time and **Add to Hotmail calendar** switched on. It should appear in your Outlook calendar within a few seconds.

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

### Microsoft To Do

Tasks from all your To Do lists come into the app. Each one is labelled with its list name, and the **From To Do** filter shows only these tasks. To Do's automatic "Flagged email" list is skipped, because those emails already come in as flagged-email tasks.

Changes sync both ways:

- **Ticking off.** Ticking a task in the app completes it in To Do, and completing it in To Do ticks it off in the app.
- **Editing.** Changes to the name, due date, priority (High, Normal and Whenever match To Do's high, normal and low importance) or notes in either place carry across.
- **New tasks.** Tasks you add in To Do appear in the app at the next sync.
- **Deleting.** Deleting a To Do task in the app also deletes it in To Do.

You can turn To Do syncing off in **Settings**.

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

Tasks and settings are stored only on your phone. Outlook data goes directly between your phone and Microsoft. The app reads only your To Do lists, flagged emails and events tagged Weekend Vibes. You can disconnect at any time in **Settings**.

## Troubleshooting

**"AADSTS50011" or "redirect URI mismatch"**
The address in Entra must exactly match the one you open the app from, including `https://` and the final `/`. Fix it under **App registrations → Weekend Vibes → Authentication**.

**"unauthorized_client" or "not enabled for consumers"**
The supported account type is set to your directory only. In **App registrations → Weekend Vibes → Manifest**, make these changes, then click **Save**:
1. Change `"signInAudience"` to `"AzureADandPersonalMicrosoftAccount"`.
2. Make sure `"requestedAccessTokenVersion"` (or `"accessTokenAcceptedVersion"`) is `2`.

**"AADSTS700016: application not found"**
The ID in `config.js` is wrong. Recheck that you copied the **Application (client) ID**, not the tenant ID.

**"AADSTS9002326" or "cross-origin token redemption"**
The redirect address was added as **Web** instead of **Single-page application**. Under **Authentication**, delete the Web entry and add the address again as **Single-page application**.

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
