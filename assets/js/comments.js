/*
  SETUP — do this once before comments work:

  1. Go to https://supabase.com and create a free account + new project.

  2. In your Supabase project, open the SQL Editor and run this:

      create extension if not exists "pgcrypto";

      create table comments (
        id          uuid default gen_random_uuid() primary key,
        post_slug   text not null,
        name        text not null,
        email       text not null,
        body        text not null,
        approved    boolean default false,
        created_at  timestamptz default now()
      );

      alter table comments enable row level security;

      create policy "anyone can comment"
        on comments for insert to anon
        with check (true);

      create policy "read approved only"
        on comments for select to anon
        using (approved = true);

  3. Go to Settings → API in your Supabase project.
     Copy "Project URL" and "anon public" key into the two lines below.

  4. To approve a comment: go to Table Editor → comments → toggle approved = true.
*/

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// ── Init ──────────────────────────────────────────────────────────────────────

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const form = document.getElementById('comment-form');
const postSlug = form.dataset.slug;

// ── Email validation ───────────────────────────────────────────────────────────

function isValidEmailFormat(email) {
  // RFC 5322 simplified — requires local@domain.tld with valid chars
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email);
}

async function domainHasMX(email) {
  const domain = email.split('@')[1];
  if (!domain) return false;
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { signal: AbortSignal.timeout(4000) }
    );
    const data = await res.json();
    // Status 0 = NOERROR, Answer array contains MX records
    return data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0;
  } catch {
    return true; // fail open — don't block on DNS timeout
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function setError(msg) {
  document.getElementById('form-error').textContent = msg;
  document.getElementById('form-success').textContent = '';
}

function setSuccess(msg) {
  document.getElementById('form-success').textContent = msg;
  document.getElementById('form-error').textContent = '';
}

// ── Load and render approved comments ─────────────────────────────────────────

async function loadComments() {
  const list = document.getElementById('comments-list');

  const { data, error } = await db
    .from('comments')
    .select('name, body, created_at')
    .eq('post_slug', postSlug)
    .eq('approved', true)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) {
    list.innerHTML = '<p class="no-comments">No comments yet — be the first.</p>';
    return;
  }

  list.innerHTML = data.map(c => `
    <div class="comment">
      <div class="comment-meta">
        <span class="comment-author">${escapeHtml(c.name)}</span>
        <span class="comment-date">${formatDate(c.created_at)}</span>
      </div>
      <p class="comment-body">${escapeHtml(c.body)}</p>
    </div>
  `).join('');
}

// ── Handle submission ─────────────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = form.querySelector('.form-submit');
  const name = form.name.value.trim();
  const email = form.email.value.trim().toLowerCase();
  const body = form.body.value.trim();

  setError('');

  if (!name || !email || !body) {
    setError('All fields are required.');
    return;
  }

  if (name.length < 2) {
    setError('Please enter your full name.');
    return;
  }

  if (!isValidEmailFormat(email)) {
    setError('That doesn\'t look like a valid email address.');
    return;
  }

  btn.textContent = 'Checking email…';
  btn.disabled = true;

  const mxOk = await domainHasMX(email);
  if (!mxOk) {
    setError('That email domain doesn\'t appear to exist. Please double-check it.');
    btn.textContent = 'Leave a comment';
    btn.disabled = false;
    return;
  }

  btn.textContent = 'Submitting…';

  const { error } = await db.from('comments').insert({
    post_slug: postSlug,
    name,
    email,
    body,
  });

  btn.textContent = 'Leave a comment';
  btn.disabled = false;

  if (error) {
    setError('Something went wrong. Please try again.');
    return;
  }

  form.reset();
  setSuccess('Your comment was submitted and will appear after a quick review. Thank you.');
});

// ── Run ───────────────────────────────────────────────────────────────────────

loadComments();
