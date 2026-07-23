import { NextRequest } from "next/server";
import { sendCertificateEmailController } from "@/modules/tournaments/tournaments.controller";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ registrationId: string }> }
) {
  const params = await props.params;
  return sendCertificateEmailController(req, params);
}
