import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { UILayoutProvider } from "@/contexts/ui-layout-context";
import { Terminal } from "lucide-react";
import Home from "@/pages/home";
import DownloadsPage from "@/pages/DownloadsPage";
import GitControl from "@/components/git-control";
import TextMemoPage from "@/pages/TextMemoPage";
import NotFound from "@/pages/not-found";
import Console from "@/components/Console";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/downloads" component={DownloadsPage} />
      <Route path="/git-control" component={GitControl} />
      <Route path="/text-memo" component={TextMemoPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <UILayoutProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          
          {/* Console Component */}
          <Console 
            isOpen={isConsoleOpen} 
            onClose={() => setIsConsoleOpen(false)} 
          />
          
          {/* Floating Console Button */}
          {!isConsoleOpen && (
            <Button
              size="sm"
              onClick={() => setIsConsoleOpen(true)}
              className="fixed bottom-4 right-4 z-50 rounded-full w-12 h-12 p-0 shadow-lg bg-primary hover:bg-primary/90"
              data-testid="button-open-console"
            >
              <Terminal className="h-5 w-5" />
            </Button>
          )}
        </TooltipProvider>
      </UILayoutProvider>
    </QueryClientProvider>
  );
}

export default App;
