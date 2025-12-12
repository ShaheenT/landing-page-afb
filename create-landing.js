const fs = require('fs');
const path = require('path');

// Project directories
const publicDir = path.join(__dirname, 'public');
const assetsDir = path.join(publicDir, 'assets');

// Ensure directories exist
[publicDir, assetsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created folder: ${dir}`);
  }
});

// index.html content
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Athaan Fi Beit - Landing</title>
  <link rel="stylesheet" href="assets/main.css" />
  <script src="https://www.google.com/recaptcha/api.js?render=REPLACE_WITH_SITE_KEY"></script>
</head>
<body>
  <header class="header">
    <img src="assets/athaanfi-logo.png" alt="Athaan Fi Beit Logo" class="logo" />
    <h1>Athaan Fi Beit</h1>
    <p>Automated prayer management for your home</p>
    <button id="signupButton">Sign Up Now</button>
  </header>

  <main class="main">
    <section id="signup-section" class="card">
      <h2>Join the Athaan Fi Beit Family</h2>
      <form id="signup-form">
        <label for="name">Full Name</label>
        <input type="text" id="name" name="name" required />

        <label for="email">Email</label>
        <input type="email" id="email" name="email" required />

        <label for="phone">Phone</label>
        <input type="text" id="phone" name="phone" required />

        <input type="hidden" id="recaptchaToken" name="recaptchaToken" />

        <button type="submit">Sign Up</button>
      </form>
      <p id="status" aria-live="polite"></p>
    </section>
  </main>

  <footer class="footer">
    <p>© 2025 Athaan Fi Beit</p>
  </footer>

  <script src="signup.js"></script>
</body>
</html>
`;

// signup.js content
const signupJs = `document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
  const statusP = document.getElementById('status');
  const signupButton = document.getElementById('signupButton');

  signupButton?.addEventListener('click', () => {
    document.getElementById('signup-section')?.scrollIntoView({ behavior: 'smooth' });
  });

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
});
`;

// main.css content
const mainCss = `body, html {
  margin: 0;
  padding: 0;
  font-family: 'Helvetica', sans-serif;
  background: linear-gradient(to bottom right, #d1fae5, #ffffff, #e0f2fe);
  color: #111;
}

.header {
  text-align: center;
  padding: 3rem 1rem;
}

.header .logo {
  max-width: 120px;
  margin-bottom: 1rem;
}

.header h1 {
  font-size: 2.5rem;
  margin: 0.5rem 0;
}

.header p {
  font-size: 1.2rem;
  margin-bottom: 1rem;
}

.header button {
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 6px;
  background-color: #10b981;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.header button:hover {
  background-color: #059669;
}

.main {
  max-width: 500px;
  margin: 2rem auto;
  padding: 1rem;
}

.card {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
}

.card h2 {
  margin-top: 0;
  font-size: 1.8rem;
  margin-bottom: 1rem;
  text-align: center;
}

.card label {
  display: block;
  margin-top: 1rem;
  font-weight: bold;
}

.card input {
  width: 100%;
  padding: 0.6rem;
  margin-top: 0.3rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  box-sizing: border-box;
}

.card button {
  margin-top: 1.5rem;
  width: 100%;
  padding: 0.8rem;
  background-color: #3b82f6;
  border: none;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.card button:hover {
  background-color: #2563eb;
}

.footer {
  text-align: center;
  padding: 2rem 1rem;
  font-size: 0.9rem;
  color: #555;
}
`;

// Write files
fs.writeFileSync(path.join(publicDir, 'index.html'), indexHtml);
console.log('✅ Created index.html');

fs.writeFileSync(path.join(publicDir, 'signup.js'), signupJs);
console.log('✅ Created signup.js');

fs.writeFileSync(path.join(assetsDir, 'main.css'), mainCss);
console.log('✅ Created assets/main.css');

console.log('🎉 Landing page files generated successfully! Place your logo in assets/athaanfi-logo.png');
