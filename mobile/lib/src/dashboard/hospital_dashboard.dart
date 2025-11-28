import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/app_session.dart';
import '../ui/app_ui.dart';
import '../ui/date_calendars.dart';

class HospitalDashboard extends StatefulWidget {
  const HospitalDashboard({super.key, required this.session});

  final AppSession session;

  @override
  State<HospitalDashboard> createState() => _HospitalDashboardState();
}

class _HospitalDashboardState extends State<HospitalDashboard> {
  final _hospitalName = TextEditingController();
  final _hospitalEmail = TextEditingController();
  final _hospitalPhone = TextEditingController();
  final _hospitalAddress = TextEditingController();
  final _hospitalBanner = TextEditingController();
  final _candidateSearch = TextEditingController();
  final _diagnosis = TextEditingController();
  final _prescription = TextEditingController();
  final _tests = TextEditingController();
  final _followUpDate = TextEditingController();
  final _notes = TextEditingController();
  final Map<String, Map<String, int>> _candidateAvailability = {};
  final Map<String, Map<String, int>> _availabilityEdits = {};

  List<JsonMap> _hospitals = <JsonMap>[];
  List<JsonMap> _doctors = <JsonMap>[];
  List<JsonMap> _candidates = <JsonMap>[];
  List<JsonMap> _appointments = <JsonMap>[];
  List<JsonMap> _reports = <JsonMap>[];
  String _hospitalId = '';
  String _reportAppointmentId = '';
  String _error = '';
  String _message = '';
  bool _loading = true;
  int _tabIndex = 0;

  static const _tabs = <DashboardTab>[
    DashboardTab('Home', Icons.home_outlined),
    DashboardTab('Profile', Icons.local_hospital_outlined),
    DashboardTab('Doctors', Icons.medical_services_outlined),
    DashboardTab('Visits', Icons.calendar_month_outlined),
    DashboardTab('New Report', Icons.note_add_outlined),
    DashboardTab('Reports', Icons.description_outlined),
  ];

  @override
  void initState() {
    super.initState();
    _loadOverview();
  }

  @override
  void dispose() {
    _hospitalName.dispose();
    _hospitalEmail.dispose();
    _hospitalPhone.dispose();
    _hospitalAddress.dispose();
    _hospitalBanner.dispose();
    _candidateSearch.dispose();
    _diagnosis.dispose();
    _prescription.dispose();
    _tests.dispose();
    _followUpDate.dispose();
    _notes.dispose();
    super.dispose();
  }

