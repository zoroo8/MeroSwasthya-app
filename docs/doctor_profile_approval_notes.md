# Doctor Profile Management & Admin Approval Workflow

**Date**: December 5, 2025  
**Author**: Ayush Bhattarai  

This document describes the implementation of Doctor Profile settings and the administrative workflow for verifying and approving new doctors on the MeroSwasthya platform.

---

## 1. Objectives & Safety Architecture

The credibility of medical providers is essential to patient trust and safety. To guarantee that only qualified practitioners are listed in search directories and allowed to accept appointments:
1.  **State-Locked Registry**: All doctor registrations default to a pending approval state (`isApproved: false`).
2.  **Credential Review Gate**: Only authorized system administrators have access to view pending profiles and change their verification state.
3.  **Active Enforcement**: Booking controllers actively query and reject slot selection requests directed to unapproved doctors.

---

## 2. API Endpoints

### 2.1 Get Pending Doctors List
Retrieves all doctors currently waiting for administrative verification.
*   **Endpoint**: `GET /api/doctors/pending`
*   **Access Control**: Admin Only
*   **Behavior**:
    *   Queries `Doctor` collection where `isApproved: false`.
    *   Uses `.populate()` to fetch linked user credential details (`name`, `email`, `phone`).
*   **Example Response**:
    ```json
    [
      {
        "_id": "60a4f5f8b54e4c25f487e412",
        "specialty": "Cardiology",
        "licenseNumber": "NMC-88392",
        "experienceYears": 8,
        "isApproved": false,
        "user": {
          "name": "Dr. Sarah Adhikari",
          "email": "sarah.a@gmail.com",
          "phone": "+9779841234567"
        }
      }
    ]
    ```

### 2.2 Approve Doctor Profile
Verifies credentials and activates a doctor's booking state.
*   **Endpoint**: `PUT /api/doctors/:doctorId/approve`
*   **Access Control**: Admin Only
*   **Behavior**:
    *   Executes `findByIdAndUpdate(doctorId, { isApproved: true })`
    *   Populates user data and returns the updated document.
    *   Instantly allows the doctor to be discovered via the patient search dashboard.
*   **Example Response**:
    ```json
    {
      "message": "Doctor approved successfully",
      "doctor": {
        "_id": "60a4f5f8b54e4c25f487e412",
        "specialty": "Cardiology",
        "licenseNumber": "NMC-88392",
        "isApproved": true,
        "user": "60a4f5d2b54e4c25f487e410"
      }
    }
    ```

---

## 3. Implementation details
*   **Validation Rules**: During profile creation or updates, required fields such as `licenseNumber` are strictly validated at the database layer (Mongoose schema) as well as the controller validation layer.
*   **Search Exclusions**: General patient discovery endpoints append `{ isApproved: true }` to their find filters to prevent unapproved profiles from rendering on client apps.
