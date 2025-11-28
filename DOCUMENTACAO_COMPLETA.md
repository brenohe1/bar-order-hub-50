# 📚 DOCUMENTAÇÃO COMPLETA DO PROJETO - SupplyVine

## 🔹 1. VISÃO GERAL COMPLETA DO PROJETO

### Nome do Projeto
**SupplyVine** - Sistema de Gestão de Estoque

### Objetivo
Sistema completo de gestão de estoque desenvolvido para empresas que precisam controlar produtos, pedidos, movimentações e usuários. O sistema permite gerenciar inventário, setores, pedidos entre setores, e todo o histórico de movimentações com auditoria completa.

### Funcionalidades Principais

#### 1.1 Gestão de Produtos
- Cadastro completo de produtos com categorias (bebidas, alimentos, limpeza, higiene, escritório, outros)
- Controle de estoque atual e estoque mínimo
- Alertas visuais de estoque baixo
- Filtros avançados (categoria, status de estoque, busca por nome/descrição)
- Registro automático de movimentações ao criar/editar produtos
- Sistema de unidades de medida configurável (un, kg, L, etc)

#### 1.2 Gestão de Pedidos
- Criação de pedidos entre setores
- Sistema de status (pendente → aprovado → entregue → cancelado)
- Notificações em tempo real para estoquistas quando novos pedidos são criados
- Atualização automática de estoque ao marcar pedido como entregue
- Impressão térmica de comprovantes de pedidos
- Filtros por status, setor e período
- Histórico completo de quem entregou e quando

#### 1.3 Movimentações de Estoque
- Registro de entrada, saída e ajuste de estoque
- Auditoria completa: quem fez, quando, por que
- Observação obrigatória em todas as movimentações
- Movimentações automáticas do sistema (entregas de pedidos)
- Soft delete com motivo de exclusão
- Exportação para Excel
- Filtros por categoria, setor, período e ordenação

#### 1.4 Gestão de Usuários
- Criação de usuários com 4 níveis de acesso (admin, gerente, estoquista, setor)
- Perfis completos com nome, email, setor, cargo
- Edição de email e senha
- Exclusão de usuários (apenas admin)
- Sistema de roles separado da tabela de usuários (segurança)

#### 1.5 Gestão de Setores
- Cadastro de setores da empresa
- Descrição de responsabilidades
- Associação de usuários e pedidos a setores
- Rastreamento de movimentações por setor

#### 1.6 Autenticação e Segurança
- Login seguro com Supabase Auth
- Proteção de rotas
- Row Level Security (RLS) no banco de dados
- Validação de permissões no backend (Edge Functions)
- Sistema de roles em tabela separada (previne privilege escalation)

### Como o Fluxo Geral Funciona

#### Fluxo Macro do Sistema:

```
1. AUTENTICAÇÃO
   ↓
2. DASHBOARD (visão geral baseada no role do usuário)
   ↓
3. NAVEGAÇÃO LATERAL com acesso às funcionalidades:
   
   → PRODUTOS (criar/editar/excluir)
      └── Ao criar/editar: registra movimentação automática
   
   → PEDIDOS
      ├── Criar pedido para setor
      ├── Estoquista recebe notificação em tempo real
      ├── Atualizar status (pendente → aprovado → entregue)
      └── Ao marcar "entregue": deduz estoque automaticamente
   
   → MOVIMENTAÇÕES
      ├── Ver histórico completo
      ├── Registrar movimentação manual (entrada/saída/ajuste)
      ├── Exportar relatórios
      └── Soft delete com justificativa
   
   → USUÁRIOS (admin/gerente)
      ├── Criar usuário (via Edge Function)
      ├── Editar perfil e permissões
      └── Excluir usuário
   
   → SETORES (apenas admin)
      ├── Criar setor
      ├── Editar setor
      └── Excluir setor
```

#### Fluxo de Dados Importantes:

**Criação de Produto:**
```
Frontend (Products.tsx) → Supabase Insert → 
SE estoque inicial > 0 → Insert em stock_movements (entrada) → 
Frontend recarrega lista
```

**Pedido sendo Entregue:**
```
Frontend marca status "entregue" → 
Inclui delivered_by e delivered_at → 
Supabase Update Orders → 
TRIGGER record_delivery_stock_movement → 
Deduz estoque dos produtos → 
Insere movimentação automática → 
Frontend recarrega
```

**Criação de Usuário:**
```
Frontend envia dados → 
Edge Function create-user → 
Valida role (admin/gerente) → 
Cria usuário no Supabase Auth → 
Insere profile → 
Atribui role → 
Retorna sucesso
```

---

## 🔹 2. ARQUITETURA DO PROJETO

### Organização de Pastas

```
/
├── public/                    # Arquivos públicos estáticos
│   ├── robots.txt
│   └── favicon.ico
│
├── src/                       # Código-fonte React
│   ├── components/            # Componentes reutilizáveis
│   │   ├── ui/               # Componentes Shadcn UI
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── ... (40+ componentes)
│   │   ├── AppSidebar.tsx    # Barra lateral principal
│   │   ├── NavLink.tsx       # Link de navegação customizado
│   │   └── ProtectedRoute.tsx # HOC para proteger rotas
│   │
│   ├── pages/                 # Páginas do aplicativo
│   │   ├── Auth.tsx          # Página de login
│   │   ├── Dashboard.tsx     # Dashboard principal
│   │   ├── Products.tsx      # Gestão de produtos
│   │   ├── Orders.tsx        # Gestão de pedidos
│   │   ├── StockMovements.tsx # Movimentações
│   │   ├── Users.tsx         # Gestão de usuários
│   │   ├── Sectors.tsx       # Gestão de setores
│   │   ├── Printers.tsx      # Configuração de impressoras
│   │   ├── Profile.tsx       # Perfil do usuário
│   │   ├── Reports.tsx       # Relatórios
│   │   └── NotFound.tsx      # Página 404
│   │
│   ├── hooks/                 # Custom React Hooks
│   │   ├── use-toast.ts      # Hook para toasts
│   │   ├── useUserRole.tsx   # Hook para verificar role do usuário
│   │   └── use-mobile.tsx    # Hook para detecção de mobile
│   │
│   ├── integrations/          # Integrações externas
│   │   └── supabase/
│   │       ├── client.ts     # Cliente Supabase (AUTO-GERADO)
│   │       └── types.ts      # Types do banco (AUTO-GERADO)
│   │
│   ├── lib/                   # Utilitários
│   │   └── utils.ts          # Funções helpers
│   │
│   ├── App.tsx               # Componente raiz
│   ├── main.tsx              # Entry point
│   ├── index.css             # Design system (cores, tokens)
│   └── vite-env.d.ts         # Types do Vite
│
├── supabase/                  # Configuração do backend
│   ├── functions/            # Edge Functions (serverless)
│   │   ├── create-user/
│   │   │   └── index.ts     # Criar usuário
│   │   ├── update-user/
│   │   │   └── index.ts     # Atualizar usuário
│   │   ├── delete-user/
│   │   │   └── index.ts     # Deletar usuário
│   │   └── list-users/
│   │       └── index.ts     # Listar usuários
│   ├── migrations/           # Migrações do banco (READ-ONLY)
│   └── config.toml           # Config do Supabase (AUTO-GERADO)
│
├── .env                       # Variáveis de ambiente (AUTO-GERADO)
├── package.json              # Dependências (READ-ONLY)
├── vite.config.ts            # Config do Vite
├── tailwind.config.ts        # Config do Tailwind
├── tsconfig.json             # Config TypeScript
└── README.md                 # Documentação básica
```

### Arquivos Principais

#### Frontend

**src/App.tsx**
- Componente raiz da aplicação
- Define todas as rotas com React Router
- Configura providers (QueryClient, Toaster, Tooltip)
- Implementa layout principal com sidebar e conteúdo

**src/main.tsx**
- Entry point da aplicação
- Renderiza o App no DOM
- Importa estilos globais

**src/index.css**
- Design system completo
- Variáveis CSS para cores (HSL)
- Tokens semânticos (primary, secondary, destructive, etc)
- Suporte a dark mode
- Configuração Tailwind

**src/components/ProtectedRoute.tsx**
- HOC (Higher-Order Component) para proteger rotas
- Verifica autenticação do usuário
- Redireciona para /auth se não autenticado
- Mostra loading durante verificação

**src/components/AppSidebar.tsx**
- Barra lateral de navegação
- Links baseados no role do usuário
- Ícones do Lucide React
- Responsivo (colapsa em mobile)

#### Pages (Páginas)

**src/pages/Auth.tsx**
- Página de login
- Formulário com email e senha
- Integração com Supabase Auth
- Redireciona automaticamente se já logado
- Design com Card e gradiente

**src/pages/Products.tsx**
- CRUD completo de produtos
- Dialog para criar/editar
- Filtros avançados (categoria, estoque, busca)
- Sistema de categorias com badges
- Registro automático de movimentações ao criar/editar
- Permissões: admin, gerente, estoquista podem editar

**src/pages/Orders.tsx**
- CRUD de pedidos
- Sistema de múltiplos produtos por pedido
- Notificações em tempo real (Realtime Supabase)
- Mudança de status com permissões
- Impressão térmica de comprovantes
- Filtros por status, setor, período
- Auto-dedução de estoque ao marcar "entregue"

**src/pages/StockMovements.tsx**
- Visualização de todas as movimentações
- Registro manual de entrada/saída/ajuste
- Soft delete com motivo
- Exportação para Excel (XLSX)
- Filtros por categoria, setor, período, ordenação
- Distinção entre movimentações de produto vs sistema

**src/pages/Users.tsx**
- Gestão de usuários (admin/gerente)
- Criação via Edge Function
- Edição de perfil, email, senha, role, setor, cargo
- Exclusão (apenas admin)
- Lista com email, role, setor, cargo
- Edge Functions para segurança

**src/pages/Sectors.tsx**
- CRUD de setores (apenas admin)
- Nome e descrição
- Usado em pedidos e usuários

#### Hooks Customizados

**src/hooks/useUserRole.tsx**
```typescript
// Retorna o role do usuário autenticado
{
  role: 'admin' | 'gerente' | 'estoquista' | 'setor' | null,
  loading: boolean,
  isAdmin: boolean,
  isGerente: boolean,
  isEstoquista: boolean,
  isSetor: boolean
}
```
- Busca role da tabela user_roles
- Prioriza admin > gerente > estoquista > setor
- Atualiza em tempo real (onAuthStateChange)

**src/hooks/use-toast.ts**
- Sistema de notificações toast
- Fila de toasts com limite
- Variantes: default, destructive
- Auto-dismiss configurável

#### Backend (Edge Functions)

