import 'package:flutter/material.dart';

import '../core/api_client.dart';

class MeroPalette {
  static const ink = Color(0xFF17252F);
  static const muted = Color(0xFF667782);
  static const line = Color(0xFFDDE6E8);
  static const background = Color(0xFFF6F8FB);
  static const tint = Color(0xFFEEF7F3);
  static const green = Color(0xFF12715F);
  static const greenDark = Color(0xFF0B5147);
  static const blue = Color(0xFF2F5F98);
  static const amber = Color(0xFFA66509);
  static const rose = Color(0xFFB33D55);
}

ThemeData buildMeroTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: MeroPalette.green,
    primary: MeroPalette.green,
    secondary: MeroPalette.blue,
    surface: Colors.white,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: MeroPalette.background,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: MeroPalette.ink,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
    ),
    cardTheme: const CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
        side: BorderSide(color: MeroPalette.line),
      ),
    ),
    dividerColor: MeroPalette.line,
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
        borderSide: BorderSide(color: MeroPalette.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
        borderSide: BorderSide(color: MeroPalette.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
        borderSide: BorderSide(color: MeroPalette.green, width: 1.5),
      ),
      contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: MeroPalette.green,
        foregroundColor: Colors.white,
        minimumSize: const Size(44, 46),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: MeroPalette.greenDark,
        minimumSize: const Size(44, 46),
        side: const BorderSide(color: MeroPalette.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      selectedColor: MeroPalette.tint,
      side: const BorderSide(color: MeroPalette.line),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      labelStyle: const TextStyle(
        color: MeroPalette.ink,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class BrandLockup extends StatelessWidget {
  const BrandLockup({super.key, this.subtitle});

  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            gradient: const LinearGradient(
              colors: [MeroPalette.green, MeroPalette.blue],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          alignment: Alignment.center,
          child: const Text(
            'M',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
          ),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'MeroSwasthya',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              if (subtitle != null)
                Text(
                  subtitle!,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class SectionSurface extends StatelessWidget {
  const SectionSurface({
    super.key,
    required this.title,
    required this.child,
    this.description,
    this.trailing,
    this.padding = const EdgeInsets.all(16),
  });

  final String title;
  final String? description;
  final Widget? trailing;
  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      if (description != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          description!,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: MeroPalette.muted),
                        ),
                      ],
                    ],
                  ),
                ),
                if (trailing != null) ...[const SizedBox(width: 12), trailing!],
              ],
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class EmptyPanel extends StatelessWidget {
  const EmptyPanel({super.key, required this.title, this.description});

  final String title;
  final String? description;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FBFA),
        border: Border.all(color: MeroPalette.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          if (description != null) ...[
            const SizedBox(height: 4),
            Text(
              description!,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
            ),
          ],
        ],
      ),
    );
  }
}

class NoticeBanner extends StatelessWidget {
  const NoticeBanner({super.key, this.error = '', this.message = ''});

  final String error;
  final String message;

  @override
  Widget build(BuildContext context) {
    if (error.isEmpty && message.isEmpty) return const SizedBox.shrink();

    final isError = error.isNotEmpty;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isError ? const Color(0xFFFFF0F3) : const Color(0xFFE7F6EF),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isError ? const Color(0xFFF0C2CC) : const Color(0xFFB8DFCE),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.check_circle_outline,
            size: 20,
            color: isError ? MeroPalette.rose : MeroPalette.greenDark,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isError ? error : message,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class AvatarBadge extends StatelessWidget {
  const AvatarBadge({
    super.key,
    required this.label,
    this.imageUrl = '',
    this.size = 42,
  });

  final String label;
  final String imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: MeroPalette.tint,
      ),
      child: Text(
        initials(label),
        style: TextStyle(
          color: MeroPalette.greenDark,
          fontSize: size * 0.3,
          fontWeight: FontWeight.w900,
        ),
      ),
    );

    if (imageUrl.isEmpty) return fallback;

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(
        imageUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => fallback,
      ),
    );
  }
}

class MetricTile extends StatelessWidget {
  const MetricTile({
    super.key,
    required this.label,
    required this.value,
    this.caption,
    this.icon,
  });

