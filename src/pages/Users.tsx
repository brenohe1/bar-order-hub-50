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
import { UserPlus, Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useUserRole } from "@/hooks/useUserRole";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  sector_id: string | null;
  position: string | null;
  sectors?: { name: string } | null;
  user_roles: Array<{ role: string }>;
}

interface Sector {
  id: string;
  name: string;
}

const Users = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const { isAdmin, isGerente, loading: roleLoading } = useUserRole();

  useEffect(() => {
    // Wait for role to load before checking
    if (roleLoading) return;
    
    // Allow both admins and gerentes to access
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

  const loadData = async () => {
    try {
      // Get all users with emails from the edge function
      const { data: usersData, error: usersError } = await supabase.functions.invoke("list-users");

      if (usersError) throw usersError;

      setProfiles(usersData.users || []);

      // Load sectors
      const { data: sectorsData, error: sectorsError } = await supabase
        .from("sectors")
        .select("*")
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

    const fullName = formData.get("full_name") as string;
    const role = formData.get("role") as string;
    const sectorId = formData.get("sector_id") as string;
    const position = formData.get("position") as string;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Não autenticado");
      }

      if (editingUser) {
        // Update existing user
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        const updateData: any = {
          userId: editingUser.id,
          fullName,
          role,
          sectorId: sectorId || null,
          position: position || null,
        };

        // Only include email if provided
        if (email && email.trim()) {
          updateData.email = email;
        }

        // Only include password if provided
        if (password && password.trim()) {
          updateData.password = password;
        }

        const { data, error } = await supabase.functions.invoke("update-user", {
          body: updateData,
        });

        if (error) {
          const errorMessage = error.message || "Erro desconhecido";
          throw new Error(errorMessage.includes("email address has already been registered") 
            ? "Este email já está cadastrado no sistema" 
            : errorMessage);
        }
        
        if (data && typeof data === 'object' && 'error' in data) {
          throw new Error((data as any).error);
        }

        toast({
          title: "Usuário atualizado com sucesso!",
          description: `${fullName} foi atualizado`,
        });
      } else {
        // Create new user
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        const { data, error } = await supabase.functions.invoke("create-user", {
          body: {
            email,
            password,
            fullName,
            role,
            sectorId: sectorId || null,
            position: position || null,
          },
        });

        if (error) {
          // Try to extract error message from the response
          const errorMessage = error.message || "Erro desconhecido";
          throw new Error(errorMessage.includes("email address has already been registered") 
            ? "Este email já está cadastrado no sistema" 
            : errorMessage);
        }
        
        // Check if the response contains an error
        if (data && typeof data === 'object' && 'error' in data) {
          throw new Error((data as any).error);
        }

        toast({
          title: "Usuário criado com sucesso!",
          description: `${fullName} foi adicionado como ${getRoleLabel(role)}`,
        });
      }

      setDialogOpen(false);
      setEditingUser(null);
      loadData();
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast({
        title: editingUser ? "Erro ao atualizar usuário" : "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Não autenticado");
      }

      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) throw error;

      toast({ title: "Usuário excluído com sucesso!" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      gerente: "Gerente",
      estoquista: "Estoquista",
      setor: "Setor",
    };
    return labels[role] || role;
  };

  const getRoleBadge = (roles: Array<{ role: string }>) => {
    if (!roles || roles.length === 0) {
      return <Badge variant="outline">Sem função</Badge>;
    }

    // Get the highest priority role
    const roleNames = roles.map(r => r.role);
    let displayRole = "setor";
    
    if (roleNames.includes("admin")) {
      displayRole = "admin";
    } else if (roleNames.includes("gerente")) {
      displayRole = "gerente";
    } else if (roleNames.includes("estoquista")) {
      displayRole = "estoquista";
    }

    const variants: Record<string, any> = {
      admin: { variant: "default", label: "Administrador" },
      gerente: { variant: "secondary", label: "Gerente" },
      estoquista: { variant: "secondary", label: "Estoquista" },
      setor: { variant: "outline", label: "Setor" },
    };

    const config = variants[displayRole];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const openEditDialog = (user: UserProfile) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setDialogOpen(false);
    setTimeout(() => setDialogOpen(true), 0);
  };

  if (loading || roleLoading) {
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
          <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">
            Crie e gerencie contas de usuários do sistema
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <UserPlus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar Usuário" : "Criar Novo Usuário"}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Atualize as informações do usuário"
                  : "Adicione um novo usuário ao sistema com setor e cargo"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    placeholder="Ex: João Silva"
                    defaultValue={editingUser?.full_name}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email {!editingUser && "*"}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    required={!editingUser}
                  />
                  {editingUser && (
                    <p className="text-xs text-muted-foreground">
                      Deixe em branco para manter o e-mail atual
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha {!editingUser && "*"}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required={!editingUser}
                  />
                  {editingUser && (
                    <p className="text-xs text-muted-foreground">
                      Deixe em branco para manter a senha atual
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Função *</Label>
                  <Select
                    name="role"
                    defaultValue={
                      editingUser
                        ? editingUser.user_roles[0]?.role
                        : undefined
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="setor">Setor</SelectItem>
                      <SelectItem value="estoquista">Estoquista</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector_id">Setor</Label>
                  <Select
                    name="sector_id"
                    defaultValue={editingUser?.sector_id || undefined}
                  >
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
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Cargo</Label>
                <Input
                  id="position"
                  name="position"
                  placeholder="Ex: Gerente, Assistente..."
                  defaultValue={editingUser?.position || ""}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setEditingUser(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingUser ? "Atualizar" : "Criar Usuário"}
                </Button>
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
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Data de Criação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">
                  {profile.full_name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {profile.email}
                </TableCell>
                <TableCell>{getRoleBadge(profile.user_roles)}</TableCell>
                <TableCell>
                  {profile.sectors?.name || "-"}
                </TableCell>
                <TableCell>
                  {profile.position || "-"}
                </TableCell>
                <TableCell>
                  {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(profile)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
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
                          Tem certeza que deseja excluir {profile.full_name}?
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(profile.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Users;
