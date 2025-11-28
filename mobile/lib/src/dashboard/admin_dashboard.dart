import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/app_session.dart';
import '../ui/app_ui.dart';

class AdminDashboard extends StatefulWidget {
  const AdminDashboard({super.key, required this.session});

  final AppSession session;

  @override
  State<AdminDashboard> createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<AdminDashboard> {
  final _userName = TextEditingController();
  final _userEmail = TextEditingController();
  final _userPassword = TextEditingController();
  final _userPhone = TextEditingController();
  final _userImage = TextEditingController();
  final _hospitalName = TextEditingController();
  final _hospitalAdminId = TextEditingController();
  final _hospitalEmail = TextEditingController();
  final _hospitalPhone = TextEditingController();
  final _hospitalAddress = TextEditingController();
  final _hospitalImage = TextEditingController();

  JsonMap _stats = <String, dynamic>{};
  List<JsonMap> _pendingDoctors = <JsonMap>[];
  List<JsonMap> _reports = <JsonMap>[];
  String _userRole = 'doctor';
  bool _userVerified = true;
  bool _loading = true;
  String _error = '';
  String _message = '';
  int _tabIndex = 0;

  static const _tabs = <DashboardTab>[
    DashboardTab('Home', Icons.home_outlined),
    DashboardTab('Users', Icons.group_add_outlined),
    DashboardTab('Hospitals', Icons.local_hospital_outlined),
    DashboardTab('Approvals', Icons.verified_outlined),
    DashboardTab('Reports', Icons.description_outlined),
  ];

  @override
  void initState() {
    super.initState();
    _loadOverview();
  }

  @override
  void dispose() {
    _userName.dispose();
    _userEmail.dispose();
    _userPassword.dispose();
    _userPhone.dispose();
    _userImage.dispose();
    _hospitalName.dispose();
    _hospitalAdminId.dispose();
    _hospitalEmail.dispose();
    _hospitalPhone.dispose();
    _hospitalAddress.dispose();
    _hospitalImage.dispose();
    super.dispose();
  }

  Future<void> _loadOverview() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final results = await Future.wait<JsonMap>([
        widget.session.api.get('/admin/stats', token: widget.session.token),
        widget.session.api.get(
          '/doctor/pending-approvals',
          token: widget.session.token,
        ),
        widget.session.api.get('/report/my', token: widget.session.token),
      ]);
      if (!mounted) return;

      setState(() {
        _stats = asJsonMap(results[0]['stats']);
        _pendingDoctors = asJsonList(results[1]['doctors']);
        _reports = asJsonList(results[2]['reports']);
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

  Future<void> _createUser() async {
    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      await widget.session.api.post(
        '/admin/users',
        token: widget.session.token,
        body: <String, dynamic>{
          'name': _userName.text.trim(),
          'email': _userEmail.text.trim().toLowerCase(),
          'password': _userPassword.text,
          'role': _userRole,
          'phone': _userPhone.text.trim(),
          'profileImage': _userImage.text.trim(),
          'isVerified': _userVerified,
        },
      );
      if (!mounted) return;

      _userName.clear();
      _userEmail.clear();
      _userPassword.clear();
      _userPhone.clear();
      _userImage.clear();
      setState(() => _message = 'User created.');
      await _loadOverview();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _createHospital() async {
    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      await widget.session.api.post(
        '/admin/hospitals',
        token: widget.session.token,
        body: <String, dynamic>{
          'name': _hospitalName.text.trim(),
          'hospitalAdminUserId': _hospitalAdminId.text.trim(),
          'email': _hospitalEmail.text.trim(),
          'phone': _hospitalPhone.text.trim(),
          'address': _hospitalAddress.text.trim(),
          'bannerImage': _hospitalImage.text.trim(),
        },
      );
      if (!mounted) return;

      _hospitalName.clear();
      _hospitalAdminId.clear();
      _hospitalEmail.clear();
      _hospitalPhone.clear();
      _hospitalAddress.clear();
      _hospitalImage.clear();
      setState(() => _message = 'Hospital created.');
      await _loadOverview();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _approve(JsonMap doctor) async {
    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      await widget.session.api.patch(
        '/doctor/${textOf(doctor['_id'])}/approve',
        token: widget.session.token,
        body: <String, dynamic>{},
      );
      if (!mounted) return;
      setState(() => _message = 'Doctor approved.');
      await _loadOverview();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return DashboardListFrame(
      onRefresh: _loadOverview,
      children: [
        DashboardHeader(
          eyebrow: 'Admin',
          title: 'Manage the system',
          summary:
              'Create users and hospitals, approve doctors, and review reports.',
          signedInAs: widget.session.displayName,
        ),
        DashboardTabStrip(
          tabs: _tabs,
          index: _tabIndex,
          onChanged: (index) => setState(() {
            _tabIndex = index;
            _error = '';
            _message = '';
          }),
        ),
        if (_loading) const LinearProgressIndicator(),
        _buildTab(context),
        NoticeBanner(error: _error, message: _message),
      ],
    );
  }

  Widget _buildTab(BuildContext context) {
    return switch (_tabIndex) {
      0 => _overviewTab(context),
      1 => _userTab(),
      2 => _hospitalTab(),
      3 => _approvalTab(),
      _ => _reportTab(),
    };
  }

  Widget _overviewTab(BuildContext context) {
    return SectionSurface(
      title: 'Admin Home',
      description:
          'Review activity before opening creation and approval tools.',
      trailing: IconButton(
        tooltip: 'Refresh data',
        onPressed: _loading ? null : _loadOverview,
        icon: const Icon(Icons.refresh),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InlineWrap(
            children: [
              MetricTile(
                label: 'Total Users',
                value: '${intOf(_stats['totalUsers'])}',
                caption: 'Accounts',
              ),
              MetricTile(
                label: 'Patients',
                value: '${intOf(_stats['patients'])}',
                caption: 'Care users',
              ),
              MetricTile(
                label: 'Doctors',
                value: '${intOf(_stats['doctors'])}',
                caption: 'Clinicians',
              ),
              MetricTile(
                label: 'Hospitals',
                value: '${intOf(_stats['hospitals'])}',
                caption: 'Facilities',
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Doctor Approvals',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
              TextButton(
                onPressed: () => setState(() => _tabIndex = 3),
                child: const Text('Review'),
              ),
            ],
          ),
          if (_pendingDoctors.isEmpty)
            const EmptyPanel(title: 'No pending doctors')
          else
            for (final doctor in _pendingDoctors.take(3)) ...[
              _ApprovalTile(
                doctor: doctor,
                busy: _loading,
                onApprove: () => _approve(doctor),
              ),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Recent Reports',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
              TextButton(
                onPressed: () => setState(() => _tabIndex = 4),
                child: const Text('View all'),
              ),
            ],
          ),
          if (_reports.isEmpty)
            const EmptyPanel(title: 'No reports yet')
          else
            for (final report in _reports.take(3)) ...[
              _AdminReportTile(report: report),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }

  Widget _userTab() {
    return SectionSurface(
      title: 'Create User',
      description: 'Add doctor, hospital admin, patient, or admin accounts.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LabeledField(label: 'Name', controller: _userName),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Email',
            controller: _userEmail,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Password',
            controller: _userPassword,
            obscureText: true,
          ),
          const SizedBox(height: 12),
          const Text(
            'Role',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue: _userRole,
            items: const [
              DropdownMenuItem(value: 'doctor', child: Text('Doctor')),
              DropdownMenuItem(
                value: 'hospital',
                child: Text('Hospital Admin'),
              ),
              DropdownMenuItem(value: 'patient', child: Text('Patient')),
              DropdownMenuItem(value: 'admin', child: Text('Admin')),
            ],
            onChanged: (role) => setState(() => _userRole = role ?? 'doctor'),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Phone',
            controller: _userPhone,
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Profile Image URL',
            controller: _userImage,
            hintText: 'https://...',
          ),
          const SizedBox(height: 8),
          SwitchListTile.adaptive(
            value: _userVerified,
            contentPadding: EdgeInsets.zero,
            title: const Text('Mark as verified'),
            onChanged: (value) => setState(() => _userVerified = value),
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _loading ? null : _createUser,
            icon: const Icon(Icons.group_add_outlined),
            label: const Text('Create User'),
          ),
        ],
      ),
    );
  }

  Widget _hospitalTab() {
    return SectionSurface(
      title: 'Create Hospital',
      description: 'Link a hospital to an existing hospital-role admin user.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LabeledField(label: 'Hospital Name', controller: _hospitalName),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Hospital Admin User ID',
            controller: _hospitalAdminId,
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Email',
            controller: _hospitalEmail,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Phone',
            controller: _hospitalPhone,
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 12),
          LabeledField(label: 'Address', controller: _hospitalAddress),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Banner Image URL',
            controller: _hospitalImage,
            hintText: 'https://...',
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: _loading ? null : _createHospital,
            icon: const Icon(Icons.local_hospital_outlined),
            label: const Text('Create Hospital'),
          ),
        ],
      ),
    );
  }

  Widget _approvalTab() {
    return SectionSurface(
      title: 'Doctor Approvals',
      description: 'Approve valid doctor profiles before patient booking.',
      trailing: IconButton(
        tooltip: 'Refresh approvals',
        onPressed: _loading ? null : _loadOverview,
        icon: const Icon(Icons.refresh),
      ),
      child: _pendingDoctors.isEmpty
          ? const EmptyPanel(title: 'No pending doctors')
          : Column(
              children: [
                for (final doctor in _pendingDoctors) ...[
                  _ApprovalTile(
                    doctor: doctor,
                    busy: _loading,
                    onApprove: () => _approve(doctor),
                  ),
                  if (doctor != _pendingDoctors.last) const SizedBox(height: 8),
                ],
              ],
            ),
    );
  }

  Widget _reportTab() {
    return SectionSurface(
      title: 'System Reports',
      description: 'Medical reports visible to the admin role.',
      child: _reports.isEmpty
          ? const EmptyPanel(title: 'No reports yet')
          : Column(
              children: [
                for (final report in _reports) ...[
                  _AdminReportTile(report: report),
                  if (report != _reports.last) const SizedBox(height: 8),
                ],
              ],
            ),
    );
  }
}

class _ApprovalTile extends StatelessWidget {
  const _ApprovalTile({
    required this.doctor,
    required this.busy,
    required this.onApprove,
  });

