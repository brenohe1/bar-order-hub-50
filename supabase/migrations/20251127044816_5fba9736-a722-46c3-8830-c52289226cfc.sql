-- Allow admins to insert stock movements (for automatic stock tracking)
DROP POLICY IF EXISTS "Estoquistas and gerentes can insert stock movements" ON public.stock_movements;

CREATE POLICY "Admins, estoquistas and gerentes can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) 
   OR has_role(auth.uid(), 'estoquista'::app_role) 
   OR has_role(auth.uid(), 'gerente'::app_role))
  AND performed_by = auth.uid()
);