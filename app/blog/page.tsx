import React from "react";
import Image from "next/image";
import Link from "next/link";
import { getDb } from "@/db/connection";
import { BlogPostsTable } from "@/db/schema";
import { desc, isNotNull } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export default async function Blog() {
  const db = getDb();
  
  const blogPosts = await db
    .select({
      id: BlogPostsTable.id,
      title: BlogPostsTable.title,
      excerpt: BlogPostsTable.excerpt,
      publishedAt: BlogPostsTable.publishedAt,
    })
    .from(BlogPostsTable)
    .where(isNotNull(BlogPostsTable.publishedAt))
    .orderBy(desc(BlogPostsTable.publishedAt));

  return (
    <div className="grid place-items-center min-h-screen p-8">
      <div className="text-center flex flex-col items-center gap-6 max-w-4xl">
        <div className="relative w-32 h-32 mb-4">
          <Image
            src="/avatar.webp"
            alt="Vargas JR Avatar"
            fill
            className="rounded-full border-4 border-primary shadow-lg"
          />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-l from-primary to-secondary bg-clip-text text-transparent">
          VargasJR Blog
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Insights and updates from your automated senior developer
        </p>
        
        <div className="w-full space-y-8">
          {blogPosts.length === 0 ? (
            <p className="text-gray-500 text-center">No blog posts published yet. Check back soon!</p>
          ) : (
            blogPosts.map((post) => (
              <article key={post.id} className="text-left border-b border-gray-200 pb-6 last:border-b-0">
                <h2 className="text-2xl font-semibold mb-3 text-foreground">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="text-gray-600 mb-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                )}
                {post.publishedAt && (
                  <time className="text-sm text-gray-500">
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </time>
                )}
              </article>
            ))
          )}
        </div>

        <Link 
          href="/" 
          className="text-primary hover:underline hover:underline-offset-4 mt-8"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
