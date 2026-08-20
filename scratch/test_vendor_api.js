const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function runTests() {
  console.log('--- 🚀 STARTING VENDOR API INTEGRATION TESTS ---');

  try {
    // 1. Ensure test vendor exists
    let vendor = await prisma.vendor.findFirst({
      where: { status: 'ACTIVE' },
    });

    if (!vendor) {
      console.log('Creating a test vendor...');
      vendor = await prisma.vendor.create({
        data: {
          vendorCode: 'VND-TEST-99',
          name: 'Apex Recruiting Agency',
          email: 'apex.recruitment@example.com',
          passwordHash: '$2a$10$xyz',
          apiKey: 'vkey_apex_test_secret_key_123',
          status: 'ACTIVE',
        },
      });
    }

    if (!vendor.apiKey) {
      vendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: { apiKey: 'vkey_apex_test_secret_key_123' },
      });
    }

    console.log(`Using Vendor: [${vendor.vendorCode}] ${vendor.name}`);
    console.log(`API Key: ${vendor.apiKey}`);

    const baseUrl = 'http://localhost:4000';

    // ─── Test 1: Inbound API 1 - Assessment Create / Sync ───
    console.log('\n[1/4] Testing API 1: Assessment Create / Sync...');
    const createAssPayload = {
      vendorAssessmentId: 'APEX-ASSESS-001',
      name: 'Niva Bupa Banca RM Assessment 2026',
      slug: 'banca-rm-test-' + Date.now().toString().slice(-4),
      durationMins: 45,
      maxProctorWarnings: 3,
      status: 'ACTIVE',
    };

    const res1 = await fetch(`${baseUrl}/api/v1/vendor-api/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vendor.apiKey,
      },
      body: JSON.stringify(createAssPayload),
    });

    const data1 = await res1.json();
    console.log('API 1 Response Status:', res1.status);
    console.log('API 1 Response Data:', JSON.stringify(data1, null, 2));

    if (!data1.success || !data1.data?.assessmentId) {
      throw new Error('API 1 failed: ' + JSON.stringify(data1));
    }

    const createdAssessmentId = data1.data.assessmentId;

    // ─── Test 2: Inbound API 2 - Candidate Add & Unique Link Generation ───
    console.log('\n[2/4] Testing API 2: Candidate Add / Assign (Unique Links)...');
    const candPayload = {
      assessmentId: createdAssessmentId,
      candidates: [
        {
          name: 'Aftab Sk',
          email: `aftab.test.${Date.now()}@example.com`,
          phone: '9876543210',
          applicationId: 'APP-TEST-101',
          vendorCandidateId: 'APEX-CAND-01',
        },
        {
          name: 'Rahim Ahmed',
          email: `rahim.test.${Date.now()}@example.com`,
          phone: '9876543211',
          applicationId: 'APP-TEST-102',
          vendorCandidateId: 'APEX-CAND-02',
        },
      ],
    };

    const res2 = await fetch(`${baseUrl}/api/v1/vendor-api/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vendor.apiKey,
      },
      body: JSON.stringify(candPayload),
    });

    const data2 = await res2.json();
    console.log('API 2 Response Status:', res2.status);
    console.log('API 2 Response Data:', JSON.stringify(data2, null, 2));

    if (!data2.success || !Array.isArray(data2.data) || data2.data.length < 2) {
      throw new Error('API 2 failed: ' + JSON.stringify(data2));
    }

    const candidate1 = data2.data[0];
    console.log(`✅ Candidate 1 Unique Link: ${candidate1.examUrl}`);

    // ─── Test 3: Outgoing API 3 - Active Assessments ───
    console.log('\n[3/4] Testing API 3: Active Assessments List...');
    const res3 = await fetch(`${baseUrl}/api/v1/vendor-api/assessments/active`, {
      method: 'GET',
      headers: {
        'x-api-key': vendor.apiKey,
      },
    });

    const data3 = await res3.json();
    console.log('API 3 Response Status:', res3.status);
    console.log('API 3 Response Data:', JSON.stringify(data3, null, 2));

    if (!data3.success || !Array.isArray(data3.data)) {
      throw new Error('API 3 failed: ' + JSON.stringify(data3));
    }

    // ─── Test 4: Outgoing API 4 - Candidate Status / Result ───
    console.log('\n[4/4] Testing API 4: Candidate Status & Result Query...');
    const res4 = await fetch(
      `${baseUrl}/api/v1/vendor-api/candidates/status?applicationId=${candidate1.applicationId}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': vendor.apiKey,
        },
      }
    );

    const data4 = await res4.json();
    console.log('API 4 Response Status:', res4.status);
    console.log('API 4 Response Data:', JSON.stringify(data4, null, 2));

    if (!data4.success || !Array.isArray(data4.data) || data4.data.length === 0) {
      throw new Error('API 4 failed: ' + JSON.stringify(data4));
    }

    console.log('\n🎉 ALL 4 VENDOR API INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
