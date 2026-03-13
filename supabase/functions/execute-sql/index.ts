import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, params } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'query' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Substitute {{params.xxx}} with actual values
    let processedQuery = query;
    if (params && typeof params === "object") {
      for (const [key, value] of Object.entries(params)) {
        const placeholder = new RegExp(`\\{\\{params\\.${key}\\}\\}`, "g");
        if (value === null || value === undefined) {
          processedQuery = processedQuery.replace(placeholder, "NULL");
        } else if (typeof value === "string") {
          // Escape single quotes to prevent SQL injection
          const escaped = String(value).replace(/'/g, "''");
          // Remove surrounding quotes if the placeholder is already inside quotes
          processedQuery = processedQuery.replace(
            new RegExp(`'\\{\\{params\\.${key}\\}\\}'`, "g"),
            `'${escaped}'`
          );
          processedQuery = processedQuery.replace(placeholder, `'${escaped}'`);
        } else {
          processedQuery = processedQuery.replace(placeholder, String(value));
        }
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use the Supabase Data API to execute raw SQL via pg
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Execute via rpc or direct pg - use the REST SQL endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    // Actually, let's use the pg_net or direct SQL execution via supabase-js
    // The cleanest way is to use the postgres connection directly
    // Let's use the Supabase Management API or a simpler approach

    // Use fetch to the Supabase SQL endpoint (available via service role)
    const sqlResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ sql_query: processedQuery }),
    });

    if (!sqlResponse.ok) {
      // If exec_sql function doesn't exist, try creating it or use alternative
      // Fall back to using the postgres connection from SUPABASE_DB_URL
      const dbUrl = Deno.env.get("SUPABASE_DB_URL");
      if (!dbUrl) {
        return new Response(
          JSON.stringify({ 
            error: "Database connection not available. Please ensure exec_sql function exists or SUPABASE_DB_URL is set.",
            details: await sqlResponse.text()
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use Deno's postgres client
      const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
      const sql = postgres(dbUrl, { max: 1 });
      
      try {
        const result = await sql.unsafe(processedQuery);
        await sql.end();
        
        return new Response(
          JSON.stringify({ data: result, error: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (pgError) {
        await sql.end();
        return new Response(
          JSON.stringify({ data: null, error: pgError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const data = await sqlResponse.json();
    return new Response(
      JSON.stringify({ data, error: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
