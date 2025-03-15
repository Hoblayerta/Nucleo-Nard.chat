import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUp, Flame, User, Trophy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CommentWithUser } from "@shared/schema";

export default function LeaderboardWidget() {
  const { data: topComments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`${queryKey[0]}?limit=5`, {
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Failed to fetch leaderboard");
      }
      
      return res.json();
    },
  });

  return (
    <div className="bg-card p-4 rounded-md shadow">
      <div className="flex justify-between items-center mb-3 border-b border-border pb-2">
        <div className="flex items-center">
          <Trophy className="h-5 w-5 text-yellow-500 mr-2" />
          <h3 className="font-medium text-lg">Top Comments</h3>
        </div>
        <Link 
          href="/leaderboard" 
          className="text-xs text-primary hover:underline hover:text-primary/80 transition-colors"
        >
          View All
        </Link>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-primary border-t-transparent"></div>
        </div>
      ) : topComments.length > 0 ? (
        <ScrollArea className="max-h-[300px] pr-4 -mr-4">
          <ul className="space-y-3">
            {topComments.map((comment, index) => (
              <li key={comment.id} className="flex items-start gap-2 group">
                <div className="flex-shrink-0 bg-success/20 rounded-md p-1 text-success text-xs">
                  <ArrowUp className="h-3 w-3" /> {comment.likes}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm line-clamp-2 group-hover:text-primary transition-colors">
                    {comment.content}
                  </div>
                  <div className="flex flex-wrap items-center text-xs text-muted-foreground mt-1 gap-2">
                    <span className="flex items-center">
                      <User className="text-primary h-3 w-3 mr-1" />
                      {comment.user.username}
                    </span>
                    <span className="flex items-center">
                      <Flame className="text-yellow-500 h-3 w-3 mr-1" />
                      x{comment.user.likeMultiplier}
                    </span>
                    {index === 0 && (
                      <span className="bg-yellow-500/10 text-yellow-500 text-xs px-1.5 py-0.5 rounded-full">
                        Top comment
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      ) : (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">No comments yet</p>
        </div>
      )}
    </div>
  );
}
