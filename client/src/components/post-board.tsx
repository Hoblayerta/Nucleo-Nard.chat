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
  replyCount: number;
  totalComments: number;
  totalLikes: number;
  upvotes: number;
  downvotes: number;
  netScore: number;
  isIRL: boolean;
  isHandmade: boolean;
  irlVotes: string[]; // Array de nombres de admin/mod que votaron
  handmadeVotes: string[]; // Array de nombres de admin/mod que votaron
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
    if (selectedUserId !== null && verifyType !== null) {
      const currentUser = boardUsers.find(u => u.id === selectedUserId);
      if (!currentUser) return;

      const newValue = verifyType === 'irl' ? !currentUser.isIRL : !currentUser.isHandmade;

      verifyUserMutation.mutate({
        userId: selectedUserId,
        verificationType: verifyType,
        value: newValue,
        voter: user?.username || ""
      });
    }
  };

  // Función para exportar a Excel
  const exportToExcel = () => {
    // Cabeceras principales
    const mainHeaders = [
      "Usuario",
      "Rol",
      "Insignias",
      "Actividad",
      "",
      "",
      "",
      "Votos",
      "",
      "",
      "Verificaciones",
      "",
      "",
      ""
    ];

    // Subcabeceras
    const subHeaders = [
      "", // Usuario
      "", // Rol
      "", // Insignias
      "Comentarios",
      "Replies",
      "Total",
      "Total Likes",
      "Upvotes",
      "Downvotes",
      "Net Score",
      "IRL",
      "Votos IRL",
      "Handmade",
      "Votos Handmade"
    ];

    const rows = filteredUsers.map(user => [
      user.username,
      user.role,
      user.badges.join(", "),
      user.commentCount.toString(),
      user.replyCount.toString(),
      user.totalComments.toString(),
      user.totalLikes.toString(),
      user.upvotes.toString(),
      user.downvotes.toString(),
      user.netScore.toString(),
      user.isIRL ? "Sí" : "No",
      user.irlVotes.join(", "),
      user.isHandmade ? "Sí" : "No",
      user.handmadeVotes.join(", ")
    ]);

    const csvContent = [
      mainHeaders.join(","),
      subHeaders.join(","),
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
                    <TableHead className="text-center">Replies</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Total Likes</TableHead>
                    <TableHead className="text-center">Upvotes</TableHead>
                    <TableHead className="text-center">Downvotes</TableHead>
                    <TableHead className="text-center">Net Score</TableHead>
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
                        {boardUser.commentCount}
                      </TableCell>
                      <TableCell className="text-center">
                        {boardUser.replyCount}
                      </TableCell>
                      <TableCell className="text-center">
                        {boardUser.totalComments}
                      </TableCell>
                      <TableCell className="text-center">
                        {boardUser.totalLikes}
                      </TableCell>
                      <TableCell className="text-center">
                        {boardUser.upvotes}
                      </TableCell>
                      <TableCell className="text-center">
                        {boardUser.downvotes}
                      </TableCell>
                      <TableCell className="text-center">
                        {boardUser.netScore}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <Badge 
                              variant={boardUser.isIRL ? "default" : "outline"} 
                              className={boardUser.isIRL 
                                ? "bg-blue-500 hover:bg-blue-600" 
                                : "text-muted-foreground"
                              }
                            >
                              <UserCheck className="h-3 w-3 mr-1" />
                              IRL ({boardUser.irlVotes.length > 0 ? boardUser.irlVotes.join(', ') : 'No'})
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge 
                              variant={boardUser.isHandmade ? "default" : "outline"} 
                              className={boardUser.isHandmade 
                                ? "bg-amber-500 hover:bg-amber-600" 
                                : "text-muted-foreground"
                              }
                            >
                              <HandMetal className="h-3 w-3 mr-1" />
                              Handmade ({boardUser.handmadeVotes.length > 0 ? boardUser.handmadeVotes.join(', ') : 'No'})
                            </Badge>
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
                                  {boardUser.isIRL ? "Quitar verificación IRL" : "Verificar como IRL"}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleVerify(boardUser.id, "handmade", boardUser.isHandmade)}
                                >
                                  <HandMetal className="h-4 w-4 mr-2" />
                                  {boardUser.isHandmade ? "Quitar Handmade" : "Marcar como Handmade"}
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
              {verifyType === 'irl' 
                ? (selectedUserId && boardUsers.find(u => u.id === selectedUserId)?.isIRL 
                  ? "¿Estás seguro de que deseas quitar la verificación IRL de este usuario?" 
                  : "¿Estás seguro de que deseas verificar a este usuario como IRL?")
                : (selectedUserId && boardUsers.find(u => u.id === selectedUserId)?.isHandmade 
                  ? "¿Estás seguro de que deseas quitar la verificación Handmade de este usuario?" 
                  : "¿Estás seguro de que deseas verificar a este usuario como Handmade?")
              }
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
    </Sheet>
  );
}