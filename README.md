# Vitals — Android app (Capacitor)

This turns your existing "Vitals — Patient Tracker" webpage into a real installable
Android app, using [Capacitor](https://capacitorjs.com/) to wrap the web app in a
native shell. No rewrite — your original HTML/CSS/JS lives in `www/` and now also
fixes the chart bug and adds a dark "liquid glass" theme.

## What's in this repo

```
www/                    the web app itself (fixed + dark theme + native bridge)
resources/              source icon/splash images used to generate all Android densities
scripts/prepare-www.js  bundles Chart.js + jsPDF locally so the app works fully offline
.github/workflows/      GitHub Actions pipeline that builds the APK automatically
capacitor.config.json   app id / name / web folder config
package.json            Capacitor + plugin dependencies
```

`android/` is **not** committed — it's regenerated fresh on every build (both in CI
and if you build locally), so the repo stays small and there's nothing generated to
go stale.

## Fastest path: let GitHub build the APK for you

You don't need Android Studio installed for this.

1. Create a new GitHub repo and push this project to it:
   ```bash
   git init
   git add .
   git commit -m "Vitals Android app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. Go to your repo on GitHub → the **Actions** tab. A workflow called
   **"Build Android APK"** will already be running (it also runs automatically on
   every future push to `main`, or you can click **"Run workflow"** to trigger it
   manually).
3. When it finishes (a few minutes), open that workflow run → scroll to
   **Artifacts** → download **`vitals-debug-apk`**. Unzip it to get `app-debug.apk`.
4. Copy that APK to your Android phone (or download it directly on the phone from
   the Actions page) and tap it to install. You'll need to allow "install unknown
   apps" for your browser/file manager the first time — Android will prompt you.

That's it — every time you push a change, a fresh APK is built for you.

## Building locally instead (if you have Android Studio)

```bash
npm install
npm run prepare-www        # bundles Chart.js/jsPDF locally
npx cap add android        # generates the android/ folder
npx cap sync android
npx cap open android       # opens Android Studio
```
Then just hit Run in Android Studio, or Build → Build Bundle(s)/APK(s) → Build APK(s).

## What was actually broken, and what I changed (v2)

**The PDF export bug.** `downloadPDF()` used to try to grab a live snapshot of the
on-screen Chart.js graphs (`state.bpChart.toBase64Image()`) and embed it as an image
in the report — with no error handling around that call. If the chart hadn't finished
rendering yet, or had failed to render at all, that call threw an uncaught error and
the *entire PDF export died* — no file, no toast, nothing. That's the "chart error
breaks the PDF" bug.

**The fix:** the PDF report no longer touches the charts at all. It's now built purely
from the raw reading data — patient info, then a Blood Pressure table and a Glucose
table, exactly like a lab report. Since the PDF has zero dependency on Chart.js having
rendered anything, it can no longer fail because of a chart problem. The whole export
is also now wrapped in a single try/catch, so *any* unexpected error surfaces as a
friendly toast instead of silently doing nothing.

Charts themselves are an in-app-only, interactive feature (as they should be — a
static image in a PDF can't be zoomed, tapped for tooltips, etc.). They still load
through a robust local-first, multi-CDN-fallback loader with per-graph retry buttons,
which was already in place from an earlier pass.

## The v2 "Flux" redesign

The UI has been rebuilt around a dark, glowing "liquid glass" aesthetic (default theme
is now dark instead of light):

- **Splash screen** now shows a copyright line — *"© 2026 Taimoor Hassan. All rights
  reserved."* — that fades in under the loading dots.
- **Patient avatars** got a soft ambient glow ring (blue in dark mode, purple in light)
  behind the glassy sphere silhouette, closer to the reference concept.
- **Flux Dock** replaces the old single "+" button: a floating glass panel above the
  patient list with three actions (Share/Backup, Add Patient, Quick-Log a reading) and
  a control tray underneath with:
  - a **Motion speed slider** — genuinely wired to a `--flux-mult` CSS variable that
    scales the duration of transitions across cards, buttons, sheets, and toggles, so
    "slow / normal / snappy" is a real, felt setting, not just decoration.
  - a **Dark Mode toggle** (mirrors the moon icon in the top bar).
  - a **Privacy Mode toggle** — blurs blood pressure/glucose numbers throughout the
    app; press-and-hold any blurred value to peek at it. Genuinely useful if you're
    looking at patient data somewhere semi-public.
- **Quick-Log** flow: tap the dock's middle-right icon, pick a patient (skipped
  automatically if you only have one), pick Blood Pressure or Glucose, and you're
  dropped straight into that patient's reading sheet.
- The "Normal" status chip is now a neutral tone (matching the reference), so red
  ("High") is the only color that visually shouts for attention.

## Dark mode

The app now launches in the dark "Flux" theme by default. A moon icon in the top bar
(and a matching toggle in the Flux Dock) switches to the original light "liquid glass"
look. The choice is remembered (`localStorage`) and applied before first paint so
there's no flash of the wrong theme. Charts re-render on toggle so their grid/tick
colors match.

## Downloads, PDFs, and backups inside the native app

In a plain browser, clicking "download" works because the browser has its own
downloads UI. Inside a packaged Android WebView, that trick silently does nothing —
there's no Android Download Manager hook for a blob-URL `<a download>` click. This
would have made PDF export and backup export appear completely broken once
installed as an app, even though they worked fine on the website.

`www/capacitor-bridge.js` fixes this: when running natively, PDF/backup exports are
written to the app's cache folder via the `@capacitor/filesystem` plugin and handed
to the native **Share sheet** (`@capacitor/share`) so you can save them to
Downloads, Drive, email them, etc. On the website it's unchanged — same
`<a download>` behavior as before. Backup **import** already used a plain
`<input type="file">`, which Android's WebView handles natively out of the box, so
that needed no changes.

## Changing the app name, package id, or icon

- App name / package id: edit `capacitor.config.json` (`appName`, `appId`). Do this
  *before* your first build — changing `appId` later means Android treats it as a
  different app.
- Icon / splash: replace `resources/icon.png` (1024×1024 recommended — the current
  one is upscaled from your 512×512 source, which works but a higher-res source
  will look sharper), `resources/icon-foreground.png`, `resources/icon-background.png`,
  and `resources/splash.png` / `splash-dark.png`, then re-run the workflow (or
  `npx capacitor-assets generate --android` locally).

## Publishing a signed release build (Play Store)

The workflow builds an unsigned **debug** APK, which is fine for installing on your
own device or sharing for testing, but the Play Store requires a signed **release**
build. Broad strokes:
1. Generate a keystore: `keytool -genkey -v -keystore release.keystore -alias vitals -keyalg RSA -keysize 2048 -validity 10000`
2. Add signing config to `android/app/build.gradle` (Capacitor's docs cover this:
   https://capacitorjs.com/docs/android/deploying-to-google-play)
3. Build `./gradlew bundleRelease` for an `.aab` to upload to Play Console.

Keep the keystore file and its passwords safe and out of the git repo — you'll need
the *same* keystore for every future update.

## A note on what I could and couldn't verify

I fixed the code based on a careful read of the app's logic and known Capacitor/
WebView limitations, but I wasn't able to run an actual Android build end-to-end
from here. The first GitHub Actions run is the real test — if `gradlew assembleDebug`
fails, open the failed step's log and paste it back to me and I'll fix it.
