import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

type NumericRecord = {
  value?: number | null;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Internal server error";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { date } = await req.json();
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const { data: hrvRecords, error: hrvError } = await supabase
      .from("health_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("record_type", "hrv")
      .gte("recorded_at", targetDate + "T00:00:00.000Z")
      .lte("recorded_at", targetDate + "T23:59:59.999Z")
      .order("recorded_at", { ascending: false });

    if (hrvError) {
      console.error("Error fetching HRV records:", hrvError);
    }

    const { data: sleepRecords } = await supabase
      .from("health_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("record_type", "sleep")
      .gte("recorded_at", targetDate + "T00:00:00.000Z")
      .lte("recorded_at", targetDate + "T23:59:59.999Z")
      .order("recorded_at", { ascending: false });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let dataContext = "";
    if (!hrvRecords || hrvRecords.length === 0) {
      dataContext = "owner今天还没有HRV数据呢。HRV（心率变异性）可以反映身体的压力和恢复状态哦！";
    } else {
      const typedHrvRecords = hrvRecords as NumericRecord[];
      const avgHRV = Math.round(
        typedHrvRecords.reduce((sum: number, r: NumericRecord) => sum + Number(r.value || 0), 0) / hrvRecords.length
      );
      dataContext = "owner今天的平均HRV是" + avgHRV + "ms。";
      
      if (avgHRV > 60) {
        dataContext += "这是个很好的水平呢！";
      } else if (avgHRV > 40) {
        dataContext += "处于正常范围内。";
      } else {
        dataContext += "有点偏低呢，可能需要多休息。";
      }
    }

    if (sleepRecords && sleepRecords.length > 0) {
      const sleepHours = sleepRecords[0].value || 0;
      dataContext += "\n\n昨晚睡了" + sleepHours.toFixed(1) + "小时。";
    }

    if (profile) {
      dataContext += "\nowner的目标是" + (profile.goal || "健康管理") + "。";
    }

    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get('DeepSeek_API_KEY')}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是小瑞，一个温暖友好的健康助手。用亲切可爱的语气，称呼用户为'owner'。分析HRV数据并给出建议时要专业但不失温暖，多用'呢'、'哦'、'呀'等语气词。",
          },
          {
            role: "user",
            content: "请分析今天的HRV情况并给出建议：\n\n" + dataContext + "\n\n请用温暖友好的语气给出简短的分析和建议（100字以内）。",
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!deepseekResponse.ok) {
      throw new Error("DeepSeek API error: " + deepseekResponse.status);
    }

    const deepseekData = await deepseekResponse.json();
    const analysis = deepseekData.choices[0].message.content;

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in analyze-hrv:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});