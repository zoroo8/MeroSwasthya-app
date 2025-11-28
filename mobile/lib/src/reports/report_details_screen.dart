import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../core/api_client.dart';
import '../core/app_session.dart';
import '../ui/app_ui.dart';

class ReportDetailsScreen extends StatefulWidget {
  const ReportDetailsScreen({
    super.key,
    required this.session,
    required this.reportId,
  });

  final AppSession session;
  final String reportId;

  @override
  State<ReportDetailsScreen> createState() => _ReportDetailsScreenState();
}

class _ReportDetailsScreenState extends State<ReportDetailsScreen> {
  JsonMap? _report;
  String _error = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final data = await widget.session.api.get(
        '/report/${widget.reportId}',
        token: widget.session.token,
      );
      if (!mounted) return;

      setState(() {
        _report = asJsonMap(data['report']);
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

  Future<void> _sharePdf(JsonMap report) async {
    final prescriptions = stringList(report['prescription']);
    final tests = stringList(report['testRecommendations']);
    final status = nestedText(report, ['appointment', 'status'], 'status');
    final pdf = pw.Document();

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(34),
        build: (context) => [
          pw.Container(
            padding: const pw.EdgeInsets.only(bottom: 14),
            decoration: const pw.BoxDecoration(
              border: pw.Border(
                bottom: pw.BorderSide(color: PdfColors.teal700, width: 2),
              ),
            ),
            child: pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Expanded(
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        nestedText(report, [
                          'hospitalId',
                          'name',
                        ], 'MeroSwasthya Clinic'),
                        style: pw.TextStyle(
                          fontSize: 19,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.SizedBox(height: 3),
                      pw.Text(
                        nestedText(report, [
                          'hospitalId',
                          'address',
                        ], 'Medical Report'),
                      ),
                    ],
                  ),
                ),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    pw.Text('MEDICAL REPORT'),
                    pw.Text(formatDateTime(report['createdAt'])),
                    pw.Text(status.replaceAll('_', ' ')),
                  ],
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 14),
          pw.Row(
            children: [
              pw.Expanded(
                child: _pdfInfoBlock(
                  'Patient',
                  nestedText(report, ['patientUser', 'name'], 'Patient'),
                  'ID ${nestedText(report, ['patientUser', '_id'], 'Not available')}',
                ),
              ),
              pw.SizedBox(width: 10),
              pw.Expanded(
                child: _pdfInfoBlock(
                  'Doctor',
                  nestedText(report, ['doctor', 'user', 'name'], 'Doctor'),
                  '${nestedText(report, ['doctor', 'specialty'], 'Specialty not listed')}\n'
                      'License ${nestedText(report, ['doctor', 'licenseNumber'], 'Not listed')}',
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 12),
          _pdfClinicalBlock(
            'Diagnosis',
            textOf(report['diagnosis'], 'Diagnosis not listed'),
          ),
          pw.SizedBox(height: 12),
          _pdfTable('Prescription', prescriptions, 'No prescription listed.'),
          pw.SizedBox(height: 12),
          _pdfTable('Recommended Tests', tests, 'No tests recommended.'),
          pw.SizedBox(height: 12),
          _pdfClinicalBlock(
            'Follow-up',
            textOf(report['followUpDate']).isEmpty
                ? 'Not set'
                : formatDate(report['followUpDate']),
          ),
          pw.SizedBox(height: 10),
          _pdfClinicalBlock(
            'Clinical Notes',
            textOf(report['notes'], 'No notes added.'),
          ),
        ],
      ),
    );

    await Printing.sharePdf(
      bytes: await pdf.save(),
      filename: 'medical-report-${widget.reportId}.pdf',
    );
  }

  pw.Widget _pdfInfoBlock(String label, String title, String detail) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(10),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: PdfColors.grey300),
        borderRadius: pw.BorderRadius.circular(4),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(label.toUpperCase(), style: const pw.TextStyle(fontSize: 9)),
          pw.SizedBox(height: 4),
          pw.Text(title, style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 2),
          pw.Text(detail),
        ],
      ),
    );
  }

  pw.Widget _pdfClinicalBlock(String title, String value) {
    return pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.all(10),
      decoration: pw.BoxDecoration(
        color: PdfColors.grey100,
        border: pw.Border.all(color: PdfColors.grey300),
        borderRadius: pw.BorderRadius.circular(4),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(title.toUpperCase(), style: const pw.TextStyle(fontSize: 9)),
          pw.SizedBox(height: 4),
          pw.Text(value),
        ],
      ),
    );
  }

  pw.Widget _pdfTable(String title, List<String> rows, String fallback) {
    final values = rows.isEmpty ? [fallback] : rows;

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(title, style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 5),
        pw.Table(
          border: pw.TableBorder.all(color: PdfColors.grey300),
          columnWidths: const {
            0: pw.FixedColumnWidth(30),
            1: pw.FlexColumnWidth(),
          },
          children: [
            pw.TableRow(
              decoration: const pw.BoxDecoration(color: PdfColors.teal50),
              children: [
                _pdfTableCell('#', bold: true),
                _pdfTableCell('Item', bold: true),
              ],
            ),
            for (var index = 0; index < values.length; index++)
              pw.TableRow(
                children: [
                  _pdfTableCell(rows.isEmpty ? '-' : '${index + 1}'),
                  _pdfTableCell(values[index]),
                ],
              ),
          ],
        ),
      ],
    );
  }

  pw.Widget _pdfTableCell(String value, {bool bold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(7),
      child: pw.Text(
        value,
        style: bold ? pw.TextStyle(fontWeight: pw.FontWeight.bold) : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final report = _report;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Medical Report'),
        actions: [
          IconButton(
            onPressed: report == null ? null : () => _sharePdf(report),
            tooltip: 'Share PDF',
            icon: const Icon(Icons.picture_as_pdf_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: DashboardListFrame(
          onRefresh: _load,
          children: [
            SectionSurface(
              title: 'Clinical Report',
              description: 'Diagnosis, treatment, and follow-up record.',
              trailing: report == null
                  ? null
                  : OutlinedButton.icon(
                      onPressed: () => _sharePdf(report),
                      icon: const Icon(Icons.share_outlined),
                      label: const Text('PDF'),
                    ),
              child: switch ((_loading, report)) {
                (true, _) => const Center(child: CircularProgressIndicator()),
                (false, null) => EmptyPanel(
                  title: _error.isEmpty
                      ? 'Report not found'
                      : 'Unable to load report',
                  description: _error.isEmpty ? null : _error,
                ),
                _ => _ClinicalReportDocument(report: report!),
              },
            ),
            NoticeBanner(error: _error),
          ],
        ),
      ),
    );
  }
}

class _ClinicalReportDocument extends StatelessWidget {
  const _ClinicalReportDocument({required this.report});

  final JsonMap report;

  @override
  Widget build(BuildContext context) {
    final status = nestedText(report, ['appointment', 'status']);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
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
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: MeroPalette.green,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'M',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nestedText(report, [
                        'hospitalId',
                        'name',
                      ], 'MeroSwasthya Clinic'),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      nestedText(report, [
                        'hospitalId',
                        'address',
                      ], 'Independent clinical record'),
                      style: const TextStyle(color: MeroPalette.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(),
          const SizedBox(height: 8),
          InlineWrap(
            children: [
              if (status.isNotEmpty) StatusBadge(status: status),
              Chip(
                avatar: const Icon(Icons.schedule, size: 18),
                label: Text(formatDateTime(report['createdAt'])),
              ),
              Chip(
                avatar: const Icon(
                  Icons.confirmation_number_outlined,
                  size: 18,
                ),
                label: Text(
                  'Token ${nestedText(report, ['appointment', 'queueNumber'], '-')}',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final children = [
                _InfoPanel(
                  title: 'Patient',
                  name: nestedText(report, ['patientUser', 'name'], 'Patient'),
                  details: [
                    'ID ${nestedText(report, ['patientUser', '_id'], 'Not available')}',
                    nestedText(report, [
                      'patientUser',
                      'email',
                    ], 'Contact not listed'),
                  ],
                ),
                _InfoPanel(
                  title: 'Doctor',
                  name: nestedText(report, [
                    'doctor',
                    'user',
                    'name',
                  ], 'Doctor'),
                  details: [
                    nestedText(report, [
                      'doctor',
                      'specialty',
                    ], 'Specialty not listed'),
                    'License ${nestedText(report, ['doctor', 'licenseNumber'], 'Not listed')}',
                  ],
                ),
              ];

              if (constraints.maxWidth < 520) {
                return Column(
                  children: [
                    children[0],
                    const SizedBox(height: 10),
                    children[1],
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: children[0]),
                  const SizedBox(width: 10),
                  Expanded(child: children[1]),
                ],
              );
            },
          ),
          const SizedBox(height: 12),
          _ClinicalField(
            title: 'Diagnosis',
            value: textOf(report['diagnosis'], 'Diagnosis not listed.'),
            emphasis: true,
          ),
          const SizedBox(height: 10),
          _PrescriptionTable(values: stringList(report['prescription'])),
          const SizedBox(height: 10),
          _TestRecommendations(
            values: stringList(report['testRecommendations']),
          ),
          const SizedBox(height: 10),
          _ClinicalField(
            title: 'Follow-up Date',
            value: textOf(report['followUpDate']).isEmpty
                ? 'Not set'
                : formatDate(report['followUpDate']),
          ),
          const SizedBox(height: 10),
          _ClinicalField(
            title: 'Clinical Notes',
            value: textOf(report['notes'], 'No notes added.'),
          ),
        ],
      ),
    );
  }
}

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({
    required this.title,
    required this.name,
    required this.details,
  });

  final String title;
  final String name;
  final List<String> details;

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
            title.toUpperCase(),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: MeroPalette.muted,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 5),
          Text(name, style: const TextStyle(fontWeight: FontWeight.w900)),
          for (final detail in details) Text(detail),
        ],
      ),
    );
  }
}

