import 'package:flutter/material.dart';

import 'src/auth/auth_gateway.dart';
import 'src/core/api_client.dart';
import 'src/core/app_session.dart';
import 'src/ui/app_ui.dart';
import 'src/workspace/workspace_screen.dart';

const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:5000/api',
);

void main() {
  runApp(const MeroSwasthyaApp());
}

class MeroSwasthyaApp extends StatefulWidget {
  const MeroSwasthyaApp({super.key});

  @override
  State<MeroSwasthyaApp> createState() => _MeroSwasthyaAppState();
}

class _MeroSwasthyaAppState extends State<MeroSwasthyaApp> {
  late final AppSession _session = AppSession(ApiClient(baseUrl: apiBaseUrl));

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _session,
      builder: (context, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'MeroSwasthya',
          theme: buildMeroTheme(),
          home: _session.isAuthenticated
              ? WorkspaceScreen(session: _session)
              : AuthGateway(session: _session),
        );
      },
    );
  }
}
