import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';
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
  
  const { toast } = useToast();

  // Constantes para la visualización
  const NODE_RADIUS = 22;
  const SMALL_NODE_RADIUS = 16;
  const NODE_SPACING_H = 120;
  const NODE_SPACING_V = 150;
  const LINE_WIDTH = 2;
  const CANVAS_PADDING = 60;
  // Colores para las conexiones - paleta de azules para estilo similar a la referencia
  const COLOR_PALETTE = [
    '#37c6ee', // Azul cian (principal para conexiones)
    '#37c6ee', // Mismo color para mantener consistencia
    '#37c6ee', // Mismo color para mantener consistencia
    '#37c6ee', // Mismo color para mantener consistencia
    '#f1c40f', // amarillo (para camino destacado)
    '#e67e22', // naranja (para selección)
    '#e74c3c', // rojo (para votos negativos)
  ];
  // Colores para los nodos
  const NODE_COLOR = '#121212';
  const NODE_BORDER_COLOR = '#37c6ee';   // Azul cian para el borde
  const POST_NODE_COLOR = '#ffffff';      // Blanco para el post
  const POST_BORDER_COLOR = '#3498db';    // Azul para el borde del post

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
  }, [tree, offsetX, offsetY, scale]);

  // Asignar índices a los nodos de manera jerárquica (1, 1.1, 1.1.1, etc.)
  function assignNodeIndices(node: CommentNode, parentIndex: string = "") {
    if (node.level === -1) {
      // El nodo raíz (post) no tiene índice
      node.children.forEach((child, idx) => {
        const childIndex = `${idx + 1}`;
        child.index = childIndex;
        assignNodeIndices(child, childIndex);
      });
    } else {
      // Para nodos normales (comentarios)
      node.children.forEach((child, idx) => {
        const childIndex = `${parentIndex}.${idx + 1}`;
        child.index = childIndex;
        assignNodeIndices(child, childIndex);
      });
    }
  }

  // Dibujar el árbol completo
  function drawTree(ctx: CanvasRenderingContext2D, node: CommentNode, centerX: number, centerY: number) {
    // Asignar índices a los nodos primero
    assignNodeIndices(node);
    
    // Fondo negro
    ctx.fillStyle = '#121212'; // Fondo oscuro
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
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
      const postRadius = NODE_RADIUS * 1.2; // Post ligeramente más grande
      
      // Círculo para el post
      ctx.beginPath();
      ctx.arc(postX, postY, postRadius, 0, Math.PI * 2);
      ctx.fillStyle = POST_NODE_COLOR; // Color para el post (blanco)
      ctx.fill();
      ctx.strokeStyle = POST_BORDER_COLOR; // Borde azul
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Texto del post ("POST")
      ctx.fillStyle = '#000';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText("POST", postX, postY);
      
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
    
    // Círculo para el comentario
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    // Color de relleno según tipo de nodo
    if (node.selected || node.id === selectedNode?.id) {
      // Nodo seleccionado - amarillo
      ctx.fillStyle = '#f1c40f';
    } else if (node.highlighted) {
      // Nodo en el mejor camino - mismo color que las conexiones
      ctx.fillStyle = NODE_COLOR;
      ctx.strokeStyle = COLOR_PALETTE[0];
      ctx.lineWidth = 2;
    } else if (node.negativeScore) {
      // Nodo con puntuación negativa - rojo
      ctx.fillStyle = NODE_COLOR;
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
    } else {
      // Nodo normal - negro con borde azul
      ctx.fillStyle = NODE_COLOR;
      ctx.strokeStyle = NODE_BORDER_COLOR;
      ctx.lineWidth = 2;
    }
    
    // Rellenar el nodo
    ctx.fill();
    
    // Aplicar borde (ya configurado arriba)
    if (node.id === selectedNode?.id) {
      // Borde más grueso para el nodo seleccionado actualmente
      ctx.strokeStyle = '#f1c40f'; // Amarillo para selección
      ctx.lineWidth = 3;
    }
    ctx.stroke();
    
    // Texto del comentario con numeración jerárquica (1.1.1, etc.)
    ctx.fillStyle = '#fff';
    ctx.font = node.negativeScore ? '9px Arial' : '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Mostrar índice jerárquico en lugar del ID
    const displayText = node.index || node.id.toString();
    ctx.fillText(displayText, x, y + (node.negativeScore ? 0 : 1));
    
    // Dibujar el índice también debajo del nodo
    if (!node.isPost && node.index) {
      ctx.font = '10px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(node.index, x, y + radius + 14);
    }
    
    // Dibujar recursivamente todos los nodos hijos
    if (!node.collapsed) {
      node.children.forEach(child => {
        drawNodes(ctx, child, centerX, centerY);
      });
    }
  }

  // Dibujar leyenda
  function drawLegend(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const legendWidth = 200;
    const legendHeight = 165;
    const padding = 10;
    const x = canvas.width - legendWidth - padding;
    const y = canvas.height - legendHeight - padding;
    
    // Fondo semitransparente oscuro
    ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
    ctx.fillRect(x, y, legendWidth, legendHeight);
    ctx.strokeStyle = 'rgba(55, 198, 238, 0.6)'; // Borde azul semitransparente
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, legendWidth, legendHeight);
    
    // Título
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Leyenda:', x + padding, y + padding);
    
    // Elementos de la leyenda
    const drawNodeExample = (xPos: number, yPos: number, fillColor: string, borderColor: string, label: string) => {
      // Nodo de ejemplo
      ctx.beginPath();
      ctx.arc(xPos, yPos, 8, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Etiqueta
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.font = '11px Arial';
      ctx.fillText(label, xPos + 14, yPos - 5);
    };
    
    let yOffset = padding * 3;
    
    // Nodo de comentario
    drawNodeExample(x + padding * 2, y + yOffset, NODE_COLOR, NODE_BORDER_COLOR, 'Nodo de comentario');
    yOffset += 22;
    
    // Nodo seleccionado
    drawNodeExample(x + padding * 2, y + yOffset, '#f1c40f', '#f1c40f', 'Nodo seleccionado');
    yOffset += 22;
    
    // Comentario negativo
    drawNodeExample(x + padding * 2, y + yOffset, NODE_COLOR, '#e74c3c', 'Comentario negativo');
    yOffset += 22;
    
    // Progreso de votos positivos
    drawNodeExample(x + padding * 2, y + yOffset, NODE_COLOR, COLOR_PALETTE[0], 'Progreso de votos positivos');
    yOffset += 22;
    
    // Conexión entre comentarios
    ctx.beginPath();
    ctx.moveTo(x + padding - 2, y + yOffset);
    ctx.lineTo(x + padding * 3, y + yOffset);
    ctx.strokeStyle = COLOR_PALETTE[0];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('Conexión entre comentarios', x + padding * 4 - 2, y + yOffset - 5);
    
    // Instrucciones en la parte inferior (en el canvas, no en la leyenda)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Clic: Seleccionar | Doble clic: Ir al comentario', canvas.width / 2, canvas.height - 25);
    ctx.fillText('Arrastrar: Mover vista | Rueda: Zoom', canvas.width / 2, canvas.height - 10);
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
    <div className="min-h-screen bg-[#121212] text-white">
      <div className="container mx-auto py-6 px-4 flex flex-col space-y-6">
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
              {/* Área de visualización con scrollbars */}
              <div 
                ref={containerRef} 
                className="w-full h-[600px] relative"
                style={{ overflow: 'auto' }}
              >
                {isLoadingComments ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div style={{ width: '2000px', height: '2000px', position: 'relative', cursor: isDragging ? 'grabbing' : 'grab' }}>
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full"
                      onClick={handleCanvasClick}
                      onDoubleClick={handleCanvasDoubleClick}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onWheel={handleWheel}
                    />
                  </div>
                )}
              </div>

              {/* Panel de información fijo (siempre visible, con post por defecto o nodo seleccionado) */}
              <div className="fixed bottom-44 right-8 z-20 w-72 rounded-lg border border-[#37c6ee]/50 bg-[#0a0a0a] text-white p-4 shadow-lg overflow-hidden">
                {selectedNode ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      {selectedNode.role === 'admin' && (
                        <span className="bg-red-900 text-red-100 text-xs px-2 py-0.5 rounded">Admin</span>
                      )}
                      {selectedNode.role === 'moderator' && (
                        <span className="bg-blue-900 text-blue-100 text-xs px-2 py-0.5 rounded">Mod</span>
                      )}
                      {selectedNode.badges && selectedNode.badges.length > 0 && (
                        <div className="flex gap-1">
                          {selectedNode.badges.map(badge => (
                            <BadgeIcon key={badge} badge={badge} size={14} showLabel={false} />
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <h3 className="font-bold uppercase mb-2 text-[#37c6ee]">
                      {selectedNode.isPost ? 'POST PRINCIPAL' : selectedNode.username}
                    </h3>
                    
                    {!selectedNode.isPost && (
                      <div className="flex mb-2 text-xs">
                        <div className="flex-1">
                          <span className="text-green-500">↑ {selectedNode.upvotes}</span>
                          {' • '}
                          <span className="text-red-500">↓ {selectedNode.downvotes}</span>
                        </div>
                        <div className={`font-medium ${selectedNode.voteScore >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ={selectedNode.voteScore}
                        </div>
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-300 max-h-28 overflow-y-auto">
                      {selectedNode.content}
                    </div>
                    
                    {!selectedNode.isPost && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#37c6ee] text-[#37c6ee] hover:bg-[#37c6ee]/10"
                          onClick={() => {
                            if (selectedPostId && selectedNode) {
                              window.open(`/posts/${selectedPostId}?comment=${selectedNode.id}`, '_blank');
                            }
                          }}
                        >
                          Ver comentario
                        </Button>
                      </div>
                    )}
                  </>
                ) : postData ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      {postData.user.role === 'admin' && (
                        <span className="bg-red-900 text-red-100 text-xs px-2 py-0.5 rounded">Admin</span>
                      )}
                      {postData.user.role === 'moderator' && (
                        <span className="bg-blue-900 text-blue-100 text-xs px-2 py-0.5 rounded">Mod</span>
                      )}
                      {postData.user.badges && postData.user.badges.length > 0 && (
                        <div className="flex gap-1">
                          {postData.user.badges.map(badge => (
                            <BadgeIcon key={badge} badge={badge} size={14} showLabel={false} />
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <h3 className="font-bold uppercase mb-2 text-[#37c6ee]">
                      POST PRINCIPAL
                    </h3>
                    
                    <div className="flex mb-2 text-xs">
                      <div className="flex-1">
                        <span className="text-green-500">↑ {postData.upvotes || 0}</span>
                        {' • '}
                        <span className="text-red-500">↓ {postData.downvotes || 0}</span>
                      </div>
                      <div className={`font-medium ${(postData.upvotes || 0) - (postData.downvotes || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ={(postData.upvotes || 0) - (postData.downvotes || 0)}
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-300 max-h-28 overflow-y-auto">
                      {postData.title || postData.content}
                    </div>
                    
                    <div className="mt-3 flex justify-between">
                      <span className="text-xs text-gray-400">Por: {postData.user.username}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#37c6ee] text-[#37c6ee] hover:bg-[#37c6ee]/10"
                        onClick={() => {
                          if (selectedPostId) {
                            window.open(`/posts/${selectedPostId}`, '_blank');
                          }
                        }}
                      >
                        Ver post
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2 text-gray-400">
                    Selecciona un post o un comentario para ver detalles
                  </div>
                )}
              </div>

              {/* Leyenda fija */}
              <div className="fixed bottom-4 right-8 z-20 w-72 rounded-lg border border-[#37c6ee]/50 bg-[#0a0a0a] text-white p-4 shadow-lg overflow-hidden">
                <h4 className="text-sm font-medium mb-2">Leyenda:</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-black border border-white"></div>
                    <span className="text-xs text-white">Nodo de comentario</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f1c40f] border border-[#f1c40f]"></div>
                    <span className="text-xs text-white">Nodo seleccionado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-black border border-red-500"></div>
                    <span className="text-xs text-white">Comentario negativo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-black border border-[#37c6ee]"></div>
                    <span className="text-xs text-white">Mejor camino de votos</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}