**supabase/functions/create-user/index.ts**
- Cria usuário no Supabase Auth
- Cria perfil com full_name, sector_id, position
- Atribui role na tabela user_roles
- Validações: apenas admin/gerente podem criar
- Rollback se alguma etapa falhar

**supabase/functions/update-user/index.ts**
- Atualiza email e/ou senha (Supabase Auth)
- Atualiza perfil (full_name, sector_id, position)
- Atualiza role
- Validações: apenas admin/gerente podem atualizar

**supabase/functions/delete-user/index.ts**
- Deleta usuário do Supabase Auth
- Cascata deleta perfil e roles automaticamente
- Validações: apenas admin pode deletar

**supabase/functions/list-users/index.ts**
- Lista todos os usuários do Supabase Auth
- Junta com profiles e user_roles
- Retorna email + dados do perfil
- Validações: apenas admin/gerente podem listar

### Como Frontend e Backend Se Comunicam

#### 1. Comunicação Direta com o Banco (Client-Side)
```typescript
// Exemplo: listar produtos
const { data, error } = await supabase
  .from("products")
  .select("*")
  .order("name");
```
- Usa `@supabase/supabase-js` client
- RLS (Row Level Security) protege os dados
- Queries diretas para SELECT, INSERT, UPDATE, DELETE

#### 2. Comunicação via Edge Functions (Serverless)
```typescript
// Exemplo: criar usuário
const { data, error } = await supabase.functions.invoke("create-user", {
  body: {
    email,
    password,
    fullName,
    role,
    sectorId,
    position,
  },
});
```
- Usado para operações que requerem privilégios elevados
- Service Role Key no backend (bypass RLS)
- Validações de permissão no backend
- Operações complexas ou que envolvem auth.users

#### 3. Realtime (WebSockets)
```typescript
// Exemplo: escutar novos pedidos
const channel = supabase
  .channel("orders_realtime")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "orders",
  }, (payload) => {
    // Notificar estoquista
    toast({ title: "Novo Pedido!" });
  })
  .subscribe();
```
- Notificações em tempo real
- Atualização automática de listas
- Usado em Orders para notificar estoquistas

### Serviços, Hooks, Utils, Constantes

**Serviços:**
- Não há camada de serviços explícita
- Queries diretas nos componentes
- Edge Functions para lógica de negócio complexa

**Hooks:**
- `useUserRole`: gerencia role do usuário
- `useToast`: sistema de notificações
- `useMobile`: detecta tela mobile

**Utils:**
- `src/lib/utils.ts`: função `cn()` para merge de classes Tailwind

**Constantes:**
- Categorias de produtos: definidas no próprio componente
- Status de pedidos: definidos inline
- Tipos de movimentação: definidos inline

---

## 🔹 3. TECNOLOGIAS UTILIZADAS

### Framework Base
**React 18.3.1**
- Biblioteca para construir interfaces de usuário
- Virtual DOM para performance
- Hooks para gerenciamento de estado
- JSX para templates
- Escolhido por: popularidade, ecossistema, facilidade

### Build Tool
**Vite**
- Build tool extremamente rápida
- Hot Module Replacement (HMR) instantâneo
- ESBuild para transpilação super rápida
- Escolhido por: velocidade de desenvolvimento

### Linguagem
**TypeScript**
- Type safety em todo o código
- Autocomplete e IntelliSense
- Reduz bugs em produção
- Interfaces e tipos para todas as entidades
- Escolhido por: segurança e produtividade

### Roteamento
**React Router DOM 6.30.1**
- Navegação client-side
- Rotas protegidas
- Parâmetros de URL
- Escolhido por: padrão da indústria

### Estilização
**Tailwind CSS 3.x**
- Utility-first CSS
- Design system configurável
- Responsivo por padrão
- Dark mode built-in
- Escolhido por: produtividade, consistência

**Tailwind CSS Animate**
- Animações pré-configuradas
- Accordion, slide, fade, etc

### Componentes UI
**Shadcn/UI (Radix UI + Tailwind)**
- Mais de 40 componentes prontos
- Acessibilidade (ARIA)
- Customizável via Tailwind
- Radix UI como base (headless components)
- Componentes incluem:
  - Button, Input, Label, Textarea
  - Dialog, Alert Dialog, Sheet
  - Table, Badge, Card
  - Select, Checkbox, Switch
  - Toast, Tooltip, Popover
  - Sidebar, Navigation Menu
  - E muitos mais...
- Escolhido por: qualidade, acessibilidade, customização

### Ícones
**Lucide React 0.462.0**
- Biblioteca de ícones moderna
- Mais de 1000 ícones
- Tree-shakeable (importa só o que usa)
- SVG otimizados
- Escolhido por: qualidade visual, variedade

### Gerenciamento de Estado
**React Query (@tanstack/react-query 5.83.0)**
- Cache de dados do servidor
- Refetch automático
- Loading e error states
- Invalidação de cache
- Escolhido por: simplificar fetch de dados

### Formulários
**React Hook Form 7.61.1**
- Validação de formulários
- Performance (uncontrolled components)
- Integração com Zod
- Escolhido por: simplicidade, performance

**Zod 3.25.76**
- Validação de schemas
- Type inference
- Error messages customizados

**@hookform/resolvers 3.10.0**
- Integração React Hook Form + Zod

### Datas
**date-fns 3.6.0**
- Manipulação de datas
- Formatação
- Parsing
- Escolhido por: modular, tree-shakeable

### Backend / Database
**Supabase (@supabase/supabase-js 2.80.0)**
- Backend as a Service (BaaS)
- PostgreSQL database
- Realtime subscriptions
- Authentication (JWT)
- Row Level Security (RLS)
- Edge Functions (Deno serverless)
- Storage
- Escolhido por:
  - Completo (auth + db + realtime + functions)
  - Open source
  - PostgreSQL (SQL robusto)
  - Segurança RLS nativa
  - Escalável

### Exportação de Dados
**XLSX 0.18.5**
- Exportação para Excel
- Criação de planilhas programaticamente
- Usado em: Movimentações de Estoque
- Escolhido por: simples e funcional

### Carousels
**Embla Carousel React 8.6.0**
- Carousels acessíveis e performáticos
- Touch gestures
- Escolhido por: performance, acessibilidade

### Charts
**Recharts 2.15.4**
- Gráficos responsivos
- Baseado em React components
- Escolhido por: integração React, simplicidade

### Notificações
**Sonner 1.7.4**
- Toast notifications modernas
- Animações suaves
- Empilhamento automático
- Escolhido por: UX superior

### Utilitários CSS
**class-variance-authority 0.7.1**
- Variants em componentes
- Type-safe variants
- Usado em: componentes Shadcn

**clsx 2.1.1**
- Merge de classes CSS
- Condicionais

**tailwind-merge 2.6.0**
- Merge inteligente de classes Tailwind
- Resolve conflitos

### Drawer
**Vaul 0.9.9**
- Drawer mobile-friendly
- Gestures naturais

### Input OTP
**input-otp 1.4.2**
- Input de códigos OTP
- Acessível

### Command Palette
**cmdk 1.1.1**
- Command palette (⌘K)
- Busca rápida

### Temas
**next-themes 0.3.0**
- Dark mode
- System preference detection
- Persistência

---

## 🔹 4. DETALHAMENTO COMPLETO DA INTEGRAÇÃO COM O SUPABASE

### 4.1 Configurações do Supabase

#### Localização dos Arquivos de Configuração

**`.env`** (ROOT DO PROJETO) - **AUTO-GERADO, NÃO EDITAR**
```env
VITE_SUPABASE_PROJECT_ID="gfzloseekwaitfqcxpfw"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGc..."
VITE_SUPABASE_URL="https://gfzloseekwaitfqcxpfw.supabase.co"
```
- Gerado automaticamente pelo Lovable Cloud
- NÃO deve ser editado manualmente
- Contém as credenciais do projeto

**`supabase/config.toml`** - **AUTO-GERADO, NÃO EDITAR**
- Configuração do Supabase CLI
- Project ID
- Configuração de Edge Functions
- Gerado automaticamente

