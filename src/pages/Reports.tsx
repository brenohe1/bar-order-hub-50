import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Download, Printer, TrendingUp, AlertTriangle, Package } from "lucide-react";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StockReport {
  name: string;
  estoque_atual: number;
  estoque_minimo: number;
}

interface Product {
  id: string;
  name: string;
  current_stock: number;
  minimum_stock: number;
  unit: string;
  description: string | null;
}

interface OrderStats {
  status: string;
  count: number;
}

interface MonthlyTrend {
  month: string;
  pedidos: number;
  produtos: number;
}

interface MovementDetail {
  id: string;
  quantity: number;
  products: { name: string; unit: string } | null;
  orders: {
    id: string;
    created_at: string;
    delivered_at: string | null;
    status: string;
    sectors: { name: string } | null;
    profiles: { full_name: string } | null;
    delivered_by_profile?: { full_name: string } | null;
  };
}

interface TopProductBySector {
  sector: string;
  topProduct: string;
  quantity: number;
}

const Reports = () => {
  const { toast } = useToast();
  const [stockData, setStockData] = useState<StockReport[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [movementDetails, setMovementDetails] = useState<MovementDetail[]>([]);
  const [topProductsBySector, setTopProductsBySector] = useState<TopProductBySector[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    loadReports();
  }, [startDate, endDate, filterStatus]);

  const loadReports = async () => {
    try {
      setLoading(true);

      // Carregar produtos
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, current_stock, minimum_stock, unit, description")
        .order("name");

      if (productsError) throw productsError;

      const formattedStockData =
        productsData?.map((p) => ({
          name: p.name,
          estoque_atual: Number(p.current_stock),
          estoque_minimo: Number(p.minimum_stock),
        })) || [];

      setStockData(formattedStockData);
      setProducts(productsData || []);

      // Carregar estatísticas de pedidos por status com informações completas
      let ordersQuery = supabase
        .from("orders")
        .select(`
          *,
          sectors(name),
          profiles!orders_requested_by_fkey(full_name)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

      if (filterStatus !== "all") {
        ordersQuery = ordersQuery.eq("status", filterStatus);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;

      if (ordersError) throw ordersError;

      // Buscar perfis dos entregadores
      const ordersWithDelivery = await Promise.all(
        (ordersData || []).map(async (order: any) => {
          if (order.delivered_by) {
            const { data: deliveredByProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", order.delivered_by)
              .single();
            return { ...order, delivered_by_profile: deliveredByProfile };
          }
          return { ...order, delivered_by_profile: null };
        })
      );

      // Carregar itens de pedidos com produtos
      const { data: orderItemsData } = await supabase
        .from("order_items")
        .select(`
          *,
          products(name, unit),
          orders!inner(
            id,
            created_at,
            delivered_at,
            status,
            sectors(name),
            profiles!orders_requested_by_fkey(full_name)
          )
        `)
        .gte("orders.created_at", startDate)
        .lte("orders.created_at", endDate + "T23:59:59");

      // Buscar perfis dos entregadores para cada item
      const itemsWithDelivery = await Promise.all(
        (orderItemsData || []).map(async (item: any) => {
          if (item.orders.delivered_by) {
            const { data: deliveredByProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", item.orders.delivered_by)
              .single();
            return {
              ...item,
              orders: {
                ...item.orders,
                delivered_by_profile: deliveredByProfile,
              },
            };
          }
          return item;
        })
      );

      setMovementDetails(itemsWithDelivery || []);

      // Agrupar por status
      const statusCounts = ordersWithDelivery.reduce((acc, order: any) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const formattedOrderStats = Object.entries(statusCounts).map(
        ([status, count]): OrderStats => ({
          status:
            status === "pendente"
              ? "Pendente"
              : status === "entregue"
              ? "Entregue"
              : "Cancelado",
          count: count as number,
        })
      );

      setOrderStats(formattedOrderStats);

      // Calcular tendências mensais
      const monthlyData = ordersWithDelivery.reduce((acc, order: any) => {
        const month = new Date(order.created_at).toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        });
        if (!acc[month]) {
          acc[month] = { pedidos: 0, produtos: 0 };
        }
        acc[month].pedidos += 1;
        return acc;
      }, {} as Record<string, { pedidos: number; produtos: number }>);

      itemsWithDelivery.forEach((item: any) => {
        const month = new Date(item.orders.created_at).toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        });
        if (monthlyData[month]) {
          monthlyData[month].produtos += item.quantity;
        }
      });

      const formattedTrends = Object.entries(monthlyData).map(
        ([month, data]: [string, { pedidos: number; produtos: number }]): MonthlyTrend => ({
          month,
          pedidos: data.pedidos,
          produtos: data.produtos,
        })
      );

      setMonthlyTrends(formattedTrends);

      // Análise de produtos por setor
      const sectorAnalysis = itemsWithDelivery.reduce((acc, item: any) => {
        const sectorName = item.orders.sectors?.name || "Sem Setor";
        const productName = item.products?.name || "Produto Desconhecido";

        if (!acc[sectorName]) {
          acc[sectorName] = {};
        }
        if (!acc[sectorName][productName]) {
          acc[sectorName][productName] = 0;
        }
        acc[sectorName][productName] += item.quantity;

        return acc;
      }, {} as Record<string, Record<string, number>>);

      // Formatar para exibição
      const topProductsBySector = Object.entries(sectorAnalysis).map(
        ([sector, products]) => {
          const topProduct = Object.entries(products).sort((a, b) => b[1] - a[1])[0];
          return {
            sector,
            topProduct: topProduct ? topProduct[0] : "—",
            quantity: topProduct ? topProduct[1] : 0,
          };
        }
      );

      setTopProductsBySector(topProductsBySector);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar relatórios",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      // Aba de Estoque
      const wsStock = XLSX.utils.json_to_sheet(
        products.map((p) => ({
          Produto: p.name,
          "Estoque Atual": p.current_stock,
          "Estoque Mínimo": p.minimum_stock,
          Unidade: p.unit,
          Status: p.current_stock <= p.minimum_stock ? "CRÍTICO" : "OK",
          Descrição: p.description || "-",
        }))
      );

      // Aba de Movimentações Detalhadas
      const wsMovements = XLSX.utils.json_to_sheet(
        movementDetails.map((item) => ({
          Produto: item.products?.name || "—",
          Quantidade: `${item.quantity} ${item.products?.unit || ""}`,
          Setor: item.orders.sectors?.name || "—",
          "Solicitado Por": item.orders.profiles?.full_name || "—",
          "Data do Pedido": new Date(item.orders.created_at).toLocaleString("pt-BR"),
          Status: item.orders.status,
          "Entregue Por": item.orders.delivered_by_profile?.full_name || "—",
          "Data de Entrega": item.orders.delivered_at
            ? new Date(item.orders.delivered_at).toLocaleString("pt-BR")
            : "—",
        }))
      );

      // Aba de Produtos Mais Solicitados por Setor
      const wsBySector = XLSX.utils.json_to_sheet(
        topProductsBySector.map((item) => ({
          Setor: item.sector,
          "Produto Mais Solicitado": item.topProduct,
          "Quantidade Total": item.quantity,
        }))
      );

      // Aba de Pedidos
      const wsOrders = XLSX.utils.json_to_sheet(
        orderStats.map((s) => ({
          Status: s.status,
          Quantidade: s.count,
        }))
      );

      // Aba de Tendências
      const wsTrends = XLSX.utils.json_to_sheet(
        monthlyTrends.map((t) => ({
          Mês: t.month,
          "Total Pedidos": t.pedidos,
          "Total Produtos": t.produtos,
        }))
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsMovements, "Movimentações Detalhadas");
      XLSX.utils.book_append_sheet(wb, wsBySector, "Produtos por Setor");
      XLSX.utils.book_append_sheet(wb, wsStock, "Estoque");
      XLSX.utils.book_append_sheet(wb, wsOrders, "Pedidos por Status");
      XLSX.utils.book_append_sheet(wb, wsTrends, "Tendências Mensais");

      XLSX.writeFile(
        wb,
        `relatorio-completo-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.xlsx`
      );

      toast({ title: "Relatório completo exportado com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const printReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const criticalProducts = products.filter(
    (p) => p.current_stock <= p.minimum_stock
  );

  const COLORS = ["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--destructive))"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios e Dashboard</h1>
          <p className="text-muted-foreground">
            Análise completa de estoque, pedidos e tendências
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={printReport}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <Button onClick={exportToExcel}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Filtros de Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status dos Pedidos</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orderStats.reduce((sum, s) => sum + s.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {criticalProducts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Estoque abaixo do mínimo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tendência Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {monthlyTrends.length > 0
                ? Math.round(
                    monthlyTrends.reduce((sum, t) => sum + t.pedidos, 0) /
                      monthlyTrends.length
                  )
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Pedidos/mês (média)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Produtos Críticos */}
      {criticalProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Produtos com Estoque Crítico
            </CardTitle>
            <CardDescription>
              Produtos que estão abaixo do estoque mínimo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criticalProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Estoque: {product.current_stock} {product.unit} / Mínimo:{" "}
                      {product.minimum_stock} {product.unit}
                    </p>
                  </div>
                  <span className="rounded-full bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground">
                    CRÍTICO
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Produtos Mais Solicitados por Setor */}
      {topProductsBySector.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Produtos Mais Solicitados por Setor</CardTitle>
            <CardDescription>
              Análise dos produtos com maior saída em cada setor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProductsBySector.map((item) => (
                <div
                  key={item.sector}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{item.sector}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.topProduct}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
                    {item.quantity} unidades
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela Detalhada de Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle>Movimentações Detalhadas</CardTitle>
          <CardDescription>
            Histórico completo de todas as movimentações no período
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Data Pedido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entregue Por</TableHead>
                  <TableHead>Data Entrega</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhuma movimentação encontrada no período
                    </TableCell>
                  </TableRow>
                ) : (
                  movementDetails.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.products?.name || "—"}
                      </TableCell>
                      <TableCell>
                        {item.quantity} {item.products?.unit || ""}
                      </TableCell>
                      <TableCell>{item.orders.sectors?.name || "—"}</TableCell>
                      <TableCell>
                        {item.orders.profiles?.full_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(item.orders.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.orders.status === "entregue"
                              ? "default"
                              : item.orders.status === "pendente"
                              ? "secondary"
                              : "destructive"
                          }
                          className={
                            item.orders.status === "entregue" ? "bg-success" : ""
                          }
                        >
                          {item.orders.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.orders.delivered_by_profile?.full_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.orders.delivered_at
                          ? new Date(item.orders.delivered_at).toLocaleString(
                              "pt-BR"
                            )
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pedidos por Status</CardTitle>
            <CardDescription>Distribuição de pedidos no período</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={orderStats}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {orderStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendência de Consumo</CardTitle>
            <CardDescription>Pedidos e produtos ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="pedidos"
                  stroke="hsl(var(--primary))"
                  name="Pedidos"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="produtos"
                  stroke="hsl(var(--warning))"
                  name="Produtos"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Comparativo de Estoque */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo de Estoque</CardTitle>
          <CardDescription>
            Análise visual do estoque atual versus estoque mínimo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={stockData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="estoque_atual"
                fill="hsl(var(--primary))"
                name="Estoque Atual"
              />
              <Bar
                dataKey="estoque_minimo"
                fill="hsl(var(--warning))"
                name="Estoque Mínimo"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
