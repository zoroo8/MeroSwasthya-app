import 'package:flutter/material.dart';

import '../chat/chat_panel.dart';
import '../core/api_client.dart';
import '../core/app_session.dart';
import '../reports/report_details_screen.dart';
import '../ui/app_ui.dart';
import 'patient_hospital_detail_screen.dart';

class PatientDashboard extends StatefulWidget {
  const PatientDashboard({super.key, required this.session});

  final AppSession session;

  @override
  State<PatientDashboard> createState() => _PatientDashboardState();
}

class _PatientDashboardState extends State<PatientDashboard> {
  final _hospitalSearch = TextEditingController();
  final _dateOfBirth = TextEditingController();
  final _address = TextEditingController();
  final _emergencyName = TextEditingController();
  final _emergencyPhone = TextEditingController();
  final _allergies = TextEditingController();
  final _conditions = TextEditingController();

  List<JsonMap> _hospitals = <JsonMap>[];
  List<JsonMap> _appointments = <JsonMap>[];
  List<JsonMap> _history = <JsonMap>[];
  String _gender = 'male';
  String _bloodGroup = 'O+';
  String _error = '';
  String _message = '';
  bool _loading = true;
  int _tabIndex = 0;

  static const _tabs = <DashboardTab>[
    DashboardTab('Home', Icons.home_outlined),
    DashboardTab('Hospitals', Icons.local_hospital_outlined),
    DashboardTab('Appointments', Icons.calendar_month_outlined),
    DashboardTab('Records', Icons.description_outlined),
    DashboardTab('Profile', Icons.person_outline),
    DashboardTab('Chat', Icons.chat_bubble_outline),
  ];

  @override
  void initState() {
    super.initState();
    _loadOverview();
  }

  @override
  void dispose() {
    _hospitalSearch.dispose();
    _dateOfBirth.dispose();
    _address.dispose();
    _emergencyName.dispose();
    _emergencyPhone.dispose();
    _allergies.dispose();
    _conditions.dispose();
    super.dispose();
  }

  Future<void> _loadOverview() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final results = await Future.wait<JsonMap>([
        widget.session.api.get('/hospital', token: widget.session.token),
        widget.session.api.get('/appointment/my', token: widget.session.token),
        widget.session.api.get(
          '/patient/me/history',
          token: widget.session.token,
        ),
        widget.session.api.get('/patient/me', token: widget.session.token),
      ]);
      if (!mounted) return;

