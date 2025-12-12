require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

console.log('🔎 Running project setup validation...\n');

async function runChecks() {
  let errors = [];

  // 1️⃣ Check folders
  const folders = ['models', 'public', path.join('public', 'assets')];
  folders.forEach(f => {
    if (!fs.existsSync(f)) errors.push(`❌ Missing folder: ${f}`);
    else console.log(`✅ Found folder: ${f}`);
  });

  // 2️⃣ Check files
  const files = [path.join('public', 'index.html'), path.join('models', 'User.js')];
  files.forEach(f => {
    if (!fs.existsSync(f)) errors.push(`❌ Missing file: ${f}`);
    else console.log(`✅ Found file: ${f}`);
  });

  // 3️⃣ Check environment variables
  const requiredEnv = ['MONGO_URI', 'EMAIL_USER', 'EMAIL_PASS', 'ADMIN_EMAIL'];
  requiredEnv.forEach(key => {
    if (!process.env[key]) errors.push(`❌ Missing environment variable: ${key}`);
    else console.log(`✅ Environment variable ${key} is set`);
  });

  if (!process.env.RECAPTCHA_SECRET) console.warn('⚠️ RECAPTCHA_SECRET not set (will bypass verification)');

  // 4️⃣ Check MongoDB connection
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log('✅ MongoDB connection successful');
      await mongoose.disconnect();
    } catch (err) {
      errors.push(`❌ MongoDB connection failed: ${err.message}`);
    }
  }

  // 5️⃣ Check Nodemailer
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    try {
      await transporter.verify();
      console.log('✅ Nodemailer credentials verified');
    } catch (err) {
      errors.push(`❌ Nodemailer verification failed: ${err.message}`);
    }
  }

  // 6️⃣ Optional: reCAPTCHA test
  if (process.env.RECAPTCHA_SECRET) {
    try {
      const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(process.env.RECAPTCHA_SECRET)}&response=test`
      });
      const data = await resp.json();
      console.log(`ℹ️ reCAPTCHA test response: ${JSON.stringify(data)}`);
    } catch (err) {
      console.warn('⚠️ reCAPTCHA verification test failed:', err.message);
    }
  }

  // Summary
  if (errors.length === 0) console.log('\n🎉 All checks passed! Ready for Render deployment.');
  else {
    console.log('\n❌ Setup validation completed with errors:');
    errors.forEach(e => console.log(e));
    process.exit(1);
  }
}

runChecks();
