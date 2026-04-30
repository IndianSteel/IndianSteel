# IndianSteel

Offline-first PWA for Indian Steel daily sales, advances, dues, stock, reports, history and Google Drive sync.

Open the published GitHub Pages site, login with Google once, then install it from the browser.

## Local Test

```powershell
cd pwa
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`.

## Google Login

For Drive sync on the hosted PWA, add the hosted domain to the Google OAuth client as an Authorized JavaScript origin. For local testing, also add:

```text
http://127.0.0.1:4173
```

The PWA remembers the approved Gmail on the device, opens offline after first login, and syncs local changes when internet is available.
