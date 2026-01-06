# Roster Candidate Discovery Endpoint (searchDoctorCandidates)

**Date**: January 6, 2026  
**Author**: Ayush Bhattarai  

This document describes the design and implementation of the `searchDoctorCandidates` endpoint (mapped to `GET /api/hospitals/doctor-candidates`).

---

## 1. Context & Business Need

To facilitate efficient rostering, hospital administrators need a straightforward mechanism to search the platform's user base for qualified, licensed doctors and recruit them into their hospital's active list of specialists.

The `searchDoctorCandidates` API allows a hospital admin to:
1.  **Browse Platform Registry**: View all registered doctors on the MeroSwasthya platform.
2.  **Filter by Association**: See a flag (`isLinked`) indicating whether each doctor is already associated with their specific hospital.
3.  **Perform Auto-complete Search**: Type names, emails, or phone numbers to quickly locate specific doctors.

---

## 2. API Schema & Access Control

*   **Endpoint**: `GET /api/hospitals/doctor-candidates`
*   **Access Control**: Authenticated Admin/Hospital Roles only.
*   **Query Parameters**:
    *   `hospitalId` (optional): The ID of the hospital whose roster relationship we are querying.
    *   `search` (optional): Query text to filter candidate names, emails, or phones.

---

## 3. Implementation Workflow & Optimization

To minimize search latencies and optimize Mongoose query execution:

### Step 1: User Base Filtering
We first fetch all user profiles registered under the `'doctor'` role:
```javascript
const userFilter = { role: 'doctor' };
if (search) {
  const searchRegex = new RegExp(escapeRegex(search), 'i');
  userFilter.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
}
const users = await User.find(userFilter)
  .select('name email phone profileImage isVerified')
  .sort({ name: 1, email: 1 })
  .limit(50);
```

### Step 2: Bulk Profile Mapping
We execute a bulk query to resolve the corresponding clinical profiles (`Doctor` collection) for all retrieved user accounts:
```javascript
const userIds = users.map((user) => user._id);
const profiles = await Doctor.find({ user: { $in: userIds } });
const profileByUserId = new Map(profiles.map((profile) => [String(profile.user), profile]));
```

### Step 3: Association Lookup (Link Check)
If `hospitalId` is provided, we fetch active rosters from the `DoctorHospital` collection to check existing linkages:
```javascript
let linkedDoctorIds = new Set();
if (hospitalId && profiles.length > 0) {
  const links = await DoctorHospital.find({
    hospital: hospitalId,
    doctor: { $in: profiles.map((profile) => profile._id) },
    isActive: true,
  }).select('doctor');

  linkedDoctorIds = new Set(links.map((link) => String(link.doctor)));
}
```

### Step 4: Final Candidate Synthesis
We combine the results, flagging already linked doctors so the frontend can display an "Add" vs "Modify" button:
```javascript
const doctors = users.map((user) => {
  const profile = profileByUserId.get(String(user._id));
  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
    },
    profile: profile ? {
      id: profile._id,
      specialty: profile.specialty,
      licenseNumber: profile.licenseNumber,
      experienceYears: profile.experienceYears,
      consultationFee: profile.consultationFee,
      maxDailyBookings: profile.maxDailyBookings,
      bio: profile.bio,
      isApproved: profile.isApproved,
    } : null,
    isLinked: profile ? linkedDoctorIds.has(String(profile._id)) : false,
  };
});
```
