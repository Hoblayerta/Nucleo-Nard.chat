import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CommentTreeView from '@/components/comment-tree-view';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { PostWithDetails } from '@shared/schema';

export default function TreeViewPage() {
  const [location, setLocation] = useLocation();
  const [postId, setPostId] = useState<number | null>(null);
  
  // Extraer postId de la URL
  useEffect(() => {
    const match = location.match(/\/tree\/([0-9]+)/);
    if (match && match[1]) {
      setPostId(Number(match[1]));
    }
  }, [location]);

  // Obtener información del post
  const { data: post, isLoading, error } = useQuery<PostWithDetails>({
    queryKey: [`/api/posts/${postId}`],
    queryFn: async () => {
      if (postId === null) return null;
      const response = await apiRequest(`/api/posts/${postId}`);
      return response.json();
    },
    enabled: postId !== null,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b sticky top-0 z-10 bg-background">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          <Button 
            variant="ghost" 
            onClick={() => setLocation(`/posts/${postId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al post</span>
          </Button>
          
          <div className="flex-1 flex justify-center">
            <h1 className="text-lg font-semibold overflow-hidden text-ellipsis whitespace-nowrap max-w-md">
              {post ? post.title : 'Visualizador de árbol de comentarios'}
            </h1>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        {postId ? (
          <div className="w-full h-[calc(100vh-3.5rem)]">
            <CommentTreeView 
              postId={postId} 
              isStandalone={true} 
              onClose={() => setLocation(`/posts/${postId}`)}
            />
          </div>
        ) : (
          <div className="container py-20 text-center">
            <h2 className="text-xl font-semibold mb-4">No se encontró ningún post</h2>
            <Button onClick={() => setLocation('/')}>Volver al inicio</Button>
          </div>
        )}
      </main>
    </div>
  );
}
