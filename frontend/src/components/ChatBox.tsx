"use client";
import React, { useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../utils/api";
import { useAuth } from "../hooks/useAuth";

interface ChatBoxProps {
  listingId: string;
  hostId: string;
  allowHostChat?: boolean;
  conversationId?: string;
  disableAutoScroll?: boolean;
  fullWidth?: boolean;
  hideHeader?: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  body: string;
  sent_at: string;
}

export default function ChatBox({ listingId, hostId, allowHostChat, conversationId: propConversationId, disableAutoScroll, fullWidth, hideHeader }: ChatBoxProps) {
  const { user } = useAuth();
  const userId = typeof user?.id === 'string' ? user.id : null;
  const [conversationId, setConversationId] = useState<string | null>(propConversationId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (!disableAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Find or create conversation on mount, unless conversationId is provided
  useEffect(() => {
    if (propConversationId) {
      setConversationId(propConversationId);
      setLoading(false);
      return;
    }
    if (!userId) return;
    async function getOrCreateConversation() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildApiUrl("/api/conversations/find-or-create"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listing_id: listingId,
            guest_id: userId,
            host_id: hostId,
          }),
        });
        const convo = await res.json();
        setConversationId(convo.id);
      } catch (e) {
        setError("Failed to load conversation.");
      } finally {
        setLoading(false);
      }
    }
    getOrCreateConversation();
  }, [listingId, hostId, userId, propConversationId]);

  // Fetch messages when conversationId is set
  useEffect(() => {
    if (!conversationId) return;
    let isMounted = true;
    async function fetchMessages() {
      try {
        const res = await fetch(buildApiUrl(`/api/messages/conversation/${conversationId}`));
        const msgs = await res.json();
        if (isMounted) setMessages(msgs);
      } catch (e) {
        if (isMounted) setError("Failed to load messages.");
      }
    }
    fetchMessages();
    // Poll for new messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [conversationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !conversationId || !userId) return;
    setSending(true);
    try {
      const res = await fetch(buildApiUrl("/api/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          sender_id: userId,
          body: input.trim(),
        }),
      });
      if (res.ok) {
        setInput("");
        // Optimistically add message
        setMessages((msgs) => [
          ...msgs,
          {
            id: Math.random().toString(),
            sender_id: userId,
            body: input.trim(),
            sent_at: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-gray-100 rounded-xl p-6 text-center text-black mt-8">
        <div className="mb-2 font-semibold">Log in to chat with the host</div>
      </div>
    );
  }

  if (userId === hostId && !allowHostChat) {
    return (
      <div className="bg-gray-100 rounded-xl p-6 text-center text-black mt-8">
        <div className="mb-2 font-semibold">This is your listing</div>
        <div className="text-sm text-gray-600">You can't message yourself</div>
      </div>
    );
  }

  return (
    <div
      className={
        fullWidth
          ? "h-full flex flex-col"
          : "bg-gray-50 rounded-2xl shadow p-4 mt-8 max-w-2xl mx-auto border border-gray-200"
      }
    >
      {!hideHeader && (
        <div className="font-bold text-lg mb-2 text-black">Chat with the host</div>
      )}
      <div
        className={
          fullWidth
            ? "flex-1 bg-white rounded-xl p-3 mb-3 border border-gray-100 flex flex-col overflow-y-auto scrollbar-hide"
            : "h-64 overflow-y-auto bg-white rounded-xl p-4 mb-4 border border-gray-100 flex flex-col scrollbar-hide"
        }
        style={fullWidth ? undefined : { minHeight: 200 }}
      >
        {loading ? (
          <div className="text-gray-400 text-center my-auto">Loading chat...</div>
        ) : error ? (
          <div className="text-red-500 text-center my-auto">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-gray-400 text-center my-auto">No messages yet. Say hello!</div>
        ) : (
          messages.map((msg, index) => {
            const isUser = userId && msg.sender_id === userId;
            const msgDate = new Date(msg.sent_at);
            const prevMsgDate = index > 0 ? new Date(messages[index - 1].sent_at) : null;
            
            // Check if this is the first message of a new day using local timezone
            const isFirstMessageOfDay = !prevMsgDate || 
              msgDate.toDateString() !== prevMsgDate.toDateString();
            
            return (
              <div key={msg.id + msg.sent_at}>
                {isFirstMessageOfDay && (
                  <div className="flex justify-center mb-3">
                    <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                      {msgDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                      })}
                    </div>
                  </div>
                )}
                <div className={`mb-2 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`px-4 py-2 rounded-2xl max-w-xs break-words shadow text-sm ${
                      isUser
                        ? 'text-white'
                        : 'bg-gray-200 text-black'
                    }`}
                    style={isUser ? { backgroundColor: '#368a98' } : undefined}
                  >
                    {msg.body}
                    <div className={`text-xs mt-1 text-right ${isUser ? 'text-white' : 'text-black'}`}>
                      {msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className={`flex gap-2 flex-shrink-0 ${fullWidth ? 'pb-2.5 pr-4 pl-4' : ''}`}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-full border border-gray-300 px-3 py-1.5 text-sm text-black bg-white focus:outline-none focus:ring-black focus:border-black focus:z-10"
          disabled={sending}
        />
        <button
          type="submit"
          className="text-white px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center justify-center"
          style={{ backgroundColor: '#368a98' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2d6f7a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#368a98'}
          disabled={sending || !input.trim()}
        >
          <img 
            src="/icons/icons8-send-50 (1).png" 
            alt="Send" 
            className="w-4 h-4"
          />
        </button>
      </form>
    </div>
  );
} 