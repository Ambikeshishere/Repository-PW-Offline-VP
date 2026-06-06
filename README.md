# 🏢 Physics Wallah — Sheet Repository

A private, internal web app for your **company team** to browse, search, pin, and access Google Sheets — with a full authentication system (login, signup, forgot password via OTP).

> Inspired by [PW Vidyapeeth Maharashtra Sheet Directory](https://github.com/Ambikeshishere/Phyiscs_Wallah)

---

## ✨ Features

### 🔐 Authentication
| Feature | Details |
|---------|---------|
| Sign Up | Register with company email + password (min 6 chars) |
| Login | Credentials verified against a private Google Sheet user DB |
| Google Sign-In | OAuth2 with company domain restriction |
| Forgot Password | 3-step OTP flow — enter email → verify OTP → set new password |
| Session | Stored in `localStorage` (`loggedUser` key) |
| Route Guard | `index.html` redirects to `login.html` if not logged in |

### 📋 Sheet Directory
- Fetches sheet data live from a **published Google Sheet (CSV)**
- Each sheet card shows: **name, owner, last modified date, category badge**
- Click any card or **Open ↗** button to open the sheet in a new tab

### 🔍 Smart Features
- **Real-time search** by sheet name (works with active filter)
- **Pinning** — Pin sheets for quick access (per-user, localStorage)
- **Recent sheets** — Last 10 opened sheets tracked automatically
- **Category detection** — Auto-tags sheets based on name keywords
- **Smart cache** — 5-minute cache with background refresh

### 🗂️ Sidebar Filters
| Filter | Description |
|--------|-------------|
| All Sheets | Shows every sheet |
| Pinned | Shows only your pinned sheets |
| Recent | Recently opened sheets |
| Analysis | Sheets with "analysis" in name |
| Reports | Report-related sheets |
| Finance | Finance & revenue sheets |
| Sales | Sales pipeline sheets |
| Marketing | Marketing campaign sheets |
| HR | HR & employee sheets |
| Operations | Operations sheets |
| Client | Client-related sheets |
| Product | Product-related sheets |

### 🎨 Themes (12 themes)
| Theme | Type |
|-------|------|
| 🌙 Dark | Classic dark (default) |
| ☀️ Light | Clean light mode |
| 🌙 Eve | Warm sepia tone |
| 🌌 Midnight | Indigo graphic |
| 🌅 Sunset | Orange graphic |
| 🌲 Forest | Green graphic |
| 🌊 Ocean | Blue graphic |
| 💜 Lavender | Purple soothing |
| 🌸 Rose | Pink soothing |
| 🌿 Sage | Green soothing |
| ☁️ Sky | Sky blue soothing |
| 🟡 Amber | Gold soothing |
| 📝 Cream | Doodle warm |
| 📄 Paper | Notebook style |
| ✏️ Sketch | Pencil drawing style |

---

## 📁 Project Structure

```
company-dashboard/
│
├── index.html       → Main app (Sheet Repository dashboard) ✨ SMART
├── login.html       → Login page
├── signup.html      → Sign up / Register page
├── forgot.html      → Forgot password (OTP-based reset)
│
├── app.js           → Core app logic (fetch, render, filter, pin, search, cache)
├── auth.js          → Sign-in logic + Google OAuth
│
├── style.css        → All styles — themes, layout, components
│
├── .github/workflows → (CI/CD — optional)
└── README.md        → This file
```

---

## ⚙️ Configuration

### Step 1: Update `auth.js`
```js
const ALLOWED_DOMAIN = "@company.com";   // Your company domain
const COMPANY_NAME   = "Your Company";    // Your company name
const COMPANY_TAG    = "Internal";        // Your tagline
const USER_DB_URL    = "https://docs.google.com/spreadsheets/d/e/YOUR_SHEET_ID/pub?gid=0&single=true&output=csv";
const GAPI_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
```

### Step 2: Update `app.js`
```js
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/YOUR_SHEET_ID/pub?gid=0&single=true&output=csv";
```

### Step 3: Google Sheet — User Database
Publish a sheet with:
| Column A | Column B |
|----------|----------|
| email    | password |
| user@company.com | yourpassword |

**Important:** `File → Share → Publish to web` as CSV.

### Step 4: Google Sheet — Sheet Directory
Publish a sheet with:
| Col A | Col B | Col C | Col D | Col E | Col F |
|-------|-------|-------|-------|-------|-------|
| Sheet Name | Open Link | Owner | Last Modified | Last Modified Date | Web Link |

### Step 5: Google Apps Script — Signup & OTP
Deploy an Apps Script with endpoints for:
- `sendOTP` — generates and emails a 6-digit OTP
- `verifyOTP` — validates the OTP
- `resetPassword` — updates password in the sheet
- Signup — writes new user to user database sheet

### Step 6: Update HTML files
Update branding in all HTML files:
- `<span class="brand-name">Your Company</span>`
- `<span class="brand-tag">Internal</span>`

---

## 🚀 Getting Started

### Run Locally
Just open `login.html` in your browser. No build step needed — pure HTML/CSS/JS.

```bash
git clone <your-repo-url>
cd company-dashboard
open login.html
```

### Deploy to GitHub Pages
1. Push to your GitHub repo
2. Go to Settings → Pages → Source: main branch / root
3. Your app will be live at `https://your-username.github.io/company-dashboard/login.html`

### Deploy via GitLab Pages
Add `.gitlab-ci.yml`:
```yaml
pages:
  stage: deploy
  script:
    - mkdir .public
    - cp -r * .public
    - mv .public public
  artifacts:
    paths:
      - public
  only:
    - main
```

---

## 🔒 Security Notes
> Designed for **internal team use only**

- Passwords stored as plain text in Google Sheets — consider hashing via Apps Script
- Google Sheet DB URL is public (by design for CSV access) — avoid sensitive data
- Session uses `localStorage` — suitable for internal tools, not high-security apps

---

## 🧩 Tech Stack
| Technology | Usage |
|------------|-------|
| HTML5 / CSS3 | Structure & styling |
| Vanilla JavaScript | App logic, no frameworks |
| Google Sheets (CSV) | Data source + user DB |
| Google Apps Script | Backend for signup, OTP |
| Google Fonts (Plus Jakarta Sans + DM Sans) | Typography |
| localStorage | Session + theme + pins + cache |

---

## 👤 Author
**Your Name** — Built from [PW Vidyapeeth Maharashtra](https://github.com/Ambikeshishere/Phyiscs_Wallah) template

---

## 📄 License
Internal use only. Not for public distribution.
