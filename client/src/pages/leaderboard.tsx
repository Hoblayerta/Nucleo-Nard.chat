import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/sidebar";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Trophy, Flame, MessageSquare, User, Users, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CommentWithUser, User as UserType, UserStats, PostWithDetails } from "@shared/schema";

interface UserWithStats extends UserType {
  stats: UserStats;
}

export default function Leaderboard() {
  const { data: topComments = [], isLoading: isLoadingComments } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/leaderboard"],
  });
  
  const { data: topUsers = [], isLoading: isLoadingUsers } = useQuery<UserWithStats[]>({
    queryKey: ["/api/users/top"],
  });
  
  const { data: topPosts = [], isLoading: isLoadingPosts } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts/top"],
  });

  return (
    <main className="container mx-auto py-6 px-4 flex flex-col md:flex-row gap-6">
      <Sidebar />
      
      <div className="flex-1">
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <Trophy className="mr-2 h-6 w-6 text-yellow-500" />
            <h1 className="text-2xl font-bold">Community Leaderboard</h1>
          </div>
          <p className="text-muted-foreground">
            See who's making the biggest impact in our community
          </p>
        </div>
        
        <Tabs defaultValue="comments" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="comments">Top Comments</TabsTrigger>
            <TabsTrigger value="posts">Top Posts</TabsTrigger>
            <TabsTrigger value="users">Top Users</TabsTrigger>
          </TabsList>
          
          <TabsContent value="comments" className="space-y-6">
            {isLoadingComments ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-4 text-muted-foreground">Loading comments leaderboard...</p>
              </div>
            ) : topComments.length > 0 ? (
              topComments.map((comment, index) => (
                <Card key={comment.id} className="bg-card">
                  <CardContent className="p-6">
                    <div className="flex gap-4 items-start">
                      <div className="flex flex-col items-center">
                        <div className="bg-success/20 rounded-md p-2 text-success flex items-center justify-center">
                          <ArrowUp className="h-5 w-5" />
                          <span className="ml-1 font-bold">{comment.voteScore || 0}</span>
                        </div>
                        <span className="text-xs mt-1 text-muted-foreground">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center mb-3">
                          <Avatar className="h-8 w-8 mr-2">
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {comment.user.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/profile/${comment.user.id}`} className="font-medium text-primary hover:underline">
                              {comment.user.username}
                            </Link>
                            
                            {comment.user.role === "admin" && (
                              <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                                Admin
                              </Badge>
                            )}
                            

                            
                            <span className="flex items-center text-xs text-success">
                              <Flame className="h-3 w-3 mr-1" />
                              <span>x{comment.user.likeMultiplier}</span>
                            </span>
                            
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.createdAt), "PP")}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-sm mb-3">{comment.content}</p>
                        
                        <div className="flex items-center text-xs text-muted-foreground">
                          <MessageSquare className="h-4 w-4 mr-1" />
                          <span>From post: "{(comment as any).postTitle || "Discussion thread"}"</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-card">
                <CardContent className="p-6 text-center">
                  <h3 className="text-xl font-medium mb-2">No comments yet</h3>
                  <p className="text-muted-foreground">
                    Be the first to comment on posts and earn your place on the leaderboard!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="posts" className="space-y-6">
            {isLoadingPosts ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-4 text-muted-foreground">Loading top posts...</p>
              </div>
            ) : topPosts.length > 0 ? (
              topPosts.map((post, index) => (
                <Card key={post.id} className="bg-card">
                  <CardContent className="p-6">
                    <div className="flex gap-4 items-start">
                      <div className="flex flex-col items-center">
                        <div className="bg-success/20 rounded-md p-2 text-success flex items-center justify-center">
                          <ArrowUp className="h-5 w-5" />
                          <span className="ml-1 font-bold">{post.voteScore || 0}</span>
                        </div>
                        <span className="text-xs mt-1 text-muted-foreground">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <Link href={`/posts/${post.id}`} className="block">
                          <h3 className="text-xl font-bold mb-2 hover:text-primary">{post.title}</h3>
                        </Link>
                        
                        <div className="flex items-center mb-3">
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarFallback className="bg-primary/20 text-primary text-xs">
                              {post.user.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/profile/${post.user.id}`} className="font-medium text-sm text-primary hover:underline">
                              {post.user.username}
                            </Link>
                            
                            {post.user.role === "admin" && (
                              <Badge variant="outline" className="bg-success/20 text-success border-success/30 text-xs">
                                Admin
                              </Badge>
                            )}
                            

                            
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(post.createdAt), "PP")}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <div className="flex items-center">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            <span>{post.comments} {post.comments === 1 ? 'comment' : 'comments'}</span>
                          </div>
                          <Link href={`/posts/${post.id}`} className="text-primary hover:underline flex items-center">
                            <FileText className="h-4 w-4 mr-1" />
                            View post
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-card">
                <CardContent className="p-6 text-center">
                  <h3 className="text-xl font-medium mb-2">No posts yet</h3>
                  <p className="text-muted-foreground">
                    Be the first to create posts and earn your place on the leaderboard!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="users" className="space-y-6">
            {isLoadingUsers ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-4 text-muted-foreground">Loading users leaderboard...</p>
              </div>
            ) : topUsers.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {topUsers.map((user, index) => (
                  <Card key={user.id} className="bg-card">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                        </div>
                      </div>

                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/20 text-primary text-lg">
                          {user.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/profile/${user.id}`} className="font-medium text-primary hover:underline truncate">
                            {user.username}
                          </Link>
                          
                          {user.role === "admin" && (
                            <Badge variant="outline" className="bg-success/20 text-success border-success/30 text-xs">
                              Admin
                            </Badge>
                          )}
                          

                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center">
                            <ArrowUp className="h-3 w-3 mr-1 text-success" />
                            <span>{user.stats.upvotesReceived || 0} upvotes</span>
                          </div>
                          <div className="flex items-center">
                            <ArrowDown className="h-3 w-3 mr-1 text-destructive" />
                            <span>{user.stats.downvotesReceived || 0} downvotes</span>
                          </div>
                          
                          <div className="flex items-center">
                            <MessageSquare className="h-3 w-3 mr-1 text-primary" />
                            <span>{user.stats.commentCount} comments</span>
                          </div>
                          <div className="flex items-center col-span-2 justify-between">
                            <div className="flex items-center">
                              <Flame className="h-3 w-3 mr-1 text-success" />
                              <span className="font-semibold">x{user.likeMultiplier} vote power</span>
                            </div>
                            <div className="flex items-center">
                              <ArrowUp className="h-3 w-3 mr-1 text-primary" />
                              <ArrowDown className="h-3 w-3 mr-1 text-primary" />
                              <span className="font-semibold">{user.stats.netScore || 0} net score</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card">
                <CardContent className="p-6 text-center">
                  <h3 className="text-xl font-medium mb-2">No active users yet</h3>
                  <p className="text-muted-foreground">
                    Start engaging with the community to build your reputation!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
