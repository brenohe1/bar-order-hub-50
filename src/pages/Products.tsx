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
import { Plus, Pencil, Trash2, AlertTriangle, Search, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";

interface Product {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  category: string;
}

const CATEGORIES = [
  { value: "bebidas", label: "Bebidas" },
  { value: "alimentos", label: "Alimentos" },
  { value: "limpeza", label: "Limpeza" },
  { value: "higiene", label: "Higiene" },
  { value: "escritorio", label: "Escritório" },
  { value: "outros", label: "Outros" },
];

const Products = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const { isAdmin, isGerente, isEstoquista } = useUserRole();

  const canEdit = isAdmin || isGerente || isEstoquista;

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, categoryFilter, stockFilter]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    // Filter by stock status
    if (stockFilter === "low") {
      filtered = filtered.filter((p) => p.current_stock <= p.minimum_stock);
    } else if (stockFilter === "normal") {
      filtered = filtered.filter((p) => p.current_stock > p.minimum_stock);
    }

    setFilteredProducts(filtered);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const productData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      unit: formData.get("unit") as string,
      category: formData.get("category") as string,
      current_stock: parseFloat(formData.get("current_stock") as string),
      minimum_stock: parseFloat(formData.get("minimum_stock") as string),
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      if (editingProduct) {
        const previousStock = editingProduct.current_stock;
        const newStock = productData.current_stock;
        const stockDifference = newStock - previousStock;

        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;

        // Register stock movement if stock changed
        if (stockDifference !== 0) {
          const movementType = stockDifference > 0 ? "entrada" : "saida";
          const quantity = Math.abs(stockDifference);

          const { error: movementError } = await supabase
            .from("stock_movements")
            .insert({
              product_id: editingProduct.id,
              movement_type: movementType,
              quantity: quantity,
              previous_stock: previousStock,
              new_stock: newStock,
              notes: `Ajuste manual de estoque ao editar produto`,
              performed_by: user.id,
              movement_category: 'produto',
              sector_id: null,
            });

          if (movementError) {
            console.error("Error registering movement:", movementError);
          }
        }

        toast({ title: "Produto atualizado com sucesso!" });
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert([productData])
          .select()
          .single();

        if (error) throw error;

        // Register initial stock as entrada if > 0
        if (productData.current_stock > 0) {
          const { error: movementError } = await supabase
            .from("stock_movements")
            .insert({
              product_id: newProduct.id,
              movement_type: "entrada",
              quantity: productData.current_stock,
              previous_stock: 0,
              new_stock: productData.current_stock,
              notes: `Estoque inicial ao criar produto`,
              performed_by: user.id,
              movement_category: 'produto',
              sector_id: null,
            });

          if (movementError) {
            console.error("Error registering initial stock movement:", movementError);
          }
        }

        toast({ title: "Produto criado com sucesso!" });
      }

      setDialogOpen(false);
      setEditingProduct(null);
      loadProducts();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar produto",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      const { error } = await supabase.from("products").delete().eq("id", id);

      if (error) throw error;
      toast({ title: "Produto excluído com sucesso!" });
      loadProducts();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir produto",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setDialogOpen(false);
    setTimeout(() => setDialogOpen(true), 0);
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const getCategoryBadgeVariant = (category: string) => {
    const variants: Record<string, any> = {
      bebidas: "default",
      alimentos: "secondary",
      limpeza: "outline",
      higiene: "default",
      escritorio: "secondary",
      outros: "outline",
    };
    return variants[category] || "outline";
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
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie o catálogo de produtos e estoque
          </p>
        </div>

        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Editar Produto" : "Novo Produto"}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do produto abaixo
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingProduct?.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    name="description"
                    defaultValue={editingProduct?.description || ""}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria *</Label>
                    <Select name="category" defaultValue={editingProduct?.category || "outros"} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidade *</Label>
                    <Input
                      id="unit"
                      name="unit"
                      placeholder="ex: un, kg, L"
                      defaultValue={editingProduct?.unit || "un"}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="current_stock">Estoque Atual *</Label>
                    <Input
                      id="current_stock"
                      name="current_stock"
                      type="number"
                      step="0.01"
                      defaultValue={editingProduct?.current_stock || 0}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimum_stock">Estoque Mínimo *</Label>
                    <Input
                      id="minimum_stock"
                      name="minimum_stock"
                      type="number"
                      step="0.01"
                      defaultValue={editingProduct?.minimum_stock || 0}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <h3 className="font-semibold">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">
              <Search className="inline h-4 w-4 mr-1" />
              Buscar
            </Label>
            <Input
              id="search"
              placeholder="Nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-filter">Categoria</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger id="category-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stock-filter">Status do Estoque</Label>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger id="stock-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="low">Estoque Baixo</SelectItem>
                <SelectItem value="normal">Estoque Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Estoque Atual</TableHead>
              <TableHead>Estoque Mínimo</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => {
              const isLowStock = product.current_stock <= product.minimum_stock;
              return (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant={getCategoryBadgeVariant(product.category)}>
                      {getCategoryLabel(product.category)}
                    </Badge>
                  </TableCell>
                  <TableCell>{product.description || "-"}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell>{product.current_stock}</TableCell>
                  <TableCell>{product.minimum_stock}</TableCell>
                  <TableCell>
                    {isLowStock ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Baixo
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-success">
                        Normal
                      </Badge>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Products;
