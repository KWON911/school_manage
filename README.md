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

## SchoolInfo key setup

The optional SchoolInfo enrichment uses the server-side `/api/schoolinfo` route.
Set `SCHOOLINFO_API_KEY` in the same Vercel environments (and in `.env.local`
for local development). The browser never receives this key. When enrichment
cannot identify one exact school, the app keeps the NEIS result and opens the
official SchoolInfo name-search page instead of guessing a detail page.

The proxy defaults to `https://www.schoolinfo.go.kr/openApi.do`. You normally do
not need `SCHOOLINFO_API_URL`; if an official SchoolInfo deployment requires an
alternate endpoint, set it to an HTTPS URL on `schoolinfo.go.kr` or one of its
subdomains. Other hosts and plain HTTP URLs are rejected before the API key is
attached.
