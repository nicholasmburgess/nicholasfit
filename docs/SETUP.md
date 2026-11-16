# Setting up Nicholasfit

About 20 minutes, no coding. You need three free accounts: GitHub (you have it), Vercel (hosts the app) and Supabase (stores your data and handles login).

You can do step 2 first to try the app straight away in demo mode, then add Supabase later.

## 1. Supabase: database and login

1. Go to https://supabase.com and sign up with your GitHub account.
2. Click **New project**. Name it `nicholasfit`, choose the **Sydney** region, set a database password (save it in your password manager) and create it. It takes a couple of minutes.
3. In the left sidebar open **SQL Editor**, click **New query**, paste the whole contents of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) and click **Run**. You should see "Success. No rows returned".
4. Open **Project Settings → API** (or **Connect** at the top). Copy the **Project URL** and the **anon public** key. You'll paste them into Vercel next.

## 2. Vercel: hosting

1. Go to https://vercel.com and sign up with your GitHub account. Allow it to access the `nicholasfit` repository.
2. Click **Add New → Project**, pick `nicholasfit` and click **Import**.
3. Open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL from Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key
   (Skip these to try demo mode first. Add them later under **Settings → Environment Variables**, then **Deployments → Redeploy**.)
4. Click **Deploy**. When it finishes you get a web address like `nicholasfit.vercel.app`.

## 3. Connect the two

1. In Supabase open **Authentication → URL Configuration** and set **Site URL** to your Vercel address (for example `https://nicholasfit.vercel.app`). This makes the confirmation email link work.

## 4. Create your account

1. On your iPhone open the Vercel address in **Safari**.
2. Tap **First time? Create an account**, enter your email and a password.
3. Open the confirmation email and tap the link, then go back and sign in.
4. Lock it down so nobody else can sign up: in Supabase open **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**.

## 5. Put it on your home screen

In Safari tap the **Share** button, then **Add to Home Screen**. It opens full screen like a normal app. You'll need to sign in once more inside the home-screen app.

## 6. Food logging (Phase 2)

1. **Database tables:** in Supabase, open **SQL Editor**, click **New query**, paste the contents of `supabase/migrations/0002_food.sql`, and click **Run**. "Success. No rows returned" means it worked.
2. **Claude key:** in console.anthropic.com create an API key. In Vercel, open **nicholasfit**, go to **Settings**, then **Environment Variables**, and add `ANTHROPIC_API_KEY` with the key as its value. The key lives only on the server and is never sent to the phone.
3. **Spend limit:** in the Anthropic console, under Settings › Limits, set a monthly limit. $10 to $20 covers normal use.
4. **Sign-ups off:** in Supabase, under Authentication › Sign In / Providers, turn off "Allow new users to sign up". Otherwise strangers could create accounts and use your credit.
5. Redeploy in Vercel (Deployments › ⋯ › Redeploy) so the key is picked up. The Food tab then says whether the key works.

## 7. Withings scale

1. Run `supabase/migrations/0003_withings.sql` in the Supabase SQL Editor, the same way as step 6.
2. At developer.withings.com create a "Public API integration" app. Set its callback URL to `https://nicholasfit.vercel.app/api/withings/callback`.
3. In Vercel, add `WITHINGS_CLIENT_ID` and `WITHINGS_CLIENT_SECRET` as environment variables, then redeploy.
4. In the app, go to Progress and tap **Connect Withings**. New weigh-ins sync each time you open Progress (at most every 10 minutes).

## 8. Waist measurements

Run `supabase/migrations/0004_measurements.sql` in the Supabase SQL Editor.

## 9. Home-screen widget

1. Run `supabase/migrations/0005_widget.sql` in the Supabase SQL Editor.
2. In the app, open Progress, tap **Home-screen widget** then **Make my widget key**, and follow the steps there. You need the free Scriptable app.
3. The key is stored only as a hash. Making a new key stops the old scripts working.

## Updating

Every change merged into the `main` branch on GitHub deploys automatically to Vercel within a minute or two.
