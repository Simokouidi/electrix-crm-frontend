import * as storeModule from '../src/lib/store';

// Minimal mock harness since the store is React-based: we'll import the functions we changed
// and call them with mocked fetch to simulate backend responses.

async function run() {
  // Mock global fetch
  const calls: any[] = [];
  (global as any).fetch = async (url: string, opts: any) => {
    calls.push({ url, opts });
    if (url.includes('/api/clients')) {
      // Return created client
      return {
        ok: true,
        json: async () => ({ id: 9999, ...JSON.parse(opts.body) }),
      };
    }
    if (url.includes('/api/activities')) {
      // Return created activity
      return {
        ok: true,
        json: async () => ({ id: 7777, ...JSON.parse(opts.body) }),
      };
    }
    return { ok: false, status: 404 };
  };

  // Call addClient from store module
  const clientPayload = { firstName: 'Mock', lastName: 'Client', company: 'MockCo', phone: '000', email: 'mock+' + Date.now() + '@example.com' };

  // Some store implementations expect a default export or named export; check and call accordingly
  const addClient = (storeModule as any).addClient || (storeModule as any).default?.addClient;
  if (!addClient) {
    console.error('addClient not found in store module exports');
    process.exit(2);
  }

  console.log('Calling addClient mock');
  await addClient(clientPayload);

  console.log('Fetch calls:', JSON.stringify(calls, null, 2));
  const activityCall = calls.find(c => c.url.includes('/api/activities'));
  if (!activityCall) {
    console.error('No activity POST detected');
    process.exit(1);
  }

  console.log('Activity POST body:', activityCall.opts.body);
  console.log('Mock test passed');
}

run().catch(e => { console.error(e); process.exit(1); });