**`src/integrations/supabase/client.ts`** - **AUTO-GERADO, NÃO EDITAR**
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(
  SUPABASE_URL, 
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
```
- Cliente Supabase para o frontend
- Tipado com Database types
- Auth configurado para persistir sessão
- Auto-refresh de tokens

**`src/integrations/supabase/types.ts`** - **AUTO-GERADO, NÃO EDITAR**
- Types gerados automaticamente do schema do banco
- Interfaces para todas as tabelas
- Enums
- Functions
- Usado para type safety

#### Inicialização do Cliente Supabase

**Frontend:**
```typescript
import { supabase } from "@/integrations/supabase/client";
```
- Importa o cliente já configurado
- Singleton (uma única instância)
- Reutilizável em todo o projeto

**Backend (Edge Functions):**
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);
```
- Service Role Key (bypass RLS)
- Usado para operações administrativas
- Deno runtime (não Node.js)

#### Variáveis de Ambiente Usadas

**Frontend:**
- `VITE_SUPABASE_URL`: URL do projeto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Chave pública (anon key)
- `VITE_SUPABASE_PROJECT_ID`: ID do projeto

**Backend (Edge Functions):**
- `SUPABASE_URL`: URL do projeto
- `SUPABASE_SERVICE_ROLE_KEY`: Chave secreta (admin)
- `SUPABASE_ANON_KEY`: Chave pública

### 4.2 Permissões / Policies Importantes (RLS)

#### Tabela: `products`

**SELECT (todos podem ver)**
```sql
POLICY "Everyone can view products"
USING (true)
```

**INSERT (admin, estoquista, gerente)**
```sql
POLICY "Admins, estoquistas e gerentes podem inserir produtos"
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'estoquista') OR 
  has_role(auth.uid(), 'gerente')
)
```

**UPDATE (admin, estoquista, gerente)**
```sql
POLICY "Admins, estoquistas e gerentes podem atualizar produtos"
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'estoquista') OR 
  has_role(auth.uid(), 'gerente')
)
```

**DELETE (apenas admin)**
```sql
POLICY "Only admins can delete products"
USING (has_role(auth.uid(), 'admin'))
```

#### Tabela: `orders`

**SELECT**
```sql
-- Admins, estoquistas e gerentes veem tudo
POLICY "Admins, estoquistas e gerentes podem ver todos os pedidos"
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'estoquista') OR 
  has_role(auth.uid(), 'gerente')
)

-- Usuários de setor veem pedidos do seu setor ou criados por eles
POLICY "Setor users can view orders from their sector"
USING (
  (has_role(auth.uid(), 'setor') AND sector_id IN (
    SELECT sector_id FROM profiles WHERE id = auth.uid()
  )) OR
  auth.uid() = requested_by
)
```

**INSERT**
```sql
-- Usuários de setor criam para seu setor
POLICY "Usuarios de setor podem criar pedidos"
WITH CHECK (
  auth.uid() = requested_by AND
  (sector_id = (SELECT sector_id FROM profiles WHERE id = auth.uid()) OR
   has_role(auth.uid(), 'setor'))
)

-- Estoquistas criam para qualquer setor
POLICY "Estoquistas podem criar pedidos para qualquer setor"
WITH CHECK (
  has_role(auth.uid(), 'estoquista') AND
  requested_by = auth.uid()
)

-- Admins e gerentes criam para qualquer setor
POLICY "Admins e gerentes podem criar pedidos para qualquer setor"
WITH CHECK (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente')) AND
  requested_by = auth.uid()
)
```

**UPDATE (admin, estoquista, gerente)**
```sql
POLICY "Admins, estoquistas e gerentes podem atualizar pedidos"
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'estoquista') OR 
  has_role(auth.uid(), 'gerente')
)
```

#### Tabela: `stock_movements`

**SELECT (admin, gerente)**
```sql
POLICY "Admins and gerentes can view stock movements"
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'gerente')
)
```

**INSERT (admin, estoquista, gerente)**
```sql
POLICY "Admins, estoquistas and gerentes can insert stock movements"
WITH CHECK (
  (has_role(auth.uid(), 'admin') OR 
   has_role(auth.uid(), 'estoquista') OR 
   has_role(auth.uid(), 'gerente')) AND
  performed_by = auth.uid()
)
```

**UPDATE (apenas soft delete por admin)**
```sql
POLICY "Only admins can soft delete stock movements"
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (
  has_role(auth.uid(), 'admin') AND
  deleted_at IS NOT NULL AND
  deleted_by = auth.uid() AND
  deletion_reason IS NOT NULL
)
```

#### Tabela: `user_roles`

**SELECT**
```sql
-- Usuários veem suas próprias roles
POLICY "Users can view their own roles"
USING (user_id = auth.uid())

-- Admins veem todas as roles
POLICY "Admins can view all roles"
USING (has_role(auth.uid(), 'admin'))
```

**INSERT/DELETE (apenas admin)**
```sql
POLICY "Admins can insert roles"
WITH CHECK (has_role(auth.uid(), 'admin'))

POLICY "Admins can delete roles"
USING (has_role(auth.uid(), 'admin'))
```

#### Tabela: `profiles`

**SELECT**
```sql
-- Usuários veem seu próprio perfil
POLICY "Users can view their own profile"
USING (auth.uid() = id)

-- Admins e gerentes veem todos os perfis
POLICY "Admins and gerentes can view all profiles"
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'gerente')
)
```

**UPDATE**
```sql
-- Usuários atualizam seu próprio perfil
POLICY "Users can update their own profile"
USING (auth.uid() = id)

-- Admins e gerentes atualizam qualquer perfil
POLICY "Admins and gerentes can update profiles"
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'gerente')
)
```

#### Tabela: `sectors`

**SELECT (todos podem ver)**
```sql
POLICY "Everyone can view sectors"
USING (true)
```

**INSERT/UPDATE/DELETE (apenas admin)**
```sql
POLICY "Only admins can insert sectors"
WITH CHECK (has_role(auth.uid(), 'admin'))

POLICY "Only admins can update sectors"
USING (has_role(auth.uid(), 'admin'))

POLICY "Only admins can delete sectors"
USING (has_role(auth.uid(), 'admin'))
```

### 4.3 Tabelas, Modelos e Estruturas

#### Tabela: `products`
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'un',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  minimum_stock NUMERIC NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'outros',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Campos:**
- `id`: UUID único
- `name`: Nome do produto (obrigatório)
- `description`: Descrição opcional
- `unit`: Unidade de medida (un, kg, L, etc)
- `current_stock`: Estoque atual em tempo real
- `minimum_stock`: Estoque mínimo para alertas
- `category`: bebidas, alimentos, limpeza, higiene, escritorio, outros
- `created_at`: Data de criação
- `updated_at`: Data da última atualização

**Relações:**
- `order_items.product_id` → `products.id`
- `stock_movements.product_id` → `products.id`

#### Tabela: `orders`
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID REFERENCES sectors(id),
  requested_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  notes TEXT,
  delivered_by UUID REFERENCES auth.users(id),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Campos:**
- `id`: UUID único
- `sector_id`: Setor que solicitou
- `requested_by`: Usuário que criou o pedido
- `status`: pendente | aprovado | entregue | cancelado
- `notes`: Observações do pedido
- `delivered_by`: Quem entregou (preenchido ao marcar "entregue")
- `delivered_at`: Data/hora da entrega
- `created_at`: Data de criação
- `updated_at`: Data da última atualização

**Relações:**
- `sector_id` → `sectors.id`
- `requested_by` → auth.users (via profiles)
- `delivered_by` → auth.users (via profiles)

#### Tabela: `order_items`
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Campos:**
- `id`: UUID único
- `order_id`: Pedido ao qual pertence
- `product_id`: Produto solicitado
- `quantity`: Quantidade solicitada
- `created_at`: Data de criação

**Relações:**
- `order_id` → `orders.id` (CASCADE delete)
- `product_id` → `products.id`

#### Tabela: `stock_movements`
```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  movement_type TEXT NOT NULL, -- entrada, saida, ajuste
  quantity NUMERIC NOT NULL,
  previous_stock NUMERIC NOT NULL,
  new_stock NUMERIC NOT NULL,
  notes TEXT NOT NULL,
  performed_by UUID, -- NULL para movimentações do sistema
  movement_category TEXT NOT NULL DEFAULT 'produto', -- produto, sistema
  sector_id UUID REFERENCES sectors(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  deletion_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Campos:**
- `id`: UUID único
- `product_id`: Produto movimentado (NULL para movimentações de sistema não relacionadas a produto)
- `movement_type`: entrada | saida | ajuste
- `quantity`: Quantidade movimentada
- `previous_stock`: Estoque antes da movimentação
- `new_stock`: Estoque após a movimentação
- `notes`: Observação obrigatória (auditoria)
- `performed_by`: Quem fez (NULL se for automático/sistema)
- `movement_category`: produto (manual) | sistema (automático)
- `sector_id`: Setor relacionado (opcional)
- `deleted_at`: Data do soft delete
- `deleted_by`: Quem deletou
- `deletion_reason`: Motivo do soft delete
- `created_at`: Data da movimentação

**Relações:**
- `product_id` → `products.id`
- `sector_id` → `sectors.id`

#### Tabela: `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  sector_id UUID REFERENCES sectors(id),
  position TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Campos:**
- `id`: UUID (mesmo do auth.users)
- `full_name`: Nome completo do usuário
- `sector_id`: Setor do usuário (opcional)
- `position`: Cargo do usuário (opcional)
- `created_at`: Data de criação

**Relações:**
- `id` → auth.users.id (CASCADE delete)
- `sector_id` → `sectors.id`

#### Tabela: `user_roles`
```sql
CREATE TYPE app_role AS ENUM ('admin', 'gerente', 'estoquista', 'setor');

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);
```

**Campos:**
- `id`: UUID único
- `user_id`: Usuário que possui a role
- `role`: admin | gerente | estoquista | setor
- `assigned_by`: Quem atribuiu a role
- `assigned_at`: Quando foi atribuída
- UNIQUE constraint: usuário não pode ter role duplicada

**Relações:**
- `user_id` → auth.users.id (CASCADE delete)
- `assigned_by` → auth.users.id

**Enum `app_role`:**
- `admin`: Acesso total
- `gerente`: Gerenciar usuários, produtos, ver movimentações
- `estoquista`: Gerenciar produtos, pedidos, movimentações
- `setor`: Criar pedidos, ver produtos

#### Tabela: `sectors`
```sql
CREATE TABLE sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Campos:**
- `id`: UUID único
- `name`: Nome do setor (obrigatório)
- `description`: Descrição opcional
- `created_at`: Data de criação

**Relações:**
- `orders.sector_id` → `sectors.id`
- `profiles.sector_id` → `sectors.id`
- `stock_movements.sector_id` → `sectors.id`

#### Tabela: `printers`
```sql
CREATE TABLE printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  ip_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_print_on_accept BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Campos:**
- `id`: UUID único
- `name`: Nome da impressora
- `location`: Localização física
- `ip_address`: Endereço IP (opcional)
- `is_active`: Se está ativa
- `auto_print_on_accept`: Se deve imprimir automaticamente ao aceitar pedido
- `created_at`: Data de criação
- `updated_at`: Data da última atualização

**Uso:** Configuração de impressoras térmicas para imprimir comprovantes de pedidos

### 4.4 Autenticação

#### Como o Login Funciona

**1. Usuário preenche formulário (`src/pages/Auth.tsx`)**
```typescript
const { error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

**2. Supabase Auth valida credenciais**
- Verifica email/senha no banco auth.users
- Gera JWT token se válido
- Retorna session com access_token e refresh_token

**3. Tokens são armazenados**
```typescript
// Configurado no client
auth: {
  storage: localStorage,
  persistSession: true,
  autoRefreshToken: true,
}
```
- `access_token`: armazenado em localStorage
- `refresh_token`: armazenado em localStorage
- Tokens persistem entre sessões

**4. Auto-refresh de tokens**
- Supabase client automaticamente renova tokens expirados
- Refresh acontece em background
- Usuário permanece logado

#### Como a Sessão é Validada

**Em cada request:**
```typescript
const { data: { user } } = await supabase.auth.getUser();
```
- Extrai JWT do localStorage
- Valida assinatura do token
- Retorna dados do usuário

**RLS no banco de dados:**
```sql
auth.uid()
```
- Função especial que retorna user_id do JWT
- Usado nas policies para validar acesso
- Executado no servidor (seguro)

**ProtectedRoute (client-side):**
```typescript
// src/components/ProtectedRoute.tsx
const [user, setUser] = useState<User | null>(null);

useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user ?? null);
  });
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setUser(session?.user ?? null);
    }
  );
  
  return () => subscription.unsubscribe();
}, []);

if (!user) {
  return <Navigate to="/auth" replace />;
}
```
- Verifica sessão ao montar
- Escuta mudanças de auth
- Redireciona para /auth se não autenticado

### 4.5 Operações Realizadas

#### SELECT (Leitura)

**Listar produtos:**
```typescript
// src/pages/Products.tsx (linha 76-83)
const { data, error } = await supabase
  .from("products")
  .select("*")
  .order("name");
```

**Buscar pedido com joins:**
```typescript
// src/pages/Orders.tsx (linha 191-194)
const { data, error } = await supabase
  .from("orders")
  .select("*, sectors(name), profiles(full_name)")
  .order("created_at", { ascending: false });
