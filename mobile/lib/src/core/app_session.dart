import 'package:flutter/foundation.dart';

import 'api_client.dart';

class AppSession extends ChangeNotifier {
  AppSession(this.api);

  final ApiClient api;

  String _token = '';
  JsonMap? _user;

  String get token => _token;
  JsonMap? get user => _user;
  bool get isAuthenticated => _token.isNotEmpty && _user != null;
  String get role => textOf(_user?['role'], 'patient');
  String get displayName =>
      textOf(_user?['name'], textOf(_user?['email'], 'User'));

  Future<void> login({required String email, required String password}) async {
    final data = await api.post(
      '/auth/login',
      body: <String, dynamic>{
        'email': email.trim().toLowerCase(),
        'password': password,
      },
    );

    _useAuthResponse(data);
  }

  Future<String> register({
    required String name,
    required String email,
    required String password,
    required String role,
  }) async {
    final data = await api.post(
      '/auth/register',
      body: <String, dynamic>{
        'name': name.trim(),
        'email': email.trim().toLowerCase(),
        'password': password,
        'role': role,
      },
    );

    return textOf(data['message'], 'Registered. Verify your OTP to continue.');
  }

  Future<String> verifyOtp({required String email, required String otp}) async {
    final data = await api.post(
      '/auth/verify-otp',
      body: <String, dynamic>{
        'email': email.trim().toLowerCase(),
        'otp': otp.trim(),
      },
    );

    if (textOf(data['token']).isNotEmpty &&
        asJsonMap(data['user']).isNotEmpty) {
      _useAuthResponse(data);
    }

    return textOf(data['message'], 'Account verified.');
  }

  Future<String> resendOtp(String email) async {
    final data = await api.post(
      '/auth/resend-otp',
      body: <String, dynamic>{'email': email.trim().toLowerCase()},
    );

    return textOf(data['message'], 'OTP sent.');
  }

  void updateUser(JsonMap nextUser) {
    _user = nextUser;
    notifyListeners();
  }

  void updateProfileImage(Object? profileImage) {
    final currentUser = _user;
    if (currentUser == null) return;

    _user = <String, dynamic>{...currentUser, 'profileImage': profileImage};
    notifyListeners();
  }

  void logout() {
    _token = '';
    _user = null;
    notifyListeners();
  }

  void _useAuthResponse(JsonMap data) {
    final token = textOf(data['token']);
    final user = asJsonMap(data['user']);

    if (token.isEmpty || user.isEmpty) {
      throw ApiException('The API did not return a signed-in user.');
    }

    _token = token;
    _user = user;
    notifyListeners();
  }
}
