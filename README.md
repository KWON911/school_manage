# school_manage

## NEIS key setup

This site uses a server-side proxy at `/api/neis`. The web browser calls that
route, and only the server sends the `NEIS_API_KEY` to NEIS. This keeps the key
out of the downloaded HTML and JavaScript.

1. Revoke the exposed key in the NEIS Open API portal and create a replacement.
2. Import this GitHub repository into Vercel (or deploy it with the Vercel CLI).
3. In **Project Settings → Environment Variables**, add `NEIS_API_KEY` with the
   replacement value for Production, Preview, and Development as appropriate.
4. Redeploy, then check that school search, schedules, timetable, and meals work.

For local development, copy `.env.example` to `.env.local`, add the replacement
key there, and keep `.env.local` uncommitted. Do not use a `NEXT_PUBLIC_` prefix:
such variables are included in the browser bundle.

GitHub Pages can only host static files, so it cannot safely hold this key. Use
Vercel (or another host that runs the `/api/neis` server route) for this version.
