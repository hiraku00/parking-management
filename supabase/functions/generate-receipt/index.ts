import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { payment_id, contractor_id, year, month, amount, paid_at, stripe_payment_intent_id } = await req.json();

    // Supabaseクライアントの初期化
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 契約者情報の取得
    const { data: contractor, error: contractorError } = await supabaseClient
      .from("contractors")
      .select("*")
      .eq("id", contractor_id)
      .single();

    if (contractorError) throw contractorError;

    // PDFの生成
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4サイズ
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // タイトル
    page.drawText("領収書", {
      x: 250,
      y: 750,
      size: 24,
      font: boldFont,
    });

    // 日付
    page.drawText(`発行日: ${new Date().toLocaleDateString("ja-JP")}`, {
      x: 400,
      y: 700,
      size: 12,
      font: font,
    });

    // 契約者情報
    page.drawText(`契約者名: ${contractor.name}`, {
      x: 50,
      y: 650,
      size: 12,
      font: font,
    });

    page.drawText(`駐車スペース番号: ${contractor.parking_number}`, {
      x: 50,
      y: 630,
      size: 12,
      font: font,
    });

    // 支払い情報
    page.drawText(`支払年月: ${year}年${month}月`, {
      x: 50,
      y: 590,
      size: 12,
      font: font,
    });

    page.drawText(`支払金額: ¥${amount.toLocaleString()}`, {
      x: 50,
      y: 570,
      size: 12,
      font: boldFont,
    });

    page.drawText(`支払日時: ${new Date(paid_at).toLocaleString("ja-JP")}`, {
      x: 50,
      y: 550,
      size: 12,
      font: font,
    });

    page.drawText(`取引ID: ${stripe_payment_intent_id}`, {
      x: 50,
      y: 530,
      size: 10,
      font: font,
    });

    // 印鑑欄
    page.drawText("印", {
      x: 450,
      y: 200,
      size: 12,
      font: font,
    });

    // PDFの生成
    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="receipt_${year}${month}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
