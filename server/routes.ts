import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  loginUserSchema, 
  insertPostSchema, 
  insertCommentSchema, 
  insertLikeSchema, 
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
  
  app.put("/api/posts/:id/freeze", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { frozen } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.updatePost(id, { frozen });
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.status(200).json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to update post freeze status" });
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

  // Top Posts - IMPORTANT: This route must be defined before the dynamic :id route
  app.get("/api/posts/top", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const topPosts = await storage.getTopPosts(limit);
      res.status(200).json(topPosts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch top posts" });
    }
  });

  app.get("/api/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const post = await storage.getPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      const user = await storage.getUser(post.userId);
      
      // Count likes
      const likes = Array.from((await storage.getLikesByUserId(post.userId)).values())
        .filter(like => like.postId === post.id)
        .length;
      
      res.status(200).json({
        ...post,
        user: {
          id: user?.id || 0,
          username: user?.username || "unknown",
          role: user?.role || "user",
        },
        likes
      });
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
      
      // Verificar si el post está congelado
      const post = await storage.getPost(data.postId);
      if (post?.frozen) {
        return res.status(403).json({ message: "No se pueden añadir comentarios a un post congelado" });
      }
      
      const comment = await storage.createComment(data);
      const user = await storage.getUser(userId);
      
      res.status(201).json({
        ...comment,
        user: {
          id: user?.id || 0,
          username: user?.username || "unknown",
          role: user?.role || "user",
          likeMultiplier: user?.likeMultiplier || 1
        },
        likes: 0,
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
      const { commentId, postId, isUpvote } = req.body;
      
      if (!commentId && !postId) {
        return res.status(400).json({ message: "Either commentId or postId is required" });
      }
      
      if (isUpvote === undefined) {
        return res.status(400).json({ message: "Vote type (isUpvote) is required" });
      }
      
      // Verificar si se está votando directamente en un post congelado
      if (postId) {
        const post = await storage.getPost(postId);
        if (post?.frozen) {
          return res.status(403).json({ message: "No se pueden añadir votos a un post congelado" });
        }
      }
      
      // Verificar si se está votando en un comentario de un post congelado
      if (commentId) {
        const comment = await storage.getComment(commentId);
        if (comment) {
          const post = await storage.getPost(comment.postId);
          if (post?.frozen) {
            return res.status(403).json({ message: "No se pueden añadir votos a comentarios de un post congelado" });
          }
        }
      }
      
      // Check if already voted on this item
      const existingVote = await storage.getUserVote(userId, commentId, postId);
      if (existingVote) {
        // Remove existing vote
        await storage.removeLike(userId, commentId, postId);
        
        // If the user is changing vote type (upvote -> downvote or vice versa), add the new vote
        if ((existingVote === 'upvote' && !isUpvote) || (existingVote === 'downvote' && isUpvote)) {
          const data = insertLikeSchema.parse({
            userId,
            commentId,
            postId,
            isUpvote
          });
          
          await storage.createLike(data);
          return res.status(201).json({ 
            message: isUpvote ? "Upvoted successfully" : "Downvoted successfully", 
            action: "changed", 
            voteType: isUpvote ? "upvote" : "downvote" 
          });
        }
        
        // If the user is clicking the same vote type, just remove the vote
        return res.status(200).json({ 
          message: "Vote removed", 
          action: "removed" 
        });
      }
      
      // Add new vote
      const data = insertLikeSchema.parse({
        userId,
        commentId,
        postId,
        isUpvote
      });
      
      await storage.createLike(data);
      res.status(201).json({ 
        message: isUpvote ? "Upvoted successfully" : "Downvoted successfully", 
        action: "added", 
        voteType: isUpvote ? "upvote" : "downvote" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to vote" });
    }
  });
  
  // Legacy route for backwards compatibility
  app.post("/api/likes", requireAuth, async (req, res) => {
    try {
      // Redirect to the votes endpoint with isUpvote=true
      req.body.isUpvote = true;
      
      // Forward the request to the votes handler
      const voteHandler = app._router.stack
        .filter((layer: any) => layer.route?.path === '/api/votes')
        .map((layer: any) => layer.route.stack[0].handle)[0];
      
      if (voteHandler) {
        voteHandler(req, res);
      } else {
        res.status(500).json({ message: "Vote handler not found" });
      }
    } catch (error) {
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
