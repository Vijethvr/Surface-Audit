import { NextResponse } from "next/server";
import { authConfigured,getSession,validMutationOrigin } from "@/lib/local-auth";

export function requireLocalPrototype(request:Request) {
  if (process.env.NODE_ENV !== "development" || process.env.SURFACE_AUDIT_ENABLE_LOCAL_API !== "true") {
    return NextResponse.json({error:"Database API is disabled outside local development."},{status:403});
  }
  if (!process.env.DATABASE_URL || !authConfigured()) {
    return NextResponse.json({error:"Local database or authentication is not configured."},{status:503});
  }
  if (!getSession(request))return NextResponse.json({error:"Authentication required"},{status:401});
  if (!["GET","HEAD","OPTIONS"].includes(request.method) && !validMutationOrigin(request)) {
    return NextResponse.json({error:"Invalid request origin"},{status:403});
  }
  return null;
}
