-- Allow gerente role to view profiles they need to manage
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

CREATE POLICY "Admins and gerentes can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'gerente')
);

CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow gerente to update profiles
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Admins and gerentes can update profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'gerente')
);