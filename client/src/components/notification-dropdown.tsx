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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Obtener notificaciones
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: !!user,
    refetchInterval: 15000, // Refrescar cada 15 segundos
    refetchOnWindowFocus: true
  });

  // Verificar si hay notificaciones no leídas cada vez que cambian las notificaciones
  useEffect(() => {
    if (!user || !notifications.length) {
      setHasUnread(false);
      return;
    }
    
    const unreadCount = notifications.filter(n => !n.read).length;
    setHasUnread(unreadCount > 0);
  }, [notifications, user]);

  // Marcar una notificación como leída - versión simplificada
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/notifications/${id}/read`, 'PUT');
    },
    onSuccess: () => {
      // Simplemente actualizar todas las notificaciones después de marcar una como leída
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  // Marcar todas las notificaciones como leídas - versión simplificada
  const markAllAsReadMutation = useMutation({
    mutationFn: () => {
      return apiRequest('/api/notifications/read-all', 'PUT');
    },
    onSuccess: () => {
      // Actualizar notificaciones y quitar el punto rojo
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      setHasUnread(false);
      
      // Mostrar confirmación
      toast({
        title: "Notificaciones leídas",
        description: "Todas las notificaciones han sido marcadas como leídas",
        duration: 3000,
      });
      
      // Cerrar el menú
      setOpen(false);
    }
  });

  const handleNotificationClick = (notification: Notification) => {
    // Marcar como leída si no está leída
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Cerrar menú
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
          {notifications.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
              Marcar todos como leído
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No tienes notificaciones
            </div>
          ) : (
            <div>
              {notifications.map((notification: Notification) => (
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