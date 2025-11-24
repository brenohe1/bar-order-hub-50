import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useUserRole } from "@/hooks/useUserRole";

interface Order {
  id: string;
  sector_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  delivered_at: string | null;
  delivered_by: string | null;
  sectors: { name: string } | null;
  profiles: { full_name: string } | null;
  delivered_by_profile?: { full_name: string } | null;
}

interface Sector {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  unit: string;
}

interface OrderItem {
  product_id: string;
  quantity: number;
}

const Orders = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { product_id: "", quantity: 0 },
  ]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserSectorId, setCurrentUserSectorId] = useState<string | null>(null);
  const [printers, setPrinters] = useState<any[]>([]);
  const { role: currentUserRole, isAdmin, isGerente, isEstoquista, isSetor } = useUserRole();
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    filterOrders();
  }, [orders, statusFilter, sectorFilter, dateFrom, dateTo]);

  const filterOrders = () => {
    let filtered = orders;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }

    // Filter by sector
    if (sectorFilter !== "all") {
      filtered = filtered.filter((o) => o.sector_id === sectorFilter);
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(
        (o) => new Date(o.created_at) >= new Date(dateFrom)
      );
    }
    if (dateTo) {
      filtered = filtered.filter(
        (o) => new Date(o.created_at) <= new Date(dateTo + "T23:59:59")
      );
    }

    setFilteredOrders(filtered);
  };

  useEffect(() => {
    loadData();
    loadPrinters();
    
    // Setup realtime subscription for new orders
    const channel = supabase
      .channel("orders_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          // Only notify estoquistas about new orders
          if (isEstoquista) {
            toast({
              title: "🔔 Novo Pedido Recebido!",
              description: "Um novo pedido foi criado e está aguardando processamento.",
              duration: 5000,
            });
            
            // Play notification sound
            const audio = new Audio("/notification.mp3");
            audio.play().catch(() => {
              // Silently fail if audio doesn't play
            });
          }
          
          // Reload orders for all users
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserRole]);

  const loadPrinters = async () => {
    try {
      const { data, error } = await supabase
        .from("printers")
        .select("*")
        .eq("is_active", true);
      
      if (error) throw error;
      setPrinters(data || []);
    } catch (error) {
      console.error("Error loading printers:", error);
    }
  };

  const loadData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Get current user's sector
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("sector_id")
          .eq("id", user.id)
          .single();
        
        setCurrentUserSectorId(profile?.sector_id || null);
      }

      const [ordersRes, sectorsRes, productsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*, sectors(name), profiles(full_name)")
          .order("created_at", { ascending: false }),
        supabase.from("sectors").select("*").order("name"),
        supabase.from("products").select("id, name, unit").order("name"),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (sectorsRes.error) throw sectorsRes.error;
      if (productsRes.error) throw productsRes.error;

      // Fetch delivered_by profiles separately
      const ordersWithDelivery = await Promise.all(
        (ordersRes.data || []).map(async (order: any) => {
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

      setOrders(ordersWithDelivery);
      setSectors(sectorsRes.data || []);
      setProducts(productsRes.data || []);
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const orderData = {
      sector_id: formData.get("sector_id") as string,
      notes: formData.get("notes") as string,
      requested_by: currentUserId,
      status: "pendente",
    };

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw orderError;

      const itemsData = orderItems
        .filter((item) => item.product_id && item.quantity > 0)
        .map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
        }));

      if (itemsData.length === 0) {
        throw new Error("Adicione pelo menos um produto ao pedido");
      }

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsData);

      if (itemsError) throw itemsError;

      toast({ title: "Pedido criado com sucesso!" });
      setDialogOpen(false);
      setOrderItems([{ product_id: "", quantity: 0 }]);
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao criar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (!isAdmin && !isEstoquista && !isGerente) {
      toast({
        title: "Permissão negada",
        description: "Apenas administradores, gerentes e estoquistas podem atualizar pedidos",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      toast({ title: "Status atualizado com sucesso!" });
      
      // Auto print if status changed to 'entregue' and printers are configured
      if (newStatus === "entregue") {
        const autoPrintPrinters = printers.filter(p => p.auto_print_on_accept);
        if (autoPrintPrinters.length > 0) {
          await printThermal(orderId);
        }
      }
      
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addOrderItem = () => {
    setOrderItems([...orderItems, { product_id: "", quantity: 0 }]);
  };

  const updateOrderItem = (index: number, field: string, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setOrderItems(newItems);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pendente: { variant: "secondary", label: "Pendente" },
      aprovado: { variant: "default", label: "Aprovado" },
      entregue: { variant: "default", label: "Entregue", className: "bg-success" },
      cancelado: { variant: "destructive", label: "Cancelado" },
    };

    const config = variants[status] || variants.pendente;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const printThermal = async (orderId: string) => {
    try {
      // Get order details with items
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*, sectors(name), profiles(full_name)")
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      // Get delivered_by profile separately if exists
      let deliveredByProfile = null;
      if (order.delivered_by) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", order.delivered_by)
          .single();
        deliveredByProfile = data;
      }

      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select("*, products(name, unit)")
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      // Create thermal print window
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Erro ao abrir impressão",
          description: "Permita pop-ups para imprimir",
          variant: "destructive",
        });
        return;
      }

      const thermalHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Pedido #${orderId.slice(0, 8)}</title>
          <style>
            @media print {
              @page { margin: 0; size: 80mm auto; }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              width: 80mm;
              margin: 0 auto;
              padding: 5mm;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 5mm;
              margin-bottom: 5mm;
            }
            .header h1 {
              font-size: 18px;
              margin: 0 0 2mm 0;
            }
            .section {
              margin-bottom: 5mm;
            }
            .section-title {
              font-weight: bold;
              border-bottom: 1px solid #000;
              margin-bottom: 2mm;
            }
            .item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 2mm;
            }
            .footer {
              text-align: center;
              border-top: 2px dashed #000;
              padding-top: 5mm;
              margin-top: 5mm;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PEDIDO</h1>
            <div>#${orderId.slice(0, 8).toUpperCase()}</div>
            <div>${new Date(order.created_at).toLocaleString("pt-BR")}</div>
          </div>

          <div class="section">
            <div class="section-title">INFORMAÇÕES</div>
            <div>Setor: ${order.sectors?.name || "-"}</div>
            <div>Solicitante: ${order.profiles?.full_name || "-"}</div>
            <div>Status: ${order.status.toUpperCase()}</div>
            ${order.delivered_at ? `<div>Entregue em: ${new Date(order.delivered_at).toLocaleString("pt-BR")}</div>` : ""}
            ${deliveredByProfile?.full_name ? `<div>Entregue por: ${deliveredByProfile.full_name}</div>` : ""}
          </div>

          <div class="section">
            <div class="section-title">PRODUTOS</div>
            ${items
              ?.map(
                (item: any) => `
              <div class="item">
                <div>${item.products?.name || "-"}</div>
                <div>${item.quantity} ${item.products?.unit || ""}</div>
              </div>
            `
              )
              .join("")}
          </div>

          ${
            order.notes
              ? `
            <div class="section">
              <div class="section-title">OBSERVAÇÕES</div>
              <div>${order.notes}</div>
            </div>
          `
              : ""
          }

          <div class="footer">
            Sistema de Gestão de Estoque
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(thermalHTML);
      printWindow.document.close();
      printWindow.focus();

      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (error: any) {
      toast({
        title: "Erro ao imprimir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <p className="text-muted-foreground">
            Gerencie pedidos entre setores
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo Pedido</DialogTitle>
              <DialogDescription>
                Crie um novo pedido de produtos
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sector_id">Setor *</Label>
                {isSetor && currentUserSectorId ? (
                  <>
                    <Input
                      value={sectors.find(s => s.id === currentUserSectorId)?.name || ""}
                      disabled
                      className="bg-muted"
                    />
                    <input type="hidden" name="sector_id" value={currentUserSectorId} />
                    <p className="text-xs text-muted-foreground">
                      Você só pode criar pedidos para o seu setor
                    </p>
                  </>
                ) : (
                  <Select name="sector_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors.map((sector) => (
                        <SelectItem key={sector.id} value={sector.id}>
                          {sector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Produtos *</Label>
                <div className="space-y-2">
                  {orderItems.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Select
                        value={item.product_id}
                        onValueChange={(value) =>
                          updateOrderItem(index, "product_id", value)
                        }
                        required
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Quantidade"
                        value={item.quantity || ""}
                        onChange={(e) =>
                          updateOrderItem(
                            index,
                            "quantity",
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-32"
                        required
                      />
                      {orderItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOrderItem(index)}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOrderItem}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Produto
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" name="notes" rows={3} />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Criar Pedido</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Advanced Filters */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <h3 className="font-semibold">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sector-filter">Setor</Label>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger id="sector-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {sectors.map((sector) => (
                  <SelectItem key={sector.id} value={sector.id}>
                    {sector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-from">Data Inicial</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-to">Data Final</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setor</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">
                  {order.sectors?.name || "-"}
                </TableCell>
                <TableCell>{order.profiles?.full_name || "-"}</TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell>
                  {new Date(order.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  {order.delivered_at ? (
                    <div className="text-sm">
                      <div>{new Date(order.delivered_at).toLocaleDateString("pt-BR")}</div>
                      <div className="text-muted-foreground">
                        {order.delivered_by_profile?.full_name || "-"}
                      </div>
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{order.notes || "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => printThermal(order.id)}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Imprimir
                    </Button>
                    {order.status !== "entregue" && order.status !== "cancelado" && (
                      <Select
                        defaultValue={order.status}
                        onValueChange={(value) =>
                          handleStatusChange(order.id, value)
                        }
                        disabled={!isAdmin && !isEstoquista && !isGerente}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="aprovado">Aprovado</SelectItem>
                          <SelectItem value="entregue">Entregue</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Orders;
