# Guia Rápido de Configuração - DoseCerta ERP

## ⚡ Configuração em 5 Minutos

### Passo 1: Criar Projeto Supabase (2 min)
1. Acesse https://supabase.com
2. Clique em "Start your project"
3. Crie uma organização e projeto
4. Defina uma senha forte para o banco de dados
5. Aguarde a inicialização

### Passo 2: Executar Schema SQL (1 min)
1. No Supabase, vá em **SQL Editor** (ícone no menu lateral)
2. Clique em **"New Query"**
3. Abra o arquivo `supabase/schema.sql` no seu computador
4. Copie TODO o conteúdo
5. Cole no SQL Editor do Supabase
6. Clique em **"Run"** (ou Ctrl+Enter)
7. Aguarde "Success. No rows returned"

### Passo 3: Criar Usuário Admin (1 min)
1. No Supabase, vá em **Authentication** (ícone de cadeado)
2. Clique em **"Users"**
3. Clique em **"Add user"** > **"Create new user"**
4. Preencha:
   - Email: `admin@suaempresa.com`
   - Password: `SuaSenhaForte123!`
   - ✅ Marque **"Auto Confirm User"**
5. Clique em **"Create user"**
6. **COPIE O EMAIL** que você acabou de criar

### Passo 4: Tornar Usuário Admin (30 seg)
1. Volte ao **SQL Editor**
2. Clique em **"New Query"**
3. Cole este código (substitua o email):
   ```sql
   SELECT set_first_admin('admin@suaempresa.com');
   ```
4. Clique em **"Run"**
5. Deve aparecer "Success. No rows returned"

### Passo 5: Configurar Variáveis de Ambiente (1 min)
1. No Supabase, vá em **Settings** (ícone de engrenagem)
2. Clique em **"API"**
3. Copie:
   - **Project URL**: `https://xyzcompany.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (chave longa)
4. No seu projeto, crie um arquivo `.env` na raiz:
   ```env
   VITE_SUPABASE_URL=https://xyzcompany.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
5. Salve o arquivo

### Passo 6: Executar o App (30 seg)
```bash
# No terminal, na pasta do projeto
npm install
npm run dev
```

### Passo 7: Primeiro Login
1. Abra o navegador em http://localhost:5173
2. Faça login com:
   - Email: `admin@suaempresa.com`
   - Senha: `SuaSenhaForte123!`
3. Pronto! Você está no sistema como Administrador.

## 🎯 Próximos Passos

### Criar Usuários Operadores
1. No menu lateral, clique em **"Gestão de Usuários"**
2. Clique em **"Novo Usuário"**
3. Preencha os dados do operador
4. Escolha o nível: **Operador** (acesso restrito)
5. Clique em **"Criar Usuário"**

### Verificar Auditoria
1. No menu lateral, clique em **"Auditoria"**
2. Você verá todos os logs de ações críticas
3. Cada ação mostra: quem fez, o quê, quando e em qual entidade

## 🔍 Verificação Rápida

Para confirmar que tudo está funcionando:

```sql
-- No SQL Editor do Supabase, execute:

-- 1. Verificar se o admin foi criado
SELECT email, name, role FROM users WHERE role = 'admin';

-- 2. Verificar se as tabelas foram criadas
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 3. Verificar se o RLS está ativo
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

## ❌ Problemas Comuns

### "Variáveis de ambiente não configuradas"
- Verifique se o arquivo `.env` existe na raiz do projeto
- Confirme que não há espaços antes/depois das variáveis
- Reinicie o servidor: `Ctrl+C` e depois `npm run dev`

### "Usuário não encontrado"
- O usuário deve existir no Auth E na tabela `users`
- Execute o `set_first_admin()` novamente
- Verifique se o email está correto

### "Acesso negado"
- Verifique se o usuário está ativo: `SELECT * FROM users WHERE email = 'seu@email.com'`
- Se `is_active = false`, reative: `UPDATE users SET is_active = true WHERE email = 'seu@email.com'`

### "Permissão negada ao excluir"
- Operadores NÃO podem excluir transações (é uma proteção de segurança)
- Apenas Administradores podem excluir transações financeiras

## 📞 Precisa de Ajuda?

1. **Documentação completa**: Leia o `README.md`
2. **Supabase**: https://supabase.com/docs
3. **Logs de erro**: Abra o Console do navegador (F12) e veja as mensagens

---

**Configuração concluída? Parabéns! Seu sistema está pronto para uso.** 🎉
