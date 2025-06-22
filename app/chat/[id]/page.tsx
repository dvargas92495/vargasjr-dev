"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";

interface ChatSessionData {
  id: string;
  createdAt: string;
  inboxName: string;
  contactEmail: string;
  contactName: string;
  inboxId: string;
}

interface Message {
  id: string;
  body: string;
  source: string;
  createdAt: string;
}

export default function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<ChatSessionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { id } = await params;
        
        const response = await fetch(`/api/chat/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/404');
            return;
          }
          throw new Error('Failed to load chat session');
        }

        const data = await response.json();
        setSessionData(data.session);
        setMessages(data.messages);
      } catch (err) {
        console.error("Failed to load chat session:", err);
        setError("Failed to load chat session");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [params, router]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!sessionData) return;

      setSending(true);
      setError(null);

      const formData = new FormData(e.currentTarget);
      const message = formData.get("message") as string;

      try {
        const response = await fetch(`/api/chat/${sessionData.id}/message`, {
          method: "POST",
          body: JSON.stringify({ message }),
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const form = e.currentTarget;
          form.reset();
          
          const updatedResponse = await fetch(`/api/chat/${sessionData.id}`);
          if (updatedResponse.ok) {
            const updatedData = await updatedResponse.json();
            setMessages(updatedData.messages);
          }
        } else {
          throw new Error(await response.text());
        }
      } catch (error) {
        setError("Error sending message: " + error);
      } finally {
        setSending(false);
      }
    },
    [sessionData]
  );

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!sessionData) {
    return <div className="flex justify-center items-center min-h-screen">Session not found</div>;
  }

  return (
    <div className="flex flex-col p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Chat Session</h1>
      <div className="bg-gray-800 shadow rounded-lg p-6 text-white">
        <div className="mb-4">
          <div className="text-sm text-gray-300">Session ID</div>
          <div className="text-lg">{sessionData.id}</div>
        </div>
        <div className="mb-4">
          <div className="text-sm text-gray-300">Created At</div>
          <div className="text-lg">{new Date(sessionData.createdAt).toLocaleString()}</div>
        </div>
        <div className="mb-4">
          <div className="text-sm text-gray-300">Contact</div>
          <div className="text-lg">{sessionData.contactName || sessionData.contactEmail}</div>
        </div>
        
        <div className="mt-6">
          <div className="text-sm text-gray-300 mb-3">Messages</div>
          <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
            {messages.map((message) => (
              <div key={message.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-blue-300">{message.source}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-gray-100 whitespace-pre-wrap">{message.body}</div>
              </div>
            ))}
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <textarea
              name="message"
              placeholder="Type your message..."
              className="px-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white focus:outline-none focus:border-blue-500 min-h-[100px] resize-none"
              required
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending}
              className="bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 self-end"
            >
              {sending ? "Sending..." : "Send Message"}
            </button>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
