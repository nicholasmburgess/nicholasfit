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

## Updating

Every change merged into the `main` branch on GitHub deploys automatically to Vercel within a minute or two.
