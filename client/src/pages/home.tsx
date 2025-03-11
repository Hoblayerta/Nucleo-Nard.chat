import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import PostCard from "@/components/post-card";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import CreatePostModal from "@/components/admin/create-post-modal";
import type { PostWithDetails } from "@shared/schema";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const { user, isAdmin } = useAuth();
  const [createPostOpen, setCreatePostOpen] = useState(false);

  const { data: posts = [], isLoading } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts"],
  });

  // Sort posts by created date (newest first)
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <main className="container mx-auto py-6 px-4 flex flex-col md:flex-row gap-6">
      <Sidebar />
      
      <div className="flex-1">
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold">Recent Posts</h1>
            <p className="text-muted-foreground">Active discussions in our community</p>
          </div>
          
          {isAdmin && (
            <Button 
              onClick={() => setCreatePostOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Post
            </Button>
          )}
        </div>
        
        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <p className="mt-4 text-muted-foreground">Loading posts...</p>
            </div>
          ) : sortedPosts.length > 0 ? (
            sortedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          ) : (
            <div className="text-center py-12 bg-card rounded-md shadow">
              <h3 className="text-xl font-medium mb-2">No posts yet</h3>
              <p className="text-muted-foreground">
                {isAdmin
                  ? "Create the first post for your community!"
                  : "Check back later for new content!"}
              </p>
              {isAdmin && (
                <>
                  <Separator className="my-4 mx-auto w-1/2" />
                  <Button 
                    onClick={() => setCreatePostOpen(true)}
                    className="mt-2"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Post
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {isAdmin && createPostOpen && (
        <CreatePostModal open={createPostOpen} onClose={() => setCreatePostOpen(false)} />
      )}
    </main>
  );
}
