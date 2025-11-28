import 'package:flutter_test/flutter_test.dart';
import 'package:mero_swasthya_mobile/main.dart';

void main() {
  testWidgets('shows auth workspace entry points', (tester) async {
    await tester.pumpWidget(const MeroSwasthyaApp());

    expect(find.text('MeroSwasthya'), findsOneWidget);
    expect(find.text('Login'), findsWidgets);
    expect(find.text('Register'), findsOneWidget);
    expect(find.text('Verify OTP'), findsOneWidget);
  });
}
