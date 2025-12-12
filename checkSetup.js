require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

console.log('🔹 Starting project environment check...\n');

// --- ENVIRONMENT CHECKS ---
const PORT = process.env.PORT;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const MONGO_URI = process.env.MONGO_URI;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;

function checkEnv(name, value) {
  if (!value) console.warn(`❌ ${name} is missing`);
  else console.log(`✅ ${name} is set`);
}

checkEnv('PORT', PORT);
checkEnv('EMAIL_USER', EMAIL_USER);
checkEnv('EMAIL_PASS', EMAIL_PASS);
checkEnv('ADMIN_EMAIL', ADMIN_EMAIL);
checkEnv('MONGO_URI', MONGO_URI);
checkEnv('RECAPTCHA_SECRET', RECAPTCHA_SECRET);

// --- PUBLIC FILE CHECK ---
const indexPath = path.join(__dirname, 'public', 'index.html');
const fs = require('fs');
if (fs.existsSync(indexPath)) console.log('✅ public/index.html is set');
else console.warn('❌ public/index.html is missing');

// --- MONGODB CONNECTION ---
let User = null;
async function connectMongo() {
  if (!MONGO_URI) {
    console.warn('⚠️ MONGO_URI missing — skipping MongoDB connection');
    return;
  }
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ MongoDB connection successful');

    // Load User model
    try {
      User = require(path.join(__dirname, 'athaan-backend', 'models', 'User'));
      console.log('✅ User model loaded');
    } catch (err) {
      console.warn('❌ Could not load User model:', err.message);
    }
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
  }
}

// --- EMAIL TRANSPORTER ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER || '', pass: EMAIL_PASS || '' }
});

async function verifyEmail() {
  if (!EMAIL_USER || !EMAIL_PASS) return;
  try {
    await transporter.verify();
    console.log('✅ Email transporter verified');
  } catch (err) {
    console.warn('❌ Email transporter verification failed:', err.message);
  }
}

// --- reCAPTCHA CHECK ---
async function checkRecaptcha() {
  if (!RECAPTCHA_SECRET) return;
  try {
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=dummy`
    });
    const data = await resp.json();
    console.log('✅ reCAPTCHA API reachable, test response:', data);
  } catch (err) {
    console.warn('❌ reCAPTCHA API check failed:', err.message);
  }
}

// --- DRY-RUN SIGNUP TEST ---
async function dryRunSignup() {
  console.log('\n🔹 Running dry-run signup test...');
  if (!User) {
    console.warn('⚠️ Skipping signup test: User model not available');
    return;
  }

  const dummyUser = {
    name: 'Test User',
    email: 'testuser@example.com',
    phone: '1234567890',
    password: 'Test1234!' // Added to satisfy schema validation
  };

  try {
    const exists = await User.findOne({ email: dummyUser.email });
    if (exists) {
      console.log('⚠️ Dummy user already exists — skipping creation');
    } else {
      await User.create(dummyUser);
      console.log('✅ Dummy user created in MongoDB');
      await User.deleteOne({ email: dummyUser.email });
      console.log('✅ Dummy user removed from MongoDB after test');
    }

    if (transporter) {
      await transporter.sendMail({
        from: `"Test Signup" <${EMAIL_USER}>`,
        to: dummyUser.email,
        subject: 'Test Signup Email',
        html: `<p>This is a test email for ${dummyUser.name}</p>`
      });
      console.log('✅ Test email sent (to dummy email, may be rejected by provider)');
    }
  } catch (err) {
    console.error('❌ Dry-run signup failed:', err.message);
  }
}

// --- RUN CHECKS SEQUENTIALLY ---
(async () => {
  await connectMongo();
  await verifyEmail();
  await checkRecaptcha();
  await dryRunSignup();
  console.log('\n🔹 Project environment check complete');
  process.exit(0);
})();
