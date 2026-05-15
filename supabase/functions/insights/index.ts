import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables missing');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from the JWT (to verify they are authenticated)
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // In a real app, query business data related to the user here
    // For now we mock the RAG retrieval response
    const dbContext = {
      sales: { last7Days: 2450.00, variance: '+15%' },
      lowStock: ['Panadol 500mg', 'White Sugar 2kg'],
      voids: 2,
    };

    // Body parsing
    let userPrompt = "Provide general stock insights.";
    if (req.method === "POST") {
      const body = await req.json();
      if (body.query) userPrompt = body.query;
    }

    // Initialize Gemini AI
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
       throw new Error('Gemini API key missing');
    }
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const systemInstruction = `You are Tareza Assistant, an expert business advisor for African businesses. 
    Use this business context to answer questions concisely:
    ${JSON.stringify(dbContext)}
    `;

    // Call Gemini Flash for fast reasoning
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash',
      contents: `${systemInstruction}\n\nUser Question: ${userPrompt}`,
    });

    const aiResponse = response.text || "No insights available.";

    // Return the response
    return new Response(JSON.stringify({ result: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
