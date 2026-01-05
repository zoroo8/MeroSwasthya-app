# getHospitalDoctors Endpoint & Query Design

**Date**: January 5, 2026  
**Author**: Ayush Bhattarai  

This document details the technical design, query parameters, Mongoose population patterns, and internal architecture of the `getHospitalDoctors` endpoint.

---

## 1. Requirement & Goals

The `getHospitalDoctors` endpoint retrieves all doctors currently active and rostered within a given hospital facility.
It must:
1.  **Strictly Filter Approvals**: Only return doctors that have been officially approved by the admin state (`isApproved: true`).
2.  **Filter and Search**: Allow optional search query inputs (searching by doctor's user name, email, or phone) and filtering by specialty.
3.  **Populate Roster Attributes**: Return detailed availability dates, weekly availability slots, and maximum daily booking limits specifically configured for that doctor at that specific hospital (since slots vary per clinic).
4.  **Populate Core Credentials**: Perform multi-level mongoose population to fetch the underlying `User` profile data (name, email, phone, profile image) for each doctor.

---

## 2. API Schema

*   **Endpoint**: `GET /api/hospitals/:hospitalId/doctors`
*   **Access Control**: Public
*   **Query Parameters**:
    *   `specialty` (optional): Filter doctors by exact clinical specialty (case-insensitive).
    *   `search` (optional): Find doctors by name, email, or phone.

---

## 3. Query Execution Pattern & Mongoose Population

The endpoint utilizes a highly efficient three-step query execution flow to handle filtering and multi-level data population:

### Step 1: Pre-filter Doctors by User Information
If a `search` query parameter is provided, we first search the base `User` collection for matching doctor roles:
```javascript
const users = await User.find({
  role: 'doctor',
  $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }],
}).select('_id');
matchingDoctorUserIds = users.map((user) => user._id);
```
If no users match the query, the API short-circuits and immediately returns an empty array.

### Step 2: Establish the Query Match Criteria
We build a dynamic `doctorMatch` filter applying the mandatory approval criteria and user/specialty parameters:
```javascript
const doctorMatch = { isApproved: true };
if (specialtyRegex) doctorMatch.specialty = specialtyRegex;
if (matchingDoctorUserIds) doctorMatch.user = { $in: matchingDoctorUserIds };
```

### Step 3: Populate and Resolve Join Links
We query the `DoctorHospital` collection (which represents the relationship table between Doctors and Hospitals) and run a nested population:
```javascript
const links = await DoctorHospital.find({ hospital: hospital._id, isActive: true })
  .populate({
    path: 'doctor',
    match: doctorMatch,
    populate: { path: 'user', select: 'name email phone profileImage' },
  })
  .sort({ createdAt: -1 });
```

### Step 4: Map and Format Response
Finally, the results are mapped to construct a clean JSON payload. We filter out any null elements resulting from the populate step matching exclusions, resolve availability slots using localized helper utilities, and sort by specialty and experience level:
```javascript
const doctors = links
  .filter((link) => !!link.doctor)
  .map((link) => ({
    ...link.doctor.toObject(),
    maxDailyBookings: link.maxDailyBookings,
    availableDates: getAvailableDates(link),
    availabilitySlots: getAvailabilitySlots(link),
    doctorHospitalLinkId: link._id,
  }));
```
