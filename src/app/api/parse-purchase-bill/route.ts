import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth, validateFileUpload } from "@/lib/api-auth";

const PURCHASE_BILL_PROMPT = `You are an expert at extracting structured data from Indian purchase bills, vendor invoices, and receipts.

Extract ALL information from this purchase bill/vendor invoice and return a JSON object with this exact structure:

{
  "vendor": {
    "name": "string - business/company name of the seller",
    "gstin": "string or null - GST Identification Number (15 chars)",
    "address": "string or null"
  },
  "bill": {
    "billNumber": "string - the invoice/bill number",
    "billDate": "YYYY-MM-DD",
    "placeOfSupply": "string or null - state name or code"
  },
  "items": [
    {
      "description": "string - item/product/service description",
      "hsnSac": "string or null - HSN/SAC code",
      "qty": 1,
      "rate": 0,
      "gstRate": 18
    }
  ],
  "totals": {
    "subtotal": 0,
    "cgst": 0,
    "sgst": 0,
    "igst": 0,
    "cess": 0,
    "totalGst": 0,
    "totalAmount": 0
  },
  "payment": {
    "mode": "string or null - cash/card/upi/neft/etc",
    "details": "string or null - any payment reference"
  },
  "category": "string - one of: equipment, software, office_supplies, travel, professional_services, rent, utilities, telecom, other"
}

IMPORTANT RULES:
- All amounts should be plain numbers (e.g. 10000 not "10,000.00")
- Dates must be in YYYY-MM-DD format
- If GST is split into CGST+SGST, set igst=0 and fill cgst/sgst
- If GST is IGST only, set cgst=0, sgst=0 and fill igst
- totalGst = cgst + sgst + igst + cess
- totalAmount = subtotal + totalGst
- For rate: if prices include GST, back-calculate the base rate
- Infer category from the items (laptop/phone = equipment, Adobe/MS = software, etc.)
- Return ONLY valid JSON, no markdown, no explanation`;

export async function POST(req: NextRequest) {
  try {
    const authError = validateApiAuth(req);
    if (authError) return authError;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const fileError = validateFileUpload(file, {
      maxSizeMB: 50,
      allowedTypes: ["pdf", "jpg", "jpeg", "png"],
    });
    if (fileError) return fileError;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const base64 = fileBuffer.toString("base64");
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    const mimeType = isPdf ? "application/pdf" : file.type || "image/jpeg";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: isPdf ? "file" : "image_url",
                ...(isPdf
                  ? { file: { filename: file.name, file_data: `data:${mimeType};base64,${base64}` } }
                  : { image_url: { url: `data:${mimeType};base64,${base64}` } }),
              },
              { type: "text", text: PURCHASE_BILL_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `OpenAI error: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: `Parse error: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
