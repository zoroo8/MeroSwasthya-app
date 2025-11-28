import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/app_session.dart';
import '../ui/app_ui.dart';

enum AuthMode { login, register, verify }

class AuthGateway extends StatefulWidget {
  const AuthGateway({super.key, required this.session});

  final AppSession session;

  @override
  State<AuthGateway> createState() => _AuthGatewayState();
}

class _AuthGatewayState extends State<AuthGateway> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _otp = TextEditingController();

  AuthMode _mode = AuthMode.login;
  String _role = 'patient';
  String _error = '';
  String _message = '';
  bool _loading = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _run(Future<String?> Function() task) async {
    setState(() {
      _error = '';
      _message = '';
      _loading = true;
    });

    try {
      final message = await task();
      if (!mounted) return;
      setState(() {
        _message = message ?? '';
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _submit() async {
    switch (_mode) {
      case AuthMode.login:
        await _run(() async {
          await widget.session.login(
            email: _email.text,
            password: _password.text,
          );
          return null;
        });
      case AuthMode.register:
        await _run(() async {
          final message = await widget.session.register(
            name: _name.text,
            email: _email.text,
            password: _password.text,
            role: _role,
          );

          if (mounted) {
            setState(() => _mode = AuthMode.verify);
          }
          return message;
        });
      case AuthMode.verify:
        await _run(() async {
          return widget.session.verifyOtp(email: _email.text, otp: _otp.text);
        });
    }
  }

  Future<void> _resendOtp() async {
    await _run(() => widget.session.resendOtp(_email.text));
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (_mode) {
      AuthMode.login => 'Welcome back',
      AuthMode.register => 'Create account',
      AuthMode.verify => 'Verify your OTP',
    };
    final summary = switch (_mode) {
      AuthMode.login =>
        'Sign in as a patient, doctor, hospital team member, or admin.',
      AuthMode.register =>
        'Set up the patient or doctor account used by the web app.',
      AuthMode.verify =>
        'Enter the 6 digit email verification code before signing in.',
    };

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(18),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const BrandLockup(subtitle: 'Hospital Management System'),
                      const SizedBox(height: 18),
                      DashboardTabStrip(
                        tabs: const [
                          DashboardTab('Login', Icons.login),
                          DashboardTab('Register', Icons.person_add_alt_1),
                          DashboardTab(
                            'Verify OTP',
                            Icons.verified_user_outlined,
                          ),
                        ],
                        index: _mode.index,
                        onChanged: (index) => setState(() {
                          _mode = AuthMode.values[index];
                          _error = '';
                          _message = '';
                        }),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        title,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        summary,
                        style: const TextStyle(color: MeroPalette.muted),
                      ),
                      const SizedBox(height: 16),
                      if (_mode == AuthMode.register) ...[
                        LabeledField(
                          label: 'Name',
                          controller: _name,
                          hintText: 'Full name',
                        ),
                        const SizedBox(height: 12),
                      ],
                      LabeledField(
                        label: 'Email',
                        controller: _email,
                        hintText: 'you@example.com',
                        keyboardType: TextInputType.emailAddress,
                      ),
                      if (_mode != AuthMode.verify) ...[
                        const SizedBox(height: 12),
                        LabeledField(
                          label: 'Password',
                          controller: _password,
                          hintText: _mode == AuthMode.register
                              ? 'Minimum 6 characters'
                              : 'Your password',
                          obscureText: true,
                        ),
                      ],
                      if (_mode == AuthMode.register) ...[
                        const SizedBox(height: 12),
                        const Text(
                          'Role',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        SegmentedButton<String>(
                          segments: const [
                            ButtonSegment(
                              value: 'patient',
                              label: Text('Patient'),
                              icon: Icon(Icons.person_outline),
                            ),
                            ButtonSegment(
                              value: 'doctor',
                              label: Text('Doctor'),
                              icon: Icon(Icons.medical_services_outlined),
                            ),
                          ],
                          selected: {_role},
                          onSelectionChanged: (values) =>
                              setState(() => _role = values.first),
                        ),
                      ],
                      if (_mode == AuthMode.verify) ...[
                        const SizedBox(height: 12),
                        LabeledField(
                          label: 'OTP',
                          controller: _otp,
                          hintText: '6 digit code',
                          keyboardType: TextInputType.number,
                        ),
                      ],
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: _loading ? null : _submit,
                        icon: _loading
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Icon(switch (_mode) {
                                AuthMode.login => Icons.arrow_forward,
                                AuthMode.register => Icons.person_add_alt_1,
                                AuthMode.verify => Icons.check_circle_outline,
                              }),
                        label: Text(switch (_mode) {
                          AuthMode.login => 'Login',
                          AuthMode.register => 'Register',
                          AuthMode.verify => 'Verify',
                        }),
                      ),
                      if (_mode == AuthMode.verify) ...[
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: _loading || _email.text.trim().isEmpty
                              ? null
                              : _resendOtp,
                          icon: const Icon(Icons.mark_email_read_outlined),
                          label: const Text('Resend OTP'),
                        ),
                      ],
                      const SizedBox(height: 12),
                      NoticeBanner(error: _error, message: _message),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