  final JsonMap doctor;
  final bool busy;
  final VoidCallback onApprove;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: MeroPalette.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AvatarBadge(label: nestedText(doctor, ['user', 'name'], 'Doctor')),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  nestedText(doctor, ['user', 'name'], 'Doctor'),
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                Text(
                  '${textOf(doctor['specialty'], 'Specialty')} - '
                  'License ${textOf(doctor['licenseNumber'], '-')}',
                ),
                Text(
                  '${nestedText(doctor, ['user', 'email'], 'No email')} - '
                  '${intOf(doctor['experienceYears'])} years',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
                ),
              ],
            ),
          ),
          FilledButton(
            onPressed: busy ? null : onApprove,
            child: const Text('Approve'),
          ),
        ],
      ),
    );
  }
}

class _AdminReportTile extends StatelessWidget {
  const _AdminReportTile({required this.report});

  final JsonMap report;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: MeroPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${nestedText(report, ['patientUser', 'name'], 'Patient')} - '
            '${textOf(report['diagnosis'], 'Diagnosis')}',
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          Text(
            '${nestedText(report, ['doctor', 'user', 'name'], 'Doctor')} - '
            '${nestedText(report, ['hospitalId', 'name'], 'No hospital')}',
          ),
          Text(
            formatDateTime(report['createdAt']),
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
          ),
        ],
      ),
    );
  }
}
