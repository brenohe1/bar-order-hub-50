import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Sectors from "./pages/Sectors";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Printers from "./pages/Printers";
import Profile from "./pages/Profile";
import StockMovements from "./pages/StockMovements";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex flex-1 flex-col">
                      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-6">
                        <SidebarTrigger />
                      </header>
                      <main className="flex-1 overflow-auto p-6">
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/products" element={<Products />} />
                          <Route path="/orders" element={<Orders />} />
                          <Route path="/sectors" element={<Sectors />} />
                          <Route path="/reports" element={<Reports />} />
                          <Route path="/users" element={<Users />} />
                          <Route path="/printers" element={<Printers />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/stock-movements" element={<StockMovements />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </div>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