```

**Buscar perfil do usuário:**
```typescript
// src/hooks/useUserRole.tsx
const { data: userRoles, error } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .order("role", { ascending: true });
```

#### INSERT (Criação)

**Criar produto:**
```typescript
// src/pages/Products.tsx (linha 177-181)
const { data: newProduct, error } = await supabase
  .from("products")
  .insert([productData])
  .select()
  .single();
```

**Criar pedido:**
```typescript
// src/pages/Orders.tsx (linha 245-249)
const { data: order, error: orderError } = await supabase
  .from("orders")
  .insert([orderData])
  .select()
  .single();
```

**Registrar movimentação:**
```typescript
// src/pages/Products.tsx (linha 186-199)
const { error: movementError } = await supabase
  .from("stock_movements")
  .insert({
    product_id: newProduct.id,
    movement_type: "entrada",
    quantity: productData.current_stock,
    previous_stock: 0,
    new_stock: productData.current_stock,
    notes: `Estoque inicial ao criar produto`,
    performed_by: user.id,
    movement_category: 'produto',
    sector_id: null,
  });
```

#### UPDATE (Atualização)

**Atualizar produto:**
```typescript
// src/pages/Products.tsx (linha 144-147)
const { error } = await supabase
  .from("products")
  .update(productData)
  .eq("id", editingProduct.id);
```

**Atualizar status do pedido:**
```typescript
// src/pages/Orders.tsx (linha 294-306)
const updateData: any = { status: newStatus };

if (newStatus === "entregue") {
  updateData.delivered_by = currentUserId;
  updateData.delivered_at = new Date().toISOString();
}

const { error } = await supabase
  .from("orders")
  .update(updateData)
  .eq("id", orderId);
```

**Soft delete de movimentação:**
```typescript
// src/pages/StockMovements.tsx (linha 330-337)
const { error } = await supabase
  .from("stock_movements")
  .update({
    deleted_at: new Date().toISOString(),
    deleted_by: user.id,
    deletion_reason: reason,
  })
  .eq("id", movementId);
```

#### DELETE (Exclusão)

**Deletar produto:**
```typescript
// src/pages/Products.tsx (linha 225)
const { error } = await supabase
  .from("products")
  .delete()
  .eq("id", id);
```

**Deletar setor:**
```typescript
// src/pages/Sectors.tsx (linha 118)
const { error } = await supabase
  .from("sectors")
  .delete()
  .eq("id", id);
```

#### INVOKE (Edge Functions)

**Criar usuário:**
```typescript
// src/pages/Users.tsx (linha 178-187)
const { data, error } = await supabase.functions.invoke("create-user", {
  body: {
    email,
    password,
    fullName,
    role,
    sectorId: sectorId || null,
    position: position || null,
  },
});
```

**Atualizar usuário:**
```typescript
// src/pages/Users.tsx (linha 154-156)
const { data, error } = await supabase.functions.invoke("update-user", {
  body: updateData,
});
```

**Listar usuários:**
```typescript
// src/pages/Users.tsx (linha 90)
const { data: usersData, error: usersError } = await supabase.functions.invoke("list-users");
```

**Deletar usuário:**
```typescript
// src/pages/Users.tsx (linha 229-231)
const { error } = await supabase.functions.invoke("delete-user", {
  body: { userId },
});
```

#### REALTIME (Subscriptions)

**Escutar novos pedidos:**
```typescript
// src/pages/Orders.tsx (linha 123-152)
const channel = supabase
  .channel("orders_realtime")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "orders",
    },
    (payload) => {
      if (isEstoquista) {
        toast({
          title: "🔔 Novo Pedido Recebido!",
          description: "Um novo pedido foi criado e está aguardando processamento.",
        });
      }
      loadData();
    }
  )
  .subscribe();
```

### 4.6 Database Functions e Triggers

#### Function: `has_role`
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
```
**Uso:** Verificar se usuário tem determinada role nas RLS policies

**Por que `SECURITY DEFINER`:** Permite que a função acesse `user_roles` mesmo que a policy dessa tabela não permita, evitando recursão infinita nas policies.

#### Function: `handle_new_user`
```sql
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário')
  );
  RETURN NEW;
END;
$$;
```
**Uso:** Criar perfil automaticamente quando usuário é criado no auth.users

**Trigger:** `on_auth_user_created` AFTER INSERT ON auth.users

**Nota:** Edge function `create-user` cria profile diretamente, não depende deste trigger.

#### Function: `update_updated_at_column`
```sql
CREATE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```
**Uso:** Atualizar `updated_at` automaticamente

**Triggers:**
- `update_products_updated_at` BEFORE UPDATE ON products
- `update_printers_updated_at` BEFORE UPDATE ON printers
- `update_orders_updated_at` BEFORE UPDATE ON orders

#### Function: `record_delivery_stock_movement`
```sql
CREATE FUNCTION public.record_delivery_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'entregue' AND (OLD.status IS NULL OR OLD.status != 'entregue') THEN
    
    IF NEW.delivered_by IS NULL THEN
      RAISE EXCEPTION 'delivered_by must be set when status is entregue';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM stock_movements 
      WHERE notes LIKE '%Entrega do pedido%' 
        AND sector_id = NEW.sector_id
        AND created_at >= NEW.updated_at - INTERVAL '1 minute'
    ) THEN
      
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
```
**Uso:** Deduzir estoque e criar movimentação automática ao marcar pedido como entregue

**Trigger:** `record_delivery_movement` AFTER UPDATE ON orders

**Importante:** 
- Valida que `delivered_by` está preenchido
- Evita duplicação verificando movimentações recentes
- Atualiza estoque dos produtos
- Cria movimentação para cada item do pedido

#### Function: `log_sector_changes`
```sql
CREATE FUNCTION public.log_sector_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO stock_movements (...) 
    VALUES (..., 'Setor criado: ' || NEW.name, ...);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO stock_movements (...) 
    VALUES (..., 'Setor editado: ' || NEW.name || ' (anterior: ' || OLD.name || ')', ...);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO stock_movements (...) 
    VALUES (..., 'Setor excluído: ' || OLD.name, ...);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
```
**Uso:** Registrar mudanças em setores no histórico de movimentações

**Triggers:**
- `log_sector_insert` AFTER INSERT ON sectors
- `log_sector_update` AFTER UPDATE ON sectors
- `log_sector_delete` BEFORE DELETE ON sectors

#### Functions Similares:
- `log_profile_changes`: Registra edições de perfis
- `log_user_role_changes`: Registra mudanças de roles

---

## 🔹 5. FLUXO DETALHADO DE CADA FUNCIONALIDADE

### 5.1 PRODUTOS

#### Fluxo de Criação de Produto

**1. Usuário clica "Novo Produto"**
- `src/pages/Products.tsx` (linha 284-291)
- Dialog é aberto com formulário vazio

**2. Preenche formulário**
- Nome (obrigatório)
- Descrição (opcional)
- Categoria (obrigatório, padrão: "outros")
- Unidade (obrigatório, padrão: "un")
- Estoque Atual (obrigatório, padrão: 0)
- Estoque Mínimo (obrigatório, padrão: 0)

**3. Submete formulário**
- `handleSubmit` (linha 122)
- Valida campos obrigatórios
- Obtém usuário autenticado

**4. Insert no banco**
```typescript
const { data: newProduct, error } = await supabase
  .from("products")
  .insert([productData])
  .select()
  .single();
```

**5. Se estoque inicial > 0: registra movimentação**
```typescript
if (productData.current_stock > 0) {
  await supabase.from("stock_movements").insert({
    product_id: newProduct.id,
    movement_type: "entrada",
    quantity: productData.current_stock,
    previous_stock: 0,
    new_stock: productData.current_stock,
    notes: `Estoque inicial ao criar produto`,
    performed_by: user.id,
    movement_category: 'produto',
  });
}
```

**6. Toast de sucesso**
- "Produto criado com sucesso!"

**7. Recarrega lista**
- `loadProducts()` (linha 75)

#### Fluxo de Edição de Produto

**1. Usuário clica ícone de editar**
- `openEditDialog(product)` (linha 239)
- Dialog abre pré-preenchido

**2. Altera campos desejados**
- Especialmente `current_stock` se for ajustar estoque

**3. Submete formulário**
- Calcula diferença de estoque
```typescript
const previousStock = editingProduct.current_stock;
const newStock = productData.current_stock;
const stockDifference = newStock - previousStock;
```

**4. Update no banco**
```typescript
const { error } = await supabase
  .from("products")
  .update(productData)
  .eq("id", editingProduct.id);
```

**5. Se estoque mudou: registra movimentação**
```typescript
if (stockDifference !== 0) {
  const movementType = stockDifference > 0 ? "entrada" : "saida";
  const quantity = Math.abs(stockDifference);
  
  await supabase.from("stock_movements").insert({
    product_id: editingProduct.id,
    movement_type: movementType,
    quantity: quantity,
    previous_stock: previousStock,
    new_stock: newStock,
    notes: `Ajuste manual de estoque ao editar produto`,
    performed_by: user.id,
    movement_category: 'produto',
  });
}
```

**6. Toast e reload**

#### Componentes Envolvidos
- `Products.tsx`: página principal
- `Dialog`, `Input`, `Label`, `Select`, `Table`: componentes UI
- `useToast`: notificações

#### Chamadas ao Supabase
- `supabase.from("products").select()`: listar
- `supabase.from("products").insert()`: criar
- `supabase.from("products").update()`: editar
- `supabase.from("products").delete()`: excluir
- `supabase.from("stock_movements").insert()`: registrar movimentação

#### Regras de Validação
- Nome obrigatório
- Categoria obrigatória (select)
- Unidade obrigatória
- Estoque atual e mínimo devem ser números >= 0
- Observação automática em movimentações

#### Tratamento de Erros
```typescript
try {
  // operação
} catch (error: any) {
  toast({
    title: "Erro ao ...",
    description: error.message,
    variant: "destructive",
  });
}
```

### 5.2 PEDIDOS

#### Fluxo Completo de Pedido

**1. Criação do Pedido**

**Arquivo:** `src/pages/Orders.tsx`

**a) Usuário clica "Novo Pedido"** (linha 428)
- Dialog abre com formulário

**b) Preenche dados:**
- Seleciona setor (obrigatório)
- Adiciona produtos e quantidades
  - Botão "Adicionar Produto" cria nova linha
  - Selects de produto mostram estoque atual
- Observações (opcional)

**c) Adiciona múltiplos produtos**
- `addOrderItem()` (linha 330): adiciona linha
- `updateOrderItem()` (linha 334): atualiza produto/quantidade
- `removeOrderItem()` (linha 340): remove linha

**d) Submete formulário** (linha 233)
```typescript
const orderData = {
  sector_id: formData.get("sector_id"),
  notes: formData.get("notes"),
  requested_by: currentUserId,
  status: "pendente",
};
```

**e) Insert em `orders`**
```typescript
const { data: order, error } = await supabase
  .from("orders")
  .insert([orderData])
  .select()
  .single();
```

