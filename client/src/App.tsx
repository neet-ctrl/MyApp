import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UILayoutProvider } from "@/contexts/ui-layout-context";
import { ErrorBoundary, setupGlobalErrorHandling } from "@/components/ErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import Home from "@/pages/home";
import DownloadsPage from "@/pages/DownloadsPage";
import GitControl from "@/components/git-control";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/downloads" component={DownloadsPage} />
      <Route path="/git-control" component={GitControl} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { toast } = useToast();
  
  useEffect(() => {
    // Set up global error handling
    setupGlobalErrorHandling();
    
    // Listen for app errors
    const handleAppError = (event: CustomEvent) => {
      const { type, message } = event.detail;
      
      toast({
        variant: 'destructive',
        title: 'Application Error',
        description: message || 'An unexpected error occurred',
        duration: 5000,
      });
      
      console.error('App error:', event.detail);
    };
    
    window.addEventListener('app-error', handleAppError as EventListener);
    
    return () => {
      window.removeEventListener('app-error', handleAppError as EventListener);
    };
  }, [toast]);
  
  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary
        onError={(error, errorInfo) => {
          console.error('App-level error boundary caught:', error, errorInfo);
          
          // Try to save any critical data before crash
          try {
            const criticalData = {
              timestamp: new Date().toISOString(),
              error: error.message,
              stack: error.stack,
              componentStack: errorInfo.componentStack
            };
            localStorage.setItem('last-error', JSON.stringify(criticalData));
          } catch (e) {
            console.warn('Failed to save error data:', e);
          }
        }}
      >
        <UILayoutProvider>
          <TooltipProvider>
            <Toaster />
            <AppContent />
          </TooltipProvider>
        </UILayoutProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
