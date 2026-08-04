# SConnect — Setup

Two apps, deployed separately, exactly like Coddex.

```
SConnect/
├── Backend/     Express + Mongoose + Redis + Socket.io
├── Frontend/    Vite + React + Tailwind v4
└── render.yaml  Backend deploy config
```

---

## 1. What you need to create

Create each of these and paste the value into `Backend/.env` or `Frontend/.env`.
Nothing here reuses a Coddex key — every one is new.

| # | Service | What to make | Goes into |
|---|---|---|---|
| 1 | MongoDB Atlas | New free M0 cluster, new DB user, database named `sconnect`. Copy the SRV connection string. Network Access → allow `0.0.0.0/0`. | `DB_CONNECT_STRING` |
| 2 | JWT secrets | Two random strings. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` — run it twice, they must differ. | `JWT_ACCESS_KEY`, `JWT_REFRESH_KEY` |
| 3 | Redis Cloud | New free 30MB database. Copy host, port and password. Used for refresh-token rotation and logout blocklisting. | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS` |
| 4 | Cloudinary | New account. Dashboard gives cloud name, API key, API secret. Used for avatars, assignment attachments and study material. | `CLOUDINARY_*` |
| 5 | Cloudflare Turnstile | New site. Choose "Managed". Gives a site key (public) and secret key. | `TURNSTILE_SECRET_KEY`, `VITE_TURNSTILE_SITE_KEY` |
| 6 | Gmail app password | Google Account → Security → 2-Step Verification → App passwords. 16 characters, no spaces. Used for password reset and digest email. | `SENDER_GMAIL`, `SENDER_PASSWORD` |

Optional, only if you want them:

| # | Service | Goes into |
|---|---|---|
| 7 | Google OAuth client ID (Google sign-in) | `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `VITE_OAUTH_CLIENT_ID` |

Send me the values and I will fill both `.env` files in. Until then they hold placeholders.

---

## 2. Install

### Backend

```bash
cd Backend
npm init -y
npm install express mongoose redis jsonwebtoken bcrypt cookie-parser cors dotenv validator nodemailer cloudinary multer axios socket.io express-rate-limit helmet compression
npm install --save-dev nodemon
```

One line:

```bash
npm install express mongoose redis jsonwebtoken bcrypt cookie-parser cors dotenv validator nodemailer cloudinary multer axios socket.io express-rate-limit helmet compression && npm install --save-dev nodemon
```

| Package | Why |
|---|---|
| `express` | HTTP server and routing |
| `mongoose` | MongoDB ODM, all 17 models |
| `redis` | Refresh-token store + logout blocklist |
| `jsonwebtoken` | Access and refresh token signing |
| `bcrypt` | Password hashing |
| `cookie-parser` | Reads the httpOnly refresh cookie |
| `cors` | Allows the Vite origin with credentials |
| `dotenv` | Loads `.env` |
| `validator` | Email and strong-password checks |
| `nodemailer` | Password reset and notification email |
| `cloudinary` | Avatar, attachment and material storage |
| `multer` | Multipart parsing, streamed on to Cloudinary |
| `axios` | Server-to-server calls (Turnstile verify) |
| `socket.io` | Real-time messaging and notification push |
| `express-rate-limit` | Throttles auth endpoints |
| `helmet` | Security headers |
| `compression` | gzip responses |
| `nodemon` | Dev reload |

### Frontend

```bash
cd Frontend
npm create vite@latest . -- --template react
npm install react-router react-redux @reduxjs/toolkit axios socket.io-client react-hook-form @hookform/resolvers zod lucide-react recharts sonner clsx tailwind-merge date-fns react-calendar react-big-calendar moment @marsidev/react-turnstile @react-oauth/google @fontsource-variable/inter tailwindcss @tailwindcss/vite
npm install --save-dev oxlint
```

One line:

```bash
npm install react-router react-redux @reduxjs/toolkit axios socket.io-client react-hook-form @hookform/resolvers zod lucide-react recharts sonner clsx tailwind-merge date-fns react-calendar react-big-calendar moment @marsidev/react-turnstile @react-oauth/google @fontsource-variable/inter tailwindcss @tailwindcss/vite && npm install --save-dev oxlint
```

| Package | Why |
|---|---|
| `react-router` | Routing and role guards |
| `react-redux` + `@reduxjs/toolkit` | Auth slice, same pattern as Coddex |
| `axios` | API client with refresh-token interceptor |
| `socket.io-client` | Live chat and notification bell |
| `react-hook-form` + `@hookform/resolvers` + `zod` | Every form |
| `lucide-react` | Icons (replaces the PNG icons the reference repo ships) |
| `recharts` | Dashboard charts |
| `sonner` | Toasts |
| `clsx` + `tailwind-merge` | `cn()` helper |
| `date-fns` | Date formatting |
| `react-calendar` | Sidebar month calendar |
| `react-big-calendar` + `moment` | Weekly timetable view |
| `@marsidev/react-turnstile` | Cloudflare human check on login/register |
| `@react-oauth/google` | Optional Google sign-in |
| `@fontsource-variable/inter` | The reference design's typeface |
| `tailwindcss` + `@tailwindcss/vite` | Tailwind v4, config lives in `index.css` |
| `oxlint` | Linter, same as Coddex |

---

## 3. Run

```bash
cd Backend  && npm run dev     # http://localhost:3000
cd Frontend && npm run dev     # http://localhost:5173
```

Seed the first admin (there is no signup path to admin):

```bash
cd Backend && node src/scripts/seedAdmin.js
```

It prints the email and password it created. Change the password after first login.
