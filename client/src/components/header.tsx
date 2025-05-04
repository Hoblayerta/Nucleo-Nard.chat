import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Menu, User, Shield, LogOut } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import AdminPanel from "./admin/admin-panel";
import NotificationDropdown from "./notification-dropdown";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

export default function Header() {
  const [location, setLocation] = useLocation();
  const { user, isAdmin, isModerator, login, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleLogin = async (values: z.infer<typeof loginSchema>) => {
    try {
      await login(values.username, values.password);
      setLoginOpen(false);
      toast({
        title: "Logged in successfully",
        description: `Welcome back, ${values.username}!`,
      });
      loginForm.reset();
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
    }
  };

  // La función handleRegister se ha eliminado ya que solo los administradores pueden crear usuarios

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Logged out successfully",
      description: "See you soon!",
    });
  };

  return (
    <>
      <header className="bg-card border-b border-border py-3 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center gap-2">
              <img src="/assets/nard-chat-logo.png" alt="Nard.chat Logo" className="h-9" />
              <div className="flex flex-col">
                <span className="text-xl font-bold leading-tight">Nard.chat</span>
                <span className="text-xs font-medium leading-tight text-blue-400">NARRATIVAS DESCENTRALIZADAS</span>
              </div>
            </Link>
            
            <div className="hidden md:flex space-x-2">
              <Link href="/" className={`px-3 py-1 rounded-md ${location === '/' ? 'bg-primary/10 text-primary' : 'hover:bg-card/80'}`}>Home</Link>
              <Link href="/leaderboard" className={`px-3 py-1 rounded-md ${location === '/leaderboard' ? 'bg-primary/10 text-primary' : 'hover:bg-card/80'}`}>Leaderboard</Link>
              <Link href="/visualizer" className={`px-3 py-1 rounded-md ${location === '/visualizer' ? 'bg-primary/10 text-primary' : 'hover:bg-card/80'}`}>Visualizador</Link>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Input
                type="text"
                placeholder="Search..."
                className="w-64 bg-background border border-border pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            
            {user ? (
              <div className="flex items-center gap-3">
                {/* Icono de notificaciones */}
                <NotificationDropdown />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative rounded-full">
                      <User className="h-5 w-5 text-primary" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.role} • x{user.likeMultiplier} multiplier
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/profile/${user.id}`} className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" /> Profile
                      </Link>
                    </DropdownMenuItem>
                    {isModerator && (
                      <DropdownMenuItem onClick={() => setAdminPanelOpen(true)} className="cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" /> Admin Panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" /> Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {isModerator && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="hidden md:flex"
                    onClick={() => setAdminPanelOpen(true)}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    <span>{isAdmin ? "Admin" : "Mod"}</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setLoginOpen(true)}>
                  Log In
                </Button>
              </div>
            )}
            
            <Button variant="outline" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 border-t border-border pt-3 px-2">
            <div className="space-y-2">
              <Link 
                href="/" 
                className={`block px-3 py-2 rounded-md ${location === '/' ? 'bg-primary/10 text-primary' : 'hover:bg-card/80'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                href="/leaderboard" 
                className={`block px-3 py-2 rounded-md ${location === '/leaderboard' ? 'bg-primary/10 text-primary' : 'hover:bg-card/80'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Leaderboard
              </Link>
              
              <Link 
                href="/visualizer" 
                className={`block px-3 py-2 rounded-md ${location === '/visualizer' ? 'bg-primary/10 text-primary' : 'hover:bg-card/80'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Visualizador
              </Link>
              
              <div className="relative my-3">
                <Input
                  type="text"
                  placeholder="Search..."
                  className="w-full bg-background border border-border pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              
              {isModerator && (
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAdminPanelOpen(true);
                  }}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  <span>{isAdmin ? "Admin Panel" : "Moderator Panel"}</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </header>
      
      {/* Login Dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log In</DialogTitle>
            <DialogDescription>
              Enter your credentials to access your account
            </DialogDescription>
          </DialogHeader>
          
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <FormField
                control={loginForm.control}
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
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} autoComplete="current-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="flex justify-end">
                <Button type="submit" disabled={loginForm.formState.isSubmitting}>
                  {loginForm.formState.isSubmitting ? "Logging in..." : "Log In"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* El diálogo de registro se ha eliminado ya que solo los administradores pueden crear usuarios */}
      
      {/* Admin/Moderator Panel */}
      {isModerator && adminPanelOpen && (
        <AdminPanel open={adminPanelOpen} onClose={() => setAdminPanelOpen(false)} />
      )}
    </>
  );
}
