import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  likeMultiplier: integer("like_multiplier").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const loginUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

export const updateUserSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  likeMultiplier: z.number().min(1).max(10).optional(),
});

// Post model
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
});

// Comment model
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").notNull(),
  postId: integer("post_id").notNull(),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

// Vote model (replaces the old Like model)
export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  commentId: integer("comment_id"),
  postId: integer("post_id"),
  isUpvote: boolean("is_upvote").notNull().default(true), // true = upvote, false = downvote
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Like = typeof likes.$inferSelect;
export type InsertLike = z.infer<typeof insertLikeSchema>;

// Extended types for frontend
export type CommentWithUser = Comment & {
  user: {
    id: number;
    username: string;
    role: string;
    likeMultiplier: number;
  };
  upvotes: number;
  downvotes: number;
  voteScore: number; // net score = upvotes - downvotes
  userVote?: 'upvote' | 'downvote' | null; // for logged in user
  replies?: CommentWithUser[];
};

export type PostWithDetails = Post & {
  user: {
    id: number;
    username: string;
    role: string;
  };
  upvotes: number;
  downvotes: number;
  voteScore: number; // net score = upvotes - downvotes
  userVote?: 'upvote' | 'downvote' | null; // for logged in user
  comments: number;
};

export type UserStats = {
  postCount: number;
  commentCount: number;
  upvotesReceived: number;
  downvotesReceived: number;
  netScore: number; // upvotes - downvotes
};