  JsonMap? get _selectedHospital {
    for (final hospital in _hospitals) {
      if (textOf(hospital['_id']) == _hospitalId) return hospital;
    }

    return null;
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
        widget.session.api.get('/hospital/mine', token: widget.session.token),
        widget.session.api.get('/appointment/my', token: widget.session.token),
        widget.session.api.get('/report/my', token: widget.session.token),
      ]);
      if (!mounted) return;

      final hospitals = asJsonList(results[0]['hospitals']);
      final appointments = asJsonList(results[1]['appointments']);
      final nextHospitalId =
          hospitals.any((hospital) => textOf(hospital['_id']) == _hospitalId)
          ? _hospitalId
          : textOf(hospitals.firstOrNull?['_id']);

      setState(() {
        _hospitals = hospitals;
        _appointments = appointments;
        _reports = asJsonList(results[2]['reports']);
        _hospitalId = nextHospitalId;
        _reportAppointmentId = _reportAppointmentId.isNotEmpty
            ? _reportAppointmentId
            : textOf(_reportableAppointments.firstOrNull?['_id']);
        _loading = false;
      });
      _hydrateHospital(_selectedHospital);
      await _loadDoctors();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  void _hydrateHospital(JsonMap? hospital) {
    _hospitalName.text = textOf(hospital?['name']);
    _hospitalEmail.text = textOf(hospital?['email']);
    _hospitalPhone.text = textOf(hospital?['phone']);
    _hospitalAddress.text = textOf(hospital?['address']);
    _hospitalBanner.text = textOf(hospital?['bannerImage']);
  }

  Future<void> _loadDoctors() async {
    if (_hospitalId.isEmpty) {
      setState(() {
        _doctors = <JsonMap>[];
        _candidates = <JsonMap>[];
      });
      return;
    }

    try {
      final data = await widget.session.api.get(
        '/hospital/$_hospitalId/doctors',
        token: widget.session.token,
      );
      if (!mounted) return;
      final doctors = asJsonList(data['doctors']);
      _replaceAvailabilityEdits(doctors);
      setState(() => _doctors = doctors);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  void _replaceAvailabilityEdits(List<JsonMap> doctors) {
    _availabilityEdits.clear();

    for (final doctor in doctors) {
      final doctorId = textOf(doctor['_id']);
      _availabilityEdits[doctorId] = availabilitySlotMap(
        doctor['availabilitySlots'],
      );
    }
  }

  Future<void> _saveHospital() async {
    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    final body = <String, dynamic>{
      'name': _hospitalName.text.trim(),
      'email': _hospitalEmail.text.trim(),
      'phone': _hospitalPhone.text.trim(),
      'address': _hospitalAddress.text.trim(),
      'bannerImage': _hospitalBanner.text.trim(),
    };

    try {
      if (_hospitalId.isEmpty) {
        final data = await widget.session.api.post(
          '/hospital',
          token: widget.session.token,
          body: body,
        );
        _hospitalId = textOf(nestedValue(data, ['hospital', '_id']));
      } else {
        await widget.session.api.patch(
          '/hospital/$_hospitalId',
          token: widget.session.token,
          body: body,
        );
      }
      if (!mounted) return;
      setState(
        () => _message = _hospitalId.isEmpty
            ? 'Hospital saved.'
            : 'Hospital profile saved.',
      );
      await _loadOverview();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _searchCandidates() async {
    if (_hospitalId.isEmpty) {
      setState(() => _error = 'Create or choose a hospital first.');
      return;
    }

    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      final data = await widget.session.api.get(
        '/hospital/doctor-candidates',
        token: widget.session.token,
        query: <String, String>{
          'hospitalId': _hospitalId,
          'search': _candidateSearch.text.trim(),
        },
      );
      if (!mounted) return;
      setState(() {
        _candidates = asJsonList(data['doctors']);
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

  Future<void> _addDoctor(JsonMap candidate) async {
    final profile = asJsonMap(candidate['profile']);
    final candidateKey = _candidateKey(candidate);
    final slots = availabilityPairs(
      _candidateAvailability[candidateKey] ?? <String, int>{},
    );
    if (_hospitalId.isEmpty || profile.isEmpty || slots.isEmpty) {
      setState(
        () => _error =
            'Choose a hospital and add availability dates before linking a doctor.',
      );
      return;
    }

    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      await widget.session.api.post(
        '/hospital/$_hospitalId/doctors',
        token: widget.session.token,
        body: <String, dynamic>{
          'doctorEmail': nestedText(candidate, ['user', 'email']),
          'specialty': textOf(profile['specialty']),
          'licenseNumber': textOf(profile['licenseNumber']),
          'experienceYears': intOf(profile['experienceYears']),
          'consultationFee': doubleOf(profile['consultationFee']),
          'availabilitySlots': slots,
        },
      );
      if (!mounted) return;

      setState(() {
        _candidateAvailability.remove(candidateKey);
        _message = 'Doctor added to hospital.';
      });
      await Future.wait([_loadDoctors(), _searchCandidates()]);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _updateAvailability(JsonMap doctor) async {
    final doctorId = textOf(doctor['_id']);
    final slots = availabilityPairs(_availabilityEdits[doctorId] ?? {});
    if (_hospitalId.isEmpty || doctorId.isEmpty || slots.isEmpty) {
      setState(
        () => _error = 'Availability must include at least one date and limit.',
      );
      return;
    }

    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      await widget.session.api.patch(
        '/hospital/$_hospitalId/doctors/$doctorId',
        token: widget.session.token,
        body: <String, dynamic>{'availabilitySlots': slots},
      );
      if (!mounted) return;
      setState(() => _message = 'Doctor availability updated.');
      await _loadDoctors();
      if (mounted) setState(() => _loading = false);
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
          eyebrow: 'Hospital',
          title: 'Manage hospital work',
          summary:
              'Keep doctors, availability, visits, and hospital reports in sync.',
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
      2 => _doctorTab(),
      3 => _appointmentTab(),
      4 => _reportTab(),
      _ => _reportsTab(),
    };
  }

  Widget _overviewTab(BuildContext context) {
    final confirmed = _appointments
        .where((item) => textOf(item['status']) == 'confirmed')
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
      title: 'Hospital Home',
      description: _selectedHospital == null
          ? 'Create a hospital profile before linking doctors.'
          : textOf(_selectedHospital?['name'], 'Hospital profile ready'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FilledButton.icon(
            onPressed: () =>
                setState(() => _tabIndex = _selectedHospital == null ? 1 : 2),
            icon: Icon(
              _selectedHospital == null
                  ? Icons.local_hospital_outlined
                  : Icons.medical_services_outlined,
            ),
            label: Text(
              _selectedHospital == null ? 'Open Profile' : 'Open Doctors',
            ),
          ),
          const SizedBox(height: 12),
          InlineWrap(
            children: [
              MetricTile(
                label: 'Doctors',
                value: '${_doctors.length}',
                caption: 'Linked staff',
              ),
              MetricTile(
                label: 'Appointments',
                value: '${_appointments.length}',
                caption: 'Total visits',
              ),
              MetricTile(
                label: 'Confirmed',
                value: '$confirmed',
                caption: 'Ready visits',
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
            'Next Appointment',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          if (nextAppointment == null)
            const EmptyPanel(title: 'No upcoming appointments')
          else
            _HospitalAppointmentTile(
              appointment: nextAppointment,
              onReport: () => setState(() {
                _reportAppointmentId = textOf(nextAppointment['_id']);
                _tabIndex = 4;
              }),
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
            _HospitalReportTile(report: latestReport),
        ],
      ),
    );
  }

  Widget _profileTab() {
    return SectionSurface(
      title: 'Hospital Profile',
      description: 'Create and manage hospitals connected to this account.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Current Hospital',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue:
                _hospitals.any(
                  (hospital) => textOf(hospital['_id']) == _hospitalId,
                )
                ? _hospitalId
                : null,
            hint: const Text('No hospital selected'),
            items: _hospitals
                .map(
                  (hospital) => DropdownMenuItem<String>(
                    value: textOf(hospital['_id']),
                    child: Text(textOf(hospital['name'], 'Hospital')),
                  ),
                )
                .toList(),
            onChanged: (id) async {
              setState(() {
                _hospitalId = id ?? '';
                _candidates = <JsonMap>[];
              });
              _hydrateHospital(_selectedHospital);
              await _loadDoctors();
            },
          ),
          const SizedBox(height: 12),
          if (_selectedHospital != null)
            Row(
              children: [
                AvatarBadge(
                  label: textOf(_selectedHospital?['name'], 'Hospital'),
                  imageUrl: widget.session.api.assetUrl(
                    textOf(
                      _selectedHospital?['bannerImage'],
                      nestedText(_selectedHospital, [
                        'adminUser',
                        'profileImage',
                      ]),
                    ),
                  ),
                  size: 60,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${textOf(_selectedHospital?['name'])}\n'
                    '${textOf(_selectedHospital?['address'], 'Address not set')}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          if (_selectedHospital != null) const SizedBox(height: 12),
          LabeledField(
            label: 'Hospital Name',
            controller: _hospitalName,
            hintText: 'City Care',
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
            controller: _hospitalBanner,
            hintText: 'https://...',
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: _loading ? null : _saveHospital,
            icon: const Icon(Icons.save_outlined),
            label: Text(
              _hospitalId.isEmpty ? 'Create Hospital' : 'Save Hospital',
            ),
          ),
        ],
      ),
    );
  }

  Widget _doctorTab() {
    return Column(
      children: [
        SectionSurface(
          title: 'Add Doctor From Database',
          description:
              'Search doctor users and link them with date-specific patient limits.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              LabeledField(
                label: 'Search Doctors',
                controller: _candidateSearch,
                hintText: 'Name, email, or phone',
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _loading ? null : _searchCandidates,
                icon: const Icon(Icons.search),
                label: const Text('Search'),
              ),
              const SizedBox(height: 12),
              if (_candidates.isEmpty)
                const EmptyPanel(
                  title: 'No doctor search results',
                  description: 'Search registered doctors before linking them.',
                )
              else
                for (final candidate in _candidates) ...[
                  _CandidateTile(
                    candidate: candidate,
                    busy: _loading,
                    slots:
                        _candidateAvailability[_candidateKey(candidate)] ??
                        <String, int>{},
                    onSlotsChanged: (slots) => setState(
                      () => _candidateAvailability[_candidateKey(candidate)] =
                          slots,
                    ),
                    onAdd: () => _addDoctor(candidate),
                  ),
                  if (candidate != _candidates.last) const SizedBox(height: 8),
                ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        SectionSurface(
          title: 'Hospital Doctors',
          description: 'Choose each available date and set its patient limit.',
          child: _doctors.isEmpty
              ? const EmptyPanel(
                  title: 'No doctors linked',
                  description: 'Link a doctor to begin accepting appointments.',
                )
              : Column(
                  children: [
                    for (final doctor in _doctors) ...[
                      _HospitalDoctorTile(
                        doctor: doctor,
                        slots:
                            _availabilityEdits[textOf(doctor['_id'])] ??
                            <String, int>{},
                        onSlotsChanged: (slots) => setState(
                          () =>
                              _availabilityEdits[textOf(doctor['_id'])] = slots,
                        ),
                        busy: _loading,
                        onSave: () => _updateAvailability(doctor),
                      ),
                      if (doctor != _doctors.last) const SizedBox(height: 8),
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  Widget _appointmentTab() {
    return SectionSurface(
      title: 'Appointments',
      description: 'Visits booked under your hospital account.',
      child: _appointments.isEmpty
          ? const EmptyPanel(title: 'No appointments yet')
          : Column(
              children: [
                for (final appointment in _appointments) ...[
                  _HospitalAppointmentTile(
                    appointment: appointment,
                    onReport: () => setState(() {
                      _reportAppointmentId = textOf(appointment['_id']);
                      _tabIndex = 4;
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
      title: 'Create Medical Report',
      description: 'Reports can be added after confirmed or completed visits.',
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
          LabeledField(label: 'Diagnosis', controller: _diagnosis),
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
      title: 'Reports',
      description: 'Reports created under hospital appointments.',
      child: _reports.isEmpty
          ? const EmptyPanel(title: 'No reports yet')
          : Column(
              children: [
                for (final report in _reports) ...[
                  _HospitalReportTile(report: report),
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

  String _candidateKey(JsonMap candidate) {
    final user = asJsonMap(candidate['user']);
    return textOf(user['id'], textOf(user['_id'], textOf(user['email'])));
  }
}

class _CandidateTile extends StatelessWidget {
  const _CandidateTile({
    required this.candidate,
    required this.busy,
    required this.slots,
    required this.onSlotsChanged,
    required this.onAdd,
  });

  final JsonMap candidate;
  final bool busy;
  final Map<String, int> slots;
  final ValueChanged<Map<String, int>> onSlotsChanged;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final profile = asJsonMap(candidate['profile']);
    final linked = boolOf(candidate['isLinked']);

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
            children: [
              AvatarBadge(
                label: nestedText(candidate, ['user', 'name'], 'Doctor'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nestedText(candidate, ['user', 'name'], 'Doctor'),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(nestedText(candidate, ['user', 'email'], 'No email')),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            profile.isEmpty
                ? 'Profile missing. Doctor must add specialty and license details first.'
                : '${textOf(profile['specialty'], 'Specialty')} - '
                      'License ${textOf(profile['licenseNumber'], '-')} - '
                      '${intOf(profile['experienceYears'])} years',
          ),
          if (!linked && profile.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text(
              'Available Dates and Limits',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            AvailabilityCalendarEditor(slots: slots, onChanged: onSlotsChanged),
          ],
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: busy || linked || profile.isEmpty ? null : onAdd,
            icon: const Icon(Icons.person_add_alt_1),
            label: Text(linked ? 'Already Added' : 'Add Doctor'),
          ),
        ],
      ),
    );
  }
}

class _HospitalDoctorTile extends StatelessWidget {
  const _HospitalDoctorTile({
    required this.doctor,
    required this.slots,
    required this.onSlotsChanged,
    required this.busy,
    required this.onSave,
  });

  final JsonMap doctor;
  final Map<String, int> slots;
  final ValueChanged<Map<String, int>> onSlotsChanged;
  final bool busy;
  final VoidCallback onSave;

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
          Row(
            children: [
              AvatarBadge(
                label: nestedText(doctor, ['user', 'name'], 'Doctor'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nestedText(doctor, ['user', 'name'], 'Doctor'),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(textOf(doctor['specialty'], 'Specialty')),
                    Text(
                      availabilityText(doctor['availabilitySlots']),
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Available Dates and Limits',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          AvailabilityCalendarEditor(slots: slots, onChanged: onSlotsChanged),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy ? null : onSave,
            icon: const Icon(Icons.save_outlined),
            label: const Text('Save Availability'),
          ),
        ],
      ),
    );
  }
}

class _HospitalAppointmentTile extends StatelessWidget {
  const _HospitalAppointmentTile({
    required this.appointment,
    required this.onReport,
  });

  final JsonMap appointment;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final status = textOf(appointment['status'], 'unknown');

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
                      '${nestedText(appointment, ['doctor', 'user', 'name'], 'Doctor')} - '
                      '${nestedText(appointment, ['hospitalId', 'name'], 'Independent clinic')}',
                    ),
                    Text(
                      'Token #${textOf(appointment['queueNumber'], '-')} - '
                      '${formatDateTime(appointment['scheduledAt'])}',
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
          if ({'confirmed', 'completed'}.contains(status)) ...[
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: onReport,
              icon: const Icon(Icons.note_add_outlined),
              label: const Text('Report'),
            ),
          ],
        ],
      ),
    );
  }
}

class _HospitalReportTile extends StatelessWidget {
  const _HospitalReportTile({required this.report});

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
            '${nestedText(report, ['hospitalId', 'name'], 'Independent clinic')}',
          ),
          Text(
            '${formatDateTime(report['createdAt'])} - '
            '${nestedText(report, ['appointment', 'status'], 'status unavailable').replaceAll('_', ' ')}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
          ),
        ],
      ),
    );
  }
}
