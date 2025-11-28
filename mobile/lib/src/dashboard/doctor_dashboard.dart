import 'package:flutter/material.dart';

import '../chat/chat_panel.dart';
import '../core/api_client.dart';
import '../core/app_session.dart';
import '../ui/app_ui.dart';

class DoctorDashboard extends StatefulWidget {
  const DoctorDashboard({super.key, required this.session});

  final AppSession session;

  @override
  State<DoctorDashboard> createState() => _DoctorDashboardState();
}

class _DoctorDashboardState extends State<DoctorDashboard> {
  final _specialty = TextEditingController();
  final _license = TextEditingController();
  final _experienceYears = TextEditingController(text: '0');
  final _consultationFee = TextEditingController(text: '0');
  final _maxDailyBookings = TextEditingController(text: '10');
  final _bio = TextEditingController();
  final _diagnosis = TextEditingController();
  final _prescription = TextEditingController();
  final _tests = TextEditingController();
  final _followUpDate = TextEditingController();
  final _notes = TextEditingController();

  List<JsonMap> _appointments = <JsonMap>[];
  List<JsonMap> _reports = <JsonMap>[];
  String _reportAppointmentId = '';
  String _error = '';
  String _message = '';
  bool _hasProfile = false;
  bool _loading = true;
  int _tabIndex = 0;

  static const _tabs = <DashboardTab>[
    DashboardTab('Home', Icons.home_outlined),
    DashboardTab('Profile', Icons.badge_outlined),
    DashboardTab('Visits', Icons.calendar_month_outlined),
    DashboardTab('New Report', Icons.note_add_outlined),
    DashboardTab('Reports', Icons.description_outlined),
    DashboardTab('Chat', Icons.chat_bubble_outline),
  ];

  @override
  void initState() {
    super.initState();
    _loadOverview();
  }

  @override
  void dispose() {
    _specialty.dispose();
    _license.dispose();
    _experienceYears.dispose();
    _consultationFee.dispose();
    _maxDailyBookings.dispose();
    _bio.dispose();
    _diagnosis.dispose();
    _prescription.dispose();
    _tests.dispose();
    _followUpDate.dispose();
    _notes.dispose();
    super.dispose();
  }

  List<JsonMap> get _reportableAppointments {
    return _appointments
        .where(
          (appointment) => {
            'confirmed',
            'completed',
          }.contains(textOf(appointment['status'])),
        )
        .toList();
  }

  Future<void> _loadOverview() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final results = await Future.wait<JsonMap>([
        widget.session.api.get(
          '/doctor/me/profile',
          token: widget.session.token,
        ),
        widget.session.api.get('/appointment/my', token: widget.session.token),
        widget.session.api.get('/report/my', token: widget.session.token),
      ]);
      if (!mounted) return;

      final doctor = asJsonMap(results[0]['doctor']);
      _hydrateProfile(doctor);
      final appointments = asJsonList(results[1]['appointments']);

