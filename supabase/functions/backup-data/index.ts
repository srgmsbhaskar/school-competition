import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the requesting user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const method = req.method;

    if (method === "GET") {
      // Export all data
      const tables = ["students", "competitions", "events", "event_classes", "student_participations", "competition_prizes", "teacher_assignments", "categories", "profiles", "user_roles", "department_assignments", "app_settings", "audit_logs"];
      const backup: Record<string, any[]> = { _meta: [{ created_at: new Date().toISOString(), version: "1.0" }] };

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) {
          console.error(`Error fetching ${table}:`, error);
          backup[table] = [];
        } else {
          backup[table] = data || [];
        }
      }

      return new Response(JSON.stringify(backup, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Content-Disposition": `attachment; filename=backup-${new Date().toISOString().split("T")[0]}.json` },
      });
    }

    if (method === "POST") {
      // Restore data
      const body = await req.json();
      const restoreOrder = ["categories", "students", "competitions", "events", "event_classes", "teacher_assignments", "student_participations", "competition_prizes"];

      const results: Record<string, { inserted: number; errors: string[] }> = {};

      for (const table of restoreOrder) {
        if (!body[table] || body[table].length === 0) continue;
        results[table] = { inserted: 0, errors: [] };

        // Delete existing data first
        const { error: deleteError } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (deleteError) {
          results[table].errors.push(`Delete failed: ${deleteError.message}`);
        }

        // Insert in batches of 100
        const rows = body[table];
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100);
          const { error: insertError } = await supabase.from(table).insert(batch);
          if (insertError) {
            results[table].errors.push(`Insert batch ${i}: ${insertError.message}`);
          } else {
            results[table].inserted += batch.length;
          }
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
