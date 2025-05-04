import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./lib/auth";
import { useAuth } from "./lib/auth";
import { SlowModeProvider } from "@/hooks/use-slow-mode";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Leaderboard from "@/pages/leaderboard";
import Profile from "@/pages/profile";
import Post from "@/pages/post";
import TreeView from "@/pages/tree-view";
import CommentVisualizer from "@/pages/comment-visualizer";
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
      <Switch>
        <Route path="/tree/:id">
          <TreeView />
        </Route>
        <Route>
          <Header />
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/leaderboard" component={Leaderboard} />
            <Route path="/profile/:id" component={Profile} />
            <Route path="/posts/:id" component={Post} />
            <Route path="/visualizer" component={CommentVisualizer} />
            <Route component={NotFound} />
          </Switch>
        </Route>
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SlowModeProvider>
          <Router />
          <Toaster />
        </SlowModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
