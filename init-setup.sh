#!/usr/bin/env bash
set -euo pipefail

timestamp() { date +"%Y%m%d-%H%M%S"; }
BACKUP_DIR="backup-$(timestamp)"
echo "Starting project scaffold... (backups -> ${BACKUP_DIR})"

mkdir -p "${BACKUP_DIR}"

# Safe move helper: moves file/dir to backup if it exists
safe_backup() {
  if [ -e "$1" ]; then
    echo "Backing up existing $1 -> ${BACKUP_DIR}/"
    mv "$1" "${BACKUP_DIR}/"
  fi
}

# 1) Create directory structure
echo "Creating directories..."
mkdir -p models public/assets

# 2) Move index.html or assets if they exist in root into public/
if [ -f "index.html" ]; then
  safe_backup public/index.html || true
  echo "Moving existing index.html -> public/index.html"
  mv index.html public/index.html
fi

if [ -d "assets" ]; then
  echo "Moving existing assets/ -> public/assets/"
  # if public/assets already exists, backup
  if [ -d "public/assets" ] && [ "$(ls -A public/assets)" ]; then
    safe_backup public/assets || true
    mkdir -p public/assets
  fi
  mv assets/* public/assets/ || true
fi

# 3) Create models/User.js
USER_MODEL="models/User.js"
if [ -f "$USER_MODEL" ]; then
  safe_backup "$USER_MODEL"
fi

cat > "$USER_MODEL" <<'JS'
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String, required: true },
  status: {
    type: String,
    enum: ["new", "contacted", "onboarded"],
    default: "new"
  },
  createdAt: { type: Date, default: Date.now }
});

// Ensure unique index on email at DB level
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
JS

echo "Created ${USER_MODEL}"

# 4) Create server.js (production-safe)
SERVER_FILE="server.js"
if [ -f "$SERVER_FILE" ]; then
  safe_backup "$SERVER_FILE"
fi

cat > "$SERVER_FILE" <<'JS'
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const path = require('path');
const fetch = require('node-fetch'); // for reCAPTCHA verification
const app = express();

const PORT = process.env.PORT || 3000;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '';
const RECAPTCHA_MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// MongoDB
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI missing in environment');
} else {
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));
}

const User = require('./models/User');

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

// Verify email transporter when possible (non-blocking)
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter.verify().then(() => console.log('✅ Email transporter ready')).catch(err => {
    console.warn('⚠️ Email transporter verify failed (check credentials):', err.message || err);
  });
}

// reCAPTCHA verification helper
async function verifyRecaptcha(token, remoteip) {
  if (!RECAPTCHA_SECRET) return { ok: true, score: 1.0 }; // bypass if not configured
  try {
    const resp = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(token)}${remoteip ? `&remoteip=${encodeURIComponent(remoteip)}` : ''}`
    });
    const data = await resp.json();
    return data;
  } catch (err) {
    console.error('reCAPTCHA verify error', err);
    return { success: false };
  }
}

// Signup endpoint
app.post('/api/signup', async (req, res) => {
  const { name, email, phone, recaptchaToken } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ message: 'name, email and phone are required' });
  }

  // Verify reCAPTCHA if configured
  if (RECAPTCHA_SECRET) {
    const verification = await verifyRecaptcha(recaptchaToken, req.ip);
    if (!verification || !verification.success) {
      return res.status(400).json({ message: 'reCAPTCHA verification failed' });
    }
    // Accept only if score >= threshold when using v3
    if (typeof verification.score === 'number' && verification.score < RECAPTCHA_MIN_SCORE) {
      return res.status(400).json({ message: 'reCAPTCHA score too low (possible bot)' });
    }
  }

  try {
    // Duplicate check handled by unique index, but we return friendly error
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({ message: 'This email is already registered' });
    }

    const user = await User.create({ name, email, phone });

    // Email admin
    if (process.env.ADMIN_EMAIL && process.env.EMAIL_USER) {
      await transporter.sendMail({
        from: `"Athaan Fi Beit" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: 'New Athaan Fi Beit Registration',
        html: `
          <h3>New Registration</h3>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Phone:</b> ${phone}</p>
          <p>Created at: ${user.createdAt}</p>
        `
      }).catch(err => console.error('Admin email send error:', err));
    } else {
      console.warn('ADMIN_EMAIL or EMAIL_USER not configured - skipping admin email.');
    }

    // Email user
    if (process.env.EMAIL_USER) {
      await transporter.sendMail({
        from: `"Athaan Fi Beit" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Welcome to Athaan Fi Beit',
        html: `
          <h3>Hello ${name},</h3>
          <p>Thank you for registering with Athaan Fi Beit. Our team will contact you shortly to arrange onboarding.</p>
        `
      }).catch(err => console.error('User email send error:', err));
    } else {
      console.warn('EMAIL_USER not configured - skipping user email.');
    }

    return res.json({ message: 'Signup successful' });

  } catch (err) {
    console.error('Signup error:', err);
    // If duplicate key error from mongo unique index
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'This email is already registered' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

// Admin & export endpoints will be added later
// Fallback - serve index.html for SPA/routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
JS

echo "Created ${SERVER_FILE}"

# 5) Create public/index.html (minimal landing + signup - reCAPTCHA v3 ready)
INDEX_HTML="public/index.html"
if [ -f "$INDEX_HTML" ]; then
  safe_backup "$INDEX_HTML"
fi

cat > "$INDEX_HTML" <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Athaan Fi Beit - Landing</title>
  <link rel="stylesheet" href="assets/main.css" />
  <!-- reCAPTCHA v3 script: set RECAPTCHA_SITE_KEY in your environment and update below before production -->
  <!-- Example: <script src="https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY"></script> -->
</head>
<body class="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 font-sans">
  <!-- (Simplified landing top-of-page) -->
  <main class="max-w-5xl mx-auto p-6">
    <section id="hero">
      <h1>Athaan Fi Beit</h1>
      <p>Automated prayer management for your home.</p>
      <button id="signupButton">Get Started - Sign Up Now</button>
    </section>

    <section id="signup-section" class="mt-8">
      <div class="card">
        <h2>Join the Athaan Fi Beit Family</h2>
        <form id="signup-form">
          <div>
            <label for="name">Full name</label>
            <input id="name" name="name" required />
          </div>
          <div>
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div>
            <label for="phone">Phone</label>
            <input id="phone" name="phone" required />
          </div>

          <input type="hidden" id="recaptchaToken" name="recaptchaToken" value="" />

          <button type="submit">Sign Up</button>
        </form>

        <p id="status" aria-live="polite"></p>
      </div>
    </section>

    <section id="footer" class="mt-16">
      <p>© 2025 Athaan Fi Beit</p>
    </section>
  </main>

  <script>
    // If using reCAPTCHA v3, put the site key in the HTML before deployment:
    // <script src="https://www.google.com/recaptcha/api.js?render=RECAPTCHA_SITE_KEY"></script>
    const signupForm = document.getElementById('signup-form');
    const statusP = document.getElementById('status');

    async function getRecaptchaToken() {
      if (!window.grecaptcha || !grecaptcha.execute) return '';
      try {
        const token = await grecaptcha.execute('REPLACE_WITH_SITE_KEY', { action: 'signup' });
        return token;
      } catch (err) {
        console.warn('reCAPTCHA token error', err);
        return '';
      }
    }

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusP.textContent = 'Submitting...';

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();

      // fetch token if reCAPTCHA configured
      let recaptchaToken = '';
      if (window.grecaptcha) {
        recaptchaToken = await getRecaptchaToken();
      }

      try {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, recaptchaToken })
        });

        const json = await res.json();
        if (res.ok) {
          statusP.textContent = 'Thank you — check your email for a welcome message.';
          signupForm.reset();
        } else {
          statusP.textContent = json.message || 'Signup failed.';
        }
      } catch (err) {
        console.error(err);
        statusP.textContent = 'Server error. Try again later.';
      }
    });

    // Optional scroll helper for hero button
    document.getElementById('signupButton')?.addEventListener('click', () => {
      document.getElementById('signup-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  </script>
</body>
</html>
HTML

echo "Created ${INDEX_HTML}"

# 6) Create package.json
PKG_JSON="package.json"
if [ -f "$PKG_JSON" ]; then
  safe_backup "$PKG_JSON"
fi

cat > "$PKG_JSON" <<'JSON'
{
  "name": "athaan-fi-beit",
  "version": "1.0.0",
  "description": "Athaan Fi Beit - landing + signup backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": "18.x"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.6.1",
    "nodemailer": "^6.9.4",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "node-fetch": "^2.6.7"
  }
}
JSON

echo "Created ${PKG_JSON}"

# 7) Create .env.example
ENV_EX=" .env.example"
ENV_EX=".env.example"
if [ -f "$ENV_EX" ]; then
  safe_backup "$ENV_EX"
fi

cat > "$ENV_EX" <<'ENV'
# Rename to .env for local testing (do NOT commit .env)
PORT=3000
MONGO_URI=your_mongodb_atlas_uri_here
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_gmail_app_password
ADMIN_EMAIL=admin@athaanfibeit.com

# Optional reCAPTCHA v3
RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
RECAPTCHA_SECRET=your_recaptcha_secret_here
RECAPTCHA_MIN_SCORE=0.5
ENV

echo "Created ${ENV_EX}"

echo "Scaffold complete."
echo "Next steps:"
echo "  1) Edit .env (or set env vars on Render). Do NOT commit secrets."
echo "  2) Run: npm install"
echo "  3) Run locally: node server.js"
echo "  4) Deploy to Render (set environment variables in Render dashboard)."

echo "Backups (if any) are in ${BACKUP_DIR}."
