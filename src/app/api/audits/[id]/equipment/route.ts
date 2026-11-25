import {requireEditableAudit} from "@/lib/require-editable-audit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocalPrototype } from "@/lib/dev-api";
export const runtime="nodejs";
export const dynamic="force-dynamic";

const assignment=z.object({equipmentIds:z.array(z.string().cuid()).max(40)});
export async function PUT(request:Request,context:{params:Promise<{id:string}>}){
 const denied=requireLocalPrototype(request);if(denied)return denied;
 const {id}=await context.params;
 const sealed=await requireEditableAudit(id);if(sealed)return sealed;
 const input=assignment.safeParse(await request.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Invalid equipment assignments"},{status:400});
 const ids=input.data.equipmentIds;
 if(new Set(ids).size!==ids.length)return NextResponse.json({error:"Duplicate equipment identifiers"},{status:400});
 const audit=await prisma.audit.findUnique({where:{id},select:{id:true}});
 if(!audit)return NextResponse.json({error:"Audit not found"},{status:404});
 const available=await prisma.equipment.findMany({where:{id:{in:ids}},select:{id:true}});
 if(available.length!==ids.length)return NextResponse.json({error:"One or more instruments do not exist"},{status:404});
 await prisma.$transaction(async tx=>{
   await tx.auditEquipment.deleteMany({where:{auditId:id}});
   if(ids.length)await tx.auditEquipment.createMany({data:ids.map(equipmentId=>({auditId:id,equipmentId}))});
   await tx.auditEvent.create({data:{auditId:id,actor:process.env.SURFACE_AUDIT_ADMIN_USERNAME!,action:"EQUIPMENT_ASSIGNED",details:{equipmentIds:ids}}});
 });
 return NextResponse.json({ok:true,assignedCount:ids.length},{headers:{"Cache-Control":"no-store"}});
}
