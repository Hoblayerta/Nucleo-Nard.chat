import { 
  users, posts, comments, likes, 
  type User, type InsertUser, type Post, type InsertPost,
  type Comment, type InsertComment, type Like, type InsertLike,
  type UpdateUser, type CommentWithUser, type PostWithDetails, type UserStats,
  type PostBoardUser
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: UpdateUser): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUsers(): Promise<User[]>;
  getTopUsers(limit: number): Promise<(User & { stats: UserStats })[]>;
  
  // Post operations
  createPost(post: InsertPost): Promise<Post>;
  getPost(id: number): Promise<Post | undefined>;
  getPosts(): Promise<PostWithDetails[]>;
  getTopPosts(limit: number): Promise<PostWithDetails[]>;
  updatePost(id: number, data: { frozen?: boolean, slowModeInterval?: number }): Promise<Post | undefined>;
  
  // Comment operations
  createComment(comment: InsertComment): Promise<Comment>;
  getComment(id: number): Promise<Comment | undefined>;
  getCommentsByPostId(postId: number): Promise<CommentWithUser[]>;
  
  // Like operations
  createLike(like: InsertLike): Promise<Like>;
  removeLike(userId: number, commentId?: number, postId?: number): Promise<boolean>;
  getLikesByUserId(userId: number): Promise<Like[]>;
  checkLikeExists(userId: number, commentId?: number, postId?: number): Promise<boolean>;
  
  // PostBoard operations
  getPostBoardUsers(postId: number): Promise<PostBoardUser[]>;
  updateUserVerification(userId: number, postId: number, verificationType: 'irl' | 'handmade', value: boolean, verifiedBy: string): Promise<boolean>;
  
  // Combined operations
  getTopComments(limit: number): Promise<CommentWithUser[]>;
  getUserStats(userId: number): Promise<UserStats>;
}

