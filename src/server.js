require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const serviceSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const adminEmails = new Set((process.env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
// Keep private staff metadata out of the public API.
const requestColumns = 'id, title, location, issue_type, description, priority, status, created_at, updated_at';

app.use(express.json());
// Serve the complete dashboard (HTML, JavaScript, styles, and other assets).
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

function bearerToken(req) {
  const match = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function authenticatedUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user || null;
}

async function requireAuth(req, res, next) {
  try {
    req.user = await authenticatedUser(req);
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
    next();
  } catch (error) {
    console.error('Authentication error', error);
    res.status(401).json({ error: 'Your session could not be verified. Please sign in again.' });
  }
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    const email = String(req.user.email || '').toLowerCase();
    if (!adminEmails.has(email)) return res.status(403).json({ error: 'This account does not have facilities admin access.' });
    if (!serviceSupabase) return res.status(503).json({ error: 'Admin service is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.' });
    next();
  });
}

app.post('/api/auth/signup', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const fullName = String(req.body.full_name || '').trim().slice(0, 100);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters.' });
  try {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) return res.status(400).json({ error: error.message });
    res.status(data.session ? 201 : 202).json({ session: data.session, user: data.user, message: data.session ? 'Account created.' : 'Check your email to confirm your account, then sign in.' });
  } catch (error) {
    console.error('Sign-up error', error);
    res.status(500).json({ error: 'Could not create your account right now.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: 'Email or password is incorrect.' });
    res.json({ session: data.session, user: data.user });
  } catch (error) {
    console.error('Sign-in error', error);
    res.status(500).json({ error: 'Could not sign in right now.' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = String(req.body.refresh_token || '');
  if (!refreshToken) return res.status(400).json({ error: 'A refresh token is required.' });
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    res.json({ session: data.session });
  } catch (error) {
    console.error('Session refresh error', error);
    res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await authenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Not signed in.' });
    res.json({ user: { id: user.id, email: user.email }, isAdmin: adminEmails.has(String(user.email || '').toLowerCase()) });
  } catch (error) {
    res.status(401).json({ error: 'Your session could not be verified.' });
  }
});

// ---------- Validation ----------
function validateRequest(body) {
  const errors = [];
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    errors.push('Title is required');
  }
  if (!body.location || typeof body.location !== 'string' || !body.location.trim()) {
    errors.push('Location is required');
  }
  if (!['lighting', 'plumbing', 'furniture', 'other'].includes(body.issue_type)) {
    errors.push('Issue type is invalid');
  }
  if (!body.description || typeof body.description !== 'string' || !body.description.trim()) {
    errors.push('Description is required');
  }
  if (!['low', 'medium', 'high'].includes(body.priority)) {
    errors.push('Priority is invalid');
  }
  // status will default to 'open' if not supplied
  return errors;
}

// ---------- API ----------
// Get summary counts for dashboard
app.get('/api/summary', async (req, res) => {
  try {
    const total = await supabase.from('requests').select('id', { count: 'exact', head: true });
    const open = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'open');
    const inProgress = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'in_progress');
    const resolved = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'resolved');
    if (total.error || open.error || inProgress.error || resolved.error) {
      console.error('Summary error', total.error, open.error, inProgress.error, resolved.error);
      return res.status(500).json({ error: 'Failed to compute summary' });
    }
    res.json({
      total: total.count,
      open: open.count,
      in_progress: inProgress.count,
      resolved: resolved.count,
    });
  } catch (e) {
    console.error('Summary exception', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all requests with optional filters
app.get('/api/requests', async (req, res) => {
  const { search, status, category, priority, sort, limit } = req.query;
  let query = supabase.from('requests').select(requestColumns);
  if (search) query = query.ilike('title', `%${search}%`);
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('issue_type', category);
  if (priority) query = query.eq('priority', priority);
  query = query.order(sort === 'priority' ? 'priority' : 'created_at', { ascending: sort === 'priority' });
  const requestedLimit = Number.parseInt(limit, 10);
  if (Number.isInteger(requestedLimit) && requestedLimit > 0) query = query.limit(Math.min(requestedLimit, 100));
  const { data, error } = await query;
  if (error) {
    console.error('Fetch error', error);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
  res.status(200).json(data);
});

// Get single request by id
app.get('/api/requests/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('requests')
    .select(requestColumns)
    .eq('id', req.params.id)
    .single();
  if (error) {
    console.error('Fetch single error', error);
    return res.status(404).json({ error: 'Request not found' });
  }
  res.status(200).json(data);
});

// Create a new request
app.post('/api/requests', requireAuth, async (req, res) => {
  const errors = validateRequest(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }
  const {
    title,
    location,
    issue_type,
    description,
    priority,
  } = req.body;
  const { data, error } = await supabase
    .from('requests')
    .insert({
      title,
      location,
      issue_type,
      description,
      priority,
    })
    .select(requestColumns)
    .single();
  if (error) {
    console.error('Insert error', error);
    return res.status(500).json({ error: 'Failed to save request' });
  }
  res.status(201).json(data);
});

app.get('/api/admin/requests', requireAdmin, async (req, res) => {
  const { data, error } = await serviceSupabase.from('requests').select(requestColumns).order('created_at', { ascending: false }).limit(200);
  if (error) {
    console.error('Admin request list error', error);
    return res.status(500).json({ error: 'Could not load admin requests.' });
  }
  res.json(data);
});

app.patch('/api/admin/requests/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['open', 'in_progress', 'resolved'].includes(status)) return res.status(400).json({ error: 'Choose a valid request status.' });
  const { data, error } = await serviceSupabase.from('requests').update({ status }).eq('id', req.params.id).select(requestColumns).single();
  if (error) {
    console.error('Admin request update error', error);
    return res.status(404).json({ error: 'Request not found or could not be updated.' });
  }
  res.json(data);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CampusFix API listening on port ${PORT}`);
});
