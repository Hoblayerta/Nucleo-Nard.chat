import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { CommentWithUser } from '@shared/schema';
import { X, Minimize2, Maximize2 } from 'lucide-react';
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
}

interface CommentTreeViewProps {
  postId: number;
  onClose: () => void;
  onCommentSelect?: (commentId: number) => void;
}

const CANVAS_PADDING = 40;
const NODE_RADIUS = 20;
const SMALL_NODE_RADIUS = 10;
const NODE_SPACING_H = 60;
const NODE_SPACING_V = 80;
const LINE_WIDTH = 2;
const COLOR_PALETTE = [
  '#1abc9c', // Turquoise
  '#2ecc71', // Emerald
  '#3498db', // Peter River
  '#9b59b6', // Amethyst
  '#f1c40f', // Sunflower
  '#e67e22', // Carrot
  '#e74c3c', // Alizarin
  '#d35400', // Pumpkin
  '#8e44ad', // Wisteria
  '#16a085', // Green Sea
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
  const isMobile = useIsMobile();

  // Fetch comments data
  const { data: comments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: [`/api/posts/${postId}/comments`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/posts/${postId}/comments`);
      return res.json();
    },
  });

  // Build the comment tree
  useEffect(() => {
    if (comments.length > 0) {
      // Convert flat comments to hierarchical tree
      const commentMap = new Map<number, CommentNode>();
      
      // First pass: create all nodes
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
      
      // Second pass: build the tree structure
      const rootNodes: CommentNode[] = [];
      
      comments.forEach(comment => {
        const node = commentMap.get(comment.id);
        if (node) {
          if (comment.parentId) {
            const parentNode = commentMap.get(comment.parentId);
            if (parentNode) {
              parentNode.children.push(node);
              node.level = parentNode.level + 1;
            }
          } else {
            rootNodes.push(node);
          }
        }
      });
      
      // Create a virtual root if there are multiple root comments
      const virtualRoot: CommentNode = {
        id: 0,
        content: "Root",
        userId: 0,
        username: "root",
        role: "system",
        badges: [],
        upvotes: 0,
        downvotes: 0,
        voteScore: 0,
        children: rootNodes,
        level: -1
      };
      
      // Calculate best path (canonical path with highest votes)
      markBestPath(virtualRoot);
      
      // Calculate positions for all nodes
      calculateNodePositions(virtualRoot);
      
      setTree(virtualRoot);
    }
  }, [comments]);

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
  function calculateNodePositions(node: CommentNode, depth = 0, index = 0, siblingCount = 1) {
    // For the invisible root node
    if (node.level === -1) {
      node.x = 0;
      node.y = 0;
      
      // Position all children
      let childIndex = 0;
      node.children.forEach(child => {
        calculateNodePositions(child, 0, childIndex, node.children.length);
        childIndex++;
      });
      
      return;
    }
    
    // Calculate node's position
    const horizontalSpacing = NODE_SPACING_H * (siblingCount > 1 ? 1.5 : 1);
    node.x = index * horizontalSpacing - ((siblingCount - 1) * horizontalSpacing / 2);
    node.y = depth * NODE_SPACING_V;
    
    // Position all children
    let childIndex = 0;
    node.children.forEach(child => {
      calculateNodePositions(child, depth + 1, childIndex, node.children.length);
      childIndex++;
    });
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
    // Skip drawing the virtual root
    if (node.level === -1) {
      // Draw all children of root
      node.children.forEach(child => {
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
      
      // Curved line
      const controlPointY = (y + childY) / 2 + 20;
      
      // Set line color and width
      ctx.strokeStyle = isOnBestPath ? '#2ecc71' : COLOR_PALETTE[node.level % COLOR_PALETTE.length];
      ctx.lineWidth = isOnBestPath ? LINE_WIDTH * 1.5 : LINE_WIDTH;
      
      // Draw bezier curve
      ctx.bezierCurveTo(
        x, controlPointY,
        childX, controlPointY,
        childX, childY - (child.negativeScore ? SMALL_NODE_RADIUS : NODE_RADIUS)
      );
      
      ctx.stroke();
    });
    
    // Draw all children nodes
    node.children.forEach(child => {
      if (!child.collapsed) {
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
    // Skip the virtual root
    if (node.level === -1) {
      // Check all children of root
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
        <h3 className="text-lg font-medium">Visualización de Comentarios</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Controls */}
      <div className="absolute top-16 left-4 z-10 flex flex-col gap-2">
        <Button variant="outline" size="icon" onClick={handleZoomIn}>
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomOut}>
          <Minimize2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleResetView}>
          Reset
        </Button>
      </div>

      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          <span className="ml-2">Cargando comentarios...</span>
        </div>
      ) : (
        <div className="h-full w-full overflow-hidden">
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-move"
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