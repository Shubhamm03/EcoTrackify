# Ecotrackify

An eco-friendly lifestyle tracking app built with the **MERN** stack (MongoDB, Express, React, Node.js).

- **Individuals** track their carbon footprint, get goals and tips based on their own emissions, join communities, share tips (reply & like), take weekly green challenges and climb the leaderboard.
- **Businesses / organisations** track their company footprint (office energy, fleet, business travel, waste), create communities, invite members with a code, see members' progress (with permission), run challenges and send announcements.

- **Admin** manages both: views, suspends, reactivates or deletes individuals and businesses, removes communities, moderates reported posts/tips and publishes official tips. There is **no admin registration** — the admin account comes from `server/.env`.

The app has a **light and a dark theme** (toggle in the top bar and sidebar; it starts from your device setting and remembers your choice). Icons are line icons, no emoji. All carbon figures and carbon charts are shown in **red**. There is **no demo or fake data**: the app starts empty and fills only with real registrations and activity.

---

## Setup

**You need:** Node.js 18+ and MongoDB (local `mongod` or a free MongoDB Atlas cluster).

```bash
# 1. Install everything (root, server and client)
npm run install-all

# 2. Configure the API
cp server/.env.example server/.env
#    edit server/.env → set MONGO_URI, a long random JWT_SECRET,
#    and ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME for the admin login

# 3. Run API (port 5000) + React app (port 5173) together
npm run dev
```

Open **http://localhost:5173**.

> Start the server with your time zone so daily check-ins line up, e.g. `TZ=Asia/Kolkata npm run dev`.

