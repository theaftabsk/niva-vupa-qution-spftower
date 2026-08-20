# Niva Bupa Examination & Assessment Platform
## Enterprise Vendor & Agency API Integration Guide
**Document Version:** `1.0.0 (Production Release)`  
**Classification:** `Confidential — Partner Restricted`  
**Last Updated:** `August 2026`

---

## 📑 Table of Contents
1. [Overview & Architecture](#1-overview--architecture)
2. [Interactive Documentation & Access Credentials](#2-interactive-documentation--access-credentials)
3. [Authentication & Security](#3-authentication--security)
4. [Fixed System Constants & Examination Rules](#4-fixed-system-constants--examination-rules)
5. [Core API Endpoints Reference](#5-core-api-endpoints-reference)
   - [1. Create or Sync Assessment](#1-create-or-sync-assessment)
   - [2. Add Candidates & Generate Unique Exam URLs](#2-add-candidates--generate-unique-exam-urls)
   - [3. List Active Assessments](#3-list-active-assessments)
   - [4. Query Candidate Exam Status, Scores & Proctoring](#4-query-candidate-exam-status-scores--proctoring)
   - [5. Reset & Resend Candidate Exam Link](#5-reset--resend-candidate-exam-link)
6. [Standard Error Codes & Handling](#6-standard-error-codes--handling)
7. [Testing with cURL & Postman](#7-testing-with-curl--postman)
8. [Technical Support & Escalation](#8-technical-support--escalation)

---

## 1. Overview & Architecture

The **Niva Bupa Examination & Assessment Platform** provides external vendors, recruitment agencies, and partner organizations with a unified, high-performance RESTful API suite. 

### Key Capabilities:
- **Automated Candidate Onboarding**: Enrolls candidates programmatically and returns instant, non-shareable **Unique Secure Exam URLs**.
- **Assessment Management**: Create or sync assessment batches tailored to hiring drives.
- **Real-Time Proctoring & Score Sync**: Pull live exam statuses, obtained scores, completion timestamps, and anti-cheating warning logs.
- **Candidate Session Recovery**: Reset and re-issue exam links for disqualified or interrupted candidates directly via API.
- **Strict Multi-Tenant Isolation**: Complete cryptographic separation ensuring partners can only access and modify their own candidate records.

---

## 2. Interactive Documentation & Access Credentials

An interactive **Swagger OAS 3.0** documentation portal is available for testing API payloads directly from your browser.

| Resource | Value / Access URL |
| :--- | :--- |
| **Production API Base URL** | `https://api.niva.greatcampus.in` |
| **Interactive Swagger Portal** | `https://api.niva.greatcampus.in/api/docs` |
| **1-Click Authenticated URL** | [Open Interactive Swagger Docs](https://api.niva.greatcampus.in/api/docs?key=Niva@Doc2026!) |
| **Portal Username** | `niva-admin` *(or `admin`)* |
| **Portal Password** | `Niva@Doc2026!` |

> **Note:** The Swagger portal is locked with HTTP Basic Authentication and query tokens to protect proprietary assessment endpoints. Do not distribute access credentials publicly.

---

## 3. Authentication & Security

All API requests to `/api/v1/vendor-api/*` require your organization's unique **Vendor API Key**.

### Authentication Header
Pass your API key in either of the following HTTP headers with every request:

```http
x-api-key: vkey_your_unique_vendor_api_key
```
*or*
```http
Authorization: Bearer vkey_your_unique_vendor_api_key
```

### Security Highlights:
- **Protocol**: Strictly HTTPS (TLS 1.2+ required).
- **Tenant Validation**: Every request is authenticated against your unique Vendor Code (`VND-XXXX`). Cross-vendor data access is strictly blocked (`403 Forbidden` / `404 Not Found`).

---

## 4. Fixed System Constants & Examination Rules

The examination engine operates with standardized enterprise parameters:

| Parameter | Standard Value | Description |
| :--- | :--- | :--- |
| **Fixed Duration** | `45 Minutes` | Standardized exam duration per candidate. |
| **Total Question Bank** | `60 Questions` | Fixed shared question pool randomized per candidate attempt. |
| **Proctoring Rules** | `3 Max Warnings` | AI & browser tab-switch detection (disqualifies on 3rd violation). |
| **Secure Token Expiry** | One-time Session | Unique exam token locks upon test submission or completion. |

---

## 5. Core API Endpoints Reference

---

### 1. Create or Sync Assessment

Create a new assessment session or update an existing assessment mapped under your vendor account.

- **HTTP Method:** `POST`
- **Endpoint:** `/api/v1/vendor-api/assessments`
- **Content-Type:** `application/json`

#### Request Headers:
```http
x-api-key: vkey_your_unique_vendor_api_key
Content-Type: application/json
```

#### Request Body Schema:
```json
{
  "name": "Banca Relationship Manager Assessment 2026",
  "slug": "banca-rm-assessment-2026",
  "vendorAssessmentId": "VND-BATCH-101",
  "maxProctorWarnings": 3,
  "status": "ACTIVE"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | **Yes** | Display title for the assessment. |
| `slug` | string | No | Custom URL slug (auto-generated if omitted). |
| `vendorAssessmentId` | string | No | Your internal assessment/batch reference ID. |
| `maxProctorWarnings` | number | No | Max anti-cheating warnings (Default: `3`). |
| `status` | string | No | `ACTIVE` or `INACTIVE` (Default: `ACTIVE`). |

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Assessment created/synced successfully.",
  "data": {
    "assessmentId": "7efb22b7-ac55-4dbc-9950-64558257d065",
    "vendorAssessmentId": "VND-BATCH-101",
    "name": "Banca Relationship Manager Assessment 2026",
    "slug": "banca-rm-assessment-2026",
    "assessmentLink": "https://niva.greatcampus.in/banca-rm-assessment-2026",
    "durationMins": 45,
    "totalQuestions": 60,
    "status": "ACTIVE",
    "createdAt": "2026-08-21T02:35:05.199Z"
  }
}
```

---

### 2. Add Candidates & Generate Unique Exam URLs

Registers one or more candidates and immediately generates unique, individual, non-shareable exam links.

- **HTTP Method:** `POST`
- **Endpoint:** `/api/v1/vendor-api/candidates`
- **Content-Type:** `application/json`

#### Request Body Schema:
```json
{
  "assessmentId": "banca-rm-assessment-2026",
  "candidates": [
    {
      "name": "Aftab Sk",
      "email": "aftab@example.com",
      "phone": "9876543210",
      "applicationId": "APP-2026-001",
      "vendorCandidateId": "VND-CAND-01"
    },
    {
      "name": "Rahul Sharma",
      "email": "rahul.sharma@example.com",
      "phone": "9876543211",
      "applicationId": "APP-2026-002",
      "vendorCandidateId": "VND-CAND-02"
    }
  ]
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `assessmentId` | string | **Yes** | Assessment UUID or slug. |
| `candidates` | array | **Yes** | Array of candidate objects (supports single or bulk). |
| `candidates[].name` | string | **Yes** | Full candidate name. |
| `candidates[].email` | string | **Yes** | Candidate email address. |
| `candidates[].phone` | string | **Yes** | 10-digit mobile number. |
| `candidates[].applicationId` | string | **Yes** | Unique Applicant ID or Reference Code. |
| `candidates[].vendorCandidateId` | string | No | Optional external partner candidate identifier. |

#### Response (`200 OK`):
```json
{
  "success": true,
  "count": 2,
  "assessmentId": "7efb22b7-ac55-4dbc-9950-64558257d065",
  "assessmentName": "Banca Relationship Manager Assessment 2026",
  "data": [
    {
      "candidateId": "c3f74389-7ee3-4ca2-ac3b-7af0d74037f2",
      "name": "Aftab Sk",
      "email": "aftab@example.com",
      "phone": "9876543210",
      "applicationId": "APP-2026-001",
      "vendorCandidateId": "VND-CAND-01",
      "secureToken": "sec_b5223bdad4e70ba72e76934ad4c24461",
      "examUrl": "https://niva.greatcampus.in/banca-rm-assessment-2026?token=sec_b5223bdad4e70ba72e76934ad4c24461",
      "status": "NOT_STARTED"
    },
    {
      "candidateId": "d8a12904-51ef-419b-a012-8e1049ad55c1",
      "name": "Rahul Sharma",
      "email": "rahul.sharma@example.com",
      "phone": "9876543211",
      "applicationId": "APP-2026-002",
      "vendorCandidateId": "VND-CAND-02",
      "secureToken": "sec_7610fa2e89ab10c490bc1142ad9125cc",
      "examUrl": "https://niva.greatcampus.in/banca-rm-assessment-2026?token=sec_7610fa2e89ab10c490bc1142ad9125cc",
      "status": "NOT_STARTED"
    }
  ]
}
```

---

### 3. List Active Assessments

Fetch all active assessments assigned or available to your vendor profile.

- **HTTP Method:** `GET`
- **Endpoint:** `/api/v1/vendor-api/assessments/active`

#### Response (`200 OK`):
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "assessmentId": "9358c401-645f-4ff7-b441-c59d032352ef",
      "assessmentName": "Niva Bupa Udaan Assessment - Masai",
      "assessmentSlug": "niva-bupa-udaan-assessment-masai-9692",
      "assessmentLink": "https://niva.greatcampus.in/niva-bupa-udaan-assessment-masai-9692",
      "durationMins": 45,
      "totalQuestions": 60,
      "status": "ACTIVE"
    }
  ]
}
```

---

### 4. Query Candidate Exam Status, Scores & Proctoring

Query live progress, completion scorecards, and proctoring metrics for your registered candidates.

- **HTTP Method:** `GET`
- **Endpoint:** `/api/v1/vendor-api/candidates/status`

#### Supported Query Parameters:
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `applicationId` | string | Optional | Filter by Applicant ID | `?applicationId=APP-2026-001` |
| `candidateId` | string | Optional | Filter by internal Candidate UUID | `?candidateId=c3f74389...` |
| `vendorCandidateId` | string | Optional | Filter by external Vendor ID | `?vendorCandidateId=VND-CAND-01` |
| `assessmentId` | string | Optional | Filter by Assessment UUID / Slug | `?assessmentId=banca-rm-assessment-2026` |
| `email` | string | Optional | Filter by candidate email | `?email=aftab@example.com` |

#### Response (`200 OK`):
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "candidateId": "c3f74389-7ee3-4ca2-ac3b-7af0d74037f2",
      "applicationId": "APP-2026-001",
      "vendorCandidateId": "VND-CAND-01",
      "name": "Aftab Sk",
      "email": "aftab@example.com",
      "phone": "9876543210",
      "assessmentId": "7efb22b7-ac55-4dbc-9950-64558257d065",
      "assessmentName": "Banca Relationship Manager Assessment 2026",
      "assessmentSlug": "banca-rm-assessment-2026",
      "status": "COMPLETED",
      "examStartedAt": "2026-08-21T11:00:00.000Z",
      "examSubmittedAt": "2026-08-21T11:38:15.000Z",
      "totalTimeSpent": "38 mins 15 secs",
      "totalMarks": 60,
      "obtainedMarks": 52,
      "percentage": 87,
      "warningCount": 0
    }
  ]
}
```

#### Possible Status Values:
- `NOT_STARTED`: Candidate has not yet launched the test.
- `IN_PROGRESS`: Candidate is actively taking the exam.
- `COMPLETED`: Exam submitted successfully and scored.
- `DISQUALIFIED`: Candidate violated proctoring rules (3 warnings) or session locked.
- `EXPIRED`: Assessment access window has closed.

---

### 5. Reset & Resend Candidate Exam Link

Resets an interrupted, failed, or disqualified candidate session and generates a fresh secure exam URL for re-attempt.

- **HTTP Method:** `POST`
- **Endpoint:** `/api/v1/vendor-api/candidates/reset`
- **Content-Type:** `application/json`

#### Request Body Schema (Provide at least one identifier):
```json
{
  "applicationId": "APP-2026-001"
}
```
*or by Candidate Email:*
```json
{
  "email": "aftab@example.com"
}
```

#### Reset Behavior:
1. Wipes all prior attempts, submissions, and proctoring logs for the candidate.
2. Resets warning counter back to `0`.
3. Issues a brand-new cryptographically secure `secureToken`.
4. Re-sends the automated invitation email to the candidate.
5. Returns the new `examUrl` immediately in the API response.

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Candidate session successfully reset and fresh secure exam link generated.",
  "data": {
    "candidateId": "c3f74389-7ee3-4ca2-ac3b-7af0d74037f2",
    "name": "Aftab Sk",
    "email": "aftab@example.com",
    "applicationId": "APP-2026-001",
    "vendorCandidateId": "VND-CAND-01",
    "secureToken": "sec_80d0f96974b78ff77b49cccbbdada4d8",
    "examUrl": "https://niva.greatcampus.in/banca-rm-assessment-2026?token=sec_80d0f96974b78ff77b49cccbbdada4d8",
    "status": "NOT_STARTED",
    "emailDispatched": true
  }
}
```

---

## 6. Standard Error Codes & Handling

The API returns standard HTTP status codes along with a structured JSON error body:

```json
{
  "statusCode": 401,
  "message": "Invalid or missing Vendor API Key in request headers.",
  "error": "Unauthorized"
}
```

| HTTP Status | Meaning | Description & Action |
| :--- | :--- | :--- |
| `200 OK` | Success | The operation completed successfully. |
| `400 Bad Request` | Validation Error | Required field missing or invalid payload structure. |
| `401 Unauthorized` | Authentication Failed | `x-api-key` is missing or invalid. Check your vendor key. |
| `403 Forbidden` | Access Denied | Key is inactive or vendor account has been deactivated. |
| `404 Not Found` | Resource Not Found | Assessment or candidate does not exist under your vendor profile. |
| `500 Internal Error` | Server Error | Contact Niva Bupa Technical Support. |

---

## 7. Testing with cURL & Postman

### Example 1: Add Candidate via cURL
```bash
curl -X POST https://api.niva.greatcampus.in/api/v1/vendor-api/candidates \
  -H "x-api-key: vkey_e989083e3b942c57021801a26c116336" \
  -H "Content-Type: application/json" \
  -d '{
    "assessmentId": "niva-bupa-udaan-assessment-masai-9692",
    "candidates": [
      {
        "name": "Pooja Verma",
        "email": "pooja.verma@example.com",
        "phone": "9876543210",
        "applicationId": "APP-2026-901"
      }
    ]
  }'
```

### Example 2: Check Candidate Status via cURL
```bash
curl -X GET "https://api.niva.greatcampus.in/api/v1/vendor-api/candidates/status?applicationId=APP-2026-901" \
  -H "x-api-key: vkey_e989083e3b942c57021801a26c116336"
```

### Example 3: Reset Candidate Attempt via cURL
```bash
curl -X POST https://api.niva.greatcampus.in/api/v1/vendor-api/candidates/reset \
  -H "x-api-key: vkey_e989083e3b942c57021801a26c116336" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP-2026-901"
  }'
```

---

## 8. Technical Support & Escalation

For integration queries, API key provisioning, or production assistance:

- **Enterprise Portal:** [https://admin.niva.greatcampus.in](https://admin.niva.greatcampus.in)
- **API Documentation Portal:** [https://api.niva.greatcampus.in/api/docs](https://api.niva.greatcampus.in/api/docs)
- **Technical Support Email:** `support@greatcampus.in` / `admin@nivabupa.com`

---
*© 2026 Niva Bupa Health Insurance Company Limited. All Rights Reserved.*
