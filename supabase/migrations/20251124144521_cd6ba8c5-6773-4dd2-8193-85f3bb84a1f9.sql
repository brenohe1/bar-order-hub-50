-- Remove os triggers que causam duplicação de movimentações
-- Mantemos apenas os triggers essenciais

-- 1. Remover o trigger que registra mudanças automáticas no estoque de produtos
--    pois as movimentações já são criadas manualmente no código
DROP TRIGGER IF EXISTS log_product_stock_changes ON public.products;

-- 2. Remover o trigger que registra o estoque inicial
--    pois isso também pode causar duplicação
DROP TRIGGER IF EXISTS log_product_initial_stock_trigger ON public.products;

-- 3. Manter o trigger de entrega de pedidos (record_delivery_stock_movement)
--    mas remover o trigger que atualiza o estoque (process_order_delivery)
--    pois a atualização de estoque será feita pelo record_delivery_stock_movement
DROP TRIGGER IF EXISTS process_order_delivery_trigger ON public.orders;

-- 4. Atualizar a função record_delivery_stock_movement para também atualizar o estoque
--    Assim temos apenas UM lugar que faz ambas as coisas
CREATE OR REPLACE FUNCTION public.record_delivery_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only record movements when status changes to 'entregue'
  IF NEW.status = 'entregue' AND OLD.status != 'entregue' THEN
    -- Update stock and insert movements in a single transaction
    -- This prevents duplication
    WITH updated_products AS (
      UPDATE products p
      SET current_stock = p.current_stock - oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.product_id = p.id
      RETURNING p.id, p.current_stock + oi.quantity as previous_stock, p.current_stock as new_stock, oi.quantity
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
      'Entrega do pedido para setor ' || COALESCE((SELECT name FROM sectors WHERE id = NEW.sector_id), 'sem setor'),
      NEW.delivered_by,
      'produto',
      NEW.sector_id
    FROM updated_products up;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar o trigger para a função atualizada
DROP TRIGGER IF EXISTS record_delivery_stock_movement_trigger ON public.orders;
CREATE TRIGGER record_delivery_stock_movement_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.record_delivery_stock_movement();