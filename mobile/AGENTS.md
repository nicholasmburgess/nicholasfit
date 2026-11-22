# Nicholasfit iPhone app

Expo (SDK 58) shell around the Nicholasfit website. Keep UI in the website (`../src`); this app only adds native features the site can't reach (Apple Health, Bluetooth) and exposes them over the bridge in `../src/lib/native.ts`.

- Expo changes every SDK. Check https://docs.expo.dev/versions/v58.0.0/ before using an Expo API, and add packages with `npx expo install`.
- No Expo Router: there is one screen (`App.tsx`).
- The owner installs with a FREE Apple personal team. Do not add capabilities that need a paid team (push notifications, iCloud, Sign in with Apple, associated domains). HealthKit background delivery is off for the same reason.
- `ios/` is generated (`npx expo prebuild`); configure through `app.json` and config plugins.
- Run `npm run typecheck` before committing.
