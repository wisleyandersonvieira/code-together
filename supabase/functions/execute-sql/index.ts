import { corsHeaders } from "../_shared/cors.ts";

/**
 * Evaluates UIBakery-style template expressions in SQL queries.
 * Handles both:
 *   - Simple: {{params.key}}
 *   - Conditional: {{ params && params.key ? "SQL fragment" : "" }}
 */
function processTemplate(query: string, params: Record<string, any>): string {
  // First, evaluate complex JS expressions: {{ expr }}
  // These contain ternary operators, && chains, etc.
  let processed = query.replace(/\{\{([\s\S]*?)\}\}/g, (_match, expr: string) => {
    const trimmed = expr.trim();

    // Simple param reference: params.key or params.key::type
    const simpleMatch = trimmed.match(/^params\.(\w+)(::.*)?$/);
    if (simpleMatch) {
      const key = simpleMatch[1];
      const cast = simpleMatch[2] || "";
      const value = params[key];
      if (value === null || value === undefined) {
        return "NULL" + cast;
      } else if (typeof value === "number" || typeof value === "boolean") {
        return String(value) + cast;
      } else {
        const escaped = String(value).replace(/'/g, "''");
        return `'${escaped}'` + cast;
      }
    }

    // Complex expression - evaluate as JavaScript with params in scope
    try {
      // Create a function that has access to params
      const fn = new Function("params", `
        try {
          return (${trimmed});
        } catch(e) {
          return "";
        }
      `);
      const result = fn(params);
      if (result === null || result === undefined || result === false) {
        return "";
      }
      return String(result);
    } catch (_e) {
      console.warn(`[execute-sql] Failed to evaluate expression: ${trimmed}`);
      return "";
    }
  });

  return processed;
}

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

    // Process all template expressions
    const processedQuery = processTemplate(query, params || {});

    // Clean up any trailing semicolons followed by whitespace issues
    const cleanQuery = processedQuery.replace(/;\s*$/, "").trim();

    console.log(`[execute-sql] Running query: ${cleanQuery.substring(0, 200)}...`);

    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_DB_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const postgres = (await import("https://deno.land/x/postgresjs@v3.4.5/mod.js")).default;
    const sql = postgres(dbUrl, { max: 1 });

    try {
      const result = await sql.unsafe(cleanQuery);
      await sql.end();

      return new Response(
        JSON.stringify({ data: Array.from(result), error: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (pgError: any) {
      await sql.end();
      console.error(`[execute-sql] SQL error:`, pgError.message);
      console.error(`[execute-sql] Failed query:`, cleanQuery.substring(0, 500));
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
