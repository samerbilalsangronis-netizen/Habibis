import { z } from 'zod';

/** Lo que el navegador manda al crear un pedido (sin precios: el servidor los calcula). */
export const orderPayloadSchema = z.object({
  source: z.enum(['web', 'manual']).default('web'),
  customer: z.object({
    name: z.string().trim().min(2, 'Escribe tu nombre').max(80),
    phone: z.string().trim().min(7, 'Escribe tu teléfono').max(25),
    cedula: z.string().trim().max(20).optional().default(''),
  }),
  delivery_type: z.enum(['pickup', 'delivery']),
  address: z.string().trim().max(300).optional().nullable(),
  address_reference: z.string().trim().max(200).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  zone_id: z.string().uuid().optional().nullable(),
  payment_method: z.enum(['binance', 'bolivares', 'efectivo']),
  payment_reference: z.string().trim().max(120).optional().nullable(),
  payment_verified: z.boolean().optional(),
  cash_currency: z.enum(['COP', 'USD', 'BS']).optional().nullable(),
  cash_amount: z.number().min(0).max(1e10).optional().nullable(),
  scheduled_for: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
  expected_total_cop: z.number().int().optional().nullable(),
  expected_rate_id: z.number().int().optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        option_ids: z.array(z.string().uuid()).max(30).default([]),
        notes: z.string().trim().max(200).optional().default(''),
      }),
    )
    .min(1, 'El carrito está vacío')
    .max(60),
});

export type OrderPayload = z.infer<typeof orderPayloadSchema>;

export const PROOF_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};
export const MAX_PROOF_BYTES = 8 * 1024 * 1024;
