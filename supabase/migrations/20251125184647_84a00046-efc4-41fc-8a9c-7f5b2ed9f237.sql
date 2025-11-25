-- Remove TODOS os triggers da tabela products que causam duplicação
-- Isso garante que apenas o código do frontend e o trigger de entrega criem movimentações

-- 1. Remover trigger de mudanças no estoque (se existir)
DROP TRIGGER IF EXISTS log_product_stock_changes ON public.products;
DROP TRIGGER IF EXISTS log_product_stock_update_trigger ON public.products;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;

-- 2. Remover trigger de estoque inicial (se existir)  
DROP TRIGGER IF EXISTS log_product_initial_stock_trigger ON public.products;
DROP TRIGGER IF EXISTS log_initial_stock_trigger ON public.products;

-- 3. Remover a função log_product_stock_update se existir
DROP FUNCTION IF EXISTS public.log_product_stock_update() CASCADE;

-- 4. Remover a função log_product_initial_stock se existir
DROP FUNCTION IF EXISTS public.log_product_initial_stock() CASCADE;

-- 5. Verificar e listar todos os triggers restantes na tabela products
DO $$ 
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'public.products'::regclass 
    AND tgname NOT LIKE 'pg_%'
  LOOP
    RAISE NOTICE 'Trigger ainda ativo: %', trigger_record.tgname;
  END LOOP;
END $$;