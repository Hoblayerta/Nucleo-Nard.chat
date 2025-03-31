import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { Search, ChevronLeft, ChevronRight, UserPlus, Edit, Trash2, Save, X, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { User } from "@shared/schema";
import { BADGES } from "@shared/schema";

// Esquema de validación para creación de usuario
const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(4, "Password must be at least 4 characters"),
  role: z.enum(["user", "moderator", "admin"]).default("user"),
  likeMultiplier: z.number().min(1).max(10).default(1),
  badges: z.array(z.string()).default([])
});

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [tempRole, setTempRole] = useState<string>("");
  const [tempMultiplier, setTempMultiplier] = useState<number>(1);
  const [tempBadges, setTempBadges] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);
  
  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  const createUserForm = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "user",
      likeMultiplier: 1,
      badges: []
    },
  });
  
  const createUserMutation = useMutation({
    mutationFn: async (userData: z.infer<typeof createUserSchema>) => {
      const res = await apiRequest("POST", `/api/auth/register`, userData);
      if (!res.ok) throw new Error("Failed to create user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddUserOpen(false);
      createUserForm.reset();
      toast({
        title: "User created",
        description: "New user has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Creation failed",
        description: "Failed to create user. Username may already be taken.",
        variant: "destructive",
      });
    }
  });
  
  // Filter users based on search query
  const filteredUsers = allUsers.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, role, likeMultiplier, badges }: { id: number, role?: string, likeMultiplier?: number, badges?: string[] }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, {
        role,
        likeMultiplier,
        badges
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({
        title: "User updated",
        description: "User details have been updated successfully."
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`);
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setConfirmDelete(null);
      toast({
        title: "User deleted",
        description: "User has been removed from the platform."
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const handleEdit = (user: User) => {
    setEditingUser(user.id);
    setTempRole(user.role);
    setTempMultiplier(user.likeMultiplier);
    setTempBadges(user.badges || []);
    
    // Si es moderador y está editando un usuario normal, solo deja editar badges
    if (!isAdmin && user.role === "user") {
      setBadgeDialogOpen(true);
    }
  };
  
  const handleCancelEdit = () => {
    setEditingUser(null);
  };
  
  const handleSaveEdit = (id: number) => {
    // Si es moderador, solo puede editar badges de usuarios normales
    if (!isAdmin) {
      updateUserMutation.mutate({
        id,
        badges: tempBadges
      });
    } else {
      // Admins pueden modificar todo
      updateUserMutation.mutate({
        id,
        role: tempRole,
        likeMultiplier: tempMultiplier,
        badges: tempBadges
      });
    }
  };

  const handleBadgeEdit = (userId: number) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setEditingUser(userId);
      setTempRole(user.role);
      setTempMultiplier(user.likeMultiplier);
      setTempBadges(user.badges || []);
      setBadgeDialogOpen(true);
    }
  };

  const handleBadgeChange = (badge: string) => {
    if (tempBadges.includes(badge)) {
      setTempBadges(tempBadges.filter(b => b !== badge));
    } else {
      setTempBadges([...tempBadges, badge]);
    }
  };

  const handleDelete = (id: number) => {
    setConfirmDelete(id);
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteUserMutation.mutate(confirmDelete);
    }
  };
  
  const handleAddUser = (values: z.infer<typeof createUserSchema>) => {
    createUserMutation.mutate(values);
  };
  
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4 text-muted-foreground">Loading user data...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium mb-2">User and Multiplier Management</h3>
          <div className="relative">
            <Input
              placeholder="Search user..."
              className="bg-card w-64 pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          Assign roles and like multipliers to users in your community.
        </p>
      </div>
      
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-card/50">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Multiplier</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} className={editingUser === user.id ? "bg-primary/5" : ""}>
                <TableCell>
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {user.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.username}</div>
                      <div className="text-xs text-muted-foreground">ID: {user.id}</div>
                      {user.badges && user.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {user.badges.map((badge) => (
                            <Badge key={badge} variant="secondary" className="text-xs px-1">
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                
                <TableCell>
                  {editingUser === user.id ? (
                    <Select
                      value={tempRole}
                      onValueChange={setTempRole}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      {user.role === "admin" && (
                        <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                          Admin
                        </Badge>
                      )}
                      {user.role === "moderator" && (
                        <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                          Moderator
                        </Badge>
                      )}
                      {user.role === "user" && (
                        <Badge variant="outline">
                          User
                        </Badge>
                      )}
                    </>
                  )}
                </TableCell>
                
                <TableCell>
                  {editingUser === user.id ? (
                    <div className="flex items-center">
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={tempMultiplier}
                        onChange={(e) => setTempMultiplier(parseInt(e.target.value))}
                        className="w-16 text-center"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span className="mr-1">x{user.likeMultiplier}</span>
                      {user.likeMultiplier > 1 && (
                        <span className="text-success text-xs flex items-center">
                          {user.likeMultiplier}x Multiplier
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                
                <TableCell className="text-right">
                  {editingUser === user.id ? (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mr-2 bg-success/10 hover:bg-success/20 border-success/30 text-success"
                        onClick={() => handleSaveEdit(user.id)}
                        disabled={updateUserMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCancelEdit}
                        disabled={updateUserMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Limitaciones para moderadores:
                          - No pueden editar a otros moderadores o admins
                          - No pueden modificar roles o multiplicadores */}
                      {(isAdmin || user.role === "user") && (
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="mr-2 h-8 w-8"
                          onClick={() => handleEdit(user)}
                          title={isAdmin ? "Edit user" : "Edit badges only"}
                        >
                          <Edit className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="mr-2 h-8 w-8 bg-primary/10 hover:bg-primary/20 text-primary border-primary/30"
                        onClick={() => handleBadgeEdit(user.id)}
                        title="Edit badges"
                      >
                        <span className="text-xs font-bold">B</span>
                      </Button>
                      
                      {/* Solo los admins pueden eliminar usuarios */}
                      {isAdmin && (
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8 bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30"
                          onClick={() => handleDelete(user.id)}
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No users found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex justify-between mt-4">
        {isAdmin && (
          <Button 
            variant="outline" 
            className="text-primary"
            onClick={() => setAddUserOpen(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
        
        <div className={`flex items-center ${isAdmin ? '' : 'ml-auto'}`}>
          <Button variant="outline" size="icon" className="h-8 w-8 mr-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Page 1 of 1</span>
          <Button variant="outline" size="icon" className="h-8 w-8 ml-2">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dialog para crear usuario */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the platform. Only administrators can create new accounts.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createUserForm}>
            <form onSubmit={createUserForm.handleSubmit(handleAddUser)} className="space-y-4">
              <FormField
                control={createUserForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createUserForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} autoComplete="new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createUserForm.control}
                name="likeMultiplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Like Multiplier</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1" 
                        max="10" 
                        {...field} 
                        value={field.value.toString()}
                        onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createUserForm.control}
                name="badges"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Badges</FormLabel>
                    <div className="border rounded-md p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {BADGES.map((badge) => (
                          <div className="flex items-center space-x-2" key={badge}>
                            <Checkbox
                              id={`create-badge-${badge}`}
                              checked={field.value.includes(badge)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, badge]);
                                } else {
                                  field.onChange(field.value.filter(b => b !== badge));
                                }
                              }}
                            />
                            <label
                              htmlFor={`create-badge-${badge}`}
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              {badge}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createUserMutation.isPending}
                  className="bg-success hover:bg-success/90"
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar eliminación */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this user account and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Dialog para editar insignias */}
      <Dialog open={badgeDialogOpen} onOpenChange={setBadgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage User Badges</DialogTitle>
            <DialogDescription>
              Assign badges to recognize user contributions and status.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="grid grid-cols-2 gap-4">
              {BADGES.map((badge) => (
                <div 
                  key={badge} 
                  className="flex items-center space-x-2 border rounded-md p-2 hover:bg-accent/50 transition-colors"
                >
                  <Checkbox 
                    id={`badge-${badge}`} 
                    checked={tempBadges.includes(badge)}
                    onCheckedChange={() => handleBadgeChange(badge)}
                  />
                  <label 
                    htmlFor={`badge-${badge}`}
                    className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {badge}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => {
                handleSaveEdit(editingUser!);
                setBadgeDialogOpen(false);
              }}
              className="bg-success hover:bg-success/90"
              disabled={updateUserMutation.isPending}
            >
              Save Badges
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
