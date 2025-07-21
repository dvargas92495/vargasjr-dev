"use client";

import React, { useState, useCallback } from "react";
import { HashtagIcon, LockClosedIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  unreadCount?: number;
}

interface Message {
  id: string;
  user: string;
  avatar: string;
  timestamp: string;
  content: string;
}

const mockChannels: Channel[] = [
  { id: "1", name: "general", isPrivate: false, unreadCount: 3 },
  { id: "2", name: "eng-alerts", isPrivate: false, unreadCount: 1 },
  { id: "3", name: "sales-alerts", isPrivate: true, unreadCount: 2 },
];

const mockMessages: Message[] = [
  {
    id: "1",
    user: "David Vargas",
    avatar: "DV",
    timestamp: "10:30 AM",
    content: "Hey team! Just wanted to update everyone on the VargasJR development progress. We've made some great improvements to the agent system."
  },
  {
    id: "2",
    user: "Sarah Chen",
    avatar: "SC",
    timestamp: "10:32 AM",
    content: "That's awesome! Can you share more details about the improvements?"
  },
  {
    id: "3",
    user: "Mike Johnson",
    avatar: "MJ",
    timestamp: "10:35 AM",
    content: "I'm particularly interested in the performance optimizations 🚀"
  },
  {
    id: "4",
    user: "David Vargas",
    avatar: "DV",
    timestamp: "10:37 AM",
    content: "Sure! We've improved the agent deployment speed by 40% and added better error handling. The new UI simulator is also looking great."
  },
  {
    id: "5",
    user: "Emily Rodriguez",
    avatar: "ER",
    timestamp: "10:40 AM",
    content: "Love the progress! When can we expect the next release?"
  }
];

export default function SlackSimulatorClient() {
  const [selectedChannel, setSelectedChannel] = useState<Channel>(mockChannels[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [directMessagesExpanded, setDirectMessagesExpanded] = useState(true);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>(mockMessages);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    
    try {
      const response = await fetch("/api/test-slack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: selectedChannel.name,
          message: message.trim(),
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        const newMessage: Message = {
          id: `msg-${Date.now()}`,
          user: "David Vargas",
          avatar: "DV",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: message.trim()
        };
        
        setMessages(prev => [...prev, newMessage]);
        setMessage("");
      } else {
        console.error("Failed to send message:", data.error);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  }, [message, selectedChannel.name, isLoading]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-purple-700 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1 hover:bg-purple-600 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">VargasJR Workspace</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center text-sm font-semibold">
            DV
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:relative z-30 w-64 bg-purple-800 text-white flex flex-col transition-transform duration-300 ease-in-out h-full`}>
          
          {/* Workspace Header */}
          <div className="p-4 border-b border-purple-700">
            <h2 className="font-bold text-lg">VargasJR</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm text-purple-200">David Vargas</span>
            </div>
          </div>

          {/* Channels Section */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              <button
                onClick={() => setChannelsExpanded(!channelsExpanded)}
                className="flex items-center gap-2 w-full p-2 hover:bg-purple-700 rounded text-sm font-semibold text-purple-200"
              >
                {channelsExpanded ? (
                  <ChevronDownIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
                Channels
              </button>
              
              {channelsExpanded && (
                <div className="ml-2">
                  {mockChannels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannel(channel);
                        setSidebarOpen(false);
                      }}
                      className={`flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-purple-700 ${
                        selectedChannel.id === channel.id ? 'bg-purple-600' : ''
                      }`}
                    >
                      {channel.isPrivate ? (
                        <LockClosedIcon className="w-4 h-4 text-purple-300" />
                      ) : (
                        <HashtagIcon className="w-4 h-4 text-purple-300" />
                      )}
                      <span className="flex-1 text-left">{channel.name}</span>
                      {channel.unreadCount && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                          {channel.unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                  <button className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-purple-700 text-purple-300">
                    <PlusIcon className="w-4 h-4" />
                    Add channels
                  </button>
                </div>
              )}
            </div>

            {/* Direct Messages Section */}
            <div className="p-2">
              <button
                onClick={() => setDirectMessagesExpanded(!directMessagesExpanded)}
                className="flex items-center gap-2 w-full p-2 hover:bg-purple-700 rounded text-sm font-semibold text-purple-200"
              >
                {directMessagesExpanded ? (
                  <ChevronDownIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
                Direct messages
              </button>
              
              {directMessagesExpanded && (
                <div className="ml-2">
                  <button className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-purple-700">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Sarah Chen</span>
                  </button>
                  <button className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-purple-700">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span>Mike Johnson</span>
                  </button>
                  <button className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-purple-700">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Emily Rodriguez</span>
                  </button>
                  <button className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-purple-700 text-purple-300">
                    <PlusIcon className="w-4 h-4" />
                    Add teammates
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Channel Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            {selectedChannel.isPrivate ? (
              <LockClosedIcon className="w-5 h-5 text-gray-600" />
            ) : (
              <HashtagIcon className="w-5 h-5 text-gray-600" />
            )}
            <h2 className="font-bold text-lg">{selectedChannel.name}</h2>
            <div className="text-sm text-gray-500">
              {selectedChannel.isPrivate ? 'Private channel' : 'Public channel'}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-white">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex gap-3 hover:bg-gray-50 p-2 rounded">
                  <div className="w-9 h-9 bg-purple-500 rounded flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {message.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{message.user}</span>
                      <span className="text-xs text-gray-500">{message.timestamp}</span>
                    </div>
                    <div className="text-gray-800 text-sm leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="border border-gray-300 rounded-lg p-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500">
                  <textarea
                    placeholder={`Message #${selectedChannel.name}`}
                    className="w-full resize-none border-0 outline-none text-sm"
                    rows={1}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                </div>
              </div>
              <button 
                onClick={handleSendMessage}
                disabled={!message.trim() || isLoading}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
