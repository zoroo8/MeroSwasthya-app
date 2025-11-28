import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

typedef JsonMap = Map<String, dynamic>;

class ApiException implements Exception {
  ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required String baseUrl})
    : baseUrl = baseUrl.replaceAll(RegExp(r'/$'), '');

  final String baseUrl;
  final HttpClient _httpClient = HttpClient();

  Future<JsonMap> get(
    String path, {
    String? token,
    Map<String, String>? query,
  }) {
    return request(path, token: token, query: query);
  }

  Future<JsonMap> post(
    String path, {
    String? token,
    JsonMap? body,
    Map<String, String>? query,
  }) {
    return request(
      path,
      method: 'POST',
      token: token,
      body: body,
      query: query,
    );
  }

  Future<JsonMap> put(String path, {String? token, JsonMap? body}) {
    return request(path, method: 'PUT', token: token, body: body);
  }

  Future<JsonMap> patch(String path, {String? token, JsonMap? body}) {
    return request(path, method: 'PATCH', token: token, body: body);
  }

  Future<JsonMap> delete(String path, {String? token}) {
    return request(path, method: 'DELETE', token: token);
  }

  Future<JsonMap> uploadFile(
    String path, {
    required String filePath,
    required String fieldName,
    String? token,
  }) async {
    try {
      final request = http.MultipartRequest('POST', _uri(path, null));
      request.headers[HttpHeaders.acceptHeader] = 'application/json';

      if (token != null && token.isNotEmpty) {
        request.headers[HttpHeaders.authorizationHeader] = 'Bearer $token';
      }

      request.files.add(await http.MultipartFile.fromPath(fieldName, filePath));
      final response = await http.Response.fromStream(await request.send());
      return _decodeResponse(response.statusCode, response.body);
    } on ApiException {
      rethrow;
    } on FormatException {
      throw ApiException('The API returned an unreadable response.');
    } on FileSystemException {
      throw ApiException('The selected file could not be read.');
    } on http.ClientException {
      throw ApiException('Could not reach the API at $baseUrl.');
    } on SocketException {
      throw ApiException('Could not reach the API at $baseUrl.');
    }
  }

  Future<JsonMap> request(
    String path, {
    String method = 'GET',
    String? token,
    JsonMap? body,
    Map<String, String>? query,
  }) async {
    try {
      final request = await _httpClient.openUrl(method, _uri(path, query));
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');

      if (token != null && token.isNotEmpty) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }

      if (body != null) {
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode(body));
      }

      final response = await request.close();
      final rawBody = await utf8.decoder.bind(response).join();
      return _decodeResponse(response.statusCode, rawBody);
    } on ApiException {
      rethrow;
    } on FormatException {
      throw ApiException('The API returned an unreadable response.');
    } on SocketException {
      throw ApiException('Could not reach the API at $baseUrl.');
    } on HandshakeException {
      throw ApiException('The API connection could not be secured.');
    }
  }

  String assetUrl(Object? value) {
    final raw = textOf(value);
    if (raw.isEmpty) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }

    final apiRoot = baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    return '$apiRoot${raw.startsWith('/') ? '' : '/'}$raw';
  }

  Uri _uri(String path, Map<String, String>? query) {
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$baseUrl$normalizedPath');
    if (query == null || query.isEmpty) return uri;

    return uri.replace(
      queryParameters: query..removeWhere((key, value) => value.trim().isEmpty),
    );
  }

  JsonMap _decodeResponse(int statusCode, String rawBody) {
    final data = rawBody.isEmpty
        ? <String, dynamic>{}
        : asJsonMap(jsonDecode(rawBody));

    if (statusCode < 200 || statusCode >= 300) {
      throw ApiException(
        _friendlyMessage(textOf(data['message'], 'Request failed')),
      );
    }

    return data;
  }

  String _friendlyMessage(String message) {
    if (RegExp(
      'gmail|smtp|badcredentials|username and password not accepted',
      caseSensitive: false,
    ).hasMatch(message)) {
      return 'Verification email could not be sent. Check the server email settings.';
    }

    return message;
  }
}

JsonMap asJsonMap(Object? value) {
  if (value is JsonMap) return value;
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }

  return <String, dynamic>{};
}

List<JsonMap> asJsonList(Object? value) {
  if (value is! Iterable) return <JsonMap>[];
  return value.map(asJsonMap).where((item) => item.isNotEmpty).toList();
}

Object? nestedValue(Object? value, List<String> path) {
  Object? current = value;

  for (final key in path) {
    final map = asJsonMap(current);
    if (map.isEmpty || !map.containsKey(key)) return null;
    current = map[key];
  }

  return current;
}

String nestedText(Object? value, List<String> path, [String fallback = '']) {
  return textOf(nestedValue(value, path), fallback);
}

String textOf(Object? value, [String fallback = '']) {
  if (value == null) return fallback;
  final text = value.toString().trim();
  return text.isEmpty ? fallback : text;
}

int intOf(Object? value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse(textOf(value)) ?? fallback;
}

double doubleOf(Object? value, [double fallback = 0]) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(textOf(value)) ?? fallback;
}

bool boolOf(Object? value, [bool fallback = false]) {
  if (value is bool) return value;
  final normalized = textOf(value).toLowerCase();
  if (normalized == 'true') return true;
  if (normalized == 'false') return false;
  return fallback;
}

List<String> stringList(Object? value) {
  if (value is! Iterable) return <String>[];
  return value.map(textOf).where((item) => item.isNotEmpty).toList();
}
