import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth, validateFileUpload } from "@/lib/api-auth";

const INSURANCE_PROMPT = `You are a financial document parser specializing in Indian insurance policy documents.

Extract ALL information from this insurance policy PDF and return a JSON object with this exact structure:

{
  "policyDetails": {
    "provider": "string - insurance company name e.g. 'Go Digit General Insurance', 'Aditya Birla Health Insurance'",
    "policy_number": "string - the policy number",
    "type": "term|health|vehicle|home|travel",
    "sum_assured": number (total sum insured / cover amount),
    "annual_premium": number (total premium including GST — the final/gross premium),
    "next_due_date": "YYYY-MM-DD (policy end date or next renewal date)",
    "policy_start_date": "YYYY-MM-DD",
    "policy_end_date": "YYYY-MM-DD",
    "nominee": "string or null",
    "coverage_type": "string - e.g. 'comprehensive', 'own_damage', 'third_party', 'family_floater', 'individual'",
    "policy_category": "string - 'new' or 'renewal'",
    "ncb_percent": number or null (No Claim Bonus percentage),
    "deductible": number or null (compulsory + voluntary deductible total),
    "financier": "string or null (if vehicle is financed)",
    "previous_policy_number": "string or null",
    "previous_insurer": "string or null"
  },
  "premium_breakdown": {
    "net_premium": number (before GST),
    "gst": number (total GST amount),
    "total_premium": number (final premium)
  },
  "vehicle_details": {
    "registration_no": "string or null",
    "make": "string or null (manufacturer e.g. SUZUKI, TOYOTA)",
    "model": "string or null (e.g. ACCESS, INNOVA HYCROSS)",
    "variant": "string or null (full variant name)",
    "fuel_type": "string or null",
    "year": "string or null (year of manufacture/registration)",
    "engine_no": "string or null",
    "chassis_no": "string or null",
    "rto_location": "string or null",
    "idv": number or null (Insured Declared Value),
    "body_type": "string or null (Scooter, Sedan, SUV, Hatchback, etc.)"
  },
  "insured_members": [
    {
      "name": "string",
      "relationship": "string (Self, Spouse, Son, Daughter, etc.)",
      "dob": "YYYY-MM-DD or null",
      "member_id": "string or null",
      "gender": "Male|Female or null",
      "age": number or null
    }
  ],
  "add_ons": [
    {
      "name": "string - add-on cover name",
      "details": "string or null - coverage details",
      "uin": "string or null - UIN number"
    }
  ]
}

IMPORTANT RULES:
- For type: Vehicle insurance (car, bike, scooter, two-wheeler) → "vehicle", Health → "health", Term life → "term", Home → "home", Travel → "travel"
- For vehicle policies: Extract ALL vehicle details (make, model, variant, engine no, chassis no, IDV, etc.)
- For health policies: Extract ALL insured members with their details
- For add-ons: Extract ALL add-on covers listed
- Amounts should be plain numbers without commas
- Dates must be in YYYY-MM-DD format
- If a field is not present in the document, use null
- vehicle_details should be null if this is not a vehicle policy
- insured_members should be an empty array if not a health/family policy
- add_ons should be an empty array if no add-ons
- Return ONLY valid JSON, no markdown, no explanation`;

export async function POST(req: NextRequest) {
  try {
    const authError = validateApiAuth(req);
    if (authError) return authError;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const password = formData.get("password") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const fileError = validateFileUpload(file, { maxSizeMB: 50, allowedTypes: ["pdf", "xlsx", "xls", "csv", "jpg", "jpeg", "png"] });
    if (fileError) return fileError;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    let fileBuffer = Buffer.from(await file.arrayBuffer());
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    let extractedText: string | null = null;

    // For password-protected PDFs, extract text using unpdf
    if (password && isPdf) {
      try {
        const { getDocumentProxy } = await import("unpdf");
        const uint8 = new Uint8Array(fileBuffer);
        const doc = await getDocumentProxy(uint8, { password });
        const pages: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const text = textContent.items.map((item: any) => item.str).join(" ");
          pages.push(`--- PAGE ${i} ---\n${text}`);
        }
        extractedText = pages.join("\n\n");
        doc.destroy();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Decryption failed";
        if (msg.includes("password") || msg.includes("Password")) {
          return NextResponse.json(
            { error: "Incorrect PDF password." },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: `PDF error: ${msg}` },
          { status: 401 }
        );
      }
    }

    // For password-protected Office files
    if (password && !isPdf) {
      try {
        const officeCrypto = await import("officecrypto-tool");
        fileBuffer = Buffer.from(
          await officeCrypto.decrypt(fileBuffer, { password })
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Decryption failed";
        return NextResponse.json(
          { error: `Decryption failed: ${msg}` },
          { status: 401 }
        );
      }
    }

    // Build OpenAI request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];

    if (extractedText) {
      content.push({
        type: "text",
        text: `Here is the extracted text from an insurance policy PDF:\n\n${extractedText}\n\n${INSURANCE_PROMPT}`,
      });
    } else {
      const base64 = fileBuffer.toString("base64");
      const mimeType = isPdf
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      content.push({
        type: "file",
        file: {
          filename: file.name,
          file_data: `data:${mimeType};base64,${base64}`,
        },
      });
      content.push({ type: "text", text: INSURANCE_PROMPT });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content }],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `OpenAI API error: ${errText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Parse error: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
