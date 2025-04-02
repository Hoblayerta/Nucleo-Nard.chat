import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Definir los tipos de insignias disponibles
export const BADGES = [
  "director",
  "guionista",
  "novato",
  "spamero",
  "dibujante",
  "animador",
  "hacker",
  "superfan",
  "fan",
  "masteranimador"
] as const;

export type Badge = typeof BADGES[number];

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  likeMultiplier: integer("like_multiplier").notNull().default(1),
  badges: text("badges").array().default([]),
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

export const registerUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(4, "Password must be at least 4 characters"),
  role: z.enum(["user", "moderator", "admin"]).default("user"),
  likeMultiplier: z.number().min(1).max(20).default(1),
  badges: z.array(z.string()).default([]),
});

export const updateUserSchema = z.object({
  role: z.enum(["user", "moderator", "admin"]).optional(),
  likeMultiplier: z.number().min(1).max(20).optional(),
  badges: z.array(z.string()).optional(),
});

// Post model
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  frozen: boolean("frozen").notNull().default(false),
  slowModeInterval: integer("slow_mode_interval").default(0).notNull(), // Tiempo en segundos (0 = desactivado)
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
export type RegisterUser = z.infer<typeof registerUserSchema>;
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
    badges: string[];
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
    badges: string[];
  };
  upvotes: number;
  downvotes: number;
  voteScore: number; // net score = upvotes - downvotes
  userVote?: 'upvote' | 'downvote' | null; // for logged in user
  comments: number;
  frozen: boolean;
  slowModeInterval: number; // tiempo en segundos
};

export type UserStats = {
  postCount: number;
  commentCount: number;
  upvotesReceived: number;
  downvotesReceived: number;
  netScore: number; // upvotes - downvotes
};

export type PostBoardUser = {
  id: number;
  username: string;
  role: string;
  badges: string[];
  commentCount: number;
  upvotes: number;
  downvotes: number;
  netScore: number;
  isIRL: boolean;
  isHandmade: boolean;
  irlVotes: string[]; // nombres de admin/mod que votaron IRL
  handmadeVotes: string[]; // nombres de admin/mod que votaron Handmade
  totalComments: number; // total de comentarios (incluyendo respuestas)
};

export type NotificationType = 'reply' | 'mention';

export type Notification = {
  id: number;
  userId: number; // usuario que recibe la notificación
  triggeredByUserId: number; // usuario que causó la notificación (dio like o respondió)
  postId: number;
  commentId?: number; // el comentario donde se respondió o se mencionó
  parentCommentId?: number; // si es una respuesta, el comentario padre
  mentionedUsername?: string; // nombre de usuario mencionado (solo para tipo "mention")
  type: NotificationType;
  read: boolean;
  createdAt: string;
  // Campos adicionales para mostrar en la interfaz sin necesidad de consultas adicionales
  triggerUsername?: string; // nombre del usuario que causó la notificación
  postTitle?: string; // título del post relacionado
};

export type NotificationWithDetails = Notification & {
  triggerUser: {
    username: string;
    role: string;
    badges: string[];
  };
  post: {
    title: string;
  };
};
