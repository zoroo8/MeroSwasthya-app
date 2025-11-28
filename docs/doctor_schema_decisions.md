# Doctor Schema Design & Decisions (Doctor.js)

**Date**: November 28, 2025  
**Author**: Ayush Bhattarai  

This document outlines the core structural design and schema decisions made for the `Doctor.js` Mongoose model.

---

## 1. Schema Definition & Architecture

The `Doctor` schema is designed to represent clinical professional profiles within the MeroSwasthya platform. It functions as an extension of the base `User` document, establishing a one-to-one relationship with standard authentication data while maintaining doctor-specific fields independently.

### Key Fields & Types

*   **User Reference (`user`)**:
    *   **Type**: `mongoose.Schema.Types.ObjectId`
    *   **Ref**: `'User'`
    *   **Rationale**: Ensures a strong one-to-one linkage with the primary login and authentication entity.
*   **Specialty (`specialty`)**:
    *   **Type**: `String`
    *   **Rationale**: Essential for patient search and booking categorization.
*   **License Number (`licenseNumber`)**:
    *   **Type**: `String`
    *   **Rules**: Unique, Required.
    *   **Rationale**: Crucial for legal verification and preventing duplicate professional profiles.
*   **Experience (`experienceYears`)**:
    *   **Type**: `Number`
    *   **Default**: `0`
*   **Hospital Associations (`hospital`, `hospitalId`)**:
    *   **Type**: `String` (friendly name) & `mongoose.Schema.Types.ObjectId` referencing `'Hospital'`.
    *   **Rationale**: Allows linking doctors to specific physical clinics/hospitals for physical roster scheduling.
*   **Booking Settings (`consultationFee`, `maxDailyBookings`)**:
    *   **maxDailyBookings**: Capped with a minimum of `1` and default of `10` to avoid doctor burnout and manage roster loads.
*   **Availability Roster (`availability`)**:
    *   **Type**: `Array` of Objects containing `{ day: String, startTime: String, endTime: String }`.
    *   **Rationale**: Represents weekly recurring slots that form the base scheduling matrix for the booking engine.
*   **Approval Flag (`isApproved`)**:
    *   **Type**: `Boolean`
    *   **Default**: `false`
    *   **Rationale**: Security gate to ensure a doctor cannot accept bookings until an administrator manually verifies credentials.

---

## 2. Key Design Decisions

1.  **Strict Profile Separation**: 
    Separated core user profile info (name, email, password, role) in `User.js` from medical/clinical registry info in `Doctor.js`. This allows role-based schemas to remain lightweight and scale independently.
2.  **Embedded Availability Array**:
    Decided to embed weekly available days directly inside the `Doctor` schema to simplify queries for general weekly working hours, while utilizing a separate model for specific calendar-date associations (like `DoctorHospital`).
3.  **Default Pending Approval State**:
    All newly registered doctor accounts are non-approved by default to ensure patient safety through mandatory manual admin verification.
