import { NextRequest } from "next/server";
import { updateRefundBankDetailsController } from "@/modules/refunds/refunds.controller";

export async function PUT(req: NextRequest) {
  return updateRefundBankDetailsController(req);
}
