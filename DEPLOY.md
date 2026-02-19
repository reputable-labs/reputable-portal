# Reputable Client Portal — Deployment Guide

## What You Need (all free)

| Service | Purpose | Cost |
|---------|---------|------|
| **GitHub** | Stores your code | Free |
| **Vercel** | Hosts the website (gives you a URL) | Free |
| **Supabase** | Database + image storage | Free (up to 500MB) |

Total cost: **$0/month** until you outgrow free tiers (which handles ~50+ clients easily).

---

## Step-by-Step Setup (30 minutes)

### Step 1: Create Accounts (5 min)

1. **GitHub** → [github.com/signup](https://github.com) — create account if you don't have one
2. **Vercel** → [vercel.com/signup](https://vercel.com) — sign up with your GitHub account
3. **Supabase** → [supabase.com](https://supabase.com) — sign up with your GitHub account

---

### Step 2: Set Up Supabase (10 min)

1. In Supabase, click **"New Project"**
2. Name it `reputable-portal`, set a database password (save it somewhere), pick a region close to you
3. Wait ~2 minutes for it to provision

#### Create the database table:
4. Go to **SQL Editor** (left sidebar) and paste this, then click **Run**:

```sql
-- Clients table
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT 'Untitled Client',
  social_handles TEXT DEFAULT '',
  collaborator_name TEXT DEFAULT '',
  collaborator_email TEXT DEFAULT '',
  collab_post BOOLEAN DEFAULT false,
  story_sharing BOOLEAN DEFAULT false,
  cross_posting BOOLEAN DEFAULT false,
  overall_status TEXT DEFAULT 'not_started',
  form_completed BOOLEAN DEFAULT false,
  form_submitted_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assets table
CREATE TABLE assets (
  id TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  preview_label TEXT DEFAULT '',
  dimensions TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  feedback TEXT DEFAULT '',
  image_url TEXT,
  PRIMARY KEY (client_id, id)
);

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (we use unique IDs as "passwords")
CREATE POLICY "Allow all" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON assets FOR ALL USING (true) WITH CHECK (true);
```

#### Set up image storage:
5. Go to **Storage** (left sidebar)
6. Click **"New Bucket"** → name it `assets` → toggle **Public bucket** ON → click **Create**
7. Click the `assets` bucket → go to **Policies** → click **New Policy** → choose **Full customization**:
   - Policy name: `Allow all uploads`
   - Allowed operation: **ALL**
   - Target roles: check **anon**
   - Policy definition: `true`
   - Click **Review** then **Save**

#### Get your keys:
8. Go to **Settings** → **API** (left sidebar)
9. Copy these two values (you'll need them in Step 4):
   - **Project URL** (looks like `https://abcdef123.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

---

### Step 3: Push Code to GitHub (5 min)

1. Go to [github.com/new](https://github.com/new)
2. Name the repo `reputable-portal`, set it to **Private**, click **Create repository**
3. Upload the project files I've created for you (instructions below)

**If you're comfortable with terminal:**
```bash
cd reputable-portal
git init
git add .
git commit -m "Initial portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/reputable-portal.git
git push -u origin main
```

**If you prefer GitHub's web interface:**
- On your new repo page, click **"Upload files"**
- Drag the entire project folder contents in
- Click **"Commit changes"**

---

### Step 4: Deploy on Vercel (5 min)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import"** next to your `reputable-portal` repo
3. Under **Environment Variables**, add these two:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Your Project URL from Step 2 |
| `VITE_SUPABASE_ANON_KEY` | Your anon key from Step 2 |

4. Click **Deploy**
5. Wait ~1 minute. Vercel gives you a URL like `reputable-portal.vercel.app`

---

### Step 5: Set a Custom Domain (optional, 5 min)

1. In Vercel, go to your project → **Settings** → **Domains**
2. Add your domain (e.g., `portal.reputable.health`)
3. Follow the DNS instructions Vercel gives you (usually just adding a CNAME record)

---

## How It Works After Deployment

**Your admin dashboard:**
```
https://reputable-portal.vercel.app/#admin
```

**Client links (generated from dashboard):**
```
https://reputable-portal.vercel.app/#client/abc123_xyz
```

**With custom domain:**
```
https://portal.reputable.health/#admin
https://portal.reputable.health/#client/abc123_xyz
```

---

## File Structure

```
reputable-portal/
├── index.html            ← Entry point
├── package.json          ← Dependencies
├── vite.config.js        ← Build config
├── src/
│   ├── main.jsx          ← React mount
│   ├── App.jsx           ← Main portal (all views)
│   └── supabase.js       ← Database connection
└── public/
    └── favicon.ico
```

---

## Maintenance

- **View your data**: Supabase dashboard → Table Editor
- **Update the portal**: Edit code in GitHub → Vercel auto-deploys
- **Monitor usage**: Supabase dashboard shows storage + request counts
- **Backups**: Supabase auto-backs-up daily on free tier

---

## Limits on Free Tiers

| Service | Limit | What it means |
|---------|-------|---------------|
| Vercel | 100GB bandwidth/mo | ~10,000 client visits |
| Supabase | 500MB database | ~500+ clients with images |
| Supabase | 1GB file storage | ~1,000 compressed images |

You won't hit these for a long time. When you do, paid tiers start at ~$20/mo.
