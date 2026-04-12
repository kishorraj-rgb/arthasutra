import { NextRequest, NextResponse } from "next/server";

/**
 * Validate API request has a valid session.
 * Checks for session token in cookie or Authorization header.
 * Returns null if valid, or an error response if invalid.
 */
export function validateApiAuth(req: NextRequest): NextResponse | null {
  // Check for session cookie (NextAuth)
  const sessionToken =
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  // Also accept Authorization header (for programmatic access)
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!sessionToken && !bearerToken) {
    return NextResponse.json(
      { error: "Unauthorized. Please sign in." },
      { status: 401 }
    );
  }

  return null; // Authorized
}

/**
 * Validate file upload constraints
 */
export function validateFileUpload(
  file: File | null,
  options?: { maxSizeMB?: number; allowedTypes?: string[] }
): NextResponse | null {
  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const maxSize = (options?.maxSizeMB ?? 50) * 1024 * 1024; // Default 50MB
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File too large. Maximum ${options?.maxSizeMB ?? 50}MB allowed.` },
      { status: 413 }
    );
  }

  if (options?.allowedTypes) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!options.allowedTypes.includes(ext)) {
      return NextResponse.json(
        { error: `File type .${ext} not allowed. Allowed: ${options.allowedTypes.join(", ")}` },
        { status: 415 }
      );
    }
  }

  return null; // Valid
}
