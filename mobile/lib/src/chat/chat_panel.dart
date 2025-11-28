import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/app_session.dart';
import '../ui/app_ui.dart';

class ChatPanel extends StatefulWidget {
  const ChatPanel({super.key, required this.session});

  final AppSession session;

  @override
  State<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends State<ChatPanel> {
  final _search = TextEditingController();
  final _draft = TextEditingController();

  List<JsonMap> _conversations = <JsonMap>[];
  List<JsonMap> _doctorDirectory = <JsonMap>[];
  List<JsonMap> _messages = <JsonMap>[];
  String _selectedKey = '';
  String _error = '';
  String _message = '';
  bool _loading = false;

  bool get _isPatient => widget.session.role == 'patient';

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  @override
  void dispose() {
    _search.dispose();
    _draft.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    await Future.wait([_loadConversations(), if (_isPatient) _loadDoctors()]);
  }

  Future<void> _loadConversations() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final data = await widget.session.api.get(
        '/chat/conversations',
        token: widget.session.token,
      );
      if (!mounted) return;

      setState(() {
        _conversations = asJsonList(data['conversations']);
        _loading = false;
      });
      _selectFirstConversation();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _loadDoctors([String search = '']) async {
    try {
      final data = await widget.session.api.get(
        '/doctor',
        token: widget.session.token,
        query: <String, String>{'search': search},
      );
      if (!mounted) return;

      setState(() => _doctorDirectory = asJsonList(data['doctors']));
      _selectFirstConversation();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  List<JsonMap> get _visibleConversations {
    if (!_isPatient) return _conversations;

    final existing = <String, JsonMap>{
      for (final conversation in _conversations)
        textOf(nestedValue(conversation, ['doctor', 'id'])): conversation,
    };

    return _doctorDirectory.map((doctor) {
      final doctorId = textOf(doctor['id'], textOf(doctor['_id']));
      return existing[doctorId] ??
          <String, dynamic>{
            'doctor': <String, dynamic>{
              'id': doctorId,
              'name': nestedText(doctor, [
                'user',
                'name',
              ], textOf(doctor['name'], 'Doctor')),
              'email': nestedText(doctor, [
                'user',
                'email',
              ], textOf(doctor['email'])),
              'profileImage': nestedText(doctor, [
                'user',
                'profileImage',
              ], textOf(doctor['profileImage'])),
              'specialty': textOf(doctor['specialty'], 'Care conversation'),
            },
            'patient': <String, dynamic>{
              'id': textOf(widget.session.user?['id']),
            },
          };
    }).toList();
  }

  JsonMap? get _selectedConversation {
    for (final conversation in _visibleConversations) {
      if (_keyOf(conversation) == _selectedKey) return conversation;
    }

    return null;
  }

  void _selectFirstConversation() {
    if (_selectedKey.isNotEmpty || _visibleConversations.isEmpty) return;

    final conversation = _visibleConversations.first;
    setState(() => _selectedKey = _keyOf(conversation));
    _loadMessages(conversation);
  }

  Future<void> _selectConversation(JsonMap conversation) async {
    setState(() {
      _selectedKey = _keyOf(conversation);
      _message = '';
      _error = '';
    });
    await _loadMessages(conversation);
  }

  Future<void> _loadMessages(JsonMap conversation) async {
    final doctorId = nestedText(conversation, ['doctor', 'id']);
    final patientId = nestedText(conversation, ['patient', 'id']);
    if (doctorId.isEmpty) return;

    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final data = await widget.session.api.get(
        '/chat/messages',
        token: widget.session.token,
        query: <String, String>{
          'doctorId': doctorId,
          'patientUserId': patientId,
        },
      );
      if (!mounted) return;

      setState(() {
        _messages = asJsonList(data['messages']);
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _messages = <JsonMap>[];
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _send() async {
    final conversation = _selectedConversation;
    final draft = _draft.text.trim();
    if (conversation == null || draft.isEmpty) return;

    setState(() {
      _loading = true;
      _error = '';
      _message = '';
    });

    try {
      final data = await widget.session.api.post(
        '/chat/messages',
        token: widget.session.token,
        body: <String, dynamic>{
          'doctorId': nestedText(conversation, ['doctor', 'id']),
          'patientUserId': nestedText(conversation, ['patient', 'id']),
          'message': draft,
        },
      );
      if (!mounted) return;

      final nextMessage = asJsonMap(data['message']);
      setState(() {
        _messages = [..._messages, if (nextMessage.isNotEmpty) nextMessage];
        _draft.clear();
        _message = 'Message sent.';
        _loading = false;
      });
      await _loadConversations();
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
    final visibleConversations = _visibleConversations;
    final selectedConversation = _selectedConversation;

    return SectionSurface(
      title: _isPatient ? 'Doctor Chat' : 'Patient Chat',
      description: _isPatient
          ? 'Search doctors, send the first message, and refresh replies.'
          : 'Patients start conversations before doctor replies appear.',
      trailing: IconButton(
        tooltip: 'Refresh chat',
        onPressed: _loading
            ? null
            : () async {
                await _loadInitial();
                final conversation = _selectedConversation;
                if (conversation != null) {
                  await _loadMessages(conversation);
                }
              },
        icon: const Icon(Icons.refresh),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_isPatient) ...[
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    decoration: const InputDecoration(
                      hintText: 'Search doctors',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: _loading
                      ? null
                      : () => _loadDoctors(_search.text.trim()),
                  child: const Text('Search'),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          if (visibleConversations.isEmpty)
            EmptyPanel(
              title: _isPatient
                  ? 'No doctors found'
                  : 'No patient messages yet',
              description: _isPatient
                  ? 'Search the doctor directory and start a conversation.'
                  : 'A patient must send the first message.',
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final conversation in visibleConversations) ...[
                    ChoiceChip(
                      selected: _selectedKey == _keyOf(conversation),
                      onSelected: (_) => _selectConversation(conversation),
                      avatar: AvatarBadge(
                        label: _titleOf(conversation),
                        imageUrl: _imageOf(conversation),
                        size: 28,
                      ),
                      label: Text(_titleOf(conversation)),
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
          if (selectedConversation != null) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                AvatarBadge(
                  label: _titleOf(selectedConversation),
                  imageUrl: _imageOf(selectedConversation),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _titleOf(selectedConversation),
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        _subtitleOf(selectedConversation),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: MeroPalette.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              constraints: const BoxConstraints(minHeight: 160, maxHeight: 340),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FBFA),
                border: Border.all(color: MeroPalette.line),
                borderRadius: BorderRadius.circular(8),
              ),
              child: _messages.isEmpty
                  ? EmptyPanel(
                      title: _isPatient
                          ? 'Start this chat'
                          : 'Waiting for patient',
                      description: _isPatient
                          ? 'Send the first message below.'
                          : 'Patients must message first.',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(10),
                      itemCount: _messages.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final chatMessage = _messages[index];
                        final senderId = nestedText(chatMessage, [
                          'senderUser',
                          '_id',
                        ], nestedText(chatMessage, ['senderUser', 'id']));
                        final mine =
                            senderId == textOf(widget.session.user?['id']);
                        return Align(
                          alignment: mine
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          child: Container(
                            constraints: const BoxConstraints(maxWidth: 300),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: mine ? MeroPalette.green : Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: mine
                                    ? MeroPalette.green
                                    : MeroPalette.line,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  textOf(chatMessage['message']),
                                  style: TextStyle(
                                    color: mine
                                        ? Colors.white
                                        : MeroPalette.ink,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${nestedText(chatMessage, ['senderUser', 'name'], 'User')} - '
                                  '${formatDateTime(chatMessage['createdAt'])}',
                                  style: TextStyle(
                                    color: mine
                                        ? const Color(0xFFD9FFFA)
                                        : MeroPalette.muted,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _draft,
                    minLines: 1,
                    maxLines: 3,
                    maxLength: 1000,
                    decoration: const InputDecoration(
                      hintText: 'Type a message',
                      counterText: '',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton.icon(
                  onPressed: _loading ? null : _send,
                  icon: const Icon(Icons.send),
                  label: const Text('Send'),
                ),
              ],
            ),
          ],
          if (_loading) ...[
            const SizedBox(height: 10),
            const LinearProgressIndicator(),
          ],
          const SizedBox(height: 10),
          NoticeBanner(error: _error, message: _message),
        ],
      ),
    );
  }

  String _keyOf(JsonMap conversation) {
    return '${nestedText(conversation, ['doctor', 'id'])}-${nestedText(conversation, ['patient', 'id'])}';
  }

  String _titleOf(JsonMap conversation) {
    return _isPatient
        ? nestedText(conversation, ['doctor', 'name'], 'Doctor')
        : nestedText(conversation, ['patient', 'name'], 'Patient');
  }

  String _subtitleOf(JsonMap conversation) {
    return _isPatient
        ? nestedText(conversation, ['doctor', 'specialty'], 'Care conversation')
        : nestedText(conversation, [
            'patient',
            'email',
          ], 'Patient conversation');
  }

  String _imageOf(JsonMap conversation) {
    final value = _isPatient
        ? nestedValue(conversation, ['doctor', 'profileImage'])
        : nestedValue(conversation, ['patient', 'profileImage']);
    return widget.session.api.assetUrl(value);
  }
}
