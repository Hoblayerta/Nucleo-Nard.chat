import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Image, Link2 } from "lucide-react";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreatePostModal({ open, onClose }: CreatePostModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  
  const createPostMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/posts", {
        title,
        content
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setTitle("");
      setContent("");
      onClose();
      toast({
        title: "Post created",
        description: "Your post has been published successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your post.",
        variant: "destructive",
      });
      return;
    }
    
    if (!content.trim()) {
      toast({
        title: "Content required",
        description: "Please enter content for your post.",
        variant: "destructive",
      });
      return;
    }
    
    createPostMutation.mutate();
  };

  const insertImage = () => {
    const imageUrl = prompt("Enter image URL:");
    if (imageUrl) {
      // Insertamos directamente un elemento HTML de imagen
      const imageHtml = `<img src="${imageUrl}" alt="Image" style="max-width: 100%; margin: 10px 0;" />`;
      setContent(prev => prev + '\n' + imageHtml);
      toast({
        title: "Image added",
        description: "Image has been added to your post."
      });
    }
  };

  const insertLink = () => {
    const linkUrl = prompt("Enter link URL:");
    const linkText = prompt("Enter link text:", "Click here");
    if (linkUrl && linkText) {
      // Insertamos directamente un elemento HTML de enlace
      const linkHtml = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
      setContent(prev => prev + '\n' + linkHtml);
      toast({
        title: "Link added",
        description: "Link has been added to your post."
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Create New Post</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              placeholder="Write an engaging title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="post-content">Description</Label>
            <Textarea
              id="post-content"
              placeholder="Write your post content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 min-h-[200px]"
            />
          </div>
          
          <div>
            <div className="flex flex-wrap gap-2 mt-1">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={insertImage}
              >
                <Image className="h-4 w-4 mr-2" />
                Add Image
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={insertLink}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Add Link
              </Button>
            </div>
          </div>
          
          <DialogFooter className="flex justify-end space-x-2 pt-4">
            <Button
              type="submit"
              disabled={createPostMutation.isPending}
            >
              {createPostMutation.isPending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
