import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);
const officialSources = [
  { title: "India Code — official legislation repository", url: "https://www.indiacode.nic.in/" },
  { title: "NALSA — National Legal Services Authority", url: "https://nalsa.gov.in/" },
  { title: "eCourts Services", url: "https://ecourts.gov.in/" },
  { title: "Supreme Court of India", url: "https://www.sci.gov.in/" },
];
serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string,string> = { "Content-Type": "application/json", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Vary": "Origin" };
  if (allowedOrigins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  try {
    const body = await req.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const language = typeof body.language === "string" ? body.language.slice(0,50) : "English";
    const history = Array.isArray(body.history) ? body.history.slice(-8).filter((m: any) => m && ["user","assistant"].includes(m.role) && typeof m.text === "string").map((m: any) => ({ role:m.role, content:m.text.slice(0,3000) })) : [];
    if (!question || question.length > 4000) return new Response(JSON.stringify({ error: "Question must be between 1 and 4000 characters." }), { status: 400, headers });
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const apiKey = groqKey || openAiKey;

    if (!apiKey) return new Response(JSON.stringify({ error: "AI service is not configured. Set GROQ_API_KEY or OPENAI_API_KEY in Supabase Edge Function secrets." }), { status: 503, headers });

    const endpoint = groqKey ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
    const model = groqKey
      ? (Deno.env.get("GROQ_MODEL") ?? "llama-3.3-70b-versatile")
      : (Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini");

    const system = `You are NayayaMitra, a careful Indian legal information assistant. Respond in ${language}; if the user writes Hinglish, naturally use Hinglish. Explain in a warm, clear, structured way: (1) your understanding of the situation, (2) key facts that are missing, (3) general legal options and practical next steps, (4) documents/evidence to preserve, and (5) urgency/deadlines where relevant. Ask concise follow-up questions when facts materially change the answer. India-only law. Do not invent statutes, sections, judgments, citations, case numbers, legal deadlines, or pretend to have searched sources. If uncertain, say so and direct the user to verify current law on India Code or with a qualified Indian advocate. Distinguish general information from advice by a retained lawyer. Never guarantee outcomes. For urgent danger, advise contacting local emergency services. Do not request Aadhaar, passwords, OTPs, full bank details or unnecessary sensitive identifiers. Do not claim the links supplied separately were consulted for this answer. Avoid lengthy disclaimers; give a useful answer first, then a short caution.`;
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0.25, max_tokens: 1200, messages: [{ role: "system", content: system }, ...history, { role: "user", content: question }] })
    });
    if (!response.ok) { const detail = await response.text(); console.error("AI provider error", response.status, detail.slice(0,500)); return new Response(JSON.stringify({ error: "AI service could not complete this request. Please try again shortly." }), { status: 502, headers }); }
    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) throw new Error("Empty AI response");
    return new Response(JSON.stringify({ answer: answer.trim(), sources: officialSources }), { headers });
  } catch (error) {
    console.error("legal-chat error", error);
    return new Response(JSON.stringify({ error: "Invalid request or temporary service failure." }), { status: 400, headers });
  }
});
