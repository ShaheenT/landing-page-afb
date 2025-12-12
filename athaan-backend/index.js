require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '';
const RECAPTCHA_MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
if (!process.env.MONGO_URI) {
  console.warn('⚠️ MONGO_URI missing — fallback to in-memory storage');
} else {
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));
}

// User model
const User = process.env.MONGO_URI ? require('./models/User') : null;
const signups = []; // in-memory fallback

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER || '', pass: process.env.EMAIL_PASS || '' }
});
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter.verify().then(() => console.log('✅ Email transporter ready')).catch(err => console.warn(err.message));
}

// reCAPTCHA verification
async function verifyRecaptcha(token, remoteip) {
  if (!RECAPTCHA_SECRET) return { success: true, score: 1 };
  try {
    const resp = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(token)}${remoteip ? `&remoteip=${encodeURIComponent(remoteip)}` : ''}`
    });
    const data = await resp.json();
    return data;
  } catch (err) {
    console.error('reCAPTCHA verify error:', err);
    return { success: false };
  }
}

// Signup endpoint
app.post('/api/signup', async (req, res) => {
  const { name, email, phone, recaptchaToken } = req.body;
  if (!name || !email || !phone) return res.status(400).json({ message: 'All fields are required' });

  // Verify reCAPTCHA if configured
  if (RECAPTCHA_SECRET) {
    const verification = await verifyRecaptcha(recaptchaToken, req.ip);
    if (!verification.success || (verification.score && verification.score < RECAPTCHA_MIN_SCORE)) {
      return res.status(400).json({ message: 'reCAPTCHA verification failed' });
    }
  }

  try {
    let user;
    if (User) {
      // MongoDB storage
      const existing = await User.findOne({ email }).lean();
      if (existing) return res.status(409).json({ message: 'Email already registered' });
      user = await User.create({ name, email, phone });
    } else {
      // In-memory fallback
      if (signups.find(u => u.email === email)) return res.status(409).json({ message: 'Email already registered' });
      user = { name, email, phone, date: new Date() };
      signups.push(user);
    }

    // Admin notification
    if (process.env.ADMIN_EMAIL && process.env.EMAIL_USER) {
      await transporter.sendMail({
        from: `"Athaan Fi Beit" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: 'New Athaan Fi Beit Signup',
        html: `<h3>New Signup</h3><p><b>Name:</b> ${name}</p><p><b>Email:</b> ${email}</p><p><b>Phone:</b> ${phone}</p>`
      }).catch(err => console.error('Admin email error:', err));
    }

    // User confirmation
    if (process.env.EMAIL_USER) {
      await transporter.sendMail({
        from: `"Athaan Fi Beit" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Welcome to Athaan Fi Beit',
        html: `<p>Hello <strong>${name}</strong>,</p><p>Thank you for registering. We will contact you shortly.</p>`
      }).catch(err => console.error('User email error:', err));
    }

    return res.json({ message: 'Signup successful — check your email' });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Serve frontend for SPA
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
