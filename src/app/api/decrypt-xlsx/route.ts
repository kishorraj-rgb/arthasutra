import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const password = formData.get("password") as string | null;

    if (!file || !password) {
      return NextResponse.json(
        { error: "File and password are required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Dynamic import to avoid bundling issues
    const officeCrypto = await import("officecrypto-tool");
    const decryptedBuffer = await officeCrypto.decrypt(buffer, { password });

    // Return the decrypted file as binary
    const uint8 = new Uint8Array(decryptedBuffer);
    return new NextResponse(uint8, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file.name}"`,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Decryption failed";

    // Wrong password typically throws a specific error
    if (
      message.includes("password") ||
      message.includes("decrypt") ||
      message.includes("CFB")
    ) {
      return NextResponse.json(
        { error: "Incorrect password. Please try again." },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
