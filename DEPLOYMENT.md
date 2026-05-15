# Tareza ERP Production Deployment Guide

This guide outlines the steps to deploy Tareza ERP to Netlify for the frontend and Supabase for the backend.

## 1. Supabase Database Preparation 

1. **Create a Production Project**: Sign in to [Supabase](https://supabase.com/) and create a new project.
2. **Apply Migrations**: 
   - You can copy the contents of `supabase/migrations/` and run them in the Supabase SQL Editor.
   - Run the files sequentially (e.g. `20260513182000_tareza_schema.sql`, `0002_*.sql`, etc.) to generate the required schema.
   - *Alternatively*, use the Supabase CLI: 
     ```bash
     supabase link --project-ref your-project-ref
     supabase db push
     ```
3. **Configure Authentication**:
   - Go to Authentication -> Providers. Enable the providers you wish to use (Email/Password, Google).
   - In Authentication -> URL Configuration, set your **Site URL** to your custom domain or Netlify URL (e.g., `https://tareza.app`).
   - Add your localhost URLs (`http://localhost:3000`) and any staging URLs to the **Redirect URLs**.
4. **Acquire API Keys**:
   - Navigate to Project Settings -> API.
   - Note the `Project URL` and `anon public` key for the frontend environment variables.

## 2. Netlify Deployment

1. **Push Code to GitHub**: Ensure all Tareza ERP code is committed and pushed to a GitHub repository.
2. **Connect to Netlify**:
   - Log into [Netlify](https://www.netlify.com/).
   - Click "Add new site" -> "Import an existing project".
   - Select your GitHub repository.
3. **Configure Build Settings**:
   - **Base directory**: (leave blank)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. **Set Environment Variables**:
   Click "Add environment variables" and set:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
   - `VITE_ENABLE_AI_FEATURES`: `true`
5. **Deploy**: Click **Deploy site**.
   Netlify will automatically build the site based on the `netlify.toml` file configuration, which includes optimal security headers and SPA routing redirects.

## 3. Domain Setup (Netlify)

1. Navigate to your site in Netlify.
2. Go to **Domain management** -> **Add custom domain**.
3. Enter your domain (e.g., `tareza.co.zw`).
4. Update your domain registrar's DNS records:
   - Create an `A` record pointing to `75.2.60.5`
   - Create a `CNAME` for `www` pointing to `your-site-name.netlify.app`.
5. Once DNS propagates, Netlify will automatically provision a Let's Encrypt SSL certificate.

## 4. Performance & Security Optimizations Included

* **Vite Chunk Splitting:** The Vite configuration has been optimized to split vendor libraries (React, UI components, utilities, Supabase) into separate chunks. This improves initial load performance and browser caching.
* **Security Headers:** The `netlify.toml` file automatically applies production-ready HTTP security headers, including an optimized Content-Security-Policy (CSP) that protects against XSS attacks.
* **Client-Side Routing:** `netlify.toml` automatically handles SPA rules, rewriting URL requests to `index.html`.
