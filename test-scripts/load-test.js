const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * LOAD TEST SCRIPT: 10,000 Users Simulation
 * Commands: 
 *   - register/login
 *   - vote (voting-id)
 *   - delete (clean up users - optional)
 */

const API_URL = 'http://localhost/api'; // Adjust if needed
const USERS_FILE = path.join(__dirname, 'users-10k.json');
const BATCH_SIZE = 50; // Concurrent requests

async function registerUsers(count = 10000) {
  const users = [];
  console.log(`🚀 Starting registration of ${count} users...`);

  for (let i = 0; i < count; i += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE && (i + j) < count; j++) {
      const id = i + j;
      const email = `user${id}@loadtest.local`;
      const name = `LoadUser ${id}`;
      const password = 'Password123!';
      
      batch.push(
        axios.post(`${API_URL}/auth/register`, { email, name, password })
          .then(res => {
            users.push({ email, password, token: res.data.accessToken });
            if (users.length % 500 === 0) console.log(`✅ Registered ${users.length} users...`);
          })
          .catch(err => {
             // If already exists, try to login
             return axios.post(`${API_URL}/auth/login`, { email, password })
               .then(res => {
                 users.push({ email, password, token: res.data.accessToken });
               })
               .catch(e => console.error(`❌ Failed for ${email}: ${e.message}`));
          })
      );
    }
    await Promise.all(batch);
  }

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log(`💾 Saved ${users.length} users to ${USERS_FILE}`);
  return users;
}

async function castVotes(votingId, optionId) {
  if (!fs.existsSync(USERS_FILE)) {
    console.error('❌ Users file not found. Run register first.');
    return;
  }

  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  console.log(`🗳️ Starting voting simulation for ${users.length} users on voting ${votingId}...`);

  let successCount = 0;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE && (i + j) < users.length; j++) {
      const user = users[i + j];
      batch.push(
        axios.post(`${API_URL}/votings/${votingId}/vote`, 
          { optionIds: [optionId] },
          { headers: { Authorization: `Bearer ${user.token}` } }
        )
        .then(() => {
          successCount++;
          if (successCount % 500 === 0) console.log(`✅ Cast ${successCount} votes...`);
        })
        .catch(err => {
          // console.error(`❌ Vote failed for ${user.email}: ${err.response?.data?.message || err.message}`);
        })
      );
    }
    await Promise.all(batch);
  }

  console.log(`🏁 Finished. Successfully cast ${successCount} votes.`);
}

async function deleteUsers() {
  // Optional cleanup
  console.log('🗑️ Cleanup not implemented to avoid accidental data loss.');
}

// CLI Entry Point
const [,, command, arg1, arg2] = process.argv;

(async () => {
  try {
    switch (command) {
      case 'register':
        await registerUsers(parseInt(arg1) || 10000);
        break;
      case 'vote':
        if (!arg1 || !arg2) {
          console.log('Usage: node load-test.js vote <voting-id> <option-id>');
          process.exit(1);
        }
        await castVotes(arg1, arg2);
        break;
      default:
        console.log('Usage:');
        console.log('  node load-test.js register [count]');
        console.log('  node load-test.js vote <voting-id> <option-id>');
    }
  } catch (err) {
    console.error('💥 Execution failed:', err.message);
  }
})();