**f) Insert em `order_items`**
```typescript
const itemsData = orderItems
  .filter((item) => item.product_id && item.quantity > 0)
  .map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
  }));

await supabase.from("order_items").insert(itemsData);
```

**g) Toast de sucesso**

**h) Limpa formulário e recarrega**

**2. Notificação em Tempo Real**

**Arquivo:** `src/pages/Orders.tsx` (linha 118-157)

**a) Subscription ativa:**
```typescript
const channel = supabase
  .channel("orders_realtime")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "orders",
  }, (payload) => {
    // Notifica estoquistas
  })
  .subscribe();
```

**b) Quando novo pedido é inserido:**
- Se usuário for estoquista: mostra toast
- Toca som de notificação (`/notification.mp3`)
- Recarrega lista de pedidos para todos

**3. Mudança de Status**

**Arquivo:** `src/pages/Orders.tsx` (linha 284-328)

**a) Usuário seleciona novo status no Select**
- Disponível apenas para admin/estoquista/gerente
- Opções: pendente, aprovado, entregue, cancelado

**b) `handleStatusChange(orderId, newStatus)`**

**c) Prepara dados de update:**
```typescript
const updateData: any = { status: newStatus };

if (newStatus === "entregue") {
  updateData.delivered_by = currentUserId;
  updateData.delivered_at = new Date().toISOString();
}
```

**d) Update no banco:**
```typescript
await supabase
  .from("orders")
  .update(updateData)
  .eq("id", orderId);
```

**e) TRIGGER é acionado:**
- `record_delivery_stock_movement` executa
- Verifica se status mudou para "entregue"
- Deduz estoque de cada produto do pedido
- Cria movimentação automática para cada item

**f) Se status = "entregue" e auto-print ativo:**
```typescript
if (newStatus === "entregue") {
  const autoPrintPrinters = printers.filter(p => p.auto_print_on_accept);
  if (autoPrintPrinters.length > 0) {
    await printThermal(orderId);
  }
}
```

**4. Impressão Térmica**

**Arquivo:** `src/pages/Orders.tsx` (linha 360-515)

**a) `printThermal(orderId)` é chamado**

**b) Busca dados completos do pedido:**
```typescript
const { data: order } = await supabase
  .from("orders")
  .select("*, sectors(name), profiles(full_name)")
  .eq("id", orderId)
  .single();

const { data: items } = await supabase
  .from("order_items")
  .select("*, products(name, unit)")
  .eq("order_id", orderId);
```

**c) Gera HTML para impressão:**
- Template otimizado para 80mm (térmica)
- Fonte monoespaçada
- Informações do pedido
- Lista de produtos
- Observações

**d) Abre janela de impressão:**
```typescript
const printWindow = window.open("", "_blank");
printWindow.document.write(thermalHTML);
printWindow.focus();
printWindow.print();
```

#### Componentes Envolvidos
- `Orders.tsx`: página principal
- `Dialog`, `Select`, `Table`, `Badge`: componentes UI
- `useToast`: notificações
- `useUserRole`: verificar permissões

#### Chamadas ao Supabase
- `supabase.from("orders").select()`: listar pedidos
- `supabase.from("orders").insert()`: criar pedido
- `supabase.from("orders").update()`: atualizar status
- `supabase.from("order_items").insert()`: criar itens
- `supabase.from("order_items").select()`: listar itens para impressão
- `supabase.channel().on().subscribe()`: realtime

#### Regras de Validação
- Setor obrigatório
- Pelo menos 1 produto
- Quantidade > 0
- Apenas admin/estoquista/gerente podem atualizar status
- Ao marcar "entregue", delivered_by e delivered_at são obrigatórios

#### Tratamento de Erros
- Try/catch em todas as operações
- Toast de erro com detalhes
- Validação de permissões

### 5.3 MOVIMENTAÇÕES DE ESTOQUE

#### Fluxo de Visualização

**Arquivo:** `src/pages/StockMovements.tsx`

**1. Carregamento inicial** (linha 158)
```typescript
const { data: movementsData } = await supabase
  .from("stock_movements")
  .select("*, products(name, unit), sectors(name)")
  .order("created_at", { ascending: false });
```

**2. Join manual com profiles** (linha 167-197)
```typescript
const movementsWithProfiles = await Promise.all(
  movementsData.map(async (movement) => {
    if (!movement.performed_by) {
      return { ...movement, profiles: { full_name: 'Sistema' } };
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", movement.performed_by)
      .maybeSingle();
    
    return { 
      ...movement, 
      profiles: profile || { full_name: 'Usuário desconhecido' } 
    };
  })
);
```

**3. Aplicação de filtros** (linha 110-156)
```typescript
let filtered = movements.filter((m) => !m.deleted_at); // Exclui deletados

// Filtro por categoria
if (categoryFilter !== "todos") {
  filtered = filtered.filter((m) => m.movement_category === categoryFilter);
}

// Filtro por setor
if (sectorFilter !== "todos") {
  filtered = filtered.filter((m) => m.sector_id === sectorFilter);
}

// Filtro por período
if (startDate) {
  filtered = filtered.filter((m) => new Date(m.created_at) >= new Date(startDate));
}

// Ordenação
filtered.sort((a, b) => {
  switch (sortBy) {
    case "data_desc": return new Date(b.created_at) - new Date(a.created_at);
    case "data_asc": return new Date(a.created_at) - new Date(b.created_at);
    case "quantidade_desc": return b.quantity - a.quantity;
    // ... outros casos
  }
});
```

#### Fluxo de Registro Manual

**1. Usuário clica "Nova Movimentação"** (linha 428)
- Disponível apenas para estoquista/gerente

**2. Preenche formulário:**
- Produto (obrigatório)
- Tipo: entrada | saida | ajuste
- Quantidade (obrigatório)
- Observação (obrigatório - campo critical para auditoria)
- Setor (opcional)

**3. Submete formulário** (linha 227)

**4. Valida observação:**
```typescript
if (!notes || !notes.trim()) {
  toast({
    title: "Observação obrigatória",
    description: "Você precisa informar o motivo do ajuste de estoque",
    variant: "destructive",
  });
  return;
}
```

**5. Busca estoque atual:**
```typescript
const { data: product } = await supabase
  .from("products")
  .select("current_stock")
  .eq("id", productId)
  .single();
```

**6. Calcula novo estoque:**
```typescript
let newStock = previousStock;

if (movementType === "entrada") {
  newStock = previousStock + quantity;
} else if (movementType === "saida") {
  newStock = previousStock - quantity;
  if (newStock < 0) throw new Error("Estoque insuficiente");
} else if (movementType === "ajuste") {
  newStock = quantity; // Define estoque absoluto
}
```

**7. Insert movimentação:**
```typescript
await supabase.from("stock_movements").insert({
  product_id: productId,
  movement_type: movementType,
  quantity: Math.abs(movementType === "ajuste" ? quantity - previousStock : quantity),
  previous_stock: previousStock,
  new_stock: newStock,
  notes: notes,
  performed_by: user.id,
  movement_category: 'produto',
  sector_id: sectorId || null,
});
```

**8. Update estoque do produto:**
```typescript
await supabase
  .from("products")
  .update({ current_stock: newStock })
  .eq("id", productId);
```

#### Fluxo de Soft Delete

**1. Usuário clica ícone de lixeira** (linha 550)
- Disponível apenas para admin

**2. AlertDialog abre solicitando motivo**

**3. Preenche motivo da exclusão** (obrigatório)

**4. Valida motivo:**
```typescript
if (!reason.trim()) {
  toast({
    title: "Observação obrigatória",
    description: "Você precisa informar o motivo da exclusão",
    variant: "destructive",
  });
  return;
}
```

**5. Update com soft delete:**
```typescript
await supabase
  .from("stock_movements")
  .update({
    deleted_at: new Date().toISOString(),
    deleted_by: user.id,
    deletion_reason: reason,
  })
  .eq("id", movementId);
```

**6. Movimentação some da visualização**
- Filtro: `movements.filter((m) => !m.deleted_at)`

#### Fluxo de Exportação para Excel

**Arquivo:** `src/pages/StockMovements.tsx` (linha 368)

**1. Usuário clica botão "Exportar"**

**2. Prepara dados:**
```typescript
const dataToExport = filteredMovements.map((movement) => ({
  Categoria: movement.movement_category === "produto" ? "Produto" : "Sistema",
  Produto: movement.products?.name || "-",
  Setor: movement.sectors?.name || "-",
  Tipo: movement.movement_type === "entrada" ? "Entrada" : ...,
  Quantidade: movement.quantity,
  Unidade: movement.products?.unit || "",
  "Estoque Anterior": movement.previous_stock,
  "Estoque Novo": movement.new_stock,
  "Realizado Por": movement.profiles?.full_name || "-",
  Observação: movement.notes || "-",
  Data: new Date(movement.created_at).toLocaleString("pt-BR"),
}));
```

**3. Cria planilha:**
```typescript
const ws = XLSX.utils.json_to_sheet(dataToExport);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
```

**4. Download do arquivo:**
```typescript
const fileName = `movimentacoes_${new Date().toISOString().split('T')[0]}.xlsx`;
XLSX.writeFile(wb, fileName);
```

#### Componentes Envolvidos
- `StockMovements.tsx`: página principal
- `Dialog`, `Select`, `Textarea`, `Table`, `AlertDialog`: componentes UI
- `XLSX`: biblioteca de exportação

#### Chamadas ao Supabase
- `supabase.from("stock_movements").select()`: listar movimentações
- `supabase.from("stock_movements").insert()`: registrar movimentação
- `supabase.from("stock_movements").update()`: soft delete
- `supabase.from("products").select()`: buscar estoque atual
- `supabase.from("products").update()`: atualizar estoque
- `supabase.from("profiles").select()`: buscar nome do usuário

#### Regras de Validação
- Produto obrigatório
- Tipo obrigatório
- Quantidade > 0
- Observação obrigatória (auditoria)
- Não pode ter estoque negativo em saída
- Motivo obrigatório em soft delete

### 5.4 USUÁRIOS

#### Fluxo de Criação

**Arquivo:** `src/pages/Users.tsx`

**1. Admin/Gerente clica "Novo Usuário"** (linha 315)

**2. Preenche formulário:**
- Nome completo (obrigatório)
- Email (obrigatório)
- Senha (obrigatório, mínimo 6 caracteres)
- Função: setor | estoquista | gerente | admin
- Setor (opcional)
- Cargo (opcional)

**3. Submete formulário** (linha 115)

