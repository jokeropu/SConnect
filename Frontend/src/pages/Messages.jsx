import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Send, Plus } from 'lucide-react';
import { messageApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { getSocket } from '../api/socket';
import { Loader, EmptyState, Note, Avatar, Input, Button, Chip } from '../design/primitives';
import { Modal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { cn, fullName, relativeTime, ROLE_LABEL } from '../design/cn';

export default function Messages() {
  const { user } = useSelector((state) => state.auth);

  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const bottomRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const response = await messageApi.conversations();
      setConversations(response.data);
      if (!active && response.data.length > 0) setActive(response.data[0]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!active) return;
    const load = async () => {
      try {
        const response = await messageApi.messages(active._id, { limit: 60 });
        setMessages(response.data);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    };
    load();

    const socket = getSocket();
    socket?.emit('conversation:join', active._id);
    return () => socket?.emit('conversation:leave', active._id);
  }, [active]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onNew = (message) => {
      setMessages((current) => (message.conversationId === active?._id ? [...current, message] : current));
      loadConversations();
    };

    socket.on('message:new', onNew);
    return () => socket.off('message:new', onNew);
  }, [active, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text || !active) return;

    const socket = getSocket();
    if (socket) {
      socket.emit('message:send', { conversationId: active._id, text }, (response) => {
        if (!response?.ok) toast.error(response?.error || 'Could not send');
      });
    } else {
      messageApi.send(active._id, { text }).catch((err) => toast.error(errorMessage(err)));
    }
    setDraft('');
  };

  const openContacts = async () => {
    setContactsOpen(true);
    try {
      const response = await messageApi.contacts();
      setContacts(response.data);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const startWith = async (contact) => {
    try {
      const response = await messageApi.start(contact._id);
      setContactsOpen(false);
      await loadConversations();
      setActive({ _id: response.conversation._id, other: contact, unread: 0 });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) return <Loader label="Loading messages" />;
  if (error) return <div className="p-4"><Note tone="error">{error}</Note></div>;

  return (
    <>
      <div className="m-4 mt-0 flex h-[calc(100vh-7rem)] overflow-hidden rounded-md bg-white">
        <div className="flex w-full flex-col border-r border-gray-100 md:w-72">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h1 className="font-semibold">Messages</h1>
            <button type="button" onClick={openContacts} aria-label="New conversation" className="flex h-7 w-7 items-center justify-center rounded-full bg-lama-yellow">
              <Plus className="h-3.5 w-3.5 text-gray-700" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && <p className="px-4 py-8 text-center text-xs text-gray-400">No conversations yet</p>}

            {conversations.map((conversation) => (
              <button
                key={conversation._id}
                type="button"
                onClick={() => setActive(conversation)}
                className={cn(
                  'flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-lama-purple-light',
                  active?._id === conversation._id && 'bg-lama-sky-light'
                )}
              >
                <Avatar src={conversation.other?.avatarUrl} name={conversation.other?.firstName} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fullName(conversation.other)}</p>
                  <p className="truncate text-[11px] text-gray-400">{conversation.lastMessage || 'No messages yet'}</p>
                </div>
                {conversation.unread > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-[10px] text-white">
                    {conversation.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden flex-1 flex-col md:flex">
          {!active ? (
            <EmptyState title="Pick a conversation" detail="Or start a new one with the plus button." />
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                <Avatar src={active.other?.avatarUrl} name={active.other?.firstName} size={34} />
                <div>
                  <p className="text-sm font-semibold">{fullName(active.other)}</p>
                  <p className="text-[11px] text-gray-400">{ROLE_LABEL[active.other?.role]}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 && <p className="py-10 text-center text-xs text-gray-400">Say hello</p>}

                {messages.map((message) => {
                  const mine = String(message.senderId?._id || message.senderId) === String(user._id);
                  return (
                    <div key={message._id} className={cn('mb-2 flex', mine ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                          mine ? 'rounded-br-sm bg-lama-purple text-gray-800' : 'rounded-bl-sm bg-gray-100 text-gray-700'
                        )}
                      >
                        <p className="whitespace-pre-line">{message.text}</p>
                        <p className="mt-1 text-[10px] text-gray-500">{relativeTime(message.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Write a message..."
                />
                <Button onClick={send} disabled={!draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal open={contactsOpen} onClose={() => setContactsOpen(false)} title="Start a conversation" description="You can only message people connected to your classes">
        {contacts.length === 0 ? (
          <EmptyState title="Nobody available" detail="Once you are linked to a class your contacts appear here." />
        ) : (
          <div className="flex flex-col">
            {contacts.map((contact) => (
              <button
                key={contact._id}
                type="button"
                onClick={() => startWith(contact)}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-lama-purple-light"
              >
                <Avatar src={contact.avatarUrl} name={contact.firstName} size={30} />
                <span className="flex-1 text-sm font-medium">{fullName(contact)}</span>
                <Chip className="bg-gray-100 text-gray-500">{ROLE_LABEL[contact.role]}</Chip>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
