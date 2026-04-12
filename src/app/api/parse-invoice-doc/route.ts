import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth, validateFileUpload } from "@/lib/api-auth";

const INVOICE_EXTRACT_PROMPT = `You are an expert at extracting structured data from Indian invoices, bills, and quotations.

Extract ALL information from this invoice document and return a JSON object with this exact structure:

{
  "seller": {
    "name": "string - business/company name of the seller/service provider",
    "address": "string or null",
    "gstin": "string or null - GST Identification Number (15 chars)",
    "pan": "string or null",
    "email": "string or null",
    "phone": "string or null"
  },
  "buyer": {
    "name": "string - customer/client name",
    "address": "string or null",
    "gstin": "string or null",
    "pan": "string or null",
    "email": "string or null",
    "phone": "string or null"
  },
  "invoice": {
    "documentType": "invoice|quotation|proforma|credit_note|debit_note|purchase_order|delivery_challan",
    "invoiceNumber": "string - the invoice/bill number",
    "invoiceDate": "YYYY-MM-DD",
    "dueDate": "YYYY-MM-DD or null",
    "placeOfSupplyCode": "string or null - 2-digit state code from GSTIN",
    "terms": "string or null - payment terms like Net 30"
  },
  "items": [
    {
      "description": "string - item/service description",
      "hsnSac": "string or null - HSN/SAC code",
      "qty": number,
      "rate": number (per unit price without tax),
      "gstRate": number (GST percentage e.g. 18, 12, 5, 0)
    }
  ],
  "totals": {
    "subtotal": number (total before tax),
    "cgst": number or 0,
    "sgst": number or 0,
    "igst": number or 0,
    "gstTotal": number (total GST),
    "tdsAmount": number or 0,
    "tdsRate": number or 0,
    "roundOff": number or 0,
    "netTotal": number (final payable amount)
  },
  "bank": {
    "accountName": "string or null",
    "accountNumber": "string or null",
    "bankName": "string or null",
    "branch": "string or null",
    "ifscCode": "string or null"
  },
  "notes": "string or null - any terms, notes, or remarks"
}

IMPORTANT RULES:
- All amounts should be plain numbers (e.g. 10000 not "10,000.00")
- Dates must be in YYYY-MM-DD format
- If GST is split into CGST+SGST, set igst=0 and fill cgst/sgst
- If GST is IGST only, set cgst=0, sgst=0 and fill igst
- Extract EVERY line item — do not skip any
- For rate: if prices include GST, back-calculate the base rate
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

    const fileError = validateFileUpload(file, { maxSizeMB: 50, allowedTypes: ["pdf", "xlsx", "xls", "csv", "jpg", "jpeg", "png"] });
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
              { type: "text", text: INVOICE_EXTRACT_PROMPT },
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