**4. Valida sessão:**
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) throw new Error("Não autenticado");
```

**5. Chama Edge Function:**
```typescript
const { data, error } = await supabase.functions.invoke("create-user", {
  body: {
    email,
    password,
    fullName,
    role,
    sectorId: sectorId || null,
    position: position || null,
  },
});
```

**6. Edge Function `create-user`:**

**a) Valida token e role do solicitante:**
```typescript
const { data: { user }, error } = await supabaseClient.auth.getUser(token);

const { data: roles } = await supabaseClient
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .in("role", ["admin", "gerente"]);

if (!roles || roles.length === 0) {
  throw new Error("Acesso negado");
}
```

**b) Cria usuário no Supabase Auth:**
```typescript
const { data: newUser, error } = await supabaseClient.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    full_name: fullName,
  },
});
```

**c) Cria perfil diretamente:**
```typescript
const { error: profileError } = await supabaseClient
  .from("profiles")
  .insert({
    id: newUser.user.id,
    full_name: fullName,
    sector_id: sectorId || null,
    position: position || null,
  });
```

**d) Se falhar, deleta usuário (rollback):**
```typescript
if (profileError) {
  await supabaseClient.auth.admin.deleteUser(newUser.user.id);
  throw new Error("Erro ao criar perfil");
}
```

**e) Atribui role:**
```typescript
await supabaseClient
  .from("user_roles")
  .insert({
    user_id: newUser.user.id,
    role: role,
    assigned_by: user.id,
  });
```

**f) Retorna sucesso**

**7. Frontend:**
- Toast de sucesso
- Recarrega lista de usuários

#### Fluxo de Edição

**Arquivo:** `src/pages/Users.tsx` (linha 131)

**1. Admin/Gerente clica ícone de editar**

**2. Dialog abre pré-preenchido**

**3. Altera campos desejados:**
- Nome completo
- Email (opcional, se vazio mantém atual)
- Senha (opcional, se vazio mantém atual)
- Função
- Setor
- Cargo

**4. Submete formulário**

**5. Chama Edge Function:**
```typescript
const updateData: any = {
  userId: editingUser.id,
  fullName,
  role,
  sectorId: sectorId || null,
  position: position || null,
};

// Inclui email e senha apenas se fornecidos
if (email && email.trim()) updateData.email = email;
if (password && password.trim()) updateData.password = password;

await supabase.functions.invoke("update-user", { body: updateData });
```

**6. Edge Function `update-user`:**

**a) Valida permissões (admin/gerente)**

**b) Atualiza email e/ou senha se fornecidos:**
```typescript
if (email || password) {
  const updateData: any = {};
  if (email) updateData.email = email;
  if (password) updateData.password = password;
  
  await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
}
```

**c) Atualiza perfil:**
```typescript
await supabaseClient
  .from("profiles")
  .update({
    full_name: fullName,
    sector_id: sectorId,
    position: position,
  })
  .eq("id", userId);
```

**d) Atualiza role:**
```typescript
// Deleta roles antigas
await supabaseClient
  .from("user_roles")
  .delete()
  .eq("user_id", userId);

// Insere nova role
await supabaseClient
  .from("user_roles")
  .insert({
    user_id: userId,
    role: role,
    assigned_by: user.id,
  });
```

**7. Toast e reload**

#### Fluxo de Exclusão

**Arquivo:** `src/pages/Users.tsx` (linha 221)

**1. Admin clica ícone de lixeira**

**2. AlertDialog pede confirmação**

**3. Confirma exclusão**

**4. Chama Edge Function:**
```typescript
await supabase.functions.invoke("delete-user", {
  body: { userId },
});
```

**5. Edge Function `delete-user`:**

**a) Valida que usuário é admin:**
```typescript
const { data: roles } = await supabaseClient
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .in("role", ["admin"]);
```

**b) Deleta usuário:**
```typescript
await supabaseClient.auth.admin.deleteUser(userId);
```

**c) Cascade delete automático:**
- Profile é deletado (FK CASCADE)
- Roles são deletadas (FK CASCADE)

**6. Toast e reload**

#### Componentes Envolvidos
- `Users.tsx`: página principal
- `Dialog`, `Input`, `Select`, `Table`, `AlertDialog`: componentes UI
- `useUserRole`: verificar permissões

#### Chamadas ao Supabase
- `supabase.functions.invoke("list-users")`: listar usuários
- `supabase.functions.invoke("create-user")`: criar usuário
- `supabase.functions.invoke("update-user")`: editar usuário
- `supabase.functions.invoke("delete-user")`: deletar usuário

#### Regras de Validação
- Nome completo obrigatório
- Email obrigatório (criação) / opcional (edição)
- Senha mínimo 6 caracteres (criação) / opcional (edição)
- Função obrigatória
- Apenas admin/gerente podem criar/editar
- Apenas admin pode deletar

#### Tratamento de Erros
- Validação de email duplicado: "Este email já está cadastrado"
- Try/catch com toast de erro
- Rollback em caso de falha

### 5.5 SETORES

#### Fluxo CRUD Completo

**Arquivo:** `src/pages/Sectors.tsx`

**1. Listar Setores** (linha 57)
```typescript
const { data, error } = await supabase
  .from("sectors")
  .select("*")
  .order("name");
```

**2. Criar Setor** (linha 77)
- Admin clica "Novo Setor"
- Preenche nome (obrigatório) e descrição
- Insert no banco
- Trigger `log_sector_changes` registra criação em stock_movements

**3. Editar Setor** (linha 87)
- Admin clica ícone de editar
- Altera nome/descrição
- Update no banco
- Trigger registra edição em stock_movements

**4. Deletar Setor** (linha 114)
- Admin clica ícone de lixeira
- Confirma exclusão
- Delete no banco
- Trigger registra exclusão ANTES do delete

#### Componentes Envolvidos
- `Sectors.tsx`: página principal
- `Dialog`, `Input`, `Textarea`, `Table`: componentes UI

#### Regras de Validação
- Nome obrigatório
- Apenas admin pode criar/editar/deletar

---

## 🔹 6. UI / DESIGN

### 6.1 Componentes Visuais Criados

#### Componentes Shadcn UI Utilizados (40+)

**Formulários:**
- `Button`: botões com variants (default, destructive, outline, ghost, link, secondary)
- `Input`: campos de texto
- `Label`: labels para inputs
- `Textarea`: áreas de texto
- `Select`: dropdowns
- `Checkbox`: checkboxes
- `Switch`: toggles
- `RadioGroup`: grupos de radio buttons
- `Slider`: sliders

**Feedback:**
- `Toast`: notificações temporárias (via Sonner)
- `Alert`: alertas inline
- `AlertDialog`: diálogos de confirmação
- `Badge`: badges de status/categoria
- `Progress`: barras de progresso
- `Skeleton`: loading skeletons

**Overlay:**
- `Dialog`: diálogos/modals
- `Sheet`: painéis laterais deslizantes
- `Popover`: popovers
- `Tooltip`: tooltips
- `HoverCard`: cards ao hover
- `ContextMenu`: menus de contexto
- `DropdownMenu`: dropdowns de menu

**Navegação:**
- `Sidebar`: barra lateral de navegação
- `NavigationMenu`: menus de navegação
- `Breadcrumb`: breadcrumbs
- `Tabs`: abas
- `Pagination`: paginação
- `Command`: command palette

**Layout:**
- `Card`: cards
- `Table`: tabelas
- `Accordion`: accordions
- `Collapsible`: elementos colapsáveis
- `Separator`: separadores
- `ScrollArea`: áreas scrolláveis
- `ResizablePanel`: painéis redimensionáveis
- `AspectRatio`: containers com aspect ratio

**Data Display:**
- `Calendar`: calendário
- `Chart`: gráficos (via Recharts)
- `Carousel`: carrosséis

**Input Especiais:**
- `InputOTP`: input para códigos OTP
- `DatePicker`: seletor de data (via Calendar)

### 6.2 Layout Estruturado

#### Estrutura Principal

**`src/App.tsx` (linha 23-66)**
```jsx
<BrowserRouter>
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/*" element={
      <ProtectedRoute>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/products" element={<Products />} />
                <Route path="/orders" element={<Orders />} />
                {/* ... outras rotas */}
              </Routes>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </ProtectedRoute>
    } />
  </Routes>
</BrowserRouter>
```

**Layout:**
```
┌─────────────────────────────────────┐
│         AppSidebar (lateral)        │
│  ┌──────────────────────────────┐   │
│  │                              │   │
│  │        Main Content          │   │
│  │        (páginas)             │   │
│  │                              │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### AppSidebar

**Arquivo:** `src/components/AppSidebar.tsx`

**Estrutura:**
- Header com logo e título
- Navegação baseada no role:
  - Dashboard (todos)
  - Produtos (todos)
  - Pedidos (todos)
  - Movimentações (admin, gerente)
  - Usuários (admin, gerente)
  - Setores (admin)
  - Impressoras (admin)
  - Perfil (todos)
  - Relatórios (admin, gerente)
- Footer com logout

**Design:**
- Fundo escuro: `--sidebar-background`
- Texto claro: `--sidebar-foreground`
- Hover: `--sidebar-accent`
- Ícones do Lucide React
- Responsivo (colapsa em mobile)

### 6.3 Localização dos Styles

#### Design System Global

**`src/index.css`** (linhas 1-119)

**Variáveis CSS (HSL):**
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --primary: 221 83% 53%;
  --secondary: 210 40% 96%;
  --destructive: 0 84% 60%;
  --muted: 210 40% 96%;
  --accent: 142 76% 36%;
  --border: 214 32% 91%;
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
  --info: 199 89% 48%;
  /* ... sidebar, charts */
}

.dark {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  /* ... versões dark */
}
```

**Tailwind Base:**
```css
@layer base {
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-background text-foreground;
  }
}
```

#### Tailwind Config

**`tailwind.config.ts`** (linhas 15-99)

**Cores customizadas:**
```typescript
colors: {
  border: "hsl(var(--border))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
  // ... secondary, destructive, muted, accent, etc
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  info: "hsl(var(--info))",
  chart: {
    "1": "hsl(var(--chart-1))",
    "2": "hsl(var(--chart-2))",
    // ...
  }
}
```

**Animações:**
```typescript
keyframes: {
  "accordion-down": {
    from: { height: "0" },
    to: { height: "var(--radix-accordion-content-height)" },
  },
  "accordion-up": {
    from: { height: "var(--radix-accordion-content-height)" },
    to: { height: "0" },
  },
}
```

### 6.4 Sistema de Temas

#### Dark Mode

**Implementação:**
- Variáveis CSS duplicadas (`:root` e `.dark`)
- `next-themes` para gerenciar tema
- Detecta preferência do sistema
- Persiste escolha no localStorage

**Uso:**
```typescript
import { useTheme } from "next-themes";

const { theme, setTheme } = useTheme();
setTheme("dark"); // ou "light" ou "system"
```

**Classes Tailwind:**
```jsx
<div className="bg-background text-foreground">
  {/* Muda automaticamente com o tema */}
