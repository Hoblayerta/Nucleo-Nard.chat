import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSlowMode } from "@/hooks/use-slow-mode";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, PlusCircle, Eye, Lock, Unlock, Clock, AlarmClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { PostWithDetails } from "@shared/schema";
import CreatePostModal from "./create-post-modal";

export default function PostManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { updateSlowModeInterval } = useSlowMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [confirmFreezeId, setConfirmFreezeId] = useState<number | null>(null);
  const [freezeAction, setFreezeAction] = useState<"freeze" | "unfreeze">("freeze");
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 10;
  
  // Estado para el diálogo de modo lento
  const [slowModeDialogOpen, setSlowModeDialogOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [slowModeInterval, setSlowModeInterval] = useState<string>("0");
  
  const { data: allPosts = [], isLoading } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts"],
  });
  
  // Filter posts based on search query
  const filteredPosts = searchQuery 
    ? allPosts.filter(post => 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.user.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allPosts;
  
  // Sort posts by creation date (newest first)
  const sortedPosts = [...filteredPosts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  // Pagination
  const totalPages = Math.ceil(sortedPosts.length / postsPerPage);
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = sortedPosts.slice(indexOfFirstPost, indexOfLastPost);
  
  const freezePostMutation = useMutation({
    mutationFn: async ({ id, frozen }: { id: number, frozen: boolean }) => {
      const res = await apiRequest("PUT", `/api/posts/${id}/freeze`, {
        frozen
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: `Post ${freezeAction === "freeze" ? "frozen" : "unfrozen"}`,
        description: `The post has been ${freezeAction === "freeze" ? "frozen" : "unfrozen"} successfully.`
      });
      setConfirmFreezeId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to ${freezeAction} post. Please try again.`,
        variant: "destructive",
      });
    }
  });

  const handleFreezeToggle = (postId: number, currentStatus: boolean) => {
    setConfirmFreezeId(postId);
    setFreezeAction(currentStatus ? "unfreeze" : "freeze");
  };
  
  const confirmFreezeToggle = () => {
    if (confirmFreezeId !== null) {
      freezePostMutation.mutate({ 
        id: confirmFreezeId, 
        frozen: freezeAction === "freeze"
      });
    }
  };
  
  // Mutación para actualizar el modo lento de un post
  const slowModeMutation = useMutation({
    mutationFn: async ({ id, interval }: { id: number, interval: number }) => {
      const res = await apiRequest("PUT", `/api/posts/${id}/slow-mode`, {
        slowModeInterval: interval
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: "Slow mode updated",
        description: `The slow mode interval has been updated successfully.`
      });
      setSlowModeDialogOpen(false);
      setSelectedPostId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update slow mode interval. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Manejador para abrir el diálogo de modo lento
  const handleSlowModeClick = (postId: number, currentInterval: number) => {
    setSelectedPostId(postId);
    setSlowModeInterval(currentInterval.toString());
    setSlowModeDialogOpen(true);
  };
  
  // Manejador para guardar los cambios de modo lento
  const handleSaveSlowMode = () => {
    if (selectedPostId !== null) {
      const interval = parseInt(slowModeInterval, 10);
      
      if (isNaN(interval) || interval < 0) {
        toast({
          title: "Invalid interval",
          description: "Please enter a valid interval in seconds (0 or greater).",
          variant: "destructive",
        });
        return;
      }
      
      // Actualizar el intervalo en el contexto de SlowMode
      updateSlowModeInterval(interval);
      
      // Enviar la actualización al servidor
      slowModeMutation.mutate({ 
        id: selectedPostId, 
        interval
      });
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Post Management</h2>
          <p className="text-muted-foreground">Manage and moderate all posts in your community.</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search posts..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <Button 
            className="whitespace-nowrap"
            onClick={() => setCreatePostOpen(true)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            New Post
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-muted-foreground">Loading posts...</p>
        </div>
      ) : currentPosts.length > 0 ? (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Stats</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">#{post.id}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {post.title}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {post.user.username}
                        {post.user.role === "admin" && (
                          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                            Admin
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span>{post.voteScore} votes</span>
                        <span>{post.comments} comments</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(post.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        {post.frozen ? (
                          <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                            <Lock className="mr-1 h-3 w-3" />
                            Frozen
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                            <Unlock className="mr-1 h-3 w-3" />
                            Not Frozen
                          </Badge>
                        )}
                        {post.slowModeInterval > 0 ? (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">
                            <Clock className="mr-1 h-3 w-3" />
                            Slow Mode: {post.slowModeInterval}s
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                            <AlarmClock className="mr-1 h-3 w-3" />
                            No Slow Mode
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/posts/${post.id}`, "_blank")}
                          title="View post"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={post.frozen ? "outline" : "ghost"}
                          size="icon"
                          onClick={() => handleFreezeToggle(post.id, post.frozen)}
                          title={post.frozen ? "Unfreeze post" : "Freeze post"}
                          className={post.frozen ? "text-green-600 hover:text-green-700" : "text-red-600 hover:text-red-700"}
                        >
                          {post.frozen ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant={post.slowModeInterval > 0 ? "outline" : "ghost"}
                          size="icon"
                          onClick={() => handleSlowModeClick(post.id, post.slowModeInterval)}
                          title="Configure slow mode"
                          className={post.slowModeInterval > 0 ? "text-yellow-600 hover:text-yellow-700" : "text-blue-600 hover:text-blue-700"}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{indexOfFirstPost + 1}</span> to{" "}
                <span className="font-medium">
                  {Math.min(indexOfLastPost, sortedPosts.length)}
                </span>{" "}
                of <span className="font-medium">{sortedPosts.length}</span> posts
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center border rounded-md py-12">
          <h3 className="text-lg font-medium mb-2">No posts found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery 
              ? "No posts match your search criteria." 
              : "There are no posts in the system yet."}
          </p>
          {searchQuery && (
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear search
            </Button>
          )}
        </div>
      )}
      
      {/* Create Post Modal */}
      {createPostOpen && (
        <CreatePostModal open={createPostOpen} onClose={() => setCreatePostOpen(false)} />
      )}
      
      {/* Freeze/Unfreeze Confirmation Dialog */}
      <AlertDialog open={confirmFreezeId !== null} onOpenChange={(open) => !open && setConfirmFreezeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {freezeAction === "freeze" ? "Freeze Post" : "Unfreeze Post"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {freezeAction === "freeze" 
                ? "Are you sure you want to freeze this post? This will prevent users from adding new comments or votes."
                : "Are you sure you want to unfreeze this post? This will allow users to add comments and votes again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmFreezeToggle}
              className={freezeAction === "freeze" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {freezeAction === "freeze" ? "Freeze" : "Unfreeze"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Slow Mode Configuration Dialog */}
      <Dialog open={slowModeDialogOpen} onOpenChange={setSlowModeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Slow Mode</DialogTitle>
            <DialogDescription>
              Set the time interval (in seconds) that users must wait between comments. Set to 0 to disable slow mode.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <label className="block text-sm font-medium mb-2">Select Interval</label>
            <Select
              value={slowModeInterval}
              onValueChange={setSlowModeInterval}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select interval..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Common intervals</SelectLabel>
                  <SelectItem value="0">No slow mode</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="600">10 minutes</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            
            <p className="mt-2 text-sm text-muted-foreground">
              {slowModeInterval === "0" 
                ? "Users can comment without delay." 
                : `Users must wait ${parseInt(slowModeInterval, 10)} seconds between comments.`}
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlowModeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSlowMode}
              disabled={slowModeMutation.isPending}
              className={parseInt(slowModeInterval, 10) > 0 ? "bg-yellow-600 hover:bg-yellow-700" : ""}
            >
              {slowModeMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}