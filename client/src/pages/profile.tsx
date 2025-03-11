import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import Sidebar from "@/components/sidebar";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FileText, MessageSquare, ArrowUp, Calendar, Flame } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { User, UserStats } from "@shared/schema";

interface UserWithStats extends User {
  stats: UserStats;
}

export default function Profile() {
  const { id } = useParams();
  const userId = parseInt(id || "0");
  
  const { data: user, isLoading } = useQuery<UserWithStats>({
    queryKey: [`/api/users/${userId}`],
    enabled: !isNaN(userId),
  });

  if (isNaN(userId)) {
    return (
      <main className="container mx-auto py-6 px-4 flex flex-col md:flex-row gap-6">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Invalid User ID</h1>
            <p className="text-muted-foreground">The user ID provided is not valid.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto py-6 px-4 flex flex-col md:flex-row gap-6">
      <Sidebar />
      
      <div className="flex-1">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p className="mt-4 text-muted-foreground">Loading profile...</p>
          </div>
        ) : user ? (
          <div className="space-y-6">
            <Card className="bg-card">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-full md:w-40 flex flex-col items-center">
                    <Avatar className="h-32 w-32 mb-3">
                      <AvatarFallback className="text-4xl bg-primary/20 text-primary">
                        {user.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <h3 className="font-medium text-lg">{user.username}</h3>
                    
                    {user.role === "admin" && (
                      <Badge className="mt-1 bg-success/20 text-success border-success/30">
                        Admin
                      </Badge>
                    )}
                    
                    {user.role === "moderator" && (
                      <Badge className="mt-1 bg-primary/20 text-primary border-primary/30">
                        Moderator
                      </Badge>
                    )}
                    
                    <div className="flex items-center mt-3 text-success">
                      <Flame className="h-5 w-5 mr-2" />
                      <span className="text-xl font-bold">x{user.likeMultiplier}</span>
                    </div>
                    <span className="text-xs mt-1 text-muted-foreground">
                      Like Multiplier
                    </span>
                  </div>
                  
                  <div className="flex-1 w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <Card className="bg-card/50">
                        <CardContent className="p-4">
                          <h4 className="text-sm text-muted-foreground mb-1">
                            Total Posts
                          </h4>
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 mr-2 text-primary" />
                            <span className="text-2xl font-bold">{user.stats.postCount}</span>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-card/50">
                        <CardContent className="p-4">
                          <h4 className="text-sm text-muted-foreground mb-1">
                            Total Comments
                          </h4>
                          <div className="flex items-center">
                            <MessageSquare className="h-5 w-5 mr-2 text-primary" />
                            <span className="text-2xl font-bold">{user.stats.commentCount}</span>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-card/50">
                        <CardContent className="p-4">
                          <h4 className="text-sm text-muted-foreground mb-1">
                            Likes Received
                          </h4>
                          <div className="flex items-center">
                            <ArrowUp className="h-5 w-5 mr-2 text-success" />
                            <span className="text-2xl font-bold">{user.stats.likesReceived}</span>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-card/50">
                        <CardContent className="p-4">
                          <h4 className="text-sm text-muted-foreground mb-1">
                            Joined
                          </h4>
                          <div className="flex items-center">
                            <Calendar className="h-5 w-5 mr-2 text-primary" />
                            <span className="text-lg">
                              {format(new Date(user.createdAt), "PP")}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    <Card className="bg-card/50">
                      <CardHeader>
                        <CardTitle className="text-lg">About {user.username}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">
                          This user is a {user.role} with a like multiplier of {user.likeMultiplier}.
                          They have made {user.stats.commentCount} comments and created {user.stats.postCount} posts,
                          receiving a total of {user.stats.likesReceived} likes from the community.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-md shadow">
            <h3 className="text-xl font-medium mb-2">User not found</h3>
            <p className="text-muted-foreground">
              The user you're looking for doesn't exist or has been removed.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
