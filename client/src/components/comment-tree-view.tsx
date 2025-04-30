import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { CommentWithUser } from '@shared/schema';
import { X, Minimize2, Maximize2, ZoomIn, ZoomOut, RotateCcw, Share2, MessageSquare, ArrowUp, ArrowDown } from 'lucide-react';
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
const NODE_RADIUS = 28; // Nodos más grandes para mejor visibilidad en móvil
const SMALL_NODE_RADIUS = 18; // Nodos negativos también más visibles
const NODE_SPACING_H = 140; // Mayor espaciado horizontal para evitar solapamiento
const NODE_SPACING_V = 180; // Mucho mayor espaciado vertical entre filas jerárquicas
const LINE_WIDTH = 2.5; // Grosor de línea más similar a la imagen de referencia
const COLOR_PALETTE = [
  '#37c6ee', // Azul cian (como en la imagen de referencia)
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
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  // Estado para el panel de información fijo
  const [fixedPanelOpen, setFixedPanelOpen] = useState(false);
  // Mantenemos el modal pero lo usaremos solo en situaciones específicas
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(0.9); // Escala inicial reducida para ver más contenido
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const [currentDragPosition, setCurrentDragPosition] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [lastTouchTime, setLastTouchTime] = useState(0);
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
    if (postData) {
      // Convertir todos los comentarios (incluido si no hay ninguno) en un árbol jerárquico
      const commentMap = new Map<number, CommentNode>();

      // Definir función recursiva fuera del bloque
      const processCommentsRecursively = (commentList: CommentWithUser[]) => {
        // Para cada comentario en la lista
        commentList.forEach(comment => {
          // Crear un nodo para este comentario
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
          
          // Añadir el nodo al mapa
          commentMap.set(comment.id, commentNode);
          
          // Si tiene respuestas, procesarlas recursivamente
          if (comment.replies && comment.replies.length > 0) {
            processCommentsRecursively(comment.replies);
          }
        });
      }
      
      // Primera pasada: procesar todos los comentarios y respuestas recursivamente
      processCommentsRecursively(comments);
      
      // Segunda pasada: construir la estructura jerárquica del árbol
      const rootNodes: CommentNode[] = [];
      
      // Función para construir las relaciones padre-hijo
      const buildHierarchy = (commentList: CommentWithUser[]) => {
        commentList.forEach(comment => {
          const node = commentMap.get(comment.id);
          if (!node) return; // Protección contra nodos no existentes
          
          if (comment.parentId) {
            // Es una respuesta a otro comentario
            const parentNode = commentMap.get(comment.parentId);
            if (parentNode) {
              // Añadirlo como hijo del padre
              parentNode.children.push(node);
              node.level = parentNode.level + 1;
            } else {
              // Si por alguna razón no se encuentra el padre, lo añadimos como comentario raíz
              rootNodes.push(node);
            }
          } else {
            // Es un comentario de primer nivel
            rootNodes.push(node);
          }
          
          // Procesar recursivamente las respuestas
          if (comment.replies && comment.replies.length > 0) {
            buildHierarchy(comment.replies);
          }
        });
      }
      
      // Construir la jerarquía
      buildHierarchy(comments);

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

      // Crear un nodo raíz para el post (siempre está presente)
      const postRoot: CommentNode = {
        id: postData.id,
        content: postData.content || postData.title,
        userId: postData.user.id,
        username: postData.user.username || "unknown",
        role: postData.user.role || "user",
        badges: postData.user.badges || [],
        upvotes: postData.upvotes || 0,
        downvotes: postData.downvotes || 0,
        voteScore: (postData.upvotes || 0) - (postData.downvotes || 0),
        children: rootNodes, // Todos los comentarios de primer nivel
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
      const spacingMultiplier = Math.min(2.2, Math.max(1.0, 1.2 - totalComments * 0.008));
      
      // Mostrar mensaje si no hay comentarios
      if (node.children.length === 0) {
        // Aunque no hay comentarios, el nodo raíz siempre está presente
        // Aseguramos que sea visible
        node.x = 0;
        node.y = 0;
        return;
      }
      
      node.children.forEach(child => {
        // Espaciamos horizontalmente los comentarios de primer nivel
        // Usamos una distribución más amplia para los comentarios de primer nivel
        const horizontalOffset = (childIndex - (node.children.length - 1) / 2) * 
                                 NODE_SPACING_H * 2.0 * spacingMultiplier;
        
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
      const spacingFactor = Math.min(1.2, Math.max(0.7, 1.1 - (node.children.length * 0.04)));
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
    // Si no tiene hijos, no hace falta hacer nada más (ya está posicionado correctamente)
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
      // Para el modo integrado (no modal)
      if (!onClose) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
      } else {
        // Para el modo modal (pantalla completa) con área de desplazamiento
        canvas.width = Math.max(2200, containerRef.current.clientWidth);
        canvas.height = Math.max(3500, containerRef.current.clientHeight);
      }
    }

    // Calculate center offset
    const centerX = canvas.width / 2;
    const centerY = CANVAS_PADDING * 2;

    // Draw the tree (skip the virtual root)
    drawNode(ctx, tree, centerX, centerY);

    // Si no hay comentarios, mostrar un mensaje
    if (tree.children.length === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No hay comentarios aún', centerX, centerY + 60);
    }

    // Añadir instrucciones para el usuario
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const instructions = [
      'Haz clic en un nodo para ver información',
      'Doble clic para ir al comentario',
      'Arrastra para mover el árbol'
    ];
    
    instructions.forEach((text, i) => {
      ctx.fillText(text, centerX, canvas.height - 80 + (i * 20));
    });

  }, [tree, offsetX, offsetY, scale, containerRef.current?.clientWidth, containerRef.current?.clientHeight, onClose]);

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

        // Estilo especial para el post - usar negro como en la imagen de referencia
        ctx.fillStyle = '#000000'; // Negro sólido para el nodo raíz
        ctx.globalAlpha = 1.0; // Completamente opaco para mejor visibilidad
        ctx.fill();
        ctx.globalAlpha = 1;

        // Borde para el post
        ctx.strokeStyle = '#ffffff'; // Borde blanco para el nodo raíz
        ctx.lineWidth = 2; // Línea precisa como en la imagen
        ctx.stroke();

        // Guarda las coordenadas reales para poder detectar clics
        node.x = 0;
        node.y = y - centerY;
        
        // Añadir indicador de "POST" al nodo raíz
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Añadir texto con borde negro para mejor visibilidad
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.strokeText("POST", x, y);
        ctx.fillText("POST", x, y);
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
          ctx.strokeStyle = '#37c6ee'; // Color azul cian exactamente como en la imagen de referencia
          ctx.lineWidth = LINE_WIDTH;

          // Dibujar líneas curvas (Bezier) para conexiones más armoniosas
          const startY = postY + NODE_RADIUS * 1.3;
          const endY = childY - (child.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS);
          
          // Usar curva de Bezier para conectar el post con los comentarios
          ctx.moveTo(postX, startY);
          ctx.bezierCurveTo(
            postX, startY + (endY - startY) * 0.3, // Punto de control 1
            childX, startY + (endY - startY) * 0.7, // Punto de control 2
            childX, endY // Punto final
          );

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

      // Dibujar líneas curvas (Bezier) para conexiones más suaves
      const startY = y + (node.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS);
      const endY = childY - (child.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS);
      
      // Usar curva de Bezier para conectar los nodos
      ctx.moveTo(x, startY);
      ctx.bezierCurveTo(
        x, startY + (endY - startY) * 0.3, // Punto de control 1
        childX, startY + (endY - startY) * 0.7, // Punto de control 2
        childX, endY // Punto final
      );

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

    // Estilo de relleno negro sólido como en la imagen de referencia
    ctx.fillStyle = '#000000'; // Negro para todos los nodos
    ctx.globalAlpha = 1.0; // Completamente opaco
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Borde blanco fino como en la imagen de referencia
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw progress circle showing upvote percentage if any votes exist
    const totalVotes = node.upvotes + node.downvotes;
    if (totalVotes > 0) {
      const upvotePercentage = node.upvotes / totalVotes;

      // Draw progress arc
      ctx.beginPath();
      ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * upvotePercentage));

      // Use color from palette or highlighted color but brighter for visibility
      const progressColor = node.highlighted ? '#2ecc71' : COLOR_PALETTE[node.level % COLOR_PALETTE.length];
      ctx.strokeStyle = progressColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      
      // Añadir pequeño texto con número de votos
      const netVotes = node.voteScore;
      ctx.fillStyle = netVotes >= 0 ? "#2ecc71" : "#e74c3c";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // Contorno negro primero para mejor visibilidad
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 2;
      ctx.strokeText(`${netVotes}`, x, y);
      
      // Texto encima
      ctx.fillText(`${netVotes}`, x, y);
    }

    // Add bookmark icon if this is a selected node
    if (selectedNode && selectedNode.id === node.id) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${radius * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeText('★', x, y); // Contorno negro para la estrella
      ctx.fillText('★', x, y);
    }

    // Draw the index number
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Añadir un contorno negro para mejor legibilidad
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(node.index || '', x, y + radius + 2);
    
    // Texto en blanco encima del contorno
    ctx.fillText(node.index || '', x, y + radius + 2);
  }

  // Función auxiliar para mostrar información del nodo
  const showNodeInfo = (
    node: CommentNode, 
    clickX: number, 
    clickY: number, 
    canvas: HTMLCanvasElement
  ) => {
    // Establecer el nodo seleccionado y guardar su ID para la navegación
    setSelectedNode(node);
    setSelectedNodeId(node.id);
    
    console.log("Mostrando info del nodo:", node.id, node.username, node.content.substring(0, 20));
    
    // El panel fijo siempre está visible, no necesitamos activarlo
    // solo necesitamos seleccionar el nodo para que muestre su información
    
    // Configurar el modal flotante solo para casos específicos (vista compacta)
    const modalWidth = 450; // Ancho fijo para mejor legibilidad
    const modalHeight = 400; // Altura estimada para el modal
    
    // Si estamos en la vista compacta (barra lateral)
    if (!onClose) {
      // Para la vista de barra lateral, centramos el popup de manera absoluta
      const sidebarEl = document.querySelector('.sidebar-tree-view');
      if (sidebarEl) {
        const rect = sidebarEl.getBoundingClientRect();
        setModalPosition({ 
          x: rect.left + rect.width/2 - modalWidth/2, 
          y: Math.max(50, rect.top + 100) 
        });
      } else {
        // Fallback si no encontramos el elemento
        setModalPosition({ x: 20, y: 50 });
      }
      
      // En vista compacta, usar el modal flotante
      setInfoModalOpen(true);
    } else {
      // En vista completa, no mostrar el flotante
      setInfoModalOpen(false);
      
      // Guardar la posición del modal por si necesitamos mostrarla en algún momento
      const canvasRect = canvas.getBoundingClientRect();
      
      // Convertir coordenadas del canvas a coordenadas de la ventana
      const windowX = canvasRect.left + clickX;
      const windowY = canvasRect.top + clickY;
      
      // Posicionar la ventana a la derecha del cursor por defecto
      let posX = windowX + 25; // Un poco más separado para mejor visibilidad
      let posY = windowY - 20; // Ligeramente por encima del cursor
      
      // Ajustes de posición basados en los límites de la pantalla
      if (posX + modalWidth > window.innerWidth - 20) {
        posX = windowX - modalWidth - 25;
      }
      
      if (posY + modalHeight > window.innerHeight - 20) {
        posY = Math.max(20, windowY - modalHeight + 20);
      }
      
      // Asegurar que no se salga de la pantalla
      posX = Math.max(20, posX);
      posY = Math.max(20, posY);
      
      setModalPosition({ x: posX, y: posY });
    }
  };

  // Handle click on canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tree || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Calculate center offset (considerando scroll del área)
    const centerX = canvas.width / 2;
    const centerY = CANVAS_PADDING * 2;

    // Find clicked node
    const clickedNode = findNodeAtPosition(tree, clickX, clickY, centerX, centerY);
    
    console.log("¿Se ha hecho clic en un nodo?", !!clickedNode);
    if (clickedNode) {
      console.log("Nodo clickeado:", clickedNode.id, clickedNode.username, "Contenido:", clickedNode.content.substring(0, 20));
    
      // Cerrar cualquier modal abierto inmediatamente
      setInfoModalOpen(false);
      setSelectedNode(null);
      
      // Pequeña pausa para que se note el efecto de cierre y apertura
      setTimeout(() => {
        showNodeInfo(clickedNode, clickX, clickY, canvas);
      }, 50);
    } else {
      // Click on empty space - close info modal
      setInfoModalOpen(false);
      setSelectedNode(null);
    }
  };
  
  // Handle double click to navigate to comment
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

    if (clickedNode && onCommentSelect && clickedNode.id !== postData?.id) {
      // Guardar el ID del nodo seleccionado para aplicar efecto visual
      setSelectedNodeId(clickedNode.id);
      
      // Obtener URL del comentario
      const commentUrl = `${window.location.origin}/posts/${postId}?comment=${clickedNode.id}`;
      
      // Abrir en una nueva ventana/pestaña
      window.open(commentUrl, '_blank');
      
      // También ejecutar la función de navegación para activar efectos visuales
      onCommentSelect(clickedNode.id);
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
    // Si es un toque simple
    if (e.touches.length === 1) {
      // Guardar la hora del toque para detectar doble toque
      const now = new Date().getTime();
      
      // Detectar si es un doble toque (300ms entre toques)
      if (now - lastTouchTime < 300) {
        // Es un doble toque - navegar al comentario
        const canvas = canvasRef.current;
        if (!tree || !canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        const touchY = e.touches[0].clientY - rect.top;
        
        // Calcular offset del centro
        const centerX = canvas.width / 2;
        const centerY = CANVAS_PADDING * 2;
        
        // Buscar el nodo tocado
        const touchedNode = findNodeAtPosition(tree, touchX, touchY, centerX, centerY);
        
        if (touchedNode && onCommentSelect && touchedNode.id !== postData?.id) {
          e.preventDefault(); // Prevenir zoom del navegador
          console.log("Doble toque en nodo:", touchedNode.id);
          
          // Añadir efecto de flash cuando se selecciona un comentario
          setSelectedNodeId(touchedNode.id);
          
          // Navegar al comentario
          onCommentSelect(touchedNode.id);
          return;
        }
      } else {
        // Es un toque simple - mostrar información o iniciar arrastre
        setIsDragging(true);
        setStartDragPosition({ 
          x: e.touches[0].clientX, 
          y: e.touches[0].clientY 
        });
        setCurrentDragPosition({ 
          x: e.touches[0].clientX, 
          y: e.touches[0].clientY 
        });
        
        // También mostrar información del nodo si se tocó uno
        const canvas = canvasRef.current;
        if (tree && canvas) {
          const rect = canvas.getBoundingClientRect();
          const touchX = e.touches[0].clientX - rect.left;
          const touchY = e.touches[0].clientY - rect.top;
          
          // Calcular offset del centro
          const centerX = canvas.width / 2;
          const centerY = CANVAS_PADDING * 2;
          
          // Buscar el nodo tocado
          const touchedNode = findNodeAtPosition(tree, touchX, touchY, centerX, centerY);
          
          if (touchedNode) {
            console.log("Toque en nodo:", touchedNode.id);
            // Cerrar cualquier modal abierto inmediatamente
            setInfoModalOpen(false);
            setSelectedNode(null);
            
            // Abrir el nuevo modal después de una pausa
            setTimeout(() => {
              showNodeInfo(touchedNode, touchX, touchY, canvas);
            }, 50);
          }
        }
      }
      
      // Actualizar la hora del último toque
      setLastTouchTime(now);
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

  // Find node at clicked position - con mejor detección para dispositivos táctiles
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

    // Check if click is within this node (área ampliada para mayor facilidad de clic)
    const distanceSquared = Math.pow(clickX - x, 2) + Math.pow(clickY - y, 2);
    // Ampliamos significativamente el área de detección, especialmente en móviles
    const hitRadius = radius * (isMobile ? 2.2 : 1.8); // Área de clic mucho más amplia para facilitar la interacción
    
    // Mostrar información en consola para depurar
    if (distanceSquared <= Math.pow(hitRadius, 2)) {
      console.log("¡Nodo detectado!", node.id, node.username, "en posición", x, y);
      console.log("Distancia al clic:", Math.sqrt(distanceSquared), "vs radio de detección:", hitRadius);
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
              onDoubleClick={handleCanvasDoubleClick}
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
              <div 
                className="fixed bg-card/95 backdrop-blur-sm shadow-xl rounded-md p-4 max-w-[90%] z-50 border-2 border-primary animate-in fade-in-0 zoom-in-90 duration-300"
                style={{
                  left: `${modalPosition.x}px`,
                  top: `${modalPosition.y}px`,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2), 0 0 0 2px rgba(var(--primary), 0.5)'
                }}>
                <div className="flex justify-between items-start mb-1">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm">{selectedNode.username}</span>
                      {selectedNode.role === 'admin' && (
                        <Badge className="text-xs bg-red-100 text-red-800 px-1.5 py-0">Admin</Badge>
                      )}
                      {selectedNode.role === 'moderator' && (
                        <Badge className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0">Mod</Badge>
                      )}
                    </div>
                    
                    {selectedNode.badges && selectedNode.badges.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedNode.badges.map(badge => (
                          <TooltipProvider key={badge}>
                            <Tooltip>
                              <TooltipTrigger>
                                <BadgeIcon badge={badge} size={14} />
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
                
                <div className="border-t border-b py-2 my-1.5">
                  <p className="text-xs max-h-20 overflow-y-auto">{selectedNode.content}</p>
                  
                  {selectedNode.index && (
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      Comentario #{selectedNode.index}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center mt-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => {
                      setSelectedNode(null);
                    }}
                  >
                    Cerrar
                  </Button>
                  
                  <Button 
                    variant="default"
                    size="sm" 
                    className="text-xs h-7 bg-green-500 hover:bg-green-600 text-white font-bold border-2 border-green-700 shadow-md"
                    onClick={() => {
                      if (onCommentSelect && selectedNode) {
                        console.log("Navegando al comentario mediante botón compacto:", selectedNode.id);
                        
                        // Guardar el ID para referencia futura
                        setSelectedNodeId(selectedNode.id);
                        
                        // Cerrar el modal
                        setSelectedNode(null);
                        
                        // Navegación hacia el comentario con un pequeño delay
                        setTimeout(() => {
                          // Llamada a la función de navegación que pasa el ID de comentario
                          onCommentSelect(selectedNode.id);
                        }, 100);
                      }
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5 mr-1.5" />
                    Ir al comentario
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Para la visualización modal (pantalla completa)
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col" 
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

      {/* Panel de información fijo siempre visible en la parte inferior derecha */}
      <div 
        className="fixed bottom-36 right-6 border-2 rounded-md bg-card/95 backdrop-blur-sm shadow-lg p-3 max-w-md z-20 border-primary/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {/* Mostrar nombre de usuario del nodo seleccionado o del post */}
              <span className="font-semibold text-primary">
                {selectedNode ? selectedNode.username : (postData?.user?.username || "Usuario")}
              </span>
              
              {/* Roles para nodo seleccionado */}
              {selectedNode?.role === 'admin' && (
                <Badge variant="destructive" className="text-xs">Admin</Badge>
              )}
              
              {selectedNode?.role === 'moderator' && (
                <Badge variant="default" className="text-xs">Mod</Badge>
              )}
              
              {/* Roles para post cuando no hay nodo seleccionado */}
              {!selectedNode && postData?.user?.role === 'admin' && (
                <Badge variant="destructive" className="text-xs">Admin</Badge>
              )}
              
              {!selectedNode && postData?.user?.role === 'moderator' && (
                <Badge variant="default" className="text-xs">Mod</Badge>
              )}
              
              {/* Badges para nodo seleccionado */}
              {selectedNode?.badges && selectedNode.badges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedNode.badges.map((badge: string) => (
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
              
              {/* Badges para post cuando no hay nodo seleccionado */}
              {!selectedNode && postData?.user?.badges && postData.user.badges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {postData.user.badges.map((badge: string) => (
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
            
            <div className="text-sm text-muted-foreground mt-1">
              {/* Identificador del comentario o post */}
              {selectedNode?.index && (
                <span className="mr-2">Comentario #{selectedNode.index}</span>
              )}
              
              {!selectedNode && (
                <span className="mr-2 font-medium text-primary">POST PRINCIPAL</span>
              )}
              
              {/* Información de votos */}
              <span className="flex items-center gap-1">
                <ArrowUp className="h-3 w-3 text-green-500" /> 
                {selectedNode ? selectedNode.upvotes : (postData?.upvotes || 0)} 
                
                <ArrowDown className="h-3 w-3 text-red-500 ml-2" /> 
                {selectedNode ? selectedNode.downvotes : (postData?.downvotes || 0)}
                
                <span className="ml-2">= 
                  {selectedNode 
                    ? selectedNode.voteScore 
                    : ((postData?.upvotes || 0) - (postData?.downvotes || 0))
                  }
                </span>
              </span>
            </div>
          </div>
        </div>
        
        <div className="border-t border-b py-2 my-2">
          <p className="text-sm max-h-24 overflow-y-auto">
            {selectedNode 
              ? selectedNode.content 
              : (postData?.content || postData?.title || "Cargando información...")
            }
          </p>
        </div>
        
        {/* Mostrar botón solo si hay un comentario seleccionado y no es el post */}
        {selectedNode && selectedNode.id !== postData?.id && (
          <div className="flex justify-end gap-2 mt-2">
            <Button 
              variant="default" 
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white font-semibold border border-primary/50 shadow-sm"
              onClick={() => {
                if (onCommentSelect) {
                  console.log("Abriendo comentario en una nueva ventana:", selectedNode.id);
                  
                  // Obtener URL del comentario
                  const commentUrl = `${window.location.origin}/posts/${postId}?comment=${selectedNode.id}`;
                  
                  // Abrir en una nueva ventana/pestaña
                  window.open(commentUrl, '_blank');
                }
              }}
            >
              <Share2 className="h-4 w-4 mr-1" />
              Ir al comentario
            </Button>
          </div>
        )}
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
        <div className={`h-[calc(100vh-${fullscreen ? '4rem' : '5rem'})] w-full overflow-auto`}>
          <div className="min-h-full min-w-[2000px] h-[3000px] relative">
            <canvas
              ref={canvasRef}
              className="h-full w-full cursor-grab active:cursor-grabbing absolute top-0 left-0"
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          </div>
        </div>
      )}

      {/* Node info modal */}
      {infoModalOpen && selectedNode && (
        <div 
          className="fixed bg-card border-2 border-primary shadow-xl rounded-lg p-4 z-50 w-[400px] animate-in fade-in-0 zoom-in-90 duration-300 max-h-[450px] overflow-y-auto"
          style={{
            left: `${modalPosition.x}px`,
            top: `${modalPosition.y}px`,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2), 0 0 0 2px rgba(var(--primary), 0.5)'
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
            <p className="text-sm max-h-24 overflow-y-auto">{selectedNode.content}</p>
            {selectedNode.index && (
              <div className="mt-2 text-xs text-muted-foreground">
                Comentario #{selectedNode.index}
              </div>
            )}
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
              className="bg-green-500 hover:bg-green-600 text-white font-bold border-2 border-green-700 shadow-md"
              onClick={() => {
                if (onCommentSelect) {
                  console.log("Abriendo comentario en una nueva ventana:", selectedNode.id);
                  
                  // Obtener URL del comentario
                  const commentUrl = `${window.location.origin}/posts/${postId}?comment=${selectedNode.id}`;
                  
                  // Abrir en una nueva ventana/pestaña
                  window.open(commentUrl, '_blank');
                  
                  // También guardar el ID para efectos visuales
                  setSelectedNodeId(selectedNode.id);
                  
                  // Cerrar el modal flotante
                  setInfoModalOpen(false);
                }
              }}
            >
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              Ir al Comentario
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm border border-primary/20 rounded-lg p-3 shadow-lg">
        <div className="text-xs font-medium mb-2 text-white">Leyenda:</div>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-black border border-white"></div>
            <span className="text-xs text-white">Nodo de comentario</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-black opacity-100 border border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>
            <span className="text-xs text-white">Nodo seleccionado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-black opacity-100 border border-white"></div>
            <span className="text-xs text-white">Comentario negativo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-black border border-white relative">
              <div className="absolute inset-0 border-2 border-[#37c6ee] rounded-full border-r-transparent border-b-transparent"></div>
            </div>
            <span className="text-xs text-white">Progreso de votos positivos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-8 bg-[#37c6ee]"></div>
            <span className="text-xs text-white">Conexión entre comentarios</span>
          </div>
        </div>
      </div>
        </div>
  );
}