### Try it end to end
1. On the landing page choose **Register an organisation** and complete the 2 steps. Enter the 6-digit code from the email (in development without SMTP the code is shown on the screen and printed in the server terminal). You land on the Business overview, which shows your invitation code.
2. Log out, choose **Join as an individual**, fill in the one-page form, open **Join a company or community** and enter the code (**Verify**), or skip it. Verify your email with the code and you go straight to the dashboard.
3. As the individual: log trips and electricity, pick a suggested goal, join a challenge, post a tip in the community.
4. Log in as the business: see the Business overview, Members, Challenges, and the community **Admin** tab. Reply to and like the post, send an announcement, create a challenge.
5. Back as the individual, open **Notifications**.
6. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` → **Admin overview**. Open **Individuals** and **Businesses**, view an account, suspend it (try logging in as that account: it is refused with the reason), reactivate it. Report a post as the individual and handle it under **Reports & tips**.

### Production
```bash
npm run build                      # builds client/dist
NODE_ENV=production npm start      # Express serves the API and the React app on one port
```

---

## Registration

### Individual (one page)
| Section | Fields |
|---|---|
| Account | Username\*, Email\*, Password\*, Confirm password\* |
| About you | Full name\*, Age\* (13–120), Gender\* (Female / Male / Other / Prefer not to say), City\* |
| Join a company or community | Optional, collapsed: invitation code with **Verify**. Skip it if you have no code |
| | Terms of Service and Privacy Policy\* (both are links that open in a new tab) |

There is no country field.

### Business (2 short steps)
| Step | Fields |
|---|---|
| 1. Organisation | Company / organisation name\*, Business email\*, Password\*, Confirm password\*, Organisation type\* |
| 2. Contact | Contact person full name\*, Phone, Department, City\*, Address, Terms\* |

Industry, company size, website and focus areas are added later in **profile settings** (company size is used to compare office emissions per employee).

A private community with an invitation code is created for every business once its email is verified.

### Email verification (OTP)
1. **Create account** saves the account as *unverified* and emails a **6-digit code**. No login token is issued yet.
2. The **Check your email** page has six boxes (paste works), **Resend code** (once a minute) and a clear error for wrong or expired codes.
3. Codes are valid **10 minutes**, allow **5 attempts**, and only a SHA-256 hash is stored.
4. On success the user is logged in and goes **straight to the dashboard** (business: Business overview). There is no separate success page.
5. Logging in to an unverified account sends a fresh code and opens the verification page.
6. Sign-ups never verified are deleted after 7 days. Typed the wrong email? Register again: an unverified account never blocks an email or username.
7. Without SMTP settings (development), the code is printed in the server terminal **and** shown on the verification page, so you can test without email. Set `SMTP_*` in `server/.env` to send real emails (for Gmail: `smtp.gmail.com`, port 587, your address and an App Password).

### Login
Email **or** username + password + **captcha** (5 characters from an image; a new one after every failed try, valid 5 minutes, single use). Suspended accounts are refused with the admin's reason.

### Validation (browser and server)
- **Email:** `name@domain.tld` format, no spaces, no consecutive or edge dots, a real top-level domain; checked for duplicates while typing.
- **Password:** 8–64 characters, upper-case, lower-case, number and symbol, no spaces, must not contain your name/username/email, and common passwords (e.g. `Passw0rd!`, `Qwerty123!`) are rejected. While typing, the field lists exactly which rules are not met yet (for example "Must not contain your username"); each line disappears once that rule is met. Confirm-password shows "Passwords match" or a red mismatch message.
- **Username:** "Please enter a valid username" if it is not 3–20 lowercase letters, numbers or _, and "Username already exists" (checked while typing).
- Same rules on registration, change password and reset password.
- Any message at the top of a form disappears as soon as you edit a field, so a fixed problem (for example "Passwords do not match") never keeps showing.

### Terms and privacy
`/terms` and `/privacy` are full pages written for Ecotrackify (accounts and age, carbon figures are estimates, community content and footprint sharing, challenges, suspension, data collected, who can see it, retention, your choices). They are linked from the registration forms and the footer.

### Admin
No sign-up page. On every server start `ensureAdmin()` creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (or resets its password to that value), so whoever runs the server controls it.

---

## Individual vs business

| | Individual | Business |
|---|---|---|
| Menu | Green "Individual" badge | Teal "Business account" badge |
| Home | Dashboard (personal CO₂, tip, charts, goals, badges) | Business overview (company CO₂, members' CO₂, top emitters, pending requests, invitation codes) |
| Footprint | Personal: car, bus, metro, flights, electricity, LPG, waste… | Company: fleet, business travel, office electricity, generator, office waste, e-waste, paper |
| Goals & tips | vs the average person | per employee vs typical offices (uses company size) |
| Communities | Join (code, request or public), post, reply, like, share footprint on/off | Create, edit and administer: requests, co-admins, delete posts, announcements, resources, progress |
| Members | — | Live member footprints, **Remove** a member (from all your communities), **personal tips** only that member sees (they can reply) |
| Challenges | One week, Monday–Sunday: check in every day (10 points each) + 50-point bonus for all 7 days | Create community challenges (always one week), see participation |
| Leaderboard | Yes | — (members are ranked, not organisations) |

The **admin** gets a slate "Administrator" badge with Overview, Individuals, Businesses, Communities and Reports & tips; the profile page only shows password and logout.

## Personalised goals and tips
Built from each account's last 30 days (averaged over the days actually tracked):
- **High** source → 20% cut goal and the most important tips first, plus a number-based tip from the biggest source.
- **Average** → 10% cut.
- **Already low** → small cut **plus an advanced goal** and advanced tips.
- Individuals get a high-emission alert notification at most once a week.

## Landing page (all live data)
Totals (people, businesses, CO₂ measured, CO₂ saved by achieved goals, goals achieved, challenges completed, communities, tips shared), this month's CO₂ by source, top 3 communities by lowest CO₂ per member, this week's challenges with join counts, and the most-liked tips from public communities. Empty sections show a friendly message.

---

## Project structure
```
ecotrackify/
├── server/
│   ├── server.js, app.js
│   ├── config/        db.js, emissionFactors.js (personal + business factors)
│   ├── middleware/    auth.js, upload.js (profile photo), error.js
│   ├── models/        User, Activity, Goal, Tip, Challenge, ChallengeParticipation, Notification, Community, Membership, Post
│   ├── routes/        auth, users, activities, insights, goals, tips, challenges, leaderboard,
│   │                  communities, posts, business, notifications, public, admin
│   ├── utils/         otp (email codes), captcha, admin (ensureAdmin, cascading deletes), insights, communityAccess, goals, achievements, challenges, scheduler, notify, email, moderation, helpers, officialTips
│   └── uploads/avatars/
└── client/src/
    ├── App.jsx        public, individual-only, business-only and shared routes
    ├── components/    Layout (three menus), PublicChrome (nav + footer), FormFields, Icon (line icons), ui
    ├── utils/         api, format, validation
    ├── context/       AuthContext, ThemeContext (light/dark), ToastContext
    └── pages/         Landing, Legal (Terms, Privacy), Auth (login, account type, 2 registration flows, verify email, password reset),
                       Dashboard, Tracker, Goals, Challenges, Leaderboard, Tips, Communities, CommunityDetail,
                       Compare, Notifications, Settings, BusinessOverview, BusinessMembers, BusinessChallenges,
                       Admin (overview, users, communities, reports)
