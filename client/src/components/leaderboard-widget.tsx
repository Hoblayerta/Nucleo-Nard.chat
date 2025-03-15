import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUp, Flame, User } from "lucide-react";
import type { CommentWithUser } from "@shared/schema";

export default function LeaderboardWidget() {
  const { data: topComments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`${queryKey[0]}?limit=3`, {
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
        <h3 className="font-medium text-lg">Top Comments</h3>
        <Link href="/leaderboard" className="text-xs text-primary hover:underline">
          View All
        </Link>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-primary border-t-transparent"></div>
        </div>
      ) : topComments.length > 0 ? (
        <ul className="space-y-3">
          {topComments.map((comment) => (
            <li key={comment.id} className="flex items-start gap-2">
              <div className="bg-success/20 rounded-md p-1 text-success text-xs">
                <ArrowUp className="h-3 w-3" /> {comment.likes}
              </div>
              <div>
                <div className="text-sm line-clamp-2">{comment.content}</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <span className="flex items-center">
                    <User className="text-primary h-3 w-3 mr-1" />
                    {comment.user.username}
                  </span>
                  <span className="mx-2">•</span>
                  <span className="flex items-center">
                    <Flame className="text-yellow-500 h-3 w-3 mr-1" />
                    x{comment.user.likeMultiplier}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">No comments yet</p>
        </div>
      )}
    </div>
  );
}