type UserVerification = {
  isIRL: boolean;
  isHandmade: boolean;
  irlVotes: string[];
  handmadeVotes: string[];
};

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private posts: Map<number, Post>;
  private comments: Map<number, Comment>;
  private likes: Map<number, Like>;
  private postVerifications: Map<number, Map<number, UserVerification>> = new Map(); // postId -> (userId -> verification)
  private currentIds: {
    user: number;
    post: number;
    comment: number;
    like: number;
  };

  constructor() {
    this.users = new Map();
    this.posts = new Map();
    this.comments = new Map();
    this.likes = new Map();
    this.currentIds = {
      user: 1,
      post: 1,
      comment: 1,
      like: 1,
    };
    
    // Create an initial admin user
    this.createUser({
      username: "admin",
      password: "admin123",
      role: "admin",
      likeMultiplier: 10,
      badges: ["director", "masteranimador"]
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentIds.user++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      role: insertUser.role || "user",
      likeMultiplier: insertUser.likeMultiplier || 1,
      badges: insertUser.badges || [],
      createdAt: now
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, data: UpdateUser): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...(data.role ? { role: data.role } : {}),
      ...(data.likeMultiplier !== undefined ? { likeMultiplier: data.likeMultiplier } : {}),
      ...(data.badges ? { badges: data.badges } : {}),
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    // Check if user exists
    const user = await this.getUser(id);
    if (!user) return false;
    
    // Delete the user
    this.users.delete(id);
    
    // Clean up associated data
    
    // 1. Remove user's posts
    const userPosts = Array.from(this.posts.values())
      .filter(post => post.userId === id)
      .map(post => post.id);
      
    userPosts.forEach(postId => {
      this.posts.delete(postId);
    });
    
    // 2. Remove user's comments
    const userComments = Array.from(this.comments.values())
      .filter(comment => comment.userId === id)
      .map(comment => comment.id);
      
    userComments.forEach(commentId => {
      this.comments.delete(commentId);
    });
    
    // 3. Remove user's likes
    const userLikes = Array.from(this.likes.values())
      .filter(like => like.userId === id)
      .map(like => like.id);
      
    userLikes.forEach(likeId => {
      this.likes.delete(likeId);
    });
    
    return true;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getTopUsers(limit: number): Promise<(User & { stats: UserStats })[]> {
    const users = Array.from(this.users.values());
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const stats = await this.getUserStats(user.id);
        return {
          ...user,
          stats
        };
      })
    );
    
    // Sort by net score (upvotes - downvotes) received (highest first) and take the specified limit
    return usersWithStats
      .sort((a, b) => b.stats.netScore - a.stats.netScore)
      .slice(0, limit);
  }

  // Post operations
  async createPost(insertPost: InsertPost): Promise<Post> {
    const id = this.currentIds.post++;
    const now = new Date();
    const post: Post = { 
      ...insertPost, 
      id, 
      createdAt: now,
      frozen: insertPost.frozen || false,
      slowModeInterval: insertPost.slowModeInterval || 0
    };
    this.posts.set(id, post);
    return post;
  }

  async getPost(id: number): Promise<Post | undefined> {
    return this.posts.get(id);
  }

  async getPosts(): Promise<PostWithDetails[]> {
    const posts = Array.from(this.posts.values());
    
    return Promise.all(posts.map(async (post) => {
      const user = await this.getUser(post.userId);
      
      // Calculate upvotes with multipliers
      const postUpvotes = Array.from(this.likes.values())
        .filter((like) => like.postId === post.id && like.isUpvote)
        .reduce((total, like) => {
          const likeUser = this.users.get(like.userId);
          return total + (likeUser?.likeMultiplier || 1);
        }, 0);
      
      // Calculate downvotes with multipliers
      const postDownvotes = Array.from(this.likes.values())
        .filter((like) => like.postId === post.id && !like.isUpvote)
        .reduce((total, like) => {
          const likeUser = this.users.get(like.userId);
          return total + (likeUser?.likeMultiplier || 1);
        }, 0);
        
      const postComments = Array.from(this.comments.values()).filter(
        (comment) => comment.postId === post.id
      ).length;
      
      // Get logged in user's vote if applicable
      const sessionUserId = 0; // This will be replaced with the actual session user ID when called from route handlers
      const userVote = await this.getUserVote(sessionUserId, undefined, post.id);
      
      return {
        ...post,
        user: {
          id: user?.id || 0,
          username: user?.username || "unknown",
          role: user?.role || "user",
          badges: user?.badges || [],
        },
        upvotes: postUpvotes,
        downvotes: postDownvotes,
        voteScore: postUpvotes - postDownvotes,
        userVote,
        comments: postComments,
        frozen: post.frozen || false,
        slowModeInterval: post.slowModeInterval || 0,
      };
    }));
  }
  
  async getTopPosts(limit: number): Promise<PostWithDetails[]> {
    const posts = await this.getPosts();
    
    // Sort by vote score (highest first) and take the specified limit
    return posts
      .sort((a, b) => b.voteScore - a.voteScore)
      .slice(0, limit);
  }
  
  async updatePost(id: number, data: { frozen?: boolean, slowModeInterval?: number }): Promise<Post | undefined> {
    const post = await this.getPost(id);
    if (!post) return undefined;
    
    const updatedPost: Post = {
      ...post,
      ...(data.frozen !== undefined ? { frozen: data.frozen } : {}),
      ...(data.slowModeInterval !== undefined ? { slowModeInterval: data.slowModeInterval } : {}),
    };
    
    this.posts.set(id, updatedPost);
    return updatedPost;
  }

  // Comment operations
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = this.currentIds.comment++;
    const now = new Date();
    const comment: Comment = { 
      ...insertComment, 
      id, 
      createdAt: now,
      parentId: insertComment.parentId ?? null 
    };
    this.comments.set(id, comment);
    return comment;
  }

  async getComment(id: number): Promise<Comment | undefined> {
    return this.comments.get(id);
  }

  async getCommentsByPostId(postId: number): Promise<CommentWithUser[]> {
    const allComments = Array.from(this.comments.values())
      .filter((comment) => comment.postId === postId)
      .map(async (comment) => {
        const user = await this.getUser(comment.userId);
        
        // Calculate upvotes with multipliers
        const commentUpvotes = Array.from(this.likes.values())
          .filter((like) => like.commentId === comment.id && like.isUpvote)
          .reduce((total, like) => {
            const likeUser = this.users.get(like.userId);
            return total + (likeUser?.likeMultiplier || 1);
          }, 0);
          
        // Calculate downvotes with multipliers
        const commentDownvotes = Array.from(this.likes.values())
          .filter((like) => like.commentId === comment.id && !like.isUpvote)
          .reduce((total, like) => {
            const likeUser = this.users.get(like.userId);
            return total + (likeUser?.likeMultiplier || 1);
          }, 0);
        
        // Get logged in user's vote if applicable
        const sessionUserId = 0; // This will be replaced with the actual session user ID when called from route handlers
        const userVote = await this.getUserVote(sessionUserId, comment.id);
        
        return {
          ...comment,
          user: {
            id: user?.id || 0,
            username: user?.username || "unknown",
            role: user?.role || "user",
            likeMultiplier: user?.likeMultiplier || 1,
            badges: user?.badges || [],
          },
          upvotes: commentUpvotes,
          downvotes: commentDownvotes,
          voteScore: commentUpvotes - commentDownvotes,
          userVote,
          replies: [],
        };
      });

    const comments = await Promise.all(allComments);

    // Build comment tree
    const commentMap = new Map<number, CommentWithUser>();
    const rootComments: CommentWithUser[] = [];

    // First pass: Create a map of all comments by ID
    comments.forEach(comment => {
      commentMap.set(comment.id, {...comment, replies: []});
    });

    // Second pass: Arrange comments into a tree structure
    commentMap.forEach(comment => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(comment);
        } else {
          rootComments.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    return rootComments;
  }

  // Like operations
  async createLike(insertLike: InsertLike): Promise<Like> {
    const id = this.currentIds.like++;
    const now = new Date();
    const like: Like = { 
      ...insertLike, 
      id, 
      createdAt: now,
      postId: insertLike.postId ?? null,
      commentId: insertLike.commentId ?? null,
      isUpvote: insertLike.isUpvote !== undefined ? insertLike.isUpvote : true
    };
    this.likes.set(id, like);
    return like;
  }

  async removeLike(userId: number, commentId?: number, postId?: number): Promise<boolean> {
    const likeToRemove = Array.from(this.likes.values()).find(
      (like) => 
        like.userId === userId && 
        ((commentId && like.commentId === commentId) || 
         (postId && like.postId === postId))
    );
    
    if (likeToRemove) {
      this.likes.delete(likeToRemove.id);
      return true;
    }
    
    return false;
  }

  async getLikesByUserId(userId: number): Promise<Like[]> {
    return Array.from(this.likes.values()).filter(
      (like) => like.userId === userId
    );
  }

  async checkLikeExists(userId: number, commentId?: number, postId?: number): Promise<boolean> {
    return Array.from(this.likes.values()).some(
      (like) => 
        like.userId === userId && 
        ((commentId && like.commentId === commentId) || 
         (postId && like.postId === postId))
    );
  }
  
  async getUserVote(userId: number, commentId?: number, postId?: number): Promise<'upvote' | 'downvote' | null> {
    const vote = Array.from(this.likes.values()).find(
      (like) => 
        like.userId === userId && 
        ((commentId && like.commentId === commentId) || 
         (postId && like.postId === postId))
    );
    
    if (!vote) return null;
    return vote.isUpvote ? 'upvote' : 'downvote';
  }

  // Combined operations
  async getTopComments(limit: number): Promise<CommentWithUser[]> {
    const comments = Array.from(this.comments.values());
    
    const commentsWithDetails = await Promise.all(
      comments.map(async (comment) => {
        const user = await this.getUser(comment.userId);
        
        // Calculate upvotes with multipliers
        const commentUpvotes = Array.from(this.likes.values())
          .filter((like) => like.commentId === comment.id && like.isUpvote)
          .reduce((total, like) => {
            const likeUser = this.users.get(like.userId);
            return total + (likeUser?.likeMultiplier || 1);
          }, 0);
          
        // Calculate downvotes with multipliers
        const commentDownvotes = Array.from(this.likes.values())
          .filter((like) => like.commentId === comment.id && !like.isUpvote)
          .reduce((total, like) => {
            const likeUser = this.users.get(like.userId);
            return total + (likeUser?.likeMultiplier || 1);
          }, 0);
          
        // Get logged in user's vote if applicable
        const sessionUserId = 0; // This will be replaced with the actual session user ID when called from route handlers
        const userVote = await this.getUserVote(sessionUserId, comment.id);
        
        return {
          ...comment,
          user: {
            id: user?.id || 0,
            username: user?.username || "unknown",
            role: user?.role || "user",
            likeMultiplier: user?.likeMultiplier || 1,
            badges: user?.badges || [],
          },
          upvotes: commentUpvotes,
          downvotes: commentDownvotes,
          voteScore: commentUpvotes - commentDownvotes,
          userVote,
          replies: [], // Will be populated later if needed
        };
      })
    );
    
    // Sort by vote score (highest first) and take the specified limit
    return commentsWithDetails
      .sort((a, b) => b.voteScore - a.voteScore)
      .slice(0, limit);
  }

  async getUserStats(userId: number): Promise<UserStats> {
    const postCount = Array.from(this.posts.values()).filter(
      (post) => post.userId === userId
    ).length;
    
    const commentCount = Array.from(this.comments.values()).filter(
      (comment) => comment.userId === userId
    ).length;
    
    // Calculate upvotes and downvotes received
    let upvotesReceived = 0;
    let downvotesReceived = 0;
    
    // Count votes on posts
    const userPosts = Array.from(this.posts.values()).filter(
      (post) => post.userId === userId
    );
    
    userPosts.forEach(post => {
      // Count upvotes
      upvotesReceived += Array.from(this.likes.values())
        .filter(like => like.postId === post.id && like.isUpvote)
        .reduce((total, like) => {
          const likeUser = this.users.get(like.userId);
          return total + (likeUser?.likeMultiplier || 1);
        }, 0);
        
      // Count downvotes
      downvotesReceived += Array.from(this.likes.values())
        .filter(like => like.postId === post.id && !like.isUpvote)
        .reduce((total, like) => {
          const likeUser = this.users.get(like.userId);
          return total + (likeUser?.likeMultiplier || 1);
        }, 0);
    });
    
    // Count votes on comments
    const userComments = Array.from(this.comments.values()).filter(
      (comment) => comment.userId === userId
    );
    
    userComments.forEach(comment => {
      // Count upvotes
      upvotesReceived += Array.from(this.likes.values())
        .filter(like => like.commentId === comment.id && like.isUpvote)
        .reduce((total, like) => {
          const likeUser = this.users.get(like.userId);
          return total + (likeUser?.likeMultiplier || 1);
        }, 0);
        
      // Count downvotes
      downvotesReceived += Array.from(this.likes.values())
        .filter(like => like.commentId === comment.id && !like.isUpvote)
        .reduce((total, like) => {
          const likeUser = this.users.get(like.userId);
          return total + (likeUser?.likeMultiplier || 1);
        }, 0);
    });
    
    return {
      postCount,
      commentCount,
      upvotesReceived,
      downvotesReceived,
      netScore: upvotesReceived - downvotesReceived
    };
  }

  // PostBoard operations
  async getPostBoardUsers(postId: number): Promise<PostBoardUser[]> {
    // Este método obtiene datos sobre los usuarios que han interactuado con un post específico
    const post = await this.getPost(postId);
    if (!post) return [];
    
    // Obtener todos los comentarios de este post
    const postComments = Array.from(this.comments.values()).filter(
      (comment) => comment.postId === postId
    );
    
    // Obtener todos los likes de este post
    const postLikes = Array.from(this.likes.values()).filter(
      (like) => like.postId === postId || postComments.some(c => c.id === like.commentId)
    );
    
    // Obtener verificaciones para este post
    const postVerificationsMap = this.postVerifications.get(postId) || new Map<number, UserVerification>();
    
    // Crear un mapa para el seguimiento de usuarios únicos
    const userMap = new Map<number, {
      user: User,
      commentCount: number,
      totalComments: number, // Incluye respuestas a comentarios
      upvotes: number,
      downvotes: number,
      isIRL: boolean,
      isHandmade: boolean,
      irlVotes: string[],
      handmadeVotes: string[]
    }>();
    
    // Añadir el autor del post si no está ya en el mapa
    const postAuthor = this.users.get(post.userId);
    if (postAuthor) {
      // Obtener verificaciones de este usuario si existen
      const userVerif = postVerificationsMap.get(postAuthor.id);
      
      userMap.set(postAuthor.id, {
        user: postAuthor,
        commentCount: 0,
        totalComments: 0,
        upvotes: 0,
        downvotes: 0,
        isIRL: userVerif?.isIRL || false,
        isHandmade: userVerif?.isHandmade || false,
        irlVotes: userVerif?.irlVotes || [],
        handmadeVotes: userVerif?.handmadeVotes || []
      });
    }
    
    // Añadir los autores de los comentarios
    postComments.forEach(comment => {
      const commentUser = this.users.get(comment.userId);
      if (commentUser) {
        if (userMap.has(commentUser.id)) {
          // Incrementar el contador de comentarios
          const userData = userMap.get(commentUser.id)!;
          userData.commentCount += 1;
        } else {
          // Añadir nuevo usuario
          const userVerif = postVerificationsMap.get(commentUser.id);
          
          userMap.set(commentUser.id, {
            user: commentUser,
            commentCount: 1,
            totalComments: 1,
            upvotes: 0,
            downvotes: 0,
            isIRL: userVerif?.isIRL || false,
            isHandmade: userVerif?.isHandmade || false,
            irlVotes: userVerif?.irlVotes || [],
            handmadeVotes: userVerif?.handmadeVotes || []
          });
        }
      }
    });
    
    // Procesar los votos en el post y comentarios
    postLikes.forEach(like => {
      const likeUser = this.users.get(like.userId);
      if (likeUser) {
        if (!userMap.has(likeUser.id)) {
          // Añadir nuevo usuario que solo ha votado
          const userVerif = postVerificationsMap.get(likeUser.id);
          
          userMap.set(likeUser.id, {
            user: likeUser,
            commentCount: 0,
            totalComments: 0,
            upvotes: 0,
            downvotes: 0,
            isIRL: userVerif?.isIRL || false,
            isHandmade: userVerif?.isHandmade || false,
            irlVotes: userVerif?.irlVotes || [],
            handmadeVotes: userVerif?.handmadeVotes || []
          });
        }
      }
    });
    
    // Convertir los datos de usuarios a formato PostBoardUser
    const result = Array.from(userMap.values()).map(item => {
      // Asegurarnos de que badges siempre sea un array
      const userBadges = Array.isArray(item.user.badges) ? item.user.badges : [];
      
      return {
        id: item.user.id,
        username: item.user.username,
        role: item.user.role,
        badges: userBadges,
        commentCount: item.commentCount,
        totalComments: item.totalComments || item.commentCount, // Si no hay total, usamos el recuento básico
        upvotes: item.upvotes,
        downvotes: item.downvotes,
        netScore: item.upvotes - item.downvotes,
        isIRL: item.isIRL,
        isHandmade: item.isHandmade,
        irlVotes: item.irlVotes || [],
        handmadeVotes: item.handmadeVotes || []
      };
    });
    
    // Ordenar por puntuación neta (descendente)
    return result.sort((a, b) => b.netScore - a.netScore);
  }
  
  async updateUserVerification(
    userId: number, 
    postId: number, 
    verificationType: 'irl' | 'handmade', 
    value: boolean, 
    verifiedBy: string
  ): Promise<boolean> {
    // Comprobar si el usuario existe
    const user = await this.getUser(userId);
    if (!user) return false;
    
    // Comprobar si el post existe
    const post = await this.getPost(postId);
    if (!post) return false;
    
    // Para implementar esta funcionalidad de manera más robusta, necesitaríamos
    // una tabla de verificaciones en la base de datos.
    // Aquí simulamos esta tabla con información en memoria:
    
    // Estructura para guardar las verificaciones
    // No es necesario verificar si this.postVerifications existe ya que lo inicializamos como propiedad de clase
    
    if (!this.postVerifications.has(postId)) {
      this.postVerifications.set(postId, new Map());
    }
    
    const postVerifications = this.postVerifications.get(postId)!;
    
    // Si no hay verificaciones para este usuario, creamos la entrada
    if (!postVerifications.has(userId)) {
      postVerifications.set(userId, {
        isIRL: false,
        isHandmade: false,
        irlVotes: [],
        handmadeVotes: []
      });
    }
    
    const userVerification = postVerifications.get(userId)!;
    
    // Actualizar las verificaciones
    if (verificationType === 'irl') {
      if (value) {
        // Añadir el voto si no existe
        if (!userVerification.irlVotes.includes(verifiedBy)) {
          userVerification.irlVotes.push(verifiedBy);
        }
      } else {
        // Eliminar el voto si existe
        userVerification.irlVotes = userVerification.irlVotes.filter(v => v !== verifiedBy);
      }
      // Actualizar estado basado en votos
      userVerification.isIRL = userVerification.irlVotes.length > 0;
    } else {
      if (value) {
        // Añadir el voto si no existe
        if (!userVerification.handmadeVotes.includes(verifiedBy)) {
          userVerification.handmadeVotes.push(verifiedBy);
        }
      } else {
        // Eliminar el voto si existe
        userVerification.handmadeVotes = userVerification.handmadeVotes.filter(v => v !== verifiedBy);
      }
      // Actualizar estado basado en votos
      userVerification.isHandmade = userVerification.handmadeVotes.length > 0;
    }
    
    // Guardar las actualizaciones
    postVerifications.set(userId, userVerification);
    this.postVerifications.set(postId, postVerifications);
    
    return true;
  }
}

export const storage = new MemStorage();
