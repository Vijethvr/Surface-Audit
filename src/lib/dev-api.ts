import { NextResponse } from "next/server";

// Deliberately NOT a production authentication mechanism.
// Refuse all API access unless this explicit development-only opt-in is set.
export function requireLocalPrototype() {
  if (process.env.NODE_ENV !== "development" || process.env.SURFACE_AUDIT_ENABLE_LOCAL_API !== "true") {
    return NextResponse.json(
      { error: "Database API disabled. It requires a dedicated authentication implementation before deployment." },
      { status: 403 }
    );
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }
  return null;
}
