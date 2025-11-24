import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

interface StockMovement {
  id: string;
  product_id: string | null;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  notes: string | null;
  performed_by: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
  movement_category: string;
  sector_id: string | null;
  products?: { name: string; unit: string };
  profiles?: { full_name: string };
  sectors?: { name: string };
}

interface Product {
  id: string;
  name: string;
  current_stock: number;
  unit: string;
}

interface Sector {
  id: string;
  name: string;
}

const StockMovements = () => {
  const { toast } = useToast();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [sectorFilter, setSectorFilter] = useState<string>("todos");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("data_desc");
  const { isAdmin, isEstoquista, isGerente, loading: roleLoading } = useUserRole();

  useEffect(() => {
    // Wait for role to load before checking
    if (roleLoading) return;

    if (!isAdmin && !isGerente) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores e gerentes podem acessar esta página",
        variant: "destructive",
      });
      window.location.href = "/";
      return;
    }
    loadData();
  }, [isAdmin, isGerente, roleLoading]);

  useEffect(() => {
    applyFilters();
  }, [movements, categoryFilter, sectorFilter, startDate, endDate, sortBy]);

  const applyFilters = () => {
    let filtered = movements.filter((m) => !m.deleted_at);

    if (categoryFilter !== "todos") {
      filtered = filtered.filter((m) => m.movement_category === categoryFilter);
    }

    if (sectorFilter !== "todos") {
      filtered = filtered.filter((m) => m.sector_id === sectorFilter);
    }

    if (startDate) {
      filtered = filtered.filter((m) => new Date(m.created_at) >= new Date(startDate));
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      filtered = filtered.filter((m) => new Date(m.created_at) <= endDateTime);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "data_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "data_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "quantidade_desc":
          return b.quantity - a.quantity;
        case "quantidade_asc":
          return a.quantity - b.quantity;
        case "produto":
          return (a.products?.name || "").localeCompare(b.products?.name || "");
        case "setor":
          return (a.sectors?.name || "").localeCompare(b.sectors?.name || "");
        default:
          return 0;
      }
    });

    setFilteredMovements(filtered);
  };

  const loadData = async () => {
    try {
      const { data: movementsData, error: movementsError } = await supabase
        .from("stock_movements")
        .select("*, products(name, unit), sectors(name)")
        .order("created_at", { ascending: false }) as any;

      if (movementsError) throw movementsError;

      // Manually join with profiles - handle missing profiles gracefully
      const movementsWithProfiles = await Promise.all(
        (movementsData || []).map(async (movement: any) => {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", movement.performed_by)
              .single();
            
            return {
              ...movement,
              profiles: profile || { full_name: 'Usuário desconhecido' },
            };
          } catch (error) {
            // If profile not found, use fallback
            return {
              ...movement,
              profiles: { full_name: 'Usuário desconhecido' },
            };
          }
        })
      );

      setMovements(movementsWithProfiles as any);

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, current_stock, unit")
        .order("name");

      if (productsError) throw productsError;
      setProducts(productsData || []);

      const { data: sectorsData, error: sectorsError } = await supabase
        .from("sectors")
        .select("id, name")
        .order("name");

      if (sectorsError) throw sectorsError;
      setSectors(sectorsData || []);
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

    const productId = formData.get("product_id") as string;
    const movementType = formData.get("movement_type") as string;
    const quantity = parseFloat(formData.get("quantity") as string);
    const notes = formData.get("notes") as string;
    const sectorId = formData.get("sector_id") as string;

    // Validar observação obrigatória
    if (!notes || !notes.trim()) {
      toast({
        title: "Observação obrigatória",
        description: "Você precisa informar o motivo do ajuste de estoque",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Get current stock
      const { data: product } = await supabase
        .from("products")
        .select("current_stock")
        .eq("id", productId)
        .single();

      if (!product) throw new Error("Produto não encontrado");

      const previousStock = product.current_stock;
      let newStock = previousStock;

      if (movementType === "entrada") {
        newStock = previousStock + quantity;
      } else if (movementType === "saida") {
        newStock = previousStock - quantity;
        if (newStock < 0) {
          throw new Error("Estoque insuficiente");
        }
      } else if (movementType === "ajuste") {
        newStock = quantity;
      }

      // Insert movement record
      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: productId,
          movement_type: movementType,
          quantity: Math.abs(movementType === "ajuste" ? quantity - previousStock : quantity),
          previous_stock: previousStock,
          new_stock: newStock,
          notes: notes,
          performed_by: user.id,
          movement_category: 'produto',
          sector_id: sectorId || null,
        });

      if (movementError) throw movementError;

      // Update product stock
      const { error: updateError } = await supabase
        .from("products")
        .update({ current_stock: newStock })
        .eq("id", productId);

      if (updateError) throw updateError;

      toast({
        title: "Movimentação registrada!",
        description: "O estoque foi atualizado com sucesso",
      });

      setDialogOpen(false);
      loadData();
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast({
        title: "Erro ao registrar movimentação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (movementId: string, reason: string) => {
    if (!reason.trim()) {
      toast({
        title: "Observação obrigatória",
        description: "Você precisa informar o motivo da exclusão",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("stock_movements")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          deletion_reason: reason,
        })
        .eq("id", movementId);

      if (error) throw error;

      toast({ title: "Movimentação excluída com sucesso!" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir movimentação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getMovementIcon = (type: string) => {
    if (type === "entrada") return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (type === "saida") return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <RefreshCw className="h-4 w-4 text-blue-600" />;
  };

  const getMovementBadge = (type: string) => {
    const variants: Record<string, any> = {
      entrada: { variant: "default", label: "Entrada" },
      saida: { variant: "destructive", label: "Saída" },
      ajuste: { variant: "secondary", label: "Ajuste" },
    };
    const config = variants[type];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const exportToExcel = () => {
    try {
      const dataToExport = filteredMovements.map((movement) => ({
        Categoria: movement.movement_category === "produto" ? "Produto" : "Sistema",
        Produto: movement.products?.name || "-",
        Setor: movement.sectors?.name || "-",
        Tipo: movement.movement_type === "entrada" ? "Entrada" : movement.movement_type === "saida" ? "Saída" : "Ajuste",
        Quantidade: movement.quantity,
        Unidade: movement.products?.unit || "",
        "Estoque Anterior": movement.previous_stock,
        "Estoque Novo": movement.new_stock,
        "Realizado Por": movement.profiles?.full_name || "-",
        Observação: movement.notes || "-",
        Data: new Date(movement.created_at).toLocaleString("pt-BR"),
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Movimentações");

      // Auto ajustar largura das colunas
      const maxWidth = dataToExport.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
      ws["!cols"] = Array(maxWidth).fill({ wch: 15 });

      const fileName = `movimentacoes_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Exportação concluída!",
        description: `Arquivo ${fileName} baixado com sucesso`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
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
          <h1 className="text-3xl font-bold">Movimentações de Estoque</h1>
          <p className="text-muted-foreground">
            Histórico completo de entradas, saídas e ajustes
          </p>
        </div>

        {(isEstoquista || isGerente) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Movimentação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Movimentação</DialogTitle>
                <DialogDescription>
                  Adicione ou remova itens do estoque
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product_id">Produto *</Label>
                  <Select name="product_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} (Estoque: {product.current_stock} {product.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="movement_type">Tipo de Movimentação *</Label>
                  <Select name="movement_type" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                      <SelectItem value="ajuste">Ajuste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantidade *</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observação *</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Ex: Reposição do fornecedor X, motivo do ajuste, etc"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Campo obrigatório para auditoria
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector_id">Setor (opcional)</Label>
                  <Select name="sector_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor (se aplicável)" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors.map((sector) => (
                        <SelectItem key={sector.id} value={sector.id}>
                          {sector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Registrar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mb-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="produto">Produtos</SelectItem>
              <SelectItem value="sistema">Sistema</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              {sectors.map((sector) => (
                <SelectItem key={sector.id} value={sector.id}>
                  {sector.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Data inicial"
            className="w-[160px]"
          />

          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Data final"
            className="w-[160px]"
          />

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data_desc">Data (mais recente)</SelectItem>
              <SelectItem value="data_asc">Data (mais antigo)</SelectItem>
              <SelectItem value="quantidade_desc">Quantidade (maior)</SelectItem>
              <SelectItem value="quantidade_asc">Quantidade (menor)</SelectItem>
              <SelectItem value="produto">Produto (A-Z)</SelectItem>
              <SelectItem value="setor">Setor (A-Z)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => {
              setCategoryFilter("todos");
              setSectorFilter("todos");
              setStartDate("");
              setEndDate("");
              setSortBy("data_desc");
            }}
          >
            Limpar Filtros
          </Button>

          <Button
            variant="default"
            onClick={exportToExcel}
            className="ml-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          Mostrando {filteredMovements.length} de {movements.filter(m => !m.deleted_at).length} movimentações
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Estoque Anterior</TableHead>
              <TableHead>Estoque Novo</TableHead>
              <TableHead>Realizado por</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead>Data</TableHead>
              {isAdmin && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMovements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>
                  <Badge variant={movement.movement_category === "produto" ? "default" : "secondary"}>
                    {movement.movement_category === "produto" ? "Produto" : "Sistema"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {movement.products?.name || "-"}
                </TableCell>
                <TableCell>
                  {movement.sectors?.name || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getMovementIcon(movement.movement_type)}
                    {getMovementBadge(movement.movement_type)}
                  </div>
                </TableCell>
                <TableCell>
                  {movement.quantity} {movement.products?.unit || ""}
                </TableCell>
                <TableCell>{movement.previous_stock}</TableCell>
                <TableCell>{movement.new_stock}</TableCell>
                <TableCell>{movement.profiles?.full_name}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {movement.notes || "-"}
                </TableCell>
                <TableCell>
                  {new Date(movement.created_at).toLocaleDateString("pt-BR")} {new Date(movement.created_at).toLocaleTimeString("pt-BR")}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O registro será marcado como excluído mas permanecerá no histórico.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4">
                          <Label htmlFor="deletion-reason">Motivo da exclusão *</Label>
                          <Textarea
                            id="deletion-reason"
                            placeholder="Informe o motivo da exclusão"
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              const reason = (document.getElementById("deletion-reason") as HTMLTextAreaElement)?.value;
                              handleDelete(movement.id, reason);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default StockMovements;
