import { z } from 'zod';

// Define Zod schemas for runtime validation
export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  retailPrice: z.number().positive('Retail price must be positive'),
  wholesalePrice: z.number().positive().optional(),
  category: z.string(),
  business_id: z.string().uuid().optional(),
  createdAt: z.any().optional() // Handles Date, string or Firebase/Supabase timestamp
});

export type Product = z.infer<typeof ProductSchema>;

export const SalesTransactionSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  cashier_id: z.string().uuid().optional(),
  items: z.array(z.object({
    product_id: z.string(),
    quantity: z.number().positive('Quantity must be positive'),
    price: z.number(),
    discount: z.number().optional()
  })),
  totalAmount: z.number(),
  tax: z.number().nonnegative(),
  payment_method: z.enum(['CASH', 'CARD', 'MOBILE_MONEY']),
  status: z.enum(['COMPLETED', 'PENDING_SYNC']),
  createdAt: z.any().optional()
});

export type SalesTransaction = z.infer<typeof SalesTransactionSchema>;

/**
 * Safe API response or payload parsing wrapper
 */
export const safeJsonParse = <T,>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } => {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof z.ZodError 
        ? err.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        : 'Invalid data format'
    };
  }
};