  final String label;
  final String value;
  final String? caption;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 148,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: MeroPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(icon, color: MeroPalette.blue, size: 20),
            const SizedBox(height: 8),
          ],
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: MeroPalette.muted),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: MeroPalette.ink,
              fontWeight: FontWeight.w900,
            ),
          ),
          if (caption != null)
            Text(caption!, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.isEmpty ? 'unknown' : status;
    final colors = switch (normalized) {
      'confirmed' || 'completed' => (
        foreground: MeroPalette.greenDark,
        background: const Color(0xFFE7F6EF),
      ),
      'pending' => (
        foreground: MeroPalette.amber,
        background: const Color(0xFFFFF6E7),
      ),
      'cancelled' || 'no_show' => (
        foreground: MeroPalette.rose,
        background: const Color(0xFFFFF0F3),
      ),
      _ => (foreground: MeroPalette.muted, background: const Color(0xFFEEF2F4)),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        normalized.replaceAll('_', ' '),
        style: TextStyle(
          color: colors.foreground,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class LabeledField extends StatelessWidget {
  const LabeledField({
    super.key,
    required this.label,
    required this.controller,
    this.hintText,
    this.keyboardType,
    this.maxLines = 1,
    this.obscureText = false,
    this.enabled = true,
    this.readOnly = false,
    this.onTap,
    this.suffixIcon,
  });

  final String label;
  final TextEditingController controller;
  final String? hintText;
  final TextInputType? keyboardType;
  final int maxLines;
  final bool obscureText;
  final bool enabled;
  final bool readOnly;
  final VoidCallback? onTap;
  final Widget? suffixIcon;

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
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          maxLines: maxLines,
          obscureText: obscureText,
          enabled: enabled,
          readOnly: readOnly,
          onTap: onTap,
          decoration: InputDecoration(
            hintText: hintText,
            suffixIcon: suffixIcon,
          ),
        ),
      ],
    );
  }
}

class DateField extends StatelessWidget {
  const DateField({super.key, required this.label, required this.controller});

  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return LabeledField(
      label: label,
      controller: controller,
      hintText: 'YYYY-MM-DD',
      readOnly: true,
      suffixIcon: const Icon(Icons.calendar_month_outlined),
      onTap: () async {
        final initial = DateTime.tryParse(controller.text) ?? DateTime.now();
        final selected = await showDatePicker(
          context: context,
          initialDate: initial,
          firstDate: DateTime(1900),
          lastDate: DateTime(2100),
        );

        if (selected != null) {
          controller.text = dateKey(selected);
        }
      },
    );
  }
}

class DashboardTab {
  const DashboardTab(this.label, this.icon);

  final String label;
  final IconData icon;
}

class DashboardTabStrip extends StatelessWidget {
  const DashboardTabStrip({
    super.key,
    required this.tabs,
    required this.index,
    required this.onChanged,
  });

  final List<DashboardTab> tabs;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var tabIndex = 0; tabIndex < tabs.length; tabIndex++) ...[
            ChoiceChip(
              selected: tabIndex == index,
              onSelected: (_) => onChanged(tabIndex),
              avatar: Icon(tabs[tabIndex].icon, size: 18),
              label: Text(tabs[tabIndex].label),
            ),
            if (tabIndex != tabs.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class DashboardHeader extends StatelessWidget {
  const DashboardHeader({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.summary,
    required this.signedInAs,
  });

  final String eyebrow;
  final String title;
  final String summary;
  final String signedInAs;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        gradient: const LinearGradient(
          colors: [MeroPalette.greenDark, MeroPalette.blue],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            eyebrow.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFFBDEBDC),
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(summary, style: const TextStyle(color: Colors.white)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              'Signed in as $signedInAs',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class DashboardListFrame extends StatelessWidget {
  const DashboardListFrame({
    super.key,
    required this.onRefresh,
    required this.children,
  });

  final RefreshCallback onRefresh;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        itemBuilder: (context, index) => children[index],
        separatorBuilder: (context, index) => const SizedBox(height: 12),
        itemCount: children.length,
      ),
    );
  }
}

class InlineWrap extends StatelessWidget {
  const InlineWrap({super.key, required this.children, this.spacing = 8});

  final List<Widget> children;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return Wrap(spacing: spacing, runSpacing: spacing, children: children);
  }
}

String initials(String value) {
  final parts = value
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return 'U';
  return parts.take(2).map((part) => part[0].toUpperCase()).join();
}

String formatDateTime(Object? value) {
  final raw = textOf(value);
  final date = DateTime.tryParse(raw);
  if (date == null) return raw.isEmpty ? 'Not scheduled' : raw;

  final local = date.toLocal();
  return '${_months[local.month - 1]} ${local.day}, ${local.year} '
      '${_two(local.hour)}:${_two(local.minute)}';
}

String formatDate(Object? value) {
  final raw = textOf(value);
  final date = DateTime.tryParse(raw.length == 10 ? '${raw}T00:00:00' : raw);
  if (date == null) return raw.isEmpty ? 'Not set' : raw;
  return '${_months[date.month - 1]} ${date.day}, ${date.year}';
}

String dateKey(Object value) {
  final date = value is DateTime ? value : DateTime.tryParse(textOf(value));
  if (date == null) return '';
  return '${date.year}-${_two(date.month)}-${_two(date.day)}';
}

String commaText(Iterable<String> values, [String fallback = 'Not set']) {
  final list = values.where((item) => item.trim().isNotEmpty).toList();
  return list.isEmpty ? fallback : list.join(', ');
}

List<String> commaList(String value) {
  return value
      .split(',')
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toList();
}

String availabilityText(Object? slots) {
  final values = asJsonList(slots);
  if (values.isEmpty) return 'No availability set';

  return values
      .map(
        (slot) =>
            '${formatDate(slot['date'])} (${intOf(slot['maxDailyBookings'], 10)} patients)',
      )
      .join(', ');
}

String _two(int value) => value.toString().padLeft(2, '0');

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