      setState(() {
        _hasProfile = doctor.isNotEmpty;
        _appointments = appointments;
        _reports = asJsonList(results[2]['reports']);
        _reportAppointmentId = _reportAppointmentId.isNotEmpty
            ? _reportAppointmentId
            : textOf(_reportableFrom(appointments).firstOrNull?['_id']);
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

  Iterable<JsonMap> _reportableFrom(Iterable<JsonMap> items) {
    return items.where(
      (item) => {'confirmed', 'completed'}.contains(textOf(item['status'])),
    );
  }

  void _hydrateProfile(JsonMap doctor) {
    if (doctor.isEmpty) return;

    _specialty.text = textOf(doctor['specialty']);
    _license.text = textOf(doctor['licenseNumber']);
    _experienceYears.text = '${intOf(doctor['experienceYears'])}';
    _consultationFee.text = '${doubleOf(doctor['consultationFee'])}';
    _maxDailyBookings.text = '${intOf(doctor['maxDailyBookings'], 10)}';
    _bio.text = textOf(doctor['bio']);
  }

  Future<void> _saveProfile() async {
    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      final body = <String, dynamic>{
        'specialty': _specialty.text.trim(),
        'licenseNumber': _license.text.trim(),
        'experienceYears': int.tryParse(_experienceYears.text) ?? 0,
        'consultationFee': double.tryParse(_consultationFee.text) ?? 0,
        'maxDailyBookings': int.tryParse(_maxDailyBookings.text) ?? 10,
        'bio': _bio.text.trim(),
      };

      if (_hasProfile) {
        await widget.session.api.put(
          '/doctor/me/profile',
          token: widget.session.token,
          body: body,
        );
      } else {
        await widget.session.api.post(
          '/doctor/create-profile',
          token: widget.session.token,
          body: body,
        );
      }
      if (!mounted) return;

      setState(() {
        _loading = false;
        _message = _hasProfile
            ? 'Profile updated.'
            : 'Profile submitted for approval.';
      });
      await _loadOverview();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _updateStatus(JsonMap appointment, String status) async {
    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      await widget.session.api.patch(
        '/appointment/${textOf(appointment['_id'])}/status',
        token: widget.session.token,
        body: <String, dynamic>{'status': status},
      );
      if (!mounted) return;
      setState(() => _message = 'Appointment updated.');
      await _loadOverview();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _saveReport() async {
    if (_reportAppointmentId.isEmpty || _diagnosis.text.trim().isEmpty) {
      setState(() => _error = 'Appointment and diagnosis are required.');
      return;
    }

    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      await widget.session.api.post(
        '/report',
        token: widget.session.token,
        body: <String, dynamic>{
          'appointmentId': _reportAppointmentId,
          'diagnosis': _diagnosis.text.trim(),
          'prescription': commaList(_prescription.text),
          'testRecommendations': commaList(_tests.text),
          'followUpDate': _followUpDate.text.isEmpty
              ? null
              : _followUpDate.text,
          'notes': _notes.text.trim(),
        },
      );
      if (!mounted) return;

      _diagnosis.clear();
      _prescription.clear();
      _tests.clear();
      _followUpDate.clear();
      _notes.clear();
      setState(() => _message = 'Report saved.');
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
          eyebrow: 'Doctor',
          title: 'Manage patient visits',
          summary:
              'Update your profile, appointment status, reports, and patient chat.',
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
      1 => _profileTab(),
      2 => _appointmentsTab(),
      3 => _reportTab(),
      4 => _reportsTab(),
      _ => ChatPanel(session: widget.session),
    };
  }

  Widget _overviewTab(BuildContext context) {
    final confirmed = _appointments
        .where((item) => textOf(item['status']) == 'confirmed')
        .length;
    final completed = _appointments
        .where((item) => textOf(item['status']) == 'completed')
        .length;
    final upcoming =
        _appointments
            .where(
              (item) =>
                  {'pending', 'confirmed'}.contains(textOf(item['status'])),
            )
            .toList()
          ..sort(
            (first, second) => _dateOf(
              first['scheduledAt'],
            ).compareTo(_dateOf(second['scheduledAt'])),
          );
    final nextAppointment = upcoming.isEmpty ? null : upcoming.first;
    final latestReport = _reports.isEmpty ? null : _reports.first;

    return SectionSurface(
      title: 'Doctor Home',
      description: _hasProfile
          ? 'Visits and reports at a glance.'
          : 'Complete your clinical profile before patients can book.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FilledButton.icon(
            onPressed: () => setState(() => _tabIndex = _hasProfile ? 2 : 1),
            icon: Icon(
              _hasProfile
                  ? Icons.calendar_month_outlined
                  : Icons.badge_outlined,
            ),
            label: Text(_hasProfile ? 'Open Visits' : 'Open Profile'),
          ),
          const SizedBox(height: 12),
          InlineWrap(
            children: [
              MetricTile(
                label: 'Total',
                value: '${_appointments.length}',
                caption: 'Appointments',
              ),
              MetricTile(
                label: 'Confirmed',
                value: '$confirmed',
                caption: 'Ready visits',
              ),
              MetricTile(
                label: 'Completed',
                value: '$completed',
                caption: 'Closed visits',
              ),
              MetricTile(
                label: 'Reports',
                value: '${_reports.length}',
                caption: 'Saved records',
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'Next Patient',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          if (nextAppointment == null)
            const EmptyPanel(title: 'No upcoming appointments')
          else
            _DoctorAppointmentTile(
              appointment: nextAppointment,
              busy: _loading,
              onStatus: _updateStatus,
              onReport: () {
                setState(() {
                  _reportAppointmentId = textOf(nextAppointment['_id']);
                  _tabIndex = 3;
                });
              },
            ),
          const SizedBox(height: 14),
          Text(
            'Latest Report',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          if (latestReport == null)
            const EmptyPanel(title: 'No reports yet')
          else
            _ReportListTile(report: latestReport),
        ],
      ),
    );
  }

  Widget _profileTab() {
    return SectionSurface(
      title: 'Doctor Profile',
      description: _hasProfile
          ? 'Keep specialty, fee, and booking capacity current.'
          : 'Submit a profile for admin approval.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LabeledField(
            label: 'Specialty',
            controller: _specialty,
            hintText: 'Cardiology',
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'License Number',
            controller: _license,
            hintText: 'NMC-12345',
            enabled: !_hasProfile,
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Experience Years',
            controller: _experienceYears,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Consultation Fee',
            controller: _consultationFee,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Daily Booking Limit',
            controller: _maxDailyBookings,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Bio',
            controller: _bio,
            maxLines: 4,
            hintText: 'Short professional summary',
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: _loading ? null : _saveProfile,
            icon: const Icon(Icons.save_outlined),
            label: Text(_hasProfile ? 'Update Profile' : 'Create Profile'),
          ),
        ],
      ),
    );
  }

  Widget _appointmentsTab() {
    return SectionSurface(
      title: 'Appointments',
      description: 'Confirm, complete, cancel, or mark no show.',
      child: _appointments.isEmpty
          ? const EmptyPanel(title: 'No appointments assigned')
          : Column(
              children: [
                for (final appointment in _appointments) ...[
                  _DoctorAppointmentTile(
                    appointment: appointment,
                    busy: _loading,
                    onStatus: _updateStatus,
                    onReport: () => setState(() {
                      _reportAppointmentId = textOf(appointment['_id']);
                      _tabIndex = 3;
                    }),
                  ),
                  if (appointment != _appointments.last)
                    const SizedBox(height: 8),
                ],
              ],
            ),
    );
  }

  Widget _reportTab() {
    return SectionSurface(
      title: 'Medical Report',
      description:
          'Create or update a report for confirmed or completed visits.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Appointment',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue:
                _reportableAppointments.any(
                  (item) => textOf(item['_id']) == _reportAppointmentId,
                )
                ? _reportAppointmentId
                : null,
            hint: const Text('Choose appointment'),
            items: _reportableAppointments
                .map(
                  (appointment) => DropdownMenuItem<String>(
                    value: textOf(appointment['_id']),
                    child: Text(
                      '${nestedText(appointment, ['patientUser', 'name'], 'Patient')} - '
                      '${formatDateTime(appointment['scheduledAt'])}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            onChanged: (id) => setState(() => _reportAppointmentId = id ?? ''),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Diagnosis',
            controller: _diagnosis,
            hintText: 'Diagnosis',
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Prescription',
            controller: _prescription,
            hintText: 'Medicine A, Medicine B',
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Tests',
            controller: _tests,
            hintText: 'CBC, X-Ray',
          ),
          const SizedBox(height: 12),
          DateField(label: 'Follow-up Date', controller: _followUpDate),
          const SizedBox(height: 12),
          LabeledField(label: 'Notes', controller: _notes, maxLines: 4),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: _loading ? null : _saveReport,
            icon: const Icon(Icons.note_add_outlined),
            label: const Text('Save Report'),
          ),
        ],
      ),
    );
  }