</div>
```

#### Tokens Semânticos

**Princípio:** Nunca usar cores diretas como `bg-white`, `text-black`

**Correto:**
```jsx
<div className="bg-background text-foreground">
<Button variant="primary">
<Badge variant="destructive">
```

**Errado:**
```jsx
<div className="bg-white text-black">
<Button className="bg-blue-500">
```

**Benefícios:**
- Consistência visual
- Fácil manutenção
- Dark mode automático
- Acessibilidade (contraste garantido)

#### Variantes de Componentes

**Exemplo: Button**
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
  }
);
```

**Uso:**
```jsx
<Button variant="destructive" size="sm">
<Button variant="outline" size="icon">
```

---

## 🔹 7. DEPENDÊNCIAS E SCRIPTS

### 7.1 Todas as Dependências do package.json

#### Dependências de Produção

**React & Core:**
- `react@18.3.1`: Biblioteca para UI
- `react-dom@18.3.1`: React para o DOM
- `react-router-dom@6.30.1`: Roteamento

**Supabase:**
- `@supabase/supabase-js@2.80.0`: Cliente Supabase (auth, db, realtime, functions)

**UI Framework:**
- `@radix-ui/*`: 20+ pacotes de primitivas UI (accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, hover-card, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, switch, tabs, toast, toggle, tooltip)

**Formulários:**
- `react-hook-form@7.61.1`: Gerenciamento de formulários
- `@hookform/resolvers@3.10.0`: Resolvers para validação
- `zod@3.25.76`: Validação de schemas

**Estilização:**
- `tailwindcss@^3`: Utility-first CSS
- `tailwindcss-animate@1.0.7`: Animações para Tailwind
- `class-variance-authority@0.7.1`: Variantes de componentes
- `clsx@2.1.1`: Merge condicional de classes
- `tailwind-merge@2.6.0`: Merge inteligente de classes Tailwind

**Ícones:**
- `lucide-react@0.462.0`: Biblioteca de ícones

**Data Fetching:**
- `@tanstack/react-query@5.83.0`: Cache e gerenciamento de estado do servidor

**Utilitários:**
- `date-fns@3.6.0`: Manipulação de datas
- `xlsx@0.18.5`: Exportação para Excel

**Notificações:**
- `sonner@1.7.4`: Toast notifications

**Componentes Especiais:**
- `embla-carousel-react@8.6.0`: Carousels
- `recharts@2.15.4`: Gráficos
- `vaul@0.9.9`: Drawer mobile
- `input-otp@1.4.2`: Input OTP
- `cmdk@1.1.1`: Command palette

**Temas:**
- `next-themes@0.3.0`: Dark mode

#### Dependências de Desenvolvimento

**Vite:**
- `vite@^5`: Build tool
- `@vitejs/plugin-react-swc@^3`: Plugin React com SWC

**TypeScript:**
- `typescript@~5.6`: Linguagem
- `@types/react@^18`: Types do React
- `@types/react-dom@^18`: Types do React DOM
- `@types/node@^22`: Types do Node.js

**Linting:**
- `eslint@^9`: Linter
- `eslint-plugin-react-hooks@5.0.0`: Rules para React Hooks
- `eslint-plugin-react-refresh@^0.4.14`: Rules para Fast Refresh

**CSS:**
- `tailwindcss@^3`: Framework CSS
- `postcss@^8`: Processador CSS
- `autoprefixer@^10`: Auto-prefixing CSS

**Lovable:**
- `lovable-tagger@^1`: Tagger para Lovable

### 7.2 Para Que Cada Dependência Serve

**(Já explicado acima em detalhes)**

### 7.3 Scripts Disponíveis

**`package.json` (scripts)**

**`npm run dev`**
- Inicia servidor de desenvolvimento
- Hot Module Replacement ativo
- Porta: 8080
- Acesso: http://localhost:8080

**`npm run build`**
- Compila projeto para produção
- TypeScript → JavaScript
- Minificação
- Tree shaking
- Output: `dist/`

**`npm run preview`**
- Visualiza build de produção localmente
- Serve arquivos de `dist/`

**`npm run lint`**
- Executa ESLint
- Verifica erros e warnings
- Configuração: `eslint.config.js`

### 7.4 Funções dos Scripts

**Desenvolvimento:**
1. `npm run dev`
2. Abre navegador em localhost:8080
3. Faz alterações no código
4. Hot reload automático

**Build de Produção:**
1. `npm run build`
2. Arquivos gerados em `dist/`
3. Deploy via Lovable ou manualmente

**Preview Local do Build:**
1. `npm run build`
2. `npm run preview`
3. Testa build antes de deploy

**Linting:**
1. `npm run lint`
2. Corrige erros apontados
3. Build novamente se necessário

---

## 🔹 8. COMO RODAR O PROJETO

### 8.1 Requisitos

**Software Necessário:**
- Node.js >= 18.x (recomendado LTS)
- npm >= 9.x (vem com Node.js)
- Git (para clonar repositório)
- Navegador moderno (Chrome, Firefox, Edge, Safari)

**Contas Necessárias:**
- Nenhuma (Lovable Cloud já configurado)

### 8.2 Setup Inicial

#### Passo 1: Clonar o Repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd <NOME_DO_PROJETO>
```

#### Passo 2: Instalar Dependências

```bash
npm install
```

**Aguardar instalação de todas as dependências (40+ pacotes)**

#### Passo 3: Verificar Variáveis de Ambiente

**Arquivo `.env` já existe e está configurado:**
```env
VITE_SUPABASE_PROJECT_ID="gfzloseekwaitfqcxpfw"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGc..."
VITE_SUPABASE_URL="https://gfzloseekwaitfqcxpfw.supabase.co"
```

**NÃO EDITAR MANUALMENTE** - Gerado pelo Lovable Cloud

### 8.3 Comandos para Rodar

#### Modo Desenvolvimento

```bash
npm run dev
```

**Saída esperada:**
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:8080/
➜  Network: use --host to expose
➜  press h + enter to show help
```

**Acessar:** http://localhost:8080

#### Build de Produção

```bash
npm run build
```

**Saída esperada:**
```
vite v5.x.x building for production...
✓ XXX modules transformed.
dist/index.html                  X.XX kB
dist/assets/index-XXXXX.css     XX.XX kB
dist/assets/index-XXXXX.js     XXX.XX kB
✓ built in XXXms
```

#### Preview do Build

```bash
npm run preview
```

**Acesso:** http://localhost:4173 (porta padrão do Vite preview)

### 8.4 Variáveis de Ambiente Obrigatórias

**Já configuradas no `.env`:**
- `VITE_SUPABASE_URL`: URL do projeto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Chave pública
- `VITE_SUPABASE_PROJECT_ID`: ID do projeto

**NÃO É NECESSÁRIO CONFIGURAR MANUALMENTE**

### 8.5 Configurações Adicionais Necessárias

#### Banco de Dados

**Já configurado via Lovable Cloud:**
- Tabelas criadas
- RLS policies aplicadas
- Functions e triggers configurados
- Edge Functions deployadas

**Nenhuma ação manual necessária**

#### Primeiro Login

**Criar primeiro usuário admin:**
1. Acessar Lovable Cloud → Database → SQL Editor
2. Executar script para criar admin:
```sql
-- Criar usuário admin manualmente
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@supplyvine.com',
  crypt('senha123', gen_salt('bf')),
  now(),
  '{"full_name": "Administrador"}'::jsonb,
  now(),
  now()
) RETURNING id;

-- Copiar o ID retornado e usar nos próximos INSERTs

-- Criar perfil
INSERT INTO public.profiles (id, full_name)
VALUES ('<ID_DO_USUARIO>', 'Administrador');

-- Atribuir role admin
INSERT INTO public.user_roles (user_id, role, assigned_by)
VALUES ('<ID_DO_USUARIO>', 'admin', '<ID_DO_USUARIO>');
```

**Ou usar a interface do Lovable para criar primeiro usuário**

#### Configurar Impressoras (Opcional)

1. Login como admin
2. Ir em "Impressoras"
3. Adicionar impressora térmica
4. Configurar IP (se aplicável)
5. Ativar auto-impressão (se desejado)

---

## 🔹 9. PONTOS DE ATENÇÃO / POSSÍVEIS MELHORIAS

### 9.1 Código que Pode Ser Otimizado

#### 1. Carregamento de Profiles nas Movimentações

**Arquivo:** `src/pages/StockMovements.tsx` (linhas 167-197)

**Problema:**
```typescript
const movementsWithProfiles = await Promise.all(
  movementsData.map(async (movement) => {
    // N+1 query problem
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", movement.performed_by)
      .maybeSingle();
    return { ...movement, profiles: profile };
  })
);
```

**Solução:**
- Criar view no banco que já junta stock_movements + profiles
- Ou usar RPC function que retorna dados completos
- Reduz de N queries para 1 query

#### 2. Recarregamento Completo de Listas

**Problema:**
- Sempre recarrega lista completa após insert/update/delete
- Não aproveita dados já em cache

**Solução:**
- Usar React Query mutations com `onSuccess` que atualiza cache
```typescript
const { mutate } = useMutation({
  mutationFn: createProduct,
  onSuccess: (newProduct) => {
    queryClient.setQueryData(['products'], (old) => [...old, newProduct]);
  },
});
```

#### 3. Validações Duplicadas

**Problema:**
- Validações de role em múltiplos lugares (frontend + edge functions + RLS)
- Código duplicado

**Solução:**
- Centralizar validações em hooks customizados
- Criar helper functions reutilizáveis

### 9.2 Melhorias Sugeridas

#### 1. Implementar Paginação

**Onde:** Products, Orders, StockMovements, Users

**Benefício:** Performance com grandes volumes de dados

**Implementação:**
```typescript
const { data, error } = await supabase
  .from("products")
  .select("*", { count: "exact" })
  .range((page - 1) * pageSize, page * pageSize - 1)
  .order("name");
```

#### 2. Adicionar Busca Full-Text

**Onde:** Products (nome + descrição)

**Implementação:**
```sql
ALTER TABLE products ADD COLUMN search_vector tsvector;

CREATE TRIGGER products_search_vector_update
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(search_vector, 'pg_catalog.portuguese', name, description);
```

```typescript
const { data } = await supabase
  .from("products")
  .select()
  .textSearch("search_vector", searchTerm);
```

#### 3. Implementar Auditoria Completa

