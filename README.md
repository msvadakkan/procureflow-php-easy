# ProcureFlow — PHP Easy

A self-hosted purchase approval and procurement system built for **cPanel / shared hosting**. No Docker, no Node.js — just PHP 8.1, MongoDB, and vanilla JavaScript.

![PHP](https://img.shields.io/badge/PHP-8.1+-777BB4?logo=php&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%2F%20Local-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Purchase requests** with multi-level approval chain (Employee → Manager → Dept Head → CEO)
- **Vendor portal** — vendors self-register, browse open tenders, submit competitive quotes
- **Tender management** — create requirements, collect and compare quotes
- **LPO generation** — Local Purchase Orders with VAT, print/PDF export
- **Admin panel** — manage users, roles, approval thresholds
- **Company branding** — set your organization name and logo from Settings → Companies
- **Email notifications** — optional SMTP (Office 365, Gmail, SendGrid, any provider)
- **Mobile responsive** — works on all screen sizes
- **Zero framework** — plain PHP + vanilla JS, runs on any Apache/cPanel host

---

## Requirements

- PHP 8.1 or higher
- `ext-mongodb` PHP extension
- Composer
- MongoDB — local, or [MongoDB Atlas free tier](https://www.mongodb.com/atlas) (cloud)
- Apache with `mod_rewrite` enabled

---

## Installation — Web Installer (recommended)

1. **Upload** this folder's contents to your `public_html` (or a subdirectory)

2. **Enable the MongoDB PHP extension** in cPanel:
   - cPanel → *Select PHP Version* → *Extensions* → tick `mongodb` → *Save*

3. **Install Composer dependencies** via SSH or cPanel Terminal:
   ```bash
   cd ~/public_html
   composer install --no-dev --optimize-autoloader
   ```

4. **Run the web installer** at `https://yoursite.com/install.php`
   - ✅ Step 1 — Requirements check
   - 🗄️ Step 2 — MongoDB connection + App URL
   - 👤 Step 3 — Create your super admin account
   - 🏢 Step 4 — Organization name & logo *(optional, can skip)*
   - 📧 Step 5 — SMTP email settings *(optional, can skip)*
   - 🚀 Step 6 — Install

5. **Delete `install.php`** from your server immediately after setup — leaving it accessible is a security risk.

6. **Log in** at `https://yoursite.com/` with the admin account you just created.

---

## Installation — SSH / CLI (faster)

```bash
cd ~/public_html

# Install PHP dependencies
composer install --no-dev --optimize-autoloader

# Create and configure environment
cp .env.example .env
nano .env     # set MONGO_URI, MONGO_DB, JWT_SECRET, APP_URL

# Seed the database (approval levels + indexes)
php includes/seed.php
```

Then create your admin user from the web installer or directly in MongoDB.

---

## MongoDB Atlas (free cloud database)

If your host doesn't provide MongoDB:

1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas) — free tier is sufficient
2. Create a free M0 cluster
3. Add your server's IP to the Atlas IP allowlist (or allow `0.0.0.0/0` for testing)
4. Copy the connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   ```
5. Paste it as `MONGO_URI` in `.env` or the web installer

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_DB` | Yes | Database name (e.g. `purchase_approval`) |
| `JWT_SECRET` | Yes | Random secret for signing tokens. Generate: `openssl rand -hex 32` |
| `APP_URL` | Yes | Public URL with no trailing slash (e.g. `https://yoursite.com`) |
| `SMTP_HOST` | No | SMTP server (leave blank to disable email) |
| `SMTP_PORT` | No | SMTP port (usually `587` for STARTTLS) |
| `SMTP_USER` | No | SMTP username / sender email |
| `SMTP_PASS` | No | SMTP password or App Password |
| `SMTP_FROM` | No | From address shown on notification emails |

---

## Project Structure

```
procureflow-php-easy/
├── index.html              # Landing page (loads company name/logo dynamically)
├── portal.html             # Staff SPA entry point
├── vendor-login.html       # Vendor sign-in
├── vendor-register.html    # Vendor self-registration
├── vendor-portal.html      # Vendor dashboard SPA
├── install.php             # Web installer — delete after setup!
├── .htaccess               # Apache URL rewriting (routes all API requests)
├── .env.example            # Environment template
├── composer.json           # PHP dependencies
│
├── api/
│   ├── index.php           # API router (.htaccess sends all /api/* here)
│   ├── auth.php            # Staff login + vendor login
│   ├── requests.php        # Purchase requests CRUD + approval actions
│   ├── vendors.php         # Vendor management
│   ├── tenders.php         # Tenders + quote submission
│   ├── lpos.php            # Local Purchase Orders
│   ├── companies.php       # Company registry + logo upload
│   ├── users.php           # User management
│   └── admin.php           # Approval thresholds, stats, public app-info
│
├── includes/
│   ├── bootstrap.php       # Loads .env, defines constants
│   ├── config.php          # DB connection + JWT constants
│   ├── auth.php            # JWT helpers + role middleware
│   └── seed.php            # Database seeder (approval levels + indexes)
│
├── assets/
│   ├── css/main.css        # All styles
│   └── js/
│       ├── api.js          # HTTP client (auto-detects base URL for subfolders)
│       ├── app.js          # Staff SPA — routing, pages, components
│       └── vendor-app.js   # Vendor portal SPA
│
└── uploads/                # Runtime uploads (gitignored; auto-created)
    ├── vendors/            # Vendor registration documents
    └── companies/          # Company logos
```

---

## User Roles

| Role | Can Create Requests | Approves Up To |
|---|---|---|
| `employee` | Yes | — |
| `manager` | Yes | AED 5,000 |
| `department_head` | Yes | AED 25,000 |
| `ceo` | Yes | Unlimited |
| `admin` | Yes | Full system access |

Approval thresholds are configurable in **Admin Panel → Approval Levels**.

---

## After Installation

1. **Set your organization** — Settings → Companies → New Company (name + logo)
2. **Add users** — Admin Panel → Users → Add User
3. **Configure approval thresholds** — Admin Panel → Approval Levels
4. **Register vendors** — share `https://yoursite.com/vendor-register.html`

---

## Updating

```bash
# Pull latest code (preserves .env and uploads/)
git pull origin main

# Update PHP dependencies if composer.json changed
composer install --no-dev --optimize-autoloader

# Re-run seeder if approval_levels structure changed
php includes/seed.php
```

---

## License

MIT — free to use, modify, and deploy.