      _hydrateProfile(asJsonMap(results[3]['profile']));
      setState(() {
        _hospitals = asJsonList(results[0]['hospitals']);
        _appointments = asJsonList(results[1]['appointments']);
        _history = asJsonList(results[2]['history']);
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

  void _hydrateProfile(JsonMap profile) {
    _dateOfBirth.text = textOf(profile['dateOfBirth']).split('T').first;
    _gender = textOf(profile['gender'], 'male');
    _bloodGroup = textOf(profile['bloodGroup'], 'O+');
    _address.text = textOf(profile['address']);
    _emergencyName.text = textOf(profile['emergencyContactName']);
    _emergencyPhone.text = textOf(profile['emergencyContactPhone']);
    _allergies.text = stringList(profile['allergies']).join(', ');
    _conditions.text = stringList(profile['chronicConditions']).join(', ');
  }

  Future<void> _searchHospitals() async {
    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      final data = await widget.session.api.get(
        '/hospital',
        token: widget.session.token,
        query: <String, String>{'search': _hospitalSearch.text.trim()},
      );
      if (!mounted) return;
      setState(() {
        _hospitals = asJsonList(data['hospitals']);
        _loading = false;
        _message = 'Hospitals loaded.';
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _saveProfile() async {
    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      await widget.session.api.put(
        '/patient/me',
        token: widget.session.token,
        body: <String, dynamic>{
          'dateOfBirth': _dateOfBirth.text.isEmpty ? null : _dateOfBirth.text,
          'gender': _gender,
          'bloodGroup': _bloodGroup,
          'address': _address.text.trim(),
          'emergencyContactName': _emergencyName.text.trim(),
          'emergencyContactPhone': _emergencyPhone.text.trim(),
          'allergies': commaList(_allergies.text),
          'chronicConditions': commaList(_conditions.text),
        },
      );
      if (!mounted) return;
      setState(() {
        _loading = false;
        _message = 'Profile saved.';
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _openHospital(JsonMap hospital) async {
    final hospitalId = textOf(hospital['_id']);
    if (hospitalId.isEmpty) return;

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => PatientHospitalDetailScreen(
          session: widget.session,
          hospitalId: hospitalId,
        ),
      ),
    );
    await _loadOverview();
  }

  Future<void> _openReport(JsonMap report) async {
    final reportId = textOf(report['id'], textOf(report['_id']));
    if (reportId.isEmpty) return;

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) =>
            ReportDetailsScreen(session: widget.session, reportId: reportId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DashboardListFrame(
      onRefresh: _loadOverview,
      children: [
        DashboardHeader(
          eyebrow: 'Patient',
          title: 'Manage your care',
          summary:
              'Book appointments, view visits, and keep your health records close.',
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
      0 => _homeTab(context),
      1 => _hospitalTab(context),
      2 => _appointmentTab(),
      3 => _historyTab(),
      4 => _profileTab(),
      _ => ChatPanel(session: widget.session),
    };
  }

  Widget _homeTab(BuildContext context) {
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
    final next = upcoming.isEmpty ? null : upcoming.first;
    final recentHistory = _history.take(2).toList();

    return SectionSurface(
      title: 'Patient Home',
      description:
          'The next appointment and recent records from your care workspace.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: MeroPalette.tint,
              borderRadius: BorderRadius.circular(8),
            ),
            child: next == null
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Upcoming appointment',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 5),
                      const Text(
                        'Book your next visit from the hospital directory.',
                      ),
                      const SizedBox(height: 10),
                      FilledButton.icon(
                        onPressed: () => setState(() => _tabIndex = 1),
                        icon: const Icon(Icons.search),
                        label: const Text('Find hospital'),
                      ),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Upcoming appointment',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        nestedText(next, ['doctor', 'user', 'name'], 'Doctor'),
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        '${nestedText(next, ['hospitalId', 'name'], 'Independent clinic')} - '
                        'Token #${textOf(next['queueNumber'], '-')}',
                      ),
                      Text(formatDateTime(next['scheduledAt'])),
                    ],
                  ),
          ),
          const SizedBox(height: 12),
          InlineWrap(
            children: [
              OutlinedButton.icon(
                onPressed: () => setState(() => _tabIndex = 1),
                icon: const Icon(Icons.local_hospital_outlined),
                label: const Text('Book'),
              ),
              OutlinedButton.icon(
                onPressed: () => setState(() => _tabIndex = 2),
                icon: const Icon(Icons.calendar_month_outlined),
                label: const Text('Appointments'),
              ),
              OutlinedButton.icon(
                onPressed: () => setState(() => _tabIndex = 3),
                icon: const Icon(Icons.description_outlined),
                label: const Text('Records'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'Past visits',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          if (recentHistory.isEmpty)
            const EmptyPanel(
              title: 'No past visits yet',
              description:
                  'Completed visits and attached reports will appear here.',
            )
          else
            for (final history in recentHistory) ...[
              _HistoryTile(item: history, onOpenReport: _openReport),
              if (history != recentHistory.last) const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }

  Widget _hospitalTab(BuildContext context) {
    return SectionSurface(
      title: 'Hospitals',
      description:
          'Browse hospitals and open details to see approved doctors and availability.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _hospitalSearch,
                  decoration: const InputDecoration(
                    hintText: 'Hospital name, address, phone',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: _loading ? null : _searchHospitals,
                child: const Text('Search'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_hospitals.isEmpty)
            const EmptyPanel(title: 'No hospitals available')
          else
            for (final hospital in _hospitals) ...[
              _HospitalTile(
                session: widget.session,
                hospital: hospital,
                onOpen: () => _openHospital(hospital),
              ),
              if (hospital != _hospitals.last) const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }

  Widget _appointmentTab() {
    return SectionSurface(
      title: 'My Appointments',
      description: 'Track token numbers and appointment status.',
      child: _appointments.isEmpty
          ? const EmptyPanel(
              title: 'No appointments yet',
              description: 'Book from a hospital to see visits here.',
            )
          : Column(
              children: [
                for (final appointment in _appointments) ...[
                  _AppointmentTile(item: appointment),
                  if (appointment != _appointments.last)
                    const SizedBox(height: 8),
                ],
              ],
            ),
    );
  }

  Widget _historyTab() {
    return SectionSurface(
      title: 'Visit Records',
      description: 'Open reports from the appointment they belong to.',
      child: _history.isEmpty
          ? const EmptyPanel(
              title: 'No history yet',
              description: 'Past appointments and reports will appear here.',
            )
          : Column(
              children: [
                for (final item in _history) ...[
                  _HistoryTile(item: item, onOpenReport: _openReport),
                  if (item != _history.last) const SizedBox(height: 8),
                ],
              ],
            ),
    );
  }

  Widget _profileTab() {
    return SectionSurface(
      title: 'Patient Profile',
      description: 'Keep health basics ready before booking.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DateField(label: 'Date of Birth', controller: _dateOfBirth),
          const SizedBox(height: 12),
          _DropdownField<String>(
            label: 'Gender',
            value: _gender,
            values: const ['male', 'female', 'other'],
            labelOf: (value) => value[0].toUpperCase() + value.substring(1),
            onChanged: (value) => setState(() => _gender = value),
          ),
          const SizedBox(height: 12),
          _DropdownField<String>(
            label: 'Blood Group',
            value: _bloodGroup,
            values: const ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
            labelOf: (value) => value,
            onChanged: (value) => setState(() => _bloodGroup = value),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Address',
            controller: _address,
            hintText: 'City, ward, street',
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Emergency Contact Name',
            controller: _emergencyName,
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Emergency Contact Phone',
            controller: _emergencyPhone,
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Allergies',
            controller: _allergies,
            hintText: 'dust, penicillin',
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Chronic Conditions',
            controller: _conditions,
            hintText: 'diabetes, asthma',
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: _loading ? null : _saveProfile,
            icon: const Icon(Icons.save_outlined),
            label: const Text('Save Profile'),
          ),
        ],
      ),
    );
  }

  DateTime _dateOf(Object? value) {
    return DateTime.tryParse(textOf(value)) ??
        DateTime.fromMillisecondsSinceEpoch(0);
  }
}

class _AppointmentTile extends StatelessWidget {
  const _AppointmentTile({required this.item});

  final JsonMap item;

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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AvatarBadge(
            label: nestedText(item, ['doctor', 'user', 'name'], 'Doctor'),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  nestedText(item, ['doctor', 'user', 'name'], 'Doctor'),
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                Text(
                  '${nestedText(item, ['hospitalId', 'name'], 'Independent clinic')} - '
                  'Token #${textOf(item['queueNumber'], '-')}',
                ),
                Text(
                  formatDateTime(item['scheduledAt']),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
                ),
              ],
            ),
          ),
          StatusBadge(status: textOf(item['status'], 'unknown')),
        ],
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.item, required this.onOpenReport});

  final JsonMap item;
  final ValueChanged<JsonMap> onOpenReport;

  @override
  Widget build(BuildContext context) {
    final report = asJsonMap(item['report']);

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
                label: nestedText(item, ['doctor', 'name'], 'Doctor'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nestedText(item, ['doctor', 'name'], 'Doctor'),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      nestedText(item, [
                        'hospital',
                        'name',
                      ], 'Independent clinic'),
                    ),
                    Text(
                      formatDateTime(item['date']),
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
                    ),
                  ],
                ),
              ),
              StatusBadge(status: textOf(item['status'], 'unknown')),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            report.isEmpty
                ? 'No report attached yet.'
                : 'Report: ${textOf(report['diagnosis'], 'Diagnosis not set')}',
          ),
          if (report.isNotEmpty) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => onOpenReport(report),
              icon: const Icon(Icons.description_outlined),
              label: const Text('View Report'),
            ),
          ],
        ],
      ),
    );
  }
}

