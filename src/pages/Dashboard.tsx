import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, AlertTriangle, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  pendingOrders: number;
  deliveredOrders: number;
}

const Dashboard = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*");

      if (productsError) throw productsError;

      // Load orders
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("status");

      if (ordersError) throw ordersError;

      const lowStock = products?.filter(
        (p) => p.current_stock <= p.minimum_stock
      ).length || 0;

      const pending = orders?.filter((o) => o.status === "pendente").length || 0;
      const delivered = orders?.filter((o) => o.status === "entregue").length || 0;

      setStats({
        totalProducts: products?.length || 0,
        lowStockProducts: lowStock,
        pendingOrders: pending,
        deliveredOrders: delivered,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      title: "Total de Produtos",
      value: stats.totalProducts,
      icon: Package,
      color: "text-primary",
    },
    {
      title: "Estoque Baixo",
      value: stats.lowStockProducts,
      icon: AlertTriangle,
      color: "text-warning",
    },
    {
      title: "Pedidos Pendentes",
      value: stats.pendingOrders,
      icon: ShoppingCart,
      color: "text-info",
    },
    {
      title: "Pedidos Entregues",
      value: stats.deliveredOrders,
      icon: TrendingUp,
      color: "text-success",
    },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema de gestão de estoque
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.lowStockProducts > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Alerta de Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Você tem {stats.lowStockProducts} produto(s) com estoque abaixo do
              mínimo configurado. Acesse a página de produtos para mais detalhes.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
