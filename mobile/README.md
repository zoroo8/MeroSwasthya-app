# MeroSwasthya Mobile

Flutter mobile app for the existing React and Express MeroSwasthya system.

## Included flows

- Login, register, OTP verification, and OTP resend
- Patient home, hospital search, hospital doctor details, hospital booking, appointments, visit history, report details, profile, and chat
- Doctor profile, appointment status updates, report creation, report history, and chat
- Admin stats, user creation, hospital creation, doctor approvals, and report review
- Hospital profile, doctor search and linking, availability updates, appointments, report creation, and report review

Chat uses the backend REST chat routes for send, refresh, and history. The React app still adds Socket.IO realtime delivery in the browser.

## Run

Start the backend first. The default API base URL in the app targets an Android emulator:

```powershell
flutter run
```

Override it for a different device or host:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000/api
```

For a physical phone, replace `10.0.2.2` with the LAN IP address of the computer running the backend. For an iOS simulator, `http://localhost:5000/api` is usually the right local address.
