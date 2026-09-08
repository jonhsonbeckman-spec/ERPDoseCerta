-- ============================================================
-- SEED - PRIMEIRO USUÁRIO ADMINISTRADOR (MASTER)
-- ============================================================
-- INSTRUÇÕES:
-- 1. Crie o usuário no Supabase Auth (Authentication > Users > Add User)
-- 2. Use o email do usuário criado na função abaixo
-- 3. Execute este script no SQL Editor do Supabase
-- ============================================================

-- Substitua 'admin@dosecerta.com' pelo email do usuário criado no Auth
SELECT public.set_first_admin('jonhsonbeckman30@gmail.com');

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- Para verificar se o admin foi criado com sucesso:
SELECT 
  u.email,
  u.name,
  u.role,
  u.is_active,
  u.created_at
FROM public.users u
WHERE u.role = 'admin';

-- ============================================================
-- NOTAS IMPORTANTES:
-- ============================================================
-- 1. O usuário DEVE existir no Supabase Auth antes de executar este script
-- 2. A senha é definida no momento da criação do usuário no Auth
-- 3. Após executar, o usuário terá acesso total ao sistema
-- 4. Use o painel de Gestão de Usuários para criar operadores
-- 5. O primeiro admin não pode ser excluído (protegido por RLS)
-- ============================================================
