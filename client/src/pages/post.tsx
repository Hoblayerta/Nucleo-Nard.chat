import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSlowMode } from "@/hooks/use-slow-mode";
import { useAuth } from "@/lib/auth";
import CommentThread from "@/components/comment-thread";
import CommentForm from "@/components/comment-form";
import CommentTreeView from "@/components/comment-tree-view";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { BlockchainButton } from "@/components/blockchain-button";
import { WriteContractButton } from "@/components/write-contract-button";
import type { PostWithDetails, CommentWithUser } from "@shared/schema";

export default function Post() {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user, isAdmin, isModerator } = useAuth();
  const [showCommentTree, setShowCommentTree] = useState(false);
  const [splitView, setSplitView] = useState(false); // Para la visualización dividida en móvil

  // Analizamos los parámetros de consulta para obtener el ID del comentario
  const searchParams = new URLSearchParams(window.location.search);
  const commentIdFromURL = searchParams.get('comment');
  const [commentId, setCommentId] = useState<string | null>(commentIdFromURL);

  // Efecto para mostrar un toast cuando hay un comentario en la URL
  useEffect(() => {
    if (commentIdFromURL) {
      toast({
        title: "Navegando al comentario",
        description: "Te estamos llevando al comentario compartido...",
        duration: 3000,
      });

      // Hacer que el resaltado se quite después de un tiempo
      const timer = setTimeout(() => {
        setCommentId(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [commentIdFromURL, toast]);

  const postId = parseInt(params.id || "0", 10);

  const { data: post, isLoading, isError } = useQuery<PostWithDetails>({
    queryKey: [`/api/posts/${postId}`],
    enabled: postId > 0,
  });

  // Obtener los comentarios del post para pasarlos al botón Put On-Chain
  const { data: comments = [] } = useQuery<CommentWithUser[]>({
    queryKey: [`/api/posts/${postId}/comments`],
    enabled: postId > 0,
  });

  useEffect(() => {
    if (isError) {
      toast({
        title: "Error",
        description: "No se pudo cargar el post solicitado.",
        variant: "destructive",
      });

      // Redirigir a home si hay error
      setLocation("/");
    }
  }, [isError, setLocation, toast]);

  if (isLoading || !post) {
    return (
      <div className="container max-w-4xl mx-auto p-4 mt-8">
        <div className="text-center py-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-muted-foreground">Cargando post...</p>
        </div>
      </div>
    );
  }

  // Actualizar el contexto de SlowMode cuando cambie el intervalo
  const { updateSlowModeInterval } = useSlowMode();

  useEffect(() => {
    if (post?.slowModeInterval >= 0) {
      updateSlowModeInterval(post.slowModeInterval);
    }
  }, [post?.slowModeInterval, updateSlowModeInterval]);

  return (
    <div className="container max-w-4xl mx-auto p-4 my-8">
      <article className="bg-card rounded-lg shadow-sm p-6 mb-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-2">{post.title}</h1>

          <div className="flex items-center mb-4">
            <div>
              <span className="font-medium text-primary">
                {post.user.username}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {new Date(post.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>
          
          {/* Botón destacado para guardar en blockchain */}
          <div className="mt-6 flex justify-center">
            <BlockchainButton postId={post.id} />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground mt-6 pt-4 border-t">
          <div className="flex">
            <div className="mr-4 flex items-center">
              <span className="font-medium text-foreground">{post.voteScore || 0}</span>
              <span className="ml-1">votos</span>
            </div>
          </div>

          <div className="flex items-center gap-3">

            {/* Botón Compartir */}
            <button 
              className="flex items-center text-primary hover:text-primary/80 transition"
              onClick={() => {
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(() => {
                  toast({
                    title: "Link copiado!",
                    description: "El enlace del post ha sido copiado al portapapeles.",
                    duration: 3000,
                  });
                });
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              <span>Compartir</span>
            </button>
          </div>
        </div>
      </article>

      {/* Sección especial para blockchain */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-6 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-purple-800 mb-2">Preserva este contenido en la blockchain</h3>
            <p className="text-sm text-purple-700 mb-0">
              Guarda el post y el comentario más votado en Arbitrum Sepolia de forma permanente.
            </p>
          </div>
          <div className="flex gap-2">
            <BlockchainButton postId={post.id} />
            <WriteContractButton />
          </div>
        </div>
      </div>

      {/* Mostrar un aviso si el post está congelado */}
      {post.frozen && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-md" role="alert">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <p className="font-medium">Este post ha sido bloqueado por un administrador.</p>
          </div>
          <p className="text-sm mt-1">No se pueden añadir nuevos comentarios ni votar en este post.</p>
        </div>
      )}

      {/* Barra de estado para el modo lento global si está activo */}
      {post.slowModeInterval > 0 && (
        <div className="mt-4 mb-6 p-3 bg-yellow-50/30 border border-yellow-200/50 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm flex items-center">
              <Clock className="h-4 w-4 mr-2 text-yellow-600" />
              <span>Modo lento: intervalo de {post.slowModeInterval} segundos entre comentarios</span>
            </span>
          </div>
        </div>
      )}

      {/* Sección de formulario de comentario principal - solo si no está congelado */}
      {!post.frozen && (
        <section className="bg-card rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold mb-3">
            Deja un comentario
          </h3>
          <CommentForm 
            postId={post.id} 
          />
        </section>
      )}

      {/* Botón de Árbol de Comentarios (versión destacada) */}
      <div className="bg-card p-4 rounded-lg border-2 border-primary/20 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold mb-1">¡Nueva visualización de árbol de comentarios!</h3>
            <p className="text-sm text-muted-foreground mb-0 md:mb-0">
              Explora los comentarios en un formato visual intuitivo. ¡Pruébalo ahora!
            </p>
          </div>
          <div className="flex gap-3">
            {isMobile ? (
              <Button 
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white gap-2"
                onClick={() => {
                  setSplitView(true);
                  setShowCommentTree(true);
                }}
              >
                <div className="w-5 h-5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 2h6"></path><path d="M5 7v12a3 3 0 0 0 3 3v0"></path><path d="M19 7v12a3 3 0 0 1-3 3v0"></path><path d="M12 22v-5"></path><path d="M5 7H2a10 10 0 0 0 10 10"></path><path d="M19 7h3a10 10 0 0 1-10 10"></path>
                  </svg>
                </div>
                Ver árbol interactivo
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white gap-2"
                  onClick={() => setShowCommentTree(true)}
                >
                  <div className="w-5 h-5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 2h6"></path><path d="M5 7v12a3 3 0 0 0 3 3v0"></path><path d="M19 7v12a3 3 0 0 1-3 3v0"></path><path d="M12 22v-5"></path><path d="M5 7H2a10 10 0 0 0 10 10"></path><path d="M19 7h3a10 10 0 0 1-10 10"></path>
                    </svg>
                  </div>
                  Ver árbol interactivo
                </Button>

                <Button 
                  size="lg"
                  variant="outline"
                  className="gap-2 border-primary text-primary hover:bg-primary/10"
                  onClick={() => window.open(`/tree/${post.id}`, '_blank')}
                >
                  <div className="w-5 h-5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </div>
                  Abrir en nueva pestaña
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interfaz móvil: botones para vista normal o vista dividida */}
      {isMobile && splitView && (
        <div className="flex items-center gap-2 mb-4">
          <Button 
            variant="outline"
            className="flex-1"
            onClick={() => {
              setSplitView(false);
              setShowCommentTree(false);
            }}
          >
            <span className="flex gap-1 items-center justify-center w-full">
              <span>Volver a vista normal</span>
            </span>
          </Button>
        </div>
      )}

      {/* Vista dividida para móvil */}
      {isMobile && splitView ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Árbol de comentarios (lado izquierdo en vista dividida) */}
          <div className="bg-card rounded-lg shadow-sm p-4 h-[50vh] mb-4">
            <h3 className="text-lg font-bold mb-2">Árbol de comentarios</h3>
            <div className="h-[calc(50vh-4rem)] relative overflow-hidden">
              <CommentTreeView 
                postId={post.id} 
                onClose={() => {}}
                onCommentSelect={(commentId) => {
                  console.log("Móvil: Navegando al comentario:", commentId);

                  // Notificar al usuario
                  toast({
                    title: "Navegando al comentario",
                    description: "Buscando el comentario seleccionado...",
                    duration: 2000,
                  });

                  // Desplazarse al comentario seleccionado con reintento
                  const findAndScrollToComment = (retryCount = 0) => {
                    const commentElement = document.getElementById(`comment-${commentId}`);
                    if (commentElement) {
                      // Elemento encontrado, desplazarse y resaltar
                      commentElement.scrollIntoView({ behavior: 'smooth' });
                      commentElement.classList.add('bg-primary/20', 'border-l-4', 'border-primary', 'pl-4');

                      // Quitar el resaltado después de unos segundos
                      setTimeout(() => {
                        commentElement.classList.remove('bg-primary/20', 'border-l-4', 'border-primary', 'pl-4');
                      }, 3000);
                    } else if (retryCount < 5) {
                      // Reintentar hasta 5 veces con incremento de tiempo
                      setTimeout(() => findAndScrollToComment(retryCount + 1), 300 * (retryCount + 1));
                    } else {
                      // No se encontró después de varios intentos
                      toast({
                        title: "No se encontró el comentario",
                        description: "Prueba a expandir los comentarios plegados.",
                        variant: "destructive"
                      });
                    }
                  };

                  // Iniciar búsqueda con un pequeño retraso inicial
                  setTimeout(() => findAndScrollToComment(), 200);
                }}
              />
            </div>
          </div>

          {/* Lista de comentarios (lado derecho en vista dividida) */}
          <div className="bg-card rounded-lg shadow-sm p-4 max-h-[50vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-2">Comentarios</h3>
            <CommentThread 
              postId={post.id} 
              highlightedCommentId={commentId} 
              isFrozen={post.frozen}
              slowModeInterval={post.slowModeInterval}
            />
          </div>
        </div>
      ) : (
        /* Vista normal (escritorio y móvil sin vista dividida) */
        <section className="bg-card rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Comentarios</h3>

            {/* En escritorio, mostramos los botones para abrir la visualización del árbol */}
            {!isMobile && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => setShowCommentTree(true)}
                >
                  <div className="w-4 h-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 2h6"></path><path d="M5 7v12a3 3 0 0 0 3 3v0"></path><path d="M19 7v12a3 3 0 0 1-3 3v0"></path><path d="M12 22v-5"></path><path d="M5 7H2a10 10 0 0 0 10 10"></path><path d="M19 7h3a10 10 0 0 1-10 10"></path>
                    </svg>
                  </div>
                  Ver árbol modal
                </Button>

                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex items-center gap-1 text-primary"
                  onClick={() => window.open(`/tree/${post.id}`, '_blank')}
                >
                  <div className="w-4 h-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </div>
                  Abrir árbol
                </Button>
              </div>
            )}
          </div>

          <div>
            <CommentThread 
              postId={post.id} 
              highlightedCommentId={commentId} 
              isFrozen={post.frozen}
              slowModeInterval={post.slowModeInterval}
            />
            
            {/* Botón blockchain al final de los comentarios */}
            <div className="mt-8 pt-4 border-t flex justify-center gap-2">
              <BlockchainButton postId={post.id} />
              <WriteContractButton />
            </div>
          </div>

          {/* Visualización modal del árbol de comentarios (solo en escritorio) */}
          {!isMobile && showCommentTree && (
            <CommentTreeView 
              postId={post.id} 
              onClose={() => setShowCommentTree(false)}
              onCommentSelect={(commentId) => {
                console.log("Navegando al comentario:", commentId);
                setShowCommentTree(false);

                // Notificar al usuario
                toast({
                  title: "Navegando al comentario",
                  description: "Buscando el comentario seleccionado...",
                  duration: 3000,
                });

                // Desplazarse al comentario seleccionado con reintento
                const findAndScrollToComment = (retryCount = 0) => {
                  const commentElement = document.getElementById(`comment-${commentId}`);
                  if (commentElement) {
                    // Elemento encontrado, desplazarse y resaltar
                    commentElement.scrollIntoView({ behavior: 'smooth' });
                    commentElement.classList.add('bg-primary/20', 'border-l-4', 'border-primary', 'pl-4');

                    // Quitar el resaltado después de unos segundos
                    setTimeout(() => {
                      commentElement.classList.remove('bg-primary/20', 'border-l-4', 'border-primary', 'pl-4');
                    }, 3000);
                  } else if (retryCount < 5) {
                    // Reintentar hasta 5 veces con incremento de tiempo
                    setTimeout(() => findAndScrollToComment(retryCount + 1), 300 * (retryCount + 1));
                  } else {
                    // No se encontró después de varios intentos
                    toast({
                      title: "No se encontró el comentario",
                      description: "El comentario seleccionado no pudo ser localizado en la vista actual.",
                      variant: "destructive"
                    });
                  }
                };

                // Iniciar búsqueda con un pequeño retraso inicial
                setTimeout(() => findAndScrollToComment(), 200);
              }}
            />
          )}
        </section>
      )}
    </div>
  );
}