document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
  const statusP = document.getElementById('status');
  const signupButton = document.getElementById('signupButton');

  // Scroll to signup section when button clicked
  signupButton?.addEventListener('click', () => {
    document.getElementById('signup-section')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Optional reCAPTCHA v3 token
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
    statusP.classList.remove('text-green-600', 'text-red-600');

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();

    let recaptchaToken = '';
    if (window.grecaptcha) recaptchaToken = await getRecaptchaToken();

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, recaptchaToken })
      });

      const json = await res.json();

      if (res.ok) {
        // Success
        statusP.textContent = json.message || 'Signup successful — check your email';
        statusP.classList.add('text-green-600');

        // Auto-clear form
        signupForm.reset();
      } else {
        // Error (duplicate, validation, or recaptcha fail)
        statusP.textContent = json.message || 'Signup failed.';
        statusP.classList.add('text-red-600');
      }
    } catch (err) {
      console.error(err);
      statusP.textContent = 'Server error. Try again later.';
      statusP.classList.add('text-red-600');
    }
  });
});
