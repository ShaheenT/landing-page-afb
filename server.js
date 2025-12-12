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

const User = require('./athaan-backend/models/User');

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
