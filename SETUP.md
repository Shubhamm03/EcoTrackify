# Ecotrackify: how to run it (with email codes)

## 1. Install once
- **Node.js 18+** from nodejs.org (LTS). Check with `node -v`.
- **MongoDB**: MongoDB Community Server on your computer (runs as a service), or a free MongoDB Atlas cluster.

## 2. Set up the sender Gmail (for verification codes)
One Gmail account sends every code. Each code goes only to the email the person registered with.

1. Go to myaccount.google.com and sign in with the sender Gmail (a personal Gmail, not a college/work one).
2. Security → turn on **2-Step Verification**.
3. Search **App passwords** at the top → name it `Ecotrackify` → **Create**.
4. Copy the 16-letter password (e.g. `abcd efgh ijkl mnop`). Your normal Gmail password will not work.

## 3. Edit `server/.env`
The file is already there with the admin login and a secret. Change only these lines:

```
MONGO_URI=mongodb://127.0.0.1:27017/ecotrackify      (or your Atlas connection string)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yoursendergmail@gmail.com
SMTP_PASS=abcdefghijklmnop
MAIL_FROM="Ecotrackify <yoursendergmail@gmail.com>"
```

Admin login (already set): `admin@gmail.com` / `Admin@123`. Change `ADMIN_PASSWORD` before going live.
Never put the App password in `.env.example`; `.env` is not uploaded to GitHub.

## 4. Install and test email
In a terminal inside the `ecotrackify` folder:

```bash
npm run install-all
cd server
npm run test-email -- yoursendergmail@gmail.com
cd ..
```
You should see "Sent. Check the inbox (and spam folder)".

## 5. Run
```bash
npm run dev
```
Open http://localhost:5173. The terminal should show:
- `Admin account created for admin@gmail.com`
- `Email: SMTP ready (smtp.gmail.com as ...). Codes are sent by email.`

Register with a real email: the 6-digit code arrives in that inbox (check Spam the first time).

## Code rules
Codes expire in 10 minutes; Resend after 60 seconds; 5 wrong tries lock the code until a new one is sent.

## Problems
| Problem | Fix |
| --- | --- |
| "SMTP login failed" | Wrong App password, or normal Gmail password used. Make a new App password. |
| No "App passwords" option | Turn on 2-Step Verification, or use a personal Gmail. |
| Email not arriving | Check Spam. On your own computer the verify page then shows the code with a note. |
| "MongoDB connection error" | Start MongoDB, or fix `MONGO_URI`. |
| Port in use | Close the app on 5000/5173, or change `PORT` in `.env`. |

Without SMTP settings (`SMTP_HOST` blank) codes are not emailed; they appear on the verify page and in the terminal (testing only).

## Home page background video
Put a nature video at `client/public/hero.mp4` (create the `public` folder inside `client` if it isn't there).
It plays muted and looping behind the home page headline, with a soft overlay so the text stays readable.
Use a short clip (10–30 seconds, under about 15 MB, H.264 MP4). Without the file, an animated green background is shown instead.
