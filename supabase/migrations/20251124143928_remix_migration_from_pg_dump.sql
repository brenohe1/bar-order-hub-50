CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'estoquista',
    'setor',
    'gerente'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only create profile, do NOT assign role (admin will assign via edge function)
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário')
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: log_product_initial_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_product_initial_stock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Log initial stock only when it's greater than zero
  IF NEW.current_stock > 0 THEN
    INSERT INTO public.stock_movements (
      product_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      notes,
      performed_by,
      movement_category
    ) VALUES (
      NEW.id,
      'entrada',
      NEW.current_stock,
      0,
      NEW.current_stock,
      'Estoque inicial do produto',
      auth.uid(),
      'produto'
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: log_product_stock_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_product_stock_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  delta numeric;
  v_type text;
BEGIN
  IF NEW.current_stock IS DISTINCT FROM OLD.current_stock THEN
    delta := NEW.current_stock - OLD.current_stock;
    IF delta > 0 THEN
      v_type := 'entrada';
    ELSE
      v_type := 'saida';
      delta := abs(delta);
    END IF;

    INSERT INTO public.stock_movements (
      product_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      notes,
      performed_by,
      movement_category
    ) VALUES (
      NEW.id,
      v_type,
      delta,
      OLD.current_stock,
      NEW.current_stock,
      'Ajuste de estoque',
      auth.uid(),
      'produto'
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: log_profile_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_profile_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
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
    ) VALUES (
      NULL,
      'ajuste',
      0,
      0,
      0,
      'Perfil editado: ' || NEW.full_name || 
      CASE 
        WHEN OLD.full_name != NEW.full_name THEN ' (nome alterado)'
        WHEN OLD.sector_id IS DISTINCT FROM NEW.sector_id THEN ' (setor alterado)'
        WHEN OLD.position IS DISTINCT FROM NEW.position THEN ' (cargo alterado)'
        ELSE ' (dados atualizados)'
      END,
      auth.uid(),
      'sistema',
      NEW.sector_id
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: log_sector_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_sector_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
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
    ) VALUES (
      NULL,
      'entrada',
      0,
      0,
      0,
      'Setor criado: ' || NEW.name,
      auth.uid(),
      'sistema',
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' THEN
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
    ) VALUES (
      NULL,
      'ajuste',
      0,
      0,
      0,
      'Setor editado: ' || NEW.name || ' (anterior: ' || OLD.name || ')',
      auth.uid(),
      'sistema',
      NEW.id
    );
  ELSIF TG_OP = 'DELETE' THEN
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
    ) VALUES (
      NULL,
      'saida',
      0,
      0,
      0,
      'Setor excluído: ' || OLD.name,
      auth.uid(),
      'sistema',
      OLD.id
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: log_user_role_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_user_role_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_name text;
  user_sector uuid;
BEGIN
  -- Get user info
  SELECT full_name, sector_id INTO user_name, user_sector
  FROM public.profiles
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' THEN
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
    ) VALUES (
      NULL,
      'entrada',
      0,
      0,
      0,
      'Papel atribuído a ' || COALESCE(user_name, 'usuário') || ': ' || NEW.role::text,
      auth.uid(),
      'sistema',
      user_sector
    );
  ELSIF TG_OP = 'DELETE' THEN
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
    ) VALUES (
      NULL,
      'saida',
      0,
      0,
      0,
      'Papel removido de ' || COALESCE(user_name, 'usuário') || ': ' || OLD.role::text,
      auth.uid(),
      'sistema',
      user_sector
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: process_order_delivery(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_order_delivery() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'entregue' AND OLD.status != 'entregue' THEN
    UPDATE public.products p
    SET current_stock = p.current_stock - oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: record_delivery_stock_movement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_delivery_stock_movement() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only record movements when status changes to 'entregue'
  IF NEW.status = 'entregue' AND OLD.status != 'entregue' THEN
    -- Insert stock movements for each order item
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
      oi.product_id,
      'saida',
      oi.quantity,
      p.current_stock,
      p.current_stock - oi.quantity,
      'Entrega do pedido ' || NEW.id || ' para setor ' || (SELECT name FROM sectors WHERE id = NEW.sector_id),
      NEW.delivered_by,
      'produto',
      NEW.sector_id
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_order_delivery(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_order_delivery() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'entregue' AND OLD.status != 'entregue' THEN
    NEW.delivered_at = NOW();
    NEW.delivered_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    product_id uuid,
    quantity numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sector_id uuid,
    requested_by uuid,
    status text DEFAULT 'pendente'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    delivered_at timestamp with time zone,
    delivered_by uuid,
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'entregue'::text, 'cancelado'::text])))
);


