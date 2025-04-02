import { Express, Request, Response, NextFunction } from "express";
import { Server, createServer } from "http";
import { z } from "zod";
import { WebSocketServer } from "ws";
import { createWriteStream } from "fs";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertPostSchema,
  insertCommentSchema,
  insertLikeSchema,
  loginUserSchema,
  registerUserSchema,
  updateUserSchema,
  NotificationType,
  CommentWithUser
} from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
    role: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  const requireAdmin = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId || req.session.role !== "admin") {
      return res.status(403).json({ message: "Admin privileges required" });
    }
    next();
  };

  const requireModerator = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId || (req.session.role !== "admin" && req.session.role !== "moderator")) {
      return res.status(403).json({ message: "Moderator privileges required" });
    }
    next();
  };

  // Crear un usuario (solo admins pueden crear usuarios)
  app.post("/api/auth/register", requireAdmin, async (req, res) => {
    try {
      // Validamos con el nuevo esquema de registro
      const userData = registerUserSchema.parse(req.body);
      
      // Verificar si el usuario ya existe
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const user = await storage.createUser({
        username: userData.username,
        password: userData.password,
        role: userData.role,
        likeMultiplier: userData.likeMultiplier,
        badges: userData.badges
      });
      
      res.status(201).json({
        username: user.username,
        role: user.role,
        likeMultiplier: user.likeMultiplier,
        badges: user.badges,
        id: user.id
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginUserSchema.parse(req.body);
      const user = await storage.getUserByUsername(data.username);
      
      if (!user || user.password !== data.password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      
      res.status(200).json({
        username: user.username,
        role: user.role,
        likeMultiplier: user.likeMultiplier,
        badges: user.badges,
        id: user.id
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to log in" });
    }
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    try {
      console.log("Session data:", req.session);
      
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        // Si el usuario no existe, limpiar la sesión
        req.session.destroy((err) => {
          if (err) {
            console.error("Error al destruir la sesión:", err);
          }
        });
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(200).json({
        username: user.username,
        role: user.role,
        likeMultiplier: user.likeMultiplier,
        badges: user.badges,
        id: user.id
      });
    } catch (error) {
      console.error("Error al obtener usuario:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to log out" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Obtener todos los usuarios (admin solo)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      // No enviar la contraseña
      const sanitizedUsers = users.map(user => ({
        username: user.username,
        role: user.role,
        likeMultiplier: user.likeMultiplier,
        badges: user.badges,
        id: user.id
      }));
      res.status(200).json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });
  
  // Obtener lista simplificada de usuarios para menciones (autenticado)
  app.get("/api/users/list", requireAuth, async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Solo enviar username e id para menciones
      const usernames = users.map(user => ({
        username: user.username,
        id: user.id
      }));
      res.status(200).json(usernames);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user list" });
    }
  });

  // Actualizar un usuario (solo admin)
  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const data = updateUserSchema.parse(req.body);
      
      const user = await storage.updateUser(userId, data);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(200).json({
        username: user.username,
        role: user.role,
        likeMultiplier: user.likeMultiplier,
        badges: user.badges,
        id: user.id
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Crear un post (usuario autenticado)
  app.post("/api/posts", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const data = insertPostSchema.parse({
        ...req.body,
        userId,
        createdAt: new Date()
      });
      
      const post = await storage.createPost(data);
      res.status(201).json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  // Obtener todos los posts
  app.get("/api/posts", async (req, res) => {
    try {
      const currentUserId = req.session?.userId || 0;
      const posts = await storage.getPosts(currentUserId);
      res.status(200).json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get posts" });
    }
  });

  // Obtener un post por ID
  app.get("/api/posts/:id", async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      const post = await storage.getPost(postId);
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      res.status(200).json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to get post" });
    }
  });

  // Actualizar estado de congelación de un post (solo admin/mod)
  app.put("/api/posts/:id/freeze", requireModerator, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      const { frozen } = req.body;
      
      if (typeof frozen !== 'boolean') {
        return res.status(400).json({ message: "Invalid input: 'frozen' must be a boolean" });
      }
      
      const post = await storage.updatePost(postId, { frozen });
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      res.status(200).json({ message: `Post ${frozen ? 'frozen' : 'unfrozen'} successfully`, post });
    } catch (error) {
      res.status(500).json({ message: "Failed to update post freeze status" });
    }
  });

  // Actualizar intervalo de modo lento de un post (solo admin/mod)
  app.put("/api/posts/:id/slow-mode", requireModerator, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      const { slowModeInterval } = req.body;
      
      if (typeof slowModeInterval !== 'number' || slowModeInterval < 0) {
        return res.status(400).json({ message: "Invalid input: 'slowModeInterval' must be a non-negative number" });
      }
      
      const post = await storage.updatePost(postId, { slowModeInterval });
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      res.status(200).json({ 
        message: slowModeInterval > 0 
          ? `Slow mode set to ${slowModeInterval} seconds` 
          : "Slow mode disabled", 
        post 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update slow mode interval" });
    }
  });

  // Crear un comentario (usuario autenticado)
  app.post("/api/comments", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const data = insertCommentSchema.parse({
        ...req.body,
        userId,
        createdAt: new Date()
      });
      
      // Verificar si el post existe
      const post = await storage.getPost(data.postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      // Verificar si el post está congelado
      if (post.frozen) {
        return res.status(403).json({ message: "This post is frozen. Comments are disabled." });
      }
      
      // Verificar modo lento
      if (post.slowModeInterval > 0) {
        // Obtener comentarios recientes del usuario en este post
        const allComments = await storage.getCommentsByPostId(post.id);
        const userComments = allComments
          .filter(c => c.user.id === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        const lastComment = userComments[0];
        
        if (lastComment) {
          const lastCommentTime = new Date(lastComment.createdAt).getTime();
          const currentTime = new Date().getTime();
          const timeDiff = currentTime - lastCommentTime; // diferencia en milisegundos
          const waitTime = post.slowModeInterval * 1000; // convertir segundos a milisegundos
          
          if (timeDiff < waitTime) {
            const remainingSeconds = Math.ceil((waitTime - timeDiff) / 1000);
            return res.status(429).json({ 
              message: `Modo lento activado. Debes esperar ${remainingSeconds} segundos antes de comentar nuevamente.`,
              remainingSeconds
            });
          }
        }
      }
      
      const comment = await storage.createComment(data);
      const user = userId ? await storage.getUser(userId) : undefined;
      
      // Crear notificación si es una respuesta a otro comentario
      if (comment.parentId) {
        const parentComment = await storage.getComment(comment.parentId);
        if (parentComment && parentComment.userId !== userId) {
          if (userId) { // Asegurarnos de que userId no es undefined
            await storage.createNotification({
              userId: parentComment.userId,
              triggeredByUserId: userId,
              postId: comment.postId,
              commentId: comment.id,
              parentCommentId: parentComment.id, // Usar el ID del comentario padre directamente
              type: 'reply'
            });
          }
        }
      }
      
      // Buscar menciones en el comentario (@usuario)
      const mentionRegex = /@(\w+)/g;
      const mentions = data.content.match(mentionRegex);
      
      if (mentions) {
        const users = await storage.getUsers();
        const usernames = users.map(u => u.username.toLowerCase());
        
        // Para cada mención, enviar notificación al usuario mencionado
        for (const mention of mentions) {
          const username = mention.substring(1); // Quitar el signo @
          const mentionedUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
          
          if (mentionedUser && userId && mentionedUser.id !== userId) {
            await storage.createNotification({
              userId: mentionedUser.id,
              triggeredByUserId: userId,
              postId: comment.postId,
              commentId: comment.id,
              mentionedUsername: mentionedUser.username,
              type: 'mention'
            });
          }
        }
      }
      
      res.status(201).json({
        ...comment,
        user: {
          id: user?.id,
          username: user?.username,
          role: user?.role,
          badges: user?.badges,
          likeMultiplier: user?.likeMultiplier
        }
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Obtener comentarios de un post
  app.get("/api/posts/:id/comments", async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      const currentUserId = req.session?.userId || 0;
      
      // Verificar si el post existe
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      const comments = await storage.getCommentsByPostId(postId, currentUserId);
      res.status(200).json(comments);
    } catch (error) {
      res.status(500).json({ message: "Failed to get comments" });
    }
  });
  
  // Función auxiliar para formatear comentarios para exportación
  function formatCommentsForExport(comments: any[], postTitle: string): string {
    // Encabezados del CSV
    let csv = 'Índice,Usuario,Rol,Badges,Contenido,Votos,Fecha\n';
    
    // Función recursiva para procesar comentarios con sus respuestas
    function processComments(cmts: any[], prefix = '') {
      cmts.forEach((comment, index) => {
        const currentIndex = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
        
        // Escapar comillas en el contenido
        const escapedContent = comment.content.replace(/"/g, '""');
        
        // Formatear badges como una lista separada por comas
        const badges = comment.user.badges.join(', ');
        
        // Calcular votos netos
        const netVotes = comment.voteScore;
        
        // Formatear fecha
        const date = new Date(comment.createdAt);
        const formattedDate = date.toLocaleString();
        
        // Añadir la línea al CSV
        csv += `"${currentIndex}","${comment.user.username}","${comment.user.role}","${badges}","${escapedContent}","${netVotes}","${formattedDate}"\n`;
        
        // Procesar respuestas recursivamente
        if (comment.replies && comment.replies.length > 0) {
          processComments(comment.replies, currentIndex);
        }
      });
    }
    
    processComments(comments);
    return csv;
  }
  
  // Exportar comentarios de un post (solo para admin/mod)
  app.get("/api/posts/:id/comments/export", requireAuth, async (req, res) => {
    try {
      // Verificar si el usuario es admin o moderador
      if (req.session.role !== 'admin' && req.session.role !== 'moderator') {
        return res.status(403).json({ message: "No tienes permisos para exportar comentarios" });
      }
      
      const postId = parseInt(req.params.id, 10);
      const currentUserId = req.session.userId;
      
      // Obtener el post para incluir su título
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post no encontrado" });
      }
      
      // Obtener comentarios
      const comments = await storage.getCommentsByPostId(postId, currentUserId);
      
      // Formatear los comentarios para exportación
      const formattedComments = formatCommentsForExport(comments, post.title);
      
      // Establecer cabeceras para descarga de CSV
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="comentarios-post-${postId}.csv"`);
      
      // Enviar los datos formateados
      res.send(formattedComments);
    } catch (error) {
      console.error(`Error exportando comentarios para post ${req.params.id}:`, error);
      res.status(500).json({ message: "Error interno al exportar comentarios" });
    }
  });

  // Crear o actualizar un voto (like/dislike)
  app.post("/api/votes", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const { commentId, postId, voteType } = req.body;
      
      // Verificar que el ID de usuario existe
      if (!userId) {
        return res.status(401).json({ message: "User ID not found in session" });
      }
      
      if (voteType !== 'upvote' && voteType !== 'downvote') {
        return res.status(400).json({ message: "Invalid vote type. Must be 'upvote' or 'downvote'" });
      }
      
      if (!commentId && !postId) {
        return res.status(400).json({ message: "Must provide either commentId or postId" });
      }
      
      // Verificar si el comentario/post existe
      if (commentId) {
        const comment = await storage.getComment(commentId);
        if (!comment) {
          return res.status(404).json({ message: "Comment not found" });
        }
        
        // Verificar si el post asociado está congelado
        const post = await storage.getPost(comment.postId);
        if (post && post.frozen) {
          return res.status(403).json({ message: "This post is frozen. Voting is disabled." });
        }
      } else if (postId) {
        const post = await storage.getPost(postId);
        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }
        
        // Verificar si el post está congelado
        if (post.frozen) {
          return res.status(403).json({ message: "This post is frozen. Voting is disabled." });
        }
      }
      
      // Verificar si ya existe un voto del usuario
      const existingVote = await storage.checkLikeExists(userId, commentId, postId);
      
      // Si ya existe un voto, eliminarlo
      if (existingVote) {
        await storage.removeLike(userId, commentId, postId);
      }
      
      // Crear un nuevo voto si no es el mismo tipo que el existente
      const userVote = await storage.getUserVote(userId, commentId, postId);
      let action = "added";
      
      if (userVote === voteType) {
        action = "removed";
      } else {
        // Si es un voto diferente o no había voto, crear uno nuevo
        await storage.createLike({
          userId,
          commentId,
          postId,
          isUpvote: voteType === 'upvote'
        });
        
        // Ya no creamos notificaciones para likes, solo para menciones y respuestas
      }
      
      res.status(201).json({ 
        message: `${voteType === 'upvote' ? 'Upvoted' : 'Downvoted'} successfully`,
        action
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to process vote" });
    }
  });

  // Obtener usuarios del tablero de un post (PostBoard)
  app.get("/api/posts/:id/board", async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      
      // Verificar si el post existe
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      const users = await storage.getPostBoardUsers(postId);
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to get post board users" });
    }
  });

  // Actualizar verificación de usuario en un post (IRL o Handmade)
  app.post("/api/posts/:postId/users/:userId/verify", requireModerator, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId, 10);
      const userId = parseInt(req.params.userId, 10);
      const { type, value } = req.body;
      
      if (type !== 'irl' && type !== 'handmade') {
        return res.status(400).json({ message: "Invalid verification type. Must be 'irl' or 'handmade'" });
      }
      
      if (typeof value !== 'boolean') {
        return res.status(400).json({ message: "Invalid value. Must be a boolean" });
      }
      
      // Obtener el nombre del verificador (admin/mod)
      const verifierName = req.session.username || '';
      
      const result = await storage.updateUserVerification(userId, postId, type, value, verifierName);
      
      if (result) {
        res.status(200).json({ 
          message: `User ${userId} ${value ? 'verified' : 'unverified'} as ${type} by ${verifierName}`,
          type,
          value,
          verifiedBy: verifierName
        });
      } else {
        res.status(400).json({ message: "Failed to update verification" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint para verificación
  app.put("/api/posts/:postId/verify", requireModerator, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId, 10);
      const { userId, type, value } = req.body;
      
      if (!userId || typeof userId !== 'number') {
        return res.status(400).json({ message: "userId is required and must be a number" });
      }
      
      if (type !== 'irl' && type !== 'handmade') {
        return res.status(400).json({ message: "Invalid verification type. Must be 'irl' or 'handmade'" });
      }
      
      if (typeof value !== 'boolean') {
        return res.status(400).json({ message: "Invalid value. Must be a boolean" });
      }
      
      // Obtener el nombre del verificador (admin/mod)
      const verifierName = req.session.username || '';
      
      const result = await storage.updateUserVerification(userId, postId, type, value, verifierName);
      
      if (result) {
        res.status(200).json({ 
          message: `User ${userId} ${value ? 'verified' : 'unverified'} as ${type} by ${verifierName}`,
          type,
          value,
          verifiedBy: verifierName
        });
      } else {
        res.status(404).json({ message: "User or post not found" });
      }
    } catch (error) {
      console.error("Error en verificación:", error);
      res.status(500).json({ message: "Failed to update user verification" });
    }
  });
  
  // Obtener el leaderboard (mejores comentarios)
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const currentUserId = req.session?.userId || 0;
      const limitStr = req.query.limit as string;
      const limit = limitStr ? parseInt(limitStr, 10) : 10;
      
      const topComments = await storage.getTopComments(limit, currentUserId);
      res.status(200).json(topComments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  const httpServer = createServer(app);
  
  // Notificaciones
  
  // Obtener notificaciones del usuario actual
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found in session" });
      }
      
      const notifications = await storage.getUserNotifications(userId);
      res.status(200).json(notifications);
    } catch (error) {
      console.error("Error getting notifications:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Marcar todas las notificaciones como leídas
  app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found in session" });
      }
      
      console.log(`Intentando marcar todas las notificaciones como leídas para el usuario ID: ${userId}`);
      
      const result = await storage.markAllNotificationsAsRead(userId);
      
      console.log(`Resultado de marcar notificaciones como leídas: ${result}`);
      
      if (result) {
        console.log("Todas las notificaciones marcadas como leídas con éxito");
        res.status(200).json({ success: true });
      } else {
        console.log("No había notificaciones para marcar como leídas");
        res.status(200).json({ success: false, message: "No hay notificaciones para marcar como leídas" });
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Marcar una notificación como leída
  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const notificationId = parseInt(req.params.id, 10);
      
      console.log(`Intentando marcar la notificación ID: ${notificationId} como leída para el usuario ID: ${userId}`);
      
      const result = await storage.markNotificationAsRead(notificationId);
      
      console.log(`Resultado de marcar notificación ${notificationId} como leída: ${result}`);
      
      if (result) {
        console.log(`Notificación ${notificationId} marcada como leída con éxito`);
        res.status(200).json({ success: true });
      } else {
        console.log(`Notificación ${notificationId} no encontrada o ya leída`);
        res.status(404).json({ message: "Notificación no encontrada" });
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}