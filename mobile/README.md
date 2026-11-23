# Nicholasfit for iPhone

The iPhone app shows the normal Nicholasfit site inside it, so every feature (and every future change to the site) is there without reinstalling. Workouts run on the app's own **native workout screen**. On top of that it adds what Safari can't do:

- **Native workout screen**: big set rows with a Previous column, haptic ticks, −/+ steppers, Easy/Good/Hard, and the dumbbell set-up counter. Swapping or adding exercises opens the full site view; **Back to workout screen** returns.
- **Full-screen rest timer** with ±15 s, Skip, how-did-it-feel buttons and what's up next. A notification buzzes when rest ends, even with the phone locked.
- **Works with no signal**: start or resume a workout with no internet. Sets save on the phone and sync when signal returns.

- **Apple Health sync**: sleep, resting heart rate, heart rate variability (HRV), steps, and rows that Concept2 ErgData saves to Health. Shown on the Progress tab, and the weekly coach uses them to judge recovery.
- **Live heart rate** from your Polar strap during a workout (under the workout title).
- **Live Concept2 rowing**: in any workout with rowing (e.g. *Easy row*) the app connects to the PM5 by Bluetooth. Your first stroke opens a full-screen view: big split, then a heart-rate pace guide (zone 2 = easy, from your birth year in the profile; amber with one buzz after 20 s above it), time, metres, stroke rate and watts. When you end the piece on the PM5 it's logged on the rowing set (distance, time, average split, stroke rate, watts, heart rate) and saved to Apple Health as a rowing workout when you tap Finish.
- **Workouts saved to Apple Health** when you tap Finish, with the strap's heart rate.
- The screen stays awake during a workout.
- **Widgets**: a *Nicholasfit* widget for the Home Screen (small or medium) and the Lock Screen (circle, rectangle or one line) showing your next workout, calories left, protein, weight trend and sessions this week. Tap it to open the app.
- **Nutrition rings widget** (small): calorie ring outside, protein ring inside. Tap it to go straight to logging a meal.
- **Rest timer on the Lock Screen and Dynamic Island** during a workout, counting down even with the phone asleep, with what's up next.

You install it from your Mac with a free Apple account. A free install lasts **7 days**; after that the app won't open until you reinstall it from the Mac (2 minutes, your data is kept). Paying for the Apple Developer Program (US$99/year) makes an install last a year.

---

## One-time setup (about an hour, mostly downloads)

### 1. Install Xcode
1. Open the **App Store** on your Mac, search **Xcode**, click **Get**. It's large (around 10 GB), so let it download.
2. Open Xcode once. Agree to the licence. If it asks which platforms to install, tick **iOS** and click **Download & Install**.
3. In Xcode's menu bar click **Xcode → Settings… → Accounts**, click **+** (bottom left), choose **Apple Account**, and sign in with your normal Apple ID. You'll see a team called "*Your Name* (Personal Team)". Close the window.

