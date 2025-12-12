// Scroll to signup
document.getElementById('signupButton').addEventListener('click', () => {
  document.getElementById('signup').scrollIntoView({ behavior: 'smooth' });
});

// Signup form submission
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value
  };

  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      alert('Registration received! We will contact you shortly.');
      e.target.reset();
    } else {
      alert('Error submitting form. Please try again.');
    }
  } catch (err) {
    console.error(err);
    alert('Unexpected error. Please try again later.');
  }
});
