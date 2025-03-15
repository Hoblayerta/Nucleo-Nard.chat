import { 
  users, posts, comments, votes, 
  type User, type InsertUser, type Post, type InsertPost,
  type Comment, type InsertComment, type Vote, type InsertVote,
  type UpdateUser, type CommentWithUser, type PostWithDetails, type UserStats,
  type ScoreboardItem
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
  getPostByPermalink(permalink: string): Promise<PostWithDetails | undefined>;
  
  // Comment operations
  createComment(comment: InsertComment): Promise<Comment>;
  getComment(id: number): Promise<Comment | undefined>;
  getCommentsByPostId(postId: number): Promise<CommentWithUser[]>;
  getCommentByPath(postId: number, path: string): Promise<CommentWithUser | undefined>;
  
  // Vote operations
  createVote(vote: InsertVote): Promise<Vote>;
  updateVote(userId: number, value: number, commentId?: number, postId?: number): Promise<boolean>;
  removeVote(userId: number, commentId?: number, postId?: number): Promise<boolean>;
  getVotesByUserId(userId: number): Promise<Vote[]>;
  checkVoteExists(userId: number, commentId?: number, postId?: number): Promise<Vote | undefined>;
  
  // Combined operations
  getTopComments(limit: number): Promise<CommentWithUser[]>;
  getUserStats(userId: number): Promise<UserStats>;
  getScoreboard(limit: number): Promise<ScoreboardItem[]>;
  generatePermalink(type: 'post' | 'comment', id: number, path?: string): Promise<string>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private posts: Map<number, Post>;
  private comments: Map<number, Comment>;
  private votes: Map<number, Vote>;
  private currentIds: {
    user: number;
    post: number;
    comment: number;
    vote: number;
  };

  constructor() {
    this.users = new Map();
    this.posts = new Map();
    this.comments = new Map();
    this.votes = new Map();
    this.currentIds = {
      user: 1,
      post: 1,
      comment: 1,
      vote: 1,
    };
    
    // Create an initial admin user
    this.createUser({
      username: "admin",
      password: "admin123",
      role: "admin",
      likeMultiplier: 10,
      downvoteMultiplier: 5
    });
  }
  
  // Helper method to generate permalink
  async generatePermalink(type: 'post' | 'comment', id: number, path?: string): Promise<string> {
    if (type === 'post') {
      return Promise.resolve(`/post/${id}`);
    } else {
      return Promise.resolve(`/post/${path?.split('.')[0] || ''}/comment/${id}`);
    }
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
      downvoteMultiplier: insertUser.downvoteMultiplier || 1,
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
      ...(data.downvoteMultiplier !== undefined ? { downvoteMultiplier: data.downvoteMultiplier } : {}),
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
    
    // 3. Remove user's votes
    const userVotes = Array.from(this.votes.values())
      .filter(vote => vote.userId === id)
      .map(vote => vote.id);
      
    userVotes.forEach(voteId => {
      this.votes.delete(voteId);
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
    
    // Sort by total score (highest first) and take the specified limit
    return usersWithStats
      .sort((a, b) => b.stats.totalScore - a.stats.totalScore)
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
      imageUrl: insertPost.imageUrl || null,
      linkUrl: insertPost.linkUrl || null
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
      
      // Calculate votes
      const postVotes = Array.from(this.votes.values())
        .filter(vote => vote.postId === post.id);
      
      const upvotes = postVotes
        .filter(vote => vote.value === 1)
        .reduce((total, vote) => {
          const voteUser = this.users.get(vote.userId);
          return total + (voteUser?.likeMultiplier || 1);
        }, 0);
        
      const downvotes = postVotes
        .filter(vote => vote.value === -1)
        .reduce((total, vote) => {
          const voteUser = this.users.get(vote.userId);
          return total + (voteUser?.downvoteMultiplier || 1);
        }, 0);
      
      const postComments = Array.from(this.comments.values())
        .filter(comment => comment.postId === post.id)
        .length;
      
      return {
        ...post,
        user: {
          id: user?.id || 0,
          username: user?.username || "unknown",
          role: user?.role || "user",
        },
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        comments: postComments,
        permalink: await this.generatePermalink('post', post.id),
      };
    }));
  }

  // Comment operations
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = this.currentIds.comment++;
    const now = new Date();
    
    // Calculate path for hierarchical structure
    let path = `${id}`; // Default path (root level comment)
    
    if (insertComment.parentId) {
      // If this is a reply, find the parent and append to its path
      const parent = await this.getComment(insertComment.parentId);
      if (parent) {
        // If parent has a path, use it as prefix
        if (parent.path) {
          // Get current children count for this parent to determine position
          const siblings = Array.from(this.comments.values())
            .filter(c => c.parentId === insertComment.parentId).length;
          
          path = `${parent.path}.${siblings + 1}`;
        } else {
          // If parent doesn't have a path (legacy data), create a new one
          path = `${parent.id}.${id}`;
        }
      }
    }
    
    const comment: Comment = { 
      ...insertComment, 
      id, 
      createdAt: now,
      parentId: insertComment.parentId ?? null,
      path
    };
    
    this.comments.set(id, comment);
    return comment;
  }

  async getComment(id: number): Promise<Comment | undefined> {
    return this.comments.get(id);
  }

  async getCommentsByPostId(postId: number): Promise<CommentWithUser[]> {
    // Get all comments for the post
    const allComments = Array.from(this.comments.values())
      .filter((comment) => comment.postId === postId)
      .map(async (comment, index) => {
        const user = await this.getUser(comment.userId);
        
        // Calculate votes
        const commentVotes = Array.from(this.votes.values())
          .filter((vote) => vote.commentId === comment.id);
        
        const upvotes = commentVotes
          .filter(vote => vote.value === 1)
          .reduce((total, vote) => {
            const voteUser = this.users.get(vote.userId);
            return total + (voteUser?.likeMultiplier || 1);
          }, 0);
          
        const downvotes = commentVotes
          .filter(vote => vote.value === -1)
          .reduce((total, vote) => {
            const voteUser = this.users.get(vote.userId);
            return total + (voteUser?.downvoteMultiplier || 1);
          }, 0);
        
        // Calculate path for improved tree and enumeration
        const path = comment.path || (comment.parentId ? 
          `${comment.parentId}.${index + 1}` : 
          `${index + 1}`);
        
        // Position is useful for enumeration in the UI
        const position = parseInt(path.split('.').pop() || '0');
        
        // Generate permalink for the comment
        const permalink = await this.generatePermalink('comment', comment.id, path);
        
        return {
          ...comment,
          path,
          user: {
            id: user?.id || 0,
            username: user?.username || "unknown",
            role: user?.role || "user",
            likeMultiplier: user?.likeMultiplier || 1,
            downvoteMultiplier: user?.downvoteMultiplier || 1,
          },
          upvotes,
          downvotes,
          score: upvotes - downvotes,
          level: path.split('.').length - 1,
          position,
          permalink,
          replies: [],
        };
      });

    const comments = await Promise.all(allComments);

    // Build comment tree
    const commentMap = new Map<number, CommentWithUser>();
    const rootComments: CommentWithUser[] = [];

    // First pass: Create a map of all comments by ID
    comments.forEach(comment => {
      // Need to preserve the permalink which is required in the CommentWithUser type
      commentMap.set(comment.id, {...comment, replies: [], permalink: comment.permalink});
    });

    // Second pass: Arrange comments into a tree structure with proper ordering
    commentMap.forEach(comment => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(comment);
          // Sort replies by position for consistent enumeration
          parent.replies.sort((a, b) => a.position - b.position);
        } else {
          rootComments.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });
    
    // Sort root comments by position
    rootComments.sort((a, b) => a.position - b.position);

    return rootComments;
  }

  // Vote operations
  async createVote(insertVote: InsertVote): Promise<Vote> {
    const id = this.currentIds.vote++;
    const now = new Date();
    const vote: Vote = { 
      ...insertVote, 
      id, 
      createdAt: now,
      postId: insertVote.postId ?? null,
      commentId: insertVote.commentId ?? null
    };
    this.votes.set(id, vote);
    return vote;
  }
  
  async updateVote(userId: number, value: number, commentId?: number, postId?: number): Promise<boolean> {
    const existingVote = await this.checkVoteExists(userId, commentId, postId);
    if (existingVote) {
      // If the vote value is the same, remove it (toggle behavior)
      if (existingVote.value === value) {
        return this.removeVote(userId, commentId, postId);
      }
      
      // Otherwise, update the value
      const updatedVote = {
        ...existingVote,
        value
      };
      this.votes.set(existingVote.id, updatedVote);
      return true;
    }
    
    // If no vote exists, create a new one
    await this.createVote({
      userId,
      value: value as 1 | -1,
      commentId: commentId ?? undefined,
      postId: postId ?? undefined
    });
    
    return true;
  }

  async removeVote(userId: number, commentId?: number, postId?: number): Promise<boolean> {
    const voteToRemove = Array.from(this.votes.values()).find(
      (vote) => 
        vote.userId === userId && 
        ((commentId && vote.commentId === commentId) || 
         (postId && vote.postId === postId))
    );
    
    if (voteToRemove) {
      this.votes.delete(voteToRemove.id);
      return true;
    }
    
    return false;
  }

  async getVotesByUserId(userId: number): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(
      (vote) => vote.userId === userId
    );
  }

  async checkVoteExists(userId: number, commentId?: number, postId?: number): Promise<Vote | undefined> {
    return Array.from(this.votes.values()).find(
      (vote) => 
        vote.userId === userId && 
        ((commentId && vote.commentId === commentId) || 
         (postId && vote.postId === postId))
    );
  }
  
  // Implementation for getPostByPermalink
  async getPostByPermalink(permalink: string): Promise<PostWithDetails | undefined> {
    const postIdMatch = permalink.match(/\/post\/(\d+)/);
    if (!postIdMatch) return undefined;
    
    const postId = parseInt(postIdMatch[1]);
    if (isNaN(postId)) return undefined;
    
    const post = await this.getPost(postId);
    if (!post) return undefined;
    
    const user = await this.getUser(post.userId);
    
    // Calculate votes
    const votes = Array.from(this.votes.values())
      .filter(vote => vote.postId === post.id);
      
    const upvotes = votes
      .filter(vote => vote.value === 1)
      .reduce((total, vote) => {
        const voteUser = this.users.get(vote.userId);
        return total + (voteUser?.likeMultiplier || 1);
      }, 0);
      
    const downvotes = votes
      .filter(vote => vote.value === -1)
      .reduce((total, vote) => {
        const voteUser = this.users.get(vote.userId);
        return total + (voteUser?.downvoteMultiplier || 1);
      }, 0);
    
    const commentCount = Array.from(this.comments.values())
      .filter(comment => comment.postId === post.id)
      .length;
    
    return {
      ...post,
      user: {
        id: user?.id || 0,
        username: user?.username || "unknown",
        role: user?.role || "user",
      },
      upvotes,
      downvotes,
      score: upvotes - downvotes,
      comments: commentCount,
      permalink: await this.generatePermalink('post', post.id)
    };
  }
  
  // Implementation for getCommentByPath
  async getCommentByPath(postId: number, path: string): Promise<CommentWithUser | undefined> {
    const comments = Array.from(this.comments.values())
      .filter(comment => comment.postId === postId && comment.path === path);
      
    if (comments.length === 0) return undefined;
    
    const comment = comments[0];
    const user = await this.getUser(comment.userId);
    
    // Calculate votes
    const votes = Array.from(this.votes.values())
      .filter(vote => vote.commentId === comment.id);
      
    const upvotes = votes
      .filter(vote => vote.value === 1)
      .reduce((total, vote) => {
        const voteUser = this.users.get(vote.userId);
        return total + (voteUser?.likeMultiplier || 1);
      }, 0);
      
    const downvotes = votes
      .filter(vote => vote.value === -1)
      .reduce((total, vote) => {
        const voteUser = this.users.get(vote.userId);
        return total + (voteUser?.downvoteMultiplier || 1);
      }, 0);
    
    // Generate permalink for the comment
    const permalink = await this.generatePermalink('comment', comment.id, path);
    
    return {
      ...comment,
      user: {
        id: user?.id || 0,
        username: user?.username || "unknown",
        role: user?.role || "user",
        likeMultiplier: user?.likeMultiplier || 1,
        downvoteMultiplier: user?.downvoteMultiplier || 1,
      },
      upvotes,
      downvotes,
      score: upvotes - downvotes,
      level: path.split('.').length - 1,
      position: parseInt(path.split('.').pop() || '0'),
      permalink
    };
  }

  // Combined operations
  async getTopComments(limit: number): Promise<CommentWithUser[]> {
    const comments = Array.from(this.comments.values());
    
    const commentsWithDetails = await Promise.all(
      comments.map(async (comment, index) => {
        const user = await this.getUser(comment.userId);
        
        // Calculate votes with multipliers
        const votes = Array.from(this.votes.values())
          .filter((vote) => vote.commentId === comment.id);
        
        const upvotes = votes
          .filter(vote => vote.value === 1)
          .reduce((total, vote) => {
            const voteUser = this.users.get(vote.userId);
            return total + (voteUser?.likeMultiplier || 1);
          }, 0);
        
        const downvotes = votes
          .filter(vote => vote.value === -1)
          .reduce((total, vote) => {
            const voteUser = this.users.get(vote.userId);
            return total + (voteUser?.downvoteMultiplier || 1);
          }, 0);
        
        // Calculate path and position
        const path = comment.path || `${comment.id}`;
        const position = parseInt(path.split('.').pop() || '0');
        
        // Generate permalink for the comment
        const permalink = await this.generatePermalink('comment', comment.id, path);
        
        return {
          ...comment,
          path,
          user: {
            id: user?.id || 0,
            username: user?.username || "unknown",
            role: user?.role || "user",
            likeMultiplier: user?.likeMultiplier || 1,
            downvoteMultiplier: user?.downvoteMultiplier || 1,
          },
          upvotes,
          downvotes,
          score: upvotes - downvotes,
          level: path.split('.').length - 1,
          position,
          permalink,
          replies: [],
        };
      })
    );
    
    // Sort by score (highest first) and take the specified limit
    return commentsWithDetails
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getUserStats(userId: number): Promise<UserStats> {
    const postCount = Array.from(this.posts.values()).filter(
      (post) => post.userId === userId
    ).length;
    
    const commentCount = Array.from(this.comments.values()).filter(
      (comment) => comment.userId === userId
    ).length;
    
    // Calculate votes received on user's posts and comments
    let upvotesReceived = 0;
    let downvotesReceived = 0;
    
    // Count votes on posts
    const userPosts = Array.from(this.posts.values()).filter(
      (post) => post.userId === userId
    );
    
    userPosts.forEach(post => {
      const postVotes = Array.from(this.votes.values())
        .filter(vote => vote.postId === post.id);
      
      // Count upvotes with multipliers
      upvotesReceived += postVotes
        .filter(vote => vote.value === 1)
        .reduce((total, vote) => {
          const voteUser = this.users.get(vote.userId);
          return total + (voteUser?.likeMultiplier || 1);
        }, 0);
      
      // Count downvotes with multipliers
      downvotesReceived += postVotes
        .filter(vote => vote.value === -1)
        .reduce((total, vote) => {
          const voteUser = this.users.get(vote.userId);
          return total + (voteUser?.downvoteMultiplier || 1);
        }, 0);
    });
    
    // Count votes on comments
    const userComments = Array.from(this.comments.values()).filter(
      (comment) => comment.userId === userId
    );
    
    userComments.forEach(comment => {
      const commentVotes = Array.from(this.votes.values())
        .filter(vote => vote.commentId === comment.id);
      
      // Count upvotes with multipliers
      upvotesReceived += commentVotes
        .filter(vote => vote.value === 1)
        .reduce((total, vote) => {
          const voteUser = this.users.get(vote.userId);
          return total + (voteUser?.likeMultiplier || 1);
        }, 0);
      
      // Count downvotes with multipliers
      downvotesReceived += commentVotes
        .filter(vote => vote.value === -1)
        .reduce((total, vote) => {
          const voteUser = this.users.get(vote.userId);
          return total + (voteUser?.downvoteMultiplier || 1);
        }, 0);
    });
    
    return {
      postCount,
      commentCount,
      upvotesReceived,
      downvotesReceived,
      totalScore: upvotesReceived - downvotesReceived
    };
  }
  
  // Implementation for getScoreboard
  async getScoreboard(limit: number): Promise<ScoreboardItem[]> {
    // Get top voted posts and comments
    const posts = await this.getPosts();
    const allComments = await Promise.all(
      Array.from(this.posts.values()).map(post => 
        this.getCommentsByPostId(post.id)
      )
    );
    
    // Flatten all comments
    const flattenComments: CommentWithUser[] = [];
    allComments.forEach(comments => {
      const addComment = (comment: CommentWithUser) => {
        flattenComments.push(comment);
        if (comment.replies && comment.replies.length > 0) {
          comment.replies.forEach(addComment);
        }
      };
      comments.forEach(addComment);
    });
    
    // Convert posts to scoreboard items
    const postItems: ScoreboardItem[] = posts.map(post => ({
      id: post.id,
      type: 'post',
      title: post.title,
      content: post.content.length > 100 ? post.content.substring(0, 97) + '...' : post.content,
      username: post.user.username,
      score: post.score,
      permalink: post.permalink
    }));
    
    // Convert comments to scoreboard items
    const commentItems: ScoreboardItem[] = flattenComments.map(comment => ({
      id: comment.id,
      type: 'comment',
      content: comment.content.length > 100 ? comment.content.substring(0, 97) + '...' : comment.content,
      username: comment.user.username,
      score: comment.score,
      permalink: comment.permalink
    }));
    
    // Combine and sort by score
    const allItems = [...postItems, ...commentItems]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
      
    return allItems;
  }
}

export const storage = new MemStorage();
