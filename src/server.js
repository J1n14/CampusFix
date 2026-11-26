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
// Keep private staff metadata out of the public API.
const requestColumns = 'id, title, location, issue_type, description, priority, status, created_at, updated_at';

app.use(express.json());
// Serve the complete dashboard (HTML, JavaScript, styles, and other assets).
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

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
app.post('/api/requests', async (req, res) => {
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CampusFix API listening on port ${PORT}`);
});
