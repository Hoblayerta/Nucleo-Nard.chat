import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./lib/auth";
import { useAuth } from "./lib/auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Leaderboard from "@/pages/leaderboard";
import Profile from "@/pages/profile";
import Post from "@/pages/post";
import Header from "@/components/header";

// AuthRoute component to protect routes
function AuthRoute({ component: Component, adminOnly = false, ...rest }: any) {
  const { user, isLoading, isAdmin } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }
  
  if (!user) {
    return <Home />;
  }
  
  if (adminOnly && !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
      </div>
    </div>;
  }
  
  return <Component {...rest} />;
}

function Router() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/profile/:id" component={Profile} />
        <Route path="/posts/:id" component={Post} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