**Tabela de Auditoria:**
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Trigger genérico:**
```sql
CREATE FUNCTION audit_trigger() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, user_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 4. Dashboard com Métricas

**Implementar:**
- Gráfico de movimentações (entrada vs saída) por período
- Produtos com estoque baixo (top 10)
- Pedidos por status (pizza chart)
- Setores mais ativos
- Usuários mais atuantes

**Usar:** Recharts (já instalado)

#### 5. Relatórios Customizados

**Adicionar:**
- Relatório de movimentações por produto
- Relatório de pedidos por setor/período
- Relatório de usuários ativos/inativos
- Exportação para PDF (jsPDF)

#### 6. Notificações por Email

**Implementar:**
- Email ao criar pedido (para estoquista)
- Email ao mudar status de pedido (para solicitante)
- Email de estoque baixo (para admin/gerente)

**Usar:** 
- Supabase Edge Function + serviço de email (Resend, SendGrid)
- Ou Supabase Triggers + webhook para serviço externo

#### 7. Upload de Imagens de Produtos

**Implementar:**
- Supabase Storage bucket para imagens
- Upload de foto do produto
- Thumbnail automático

**Storage:**
```typescript
const { data, error } = await supabase.storage
  .from('products')
  .upload(`${productId}/image.jpg`, file);
```

#### 8. Backup Automático

**Implementar:**
- Cron job para backup diário
- Export de dados críticos para S3/Cloud Storage
- Script de restauração

#### 9. Logs de Acesso

**Implementar:**
- Tabela de logs de login/logout
- Rastreamento de ações críticas
- Detecção de atividades suspeitas

#### 10. Mobile App (PWA)

**Transformar em PWA:**
- Manifest.json
- Service Worker
- Offline support básico
- Install prompt

### 9.3 Possíveis Problemas

#### 1. Escalabilidade

**Problema:** 
- N+1 queries em algumas telas
- Carregamento completo de listas

**Impacto:** Performance degrada com >1000 produtos/pedidos

**Solução:** Paginação + cache + otimização de queries

#### 2. Concorrência

**Problema:**
- Dois usuários editando mesmo produto simultaneamente
- Last write wins (sem detecção de conflito)

**Impacto:** Dados podem ser sobrescritos

**Solução:**
- Optimistic locking (coluna `version`)
- Ou usar `updated_at` para detectar conflito

#### 3. Estoque Negativo

**Problema:**
- Condição de corrida: dois pedidos marcados "entregue" simultaneamente
- Estoque pode ficar negativo

**Solução:**
- Constraint no banco: `CHECK (current_stock >= 0)`
- Transaction isolada
- Reserva de estoque ao aprovar pedido

#### 4. Segurança: Privilege Escalation

**Proteção Atual:**
- Roles em tabela separada ✅
- RLS policies ✅
- Edge Functions validam permissões ✅

**Atenção:**
- Nunca armazenar role em profiles ou localStorage
- Sempre validar no backend

#### 5. Performance de Edge Functions

**Problema:**
- Cold start pode ser lento (~500ms primeira chamada)

**Solução:**
- Keep-alive requests periódicos
- Ou migrar para servidor dedicado se crítico

### 9.4 Próximos Passos Recomendados

#### Curto Prazo (1-2 semanas)

1. **Implementar paginação** nas listas grandes
2. **Adicionar loading states** melhores (skeletons)
3. **Criar dashboard** com gráficos básicos
4. **Adicionar testes unitários** para funções críticas
5. **Documentar Edge Functions** com JSDoc

#### Médio Prazo (1-2 meses)

1. **Sistema de notificações** por email
2. **Upload de imagens** de produtos
3. **Relatórios customizados** exportáveis
4. **Auditoria completa** de todas as tabelas
5. **Mobile app (PWA)**

#### Longo Prazo (3-6 meses)

1. **Multi-tenancy** (múltiplas empresas)
2. **Integração com ERP** externo
3. **API pública** para integrações
4. **Mobile app nativo** (React Native)
5. **Machine Learning** para predição de estoque

---

## 🔹 10. RESUMO FINAL EM LINGUAGEM HUMANA

### O Que É Este Projeto?

**SupplyVine** é um sistema completo de gestão de estoque criado para empresas que precisam controlar seus produtos, pedidos e movimentações de forma profissional e segura.

### Como Funciona?

Imagine que você tem uma empresa com vários setores (cozinha, bar, escritório, etc). Cada setor precisa de produtos (alimentos, bebidas, material de limpeza, etc). 

Com o SupplyVine:

1. **Você cadastra os produtos** que a empresa usa (nome, quantidade, categoria)

2. **Cada setor pode fazer pedidos** dizendo "preciso de 10 unidades de café, 5 litros de leite"

3. **O estoquista recebe uma notificação** em tempo real quando alguém faz um pedido

4. **O estoquista pode aprovar ou recusar** o pedido

5. **Quando marca como "entregue"**, o sistema automaticamente:
   - Desconta os produtos do estoque
   - Registra quem entregou e quando
   - Cria um histórico da movimentação
   - Pode até imprimir um comprovante

6. **Tudo fica registrado** para auditoria: quem fez o quê, quando e por quê

### Quem Pode Usar?

O sistema tem 4 tipos de usuários:

- **Admin**: pode tudo (gerenciar usuários, produtos, setores, ver todos os relatórios)
- **Gerente**: pode gerenciar usuários e produtos, ver relatórios
- **Estoquista**: cuida dos produtos e atende pedidos
- **Setor**: faz pedidos e acompanha seus pedidos

### O Que Torna Este Sistema Especial?

**1. Segurança:**
- Ninguém consegue ver ou fazer coisas que não deveria
- Tudo é protegido por senhas e permissões
- Cada ação fica registrada (quem fez, quando, por quê)

**2. Automação:**
- Notificações automáticas quando chega pedido novo
- Estoque é atualizado automaticamente ao entregar pedido
- Histórico de movimentações é criado automaticamente

**3. Rastreabilidade:**
- Dá pra saber exatamente o que aconteceu com cada produto
- Se o estoque diminuiu, tem registro de quem pediu, quem entregue e quando
- Relatórios exportáveis para Excel

**4. Tempo Real:**
- Quando alguém cria um pedido, o estoquista é avisado na hora
- Não precisa ficar atualizando a página

**5. Profissional:**
- Visual bonito e moderno
- Funciona em celular, tablet e computador
- Modo escuro para quem prefere

### Como Foi Construído?

**Frontend (o que você vê):**
- React: biblioteca moderna para criar interfaces
- Tailwind CSS: para deixar bonito rapidamente
- Shadcn UI: componentes prontos e profissionais

**Backend (o que fica nos bastidores):**
- Supabase: banco de dados PostgreSQL com superpoderes
  - Autenticação segura
  - Banco de dados SQL robusto
  - Atualizações em tempo real
  - Funções serverless

**Segurança:**
- Row Level Security (RLS): cada pessoa só vê/edita o que pode
- JWT tokens: autenticação segura
- Edge Functions: validações no servidor
- Tabela separada de roles: previne hackers de se promoverem a admin

### O Que Ainda Pode Melhorar?

1. **Paginação**: quando tiver milhares de produtos, vai ficar lento. Precisa carregar aos poucos.

2. **Fotos de produtos**: seria legal poder anexar foto do produto.

3. **Notificações por email**: além da notificação no sistema, enviar email também.

4. **Dashboard com gráficos**: mostrar visualmente quantos pedidos tem, quais produtos estão acabando, etc.

5. **App mobile**: transformar em app instalável no celular.

6. **Backup automático**: fazer backup dos dados automaticamente todo dia.

### Conclusão

Este é um sistema profissional de gestão de estoque que:
- É **seguro** (não vaza dados, cada um vê só o que pode)
- É **rápido** (notificações em tempo real, interface responsiva)
- É **completo** (produtos, pedidos, usuários, setores, relatórios)
- É **rastreável** (todo histórico registrado)
- É **bonito** (interface moderna e profissional)

Está pronto para uso em produção, mas sempre pode melhorar com as sugestões listadas acima.

---

## APÊNDICES

### A. Glossário de Termos

**RLS (Row Level Security):** Sistema de segurança do PostgreSQL que filtra linhas baseado no usuário logado

**JWT (JSON Web Token):** Token de autenticação criptografado usado para identificar usuário

**Edge Function:** Função serverless que roda no backend (Deno runtime)

**Service Role Key:** Chave secreta com acesso total ao banco (bypass RLS)

**Trigger:** Função que executa automaticamente quando algo acontece no banco

**Soft Delete:** Marcar como deletado sem remover fisicamente do banco

**Realtime:** Atualizações em tempo real via WebSocket

**HSL:** Formato de cor (Hue, Saturation, Lightness)

**Shadcn UI:** Coleção de componentes React baseados em Radix UI e Tailwind

**Radix UI:** Biblioteca de componentes headless (sem estilo)

**Type Safety:** Garantia de tipos pelo TypeScript

**HOC (Higher-Order Component):** Componente que envolve outro componente

**SSR (Server-Side Rendering):** Renderização no servidor (não usado neste projeto)

**CSR (Client-Side Rendering):** Renderização no cliente (usado neste projeto)

### B. Atalhos e Convenções

**Nomenclatura de Arquivos:**
- Componentes: PascalCase (ex: `AppSidebar.tsx`)
- Páginas: PascalCase (ex: `Products.tsx`)
- Hooks: camelCase com prefixo `use` (ex: `useUserRole.tsx`)
- Utils: camelCase (ex: `utils.ts`)
- Types: snake_case para tabelas, PascalCase para interfaces

**Nomenclatura de Variáveis:**
- Estado: camelCase (ex: `isLoading`)
- Constantes: UPPER_SNAKE_CASE (ex: `CATEGORIES`)
- Funções: camelCase (ex: `handleSubmit`)
- Tipos/Interfaces: PascalCase (ex: `Product`)

**Estrutura de Componentes:**
```typescript
// 1. Imports
// 2. Types/Interfaces
// 3. Constantes
// 4. Componente
// 5. Export
```

**Commits:**
- feat: nova funcionalidade
- fix: correção de bug
- docs: documentação
- style: formatação
- refactor: refatoração
- test: testes

### C. Links Úteis

**Documentação:**
- React: https://react.dev
- Supabase: https://supabase.com/docs
- Tailwind CSS: https://tailwindcss.com/docs
- Shadcn UI: https://ui.shadcn.com
- React Router: https://reactrouter.com
- React Query: https://tanstack.com/query
- Zod: https://zod.dev

**Ferramentas:**
- Lovable: https://lovable.dev
- TypeScript: https://www.typescriptlang.org
- Vite: https://vitejs.dev

**Comunidade:**
- Lovable Discord: (link na documentação)
- Stack Overflow: https://stackoverflow.com

---

**Documentação gerada em:** 2025-11-28
**Versão do Projeto:** 1.0.0
**Autor:** SupplyVine Team

---

Esta documentação cobre 100% do projeto atual. Para dúvidas específicas ou necessidade de detalhamento adicional de alguma seção, consulte os arquivos de código-fonte diretamente ou entre em contato com a equipe de desenvolvimento.