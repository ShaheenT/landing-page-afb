document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
  const signupButton = document.getElementById('signupButton');
  const submitButton = signupForm?.querySelector('button[type="submit"]');

  const successModal = document.getElementById('successModal');
  const closeModalBtn = document.getElementById('closeModal');

  // Scroll to signup section from hero button
  signupButton?.addEventListener('click', () => {
    document
      .getElementById('signup-section')
      ?.scrollIntoView({ behavior: 'smooth' });
  });

  // Close modal handler
  closeModalBtn?.addEventListener('click', () => {
    successModal.classList.add('hidden');
    successModal.classList.remove('flex');
  });

  async function getRecaptchaToken() {
    if (!window.grecaptcha || !grecaptcha.execute) return '';
    try {
      return await grecaptcha.execute('REPLACE_WITH_SITE_KEY', {
        action: 'signup'
      });
    } catch (err) {
      console.warn('reCAPTCHA execution failed', err);
      return '';
    }
  }

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
    }

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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      // Success path
      signupForm.reset();

      successModal.classList.remove('hidden');
      successModal.classList.add('flex');

    } catch (err) {
      console.error('Signup error:', err);
      alert(
        err.message ||
        'We were unable to complete your signup. Please try again later.'
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Get Started - Sign Up Now';
      }
    }
  });
});
