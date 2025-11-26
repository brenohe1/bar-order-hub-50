-- Add policy for estoquistas to create orders
CREATE POLICY "Estoquistas podem criar pedidos para qualquer setor"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'estoquista') 
  AND requested_by = auth.uid()
);

-- Update existing policy to be more permissive for setor users
DROP POLICY IF EXISTS "Users can create orders for their sector only" ON public.orders;

CREATE POLICY "Usuarios de setor podem criar pedidos"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = requested_by
  AND (
    sector_id = (SELECT sector_id FROM profiles WHERE id = auth.uid())
    OR has_role(auth.uid(), 'setor')
  )
);