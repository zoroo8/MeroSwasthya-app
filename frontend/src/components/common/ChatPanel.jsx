import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { apiRequest, getAssetUrl, SOCKET_BASE_URL } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { EmptyState, Notice, formatDateTime } from './DashboardComponents';

const conversationKey = (conversation) => `${conversation.doctor?.id}-${conversation.patient?.id}`;

const getInitial = (value) => String(value || 'U').trim().charAt(0).toUpperCase() || 'U';

const toDoctorConversation = (doctor, patientId, existing) => existing || ({
  doctor: {
    id: doctor.id || doctor._id,
    name: doctor.user?.name || doctor.name || 'Doctor',
    email: doctor.user?.email || doctor.email,
    phone: doctor.user?.phone || doctor.phone,
    profileImage: doctor.user?.profileImage || doctor.profileImage,
    specialty: doctor.specialty,
  },
  patient: { id: patientId },
  lastMessage: null,
});

export function ChatPanel() {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [doctorDirectory, setDoctorDirectory] = useState([]);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const selectedKeyRef = useRef('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState({ loading: false, error: '', message: '' });

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  const patientConversations = useMemo(() => {
    if (user?.role !== 'patient') return conversations;

    const byDoctor = new Map(conversations.map((conversation) => [String(conversation.doctor?.id), conversation]));
    return doctorDirectory.map((doctor) => {
      const doctorId = String(doctor.id || doctor._id);
      return toDoctorConversation(doctor, user?.id, byDoctor.get(doctorId));
    });
  }, [conversations, doctorDirectory, user]);

  const visibleConversations = user?.role === 'patient' ? patientConversations : conversations;

  const selectedConversation = useMemo(
    () => visibleConversations.find((conversation) => conversationKey(conversation) === selectedKey),
    [visibleConversations, selectedKey]
  );

  const upsertConversation = (conversation) => {
    setConversations((current) => {
      const key = conversationKey(conversation);
      const exists = current.some((item) => conversationKey(item) === key);

      if (exists) {
        return current.map((item) => (conversationKey(item) === key ? { ...item, ...conversation } : item));
      }

      return [conversation, ...current];
    });
  };

  const appendMessage = (incomingMessage) => {
    setMessages((current) => {
      if (current.some((message) => String(message._id) === String(incomingMessage._id))) {
        return current;
      }

      return [...current, incomingMessage];
    });
  };

  useEffect(() => {
    if (!token) return undefined;

    const nextSocket = io(SOCKET_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    nextSocket.on('connect', () => {
      setSocketConnected(true);
      setStatus((current) => ({ ...current, error: '' }));
    });

    nextSocket.on('disconnect', () => {
      setSocketConnected(false);
    });

    nextSocket.on('chat:message', (payload) => {
      if (payload.conversation) {
        upsertConversation(payload.conversation);
      }

      if (conversationKey(payload) === selectedKeyRef.current) {
        appendMessage(payload.message);
      }
    });

    nextSocket.on('connect_error', (err) => {
      setStatus({ loading: false, error: err.message || 'Realtime chat connection failed', message: '' });
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
      setSocketConnected(false);
    };
  }, [token]);

  const loadConversations = async () => {
    if (!token) return;

    setStatus((current) => ({ ...current, loading: true, error: '' }));

    try {
      const data = await apiRequest('/chat/conversations', { method: 'GET' }, token);
      setConversations(data.conversations || []);
      setStatus((current) => ({ ...current, loading: false }));
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'Unable to load conversations', message: '' });
    }
  };

  const loadDoctors = async (search = doctorSearch) => {
    if (user?.role !== 'patient') return;

    const query = new URLSearchParams();
    if (search.trim()) {
      query.set('search', search.trim());
    }

    const queryString = query.toString() ? `?${query.toString()}` : '';

    try {
      const data = await apiRequest(`/doctor${queryString}`, { method: 'GET' }, token);
      setDoctorDirectory(data.doctors || []);
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'Unable to load doctors', message: '' });
    }
  };

  useEffect(() => {
    loadConversations();
    loadDoctors('');
  }, [token, user?.role]);

  useEffect(() => {
    if (selectedKey || visibleConversations.length === 0) return;
    setSelectedKey(conversationKey(visibleConversations[0]));
  }, [visibleConversations, selectedKey]);

  useEffect(() => {
    if (!selectedConversation || !token) {
      setMessages([]);
      return;
    }

    const query = new URLSearchParams({
      doctorId: selectedConversation.doctor.id,
      patientUserId: selectedConversation.patient.id,
    });

    let isCurrent = true;
    setStatus((current) => ({ ...current, loading: true, error: '' }));

    apiRequest(`/chat/messages?${query.toString()}`, { method: 'GET' }, token)
      .then((data) => {
        if (!isCurrent) return;
        setMessages(data.messages || []);
        setStatus((current) => ({ ...current, loading: false }));
      })
      .catch((err) => {
        if (!isCurrent) return;
        setStatus({ loading: false, error: err.message || 'Unable to load messages', message: '' });
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedConversation, token]);

  const searchDoctors = (event) => {
    event.preventDefault();
    loadDoctors(doctorSearch);
  };

  const sendMessage = async (event) => {
    event.preventDefault();

    if (!selectedConversation || !draft.trim() || !socket || !socketConnected) return;

    if (user?.role === 'doctor' && messages.length === 0) {
      setStatus({ loading: false, error: 'Patients must send the first message before you can reply', message: '' });
      return;
    }

    setStatus({ loading: true, error: '', message: '' });

    socket.emit(
      'chat:send',
      {
        doctorId: selectedConversation.doctor.id,
        patientUserId: selectedConversation.patient.id,
        message: draft.trim(),
      },
      (response) => {
        if (!response?.ok) {
          setStatus({ loading: false, error: response?.message || 'Unable to send message', message: '' });
          return;
        }

        if (response.conversation) {
          upsertConversation(response.conversation);
        }
        appendMessage(response.message);
        setDraft('');
        setStatus({ loading: false, error: '', message: 'Message sent' });
      }
    );
  };

  const getConversationTitle = (conversation) => {
    return user?.role === 'doctor'
      ? conversation.patient?.name || 'Patient'
      : conversation.doctor?.name || 'Doctor';
  };

  const getConversationImage = (conversation) => {
    return user?.role === 'doctor'
      ? getAssetUrl(conversation.patient?.profileImage)
      : getAssetUrl(conversation.doctor?.profileImage);
  };

  const getConversationSubtitle = (conversation) => {
    return user?.role === 'doctor'
      ? conversation.patient?.email || 'Patient conversation'
      : conversation.doctor?.specialty || 'Care conversation';
  };

  const getMessageImage = (message) => {
    return getAssetUrl(message.senderUser?.profileImage);
  };

  const canSend = Boolean(draft.trim() && socketConnected && selectedConversation)
    && (user?.role !== 'doctor' || messages.length > 0);

  return (
    <div className="chat-layout">
      <aside className="conversation-list">
        {user?.role === 'patient' && (
          <form className="chat-doctor-search" onSubmit={searchDoctors}>
            <input
              value={doctorSearch}
              onChange={(event) => setDoctorSearch(event.target.value)}
              placeholder="Search doctors"
            />
            <button className="secondary-action compact-button" disabled={status.loading}>Search</button>
          </form>
        )}

        {visibleConversations.length === 0 ? (
          <EmptyState
            title={user?.role === 'patient' ? 'No doctors found' : 'No patient messages yet'}
            description={user?.role === 'patient' ? 'Search doctors and send the first message.' : 'Patients must start the chat before it appears here.'}
          />
        ) : (
          visibleConversations.map((conversation) => {
            const key = conversationKey(conversation);
            const image = getConversationImage(conversation);
            const title = getConversationTitle(conversation);
            return (
              <button
                key={key}
                type="button"
                className={`conversation-item ${selectedKey === key ? 'selected' : ''}`}
                onClick={() => setSelectedKey(key)}
              >
                {image ? <img className="avatar" src={image} alt="" /> : <div className="avatar">{getInitial(title)}</div>}
                <span>
                  <strong>{title}</strong>
                  <small>{conversation.lastMessage?.message || conversation.doctor?.specialty || 'Start chat'}</small>
                </span>
              </button>
            );
          })
        )}
      </aside>

      <section className="chat-window">
        {selectedConversation ? (
          <>
            <div className="chat-header">
              {getConversationImage(selectedConversation) ? (
                <img className="avatar chat-header-avatar" src={getConversationImage(selectedConversation)} alt="" />
              ) : (
                <div className="avatar chat-header-avatar">{getInitial(getConversationTitle(selectedConversation))}</div>
              )}
              <span>
                <strong>{getConversationTitle(selectedConversation)}</strong>
                <small>{getConversationSubtitle(selectedConversation)}</small>
              </span>
            </div>
            <div className="message-list">
              {messages.length === 0 ? (
                <EmptyState
                  title={user?.role === 'patient' ? 'Start this chat' : 'Waiting for patient'}
                  description={user?.role === 'patient' ? 'Send the first message to this doctor.' : 'The patient must send the first message before you can reply.'}
                />
              ) : (
                messages.map((message) => {
                  const senderId = message.senderUser?._id || message.senderUser?.id;
                  const isMine = String(senderId) === String(user?.id);
                  const senderName = message.senderUser?.name || 'User';
                  const senderImage = getMessageImage(message);
                  return (
                    <article key={message._id} className={`message-row ${isMine ? 'mine' : ''}`}>
                      {senderImage ? (
                        <img className="avatar message-avatar" src={senderImage} alt="" />
                      ) : (
                        <div className="avatar message-avatar">{getInitial(senderName)}</div>
                      )}
                      <div className={`message-bubble ${isMine ? 'mine' : ''}`}>
                        <p>{message.message}</p>
                        <small>{senderName} - {formatDateTime(message.createdAt)}</small>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
            <form className="chat-compose" onSubmit={sendMessage}>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={user?.role === 'doctor' && messages.length === 0 ? 'Waiting for patient first message' : 'Type a message'}
                maxLength={1000}
                disabled={user?.role === 'doctor' && messages.length === 0}
              />
              <button className="primary-action compact-button" disabled={!canSend}>
                Send
              </button>
            </form>
          </>
        ) : (
          <EmptyState title={user?.role === 'patient' ? 'Choose a doctor' : 'Choose a patient'} />
        )}
        <Notice error={status.error} message={status.message} />
      </section>
    </div>
  );
}
