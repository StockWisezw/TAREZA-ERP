# Google Cloud Platform (GCP) Deployment Guide

This guide covers how to deploy Tareza ERP to **Google Cloud Run**, and how to correctly get the environment variables needed for the build.

## 1. How to get your Environment Variables

Before deploying, you need to set up a free [Supabase](https://supabase.com/) project to serve as the database/backend.

1. **Create a Supabase Project:** Sign in to Supabase and create a new project.
2. **Find your API credentials:** 
   - Once your project is created, select the project.
   - On the left sidebar, click on the **Gear Icon (Project Settings)**.
   - Click on **API** from the sidebar menu.
   - You will see your **Project URL** (This is your `VITE_SUPABASE_URL`).
   - Under Project API keys, you will see your **anon**, **public** key (This is your `VITE_SUPABASE_ANON_KEY`).

## 2. Deploying to Google Cloud Run

To deploy this application to Google Cloud Run, we will use the `Dockerfile` and `nginx.conf` that have been added to the root of your project.

### Method A: Deploying via GitHub (Recommended)

1. Push your code to a GitHub repository.
2. Go to the [Google Cloud Console](https://console.cloud.google.com/).
3. Create a new Google Cloud Project (or select an existing one) and ensure **Billing** is enabled.
4. Go to **Cloud Run** in the GCP Console.
5. Click **Create Service**.
6. Select **"Continuously deploy new revisions from a source repository"** and click **Setup with Cloud Build**.
7. Connect your GitHub account, select your Tareza repository, and check the acknowledgment.
8. On the "Build Configuration" step:
   - Branch: `^main$` (or your default branch)
   - Build Type: **Dockerfile**
   - Source Location: `/Dockerfile`
   - **Crucial Step:** Under "Build steps", you need to pass the environment variables so that Vite can bake them into the React app at build time. Unfortunately, the simple GCP console UI doesn't let you pass *build arguments* directly sometimes. If it asks for arguments, add them. Otherwise, see **Setting Build Variables** below.
9. Name your service (e.g., `tareza-admin`).
10. Under Authentication, select **"Allow unauthenticated invocations"** (since this is a public web app).
11. Click **Create**.

### Passing Build Arguments in GCP

Because `VITE_` variables are baked into static HTML/JS at build-time, adding them to the "Environment Variables" tab in Cloud Run *won't work* (because that sets them at *runtime*). 

To do this correctly in GCP without using a complex `cloudbuild.yaml`:
When you set up continuous deployment, Google Cloud creates a trigger in **Cloud Build**.
1. Go to **Cloud Build** -> **Triggers**.
2. Edit the trigger that Cloud Run just created.
3. Under **Advanced**, look for **Substitution variables**.
4. Add the following variables:
   - `_VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `_VITE_SUPABASE_ANON_KEY` = `your-anon-key`
5. Note: You will need to modify the trigger to pass these as `--build-arg` to the docker build command, or use the gcloud CLI.

### Method B: Deploying via Google Cloud CLI (Easiest for passing build args)

If you have the `gcloud` CLI installed on your machine, this is the most reliable way to deploy.

```bash
# 1. Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Deploy directly from source code
# Replace URL and KEY with your actual Supabase credentials!
gcloud run deploy tareza-frontend \
  --source . \
  --allow-unauthenticated \
  --region us-central1 \
  --port 8080 \
  --set-build-env-vars="VITE_SUPABASE_URL=https://your-url.supabase.co,VITE_SUPABASE_ANON_KEY=your-anon-key"
```

The `--set-build-env-vars` flag securely passes your Supabase keys directly into the `Dockerfile` during the build phase!

## 3. Post-Deployment

1. **Get your Cloud Run URL:** Once deployed, Google Cloud will provide you with a `.run.app` URL.
2. **Update Supabase Redirects:** 
   - Go back to your Supabase Dashboard.
   - Navigate to **Authentication** -> **URL Configuration**.
   - Change the **Site URL** to your new Google Cloud Run URL (e.g., `https://tareza-frontend-xxxxx-uc.a.run.app`).
