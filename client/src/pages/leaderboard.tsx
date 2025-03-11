import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/sidebar";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, Trophy, Flame, MessageSquare } from "lucide-react";
import type { CommentWithUser } from "@shared/schema";

export default function Leaderboard() {
  const { data: topComments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/leaderboard"],
  });

  return (
    <main className="container mx-auto py-6 px-4 flex flex-col md:flex-row gap-6">
      <Sidebar />
      
      <div className="flex-1">
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <Trophy className="mr-2 h-6 w-6 text-yellow-500" />
            <h1 className="text-2xl font-bold">Top Comments Leaderboard</h1>
          </div>
          <p className="text-muted-foreground">
            The most appreciated comments across our community
          </p>
        </div>
        
        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <p className="mt-4 text-muted-foreground">Loading leaderboard...</p>
            </div>
          ) : topComments.length > 0 ? (
            topComments.map((comment, index) => (
              <Card key={comment.id} className="bg-card">
                <CardContent className="p-6">
                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center">
                      <div className="bg-success/20 rounded-md p-2 text-success flex items-center justify-center">
                        <ArrowUp className="h-5 w-5" />
                        <span className="ml-1 font-bold">{comment.likes}</span>
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
                          
                          {comment.user.role === "moderator" && (
                            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                              Mod
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
        </div>
      </div>
    </main>
  );
}
