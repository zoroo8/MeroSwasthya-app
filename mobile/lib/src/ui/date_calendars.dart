import 'package:flutter/material.dart';

import '../core/api_client.dart';
import 'app_ui.dart';

Map<String, int> availabilitySlotMap(Object? slots) {
  final values = <String, int>{};

  for (final slot in asJsonList(slots)) {
    final date = textOf(slot['date']);
    if (!_isDateKey(date)) continue;
    values[date] = intOf(slot['maxDailyBookings'], 10).clamp(1, 9999).toInt();
  }

  return values;
}

List<String> availabilityPairs(Map<String, int> slots) {
  final dates = slots.keys.where(_isDateKey).toList()..sort();
  return dates.map((date) => '$date:${slots[date]!.clamp(1, 9999)}').toList();
}

class AvailabilityCalendarEditor extends StatefulWidget {
  const AvailabilityCalendarEditor({
    super.key,
    required this.slots,
    required this.onChanged,
  });

  final Map<String, int> slots;
  final ValueChanged<Map<String, int>> onChanged;

  @override
  State<AvailabilityCalendarEditor> createState() =>
      _AvailabilityCalendarEditorState();
}

class _AvailabilityCalendarEditorState
    extends State<AvailabilityCalendarEditor> {
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    _month = _monthFor(widget.slots.keys.firstOrNull);
  }

  @override
  Widget build(BuildContext context) {
    final dates = widget.slots.keys.toList()..sort();

    return _CalendarFrame(
      month: _month,
      onPrevious: () =>
          setState(() => _month = DateTime(_month.year, _month.month - 1)),
      onNext: () =>
          setState(() => _month = DateTime(_month.year, _month.month + 1)),
      dayBuilder: (day) {
        final key = dateKey(day);
        final selected = widget.slots.containsKey(key);

        return _CalendarDay(
          day: day,
          selected: selected,
          highlighted: selected,
          onTap: () {
            final next = Map<String, int>.from(widget.slots);
            if (selected) {
              next.remove(key);
            } else {
              next[key] = 10;
            }
            widget.onChanged(next);
          },
        );
      },
      footer: dates.isEmpty
          ? const Text(
              'Select one or more dates.',
              style: TextStyle(color: MeroPalette.muted),
            )
          : Column(
              children: [
                for (final date in dates) ...[
                  _LimitInput(
                    key: ValueKey<String>(date),
                    date: date,
                    limit: widget.slots[date] ?? 10,
                    onChanged: (limit) =>
                        widget.onChanged({...widget.slots, date: limit}),
                  ),
                  if (date != dates.last) const SizedBox(height: 8),
                ],
              ],
            ),
    );
  }
}

class AvailableDateCalendar extends StatefulWidget {
  const AvailableDateCalendar({
    super.key,
    required this.availableDates,
    required this.selectedDate,
    required this.onSelected,
  });

  final List<String> availableDates;
  final String selectedDate;
  final ValueChanged<String> onSelected;

  @override
  State<AvailableDateCalendar> createState() => _AvailableDateCalendarState();
}

class _AvailableDateCalendarState extends State<AvailableDateCalendar> {
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    _month = _focusMonth();
  }

  @override
  void didUpdateWidget(covariant AvailableDateCalendar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedDate != widget.selectedDate ||
        oldWidget.availableDates.join('|') != widget.availableDates.join('|')) {
      _month = _focusMonth();
    }
  }

  DateTime _focusMonth() {
    final focusDate = widget.selectedDate.isNotEmpty
        ? widget.selectedDate
        : widget.availableDates.firstOrNull;
    return _monthFor(focusDate);
  }

  @override
  Widget build(BuildContext context) {
    final available = widget.availableDates.where(_isDateKey).toSet();

    return _CalendarFrame(
      month: _month,
      onPrevious: () =>
          setState(() => _month = DateTime(_month.year, _month.month - 1)),
      onNext: () =>
          setState(() => _month = DateTime(_month.year, _month.month + 1)),
      dayBuilder: (day) {
        final key = dateKey(day);
        final enabled = available.contains(key);

        return _CalendarDay(
          day: day,
          selected: widget.selectedDate == key,
          highlighted: enabled,
          onTap: enabled ? () => widget.onSelected(key) : null,
        );
      },
      footer: Text(
        widget.selectedDate.isEmpty
            ? 'No available date selected.'
            : 'Selected ${formatDate(widget.selectedDate)}',
        style: const TextStyle(color: MeroPalette.muted),
      ),
    );
  }
}

class _CalendarFrame extends StatelessWidget {
  const _CalendarFrame({
    required this.month,
    required this.onPrevious,
    required this.onNext,
    required this.dayBuilder,
    required this.footer,
  });

  final DateTime month;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final Widget Function(DateTime day) dayBuilder;
  final Widget footer;

  @override
  Widget build(BuildContext context) {
    final cells = _monthCells(month);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FBFA),
        border: Border.all(color: MeroPalette.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                onPressed: onPrevious,
                tooltip: 'Previous month',
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Text(
                  '${_months[month.month - 1]} ${month.year}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              IconButton(
                onPressed: onNext,
                tooltip: 'Next month',
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          const SizedBox(height: 6),
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 5,
            crossAxisSpacing: 5,
            children: [
              for (final weekday in _weekdays)
                Center(
                  child: Text(
                    weekday,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: MeroPalette.muted,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              for (final day in cells)
                day == null ? const SizedBox.shrink() : dayBuilder(day),
            ],
          ),
          const SizedBox(height: 12),
          footer,
        ],
      ),
    );
  }
}

class _CalendarDay extends StatelessWidget {
  const _CalendarDay({
    required this.day,
    required this.selected,
    required this.highlighted,
    required this.onTap,
  });

  final DateTime day;
  final bool selected;
  final bool highlighted;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final background = selected
        ? MeroPalette.green
        : highlighted
        ? const Color(0xFFEAF1FF)
        : Colors.white;
    final foreground = selected
        ? Colors.white
        : highlighted
        ? MeroPalette.blue
        : MeroPalette.muted;

    return Material(
      color: background,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: selected || highlighted
              ? MeroPalette.green.withValues(alpha: 0.42)
              : MeroPalette.line,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Center(
          child: Text(
            '${day.day}',
            style: TextStyle(color: foreground, fontWeight: FontWeight.w800),
          ),
        ),
      ),
    );
  }
}

class _LimitInput extends StatelessWidget {
  const _LimitInput({
    super.key,
    required this.date,
    required this.limit,
    required this.onChanged,
  });

  final String date;
  final int limit;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            formatDate(date),
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          width: 92,
          child: TextFormField(
            initialValue: '$limit',
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Limit',
              isDense: true,
            ),
            onChanged: (value) =>
                onChanged((int.tryParse(value) ?? 1).clamp(1, 9999).toInt()),
          ),
        ),
      ],
    );
  }
}

List<DateTime?> _monthCells(DateTime month) {
  final start = DateTime(month.year, month.month);
  final padding = start.weekday % 7;
  final days = DateTime(month.year, month.month + 1, 0).day;

  return [
    ...List<DateTime?>.filled(padding, null),
    for (var day = 1; day <= days; day++)
      DateTime(month.year, month.month, day),
  ];
}

DateTime _monthFor(String? rawDate) {
  final date = DateTime.tryParse(textOf(rawDate)) ?? DateTime.now();
  return DateTime(date.year, date.month);
}

bool _isDateKey(String value) => RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value);

const _weekdays = <String>['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const _months = <String>[
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
