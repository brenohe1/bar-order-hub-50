import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { User, Briefcase, Building2 } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  created_at: string;
  sector_id: string | null;
  position: string | null;
  sectors?: { name: string } | null;
}

const Profile = () => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { role, loading: roleLoading } = useUserRole();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*, sectors(name)")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string | null) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      estoquista: "Estoquista",
      setor: "Setor",
    };
    return role ? labels[role] || role : "Sem função";
  };

  const getRoleBadgeVariant = (role: string | null) => {
    if (role === "admin") return "default";
    if (role === "estoquista") return "secondary";
    return "outline";
  };

  if (loading || roleLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Perfil não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meu Perfil</h1>
        <p className="text-muted-foreground">
          Informações da sua conta
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nome Completo</label>
            <p className="text-lg font-semibold">{profile.full_name}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Função</label>
            <div className="mt-1">
              <Badge variant={getRoleBadgeVariant(role)}>
                {getRoleLabel(role)}
              </Badge>
            </div>
          </div>

          {profile.sectors && (
            <div className="flex items-start gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Setor</label>
                <p className="text-lg">{profile.sectors.name}</p>
              </div>
            </div>
          )}

          {profile.position && (
            <div className="flex items-start gap-2">
              <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Cargo</label>
                <p className="text-lg">{profile.position}</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground">Membro desde</label>
            <p className="text-lg">
              {new Date(profile.created_at).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
