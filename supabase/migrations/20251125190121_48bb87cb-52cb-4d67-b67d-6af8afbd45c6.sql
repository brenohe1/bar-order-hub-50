-- Corrigir a constraint e a ordem dos triggers

-- 1. Remover a constraint incorreta
ALTER TABLE public.stock_movements 
DROP CONSTRAINT IF EXISTS check_performed_by_for_product_movements;

-- 2. Adicionar constraint correta que permite NULL para sistema mas exige para produto
ALTER TABLE public.stock_movements 
ADD CONSTRAINT check_performed_by_for_movements 
CHECK (
  (movement_category = 'sistema') OR
  (movement_category = 'produto' AND performed_by IS NOT NULL)
);

-- 3. Garantir que update_order_delivery execute PRIMEIRO para preencher delivered_by
DROP TRIGGER IF EXISTS update_order_delivery_trigger ON public.orders;
DROP TRIGGER IF EXISTS record_delivery_stock_movement_trigger ON public.orders;

-- 4. Recriar o trigger de atualização de delivered_by/delivered_at
CREATE TRIGGER update_order_delivery_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_delivery();

-- 5. Atualizar a função de movimentação para garantir que delivered_by está preenchido
CREATE OR REPLACE FUNCTION public.record_delivery_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only record movements when status changes to 'entregue' AND it wasn't 'entregue' before
  IF NEW.status = 'entregue' AND (OLD.status IS NULL OR OLD.status != 'entregue') THEN
    
    -- Garantir que delivered_by está preenchido
    IF NEW.delivered_by IS NULL THEN
      RAISE EXCEPTION 'delivered_by must be set when status is entregue';
    END IF;
    
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
          AND p.current_stock >= oi.quantity
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

-- 6. Recriar o trigger de movimentação APÓS o trigger de delivered_by
CREATE TRIGGER record_delivery_stock_movement_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.record_delivery_stock_movement();