# Sistema de Autenticação - DoseCerta

## Visão Geral

O DoseCerta agora possui um sistema completo de autenticação com suporte a **Supabase Auth** e um **modo demonstração local** para desenvolvimento.

## Funcionalidades

✅ **Tela de Login profissional** com campos de e-mail e senha  
✅ **Cadastro de novos usuários** com validação  
✅ **Verificação de sessão** automática (Supabase + localStorage)  
✅ **Botão "Sair"** no Topbar e na Sidebar  
✅ **Proteção de rotas** - só exibe o app se autenticado  
✅ **Modo demonstração** - funciona sem configurar Supabase  
✅ **Persistência de sessão** - não perde login ao recarregar  

## Como Usar

### Modo Demonstração (Padrão)

Se você não configurar as variáveis de ambiente do Supabase, o app funcionará automaticamente em modo demonstração:

1. **Credenciais padrão:**
   - E-mail: `demo@dosecerta.com`
   - Senha: `demo1234`

2. **Como testar:**
   - Abra o app
   - Clique em "Preencher credenciais demo"
   - Clique em "Entrar"
   - Você pode criar novos usuários que serão salvos no localStorage

### Modo Supabase (Produção)

Para usar autenticação real com Supabase:

#### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Vá em **Authentication** → **Providers**
4. Certifique-se de que **Email** está habilitado

#### 2. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (copie de `.env.example`):

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

**Onde encontrar:**
- `VITE_SUPABASE_URL`: Settings → API → Project URL
- `VITE_SUPABASE_ANON_KEY`: Settings → API → anon public key

#### 3. Configurar tabelas (opcional)

Se você quiser salvar dados por usuário no Supabase, crie as tabelas necessárias:

```sql
-- Exemplo: tabela de pacientes vinculada ao usuário
CREATE TABLE patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Política: usuários só veem seus próprios pacientes
CREATE POLICY "Users can view own patients"
  ON patients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patients"
  ON patients FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### 4. Rebuild e deploy

```bash
npm run build
```

## Arquitetura

### Arquivos Principais

- `src/lib/supabase.ts` - Cliente Supabase + modo demo local
- `src/components/AuthProvider.tsx` - Contexto de autenticação
- `src/views/Login.tsx` - Tela de login/cadastro
- `src/App.tsx` - Integração com AuthProvider

### Fluxo de Autenticação

```
1. App inicia
   ↓
2. AuthProvider verifica sessão (Supabase ou localStorage)
   ↓
3. Se autenticado → mostra Shell (app principal)
   Se não → mostra Login
   ↓
4. Usuário faz login/cadastro
   ↓
5. Sessão salva e persistida
   ↓
6. App protegido - só acessa se autenticado
```

### Modo Demo vs Supabase

| Recurso | Modo Demo | Supabase |
|---------|-----------|----------|
| Autenticação | localStorage | Supabase Auth |
| Dados | Locais (navegador) | Nuvem (PostgreSQL) |
| Multi-dispositivo | ❌ Não | ✅ Sim |
| Backup | Manual (exportar JSON) | Automático |
| Segurança | Básica | Profissional (RLS) |
| Ideal para | Testes, desenvolvimento | Produção |

## Segurança

### Modo Demonstração
- Dados salvos no localStorage do navegador
- Senhas em texto plano (apenas para desenvolvimento)
- Não use para dados sensíveis reais

### Modo Supabase
- Senhas hasheadas com bcrypt
- Tokens JWT com expiração
- Row Level Security (RLS) para proteger dados
- HTTPS obrigatório
- Conformidade com LGPD/GDPR

## Troubleshooting

### "Não consigo fazer login"
- Verifique se o e-mail e senha estão corretos
- No modo Supabase, confirme se o e-mail foi verificado
- Verifique o console do navegador para erros

### "Perdi minha sessão"
- No modo Supabase: tokens expiram após 1 hora (configurável)
- Recarregue a página - a sessão deve ser restaurada automaticamente

### "Quero voltar ao modo demo"
- Remova as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do `.env`
- Rebuild: `npm run build`

## Próximos Passos

Para um sistema completo em produção:

1. **Configurar RLS** em todas as tabelas do Supabase
2. **Adicionar recuperação de senha** (já suportado pelo Supabase)
3. **Implementar 2FA** (autenticação em dois fatores)
4. **Adicionar logs de auditoria** (quem fez o quê e quando)
5. **Configurar backups automáticos** do banco de dados
6. **Implementar roles** (administrador, usuário comum, etc.)

## Suporte

Para dúvidas sobre Supabase:
- [Documentação oficial](https://supabase.com/docs)
- [Guia de autenticação](https://supabase.com/docs/guides/auth)

Para dúvidas sobre o DoseCerta:
- Consulte o README principal do projeto
