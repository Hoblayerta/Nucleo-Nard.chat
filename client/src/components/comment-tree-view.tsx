import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { CommentWithUser } from '@shared/schema';
import { X, Minimize2, Maximize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import BadgeIcon from './badge-icon';

interface CommentNode {
  id: number;
  content: string;
  userId: number;
  username: string;
  role: string;
  badges: string[];
  upvotes: number;
  downvotes: number;
  voteScore: number;
  children: CommentNode[];
  level: number;
  x?: number;
  y?: number;
  highlighted?: boolean;
  collapsed?: boolean;
  negativeScore?: boolean;
  isPost?: boolean;
  index?: string; // Added to store index for display
}

interface CommentTreeViewProps {
  postId: number;
  onClose: () => void;
  onCommentSelect?: (commentId: number) => void;
}

const CANVAS_PADDING = 50;
const NODE_RADIUS = 22;
const SMALL_NODE_RADIUS = 14;
const NODE_SPACING_H = 100; // Mayor espaciado horizontal para evitar solapamiento
const NODE_SPACING_V = 100; // Mayor espaciado vertical para una mejor visualización
const LINE_WIDTH = 3; // Líneas más gruesas para mejor visualización
const COLOR_PALETTE = [
  '#1dd1c7', // Cian turquesa (más brillante, como en la imagen)
  '#45deb7', // verde turquesa
  '#2ecc71', // verde
  '#a3e048', // verde lima
  '#f1c40f', // amarillo
  '#e67e22', // naranja
  '#e74c3c', // rojo
  '#e84acf', // magenta
  '#9b59b6', // violeta
  '#7552e0', // púrpura
  '#3498db', // azul
];

export default function CommentTreeView({ postId, onClose, onCommentSelect }: CommentTreeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tree, setTree] = useState<CommentNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<CommentNode | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const [currentDragPosition, setCurrentDragPosition] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const isMobile = useIsMobile();

  // Fetch comments data
  const { data: comments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: [`/api/posts/${postId}/comments`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/posts/${postId}/comments`);
      return res.json();
    },
  });

  const { data: postData } = useQuery({
    queryKey: [`/api/posts/${postId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/posts/${postId}`);
      return res.json();
    },
  });

  // Build the comment tree
  useEffect(() => {
    if (comments.length > 0 && postData) {
      // Convertir comentarios planos a una estructura jerárquica
      const commentMap = new Map<number, CommentNode>();

      // Primera pasada: crear todos los nodos
      comments.forEach(comment => {
        commentMap.set(comment.id, {
          id: comment.id,
          content: comment.content,
          userId: comment.user.id,
          username: comment.user.username,
          role: comment.user.role,
          badges: comment.user.badges,
          upvotes: comment.upvotes,
          downvotes: comment.downvotes,
          voteScore: comment.voteScore,
          children: [],
          level: 0,
          negativeScore: comment.voteScore < 0
        });
      });

      // Segunda pasada: construir la estructura de árbol
      const rootNodes: CommentNode[] = [];

      comments.forEach(comment => {
        const node = commentMap.get(comment.id);
        if (node) {
          if (comment.parentId) {
            const parentNode = commentMap.get(comment.parentId);
            if (parentNode) {
              parentNode.children.push(node);
              node.level = parentNode.level + 1;
            } else {
              // Si no encontramos el padre (puede ser un error), añadirlo como comentario raíz
              rootNodes.push(node);
            }
          } else {
            // Es un comentario de primer nivel
            rootNodes.push(node);
          }
        }
      });

      // Reordenar los comentarios por nivel para mejor visualización
      // Primero los comentarios con más votos
      rootNodes.sort((a, b) => b.voteScore - a.voteScore);
      
      // Ordenar cada nivel de hijos recursivamente
      const sortChildrenByVotes = (node: CommentNode) => {
        if (node.children.length > 0) {
          node.children.sort((a, b) => b.voteScore - a.voteScore);
          node.children.forEach(sortChildrenByVotes);
        }
      };
      
      rootNodes.forEach(sortChildrenByVotes);

      // Crear un nodo raíz para el post
      const postRoot: CommentNode = {
        id: postData.id,
        content: postData.content || postData.title,
        userId: postData.user.id,
        username: postData.user.username,
        role: postData.user.role,
        badges: postData.user.badges || [],
        upvotes: postData.upvotes || 0,
        downvotes: postData.downvotes || 0,
        voteScore: postData.voteScore || 0,
        children: rootNodes,
        level: -1,
        isPost: true  // Marca este nodo como el post principal
      };

      // Calculate best path (canonical path with highest votes)
      markBestPath(postRoot);

      // Calculate positions for all nodes
      calculateNodePositions(postRoot);

      setTree(postRoot);
    }
  }, [comments, postData]);

  // Mark the best path based on vote scores
  function markBestPath(node: CommentNode): number {
    if (node.children.length === 0) return 0;

    // Calculate total score for each child path
    type PathScore = { child: CommentNode, score: number };
    const pathScores: PathScore[] = node.children.map(child => {
      const childPathScore: number = markBestPath(child);
      return { child, score: child.voteScore + childPathScore };
    });

    // Find the best path
    const bestPath: PathScore | undefined = pathScores.reduce((prev: PathScore, current: PathScore): PathScore => 
      current.score > prev.score ? current : prev, pathScores[0]);

    // Mark the child node in the best path
    if (bestPath) {
      bestPath.child.highlighted = true;
    }

    // Return the best path score
    return bestPath ? bestPath.score : 0;
  }

  // Calculate positions for all nodes
  function calculateNodePositions(node: CommentNode, depth = 0, index = 0, siblingCount = 1, xOffset = 0) {
    // Para el nodo raíz (post)
    if (node.level === -1) {
      node.x = 0;
      node.y = 0;
      
      // Posicionar todos los hijos (comentarios de primer nivel)
      let childIndex = 0;
      
      // Primero calculamos cuántos nodos hay en total para mejor distribución
      const totalComments = countTotalNodes(node) - 1; // -1 para excluir el post
      
      // El espacio horizontal debe ser proporcional a la cantidad de comentarios
      // para evitar que se amontonen o queden muy separados
      const spacingMultiplier = Math.min(1.5, Math.max(0.8, 1 - totalComments * 0.01));
      
      node.children.forEach(child => {
        // Espaciamos horizontalmente los comentarios de primer nivel
        // Usamos una distribución más amplia para los comentarios de primer nivel
        const horizontalOffset = (childIndex - (node.children.length - 1) / 2) * 
                                 NODE_SPACING_H * 1.5 * spacingMultiplier;
        
        calculateNodePositions(child, 0, childIndex, node.children.length, horizontalOffset);
        childIndex++;
      });
      
      return;
    }
    
    // Para nodos normales (comentarios)
    // Usamos el desplazamiento para mantener la estructura del árbol
    node.x = xOffset;
    node.y = depth * NODE_SPACING_V;
    
    // Si tiene muchos hijos, los distribuimos horizontalmente
    if (node.children.length > 1) {
      // Calculamos el ancho total que ocuparán los hijos
      // Si hay muchos hijos, reducimos el espaciado para que no queden muy separados
      const spacingFactor = Math.min(1, Math.max(0.5, 1 - (node.children.length * 0.05)));
      const totalWidth = NODE_SPACING_H * spacingFactor * (node.children.length - 1);
      const startX = node.x - totalWidth / 2;
      
      // Posicionar cada hijo con su propio desplazamiento
      node.children.forEach((child, i) => {
        const childX = startX + i * NODE_SPACING_H * spacingFactor;
        calculateNodePositions(child, depth + 1, i, node.children.length, childX);
      });
    } 
    // Si solo tiene un hijo, lo colocamos directamente debajo (alineado)
    else if (node.children.length === 1) {
      calculateNodePositions(node.children[0], depth + 1, 0, 1, node.x);
    }
  }
  
  // Función para contar recursivamente el número total de nodos en el árbol
  function countTotalNodes(node: CommentNode): number {
    if (!node) return 0;
    let count = 1; // Contar este nodo
    
    for (const child of node.children) {
      count += countTotalNodes(child);
    }
    
    return count;
  }

  // Draw the tree on the canvas
  useEffect(() => {
    if (!tree || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update canvas size
    if (containerRef.current) {
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
    }

    // Calculate center offset
    const centerX = canvas.width / 2;
    const centerY = CANVAS_PADDING * 2;

    // Draw the tree (skip the virtual root)
    drawNode(ctx, tree, centerX, centerY);

  }, [tree, offsetX, offsetY, scale, containerRef.current?.clientWidth, containerRef.current?.clientHeight]);

  // Function to draw a node and its connections
  function drawNode(ctx: CanvasRenderingContext2D, node: CommentNode, centerX: number, centerY: number) {
    // Si es el nodo raíz (post), dibujarlo de manera especial
    if (node.level === -1) {
      // Dibujamos el post como raíz visible
      if (node.isPost) {
        // Posición del nodo raíz
        const x = centerX;
        const y = centerY - 40; // Más arriba que los comentarios para mejor visibilidad

        // Dibuja un nodo más grande para el post
        const postRadius = NODE_RADIUS * 1.3;

        // Dibuja circulo para el post
        ctx.beginPath();
        ctx.arc(x, y, postRadius, 0, Math.PI * 2);

        // Estilo especial para el post - usar el color turquesa de la imagen
        ctx.fillStyle = '#1dd1c7'; // Color turquesa brillante
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Borde para el post
        ctx.strokeStyle = '#1dd1c7';
        ctx.lineWidth = LINE_WIDTH;
        ctx.stroke();

        // Guarda las coordenadas reales para poder detectar clics
        node.x = 0;
        node.y = y - centerY;
      }

      // Dibuja todos los comentarios hijos (comentarios de primer nivel)
      node.children.forEach((child, idx) => {
        // Si es un post, conectar los comentarios raíz con el nodo del post
        if (node.isPost) {
          const postX = centerX;
          const postY = centerY - 40;

          const childX = centerX + (child.x || 0) * scale + offsetX;
          const childY = centerY + (child.y || 0) * scale + offsetY;

          // Dibuja la conexión del post a este comentario
          ctx.beginPath();
          ctx.moveTo(postX, postY + NODE_RADIUS * 1.3);

          // Determina si este comentario está en el camino destacado
          const isOnBestPath = child.highlighted;

          // Línea recta (como en la imagen de referencia)
          ctx.strokeStyle = '#1dd1c7'; // Siempre usar el mismo color turquesa para las líneas desde el post
          ctx.lineWidth = LINE_WIDTH;

          // Solo dibuja líneas rectas, no curvas, como en la imagen de referencia
          ctx.lineTo(childX, childY - (child.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS));

          ctx.stroke();
        }

        // Dibuja el comentario y sus hijos
        child.index = `${idx + 1}`;
        drawNode(ctx, child, centerX, centerY);
      });

      return;
    }

    // Calculate final position with offsets and scale
    const x = centerX + (node.x || 0) * scale + offsetX;
    const y = centerY + (node.y || 0) * scale + offsetY;

    // Draw connections to children first (behind nodes)
    node.children.forEach(child => {
      if (child.collapsed) return;

      const childX = centerX + (child.x || 0) * scale + offsetX;
      const childY = centerY + (child.y || 0) * scale + offsetY;

      // Draw line
      ctx.beginPath();
      ctx.moveTo(x, y + (node.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS));

      // Determine if the child is on the best path
      const isOnBestPath = child.highlighted && node.highlighted;

      // Set line color based on level (like in the image)
      ctx.strokeStyle = COLOR_PALETTE[node.level % COLOR_PALETTE.length];

      // Highlight the best path with yellow (como en la imagen)
      if (isOnBestPath) {
        ctx.strokeStyle = '#f1c40f'; // Amarillo para la ruta destacada
      }

      ctx.lineWidth = LINE_WIDTH;

      // Dibujar línea recta en lugar de curva, como en la imagen de referencia
      ctx.lineTo(childX, childY - (child.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS));

      ctx.stroke();
    });

    // Draw all children nodes
    node.children.forEach((child, idx) => {
      if (!child.collapsed) {
        // Asignar índices jerárquicos (1, 1.1, 1.2, etc.)
        child.index = node.index ? `${node.index}.${idx + 1}` : `${idx + 1}`;
        drawNode(ctx, child, centerX, centerY);
      }
    });

    // Draw this node
    const radius = node.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS;

    // Draw circle for node
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    // Fill style based on path status
    if (node.highlighted) {
      // Green for highlighted/canonical path
      ctx.fillStyle = '#2ecc71';
      ctx.strokeStyle = '#27ae60';
    } else {
      // Use color from palette based on level
      const color = COLOR_PALETTE[node.level % COLOR_PALETTE.length];
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
    }

    // Fill with slightly transparent background
    ctx.globalAlpha = 0.2;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Draw outline
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw progress circle showing upvote percentage if any votes exist
    const totalVotes = node.upvotes + node.downvotes;
    if (totalVotes > 0) {
      const upvotePercentage = node.upvotes / totalVotes;

      // Draw progress arc
      ctx.beginPath();
      ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * upvotePercentage));

      // Use color from palette or highlighted color
      ctx.strokeStyle = node.highlighted ? '#27ae60' : COLOR_PALETTE[node.level % COLOR_PALETTE.length];
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Add bookmark icon if this is a selected node
    if (selectedNode && selectedNode.id === node.id) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${radius * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', x, y);
    }

    // Draw the index number
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.index || '', x, y + radius + 2); //added 2 for better spacing
  }

  // Handle click on canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tree || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Calculate center offset
    const centerX = canvas.width / 2;
    const centerY = CANVAS_PADDING * 2;

    // Find clicked node
    const clickedNode = findNodeAtPosition(tree, clickX, clickY, centerX, centerY);

    if (clickedNode) {
      // Handle double click - navigate to comment
      if (e.detail === 2 && onCommentSelect) {
        onCommentSelect(clickedNode.id);
        return;
      }

      // Handle single click - show info
      setSelectedNode(clickedNode);
      setInfoModalOpen(true);

      // Position the modal near the clicked node but within view
      const modalX = Math.min(
        Math.max(CANVAS_PADDING, clickX),
        canvas.width - 300 // Modal width approx
      );

      const modalY = Math.min(
        Math.max(CANVAS_PADDING, clickY),
        canvas.height - 200 // Modal height approx
      );

      setModalPosition({ x: modalX, y: modalY });
    } else {
      // Click on empty space - close info modal
      setInfoModalOpen(false);
      setSelectedNode(null);
    }
  };

  // Handle mouse down for drag and pan
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setStartDragPosition({ x: e.clientX, y: e.clientY });
    setCurrentDragPosition({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move for drag and pan
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    setCurrentDragPosition({ x: e.clientX, y: e.clientY });

    const deltaX = currentDragPosition.x - startDragPosition.x;
    const deltaY = currentDragPosition.y - startDragPosition.y;

    setOffsetX(offsetX + deltaX);
    setOffsetY(offsetY + deltaY);

    setStartDragPosition({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse up to end dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setStartDragPosition({ 
        x: e.touches[0].clientX, 
        y: e.touches[0].clientY 
      });
      setCurrentDragPosition({ 
        x: e.touches[0].clientX, 
        y: e.touches[0].clientY 
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length !== 1) return;

    setCurrentDragPosition({ 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY 
    });

    const deltaX = currentDragPosition.x - startDragPosition.x;
    const deltaY = currentDragPosition.y - startDragPosition.y;

    setOffsetX(offsetX + deltaX);
    setOffsetY(offsetY + deltaY);

    setStartDragPosition({ 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY 
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Find node at clicked position
  function findNodeAtPosition(
    node: CommentNode, 
    clickX: number, 
    clickY: number, 
    centerX: number, 
    centerY: number
  ): CommentNode | null {
    // Si es nodo raíz (post), verificar si el clic es en el post
    if (node.level === -1) {
      // Si es un post, comprobar si se hizo clic en él
      if (node.isPost) {
        // Calcular posición del nodo del post (debe coincidir con la posición en drawNode)
        const postX = centerX;
        const postY = centerY - 40; // Misma posición que en el drawNode del post
        const postRadius = NODE_RADIUS * 1.3; // Mismo radio que en el drawNode del post

        // Comprobar si el clic está dentro del nodo del post
        const distanceSquared = Math.pow(clickX - postX, 2) + Math.pow(clickY - postY, 2);
        if (distanceSquared <= Math.pow(postRadius, 2)) {
          return node;
        }
      }

      // Verificar clics en los comentarios hijos
      for (const child of node.children) {
        const foundNode = findNodeAtPosition(child, clickX, clickY, centerX, centerY);
        if (foundNode) return foundNode;
      }
      return null;
    }

    // Calculate node position with offsets and scale
    const x = centerX + (node.x || 0) * scale + offsetX;
    const y = centerY + (node.y || 0) * scale + offsetY;
    const radius = node.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS;

    // Check if click is within this node
    const distanceSquared = Math.pow(clickX - x, 2) + Math.pow(clickY - y, 2);
    if (distanceSquared <= Math.pow(radius, 2)) {
      return node;
    }

    // Check all children
    if (!node.collapsed) {
      for (const child of node.children) {
        const foundNode = findNodeAtPosition(child, clickX, clickY, centerX, centerY);
        if (foundNode) return foundNode;
      }
    }

    return null;
  }

  // Format the vote display
  const formatVotes = (upvotes: number, downvotes: number, score: number) => {
    return (
      <div className="flex flex-col items-center gap-1 text-sm">
        <div className="flex gap-2">
          <span className="text-green-500">+{upvotes}</span>
          <span className="text-red-500">-{downvotes}</span>
        </div>
        <span className={`font-medium ${score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {score}
        </span>
      </div>
    );
  };

  // Zoom in function
  const handleZoomIn = () => {
    setScale(Math.min(scale + 0.1, 2));
  };

  // Zoom out function
  const handleZoomOut = () => {
    setScale(Math.max(scale - 0.1, 0.5));
  };

  // Reset view
  const handleResetView = () => {
    setOffsetX(0);
    setOffsetY(0);
    setScale(1);
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  // Verificamos si el componente se está mostrando como modal completo o integrado
  const isModal = !!onClose;

  // Para la visualización integrada (no modal)
  if (!isModal) {
    return (
      <div ref={containerRef} className="w-full h-full relative">
        {/* Mini controles para la vista integrada */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button variant="outline" size="icon" className="h-6 w-6 p-0" onClick={handleZoomIn}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="icon" className="h-6 w-6 p-0" onClick={handleZoomOut}>
            <ZoomOut className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="icon" className="h-6 w-6 p-0" onClick={handleResetView}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>

        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="w-full h-full">
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-grab active:cursor-grabbing"
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />

            {/* Información del nodo seleccionado (versión compacta) */}
            {selectedNode && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-card/95 backdrop-blur-sm shadow-md rounded-md p-2 max-w-[90%] z-10">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-semibold text-sm">{selectedNode.username}</span>
                  {selectedNode.role === 'admin' && (
                    <Badge className="text-xs bg-red-100 text-red-800 px-1.5 py-0">Admin</Badge>
                  )}
                  {selectedNode.role === 'moderator' && (
                    <Badge className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0">Mod</Badge>
                  )}
                </div>
                <p className="text-xs line-clamp-2">{selectedNode.content}</p>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <div>
                    Votos: <span className={selectedNode.voteScore > 0 ? 'text-green-600' : (selectedNode.voteScore < 0 ? 'text-red-600' : '')}>
                      {selectedNode.voteScore}
                    </span>
                  </div>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-xs p-0 h-auto text-primary"
                    onClick={() => onCommentSelect && onCommentSelect(selectedNode.id)}
                  >
                    Ver comentario
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Para la visualización modal
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm" 
      onClick={() => {
        if (infoModalOpen) {
          setInfoModalOpen(false);
          setSelectedNode(null);
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between w-full p-4 border-b">
        <h3 className="text-lg font-medium">Visualización de Árbol de Comentarios</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-16 left-4 z-10 flex flex-col gap-2">
        <Button variant="outline" size="icon" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleResetView}>
          <RotateCcw className="h-4 w-4 mr-1" />
          <span>Reset</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          <span className="ml-2">Cargando comentarios...</span>
        </div>
      ) : (
        <div className={`h-[calc(100vh-${fullscreen ? '4rem' : '5rem'})] w-full overflow-hidden`}>
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-grab active:cursor-grabbing"
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>
      )}

      {/* Node info modal */}
      {infoModalOpen && selectedNode && (
        <div 
          className="absolute bg-card border shadow-lg rounded-lg p-4 z-20 w-[300px]"
          style={{
            left: modalPosition.x,
            top: modalPosition.y
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold">{selectedNode.username}</span>
                {selectedNode.role === 'admin' && (
                  <Badge variant="destructive" className="text-xs">Admin</Badge>
                )}
                {selectedNode.role === 'moderator' && (
                  <Badge variant="default" className="text-xs">Mod</Badge>
                )}
              </div>

              {selectedNode.badges.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedNode.badges.map(badge => (
                    <TooltipProvider key={badge}>
                      <Tooltip>
                        <TooltipTrigger>
                          <BadgeIcon badge={badge} size={16} />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{badge}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}
            </div>

            {formatVotes(selectedNode.upvotes, selectedNode.downvotes, selectedNode.voteScore)}
          </div>

          <div className="border-t border-b py-2 my-2">
            <p className="text-sm line-clamp-4">{selectedNode.content}</p>
          </div>

          <div className="flex justify-between items-center mt-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setInfoModalOpen(false);
                setSelectedNode(null);
              }}
            >
              Cerrar
            </Button>

            <Button 
              variant="default" 
              size="sm"
              onClick={() => {
                if (onCommentSelect) {
                  onCommentSelect(selectedNode.id);
                }
              }}
            >
              Ver Comentario
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-card border rounded-lg p-3 shadow-lg">
        <div className="text-xs font-medium mb-2">Leyenda:</div>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs">Ruta canónica (más votos)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 opacity-20 border border-blue-500"></div>
            <span className="text-xs">Comentario normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 opacity-20 border border-blue-500"></div>
            <span className="text-xs">Comentario negativo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-green-500 border-r-transparent"></div>
            <span className="text-xs">Progreso de votos positivos</span>
          </div>
        </div>
      </div>
        </div>
  );
}