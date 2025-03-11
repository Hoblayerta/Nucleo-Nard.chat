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
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

const registerSchema = loginSchema;

export default function Header() {
  const [location, setLocation] = useLocation();
  const { user, isAdmin, login, logout, register } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
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

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
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

  const handleRegister = async (values: z.infer<typeof registerSchema>) => {
    try {
      await register(values.username, values.password);
      setRegisterOpen(false);
      toast({
        title: "Registration successful",
        description: `Welcome, ${values.username}!`,
      });
      registerForm.reset();
    } catch (error) {
      toast({
        title: "Registration failed",
        description: "Username may already be taken",
        variant: "destructive",
      });
    }
  };

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
            <Link href="/" className="text-xl font-bold flex items-center">
              <i className="fas fa-comments text-primary mr-2"></i>
              <span>ComentaForo</span>
            </Link>
            
            <div className="hidden md:flex space-x-2">
              <Link href="/" className={`px-3 py-1 rounded-md ${location === '/' ? 'bg-primary/10 text-primary' : 'hover:bg-card/80'}`}>Home</Link>
              <Link href="/leaderboard" className={`px-3 py-1 rounded-md ${location === '/leaderboard' ? 'bg-primary/10 text-primary' : 'hover:bg-card/80'}`}>Leaderboard</Link>
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
                    {isAdmin && (
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
                
                {isAdmin && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="hidden md:flex"
                    onClick={() => setAdminPanelOpen(true)}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Admin</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setLoginOpen(true)}>
                  Log In
                </Button>
                <Button size="sm" onClick={() => setRegisterOpen(true)}>
                  Sign Up
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
              
              {isAdmin && (
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAdminPanelOpen(true);
                  }}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Admin Panel</span>
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
              
              <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setLoginOpen(false);
                    setRegisterOpen(true);
                  }}
                >
                  Create Account
                </Button>
                <Button type="submit" disabled={loginForm.formState.isSubmitting}>
                  {loginForm.formState.isSubmitting ? "Logging in..." : "Log In"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Register Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Account</DialogTitle>
            <DialogDescription>
              Enter your details to create a new account
            </DialogDescription>
          </DialogHeader>
          
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
              <FormField
                control={registerForm.control}
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
                control={registerForm.control}
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
              
              <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setRegisterOpen(false);
                    setLoginOpen(true);
                  }}
                >
                  Already have an account
                </Button>
                <Button type="submit" disabled={registerForm.formState.isSubmitting}>
                  {registerForm.formState.isSubmitting ? "Creating account..." : "Create Account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Admin Panel */}
      {isAdmin && adminPanelOpen && (
        <AdminPanel open={adminPanelOpen} onClose={() => setAdminPanelOpen(false)} />
      )}
    </>
  );
}
