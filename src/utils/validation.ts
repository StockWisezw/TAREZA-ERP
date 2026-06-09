import { z } from 'zod';

// Zod validation schemas for server & client alignment
export const ProductSchema = z.object({
  name: z.string()
    .min(1, 'Product name is required')
    .max(255, 'Product name is too long')
    .trim(),
  
  description: z.string()
    .max(5000, 'Description is too long')
    .optional()
    .nullable(),
  
  sku: z.string()
    .regex(/^[A-Z0-9\-_\s]{3,50}$/i, 'Invalid SKU format. Must be alphanumeric plus - or _'),
  
  barcode: z.string()
    .max(100, 'Barcode is too long')
    .optional()
    .nullable(),
  
  retail_price: z.number()
    .positive('Retail price must be positive')
    .finite('Retail price must be a valid number'),
  
  wholesale_price: z.number()
    .positive('Wholesale price must be positive')
    .finite('Wholesale price must be a valid number')
    .optional(),
  
  cost_price: z.number()
    .positive('Cost price must be positive')
    .finite('Cost price must be a valid number')
    .optional(),
});

export const CustomerSchema = z.object({
  name: z.string()
    .min(1, 'Customer name is required')
    .max(255, 'Customer name is too long')
    .trim(),
  
  email: z.string()
    .email('Invalid email address')
    .or(z.string().length(0))
    .optional()
    .nullable(),
  
  phone: z.string()
    .max(20, 'Phone number is too long')
    .optional()
    .nullable(),
  
  address: z.string()
    .max(500, 'Address is too long')
    .optional()
    .nullable(),
  
  customer_type: z.enum(['individual', 'corporate']),
  
  credit_limit: z.number()
    .nonnegative('Credit limit cannot be negative')
    .finite(),
});

export const SupplierSchema = z.object({
  name: z.string()
    .min(1, 'Supplier name is required')
    .max(255, 'Supplier name is too long')
    .trim(),
  
  email: z.string()
    .email('Invalid email address')
    .or(z.string().length(0))
    .optional()
    .nullable(),
  
  phone: z.string()
    .max(20, 'Phone number is too long')
    .optional()
    .nullable(),
  
  payment_terms: z.string()
    .max(100, 'Payment terms is too long')
    .optional()
    .nullable(),
});

// Password Strength Guard Schema
export const PasswordSchema = z.object({
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[0-9]/, 'Password must include at least one number')
    .regex(/[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?\/~`-]/, 'Password must include at least one special character')
    .refine(val => !val.toLowerCase().includes('password'), 'Password cannot contain the word "password"')
    .refine(val => !val.includes('123456') && !val.includes('qwerty'), 'Password cannot contain common sequences'),
});

// HTML Tag XSS Sanitization helper
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Strips opening and closing bracket tags
    .trim()
    .substring(0, 5000); // Truncates extremely long inputs
}
