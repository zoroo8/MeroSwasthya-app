import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/app_session.dart';
import '../ui/app_ui.dart';
import '../ui/date_calendars.dart';

class PatientHospitalDetailScreen extends StatefulWidget {
  const PatientHospitalDetailScreen({
    super.key,
    required this.session,
    required this.hospitalId,
  });

  final AppSession session;
  final String hospitalId;

  @override
  State<PatientHospitalDetailScreen> createState() =>
      _PatientHospitalDetailScreenState();
}

class _PatientHospitalDetailScreenState
    extends State<PatientHospitalDetailScreen> {
  final _doctorSearch = TextEditingController();
  final _specialty = TextEditingController();
  final _reason = TextEditingController();
  final _notes = TextEditingController();

  JsonMap? _hospital;
  List<JsonMap> _doctors = <JsonMap>[];
  List<JsonMap> _appointments = <JsonMap>[];
  String _doctorId = '';
  String _appointmentDate = '';
  String _error = '';
  String _message = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _doctorSearch.dispose();
    _specialty.dispose();
    _reason.dispose();
    _notes.dispose();
    super.dispose();
  }

  JsonMap? get _selectedDoctor {
    for (final doctor in _doctors) {
      if (textOf(doctor['_id']) == _doctorId) return doctor;
    }

    return null;
  }

  List<String> get _availableDates {
    final selected = _selectedDoctor;
    final slots = selected == null
        ? _doctors.expand((doctor) => asJsonList(doctor['availabilitySlots']))
        : asJsonList(selected['availabilitySlots']);
    final dates =
        slots
            .map((slot) => textOf(slot['date']))
            .where((date) => date.isNotEmpty)
            .toSet()
            .toList()
          ..sort();
    return dates;
  }

  Future<void> _loadAll() async {
    await Future.wait([_loadDetails(clearFilters: true), _loadAppointments()]);
  }

  Future<void> _loadDetails({bool clearFilters = false}) async {
    if (clearFilters) {
      _doctorSearch.clear();
      _specialty.clear();
    }

    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final data = await widget.session.api.get(
        '/hospital/${widget.hospitalId}/doctors',
        token: widget.session.token,
        query: <String, String>{
          'search': _doctorSearch.text.trim(),
          'specialty': _specialty.text.trim(),
        },
      );
      if (!mounted) return;

      final doctors = asJsonList(data['doctors']);
      final nextDoctorId =
          doctors.any((doctor) => textOf(doctor['_id']) == _doctorId)
          ? _doctorId
          : textOf(doctors.firstOrNull?['_id']);

      setState(() {
        _hospital = asJsonMap(data['hospital']);
        _doctors = doctors;
        _doctorId = nextDoctorId;
        _loading = false;
      });
      _selectFirstDate();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _loadAppointments() async {
    try {
      final data = await widget.session.api.get(
        '/appointment/my',
        token: widget.session.token,
      );
      if (!mounted) return;
      setState(() => _appointments = asJsonList(data['appointments']));
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  void _selectFirstDate() {
    final dates = _availableDates;
    if (dates.contains(_appointmentDate)) return;
    setState(() => _appointmentDate = dates.isEmpty ? '' : dates.first);
  }

  Future<void> _book() async {
    if (_doctorId.isEmpty ||
        _appointmentDate.isEmpty ||
        _reason.text.trim().isEmpty) {
      setState(
        () => _error = 'Doctor, available date, and reason are required.',
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
        '/appointment/book-from-hospital',
        token: widget.session.token,
        body: <String, dynamic>{
          'hospitalId': widget.hospitalId,
          'doctorId': _doctorId,
          'appointmentDate': _appointmentDate,
          'reason': _reason.text.trim(),
          'notes': _notes.text.trim(),
        },
      );
      if (!mounted) return;

      _reason.clear();
      _notes.clear();
      setState(() {
        _loading = false;
        _message = 'Appointment booked.';
      });
      await _loadAppointments();
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
    final hospital = _hospital;
    final selectedDoctor = _selectedDoctor;
    final pendingAppointments = _appointments.where((appointment) {
      return textOf(appointment['status']) == 'pending' &&
          nestedText(appointment, [
                'hospitalId',
                '_id',
              ], textOf(appointment['hospitalId'])) ==
              widget.hospitalId;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(textOf(hospital?['name'], 'Hospital Details')),
      ),
      body: SafeArea(
        child: DashboardListFrame(
          onRefresh: _loadAll,
          children: [
            SectionSurface(
              title: textOf(hospital?['name'], 'Hospital Details'),
              description:
                  'Choose a doctor, check availability, and book your appointment.',
              child: hospital == null
                  ? const EmptyPanel(title: 'Loading hospital details')
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            AvatarBadge(
                              label: textOf(hospital['name'], 'Hospital'),
                              imageUrl: widget.session.api.assetUrl(
                                textOf(
                                  hospital['bannerImage'],
                                  nestedText(hospital, [
                                    'adminUser',
                                    'profileImage',
                                  ]),
                                ),
                              ),
                              size: 64,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    textOf(
                                      hospital['address'],
                                      'Address not set',
                                    ),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  Text(
                                    textOf(
                                      hospital['phone'],
                                      textOf(
                                        hospital['email'],
                                        'Contact not set',
                                      ),
                                    ),
                                    style: const TextStyle(
                                      color: MeroPalette.muted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        InlineWrap(
                          children: [
                            MetricTile(
                              label: 'Doctors',
                              value: '${_doctors.length}',
                              icon: Icons.medical_services_outlined,
                            ),
                            MetricTile(
                              label: 'Pending here',
                              value: '${pendingAppointments.length}',
                              icon: Icons.pending_actions_outlined,
                            ),
                          ],
                        ),
                      ],
                    ),
            ),
            SectionSurface(
              title: 'Doctors',
              description: 'Filter approved hospital doctors before booking.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LabeledField(
                    label: 'Doctor Name',
                    controller: _doctorSearch,
                    hintText: 'Search by doctor name',
                  ),
                  const SizedBox(height: 10),
                  LabeledField(
                    label: 'Specialty',
                    controller: _specialty,
                    hintText: 'Cardiology',
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: _loading ? null : _loadDetails,
                    icon: const Icon(Icons.search),
                    label: const Text('Search Doctors'),
                  ),
                  const SizedBox(height: 12),
                  if (_doctors.isEmpty)
                    const EmptyPanel(
                      title: 'No doctors available',
                      description:
                          'This hospital has no matching approved doctors yet.',
                    )
                  else
                    for (final doctor in _doctors) ...[
                      _DoctorChoiceTile(
                        session: widget.session,
                        doctor: doctor,
                        selected: textOf(doctor['_id']) == _doctorId,
                        onSelected: () {
                          setState(() => _doctorId = textOf(doctor['_id']));
                          _selectFirstDate();
                        },
                      ),
                      if (doctor != _doctors.last) const SizedBox(height: 8),
                    ],
                ],
              ),
            ),
            SectionSurface(
              title: 'Book Appointment',
              description: selectedDoctor == null
                  ? 'Choose a doctor first.'
                  : '${nestedText(selectedDoctor, ['user', 'name'], 'Doctor')} - '
                        '${textOf(selectedDoctor['specialty'], 'Specialty not set')}',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _DoctorDropdown(
                    doctors: _doctors,
                    selectedId: _doctorId,
                    onChanged: (doctorId) {
                      setState(() => _doctorId = doctorId);
                      _selectFirstDate();
                    },
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Available Date',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  AvailableDateCalendar(
                    availableDates: _availableDates,
                    selectedDate: _appointmentDate,
                    onSelected: (date) =>
                        setState(() => _appointmentDate = date),
                  ),
                  const SizedBox(height: 12),
                  LabeledField(
                    label: 'Reason',
                    controller: _reason,
                    hintText: 'General checkup, fever, follow-up',
                  ),
                  const SizedBox(height: 12),
                  LabeledField(
                    label: 'Notes',
                    controller: _notes,
                    maxLines: 3,
                    hintText: 'Optional symptoms or notes',
                  ),
                  const SizedBox(height: 14),
                  FilledButton.icon(
                    onPressed: _loading ? null : _book,
                    icon: const Icon(Icons.event_available_outlined),
                    label: const Text('Book Appointment'),
                  ),
                ],
              ),
            ),
            SectionSurface(
              title: 'Pending Appointments Here',
              description:
                  'Only pending appointments at this hospital are shown.',
              child: pendingAppointments.isEmpty
                  ? const EmptyPanel(title: 'No pending appointments here')
                  : Column(
                      children: [
                        for (final appointment in pendingAppointments) ...[
                          _PendingAppointmentTile(item: appointment),
                          if (appointment != pendingAppointments.last)
                            const SizedBox(height: 8),
                        ],
                      ],
                    ),
            ),
            if (_loading) const LinearProgressIndicator(),
            NoticeBanner(error: _error, message: _message),
          ],
        ),
      ),
    );
  }
}

