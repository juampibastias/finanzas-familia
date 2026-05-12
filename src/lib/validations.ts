import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId inválido");

export const accountSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["card", "bank", "cash", "wallet"]),
  bank: z
    .enum(["Francés", "Galicia", "Nación", "MercadoPago", "Otro"])
    .nullable()
    .optional(),
  closingDay: z.number().int().min(1).max(31).nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const categorySchema = z.object({
  name: z.string().min(1).max(60),
  kind: z.enum(["income", "expense"]),
  fixed: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().min(1).optional(),
  parentId: objectId.nullable().optional(),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const transactionSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().positive(),
  type: z.enum(["income", "expense", "transfer"]),
  accountId: objectId,
  categoryId: objectId,
  description: z.string().max(200).optional().default(""),
  installment: z
    .object({
      current: z.number().int().min(1),
      total: z.number().int().min(1),
    })
    .nullable()
    .optional(),
  recurring: z.boolean().optional().default(false),
  recurringMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().max(1000).optional().default(""),
});
export type TransactionInput = z.infer<typeof transactionSchema>;

export const debtSchema = z.object({
  name: z.string().min(1).max(120),
  amount: z.number().positive(),
  dueDate: z.coerce.date(),
  paid: z.boolean().optional().default(false),
  paidDate: z.coerce.date().nullable().optional(),
  priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
  notes: z.string().max(500).optional().default(""),
});
export type DebtInput = z.infer<typeof debtSchema>;

export const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  categoryId: objectId,
  estimated: z.number().min(0),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });
