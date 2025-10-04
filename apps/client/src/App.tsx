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
  Dashboard,
  Profile,
  Alerts,
  TVMode,
} from "./pages";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthGuard } from "./components/AuthGuard";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import FloatingThemeToggle from "./components/FloatingThemeToggle";

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {/* App-level toasters */}
          <Toaster />
          <Sonner />

          <BrowserRouter>
            {/*
              Use a selector that targets the actual scrollable element.
              The logs showed a <main> and nested element with `overflow-auto`.
              'main .overflow-auto' will select the first descendant that actually scrolls.
              Keep debug=true while we confirm.
            */}

            {/* Protect routes inside AuthGuard */}
            <AuthGuard>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/tv-mode" element={<TVMode />} />
                <Route path="/providers" element={<Providers />} />
                <Route path="/my-providers" element={<MyProviders />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/alerts" element={<Alerts />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthGuard>
          </BrowserRouter>

          <FloatingThemeToggle/>
          <ScrollToTopButton  />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
