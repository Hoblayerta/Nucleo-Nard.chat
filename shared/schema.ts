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
  downvoteMultiplier: integer("downvote_multiplier").notNull().default(1),
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
  role: z.enum(["user", "moderator", "admin"]).optional(),
  likeMultiplier: z.number().min(1).max(20).optional(),
  downvoteMultiplier: z.number().min(1).max(20).optional(),
});

// Post model
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPostSchema = createInsertSchema(posts)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    imageUrl: z.string().url("Invalid image URL").optional(),
    linkUrl: z.string().url("Invalid link URL").optional(),
  });

// Comment model
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").notNull(),
  postId: integer("post_id").notNull(),
  parentId: integer("parent_id"),
  path: text("path").default(""), // Path for hierarchical comment tree (e.g. "1.2.3")
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
  path: true,
});

// Votes model (replacing Likes)
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  commentId: integer("comment_id"),
  postId: integer("post_id"),
  value: integer("value").notNull(), // 1 for upvote, -1 for downvote
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
}).extend({
  value: z.union([z.literal(1), z.literal(-1)]),
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

export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

// Extended types for frontend
export type CommentWithUser = Comment & {
  user: {
    id: number;
    username: string;
    role: string;
    likeMultiplier: number;
    downvoteMultiplier: number;
  };
  upvotes: number;
  downvotes: number;
  score: number; // Calculated score (upvotes - downvotes)
  replies?: CommentWithUser[];
  level: number; // Nesting level for UI
  position: number; // Position in the comment thread for enumeration
};

export type PostWithDetails = Post & {
  user: {
    id: number;
    username: string;
    role: string;
  };
  upvotes: number;
  downvotes: number;
  score: number; // Calculated score
  comments: number;
  permalink: string; // For sharing
};

export type UserStats = {
  postCount: number;
  commentCount: number;
  upvotesReceived: number;
  downvotesReceived: number;
  totalScore: number; // Net score (upvotes - downvotes)
};

// For scoreboard display
export type ScoreboardItem = {
  id: number;
  type: 'post' | 'comment';
  title?: string;
  content: string;
  username: string;
  score: number;
  permalink: string;
};
