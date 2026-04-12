import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth, validateFileUpload } from "@/lib/api-auth";

const LOAN_PROMPT = `You are a financial document parser specializing in Indian bank loan account statements.

Extract ALL information from this loan statement PDF and return a JSON object with this exact structure:

{
  "loanDetails": {
    "account_number": "string - the loan account number",
    "lender": "string - bank name e.g. 'State Bank of India'",
    "product_type": "string - e.g. 'Auto Loan', 'Home Loan', 'Personal Loan', 'Education Loan'",
    "sanctioned_amount": number,
    "outstanding": number,
    "interest_rate": number (as percentage e.g. 9.2),
    "loan_term": number (total tenure in months),
    "remaining_tenure": number (remaining months),
    "emi_amount": number,
    "emi_date": number (day of month EMI is deducted, e.g. 10),
    "start_date": "YYYY-MM-DD",
    "ifsc_code": "string",
    "branch_name": "string",
    "loan_type": "home|car|personal|education"
  },
  "transactions": [
    {
      "post_date": "YYYY-MM-DD",
      "value_date": "YYYY-MM-DD",
      "description": "string - the full transaction description",
      "debit": number (0 if no debit),
      "credit": number (0 if no credit),
      "balance": number,
      "type": "interest|principal_repayment|compound_repayment|interest_repayment|charges|deposit|other",
      "reference": "string or null"
    }
  ]
}

IMPORTANT RULES:
- For loan_type: Map "Auto Loan" to "car", "Home Loan"/"Housing Loan" to "home", "Education Loan" to "education", anything else to "personal"
- For transaction type classification:
  - "INTEREST" entries → "interest"
  - "PRINCIPAL REPAYMENT" → "principal_repayment"
  - "COMPOUND REPAYMENT" → "compound_repayment"
  - "INTEREST REPAYMENT" → "interest_repayment"
  - "CHARGES"/"AMC"/"COMM" → "charges"
  - "DEPOSIT"/"DEPOSIT TRANSFER" → "deposit"
  - Everything else → "other"
- All amounts should be plain numbers without commas (e.g. 34050 not "34,050.00")
- Dates must be in YYYY-MM-DD format
- Extract EVERY transaction from ALL pages — do not skip any
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
            { error: "Incorrect PDF password. Please try again." },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: `PDF decryption failed: ${msg}` },
          { status: 401 }
        );
      }
    }

    // For password-protected Office files (XLSX/XLS), use officecrypto-tool
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
    // If we extracted text from an encrypted PDF, send as text prompt
    // Otherwise, send the file as base64
    const mimeType = isPdf
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    // Build content array for OpenAI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];

    if (extractedText) {
      // Password-protected PDF: send extracted text
      content.push({
        type: "text",
        text: `Here is the extracted text from a loan statement PDF:\n\n${extractedText}\n\n${LOAN_PROMPT}`,
      });
    } else {
      // Regular file: send as base64
      const base64 = fileBuffer.toString("base64");
      content.push({
        type: "file",
        file: {
          filename: file.name,
          file_data: `data:${mimeType};base64,${base64}`,
        },
      });
      content.push({ type: "text", text: LOAN_PROMPT });
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
