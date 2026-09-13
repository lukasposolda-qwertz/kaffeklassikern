export function validContactEndpoint(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'formspree.io' &&
      !url.username && !url.password && !url.port && !url.search && !url.hash &&
      /^\/f\/[a-zA-Z0-9]+$/.test(url.pathname);
  } catch { return false; }
}

export async function sendContact(payload, endpoint, fetcher = fetch) {
  if (!validContactEndpoint(endpoint)) throw new Error('Contact is not available yet. Please try again later.');
  const email = String(payload.email || '').trim();
  const message = String(payload.message || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      message.length < 10 || message.length > 5000) {
    throw new Error('Check your email and note. Notes need 10–5,000 characters.');
  }
  if (payload.website) throw new Error('Your message could not be sent. Please try again.');
  let response;
  try {
    response = await fetcher(endpoint, {
      method: 'POST', headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify({email, message, _gotcha: ''}),
      signal: AbortSignal.timeout(20000), credentials: 'omit', referrerPolicy: 'no-referrer'
    });
  } catch { throw new Error('We could not confirm delivery. Your message is still here; please try again.'); }
  if (response.status === 429) throw new Error('Too many messages right now. Your draft is still here; please try again later.');
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.errors || result.ok === false) {
    throw new Error('Your message could not be sent. Your draft is still here; please try again later.');
  }
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#contact-form');
  const status = document.querySelector('#contact-status');
  const submit = form.querySelector('[type="submit"]');
  let endpoint = '';
  let sending = false;
  fetch(new URL('./site-config.json', import.meta.url))
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      if (validContactEndpoint(config?.contactEndpoint)) {
        endpoint = config.contactEndpoint;
        submit.disabled = false;
        status.textContent = '';
      } else status.textContent = 'The contact form is not open yet. Please check back soon.';
    }).catch(() => { status.textContent = 'Contact is temporarily unavailable. Please try again later.'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    sending = true;
    submit.disabled = true;
    status.textContent = 'Sending your message…';
    try {
      await sendContact(Object.fromEntries(new FormData(form)), endpoint);
      form.reset();
      status.textContent = 'Thank you—your message has been sent. We’ll take a look and reply if needed.';
    } catch (error) { status.textContent = error.message; }
    finally { sending = false; submit.disabled = !validContactEndpoint(endpoint); }
  });
}
