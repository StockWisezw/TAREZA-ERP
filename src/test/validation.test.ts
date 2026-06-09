import { describe, it, expect } from 'vitest';
import { ProductSchema } from '../utils/validation';

describe('ProductSchema input validations', () => {
  it('should accept fully qualified correct product metadata fields', () => {
    const validProduct = {
      name: 'Eco-Led 40W Lightbulb',
      sku: 'SKU-LED-1049',
      retail_price: 15.99,
      wholesale_price: 12.50,
      cost_price: 8.00,
    };
    
    const parsed = ProductSchema.safeParse(validProduct);
    expect(parsed.success).toBe(true);
  });

  it('should throw active z.ZodError on empty product names', () => {
    const brokenProduct = {
      name: '  ',
      sku: 'SKU-LED-1049',
      retail_price: 15.99,
    };
    
    const parsed = ProductSchema.safeParse(brokenProduct);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('Product name is required');
    }
  });

  it('should successfully enforce strictly positive values on sales rates', () => {
    const flatPricingProduct = {
      name: 'Eco-Led 40W Lightbulb',
      sku: 'SKU-LED-1049',
      retail_price: -1.50,
    };
    
    const parsed = ProductSchema.safeParse(flatPricingProduct);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('Retail price must be positive');
    }
  });

  it('should catch SKU format violations', () => {
    const malformedSkuProduct = {
      name: 'Eco-Led 40W Lightbulb',
      sku: '$$%-XYZ',
      retail_price: 10.00,
    };
    
    const parsed = ProductSchema.safeParse(malformedSkuProduct);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain('Invalid SKU format');
    }
  });
});
