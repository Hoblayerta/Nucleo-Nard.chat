import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  loginUserSchema, 
  insertPostSchema, 
  insertCommentSchema, 
  insertVoteSchema, 
  updateUserSchema 
} from "@shared/schema";
import session from "express-session";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
    role: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "lemmy-clone-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 1 day
    })
  );

  // Authentication Middleware
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  const requireAdmin = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId || req.session.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Authentication Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const user = await storage.createUser(data);
      
      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginUserSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(data.username);
      if (!user || user.password !== data.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(404).json({ message: "User not found" });
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    res.status(200).json(userWithoutPassword);
  });

  // User Routes
  // Fixed order: specific route first, then parametrized routes
  app.get("/api/users/top", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topUsers = await storage.getTopUsers(limit);
      
      // Remove passwords from response
      const usersWithoutPasswords = topUsers.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.status(200).json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch top users" });
    }
  });

  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.status(200).json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get user stats
      const stats = await storage.getUserStats(id);
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json({
        ...userWithoutPassword,
        stats
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const data = updateUserSchema.parse(req.body);
      
      const updatedUser = await storage.updateUser(id, data);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Don't allow deleting own account
      if (id === req.session.userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Post Routes
  app.post("/api/posts", requireAdmin, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const data = insertPostSchema.parse({
        ...req.body,
        userId
      });
      
      const post = await storage.createPost(data);
      res.status(201).json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.get("/api/posts", async (req, res) => {
    try {
      const posts = await storage.getPosts();
      res.status(200).json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.get("/api/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      // Use getPostByPermalink which provides all the details we need
      const permalink = `/post/${id}`;
      const postDetails = await storage.getPostByPermalink(permalink);
      
      if (!postDetails) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      res.status(200).json(postDetails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  // Comment Routes
  app.post("/api/comments", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const data = insertCommentSchema.parse({
        ...req.body,
        userId
      });
      
      const comment = await storage.createComment(data);
      const user = await storage.getUser(userId);
      
      // Calculate path for proper comment hierarchy
      // This will be a root comment, so its position will be its ID
      const path = `${comment.id}`;
      
      // Generate a permalink for this comment
      const permalink = await storage.generatePermalink('comment', comment.id, path);
      
      res.status(201).json({
        ...comment,
        path,
        user: {
          id: user?.id || 0,
          username: user?.username || "unknown",
          role: user?.role || "user",
          likeMultiplier: user?.likeMultiplier || 1,
          downvoteMultiplier: user?.downvoteMultiplier || 1,
        },
        upvotes: 0,
        downvotes: 0,
        score: 0,
        level: 0,
        position: comment.id,
        permalink,
        replies: []
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.get("/api/posts/:postId/comments", async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const comments = await storage.getCommentsByPostId(postId);
      res.status(200).json(comments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Vote Routes
  app.post("/api/votes", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { commentId, postId, value } = req.body;
      
      if (!commentId && !postId) {
        return res.status(400).json({ message: "Either commentId or postId is required" });
      }
      
      if (value !== 1 && value !== -1) {
        return res.status(400).json({ message: "Vote value must be 1 (upvote) or -1 (downvote)" });
      }
      
      // Process vote
      const existingVote = await storage.checkVoteExists(userId, commentId, postId);
      
      // If vote exists with same value, it will be removed (toggle behavior)
      const result = await storage.updateVote(userId, value, commentId, postId);
      
      const action = existingVote && existingVote.value === value 
        ? "removed" 
        : existingVote 
          ? "changed" 
          : "added";
      
      const voteType = value === 1 ? "upvote" : "downvote";
      
      res.status(200).json({ 
        message: `Vote ${action} successfully`, 
        action, 
        voteType
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to process vote" });
    }
  });
  
  // For compatibility with existing client code
  app.post("/api/likes", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { commentId, postId } = req.body;
      
      if (!commentId && !postId) {
        return res.status(400).json({ message: "Either commentId or postId is required" });
      }
      
      // Value = 1 for upvote (like)
      const value = 1;
      
      // Process vote as an upvote
      const existingVote = await storage.checkVoteExists(userId, commentId, postId);
      
      // If vote exists with same value, it will be removed (toggle behavior)
      const result = await storage.updateVote(userId, value, commentId, postId);
      
      const action = existingVote && existingVote.value === value 
        ? "removed" 
        : existingVote 
          ? "changed" 
          : "added";
      
      res.status(200).json({ 
        message: `Like ${action} successfully`, 
        action,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to process like" });
    }
  });

  // Leaderboard
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topComments = await storage.getTopComments(limit);
      res.status(200).json(topComments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