class _ClinicalField extends StatelessWidget {
  const _ClinicalField({
    required this.title,
    required this.value,
    this.emphasis = false,
  });

  final String title;
  final String value;
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: emphasis ? const Color(0xFFEAF1FF) : const Color(0xFFF9FBFA),
        border: Border.all(
          color: emphasis
              ? MeroPalette.blue.withValues(alpha: 0.22)
              : MeroPalette.line,
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: MeroPalette.muted,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(value),
        ],
      ),
    );
  }
}

class _PrescriptionTable extends StatelessWidget {
  const _PrescriptionTable({required this.values});

  final List<String> values;

  @override
  Widget build(BuildContext context) {
    final rows = values.isEmpty ? <String>['No prescription listed.'] : values;

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
          const Text(
            'PRESCRIPTION',
            style: TextStyle(
              color: MeroPalette.muted,
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Table(
            border: TableBorder.all(color: MeroPalette.line),
            columnWidths: const {0: FixedColumnWidth(38), 1: FlexColumnWidth()},
            children: [
              const TableRow(
                decoration: BoxDecoration(color: Color(0xFFEEF7F3)),
                children: [
                  _TableCell(value: '#', strong: true),
                  _TableCell(value: 'Medicine or Instruction', strong: true),
                ],
              ),
              for (var index = 0; index < rows.length; index++)
                TableRow(
                  children: [
                    _TableCell(value: values.isEmpty ? '-' : '${index + 1}'),
                    _TableCell(value: rows[index]),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TableCell extends StatelessWidget {
  const _TableCell({required this.value, this.strong = false});

  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Text(
        value,
        style: strong ? const TextStyle(fontWeight: FontWeight.w800) : null,
      ),
    );
  }
}

class _TestRecommendations extends StatelessWidget {
  const _TestRecommendations({required this.values});

  final List<String> values;

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
          const Text(
            'TEST RECOMMENDATIONS',
            style: TextStyle(
              color: MeroPalette.muted,
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          if (values.isEmpty)
            const Text('No tests recommended.')
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final value in values)
                  Chip(
                    avatar: const Icon(Icons.biotech_outlined, size: 18),
                    label: Text(value),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
