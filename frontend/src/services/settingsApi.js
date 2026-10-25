const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function authHeaders() {
  const token = localStorage.getItem('bookai_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getAiSettings() {
  const res = await fetch(`${API}/settings/ai`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load AI settings');
  return res.json();
}

export async function updateAiSettings(payload) {
  const res = await fetch(`${API}/settings/ai`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update AI settings');
  }
  return res.json();
}
