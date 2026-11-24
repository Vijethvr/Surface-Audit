import { NextResponse } from "next/server";
export const dynamic="force-dynamic";
export function GET() {
  const enabled=process.env.NODE_ENV==="development"&&process.env.SURFACE_AUDIT_ENABLE_LOCAL_API==="true";
  return NextResponse.json({storage:enabled&&process.env.DATABASE_URL?"postgres-prototype":"browser-demo",productionReady:false});
}
