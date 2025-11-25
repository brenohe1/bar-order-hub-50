-- Tornar product_id nullable em stock_movements para permitir logs de sistema
-- que não estão relacionados a produtos específicos
ALTER TABLE public.stock_movements 
ALTER COLUMN product_id DROP NOT NULL;

-- Adicionar um check constraint para garantir que movimentações de produtos 
-- sempre tenham product_id
ALTER TABLE public.stock_movements 
ADD CONSTRAINT check_product_id_for_product_movements 
CHECK (
  (movement_category = 'produto' AND product_id IS NOT NULL) OR
  (movement_category != 'produto')
);