class _DoctorChoiceTile extends StatelessWidget {
  const _DoctorChoiceTile({
    required this.session,
    required this.doctor,
    required this.selected,
    required this.onSelected,
  });

  final AppSession session;
  final JsonMap doctor;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onSelected,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? MeroPalette.tint : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? MeroPalette.green : MeroPalette.line,
          ),
        ),
        child: Row(
          children: [
            AvatarBadge(
              label: nestedText(doctor, ['user', 'name'], 'Doctor'),
              imageUrl: session.api.assetUrl(
                nestedValue(doctor, ['user', 'profileImage']),
              ),
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
                  Text(textOf(doctor['specialty'], 'Specialty not set')),
                  Text(
                    availabilityText(doctor['availabilitySlots']),
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
                  ),
                ],
              ),
            ),
            Icon(
              selected ? Icons.check_circle : Icons.radio_button_unchecked,
              color: MeroPalette.green,
            ),
          ],
        ),
      ),
    );
  }
}

class _DoctorDropdown extends StatelessWidget {
  const _DoctorDropdown({
    required this.doctors,
    required this.selectedId,
    required this.onChanged,
  });

  final List<JsonMap> doctors;
  final String selectedId;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Doctor',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue:
              doctors.any((doctor) => textOf(doctor['_id']) == selectedId)
              ? selectedId
              : null,
          hint: const Text('Choose doctor'),
          items: doctors
              .map(
                (doctor) => DropdownMenuItem<String>(
                  value: textOf(doctor['_id']),
                  child: Text(
                    '${nestedText(doctor, ['user', 'name'], 'Doctor')} - '
                    '${textOf(doctor['specialty'], 'Specialty')}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: (doctorId) {
            if (doctorId != null) onChanged(doctorId);
          },
        ),
      ],
    );
  }
}

class _PendingAppointmentTile extends StatelessWidget {
  const _PendingAppointmentTile({required this.item});

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
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  nestedText(item, ['doctor', 'user', 'name'], 'Doctor'),
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                Text(
                  'Token #${textOf(item['queueNumber'], '-')} - ${textOf(item['reason'])}',
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
          StatusBadge(status: textOf(item['status'], 'pending')),
        ],
      ),
    );
  }
}
