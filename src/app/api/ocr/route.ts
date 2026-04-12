import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth, validateFileUpload } from "@/lib/api-auth";

interface ExtractedData {
  pan_number?: string;
  aadhaar_number?: string;
  name?: string;
  dob?: string;
  address?: string;
  account_number?: string;
  ifsc?: string;
  bank_name?: string;
  invoice_number?: string;
  amount?: string;
  date?: string;
  gst_number?: string;
}

function parsePanCard(text: string): ExtractedData {
  const data: ExtractedData = {};
  const panMatch = text.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
  if (panMatch) data.pan_number = panMatch[0];

  const dobMatch = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
  if (dobMatch) data.dob = dobMatch[1];

  // Try to extract name - usually the line after "Name" or before the PAN number
  const nameMatch = text.match(/(?:Name|name)\s*[:\-]?\s*([A-Z][A-Z\s]+)/);
  if (nameMatch) data.name = nameMatch[1].trim();

  return data;
}

function parseAadhaar(text: string): ExtractedData {
  const data: ExtractedData = {};
  const aadhaarMatch = text.match(/\d{4}\s?\d{4}\s?\d{4}/);
  if (aadhaarMatch) data.aadhaar_number = aadhaarMatch[0].replace(/\s/g, " ");

  const dobMatch = text.match(/(?:DOB|Date of Birth|Birth)\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
  if (dobMatch) data.dob = dobMatch[1];

  const nameMatch = text.match(/(?:Name|name)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]+)/);
  if (nameMatch) data.name = nameMatch[1].trim();

  // Address - try to get multi-line address
  const addressMatch = text.match(/(?:Address|address)\s*[:\-]?\s*([\s\S]{10,200}?)(?:\n\n|\d{4}\s?\d{4}|\d{6})/i);
  if (addressMatch) data.address = addressMatch[1].trim().replace(/\s+/g, " ");

  return data;
}

function parseBankStatement(text: string): ExtractedData {
  const data: ExtractedData = {};

  const accountMatch = text.match(/(?:Account\s*(?:No|Number|#)?)\s*[:\-]?\s*(\d{9,18})/i);
  if (accountMatch) data.account_number = accountMatch[1];

  const ifscMatch = text.match(/(?:IFSC)\s*[:\-]?\s*([A-Z]{4}0[A-Z0-9]{6})/i);
  if (ifscMatch) data.ifsc = ifscMatch[1];

  const bankMatch = text.match(/(HDFC|ICICI|SBI|Axis|Kotak|IndusInd|Yes|IDFC|Federal|Canara|PNB|BOB|Union|Indian)\s*(?:Bank)?/i);
  if (bankMatch) data.bank_name = bankMatch[0].trim();

  return data;
}

function parseInvoice(text: string): ExtractedData {
  const data: ExtractedData = {};

  const invoiceMatch = text.match(/(?:Invoice\s*(?:No|Number|#)?)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i);
  if (invoiceMatch) data.invoice_number = invoiceMatch[1];

  const amountMatch = text.match(/(?:Total|Amount|Grand Total|Net Amount)\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d{0,2})/i);
  if (amountMatch) data.amount = amountMatch[1];

  const dateMatch = text.match(/(?:Date|Invoice Date)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dateMatch) data.date = dateMatch[1];

  const gstMatch = text.match(/(?:GSTIN|GST\s*(?:No|Number)?)\s*[:\-]?\s*(\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z0-9])/i);
  if (gstMatch) data.gst_number = gstMatch[1];

  return data;
}

function parseByCategory(text: string, category: string): ExtractedData {
  switch (category) {
    case "pan_card":
      return parsePanCard(text);
    case "aadhaar":
      return parseAadhaar(text);
    case "bank_statement":
    case "salary_slip":
      return parseBankStatement(text);
    case "invoice":
    case "receipt":
    case "gst_return":
      return parseInvoice(text);
    default:
      return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = validateApiAuth(req);
    if (authError) return authError;

    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Google Cloud Vision API key not configured. Please add GOOGLE_VISION_API_KEY to your .env.local file. " +
            "You can get one from https://console.cloud.google.com/apis/credentials after enabling the Cloud Vision API.",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { fileUrl, category } = body as { fileUrl: string; category: string };

    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl is required" }, { status: 400 });
    }

    // Fetch the image and convert to base64
    const imageResponse = await fetch(fileUrl);
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch image from URL" }, { status: 400 });
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Call Google Cloud Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      const errorData = await visionResponse.text();
      return NextResponse.json(
        { error: `Vision API error: ${errorData}` },
        { status: 502 }
      );
    }

    const visionResult = await visionResponse.json();
    const annotations = visionResult.responses?.[0]?.textAnnotations;
    const fullText = annotations?.[0]?.description ?? "";

    if (!fullText) {
      return NextResponse.json({
        text: "",
        data: {},
        message: "No text could be extracted from this image.",
      });
    }

    // Parse extracted text based on category
    const data = parseByCategory(fullText, category || "other");

    return NextResponse.json({ text: fullText, data });
  } catch (err) {
    return NextResponse.json(
      {
        error: `OCR processing failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
