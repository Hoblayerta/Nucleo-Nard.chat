import type { 
  User, InsertUser, UpdateUser, 
  Post, InsertPost,
  Comment, InsertComment,
  Like, InsertLike,
  CommentWithUser,
  PostWithDetails,
  UserStats,
  PostBoardUser
} from "@shared/schema";

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
  irlVerifiedBy: string[]; // Array de nombres de moderadores/admins que verificaron
  handmadeVerifiedBy: string[]; // Array de nombres de moderadores/admins que verificaron
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
      user: 0,
      post: 0,
      comment: 0,
      like: 0
    };
    
    // Inicializar con datos de ejemplo
    this.initializeData();
  }
  
  private initializeData() {
    // Admin user 
    const admin = {
      id: ++this.currentIds.user,
      username: "admin",
      password: "admin123", // En un caso real, esto estaría hasheado
      role: "admin",
      likeMultiplier: 10,
      badges: ["director", "guionista"],
      createdAt: new Date()
    };
    this.users.set(admin.id, admin);
    
    // Moderator user
    const moderator = {
      id: ++this.currentIds.user,
      username: "moderator",
      password: "mod123", // En un caso real, esto estaría hasheado
      role: "moderator",
      likeMultiplier: 5,
      badges: ["dibujante", "animador"],
      createdAt: new Date()
    };
    this.users.set(moderator.id, moderator);
    
    // Regular user
    const regularUser = {
      id: ++this.currentIds.user,
      username: "user",
      password: "user123", // En un caso real, esto estaría hasheado
      role: "user",
      likeMultiplier: 1,
      badges: ["novato"],
      createdAt: new Date()
    };
    this.users.set(regularUser.id, regularUser);
    
    // Sample post
    const post = {
      id: ++this.currentIds.post,
      title: "Bienvenido a Lemmy Clone",
      content: "Este es un post de ejemplo para mostrar la funcionalidad básica.",
      userId: admin.id,
      createdAt: new Date(),
      frozen: false,
      slowModeInterval: 0
    };
    this.posts.set(post.id, post);
    
    // Sample comment
    const comment = {
      id: ++this.currentIds.comment,
      content: "Este es un comentario de ejemplo.",
      userId: moderator.id,
      postId: post.id,
      parentId: null,
      createdAt: new Date()
    };
    this.comments.set(comment.id, comment);
    
    // Sample reply to comment
    const reply = {
      id: ++this.currentIds.comment,
      content: "Esta es una respuesta de ejemplo al comentario anterior.",
      userId: regularUser.id,
      postId: post.id,
      parentId: comment.id,
      createdAt: new Date()
    };
    this.comments.set(reply.id, reply);
    
    // Sample upvote from admin to moderator's comment
    const upvote = {
      id: ++this.currentIds.like,
      userId: admin.id,
      commentId: comment.id,
      postId: null,
      isUpvote: true,
      createdAt: new Date()
    };
    this.likes.set(upvote.id, upvote);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = ++this.currentIds.user;
    
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date(),
      likeMultiplier: 1, // Valor predeterminado para nuevos usuarios
      badges: insertUser.badges || []
    };
    
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, data: UpdateUser): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...data
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getTopUsers(limit: number): Promise<(User & { stats: UserStats })[]> {
    const users = Array.from(this.users.values());
    const usersWithStats: (User & { stats: UserStats })[] = [];
    
    for (const user of users) {
      const stats = await this.getUserStats(user.id);
      usersWithStats.push({ ...user, stats });
    }
    
    return usersWithStats
      .sort((a, b) => b.stats.netScore - a.stats.netScore)
      .slice(0, limit);
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const id = ++this.currentIds.post;
    
    const post: Post = { 
      ...insertPost, 
      id, 
      createdAt: new Date(),
      frozen: false,
      slowModeInterval: 0
    };
    
    this.posts.set(id, post);
    return post;
  }

  async getPost(id: number): Promise<Post | undefined> {
    return this.posts.get(id);
  }

  async getPosts(): Promise<PostWithDetails[]> {
    const posts = Array.from(this.posts.values());
    const postsWithDetails: PostWithDetails[] = [];
    
    for (const post of posts) {
      const user = this.users.get(post.userId);
      
      if (!user) continue;
      
      // Get upvotes and downvotes
      const likes = Array.from(this.likes.values()).filter(
        like => like.postId === post.id
      );
      
      const upvotes = likes.filter(like => like.isUpvote).length;
      const downvotes = likes.filter(like => !like.isUpvote).length;
      
      // Get comments count
      const comments = Array.from(this.comments.values()).filter(
        comment => comment.postId === post.id
      ).length;
      
      // For logged in user, we would check their vote here
      // but since we don't have the logged in user in this context,
      // we'll leave userVote as undefined
      
      postsWithDetails.push({
        ...post,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          badges: user.badges || []
        },
        upvotes,
        downvotes,
        voteScore: upvotes - downvotes,
        comments,
        frozen: post.frozen,
        slowModeInterval: post.slowModeInterval
      });
    }
    
    return postsWithDetails;
  }

  async getTopPosts(limit: number): Promise<PostWithDetails[]> {
    const postsWithDetails = await this.getPosts();
    
    return postsWithDetails
      .sort((a, b) => b.voteScore - a.voteScore)
      .slice(0, limit);
  }

  async updatePost(id: number, data: { frozen?: boolean, slowModeInterval?: number }): Promise<Post | undefined> {
    const post = this.posts.get(id);
    if (!post) return undefined;
    
    const updatedPost: Post = {
      ...post,
      frozen: data.frozen !== undefined ? data.frozen : post.frozen,
      slowModeInterval: data.slowModeInterval !== undefined ? data.slowModeInterval : post.slowModeInterval
    };
    
    this.posts.set(id, updatedPost);
    return updatedPost;
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = ++this.currentIds.comment;
    
    const comment: Comment = { 
      ...insertComment, 
      id, 
      createdAt: new Date() 
    };
    
    this.comments.set(id, comment);
    return comment;
  }

  async getComment(id: number): Promise<Comment | undefined> {
    return this.comments.get(id);
  }

  async getCommentsByPostId(postId: number): Promise<CommentWithUser[]> {
    // Get all comments for this post
    const comments = Array.from(this.comments.values()).filter(
      (comment) => comment.postId === postId
    );
    
    // Build a map of comment IDs to CommentWithUser objects
    const commentMap = new Map<number, CommentWithUser>();
    
    for (const comment of comments) {
      const user = this.users.get(comment.userId);
      if (!user) continue;
      
      // Get upvotes and downvotes for this comment
      const likes = Array.from(this.likes.values()).filter(
        like => like.commentId === comment.id
      );
      
      const upvotes = likes.filter(like => like.isUpvote).length;
      const downvotes = likes.filter(like => !like.isUpvote).length;
      
      // For logged in user, we would check their vote here
      // but since we don't have the logged in user in this context, 
      // we'll leave userVote as undefined
      
      const commentWithUser: CommentWithUser = {
        ...comment,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          likeMultiplier: user.likeMultiplier,
          badges: user.badges || []
        },
        upvotes,
        downvotes,
        voteScore: upvotes - downvotes,
        replies: []
      };
      
      commentMap.set(comment.id, commentWithUser);
    }
    
    // Build the tree structure
    const result: CommentWithUser[] = [];
    
    for (const [id, comment] of commentMap.entries()) {
      if (comment.parentId === null) {
        // This is a root comment
        result.push(comment);
      } else if (commentMap.has(comment.parentId)) {
        // This is a reply to another comment
        const parent = commentMap.get(comment.parentId)!;
        parent.replies = parent.replies || [];
        parent.replies.push(comment);
      }
    }
    
    return result;
  }

  async createLike(insertLike: InsertLike): Promise<Like> {
    const id = ++this.currentIds.like;
    
    const like: Like = { 
      ...insertLike, 
      id, 
      createdAt: new Date() 
    };
    
    this.likes.set(id, like);
    return like;
  }

  async removeLike(userId: number, commentId?: number, postId?: number): Promise<boolean> {
    const likes = Array.from(this.likes.entries());
    
    for (const [id, like] of likes) {
      if (like.userId === userId && 
          (commentId === undefined || like.commentId === commentId) &&
          (postId === undefined || like.postId === postId)) {
        this.likes.delete(id);
        return true;
      }
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
        (commentId === undefined || like.commentId === commentId) &&
        (postId === undefined || like.postId === postId)
    );
  }
  
  async getUserVote(userId: number, commentId?: number, postId?: number): Promise<'upvote' | 'downvote' | null> {
    const like = Array.from(this.likes.values()).find(
      (like) =>
        like.userId === userId &&
        (commentId === undefined || like.commentId === commentId) &&
        (postId === undefined || like.postId === postId)
    );
    
    if (!like) return null;
    
    return like.isUpvote ? 'upvote' : 'downvote';
  }

  async getTopComments(limit: number): Promise<CommentWithUser[]> {
    // Get all comments with their users and vote counts
    const allComments: CommentWithUser[] = [];
    
    for (const comment of this.comments.values()) {
      const user = this.users.get(comment.userId);
      if (!user) continue;
      
      // Get upvotes and downvotes for this comment
      const likes = Array.from(this.likes.values()).filter(
        like => like.commentId === comment.id
      );
      
      const upvotes = likes.filter(like => like.isUpvote).length;
      const downvotes = likes.filter(like => !like.isUpvote).length;
      
      allComments.push({
        ...comment,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          likeMultiplier: user.likeMultiplier,
          badges: user.badges || []
        },
        upvotes,
        downvotes,
        voteScore: upvotes - downvotes,
        replies: []
      });
    }
    
    // Sort by vote score (upvotes - downvotes) and return top N
    return allComments
      .sort((a, b) => b.voteScore - a.voteScore)
      .slice(0, limit);
  }

  async getUserStats(userId: number): Promise<UserStats> {
    const user = await this.getUser(userId);
    if (!user) {
      return {
        postCount: 0,
        commentCount: 0,
        upvotesReceived: 0,
        downvotesReceived: 0,
        netScore: 0
      };
    }
    
    // Count posts by this user
    const postCount = Array.from(this.posts.values()).filter(
      post => post.userId === userId
    ).length;
    
    // Count comments by this user
    const commentCount = Array.from(this.comments.values()).filter(
      comment => comment.userId === userId
    ).length;
    
    // Count upvotes/downvotes received on comments
    const commentIds = Array.from(this.comments.values())
      .filter(comment => comment.userId === userId)
      .map(comment => comment.id);
    
    const commentLikes = Array.from(this.likes.values()).filter(
      like => like.commentId !== null && commentIds.includes(like.commentId!)
    );
    
    const upvotesFromComments = commentLikes.filter(like => like.isUpvote).length;
    const downvotesFromComments = commentLikes.filter(like => !like.isUpvote).length;
    
    // Count upvotes/downvotes received on posts
    const postIds = Array.from(this.posts.values())
      .filter(post => post.userId === userId)
      .map(post => post.id);
    
    const postLikes = Array.from(this.likes.values()).filter(
      like => like.postId !== null && postIds.includes(like.postId!)
    );
    
    const upvotesFromPosts = postLikes.filter(like => like.isUpvote).length;
    const downvotesFromPosts = postLikes.filter(like => !like.isUpvote).length;
    
    // Total upvotes and downvotes
    const upvotesReceived = upvotesFromComments + upvotesFromPosts;
    const downvotesReceived = downvotesFromComments + downvotesFromPosts;
    
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
      upvotes: number,
      downvotes: number,
      isIRL: boolean,
      isHandmade: boolean,
      irlVerifiedBy: string[],
      handmadeVerifiedBy: string[]
    }>();
    
    // Añadir el autor del post si no está ya en el mapa
    const postAuthor = this.users.get(post.userId);
    if (postAuthor) {
      // Obtener verificaciones de este usuario si existen
      const userVerif = postVerificationsMap.get(postAuthor.id);
      
      userMap.set(postAuthor.id, {
        user: postAuthor,
        commentCount: 0,
        upvotes: 0,
        downvotes: 0,
        isIRL: userVerif?.isIRL || false,
        isHandmade: userVerif?.isHandmade || false,
        irlVerifiedBy: userVerif?.irlVerifiedBy || [],
        handmadeVerifiedBy: userVerif?.handmadeVerifiedBy || []
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
            upvotes: 0,
            downvotes: 0,
            isIRL: userVerif?.isIRL || false,
            isHandmade: userVerif?.isHandmade || false,
            irlVerifiedBy: userVerif?.irlVerifiedBy || [],
            handmadeVerifiedBy: userVerif?.handmadeVerifiedBy || []
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
            upvotes: 0,
            downvotes: 0,
            isIRL: userVerif?.isIRL || false,
            isHandmade: userVerif?.isHandmade || false,
            irlVerifiedBy: userVerif?.irlVerifiedBy || [],
            handmadeVerifiedBy: userVerif?.handmadeVerifiedBy || []
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
        upvotes: item.upvotes,
        downvotes: item.downvotes,
        netScore: item.upvotes - item.downvotes,
        isIRL: item.isIRL,
        isHandmade: item.isHandmade,
        irlVerifiedBy: item.irlVerifiedBy,
        handmadeVerifiedBy: item.handmadeVerifiedBy
      } as PostBoardUser;
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
        irlVerifiedBy: [],
        handmadeVerifiedBy: []
      });
    }
    
    const userVerification = postVerifications.get(userId)!;
    
    // Actualizar la verificación correspondiente
    if (verificationType === 'irl') {
      // Verificamos si el usuario ya ha verificado
      const hasVerified = userVerification.irlVerifiedBy.includes(verifiedBy);
      
      if (value && !hasVerified) {
        // Agregar el verificador al array
        userVerification.irlVerifiedBy.push(verifiedBy);
      } else if (!value && hasVerified) {
        // Remover el verificador del array
        userVerification.irlVerifiedBy = userVerification.irlVerifiedBy.filter(v => v !== verifiedBy);
      }
      
      // Actualizar el estado basado en si hay verificadores
      userVerification.isIRL = userVerification.irlVerifiedBy.length > 0;
    } else {
      // Similar para Handmade
      const hasVerified = userVerification.handmadeVerifiedBy.includes(verifiedBy);
      
      if (value && !hasVerified) {
        userVerification.handmadeVerifiedBy.push(verifiedBy);
      } else if (!value && hasVerified) {
        userVerification.handmadeVerifiedBy = userVerification.handmadeVerifiedBy.filter(v => v !== verifiedBy);
      }
      
      userVerification.isHandmade = userVerification.handmadeVerifiedBy.length > 0;
    }
    
    // Guardar las actualizaciones
    postVerifications.set(userId, userVerification);
    this.postVerifications.set(postId, postVerifications);
    
    return true;
  }
}

export const storage = new MemStorage();