class _HospitalTile extends StatelessWidget {
  const _HospitalTile({
    required this.session,
    required this.hospital,
    required this.onOpen,
  });

  final AppSession session;
  final JsonMap hospital;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final imageUrl = session.api.assetUrl(
      textOf(
        hospital['bannerImage'],
        nestedText(hospital, ['adminUser', 'profileImage']),
      ),
    );

    return InkWell(
      onTap: onOpen,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: MeroPalette.line),
        ),
        child: Row(
          children: [
            AvatarBadge(
              label: textOf(hospital['name'], 'Hospital'),
              imageUrl: imageUrl,
              size: 58,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    textOf(hospital['name'], 'Hospital'),
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  Text(textOf(hospital['address'], 'Address not set')),
                  Text(
                    textOf(
                      hospital['phone'],
                      textOf(hospital['email'], 'Contact not set'),
                    ),
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}

class _DropdownField<T> extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.values,
    required this.labelOf,
    required this.onChanged,
  });

  final String label;
  final T value;
  final List<T> values;
  final String Function(T value) labelOf;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<T>(
          initialValue: value,
          items: values
              .map(
                (item) => DropdownMenuItem<T>(
                  value: item,
                  child: Text(labelOf(item)),
                ),
              )
              .toList(),
          onChanged: (nextValue) {
            if (nextValue != null) onChanged(nextValue);
          },
        ),
      ],
    );
  }
}
