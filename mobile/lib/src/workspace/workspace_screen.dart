import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api_client.dart';
import '../core/app_session.dart';
import '../dashboard/admin_dashboard.dart';
import '../dashboard/doctor_dashboard.dart';
import '../dashboard/hospital_dashboard.dart';
import '../dashboard/patient_dashboard.dart';
import '../ui/app_ui.dart';

class WorkspaceScreen extends StatelessWidget {
  const WorkspaceScreen({super.key, required this.session});

  final AppSession session;

  @override
  Widget build(BuildContext context) {
    final roleLabel = session.role.replaceAll('_', ' ');
    final imageUrl = session.api.assetUrl(session.user?['profileImage']);

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        title: const BrandLockup(subtitle: 'Hospital Management System'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: PopupMenuButton<String>(
              tooltip: 'Account menu',
              onSelected: (value) {
                if (value == 'logout') {
                  session.logout();
                }

                if (value == 'profile-image') {
                  _openProfileImageSheet(context);
                }
              },
              itemBuilder: (context) => [
                PopupMenuItem<String>(
                  enabled: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session.displayName,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        roleLabel,
                        style: const TextStyle(color: MeroPalette.muted),
                      ),
                    ],
                  ),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem<String>(
                  value: 'profile-image',
                  child: Row(
                    children: [
                      Icon(Icons.add_a_photo_outlined, size: 18),
                      SizedBox(width: 8),
                      Text('Change Profile Picture'),
                    ],
                  ),
                ),
                const PopupMenuItem<String>(
                  value: 'logout',
                  child: Row(
                    children: [
                      Icon(Icons.logout, size: 18),
                      SizedBox(width: 8),
                      Text('Logout'),
                    ],
                  ),
                ),
              ],
              child: AvatarBadge(
                label: session.displayName,
                imageUrl: imageUrl,
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: switch (session.role) {
          'admin' => AdminDashboard(session: session),
          'doctor' => DoctorDashboard(session: session),
          'hospital' => HospitalDashboard(session: session),
          _ => PatientDashboard(session: session),
        },
      ),
    );
  }

  Future<void> _openProfileImageSheet(BuildContext context) async {
    final hasPhoto = textOf(session.user?['profileImage']).isNotEmpty;
    final action = await showModalBottomSheet<_ProfileImageAction>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take Photo'),
              onTap: () =>
                  Navigator.of(sheetContext).pop(_ProfileImageAction.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from Gallery'),
              onTap: () =>
                  Navigator.of(sheetContext).pop(_ProfileImageAction.gallery),
            ),
            ListTile(
              enabled: hasPhoto,
              leading: const Icon(Icons.delete_outline),
              title: const Text('Remove Photo'),
              onTap: hasPhoto
                  ? () => Navigator.of(
                      sheetContext,
                    ).pop(_ProfileImageAction.remove)
                  : null,
            ),
          ],
        ),
      ),
    );

    if (!context.mounted || action == null) return;
    if (action == _ProfileImageAction.remove) {
      await _removeProfileImage(context);
      return;
    }

    await _pickProfileImage(
      context,
      action == _ProfileImageAction.camera
          ? ImageSource.camera
          : ImageSource.gallery,
    );
  }

  Future<void> _pickProfileImage(
    BuildContext context,
    ImageSource source,
  ) async {
    try {
      final image = await ImagePicker().pickImage(
        source: source,
        imageQuality: 86,
        maxWidth: 1600,
      );
      if (image == null) return;

      final data = await session.api.uploadFile(
        '/auth/me/profile-image',
        filePath: image.path,
        fieldName: 'profileImage',
        token: session.token,
      );
      session.updateProfileImage(asJsonMap(data['user'])['profileImage']);
      if (!context.mounted) return;
      _showMessage(context, 'Profile picture updated.');
    } on ApiException catch (error) {
      if (!context.mounted) return;
      _showMessage(context, error.message);
    } catch (_) {
      if (!context.mounted) return;
      _showMessage(context, 'Profile picture could not be changed.');
    }
  }

  Future<void> _removeProfileImage(BuildContext context) async {
    try {
      final data = await session.api.delete(
        '/auth/me/profile-image',
        token: session.token,
      );
      session.updateProfileImage(asJsonMap(data['user'])['profileImage']);
      if (!context.mounted) return;
      _showMessage(context, 'Profile picture removed.');
    } on ApiException catch (error) {
      if (!context.mounted) return;
      _showMessage(context, error.message);
    }
  }

  void _showMessage(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }
}

enum _ProfileImageAction { camera, gallery, remove }
