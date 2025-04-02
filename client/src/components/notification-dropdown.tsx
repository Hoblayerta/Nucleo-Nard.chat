import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: !!user,
    refetchInterval: 30000, // Refrescar cada 30 segundos
    refetchOnWindowFocus: true
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(`/api/notifications/${notificationId}/read`, 'PUT');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      
      // Verificar si esta era la última notificación sin leer
      const remainingUnread = notifications.filter(
        notification => notification.read === false && notification.id !== notificationId
      );
      
      if (remainingUnread.length === 0) {
        setHasUnread(false);
      }
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/notifications/read-all', 'PUT');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      setHasUnread(false);
      // Mostrar toast de confirmación
      toast({
        title: "Notificaciones leídas",
        description: "Todas las notificaciones han sido marcadas como leídas",
        duration: 3000,
      });
    }
  });

  useEffect(() => {
    // Verificar si hay notificaciones no leídas
    if (notifications?.length > 0) {
      const unread = notifications.some((notification: Notification) => !notification.read);
      setHasUnread(unread);
    } else {
      setHasUnread(false);
    }
  }, [notifications]);

  const handleNotificationClick = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
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
                  onClick={() => {
                    // Simplemente marcar la notificación como leída
                    handleNotificationClick(notification.id);
                    // Cerrar el menú de notificaciones
                    setOpen(false);
                    
                    // Mostrar un toast confirmando que la notificación fue leída
                    toast({
                      title: "Notificación leída",
                      description: `Has leído la notificación de ${notification.triggerUser.username}`,
                      duration: 3000,
                    });
                  }}
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