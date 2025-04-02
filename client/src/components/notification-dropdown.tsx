import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: number;
  userId: number;
  triggeredByUserId: number;
  postId: number;
  commentId?: number;
  parentCommentId?: number;
  mentionedUsername?: string;
  type: 'reply' | 'mention';
  read: boolean;
  createdAt: string;
  triggerUser: {
    username: string;
    role: string;
    badges: string[];
  };
  post: {
    title: string;
  };
}

export default function NotificationDropdown() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Obtener notificaciones
  const { data: notificationsData = [], refetch } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: !!user,
    refetchInterval: 15000,
    refetchOnWindowFocus: true
  });

  // Actualizar el estado local cuando cambian las notificaciones
  useEffect(() => {
    if (notificationsData) {
      setLocalNotifications(notificationsData);
      
      // Actualizar el estado hasUnread
      const unreadCount = notificationsData.filter(n => !n.read).length;
      setHasUnread(unreadCount > 0);

      console.log('Notificaciones actualizadas:', notificationsData);
      console.log('Notificaciones sin leer:', unreadCount);
    }
  }, [notificationsData]);

  // Función para marcar una notificación como leída
  const markAsRead = async (id: number) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, 'PUT');
      
      // Actualizar estado local inmediatamente
      setLocalNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      
      // Verificar si queda alguna notificación sin leer
      const stillHasUnread = localNotifications.some(n => n.id !== id && !n.read);
      setHasUnread(stillHasUnread);
      
      // Recargar datos
      refetch();
      
      return true;
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
      return false;
    }
  };

  // Función para marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      const response = await apiRequest('/api/notifications/read-all', 'PUT');
      console.log('Respuesta marcar todo como leído:', response);
      
      // Actualizar estado local inmediatamente
      setLocalNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setHasUnread(false);
      
      // Recargar datos del servidor
      refetch();
      
      // Notificar al usuario
      toast({
        title: "Notificaciones leídas",
        description: "Todas las notificaciones han sido marcadas como leídas",
        duration: 3000,
      });
      
      // Cerrar el menú
      setOpen(false);
      
      return true;
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
      toast({
        title: "Error",
        description: "No se pudieron marcar las notificaciones como leídas",
        variant: "destructive",
        duration: 3000,
      });
      return false;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Solo marcar como leída si no está leída
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Cerrar el menú
    setOpen(false);
    
    // Mostrar toast
    toast({
      title: "Notificación leída",
      description: `Has leído la notificación de ${notification.triggerUser.username}`,
      duration: 3000,
    });
  };

  const renderNotificationContent = (notification: Notification) => {
    const { triggerUser, type, post } = notification;
    
    return (
      <div>
        <span className="font-bold">{triggerUser.username}</span>
        {triggerUser.badges && triggerUser.badges.length > 0 && (
          <Badge className="ml-1" variant="outline">{triggerUser.badges[0]}</Badge>
        )}
        {type === 'reply' && (
          <span> respondió a tu comentario en <span className="font-medium italic">{post.title}</span></span>
        )}
        {type === 'mention' && (
          <span> te mencionó en un comentario en <span className="font-medium italic">{post.title}</span></span>
        )}
        <div className="text-xs text-muted-foreground mt-1">
          {timeAgo(new Date(notification.createdAt))}
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute top-1 right-1 bg-red-500 rounded-full w-2 h-2"></span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex justify-between items-center border-b p-3">
          <h4 className="font-medium">Notificaciones</h4>
          {localNotifications.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
            >
              Marcar todos como leído
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-auto">
          {localNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No tienes notificaciones
            </div>
          ) : (
            <div>
              {localNotifications.map((notification: Notification) => (
                <div 
                  key={notification.id} 
                  className={`block p-3 border-b hover:bg-accent cursor-pointer ${!notification.read ? 'bg-blue-100/50 dark:bg-blue-900/20' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {renderNotificationContent(notification)}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}