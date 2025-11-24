import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "gerente" | "estoquista" | "setor";

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRole(null);
          setLoading(false);
          return;
        }

        const { data: userRoles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .order("role", { ascending: true }); // admin < estoquista < setor

        if (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
        } else if (userRoles && userRoles.length > 0) {
          // User can have multiple roles, prioritize admin > gerente > estoquista > setor
          const roles = userRoles.map(r => r.role as string);
          if (roles.includes("admin")) {
            setRole("admin");
          } else if (roles.includes("gerente")) {
            setRole("gerente");
          } else if (roles.includes("estoquista")) {
            setRole("estoquista");
          } else {
            setRole("setor");
          }
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Error in fetchUserRole:", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { 
    role, 
    loading, 
    isAdmin: role === "admin", 
    isGerente: role === "gerente",
    isEstoquista: role === "estoquista", 
    isSetor: role === "setor" 
  };
}
