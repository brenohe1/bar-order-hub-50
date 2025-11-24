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
import { Plus, Printer, Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface PrinterType {
  id: string;
  name: string;
  location: string;
  ip_address: string | null;
  is_active: boolean;
  auto_print_on_accept: boolean;
  created_at: string;
}

const Printers = () => {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterType | null>(null);

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("printers")
        .select("*")
        .order("name");

      if (error) throw error;
      setPrinters(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar impressoras",
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

    const printerData = {
      name: formData.get("name") as string,
      location: formData.get("location") as string,
      ip_address: formData.get("ip_address") as string || null,
      is_active: formData.get("is_active") === "on",
      auto_print_on_accept: formData.get("auto_print_on_accept") === "on",
    };

    try {
      if (editingPrinter) {
        const { error } = await supabase
          .from("printers")
          .update(printerData)
          .eq("id", editingPrinter.id);

        if (error) throw error;
        toast({ title: "Impressora atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("printers")
          .insert([printerData]);

        if (error) throw error;
        toast({ title: "Impressora cadastrada com sucesso!" });
      }

      setDialogOpen(false);
      setEditingPrinter(null);
      loadPrinters();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar impressora",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta impressora?")) return;

    try {
      const { error } = await supabase
        .from("printers")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Impressora excluída com sucesso!" });
      loadPrinters();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir impressora",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("printers")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast({ title: `Impressora ${!currentStatus ? "ativada" : "desativada"}!` });
      loadPrinters();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (printer: PrinterType) => {
    setEditingPrinter(printer);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPrinter(null);
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
          <h1 className="text-3xl font-bold">Gerenciamento de Impressoras</h1>
          <p className="text-muted-foreground">
            Configure impressoras para impressão automática de pedidos
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPrinter(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Impressora
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPrinter ? "Editar" : "Nova"} Impressora
              </DialogTitle>
              <DialogDescription>
                Configure as informações da impressora
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Impressora *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingPrinter?.name}
                  placeholder="Ex: Impressora Estoque"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Localização *</Label>
                <Input
                  id="location"
                  name="location"
                  defaultValue={editingPrinter?.location}
                  placeholder="Ex: Almoxarifado - Sala 3"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ip_address">Endereço IP (opcional)</Label>
                <Input
                  id="ip_address"
                  name="ip_address"
                  defaultValue={editingPrinter?.ip_address || ""}
                  placeholder="Ex: 192.168.1.100"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  name="is_active"
                  defaultChecked={editingPrinter?.is_active ?? true}
                />
                <Label htmlFor="is_active">Impressora ativa</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="auto_print_on_accept"
                  name="auto_print_on_accept"
                  defaultChecked={editingPrinter?.auto_print_on_accept ?? false}
                />
                <Label htmlFor="auto_print_on_accept">
                  Impressão automática ao aceitar pedido
                </Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingPrinter ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Impressão Auto</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {printers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhuma impressora cadastrada
                </TableCell>
              </TableRow>
            ) : (
              printers.map((printer) => (
                <TableRow key={printer.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Printer className="h-4 w-4" />
                      {printer.name}
                    </div>
                  </TableCell>
                  <TableCell>{printer.location}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {printer.ip_address || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={printer.is_active ? "default" : "secondary"}
                      className={printer.is_active ? "bg-success" : ""}
                    >
                      {printer.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {printer.auto_print_on_accept ? "Sim" : "Não"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(printer.id, printer.is_active)}
                        title={printer.is_active ? "Desativar" : "Ativar"}
                      >
                        <Switch checked={printer.is_active} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(printer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(printer.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Printers;
