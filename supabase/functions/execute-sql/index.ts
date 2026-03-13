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
        // First handle quoted placeholders: '{{params.key}}'
        const quotedPlaceholder = new RegExp(`'\\{\\{params\\.${key}\\}\\}'`, "g");
        // Then handle unquoted placeholders: {{params.key}}
        const unquotedPlaceholder = new RegExp(`\\{\\{params\\.${key}\\}\\}`, "g");

        if (value === null || value === undefined) {
          processedQuery = processedQuery.replace(quotedPlaceholder, "NULL");
          processedQuery = processedQuery.replace(unquotedPlaceholder, "NULL");
        } else if (typeof value === "string") {
          const escaped = String(value).replace(/'/g, "''");
          processedQuery = processedQuery.replace(quotedPlaceholder, `'${escaped}'`);
          processedQuery = processedQuery.replace(unquotedPlaceholder, `'${escaped}'`);
        } else if (typeof value === "number" || typeof value === "boolean") {
          processedQuery = processedQuery.replace(quotedPlaceholder, String(value));
          processedQuery = processedQuery.replace(unquotedPlaceholder, String(value));
        } else {
          const escaped = JSON.stringify(value).replace(/'/g, "''");
          processedQuery = processedQuery.replace(quotedPlaceholder, `'${escaped}'`);
          processedQuery = processedQuery.replace(unquotedPlaceholder, `'${escaped}'`);
        }
      }
    }

    console.log(`[execute-sql] Running query: ${processedQuery.substring(0, 200)}...`);

    // Use the database URL directly with postgres.js
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_DB_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Dynamic import of postgres
    const postgres = (await import("https://deno.land/x/postgresjs@v3.4.5/mod.js")).default;
    const sql = postgres(dbUrl, { max: 1 });

    try {
      const result = await sql.unsafe(processedQuery);
      await sql.end();

      return new Response(
        JSON.stringify({ data: Array.from(result), error: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (pgError: any) {
      await sql.end();
      console.error(`[execute-sql] SQL error:`, pgError.message);
      return new Response(
        JSON.stringify({ data: null, error: pgError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error(`[execute-sql] Error:`, error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