--
-- Name: printers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.printers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text NOT NULL,
    ip_address text,
    is_active boolean DEFAULT true NOT NULL,
    auto_print_on_accept boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    unit text DEFAULT 'un'::text NOT NULL,
    current_stock numeric(10,2) DEFAULT 0 NOT NULL,
    minimum_stock numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    category text DEFAULT 'outros'::text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    sector_id uuid,
    "position" text
);


--
-- Name: sectors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    movement_type text NOT NULL,
    quantity numeric NOT NULL,
    previous_stock numeric NOT NULL,
    new_stock numeric NOT NULL,
    notes text NOT NULL,
    performed_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    deletion_reason text,
    movement_category text DEFAULT 'produto'::text NOT NULL,
    sector_id uuid,
    CONSTRAINT stock_movements_movement_category_check CHECK ((movement_category = ANY (ARRAY['produto'::text, 'sistema'::text]))),
    CONSTRAINT stock_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['entrada'::text, 'saida'::text, 'ajuste'::text]))),
    CONSTRAINT stock_movements_notes_not_empty CHECK ((length(TRIM(BOTH FROM notes)) > 0))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid
);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: printers printers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printers
    ADD CONSTRAINT printers_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: sectors sectors_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sectors
    ADD CONSTRAINT sectors_name_key UNIQUE (name);


--
-- Name: sectors sectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sectors
    ADD CONSTRAINT sectors_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category);


--
-- Name: idx_stock_movements_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_category ON public.stock_movements USING btree (movement_category);


--
-- Name: idx_stock_movements_sector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_sector ON public.stock_movements USING btree (sector_id);


--
-- Name: orders log_delivery_movements; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_delivery_movements AFTER UPDATE OF status ON public.orders FOR EACH ROW WHEN (((new.status = 'entregue'::text) AND (old.status IS DISTINCT FROM new.status))) EXECUTE FUNCTION public.record_delivery_stock_movement();


--
-- Name: products log_initial_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_initial_stock AFTER INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_product_initial_stock();


--
-- Name: profiles log_profile_changes_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_profile_changes_trigger AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_profile_changes();


--
-- Name: sectors log_sector_changes_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_sector_changes_trigger AFTER INSERT OR DELETE OR UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.log_sector_changes();


--
-- Name: products log_stock_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_stock_change BEFORE UPDATE OF current_stock ON public.products FOR EACH ROW WHEN ((new.current_stock IS DISTINCT FROM old.current_stock)) EXECUTE FUNCTION public.log_product_stock_update();


--
-- Name: user_roles log_user_role_changes_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_user_role_changes_trigger AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_user_role_changes();


--
-- Name: orders on_order_delivered; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_order_delivered AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.process_order_delivery();


--
-- Name: orders on_order_delivery_record_movement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_order_delivery_record_movement AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.record_delivery_stock_movement();


--
-- Name: orders process_delivery_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER process_delivery_stock AFTER UPDATE OF status ON public.orders FOR EACH ROW WHEN (((new.status = 'entregue'::text) AND (old.status IS DISTINCT FROM new.status))) EXECUTE FUNCTION public.process_order_delivery();


--
-- Name: orders set_delivery_metadata; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_delivery_metadata BEFORE UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_order_delivery();


--
-- Name: orders track_order_delivery; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_order_delivery BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_order_delivery();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: printers update_printers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_printers_updated_at BEFORE UPDATE ON public.printers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stock_movements update_stock_movements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stock_movements_updated_at BEFORE UPDATE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: orders orders_delivered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivered_by_fkey FOREIGN KEY (delivered_by) REFERENCES auth.users(id);