```

## Main API routes
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/public/stats` | Landing page data |
| POST | `/api/auth/check-availability` | `{ email, username }` |
| POST | `/api/auth/check-invite` | `{ code }` — Verify code |
| POST | `/api/auth/register` | `accountType: 'user' \| 'business'` + fields above. Returns `{ verification: true, email }` (no token) |
| POST | `/api/auth/verify-email` | `{ email, otp }` → `{ token, user }` |
| POST | `/api/auth/resend-otp` | `{ email }` (once a minute) |
| GET | `/api/auth/captcha` | `{ captchaId, image, expiresInSeconds }` |
| POST | `/api/auth/login` | `{ login: email or username, password, captchaId, captchaAnswer }` |
| PUT | `/api/users/me` · `/me/password` · `/me/notifications` | Profile, password, notifications |
| DELETE | `/api/users/me` | Delete your account (a business also deletes its communities) |
| POST/DELETE | `/api/users/me/avatar` | Photo upload (multipart `avatar`) |
| GET | `/api/activities/factors` | Personal or business factors, by account |
| GET/POST/DELETE | `/api/activities` | Footprint log |
| GET | `/api/insights/me` | Levels, tips, suggested goals |
| GET/POST/DELETE | `/api/goals` | Goals |
| GET/POST | `/api/communities` · `/compare` · `/join-code` | List, create (business), compare, join |
| GET/POST/PUT/DELETE | `/api/communities/:id/...` | members, requests, sharing, insights, progress, announcements, resources, posts, replies, likes |
| GET | `/api/business/overview` · `/members` · `/challenges` | Business pages |
| DELETE | `/api/business/members/:userId` | Remove a member from all your communities |
| GET/POST | `/api/business/members/:userId/tips` | Personal tips to one member |
| POST · DELETE | `/api/business/tips/:id/replies` · `/api/business/tips/:id` | Reply in a tip thread · delete a tip |
| GET · POST | `/api/personal-tips` · `/api/personal-tips/:id/replies` | Member: tips written for me · reply |
| GET/POST | `/api/challenges/current` · `/:id/join` · `/:id/checkin` · `POST /api/challenges` | Challenges |
| GET | `/api/leaderboard?period=week\|all&community=<id>` | Individuals only |
| GET/PUT | `/api/notifications` | Inbox |
| GET | `/api/admin/stats` | Admin only: totals and newest accounts |
| GET | `/api/admin/users?role=user\|business&status=&q=&page=` · `/users/:id` | List / detail |
| PUT · DELETE | `/api/admin/users/:id/status` `{ status, reason }` · `/api/admin/users/:id` | Suspend / reactivate · delete with all data |
| GET · DELETE | `/api/admin/communities` · `/communities/:id` | List · delete |
| GET | `/api/admin/reports` | Reported posts and tips |
| GET | `/api/admin/posts?q=&page=` | Every community post (delete with `DELETE /api/admin/posts/:id`) |
| PUT · DELETE | `/api/admin/posts/:id` · `/api/admin/tips/:id` | Hide/restore `{ hidden }` · delete |
| POST | `/api/admin/tips` | Publish an official tip |

## Email (verification codes by real email)
With SMTP set up, the 6-digit code is **sent to the user's inbox** and is not shown on screen. Without SMTP (development) emails are printed in the server terminal and the code is also shown on the verify page.

**Gmail setup**
1. Turn on **2-Step Verification** for your Google account (myaccount.google.com → Security).
2. Open **App passwords** (myaccount.google.com/apppasswords), create one named "Ecotrackify" and copy the 16-letter password.
3. In `server/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=abcdefghijklmnop        # the App Password (spaces are fine)
   MAIL_FROM=Ecotrackify <yourname@gmail.com>
   ```
4. Test it: `cd server && npm run test-email -- someone@example.com`. It prints "Sent" or the exact SMTP error.
5. Restart `npm run dev`. The server prints `Email: SMTP ready` at startup (or the login error).

Never use your normal Gmail password and never commit `server/.env`. If sending fails, the verify page shows "We could not send the email" (in development the code is still shown so you can continue).

## Notes
- Emission factors and the reference averages are approximate Indian values; adjust in `server/config/emissionFactors.js` and `server/utils/insights.js`.
- Official tips and weekly challenge templates are app content (not users) and are created automatically on first start.
- Scheduled jobs (node-cron): Monday new challenges, daily goal settlement and goal reminders, logging reminders, challenge nudges, removal of unverified sign-ups after 7 days. Notifications expire after 90 days.

## Validation (whole app)
Every form checks its fields **while you type** and shows the message **directly under the field** in red (never in a box at the top). A message disappears the moment its rule is met; submitting shows any remaining ones and moves the cursor to the first problem. Server replies such as "Username already exists" or "Current password is incorrect" are also shown under the matching field. Shared pieces: `client/src/hooks/useForm.js`, `client/src/components/FormFields.jsx` (TextField, SelectField, EmailField, PasswordField, ConfirmField, CheckField) and `client/src/utils/validation.js`.

Terms of Service and Privacy Policy open in a dialog from the registration forms with a **Back to registration** button (nothing typed is lost); the full pages have a **Back** button. Every app page ends with a small footer (Terms, Privacy, contact).

## Navigation
- The side bar has only the app pages. Click the **toggle button** at the top of the side bar to collapse it to icons (remembered per browser).
- **Notifications** open from the **bell** (top right of every page), which shows the unread count. The **gear** button on the Notifications page holds the notification settings.
- Click **your name / photo** at the bottom of the side bar (or **Profile** on phones) to open profile settings. **Log out** and **Delete account** are only there.
- Pages update live (every 10–15 s) without refreshing: notification count and list, community feed, member footprints, business overview and members, personal tips.

## Goals
- Three clean cards (Transport, Energy, Waste) each show where you stand and 1–2 suggested goals with an **Add** button.
- **Custom goal** sits below the suggestions; the form opens right under it. Any budget above 0 kg is allowed.
- Notifications: when 80% of a goal's budget is used, when 3 days are left, and when a goal is achieved or missed.

## Profile settings
The profile shows as read-only details with an **Edit profile** button. In edit mode, **Save changes** stays disabled until a field actually changes (changing it back disables it again); **Cancel** discards edits. Confirmation messages appear bottom-right on laptops and centred above the menu on phones.
