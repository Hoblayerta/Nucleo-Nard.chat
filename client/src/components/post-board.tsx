import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  DownloadCloud,
  Shield,
  CheckCircle,
  HandMetal,
  UserCheck,
  Star,
  MoreHorizontal,
  Filter,
  Search,
  Download
} from "lucide-react";
import BadgeIcon from "./badge-icon";
import { Input } from "./ui/input";

// Tipos para los usuarios del PostBoard
interface PostBoardUser {
  id: number;
  username: string;
  role: string;
  badges: string[];
  commentCount: number;
  totalComments: number; // total de comentarios incluyendo respuestas
  upvotes: number;
  downvotes: number;
  netScore: number;
  isIRL: boolean;
  isHandmade: boolean;
  irlVotes: string[]; // nombres de admin/mod que votaron IRL
  handmadeVotes: string[]; // nombres de admin/mod que votaron Handmade
}

interface PostBoardProps {
  postId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function PostBoard({ postId, isOpen, onClose }: PostBoardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filters, setFilters] = useState({
    showIRLOnly: false,
    showHandmadeOnly: false,
    showVerifiedOnly: false,
  });
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [verifyType, setVerifyType] = useState<"irl" | "handmade" | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedVerificationType, setSelectedVerificationType] = useState<"irl" | "handmade" | null>(null);
  const [selectedVerifiers, setSelectedVerifiers] = useState<string[]>([]);

  // Mock data - en una aplicación real, esta información vendría de una API
  const { data: boardUsers = [], isLoading } = useQuery<PostBoardUser[]>({
    queryKey: [`/api/posts/${postId}/board`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/posts/${postId}/board`);
      return res.json();
    },
    enabled: isOpen // Solo cargar datos cuando el panel está abierto
  });

  // Mutación para verificar usuarios
  const verifyUserMutation = useMutation({
    mutationFn: async ({ 
      userId, 
      verificationType, 
      value,
      voter 
    }: { 
      userId: number, 
      verificationType: "irl" | "handmade", 
      value: boolean,
      voter: string
    }) => {
      // Llamada real a la API
      const response = await apiRequest("PUT", `/api/posts/${postId}/verify`, {
        userId: userId,
        verificationType: verificationType,
        value: value,
        voter: voter
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/board`] });
      toast({
        title: "Verificación actualizada",
        description: `La verificación ha sido ${verifyType === 'irl' ? 'IRL' : 'Handmade'} actualizada correctamente.`
      });
      setConfirmDialogOpen(false);
      setSelectedUserId(null);
      setVerifyType(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la verificación. Inténtelo de nuevo.",
        variant: "destructive"
      });
    }
  });

  // Filtrar usuarios basado en la búsqueda y filtros
  const filteredUsers = boardUsers.filter(boardUser => {
    const matchesSearch = boardUser.username.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filters.showIRLOnly && !boardUser.isIRL) return false;
    if (filters.showHandmadeOnly && !boardUser.isHandmade) return false;
    if (filters.showVerifiedOnly && !(boardUser.isIRL || boardUser.isHandmade)) return false;

    return true;
  });

  // Función para manejar la verificación
  const handleVerify = (userId: number, type: "irl" | "handmade", currentValue: boolean) => {
    setSelectedUserId(userId);
    setVerifyType(type);
    setConfirmDialogOpen(true);
  };

  // Función para confirmar la verificación
  const confirmVerify = () => {
    if (selectedUserId !== null && verifyType !== null && user) {
      const currentUser = boardUsers.find(u => u.id === selectedUserId);
      if (!currentUser) return;

      // Verificar si este moderador/admin ya ha votado por este tipo
      const hasVoted = verifyType === 'irl' 
        ? currentUser.irlVotes?.includes(user.username)
        : currentUser.handmadeVotes?.includes(user.username);
      
      // El valor true aquí significa "agregar voto", false significa "quitar voto"
      const newValue = !hasVoted;
      
      console.log(`Verificando usuario ${selectedUserId} para ${verifyType}, valor: ${newValue}, verificador: ${user.username}`);

      verifyUserMutation.mutate({
        userId: selectedUserId,
        verificationType: verifyType,
        value: newValue,
        voter: user.username
      });
    }
  };

  // Función para exportar a Excel
  const exportToExcel = () => {
    // Cabeceras
    const headers = [
      "Nombre",
      "Rol",
      "Insignias",
      "Comentarios directos",
      "Total comentarios (con respuestas)",
      "Upvotes (con multiplicadores)",
      "Downvotes (con multiplicadores)",
      "Puntuación neta (con multiplicadores)",
      "Checker IRL",
      "Checker A mano"
    ];

    const rows = filteredUsers.map(user => [
      user.username,
      user.role,
      user.badges.join(", "),
      user.commentCount.toString(),
      user.totalComments.toString(),
      user.upvotes.toString(),
      user.downvotes.toString(),
      user.netScore.toString(),
      user.isIRL ? `Sí (por: ${user.irlVotes.join(", ")})` : "No",
      user.isHandmade ? `Sí (por: ${user.handmadeVotes.join(", ")})` : "No"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `post-${postId}-board.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportación completada",
      description: "Los datos han sido exportados a CSV correctamente."
    });
  };

  const canVerify = user && (user.role === "admin" || user.role === "moderator");

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 border-b">
          <SheetTitle className="flex items-center">
            <FileSpreadsheet className="mr-2 h-5 w-5" />
            Post Board
          </SheetTitle>
          <SheetDescription>
            Tabla de colaboradores del post con estadísticas y verificaciones.
          </SheetDescription>
        </SheetHeader>

        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar usuario..." 
                className="pl-8 w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <DropdownMenu open={showFilterMenu} onOpenChange={setShowFilterMenu}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="h-4 w-4 mr-1" />
                  Filtros
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Opciones de filtrado</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      setFilters({...filters, showIRLOnly: !filters.showIRLOnly});
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="flex items-center">
                        <UserCheck className="h-4 w-4 mr-2" />
                        Solo verificados IRL
                      </span>
                      <Switch 
                        checked={filters.showIRLOnly} 
                        onCheckedChange={(checked) => setFilters({...filters, showIRLOnly: checked})}
                      />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      setFilters({...filters, showHandmadeOnly: !filters.showHandmadeOnly});
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="flex items-center">
                        <HandMetal className="h-4 w-4 mr-2" />
                        Solo Handmade
                      </span>
                      <Switch 
                        checked={filters.showHandmadeOnly}
                        onCheckedChange={(checked) => setFilters({...filters, showHandmadeOnly: checked})}
                      />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      setFilters({...filters, showVerifiedOnly: !filters.showVerifiedOnly});
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Cualquier verificación
                      </span>
                      <Switch 
                        checked={filters.showVerifiedOnly}
                        onCheckedChange={(checked) => setFilters({...filters, showVerifiedOnly: checked})}
                      />
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <Button 
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setFilters({
                    showIRLOnly: false,
                    showHandmadeOnly: false,
                    showVerifiedOnly: false
                  })}
                >
                  Limpiar filtros
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button onClick={exportToExcel} variant="outline" size="sm" className="ml-auto">
            <Download className="h-4 w-4 mr-1" />
            Exportar a Excel
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              <span className="ml-2">Cargando datos...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-muted-foreground">No se encontraron usuarios que coincidan con los criterios.</p>
            </div>
          ) : (
            <div className="min-w-full overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-[200px]">Usuario</TableHead>
                    <TableHead>Insignias</TableHead>
                    <TableHead className="text-center">Comentarios</TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center text-green-700 font-semibold">
                              Upvotes <span className="ml-1 text-xs">(x mult)</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Votos positivos con multiplicadores aplicados</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center text-red-700 font-semibold">
                              Downvotes <span className="ml-1 text-xs">(x mult)</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Votos negativos con multiplicadores aplicados</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center text-primary font-semibold">
                              Puntuación neta
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Upvotes - Downvotes (con multiplicadores)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center">Verificaciones</TableHead>
                    {canVerify && <TableHead className="text-center">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((boardUser) => (
                    <TableRow key={boardUser.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="font-medium flex items-center">
                            {boardUser.username}
                            {boardUser.role === "admin" && (
                              <Badge variant="outline" className="ml-2 bg-success/20 text-success border-success/30">
                                <Shield className="h-3 w-3 mr-1" /> Admin
                              </Badge>
                            )}
                            {boardUser.role === "moderator" && (
                              <Badge variant="outline" className="ml-2 bg-primary/20 text-primary border-primary/30">
                                <Shield className="h-3 w-3 mr-1" /> Mod
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {boardUser.badges.length > 0 ? (
                            boardUser.badges.map((badge) => (
                              <Badge key={badge} variant="secondary" className="text-xs flex items-center">
                                <BadgeIcon badge={badge} size={14} showLabel={true} />
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs">Sin insignias</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                                {boardUser.commentCount}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Comentarios: {boardUser.commentCount}<br/>
                              Total (con respuestas): {boardUser.totalComments}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center">
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-base px-3 py-1">
                                  <span className="font-bold">+{boardUser.upvotes}</span>
                                </Badge>
                                <span className="text-xs text-green-700 mt-1">Multiplicado</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Total de upvotes con multiplicadores aplicados</p>
                              <p className="text-xs mt-1">Este valor incluye los multiplicadores de cada votante</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center">
                                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-base px-3 py-1">
                                  <span className="font-bold">-{boardUser.downvotes}</span>
                                </Badge>
                                <span className="text-xs text-red-700 mt-1">Multiplicado</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Total de downvotes con multiplicadores aplicados</p>
                              <p className="text-xs mt-1">Este valor incluye los multiplicadores de cada votante</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center">
                                <Badge variant={boardUser.netScore >= 0 ? "default" : "destructive"} className="text-base px-4 py-1">
                                  <span className="font-bold">{boardUser.netScore}</span>
                                </Badge>
                                <span className="text-xs text-muted-foreground mt-1">Net Score</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">Puntuación neta: {boardUser.netScore}</p>
                              <div className="flex items-center justify-between gap-3 mt-1">
                                <span className="text-green-600">+{boardUser.upvotes} upvotes</span>
                                <span className="text-red-600">-{boardUser.downvotes} downvotes</span>
                              </div>
                              <p className="text-xs mt-2">Todos los valores incluyen multiplicadores</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-full text-xs mb-1 text-center">
                            Verificado por:
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              className="p-0 h-auto" 
                              onClick={() => {
                                if (boardUser.irlVotes?.length > 0) {
                                  setSelectedVerificationType("irl");
                                  setSelectedVerifiers(boardUser.irlVotes);
                                  setSelectedUserId(boardUser.id);
                                  setDetailsDialogOpen(true);
                                }
                              }}
                            >
                              <Badge 
                                variant={boardUser.isIRL ? "default" : "outline"} 
                                className={boardUser.isIRL 
                                  ? "bg-blue-500 hover:bg-blue-600 cursor-pointer" 
                                  : "text-muted-foreground"
                                }
                              >
                                <UserCheck className="h-3 w-3 mr-1" />
                                IRL {boardUser.isIRL ? `(${boardUser.irlVotes?.length || 0})` : '(No)'}
                              </Badge>
                            </Button>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              className="p-0 h-auto" 
                              onClick={() => {
                                if (boardUser.handmadeVotes?.length > 0) {
                                  setSelectedVerificationType("handmade");
                                  setSelectedVerifiers(boardUser.handmadeVotes);
                                  setSelectedUserId(boardUser.id);
                                  setDetailsDialogOpen(true);
                                }
                              }}
                            >
                              <Badge 
                                variant={boardUser.isHandmade ? "default" : "outline"} 
                                className={boardUser.isHandmade 
                                  ? "bg-amber-500 hover:bg-amber-600 cursor-pointer" 
                                  : "text-muted-foreground"
                                }
                              >
                                <HandMetal className="h-3 w-3 mr-1" />
                                Handmade {boardUser.isHandmade ? `(${boardUser.handmadeVotes?.length || 0})` : '(No)'}
                              </Badge>
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      {canVerify && (
                        <TableCell>
                          <div className="flex justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Verificar usuario</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleVerify(boardUser.id, "irl", boardUser.isIRL)}
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  {user && boardUser.irlVotes?.includes(user.username) 
                                    ? "Quitar mi verificación IRL" 
                                    : "Agregar mi verificación IRL"}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleVerify(boardUser.id, "handmade", boardUser.isHandmade)}
                                >
                                  <HandMetal className="h-4 w-4 mr-2" />
                                  {user && boardUser.handmadeVotes?.includes(user.username) 
                                    ? "Quitar mi verificación Handmade" 
                                    : "Agregar mi verificación Handmade"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>

      {/* Diálogo de confirmación para verificación */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {verifyType === 'irl' 
                ? "Verificación IRL" 
                : "Verificación Handmade"
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                if (!selectedUserId || !user) return "";
                
                const currentUser = boardUsers.find(u => u.id === selectedUserId);
                if (!currentUser) return "";
                
                // Verificar si este moderador/admin ya ha votado por este tipo
                const hasVoted = verifyType === 'irl' 
                  ? currentUser.irlVotes?.includes(user.username)
                  : currentUser.handmadeVotes?.includes(user.username);
                
                if (verifyType === 'irl') {
                  return hasVoted 
                    ? `¿Estás seguro de que deseas quitar TU verificación IRL de ${currentUser.username}? Otros moderadores pueden haber verificado también.` 
                    : `¿Estás seguro de que deseas agregar TU verificación IRL a ${currentUser.username}?`;
                } else {
                  return hasVoted
                    ? `¿Estás seguro de que deseas quitar TU verificación Handmade de ${currentUser.username}? Otros moderadores pueden haber verificado también.`
                    : `¿Estás seguro de que deseas agregar TU verificación Handmade a ${currentUser.username}?`;
                }
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVerify}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Diálogo de detalles de verificación */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedVerificationType === 'irl' ? (
                <>
                  <UserCheck className="h-5 w-5 text-blue-500" />
                  Detalles de Verificación IRL
                </>
              ) : (
                <>
                  <HandMetal className="h-5 w-5 text-amber-500" />
                  Detalles de Verificación Handmade
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedUserId && (
                <span>
                  Usuario: <strong>{boardUsers.find(u => u.id === selectedUserId)?.username}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <h3 className="font-medium mb-2">Verificado por:</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-4">
              {selectedVerifiers.length === 0 ? (
                <p className="text-muted-foreground">No hay verificadores</p>
              ) : (
                selectedVerifiers.map((verifier, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border-b last:border-0">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <span className="font-medium">{verifier}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {boardUsers.find(u => u.username === verifier)?.role === 'admin' ? 'Administrador' : 'Moderador'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setDetailsDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}