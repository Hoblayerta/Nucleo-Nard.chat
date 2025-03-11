import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
import { Search, ChevronLeft, ChevronRight, UserPlus, Edit, Ban, Save, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { User } from "@shared/schema";

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [tempRole, setTempRole] = useState<string>("");
  const [tempMultiplier, setTempMultiplier] = useState<number>(1);
  
  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  // Filter users based on search query
  const filteredUsers = allUsers.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, role, likeMultiplier }: { id: number, role?: string, likeMultiplier?: number }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, {
        role,
        likeMultiplier
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
  
  const handleEdit = (user: User) => {
    setEditingUser(user.id);
    setTempRole(user.role);
    setTempMultiplier(user.likeMultiplier);
  };
  
  const handleCancelEdit = () => {
    setEditingUser(null);
  };
  
  const handleSaveEdit = (id: number) => {
    updateUserMutation.mutate({
      id,
      role: tempRole,
      likeMultiplier: tempMultiplier
    });
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
                          <i className="fas fa-fire mr-1"></i>
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
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="mr-2 h-8 w-8"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit className="h-4 w-4 text-primary" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="h-8 w-8"
                      >
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
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
        <Button variant="outline" className="text-primary">
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
        
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="h-8 w-8 mr-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Page 1 of 1</span>
          <Button variant="outline" size="icon" className="h-8 w-8 ml-2">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
