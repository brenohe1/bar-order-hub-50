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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useUserRole } from "@/hooks/useUserRole";

interface Sector {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

const Sectors = () => {
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);

  useEffect(() => {
    if (roleLoading) return;

    if (!isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem acessar esta página",
        variant: "destructive",
      });
      window.location.href = "/";
      return;
    }
    loadSectors();
  }, [isAdmin, roleLoading]);

  const loadSectors = async () => {
    try {
      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .order("name");

      if (error) throw error;
      setSectors(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar setores",
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

    const sectorData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
    };

    try {
      if (editingSector) {
        const { error } = await supabase
          .from("sectors")
          .update(sectorData)
          .eq("id", editingSector.id);

        if (error) throw error;
        toast({ title: "Setor atualizado com sucesso!" });
      } else {
        const { error } = await supabase.from("sectors").insert([sectorData]);

        if (error) throw error;
        toast({ title: "Setor criado com sucesso!" });
      }

      setDialogOpen(false);
      setEditingSector(null);
      loadSectors();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar setor",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este setor?")) return;

    try {
      const { error } = await supabase.from("sectors").delete().eq("id", id);

      if (error) throw error;
      toast({ title: "Setor excluído com sucesso!" });
      loadSectors();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir setor",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (sector: Sector) => {
    setEditingSector(sector);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingSector(null);
    setDialogOpen(false);
    setTimeout(() => setDialogOpen(true), 0);
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
          <h1 className="text-3xl font-bold">Setores</h1>
          <p className="text-muted-foreground">
            Gerencie os setores da empresa
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Setor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSector ? "Editar Setor" : "Novo Setor"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do setor abaixo
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="ex: Cozinha, Bar, Copa"
                  defaultValue={editingSector?.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Descreva as responsabilidades do setor"
                  defaultValue={editingSector?.description || ""}
                  rows={3}
                />
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
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Data de Criação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map((sector) => (
              <TableRow key={sector.id}>
                <TableCell className="font-medium">{sector.name}</TableCell>
                <TableCell>{sector.description || "-"}</TableCell>
                <TableCell>
                  {new Date(sector.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(sector)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(sector.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Sectors;
