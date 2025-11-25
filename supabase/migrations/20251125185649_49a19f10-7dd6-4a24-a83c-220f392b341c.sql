-- Tornar performed_by nullable para permitir logs automáticos do sistema
ALTER TABLE public.stock_movements 
ALTER COLUMN performed_by DROP NOT NULL;

-- Adicionar constraint para garantir que movimentações de produtos
-- sempre tenham performed_by
ALTER TABLE public.stock_movements 
ADD CONSTRAINT check_performed_by_for_product_movements 
CHECK (
  (movement_category = 'produto' AND performed_by IS NOT NULL) OR
  (movement_category = 'sistema')
);