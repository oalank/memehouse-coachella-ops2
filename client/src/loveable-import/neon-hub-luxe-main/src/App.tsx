import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import KanbanPage from "./pages/KanbanPage";
import OperatorsPage from "./pages/OperatorsPage";
import CredentialsPage from "./pages/CredentialsPage";
import ShiftsPage from "./pages/ShiftsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="dark min-h-screen bg-background text-foreground">
          {/* Desktop sidebar */}
          <div className="hidden md:block">
            <AppSidebar />
          </div>
          {/* Mobile nav */}
          <MobileNav />
          {/* Main content area offset by sidebar */}
          <main className="md:ml-[260px] min-h-screen">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/kanban" element={<KanbanPage />} />
              <Route path="/operators" element={<OperatorsPage />} />
              <Route path="/credentials" element={<CredentialsPage />} />
              <Route path="/shifts" element={<ShiftsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