  Widget _reportsTab() {
    return SectionSurface(
      title: 'My Reports',
      description: 'Saved clinical reports from the web workflow.',
      child: _reports.isEmpty
          ? const EmptyPanel(title: 'No reports yet')
          : Column(
              children: [
                for (final report in _reports) ...[
                  _ReportListTile(report: report),
                  if (report != _reports.last) const SizedBox(height: 8),
                ],
              ],
            ),
    );
  }

  DateTime _dateOf(Object? value) {
    return DateTime.tryParse(textOf(value)) ??
        DateTime.fromMillisecondsSinceEpoch(0);
  }
}

class _DoctorAppointmentTile extends StatelessWidget {
  const _DoctorAppointmentTile({
    required this.appointment,
    required this.busy,
    required this.onStatus,
    required this.onReport,
  });

  final JsonMap appointment;
  final bool busy;
  final Future<void> Function(JsonMap appointment, String status) onStatus;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final status = textOf(appointment['status'], 'unknown');
    final canReport = {'confirmed', 'completed'}.contains(status);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: MeroPalette.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AvatarBadge(
                label: nestedText(appointment, [
                  'patientUser',
                  'name',
                ], 'Patient'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nestedText(appointment, [
                        'patientUser',
                        'name',
                      ], 'Patient'),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      '${nestedText(appointment, ['hospitalId', 'name'], 'Independent clinic')} - '
                      'Token #${textOf(appointment['queueNumber'], '-')}',
                    ),
                    Text(
                      '${formatDateTime(appointment['scheduledAt'])} - ${textOf(appointment['reason'])}',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
                    ),
                  ],
                ),
              ),
              StatusBadge(status: status),
            ],
          ),
          const SizedBox(height: 10),
          InlineWrap(
            children: [
              for (final nextStatus in const [
                'confirmed',
                'completed',
                'cancelled',
                'no_show',
              ])
                OutlinedButton(
                  onPressed: busy || status == nextStatus
                      ? null
                      : () => onStatus(appointment, nextStatus),
                  child: Text(nextStatus.replaceAll('_', ' ')),
                ),
              if (canReport)
                FilledButton.icon(
                  onPressed: onReport,
                  icon: const Icon(Icons.note_add_outlined),
                  label: const Text('Report'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReportListTile extends StatelessWidget {
  const _ReportListTile({required this.report});

  final JsonMap report;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: MeroPalette.line),
        borderRadius: BorderRadius.circular(8),
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
            nestedText(report, ['hospitalId', 'name'], 'Independent clinic'),
          ),
          Text(
            formatDateTime(report['createdAt']),
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
          ),
          if (textOf(report['notes']).isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(textOf(report['notes'])),
          ],
        ],
      ),
    );
  }
}
