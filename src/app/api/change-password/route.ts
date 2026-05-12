import { compare, hash } from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { changePasswordSchema } from "@/lib/validations";
import {
  handleAuthError,
  handleError,
  jsonError,
  jsonOk,
  requireAuth,
} from "@/lib/api-utils";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const body = (await req.json()) as unknown;
    const parsed = changePasswordSchema.parse(body);

    await connectDB();
    const user = await User.findById(userId);
    if (!user) return jsonError("Usuario no encontrado", 404);

    const ok = await compare(parsed.currentPassword, user.passwordHash);
    if (!ok) return jsonError("Contraseña actual incorrecta", 400);

    user.passwordHash = await hash(parsed.newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    return jsonOk({ ok: true });
  } catch (err) {
    const authResp = handleAuthError(err);
    if (authResp) return authResp;
    return handleError(err);
  }
}
