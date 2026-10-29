import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);
serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string,string> = { "Content-Type":"application/json", "Access-Control-Allow-Methods":"POST, OPTIONS", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Vary":"Origin" };
  if (allowedOrigins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error:"Method not allowed" }), { status:405, headers });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), key = Deno.env.get("OPENAI_API_KEY");
    if (!token || !url || !anon) return new Response(JSON.stringify({error:"Sign in is required."}), {status:401,headers});
    if (!key) return new Response(JSON.stringify({error:"AI draft service is not configured. Add OPENAI_API_KEY to Edge Function secrets."}), {status:503,headers});
    const sb = createClient(url, anon, { global:{ headers:{ Authorization:`Bearer ${token}` } } });
    const {data:userData,error:userError} = await sb.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({error:"Valid sign-in is required."}), {status:401,headers});
    const {data:subs,error:subError} = await sb.from("advocate_subscriptions").select("id").eq("user_id",userData.user.id).eq("active",true).gt("ends_at",new Date().toISOString()).limit(1);
    if (subError || !subs?.length) return new Response(JSON.stringify({error:"An active, owner-approved advocate subscription is required."}), {status:403,headers});
    const body = await req.json();
    const kind = typeof body.kind === 'string' ? body.kind.slice(0,120) : 'Legal document outline';
    const language = typeof body.language === 'string' ? body.language.slice(0,40) : 'Hinglish';
    const facts = typeof body.facts === 'string' ? body.facts.trim() : '';
    const relief = typeof body.relief === 'string' ? body.relief.trim().slice(0,3000) : '';
    if (!facts || facts.length > 10000) return new Response(JSON.stringify({error:"Facts must be between 1 and 10000 characters."}),{status:400,headers});
    const instructions = `Prepare a FIRST DRAFT of a legal document outline in the context of Indian law. Output in ${language}. Document type: ${kind}. Desired outcome: ${relief || 'Not specified'}. Facts supplied: ${facts}. Use placeholders for unknown names, dates, addresses, court/authority, case numbers and statutory provisions. Do not invent case law, legal sections, court names, facts, deadlines or citations. If the correct forum or legal basis cannot be established, mark it [VERIFY WITH ADVOCATE] and list questions needing clarification. Structure with title, parties, subject, chronology, numbered statements, requested relief, annexures, date/place/signature placeholders and review checklist where suitable. Do not claim the draft is court-ready or guarantee legal effect. Do not request Aadhaar, OTPs or bank credentials. Clearly label it as a draft requiring review by a qualified Indian advocate before sending or filing.`;
    const response = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{ Authorization:`Bearer ${key}`, 'Content-Type':'application/json' }, body:JSON.stringify({ model:Deno.env.get('LEGAL_DRAFT_MODEL') ?? 'gpt-4.1-mini', instructions, input:'Prepare the requested first draft now.', max_output_tokens:2200 }) });
    if (!response.ok) { console.error('AI draft provider failed', response.status, (await response.text()).slice(0,500)); return new Response(JSON.stringify({error:'AI draft service failed. Check server-side model/API configuration.'}),{status:502,headers}); }
    const result = await response.json();
    return new Response(JSON.stringify({draft:typeof result.output_text === 'string' ? result.output_text : 'Could not generate a draft. Please try again.'}),{headers});
  } catch { return new Response(JSON.stringify({error:'Invalid request.'}),{status:400,headers}); }
});
