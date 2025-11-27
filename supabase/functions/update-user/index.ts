import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    // Verify the requesting user is an admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Usuário não autenticado");
    }

    // Check if user is admin or gerente
    const { data: roles, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "gerente"]);

    if (roleError || !roles || roles.length === 0) {
      throw new Error("Apenas administradores e gerentes podem atualizar usuários");
    }

    const { userId, fullName, role, sectorId, position, email, password } = await req.json();

    if (!userId) {
      throw new Error("userId é obrigatório");
    }

    // Update email and/or password if provided using service role key
    if (email || password) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        updateData
      );

      if (authError) {
        throw authError;
      }
    }

    // Update profile
    const profileUpdate: any = {};
    if (fullName !== undefined) profileUpdate.full_name = fullName;
    if (sectorId !== undefined) profileUpdate.sector_id = sectorId;
    if (position !== undefined) profileUpdate.position = position;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabaseClient
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);

      if (profileError) {
        throw profileError;
      }
    }

    // Update role if provided
    if (role) {
      // Delete existing roles
      const { error: deleteError } = await supabaseClient
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        throw deleteError;
      }

      // Insert new role
      const { error: roleError } = await supabaseClient
        .from("user_roles")
        .insert({
          user_id: userId,
          role: role,
          assigned_by: user.id,
        });

      if (roleError) {
        throw roleError;
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
