import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, MessageSquare, ArrowUp, Calendar, Shield, Flame, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User, UserStats } from "@shared/schema";

interface UserWithStats extends User {
  stats: UserStats;
}

interface ProfileModalProps {
  userId: number;
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ userId, open, onClose }: ProfileModalProps) {
  const { data: user, isLoading } = useQuery<UserWithStats>({
    queryKey: [`/api/users/${userId}`],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">User Profile</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p className="mt-4 text-muted-foreground">Loading profile...</p>
          </div>
        ) : user ? (
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
                  <Shield className="h-3 w-3 mr-1" /> Admin
                </Badge>
              )}
              
              {user.role === "moderator" && (
                <Badge className="mt-1 bg-primary/20 text-primary border-primary/30">
                  <Shield className="h-3 w-3 mr-1" /> Moderator
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
                <div className="bg-background p-4 rounded-md">
                  <h4 className="text-sm text-muted-foreground mb-1">
                    Total Posts
                  </h4>
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-primary" />
                    <span className="text-2xl font-bold">{user.stats.postCount}</span>
                  </div>
                </div>
                
                <div className="bg-background p-4 rounded-md">
                  <h4 className="text-sm text-muted-foreground mb-1">
                    Total Comments
                  </h4>
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2 text-primary" />
                    <span className="text-2xl font-bold">{user.stats.commentCount}</span>
                  </div>
                </div>
                
                <div className="bg-background p-4 rounded-md">
                  <h4 className="text-sm text-muted-foreground mb-1">
                    Likes Received
                  </h4>
                  <div className="flex items-center">
                    <ArrowUp className="h-5 w-5 mr-2 text-success" />
                    <span className="text-2xl font-bold">{user.stats.likesReceived}</span>
                  </div>
                </div>
                
                <div className="bg-background p-4 rounded-md">
                  <h4 className="text-sm text-muted-foreground mb-1">
                    Joined
                  </h4>
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-primary" />
                    <span className="text-lg">
                      {format(new Date(user.createdAt), "PP")}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-background p-4 rounded-md">
                <h4 className="font-medium mb-3">Recent Activity</h4>
                <div className="space-y-3">
                  {user.stats.postCount > 0 || user.stats.commentCount > 0 ? (
                    <>
                      {user.stats.postCount > 0 && (
                        <div className="flex items-start gap-2 pb-2 border-b border-border">
                          <FileText className="h-4 w-4 text-primary mt-1" />
                          <div>
                            <p className="text-sm">
                              Has created {user.stats.postCount} post{user.stats.postCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {user.stats.commentCount > 0 && (
                        <div className="flex items-start gap-2 pb-2 border-b border-border">
                          <MessageSquare className="h-4 w-4 text-primary mt-1" />
                          <div>
                            <p className="text-sm">
                              Has made {user.stats.commentCount} comment{user.stats.commentCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {user.stats.likesReceived > 0 && (
                        <div className="flex items-start gap-2">
                          <ArrowUp className="h-4 w-4 text-success mt-1" />
                          <div>
                            <p className="text-sm">
                              Received {user.stats.likesReceived} like{user.stats.likesReceived !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-xl font-medium mb-2">User not found</h3>
            <p className="text-muted-foreground">
              The user you're looking for doesn't exist or has been removed.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
