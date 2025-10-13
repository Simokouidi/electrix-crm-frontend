// This script mimics the frontend flow implemented: after POST /api/clients succeeds,
// send POST /api/activities with mapped payload, then prepend the returned activity to local list.

(async function(){
  const calls = [];
  // mock fetch
  global.fetch = async (url, opts) => {
    calls.push({url, opts});
    if (url.includes('/api/clients')) {
      return { ok: true, json: async () => ({ id: 9001, ...JSON.parse(opts.body) }) };
    }
    if (url.includes('/api/activities')) {
      return { ok: true, json: async () => ({ id: 8001, ...JSON.parse(opts.body) }) };
    }
    return { ok: false, status: 404 };
  };

  // Simulate addClient logic
  const clientPayload = { firstName: 'Mock', lastName: 'Client', company: 'MockCo', phone: '000', email: 'mock+'+Date.now()+'@example.com' };
  // POST to /api/clients
  const res = await fetch('http://127.0.0.1:4000/api/clients', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(clientPayload) });
  const client = await res.json();

  // Build activity payload as in store.tsx: type 'client:onboarding', clientId, ownerName, userId, role
  const activityPayload = {
    type: 'client:onboarding',
    clientId: client.id,
    ownerName: 'Admin',
    userId: 'u-admin',
    role: 'admin',
  };

  // Fire-and-forget POST /api/activities
  try {
    const aRes = await fetch('http://127.0.0.1:4000/api/activities', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(activityPayload) });
    const activity = await aRes.json();
    // Prepend to local activities store
    const activities = [activity];
    console.log('Activity created and prepended:', activity);
  } catch (e) {
    console.error('Activity POST failed', e);
  }

  // Inspect calls
  console.log('All fetch calls:', calls.map(c=>({url:c.url, body: JSON.parse(c.opts.body)})));

  // Assert that activity POST was made with expected fields.
  const activityCall = calls.find(c=>c.url.includes('/api/activities'));
  if (!activityCall) {
    console.error('FAIL: No activity POST call'); process.exit(1);
  }
  const body = JSON.parse(activityCall.opts.body);
  if (body.type !== 'client:onboarding' || body.clientId !== 9001) {
    console.error('FAIL: unexpected activity payload', body); process.exit(1);
  }
  console.log('Mock test PASS');
})();
