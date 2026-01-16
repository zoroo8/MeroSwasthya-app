# Roster Management API Reference Guide

**Date**: January 16, 2026  
**Author**: Ayush Bhattarai  

This document serves as the team's shared reference for the MeroSwasthya Hospital-Doctor Roster Management API endpoints.

---

## 1. Update/Assign Availability Slot (assignDoctorToHospital)

Sets or modifies a doctor's work slots, daily booking caps, or specialty within a particular hospital.

*   **Endpoint**: `PATCH /api/hospitals/:hospitalId/doctors/:doctorId`
*   **Authentication**: Required (`Authorization: Bearer <token>`)
*   **Role Permission**: `admin` or associated `hospital` admin
*   **Content-Type**: `application/json`

### Request Parameters
*   `hospitalId` (Path): The Mongoose ObjectID of the hospital.
*   `doctorId` (Path): The Mongoose ObjectID of the doctor profile.

### Request Body
```json
{
  "specialty": "Pediatrics",
  "maxDailyBookings": 15,
  "availabilitySlots": [
    {
      "date": "2026-06-01",
      "maxDailyBookings": 12
    },
    {
      "date": "2026-06-02",
      "maxDailyBookings": 15
    }
  ]
}
```

### Success Response (`200 OK`)
```json
{
  "message": "Doctor assigned to hospital successfully",
  "doctor": {
    "_id": "60a4f5f8b54e4c25f487e412",
    "specialty": "Pediatrics",
    "licenseNumber": "NMC-88392",
    "isApproved": true
  },
  "hospital": {
    "_id": "60b5a1f2b54e4c25f487e500",
    "name": "Kathmandu Model Hospital"
  },
  "maxDailyBookings": 15,
  "availableDates": ["2026-06-01", "2026-06-02"],
  "availabilitySlots": [
    {
      "date": "2026-06-01",
      "maxDailyBookings": 12
    },
    {
      "date": "2026-06-02",
      "maxDailyBookings": 15
    }
  ],
  "linkId": "60c8e9f2b54e4c25f487f102"
}
```

---

## 2. Get Hospital Doctors (getHospitalDoctors)

Retrieves all approved doctors assigned to a specific hospital's roster, with support for filtering and nested profile retrieval.

*   **Endpoint**: `GET /api/hospitals/:hospitalId/doctors`
*   **Authentication**: None (Public Endpoint)
*   **Query Parameters**:
    *   `specialty` (optional): Filter results by exact specialty name (e.g. `Cardiology`).
    *   `search` (optional): Filter results by searching doctors' user names, emails, or phones.

### Success Response (`200 OK`)
```json
{
  "hospital": {
    "_id": "60b5a1f2b54e4c25f487e500",
    "name": "Kathmandu Model Hospital",
    "address": "Exhibition Road, Kathmandu"
  },
  "doctors": [
    {
      "_id": "60a4f5f8b54e4c25f487e412",
      "specialty": "Pediatrics",
      "licenseNumber": "NMC-88392",
      "experienceYears": 6,
      "user": {
        "name": "Dr. Ayush Bhattarai",
        "email": "ayush@meroswasthya.org",
        "phone": "+9779800000000",
        "profileImage": "uploads/profiles/ayush.jpg"
      },
      "maxDailyBookings": 15,
      "availableDates": ["2026-06-01", "2026-06-02"],
      "availabilitySlots": [
        { "date": "2026-06-01", "maxDailyBookings": 12 },
        { "date": "2026-06-02", "maxDailyBookings": 15 }
      ],
      "doctorHospitalLinkId": "60c8e9f2b54e4c25f487f102"
    }
  ]
}
```

---

## 3. Search Doctor Candidates (searchDoctorCandidates)

Fetches all platform doctors with status indicators showing whether they are currently rostered in the target hospital.

*   **Endpoint**: `GET /api/hospitals/doctor-candidates`
*   **Authentication**: Required (`Authorization: Bearer <token>`)
*   **Role Permission**: `admin` or `hospital`
*   **Query Parameters**:
    *   `hospitalId` (optional): Used to calculate the `isLinked` boolean indicator.
    *   `search` (optional): Autocomplete text matching doctor name/email/phone.

### Success Response (`200 OK`)
```json
{
  "doctors": [
    {
      "user": {
        "id": "60a4f5d2b54e4c25f487e410",
        "name": "Dr. Sarah Adhikari",
        "email": "sarah.a@gmail.com",
        "phone": "+9779841234567",
        "isVerified": true
      },
      "profile": {
        "id": "60a4f5f8b54e4c25f487e412",
        "specialty": "Cardiology",
        "licenseNumber": "NMC-88392",
        "experienceYears": 8,
        "isApproved": true
      },
      "isLinked": false
    }
  ]
}
```
