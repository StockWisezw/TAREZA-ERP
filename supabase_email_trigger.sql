-- =========================================================================
-- DATABASE TRIGGER: AUTOMATIC TRANSACTIONAL RECEIPT EMAIL TRANSMISSION
-- =========================================================================
-- Execute this SQL script in your Supabase SQL Editor to trigger real-time
-- receipt emails sent from YOUR domain/email whenever a POS checkout processes!
--
-- This script leverages Supabase's built-in "pg_net" extension to call
-- your custom Supabase Edge Function asynchronously without blocking database threads.

-- 1. Enable the pg_net extension (required to make safe background HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- 2. Create the Trigger function to handle the sale checkout event
CREATE OR REPLACE FUNCTION public.handle_new_sale_send_receipt()
RETURNS TRIGGER AS $$
DECLARE
    customer_email TEXT;
    customer_name TEXT;
    email_body TEXT;
    edge_function_url TEXT := 'https://your-project-ref.supabase.co/functions/v1/send-email';
    supabase_service_key TEXT := 'your-supabase-service-role-key-here'; -- Find in Settings -> API
BEGIN
    -- Only trigger email if customer_id exists
    IF NEW.customer_id IS NOT NULL THEN
        -- Safely fetch the customer's email and name
        SELECT email, name INTO customer_email, customer_name 
        FROM public.customers 
        WHERE id = NEW.customer_id;
        
        -- If customer lacks an email, abort trigger execution quietly
        IF customer_email IS NULL OR customer_email = '' THEN
            RETURN NEW;
        END IF;
    ELSE
        -- Fallback or skip if Walk-In customer
        RETURN NEW;
    END IF;

    -- Compile dynamic HTML template utilizing Tareza brand assets
    email_body := '
    <div style="font-family: sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #e4e4e7; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 1px solid #f4f4f5; padding-bottom: 20px; margin-bottom: 20px;">
            <p style="font-size: 24px; font-weight: bold; color: #18181b; margin: 0;">TAREZA ERP</p>
            <span style="font-size: 13px; color: #71717a; text-transform: uppercase; tracking-wider;">Official Receipt & Invoice</span>
        </div>
        
        <p style="font-size: 16px; color: #18181b; margin: 0 0 10px 0;">Hello <strong>' || COALESCE(customer_name, 'Valued Customer') || '</strong>,</p>
        <p style="font-size: 14px; color: #52525b; margin: 0 0 20px 0; line-height: 1.5;">
            Thank you for your purchase. We are pleased to confirm that your transaction was successfully completed. 
            Below is the digital copy of your receipt.
        </p>

        <div style="background-color: #f4f4f5; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #52525b;">
                <tr>
                    <td style="padding: 4px 0; font-weight: bold;">Receipt Number:</td>
                    <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #18181b;">' || COALESCE(NEW."receiptNumber", NEW.id::text) || '</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0;">Date Checkout:</td>
                    <td style="padding: 4px 0; text-align: right;">' || TO_CHAR(NEW.timestamp, 'YYYY-MM-DD HH24:MI') || '</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0;">Subtotal Val:</td>
                    <td style="padding: 4px 0; text-align: right;">$' || NEW.subtotal || '</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0;">VAT Total (15%):</td>
                    <td style="padding: 4px 0; text-align: right;">$' || NEW.vat_total || '</td>
                </tr>
                <tr style="border-top: 1px solid #e4e4e7;">
                    <td style="padding: 12px 0 0 0; font-weight: bold; font-size: 15px; color: #18181b;">Grand Total Paid:</td>
                    <td style="padding: 12px 0 0 0; text-align: right; font-weight: bold; font-size: 15px; color: #16a34a;">$' || NEW.total || '</td>
                </tr>
            </table>
        </div>

        <p style="font-size: 12px; color: #a1a1aa; text-align: center; margin-top: 30px;">
            This email was sent on behalf of Tareza ERP. If you have any inquiries regarding your payment details, please reach out to admin@tarezaerp.co.zw directly.
        </p>
    </div>';

    -- Execute safe HTTP POST call in background via pg_net (calls your deployed Edge Function)
    PERFORM extensions.net_http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || supabase_service_key
        ),
        body := jsonb_build_object(
            'to', customer_email,
            'subject', 'Purchase Receipt: ' || COALESCE(NEW."receiptNumber", NEW.id::text),
            'html', email_body,
            'fromName', 'Tareza ERP Accounting',
            'fromEmail', 'admin@tarezaerp.co.zw' -- Change to your configured domain address
        )
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Fail gracefully by logging the incident and proceding so POS syncing is NOT blocked!
        RAISE WARNING 'Automatic checkout receipt email transmission failed: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Register the trigger on the sales table
DROP TRIGGER IF EXISTS tr_on_new_sale_send_receipt ON public.sales;
CREATE TRIGGER tr_on_new_sale_send_receipt
    AFTER INSERT ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_sale_send_receipt();
