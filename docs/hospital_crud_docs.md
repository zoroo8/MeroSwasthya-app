# Hospital CRUD Endpoints & Architectural Design Notes

**Date**: December 14, 2025  
**Author**: Ayush Bhattarai  

This document details the API endpoints developed to manage physical hospital entities on the MeroSwasthya platform, including access control rules and schema designs.

---

## 1. Schema & Design Considerations

Hospitals represent physical infrastructure hosting doctors and accommodating client appointments.

### Key Architectural Decisions
1.  **Multi-Tenant Admin Model**: Each hospital must be linked to an admin user (`adminUser` referencing standard `User` model) who is granted authorization to manage that hospital's roster.
2.  **Role Enforcement**: Hospital creation and modifications are guarded behind authentication and role middleware (`auth`, `role('admin', 'hospital')`) to prevent unauthorized spoofing of medical institutions.
3.  **Soft Associations**: Rather than embedding doctor documents directly inside a hospital document, association matrices are stored in a separate join collection (`DoctorHospital`), preventing heavy documents and slow write queries.

---

## 2. API Endpoint Specifications

### 2.1 Get All Hospitals
Retrieves a list of all active registered hospital facilities.
*   **Endpoint**: `GET /api/hospitals`
*   **Access Control**: Public (Patients & Guests)
*   **Response Format**:
    ```json
    [
      {
        "_id": "60b5a1f2b54e4c25f487e500",
        "name": "Kathmandu Model Hospital",
        "address": "Exhibition Road, Kathmandu",
        "phone": "+977014240053",
        "description": "Providing quality healthcare services since 1993."
      }
    ]
    ```

### 2.2 Get My Associated Hospitals
Retrieves hospitals managed by the currently logged-in administrator.
*   **Endpoint**: `GET /api/hospitals/mine`
*   **Access Control**: Authenticated Admin/Hospital Roles only.
*   **Response Format**: Returns an array of matching hospital documents populated with administrative information.

### 2.3 Create a New Hospital
Registers a physical clinic or hospital in the system.
*   **Endpoint**: `POST /api/hospitals`
*   **Access Control**: Authenticated Admin/Hospital Roles.
*   **Request Body**:
    ```json
    {
      "name": "Patan Hospital",
      "address": "Lagankhel, Lalitpur",
      "phone": "+977015522295",
      "email": "info@patanhospital.org.np",
      "description": "A leading public healthcare institution in Nepal."
    }
    ```
*   **Response Format**: Returns the created hospital document alongside a `201 Created` status code.

### 2.4 Update Hospital Details
Allows modifying contact details, name, or description.
*   **Endpoint**: `PATCH /api/hospitals/:hospitalId`
*   **Access Control**: Authenticated Admin/Hospital Roles.
*   **Request Body**: Any valid subset of fields (`name`, `address`, `phone`, `description`).
*   **Response Format**: Returns the updated document.
    ```json
    {
      "message": "Hospital updated successfully",
      "hospital": {
        "_id": "60b5a1f2b54e4c25f487e500",
        "name": "Kathmandu Model Hospital (Updated)"
      }
    }
    ```

---

## 3. Roster Management Design Notes
By decoupling hospitals and doctor entities, MeroSwasthya allows a single doctor to be hired by or associated with multiple hospitals (roster sharing). These associations are managed using separate endpoints:
*   `POST /api/hospitals/:hospitalId/doctors` (Add Doctor to Hospital)
*   `PATCH /api/hospitals/:hospitalId/doctors/:doctorId` (Assign/Modify Doctor availability slots at that hospital)
