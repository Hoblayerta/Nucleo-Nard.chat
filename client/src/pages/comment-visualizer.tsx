import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Save, Download } from 'lucide-react';
import type { Post, CommentWithUser } from '@shared/schema';
import BadgeIcon from '@/components/badge-icon';

// Tipo de nodo para la visualización
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
  index?: string;
  selected?: boolean;
}

export default function CommentVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [tree, setTree] = useState<CommentNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<CommentNode | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const [currentDragPosition, setCurrentDragPosition] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  
  const { toast } = useToast();

  // Constantes para la visualización
  const NODE_RADIUS = 25;
  const SMALL_NODE_RADIUS = 18;
  const NODE_SPACING_H = 140;
  const NODE_SPACING_V = 180;
  const LINE_WIDTH = 2.5;
  const CANVAS_PADDING = 60;
  const COLOR_PALETTE = [
    '#37c6ee', // Azul cian
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

  // Cargar lista de posts
  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/posts");
      return res.json();
    },
  });

  // Cargar comentarios para el post seleccionado
  const { data: comments = [], isLoading: isLoadingComments } = useQuery<CommentWithUser[]>({
    queryKey: [`/api/posts/${selectedPostId}/comments`, selectedPostId],
    queryFn: async () => {
      if (!selectedPostId) return [];
      const res = await apiRequest("GET", `/api/posts/${selectedPostId}/comments`);
      return res.json();
    },
    enabled: !!selectedPostId,
  });

  // Cargar datos del post seleccionado
  const { data: postData } = useQuery({
    queryKey: [`/api/posts/${selectedPostId}`, selectedPostId],
    queryFn: async () => {
      if (!selectedPostId) return null;
      const res = await apiRequest("GET", `/api/posts/${selectedPostId}`);
      return res.json();
    },
    enabled: !!selectedPostId,
  });

  // Construir árbol de comentarios cuando cambian los datos
  useEffect(() => {
    if (postData && selectedPostId) {
      // Convertir todos los comentarios en un árbol jerárquico
      const commentMap = new Map<number, CommentNode>();
      
      // Primera pasada: crear nodos para todos los comentarios
      const processCommentsRecursively = (commentList: CommentWithUser[]) => {
        commentList.forEach(comment => {
          const commentNode: CommentNode = {
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
          };
          
          commentMap.set(comment.id, commentNode);
          
          if (comment.replies && comment.replies.length > 0) {
            processCommentsRecursively(comment.replies);
          }
        });
      };
      
      processCommentsRecursively(comments);
      
      // Segunda pasada: construir la estructura jerárquica
      const rootNodes: CommentNode[] = [];
      
      const buildHierarchy = (commentList: CommentWithUser[]) => {
        commentList.forEach(comment => {
          const node = commentMap.get(comment.id);
          if (!node) return;
          
          if (comment.parentId) {
            // Es una respuesta a otro comentario
            const parentNode = commentMap.get(comment.parentId);
            if (parentNode) {
              parentNode.children.push(node);
              node.level = parentNode.level + 1;
            } else {
              rootNodes.push(node);
            }
          } else {
            // Es un comentario de primer nivel
            rootNodes.push(node);
          }
          
          if (comment.replies && comment.replies.length > 0) {
            buildHierarchy(comment.replies);
          }
        });
      };
      
      buildHierarchy(comments);

      // Ordenar comentarios por votos
      rootNodes.sort((a, b) => b.voteScore - a.voteScore);
      
      // Ordenar cada nivel de hijos recursivamente
      const sortChildrenByVotes = (node: CommentNode) => {
        if (node.children.length > 0) {
          node.children.sort((a, b) => b.voteScore - a.voteScore);
          node.children.forEach(sortChildrenByVotes);
        }
      };
      
      rootNodes.forEach(sortChildrenByVotes);

      // Crear nodo raíz para el post
      const postRoot: CommentNode = {
        id: postData.id,
        content: postData.title || postData.content,
        userId: postData.user.id,
        username: postData.user.username || "unknown",
        role: postData.user.role || "user",
        badges: postData.user.badges || [],
        upvotes: postData.upvotes || 0,
        downvotes: postData.downvotes || 0,
        voteScore: (postData.upvotes || 0) - (postData.downvotes || 0),
        children: rootNodes,
        level: -1,
        isPost: true
      };

      // Marcar mejor camino basado en votos
      markBestPath(postRoot);

      // Calcular posiciones para todos los nodos
      calculateNodePositions(postRoot);

      setTree(postRoot);
      // Resetear vista al cambiar el post
      setOffsetX(0);
      setOffsetY(0);
      setScale(1.0);
    }
  }, [comments, postData, selectedPostId]);

  // Marcar el mejor camino basado en puntuaciones de votos
  function markBestPath(node: CommentNode): number {
    if (node.children.length === 0) return 0;

    // Calcular puntuación total para cada camino hijo
    type PathScore = { child: CommentNode, score: number };
    const pathScores: PathScore[] = node.children.map(child => {
      const childPathScore: number = markBestPath(child);
      return { child, score: child.voteScore + childPathScore };
    });

    // Encontrar el mejor camino
    const bestPath: PathScore | undefined = pathScores.reduce(
      (prev: PathScore, current: PathScore): PathScore => 
        current.score > prev.score ? current : prev, 
      pathScores[0]
    );

    // Marcar el nodo hijo en el mejor camino
    if (bestPath) {
      bestPath.child.highlighted = true;
    }

    return bestPath ? bestPath.score : 0;
  }

  // Calcular posiciones para todos los nodos
  function calculateNodePositions(node: CommentNode, depth = 0, index = 0, siblingCount = 1, xOffset = 0) {
    // Para el nodo raíz (post)
    if (node.level === -1) {
      node.x = 0;
      node.y = 0;
      
      // Posicionar todos los hijos (comentarios de primer nivel)
      let childIndex = 0;
      
      // Calcular total de nodos para mejor distribución
      const totalComments = countTotalNodes(node) - 1; // -1 para excluir el post
      const spacingMultiplier = Math.min(2.2, Math.max(1.0, 1.2 - totalComments * 0.008));
      
      if (node.children.length === 0) {
        // Sin comentarios, solo mostrar el nodo raíz
        node.x = 0;
        node.y = 0;
        return;
      }
      
      node.children.forEach(child => {
        // Espaciado horizontal para comentarios de primer nivel
        const horizontalOffset = (childIndex - (node.children.length - 1) / 2) * 
                              NODE_SPACING_H * 2.0 * spacingMultiplier;
        
        calculateNodePositions(child, 0, childIndex, node.children.length, horizontalOffset);
        childIndex++;
      });
      
      return;
    }
    
    // Para nodos normales (comentarios)
    node.x = xOffset;
    node.y = depth * NODE_SPACING_V;
    
    // Si tiene muchos hijos, distribuirlos horizontalmente
    if (node.children.length > 1) {
      // Calcular ancho total para los hijos
      const spacingFactor = Math.min(1.2, Math.max(0.7, 1.1 - (node.children.length * 0.04)));
      const totalWidth = NODE_SPACING_H * spacingFactor * (node.children.length - 1);
      const startX = node.x - totalWidth / 2;
      
      // Posicionar cada hijo
      node.children.forEach((child, i) => {
        const childX = startX + i * NODE_SPACING_H * spacingFactor;
        calculateNodePositions(child, depth + 1, i, node.children.length, childX);
      });
    } else if (node.children.length === 1) {
      // Si solo tiene un hijo, alinearlo directamente debajo
      calculateNodePositions(node.children[0], depth + 1, 0, 1, node.x);
    }
  }
  
  // Contar total de nodos en el árbol
  function countTotalNodes(node: CommentNode): number {
    if (!node) return 0;
    let count = 1; // Contar este nodo
    
    for (const child of node.children) {
      count += countTotalNodes(child);
    }
    
    return count;
  }

  // Dibujar el árbol en el canvas
  useEffect(() => {
    if (!tree || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Actualizar tamaño del canvas
    if (containerRef.current) {
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
    }

    // Calcular offset del centro
    const centerX = canvas.width / 2;
    const centerY = CANVAS_PADDING * 2;

    // Dibujar el árbol
    drawTree(ctx, tree, centerX, centerY);

    // Si no hay comentarios, mostrar mensaje
    if (tree.children.length === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No hay comentarios aún', centerX, centerY + 60);
    }

    // Dibujar leyenda
    drawLegend(ctx, canvas);
  }, [tree, offsetX, offsetY, scale, fullscreen]);

  // Dibujar el árbol completo
  function drawTree(ctx: CanvasRenderingContext2D, node: CommentNode, centerX: number, centerY: number) {
    // Primero dibujamos las conexiones
    drawNodeConnections(ctx, node, centerX, centerY);
    
    // Luego dibujamos los nodos encima de las conexiones
    drawNodes(ctx, node, centerX, centerY);
  }

  // Dibujar todas las conexiones primero
  function drawNodeConnections(ctx: CanvasRenderingContext2D, node: CommentNode, centerX: number, centerY: number) {
    // Para el nodo raíz (post)
    if (node.level === -1) {
      // Dibujar líneas desde el post a cada comentario de primer nivel
      const postX = centerX; 
      const postY = centerY - 40; // Posición Y ajustada para el post
      
      node.children.forEach(child => {
        // Posición del hijo con escala y offset
        const childX = centerX + (child.x || 0) * scale + offsetX;
        const childY = centerY + (child.y || 0) * scale + offsetY;
        
        // Dibujar línea curva desde el post al comentario
        ctx.beginPath();
        ctx.strokeStyle = COLOR_PALETTE[0]; // Color para el primer nivel
        ctx.lineWidth = LINE_WIDTH;
        
        // Línea curva (bezier)
        const controlPointX = (postX + childX) / 2;
        const controlPointY = postY + (childY - postY) / 3;
        
        ctx.moveTo(postX, postY + 40); // Empezar desde abajo del nodo del post
        ctx.bezierCurveTo(
          controlPointX, controlPointY,
          controlPointX, childY - 30,
          childX, childY - NODE_RADIUS // Terminar en el nodo hijo
        );
        
        ctx.stroke();
      });
      
      // Dibujar conexiones para todos los hijos recursivamente
      node.children.forEach(child => {
        drawNodeConnections(ctx, child, centerX, centerY);
      });
      
      return;
    }
    
    // Para nodos normales (comentarios)
    // Si está colapsado, no mostrar conexiones a los hijos
    if (node.collapsed) return;
    
    // Posición del nodo actual
    const nodeX = centerX + (node.x || 0) * scale + offsetX;
    const nodeY = centerY + (node.y || 0) * scale + offsetY;
    
    // Dibujar conexiones a los hijos
    node.children.forEach(child => {
      // Posición del hijo
      const childX = centerX + (child.x || 0) * scale + offsetX;
      const childY = centerY + (child.y || 0) * scale + offsetY;
      
      // Color según nivel, con ciclo
      const colorIndex = (child.level % COLOR_PALETTE.length);
      ctx.beginPath();
      ctx.strokeStyle = COLOR_PALETTE[colorIndex];
      ctx.lineWidth = LINE_WIDTH;
      
      // Línea curva (bezier)
      const controlPointX = (nodeX + childX) / 2;
      const controlPointY = nodeY + (childY - nodeY) / 3;
      
      ctx.moveTo(nodeX, nodeY + NODE_RADIUS); // Empezar desde abajo del nodo padre
      ctx.bezierCurveTo(
        controlPointX, controlPointY,
        controlPointX, childY - 30,
        childX, childY - NODE_RADIUS // Terminar en el nodo hijo
      );
      
      ctx.stroke();
      
      // Recursivamente dibujar conexiones para todos los hijos
      drawNodeConnections(ctx, child, centerX, centerY);
    });
  }

  // Dibujar todos los nodos después de las conexiones
  function drawNodes(ctx: CanvasRenderingContext2D, node: CommentNode, centerX: number, centerY: number) {
    // Para el nodo raíz (post)
    if (node.level === -1) {
      // Dibujar nodo del post
      const postX = centerX;
      const postY = centerY - 40;
      const postRadius = NODE_RADIUS * 1.3; // Post ligeramente más grande
      
      // Círculo para el post
      ctx.beginPath();
      ctx.arc(postX, postY, postRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#3498db'; // Azul para el post
      ctx.fill();
      ctx.strokeStyle = '#2980b9';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Texto del post (título truncado)
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const title = postData?.title || "Post";
      const maxLength = 10;
      const displayText = title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
      ctx.fillText(displayText, postX, postY);
      
      // Dibujar todos los nodos hijos recursivamente
      node.children.forEach(child => {
        drawNodes(ctx, child, centerX, centerY);
      });
      
      return;
    }
    
    // Para nodos normales (comentarios)
    // Posición del nodo con escala y offset
    const x = centerX + (node.x || 0) * scale + offsetX;
    const y = centerY + (node.y || 0) * scale + offsetY;
    const radius = node.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS;
    
    // Color según nivel, con ciclo
    const colorIndex = (node.level % COLOR_PALETTE.length);
    const baseColor = COLOR_PALETTE[colorIndex];
    
    // Círculo para el comentario
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    // Color de relleno según tipo de nodo
    if (node.selected || node.id === selectedNode?.id) {
      // Nodo seleccionado
      ctx.fillStyle = '#f39c12'; // Naranja para selección
    } else if (node.highlighted) {
      // Nodo en el mejor camino
      ctx.fillStyle = '#27ae60'; // Verde para destacado
    } else if (node.negativeScore) {
      // Nodo con puntuación negativa
      ctx.fillStyle = '#e74c3c'; // Rojo para negativo
    } else {
      // Nodo normal
      ctx.fillStyle = baseColor;
    }
    
    ctx.fill();
    
    // Borde
    if (node.id === selectedNode?.id) {
      // Borde más grueso para el nodo seleccionado actualmente
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 3;
    } else {
      // Borde normal
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
    }
    ctx.stroke();
    
    // Texto del comentario (solo número incremental para simplicidad)
    ctx.fillStyle = '#fff';
    ctx.font = node.negativeScore ? '10px Arial' : '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.id.toString(), x, y);
    
    // Dibujar recursivamente todos los nodos hijos
    if (!node.collapsed) {
      node.children.forEach(child => {
        drawNodes(ctx, child, centerX, centerY);
      });
    }
  }

  // Dibujar leyenda
  function drawLegend(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const legendWidth = 220;
    const legendHeight = 180;
    const padding = 10;
    const x = canvas.width - legendWidth - padding;
    const y = canvas.height - legendHeight - padding;
    
    // Fondo semitransparente
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(x, y, legendWidth, legendHeight);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, legendWidth, legendHeight);
    
    // Título
    ctx.fillStyle = '#000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Leyenda', x + padding, y + padding);
    
    // Elementos de la leyenda
    const items = [
      { color: '#3498db', label: 'Post principal' },
      { color: COLOR_PALETTE[0], label: 'Comentario nivel 1' },
      { color: COLOR_PALETTE[1], label: 'Comentario nivel 2' },
      { color: COLOR_PALETTE[2], label: 'Comentario nivel 3' },
      { color: '#27ae60', label: 'Mejor camino (más votos)' },
      { color: '#e74c3c', label: 'Comentario con votos negativos' },
      { color: '#f39c12', label: 'Comentario seleccionado' }
    ];
    
    ctx.font = '12px Arial';
    items.forEach((item, index) => {
      const itemY = y + padding * 3 + index * 20;
      
      // Círculo de color
      ctx.beginPath();
      ctx.arc(x + padding * 2, itemY, 8, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Texto descriptivo
      ctx.fillStyle = '#000';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x + padding * 4, itemY - 6);
    });
    
    // Instrucciones en la parte inferior
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Clic: Seleccionar | Doble clic: Ir al comentario', canvas.width / 2, canvas.height - 30);
    ctx.fillText('Arrastrar: Mover vista | Rueda: Zoom', canvas.width / 2, canvas.height - 12);
  }
  
  // Encontrar nodo en la posición del clic
  function findNodeAtPosition(node: CommentNode, x: number, y: number, centerX: number, centerY: number): CommentNode | null {
    // Para el nodo raíz (post)
    if (node.level === -1) {
      // Comprobar si se hizo clic en el post
      if (node.isPost) {
        const postX = centerX;
        const postY = centerY - 40;
        const postRadius = NODE_RADIUS * 1.3;
        
        const distanceSquared = Math.pow(x - postX, 2) + Math.pow(y - postY, 2);
        if (distanceSquared <= Math.pow(postRadius, 2)) {
          return node;
        }
      }
      
      // Verificar clics en los comentarios hijos
      for (const child of node.children) {
        const foundNode = findNodeAtPosition(child, x, y, centerX, centerY);
        if (foundNode) return foundNode;
      }
      return null;
    }
    
    // Para nodos normales (comentarios)
    const nodeX = centerX + (node.x || 0) * scale + offsetX;
    const nodeY = centerY + (node.y || 0) * scale + offsetY;
    const radius = node.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS;
    
    // Verificar si el clic está dentro del nodo
    const distanceSquared = Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2);
    const hitRadius = radius * 1.5; // Área de detección ampliada para facilitar la selección
    
    if (distanceSquared <= Math.pow(hitRadius, 2)) {
      return node;
    }
    
    // Verificar hijos
    if (!node.collapsed) {
      for (const child of node.children) {
        const foundNode = findNodeAtPosition(child, x, y, centerX, centerY);
        if (foundNode) return foundNode;
      }
    }
    
    return null;
  }
  
  // Manejar clic en el canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tree || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calcular offset del centro
    const centerX = canvas.width / 2;
    const centerY = CANVAS_PADDING * 2;
    
    // Encontrar nodo en la posición del clic
    const clickedNode = findNodeAtPosition(tree, x, y, centerX, centerY);
    
    if (clickedNode) {
      // Seleccionar el nodo
      setSelectedNode(clickedNode);
      
      // Mostrar información en el toast
      let title = clickedNode.isPost ? 'Post seleccionado' : 'Comentario seleccionado';
      let description = clickedNode.isPost 
        ? `${clickedNode.content.substring(0, 50)}${clickedNode.content.length > 50 ? '...' : ''}` 
        : `Por ${clickedNode.username} (ID: ${clickedNode.id})`;
      
      toast({
        title,
        description,
        duration: 3000,
      });
    } else {
      // Deseleccionar si se hace clic en un área vacía
      setSelectedNode(null);
    }
  };
  
  // Manejar doble clic para navegar al comentario
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tree || !canvasRef.current || !selectedPostId) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calcular offset del centro
    const centerX = canvas.width / 2;
    const centerY = CANVAS_PADDING * 2;
    
    // Encontrar nodo en la posición del doble clic
    const clickedNode = findNodeAtPosition(tree, x, y, centerX, centerY);
    
    if (clickedNode && !clickedNode.isPost) {
      // Abrir el post con el comentario seleccionado en una nueva pestaña
      const url = `/posts/${selectedPostId}?comment=${clickedNode.id}`;
      window.open(url, '_blank');
    } else if (clickedNode && clickedNode.isPost) {
      // Abrir el post en una nueva pestaña
      const url = `/posts/${selectedPostId}`;
      window.open(url, '_blank');
    }
  };
  
  // Manejar arrastre para mover la vista
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setStartDragPosition({ x: e.clientX, y: e.clientY });
    setCurrentDragPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    
    setCurrentDragPosition({ x: e.clientX, y: e.clientY });
    
    const deltaX = currentDragPosition.x - startDragPosition.x;
    const deltaY = currentDragPosition.y - startDragPosition.y;
    
    setOffsetX(offsetX + deltaX);
    setOffsetY(offsetY + deltaY);
    
    setStartDragPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Manejar rueda para zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    // Zoom in/out basado en la dirección de la rueda
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(scale + delta, 0.5), 2.0);
    setScale(newScale);
  };
  
  // Formato para mostrar votos
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

  // Guardar el canvas como imagen
  const handleSaveCanvas = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    
    // Crear un enlace temporal para descargar
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `comment-tree-${selectedPostId}.png`;
    link.click();
    
    toast({
      title: 'Imagen guardada',
      description: 'El árbol de comentarios se ha guardado como imagen.',
      duration: 3000,
    });
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Visualizador de Árbol de Comentarios</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Seleccionar Post</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Select 
                value={selectedPostId?.toString() || ''} 
                onValueChange={(value) => setSelectedPostId(parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un post para visualizar" />
                </SelectTrigger>
                <SelectContent>
                  {posts.map((post) => (
                    <SelectItem key={post.id} value={post.id.toString()}>
                      {post.title || `Post #${post.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedNode && !selectedNode.isPost && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-semibold text-sm">{selectedNode.username}</span>
                          {selectedNode.role === 'admin' && (
                            <div className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded">Admin</div>
                          )}
                          {selectedNode.role === 'moderator' && (
                            <div className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Mod</div>
                          )}
                        </div>
                        
                        {selectedNode.badges && selectedNode.badges.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {selectedNode.badges.map(badge => (
                              <div key={badge} className="inline-flex items-center gap-1">
                                <BadgeIcon badge={badge} size={14} />
                                <span className="text-xs">{badge}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {formatVotes(selectedNode.upvotes, selectedNode.downvotes, selectedNode.voteScore)}
                    </div>
                    
                    <Separator className="my-2" />
                    
                    <p className="text-sm max-h-20 overflow-y-auto">{selectedNode.content}</p>
                    
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          if (selectedPostId && selectedNode) {
                            window.open(`/posts/${selectedPostId}?comment=${selectedNode.id}`, '_blank');
                          }
                        }}
                      >
                        Ver comentario
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>
        
        {selectedPostId && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Visualización del Árbol</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setScale(Math.min(scale + 0.1, 2))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setScale(Math.max(scale - 0.1, 0.5))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => { setOffsetX(0); setOffsetY(0); setScale(1.0); }}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleSaveCanvas}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 relative">
              <div 
                ref={containerRef} 
                className="w-full h-[600px] overflow-hidden relative"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                {isLoadingComments ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    onClick={handleCanvasClick}
                    onDoubleClick={handleCanvasDoubleClick}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
