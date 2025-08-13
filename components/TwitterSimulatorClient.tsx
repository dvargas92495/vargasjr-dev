"use client";

import React, { useState, useCallback } from "react";
import { HeartIcon, ArrowPathRoundedSquareIcon, ChatBubbleLeftIcon, ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";

interface Tweet {
  id: string;
  user: string;
  username: string;
  avatar: string;
  timestamp: string;
  content: string;
  hashtags: string[];
  likes: number;
  retweets: number;
  replies: number;
  isLiked?: boolean;
  isRetweeted?: boolean;
}

const mockTweets: Tweet[] = [
  {
    id: "1",
    user: "David Vargas Jr",
    username: "@VargasJRDev",
    avatar: "DV",
    timestamp: "2h",
    content: "Just shipped a major update to our AI agent deployment system! 🚀 40% faster provisioning and much better error handling. The future of automated development is here.",
    hashtags: ["AI", "DevOps", "Automation"],
    likes: 127,
    retweets: 34,
    replies: 18
  },
  {
    id: "2",
    user: "David Vargas Jr",
    username: "@VargasJRDev",
    avatar: "DV",
    timestamp: "4h",
    content: "Hot take: The best debugging tool is still console.log() and a good understanding of your code flow. Don't overcomplicate it.",
    hashtags: ["JavaScript", "Debugging", "WebDev"],
    likes: 89,
    retweets: 23,
    replies: 12
  },
  {
    id: "3",
    user: "David Vargas Jr",
    username: "@VargasJRDev",
    avatar: "DV",
    timestamp: "6h",
    content: "Working on a Twitter simulator for our admin dashboard. Meta moment: tweeting about building a Twitter simulator while building a Twitter simulator 🤯",
    hashtags: ["Meta", "Development", "React"],
    likes: 156,
    retweets: 41,
    replies: 27
  },
  {
    id: "4",
    user: "David Vargas Jr",
    username: "@VargasJRDev",
    avatar: "DV",
    timestamp: "8h",
    content: "TypeScript tip: Use strict mode and embrace the red squiggles. Your future self will thank you when refactoring complex codebases.",
    hashtags: ["TypeScript", "Tips", "CodeQuality"],
    likes: 203,
    retweets: 67,
    replies: 31
  },
  {
    id: "5",
    user: "David Vargas Jr",
    username: "@VargasJRDev",
    avatar: "DV",
    timestamp: "12h",
    content: "The best part about building developer tools? When you solve a problem that you yourself face daily. Nothing beats that satisfaction.",
    hashtags: ["DeveloperTools", "ProductDevelopment"],
    likes: 94,
    retweets: 28,
    replies: 15
  },
  {
    id: "6",
    user: "David Vargas Jr",
    username: "@VargasJRDev",
    avatar: "DV",
    timestamp: "1d",
    content: "Reminder: Your code is read more often than it's written. Write for the human who comes after you (including future you).",
    hashtags: ["CleanCode", "BestPractices"],
    likes: 312,
    retweets: 89,
    replies: 43
  },
  {
    id: "7",
    user: "David Vargas Jr",
    username: "@VargasJRDev",
    avatar: "DV",
    timestamp: "1d",
    content: "Just discovered a new React pattern that's been hiding in plain sight. Sometimes the simplest solutions are the most elegant ones.",
    hashtags: ["React", "Patterns", "WebDev"],
    likes: 178,
    retweets: 52,
    replies: 29
  },
  {
    id: "8",
    user: "David Vargas Jr",
    username: "@VargasJRDev",
    avatar: "DV",
    timestamp: "2d",
    content: "Infrastructure as Code isn't just about automation - it's about making your deployments reproducible, testable, and fearless.",
    hashtags: ["IaC", "DevOps", "Terraform"],
    likes: 145,
    retweets: 38,
    replies: 22
  },
  {
    id: "9",
    user: "David Vargas Jr",
    username: "@VargasJRDev",
    avatar: "DV",
    timestamp: "2d",
    content: "Building AI agents that can actually ship production code feels like science fiction, but here we are. The future arrived faster than expected.",
    hashtags: ["AI", "Agents", "FutureTech"],
    likes: 267,
    retweets: 73,
    replies: 51
  },
  {
    id: "10",
    user: "David Vargas Jr",
    username: "@VargasJRDev",
    avatar: "DV",
    timestamp: "3d",
    content: "Pro tip: Always test your error handling paths. The happy path is easy - it's the edge cases that will bite you in production.",
    hashtags: ["Testing", "ErrorHandling", "Production"],
    likes: 198,
    retweets: 56,
    replies: 34
  }
];

export default function TwitterSimulatorClient() {
  const [tweets, setTweets] = useState<Tweet[]>(mockTweets);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    setTimeout(() => {
      setTweets([...mockTweets]);
      setIsRefreshing(false);
    }, 1000);
  }, []);

  const handleLike = useCallback((tweetId: string) => {
    setTweets(prev => prev.map(tweet => 
      tweet.id === tweetId 
        ? { 
            ...tweet, 
            isLiked: !tweet.isLiked,
            likes: tweet.isLiked ? tweet.likes - 1 : tweet.likes + 1
          }
        : tweet
    ));
  }, []);

  const handleRetweet = useCallback((tweetId: string) => {
    setTweets(prev => prev.map(tweet => 
      tweet.id === tweetId 
        ? { 
            ...tweet, 
            isRetweeted: !tweet.isRetweeted,
            retweets: tweet.isRetweeted ? tweet.retweets - 1 : tweet.retweets + 1
          }
        : tweet
    ));
  }, []);

  return (
    <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Latest Tweets</h2>
          <p className="text-sm text-gray-500">@VargasJRDev timeline</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowPathRoundedSquareIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Tweet Feed */}
      <div className="divide-y divide-gray-100">
        {tweets.map((tweet) => (
          <div key={tweet.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex gap-3">
              {/* Avatar */}
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                {tweet.avatar}
              </div>

              {/* Tweet Content */}
              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900">{tweet.user}</span>
                  <span className="text-gray-500">{tweet.username}</span>
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-500 text-sm">{tweet.timestamp}</span>
                </div>

                {/* Tweet Text */}
                <div className="text-gray-900 mb-3 leading-relaxed">
                  {tweet.content}
                  {tweet.hashtags.length > 0 && (
                    <div className="mt-2">
                      {tweet.hashtags.map((hashtag) => (
                        <span key={hashtag} className="text-blue-500 mr-2">
                          #{hashtag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Engagement Actions */}
                <div className="flex items-center gap-6 text-gray-500">
                  <button className="flex items-center gap-2 hover:text-blue-500 transition-colors group">
                    <div className="p-2 rounded-full group-hover:bg-blue-50 transition-colors">
                      <ChatBubbleLeftIcon className="w-4 h-4" />
                    </div>
                    <span className="text-sm">{tweet.replies}</span>
                  </button>

                  <button 
                    onClick={() => handleRetweet(tweet.id)}
                    className={`flex items-center gap-2 hover:text-green-500 transition-colors group ${
                      tweet.isRetweeted ? 'text-green-500' : ''
                    }`}
                  >
                    <div className="p-2 rounded-full group-hover:bg-green-50 transition-colors">
                      <ArrowsRightLeftIcon className="w-4 h-4" />
                    </div>
                    <span className="text-sm">{tweet.retweets}</span>
                  </button>

                  <button 
                    onClick={() => handleLike(tweet.id)}
                    className={`flex items-center gap-2 hover:text-red-500 transition-colors group ${
                      tweet.isLiked ? 'text-red-500' : ''
                    }`}
                  >
                    <div className="p-2 rounded-full group-hover:bg-red-50 transition-colors">
                      {tweet.isLiked ? (
                        <HeartIconSolid className="w-4 h-4" />
                      ) : (
                        <HeartIcon className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-sm">{tweet.likes}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 text-center text-sm text-gray-500">
        Showing {tweets.length} recent tweets
      </div>
    </div>
  );
}