--
-- Name: orders orders_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: orders orders_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id);


--
-- Name: stock_movements stock_movements_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id);


--
-- Name: stock_movements stock_movements_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id);


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: order_items Admins and estoquistas can view all order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and estoquistas can view all order items" ON public.order_items FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoquista'::public.app_role)));


--
-- Name: stock_movements Admins and gerentes can view stock movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and gerentes can view stock movements" ON public.stock_movements FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gerente'::public.app_role)));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can update any profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Admins e gerentes podem criar pedidos para qualquer setor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins e gerentes podem criar pedidos para qualquer setor" ON public.orders FOR INSERT TO authenticated WITH CHECK (((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gerente'::public.app_role)) AND (requested_by = auth.uid())));


--
-- Name: orders Admins, estoquistas e gerentes podem atualizar pedidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins, estoquistas e gerentes podem atualizar pedidos" ON public.orders FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoquista'::public.app_role) OR public.has_role(auth.uid(), 'gerente'::public.app_role)));


--
-- Name: products Admins, estoquistas e gerentes podem atualizar produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins, estoquistas e gerentes podem atualizar produtos" ON public.products FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoquista'::public.app_role) OR public.has_role(auth.uid(), 'gerente'::public.app_role)));


--
-- Name: products Admins, estoquistas e gerentes podem inserir produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins, estoquistas e gerentes podem inserir produtos" ON public.products FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoquista'::public.app_role) OR public.has_role(auth.uid(), 'gerente'::public.app_role)));


--
-- Name: orders Admins, estoquistas e gerentes podem ver todos os pedidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins, estoquistas e gerentes podem ver todos os pedidos" ON public.orders FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoquista'::public.app_role) OR public.has_role(auth.uid(), 'gerente'::public.app_role)));


--
-- Name: stock_movements Estoquistas and gerentes can insert stock movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Estoquistas and gerentes can insert stock movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (((public.has_role(auth.uid(), 'estoquista'::public.app_role) OR public.has_role(auth.uid(), 'gerente'::public.app_role)) AND (performed_by = auth.uid())));


--
-- Name: printers Everyone can view printers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view printers" ON public.printers FOR SELECT USING (true);


--
-- Name: products Everyone can view products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view products" ON public.products FOR SELECT TO authenticated USING (true);


--
-- Name: sectors Everyone can view sectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view sectors" ON public.sectors FOR SELECT TO authenticated USING (true);


--
-- Name: printers Only admins can delete printers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can delete printers" ON public.printers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: products Only admins can delete products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sectors Only admins can delete sectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can delete sectors" ON public.sectors FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: printers Only admins can insert printers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can insert printers" ON public.printers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sectors Only admins can insert sectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can insert sectors" ON public.sectors FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: stock_movements Only admins can soft delete stock movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can soft delete stock movements" ON public.stock_movements FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (deleted_at IS NOT NULL) AND (deleted_by = auth.uid()) AND (deletion_reason IS NOT NULL)));


--
-- Name: printers Only admins can update printers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can update printers" ON public.printers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sectors Only admins can update sectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can update sectors" ON public.sectors FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Setor users can view orders from their sector; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Setor users can view orders from their sector" ON public.orders FOR SELECT USING (((public.has_role(auth.uid(), 'setor'::public.app_role) AND (sector_id IN ( SELECT profiles.sector_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))) OR (auth.uid() = requested_by)));


--
-- Name: orders Users can create orders for their sector only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create orders for their sector only" ON public.orders FOR INSERT WITH CHECK (((auth.uid() = requested_by) AND (sector_id = ( SELECT profiles.sector_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: order_items Users can insert order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.requested_by = auth.uid())))));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: order_items Users can view order items based on order access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view order items based on order access" ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND ((public.has_role(auth.uid(), 'setor'::public.app_role) AND (o.sector_id IN ( SELECT profiles.sector_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid())))) OR (o.requested_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoquista'::public.app_role))))));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: printers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: sectors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


