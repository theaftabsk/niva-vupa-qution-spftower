const API_BASE_URL = process.env.API_URL || 'https://api.niva.greatcampus.in';
const API_KEY = 'vkey_e989083e3b942c57021801a26c116336';

async function runLiveVendorApiTests() {
  console.log(`\n======================================================`);
  console.log(`  STARTING LIVE VENDOR API TESTS`);
  console.log(`  Base URL: ${API_BASE_URL}`);
  console.log(`  API Key:  ${API_KEY}`);
  console.log(`======================================================\n`);

  // 1️⃣ TEST 1: GET Active Assessments
  console.log(`👉 1. Testing GET /api/v1/vendor-api/assessments/active ...`);
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/vendor-api/assessments/active`, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`   Error:`, err.message);
  }

  // 2️⃣ TEST 2: POST Create / Sync Assessment
  console.log(`\n👉 2. Testing POST /api/v1/vendor-api/assessments ...`);
  let createdSlug = 'banca-live-test-assessment';
  try {
    const payload = {
      vendorAssessmentId: `VND-ASSESS-${Date.now().toString().slice(-4)}`,
      name: `Banca Agency Assessment ${Date.now().toString().slice(-4)}`,
      slug: `banca-agency-assessment-${Date.now().toString().slice(-4)}`,
      status: 'ACTIVE',
    };
    console.log(`   Request Payload:`, JSON.stringify(payload, null, 2));

    const res = await fetch(`${API_BASE_URL}/api/v1/vendor-api/assessments`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    if (data.data && data.data.slug) {
      createdSlug = data.data.slug;
    }
  } catch (err) {
    console.error(`   Error:`, err.message);
  }

  // 3️⃣ TEST 3: POST Candidate Add / Assign (Generate Unique Exam Links)
  const testCandidateAppId = `APP-LIVE-${Date.now().toString().slice(-4)}`;
  console.log(`\n👉 3. Testing POST /api/v1/vendor-api/candidates ...`);
  try {
    const payload = {
      assessmentId: createdSlug,
      candidates: [
        {
          name: 'Live Vendor Candidate 1',
          email: `live_cand1_${Date.now()}@example.com`,
          phone: '9876543210',
          applicationId: testCandidateAppId,
          vendorCandidateId: `VND-CAND-LIVE-01`,
        },
      ],
    };
    console.log(`   Request Payload:`, JSON.stringify(payload, null, 2));

    const res = await fetch(`${API_BASE_URL}/api/v1/vendor-api/candidates`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`   Error:`, err.message);
  }

  // 4️⃣ TEST 4: GET Candidate Status & Result
  console.log(`\n👉 4. Testing GET /api/v1/vendor-api/candidates/status ...`);
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/vendor-api/candidates/status?applicationId=${testCandidateAppId}`, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`   Error:`, err.message);
  }

  console.log(`\n======================================================`);
  console.log(`  ALL LIVE TESTS COMPLETED!`);
  console.log(`======================================================\n`);
}

runLiveVendorApiTests();
