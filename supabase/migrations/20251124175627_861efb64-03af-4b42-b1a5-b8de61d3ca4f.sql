-- Corrige o trigger para evitar duplicação na entrega
-- Remove o trigger existente
DROP TRIGGER IF EXISTS record_delivery_stock_movement_trigger ON public.orders;

-- Atualiza a função para garantir que só execute uma vez
CREATE OR REPLACE FUNCTION public.record_delivery_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only record movements when status changes to 'entregue' AND it wasn't 'entregue' before
  -- This prevents duplicate executions
  IF NEW.status = 'entregue' AND (OLD.status IS NULL OR OLD.status != 'entregue') THEN
    
    -- Check if movement already exists for this order to prevent duplicates
    IF NOT EXISTS (
      SELECT 1 FROM stock_movements 
      WHERE notes LIKE '%Entrega do pedido%' 
        AND sector_id = NEW.sector_id
        AND created_at >= NEW.updated_at - INTERVAL '1 minute'
    ) THEN
      
      -- Update stock and insert movements in a single transaction
      WITH updated_products AS (
        UPDATE products p
        SET current_stock = p.current_stock - oi.quantity
        FROM order_items oi
        WHERE oi.order_id = NEW.id
          AND oi.product_id = p.id
          AND p.current_stock >= oi.quantity -- Only update if there's enough stock
        RETURNING 
          p.id, 
          p.current_stock + oi.quantity as previous_stock, 
          p.current_stock as new_stock, 
          oi.quantity
      )
      INSERT INTO public.stock_movements (
        product_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        notes,
        performed_by,
        movement_category,
        sector_id
      )
      SELECT
        up.id,
        'saida',
        up.quantity,
        up.previous_stock,
        up.new_stock,
        'Entrega do pedido #' || LEFT(NEW.id::text, 8) || ' para setor ' || 
        COALESCE((SELECT name FROM sectors WHERE id = NEW.sector_id), 'sem setor'),
        NEW.delivered_by,
        'produto',
        NEW.sector_id
      FROM updated_products up;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recria o trigger
CREATE TRIGGER record_delivery_stock_movement_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.record_delivery_stock_movement();