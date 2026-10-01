const BASE = 'http://localhost:5000/api';

async function testPipeline() {
  console.log('--- 1. Testing Health Endpoint ---');
  const healthRes = await fetch(`${BASE}/health`).then(r => r.json());
  console.log('Health:', healthRes);

  console.log('\n--- 2. Testing Login Endpoint (Alex Morgan) ---');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'alex@example.com', password: 'password123' }),
  }).then(r => r.json());
  console.log('Login Success:', loginRes.success, '| User:', loginRes.user?.fullName);
  const token = loginRes.token;

  console.log('\n--- 3. Testing Registered Users Conversation List ---');
  const usersRes = await fetch(`${BASE}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());
  console.log(`Found ${usersRes.count} registered users for dashboard:`);
  usersRes.users.forEach(u => {
    console.log(` - ${u.fullName} (@${u.username}) | Last msg: "${u.lastMessage?.content || 'None'}" | Unread: ${u.unreadCount}`);
  });

  const sarah = usersRes.users.find(u => u.username === 'sarahc');
  if (sarah) {
    console.log(`\n--- 4. Fetching Messages with Sarah Chen (${sarah._id}) ---`);
    const msgsRes = await fetch(`${BASE}/messages/${sarah._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    console.log(`Retrieved ${msgsRes.messages?.length} messages with Sarah:`);
    msgsRes.messages.forEach(m => {
      const who = m.senderId === loginRes.user._id ? 'You' : 'Sarah';
      console.log(`   [${who}]: ${m.content} (Read: ${m.read})`);
    });

    console.log('\n--- 5. Sending a New Message to Sarah ---');
    const sendRes = await fetch(`${BASE}/messages/send/${sarah._id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: 'Hello Sarah! Realtime MERN messaging is fully working! 🚀✨' }),
    }).then(r => r.json());
    console.log('Send Message Result:', sendRes.success, '| Content:', sendRes.message?.content);

    console.log('\n--- 6. Verifying Message Feed Updated ---');
    const updatedMsgs = await fetch(`${BASE}/messages/${sarah._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    console.log(`Total messages with Sarah now: ${updatedMsgs.messages?.length}`);
  }

  console.log('\n--- 7. Testing New User Registration (Signup) ---');
  const testUser = {
    fullName: 'Jane Doe',
    username: 'janedoe_' + Date.now().toString().slice(-4),
    email: `jane_${Date.now()}@example.com`,
    password: 'password123',
    bio: 'Excited to test PulseChat!',
  };
  const signupRes = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
  }).then(r => r.json());
  console.log('Signup Result:', signupRes.success, '| New Member:', signupRes.user?.fullName, `(@${signupRes.user?.username})`);

  console.log('\n--- 8. Verifying New Member Appears in Registered Users List ---');
  const refreshedUsers = await fetch(`${BASE}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());
  console.log(`Total registered members in dashboard now: ${refreshedUsers.count}`);
}

testPipeline().catch(console.error);
