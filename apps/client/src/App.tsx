// src/App.tsx
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  Providers,
  MyProviders,
  Integrations,
  NotFound,
  Register,
  Login,
  Settings,
  Profile,
  Alerts,
  TVMode,
} from "./pages";
import { Dashboard } from "@/components/Dashboard";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthGuard } from "./components/AuthGuard";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { isViewer } from "./lib/auth";
import { Navigate } from "react-router-dom";
const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />

          <BrowserRouter>
        
            <AuthGuard>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/tv-mode" element={<TVMode />} />
                <Route path="/providers" element={<Providers />} />
                <Route path="/my-providers" element={isViewer() ? <Navigate to="/" replace /> : <MyProviders />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthGuard>
          </BrowserRouter>

         
          <ScrollToTopButton  />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