### 2. Install Node.js and CocoaPods
1. Go to <https://nodejs.org>, download the **LTS** macOS installer and run it (click Continue through it).
2. Open **Terminal** (press ⌘ Space, type *Terminal*, press Return).
3. Install Homebrew (a tool installer for Mac). Paste this line, press Return, and enter your Mac password when asked (nothing shows while you type, that's normal):
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   When it finishes it prints "Next steps" with two or three lines starting `echo` or `eval`. Copy and run those lines too.
4. Install CocoaPods (Xcode uses it to add the app's building blocks):
   ```
   brew install cocoapods
   ```

### 3. Download the app code
In Terminal, paste these lines one at a time:
```
cd ~
git clone https://github.com/nicholasmburgess/nicholasfit.git
cd nicholasfit/mobile
npm run setup
```
`npm run setup` takes a few minutes. If macOS asks to install "command line developer tools", click **Install**, wait, then run the last two lines again.

### 4. Get your iPhone ready
1. Plug your iPhone into the Mac with a cable. On the iPhone tap **Trust** and enter your passcode.
2. On the iPhone open **Settings → Privacy & Security → Developer Mode**, turn it on, and let it restart. (If you don't see Developer Mode, do step 5 first, then come back.)

### 5. Install the app
1. In Terminal (still in the `mobile` folder) run:
   ```
   xed ios
   ```
   This opens the project in Xcode.
2. In the left sidebar click the blue **Nicholasfit** icon at the top. In the middle, click the **Signing & Capabilities** tab.
3. Tick **Automatically manage signing**, and set **Team** to your "(Personal Team)".
   - If it says the bundle identifier isn't available, change **Bundle Identifier** to something unique, e.g. `com.yourname.nicholasfit2`.
4. Do the same for the widget: just left of the tabs, under **TARGETS**, click **ExpoWidgetsTarget**, then tick **Automatically manage signing** and set **Team** to your "(Personal Team)". Click **Nicholasfit** under TARGETS again afterwards.
   - Xcode sets up the shared "App Group" the app and widget use by itself. If it shows a red error about the App Group, click **Try Again**.
5. Make it a standalone build (so it works away from the Mac): menu **Product → Scheme → Edit Scheme…**, click **Run** on the left, set **Build Configuration** to **Release**, click **Close**.
6. At the top of the Xcode window, click the device name next to "Nicholasfit" and choose **your iPhone**.
7. Press the **▶ (Run)** button. The first build takes 5–10 minutes.
8. The first time, the iPhone says "Untrusted Developer". On the iPhone go to **Settings → General → VPN & Device Management**, tap your Apple ID under *Developer App*, and tap **Trust**. Then open Nicholasfit from your home screen.

### 6. First launch
1. Sign in with your usual Nicholasfit email and password.
2. Go to **Progress → Recovery · Apple Health → Connect Apple Health**. Apple's permission screen appears: tap **Turn On All** then **Allow**.
3. Allow notifications when the workout screen asks (that's the rest-timer alert).
4. Start a workout with your Polar strap on (wet the strap's contacts). Allow Bluetooth when asked. Your heart rate appears under the workout title. If the Polar app is open and connected to the strap, close it first.

### Rowing with the PM5
1. Close ErgData (the PM5 only talks to one app at a time).
2. Start **Easy row** (or any workout with rowing). Wake the PM5 by pressing any button. The rowing card says **PM5 connected** within a few seconds. If it still says *Looking for your rower* after 20 seconds, press **Connect** on the PM5's main menu.
3. Choose a workout on the PM5 as usual (Just Row is fine) and start rowing. The live view opens by itself. **Show sets** goes back to the workout; **Live view** on the rowing card returns.
4. When you're done, end the piece on the PM5 (press **Menu**). The row is logged and ticked. Tap **Finish workout**.

### 7. Add the widgets
- **Home Screen**: touch and hold an empty spot until the icons wiggle, tap **Edit** (top left) → **Add Widget**, search **Nicholasfit**, swipe through the choices (*Nicholasfit* in small or medium, then *Nutrition rings*), tap **Add Widget**, then **Done**.
- **Lock Screen**: touch and hold the Lock Screen, tap **Customize** → **Lock Screen**, tap the row of widgets under the clock, choose **Nicholasfit** and tap the circle or rectangle. Tap **Done**.
- The rest timer appears on its own when you rest during a workout. If it doesn't, check **Settings → Nicholasfit → Live Activities** is on.

The widget updates whenever you open or leave the app (for example right after logging a meal), and calories reset at midnight by themselves. A Withings weigh-in shows up the next time you open the app. Once you're happy with it you can remove the old Scriptable widget.

### 8. Exercise videos (optional, 5 minutes)
In a workout, tap an exercise name or **▶ How to** to see how it's done. With no signal it shows a photo demo saved in the app. To also get short video clips when you have signal:
1. Go to [the ExerciseDB page on RapidAPI](https://rapidapi.com/ascendapi/api/edb-with-videos-and-images-by-ascendapi), sign up (free), click **Pricing** and subscribe to **Basic** ($0).
2. Click **Apps** at the top, then your default app → **Authorization**, and copy the key.
3. In [Vercel](https://vercel.com) open **nicholasfit → Settings → Environment Variables**, add `EXERCISEDB_RAPIDAPI_KEY` with that key, and save. Then go to **Deployments**, open the menu (⋯) on the top one and choose **Redeploy**.

The free plan covers about 200 exercises with a watermark. Clips stream only and are never saved on the phone, because ExerciseDB's terms don't allow it. When there's no clip, you get the photo demo.

Optional: to reinstall over Wi-Fi instead of a cable, in Xcode open **Window → Devices and Simulators**, select your iPhone, and tick **Connect via network**.

---

## Every 7 days: reinstall (2 minutes)
1. Plug in the iPhone (or be on the same Wi-Fi if you set that up).
2. Open Xcode. It reopens the Nicholasfit project (if not: **File → Open Recent**).
3. Check your iPhone is chosen at the top, then press **▶**.

Your data lives on the server, and your sign-in is kept, so nothing is lost.

## When the app itself is updated
Most changes are to the website and appear in the app automatically. When I tell you the **iPhone app** changed, run this in Terminal, then repeat **step 5 (items 2–7)** above:
```
cd ~/nicholasfit/mobile
git pull
npm run setup
```

## Free vs paid Apple account
| | Free | Paid (US$99/yr) |
|---|---|---|
| Apple Health, Bluetooth heart rate, PM5 | ✓ | ✓ |
| How long an install lasts | 7 days | 1 year |
| Install without the Mac (TestFlight) | ✗ | ✓ |
| Push notifications sent from the server | ✗ | ✓ |
| Home Screen and Lock Screen widgets, Lock Screen rest timer | ✓ | ✓ |
| Sideloaded apps per phone | 3 (the widget may count as one) | unlimited |

---

## For developers
- Expo SDK 58, React Native, `react-native-webview` loading `https://nicholasfit.vercel.app`.
- `src/health.ts` (`@kingstinct/react-native-healthkit`) and `src/heartRate.ts` (`react-native-ble-plx`, standard Heart Rate service 0x180D).
- `src/pm5.ts`: Concept2 PM5 over BLE (Concept2's PM5 Bluetooth Smart interface: rowing service CE060030, status characteristics 0031/0032/0033/0036, summary 0039). `src/ble.ts` shares one scan between the strap and the PM5. `src/RowLive.tsx` is the live view.
- The web app talks to this shell through `src/lib/native.ts` in the site: page → native via `window.ReactNativeWebView.postMessage`, native → page via a `nicholasfit-native` CustomEvent. `window.NicholasfitNative` is set before the page loads.
- `src/WorkoutScreen.tsx` is the native workout screen; `src/store.ts` keeps workouts in AsyncStorage with an outbox that upserts to Supabase REST using the session the site hands over. Workout logic (`progression`, `adjustable`, `plan`, `new-workout`, `exercises`) is shared from the site's `src/lib` via the `@/` alias in `metro.config.js` and `tsconfig.json`.
- Bridge v2: site → native `session`, `snapshot`, `startWorkout`, `openWorkout`; native → site `workoutClosed`. Whoever holds a workout syncs it; hand-overs release the other side's outbox first.
- `ios/` is generated by `expo prebuild` and not committed. Configure native settings in `app.json`.
- Widgets and the rest-timer Live Activity use `expo-widgets` (Expo UI SwiftUI components). Layouts are in `widgets/` and run in the widget extension, so each layout function must be self-contained (no outer variables or imports beyond `@expo/ui`). `src/widgetData.ts` fills the Today widget (Supabase REST with the handed-over session, plus the local plan/history) on launch, foreground, background, snapshot and finish; `src/restActivity.ts` mirrors the workout screen's rest timer. No push: the timer counts down natively via `Text timerInterval`, and the activity goes stale at the end time.
- Set `expo.ios.appleTeamId` in `app.json` to your team ID to skip the Signing step after each `npm run setup`.
- Typecheck: `npm run typecheck`.
