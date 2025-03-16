import { 
  users, posts, comments, likes, 
  type User, type InsertUser, type Post, type InsertPost,
  type Comment, type InsertComment, type Like, type InsertLike,
  type UpdateUser, type CommentWithUser, type PostWithDetails, type UserStats
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
  
  // Comment operations
  createComment(comment: InsertComment): Promise<Comment>;
  getComment(id: number): Promise<Comment | undefined>;
  getCommentsByPostId(postId: number): Promise<CommentWithUser[]>;
  
  // Like operations
  createLike(like: InsertLike): Promise<Like>;
  removeLike(userId: number, commentId?: number, postId?: number): Promise<boolean>;
  getLikesByUserId(userId: number): Promise<Like[]>;
  checkLikeExists(userId: number, commentId?: number, postId?: number): Promise<boolean>;
  
  // Combined operations
  getTopComments(limit: number): Promise<CommentWithUser[]>;
  getUserStats(userId: number): Promise<UserStats>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private posts: Map<number, Post>;
  private comments: Map<number, Comment>;
  private likes: Map<number, Like>;
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
      likeMultiplier: 10
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
    const post: Post = { ...insertPost, id, createdAt: now };
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
        },
        upvotes: postUpvotes,
        downvotes: postDownvotes,
        voteScore: postUpvotes - postDownvotes,
        userVote,
        comments: postComments,
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
}

export const storage = new MemStorage();
