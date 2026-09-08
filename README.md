# DoseCerta ERP - Sistema Corporativo de Controle Financeiro

Sistema completo de controle financeiro para MEI da área de saúde, com autenticação corporativa restrita, gestão de usuários, auditoria e controle de permissões.

## ⚠️ IMPORTANTE: Sistema Corporativo Restrito

Este é um sistema de **acesso restrito** sem cadastro público. Apenas usuários previamente cadastrados pelo Administrador podem acessar o sistema.

## 🚀 Configuração Inicial

### 1. Criar Projeto Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Aguarde a inicialização (pode levar alguns minutos)

### 2. Configurar Banco de Dados

1. No Supabase, vá em **SQL Editor**
2. Copie todo o conteúdo de `supabase/schema.sql`
3. Cole no SQL Editor e execute
4. Aguarde a conclusão (cria tabelas, policies, triggers e funções)

### 3. Criar Primeiro Usuário Administrador (Master)

1. Vá em **Authentication > Users > Add User**
2. Preencha:
   - Email: `admin@dosecerta.com` (ou outro de sua preferência)
   - Password: senha forte (mínimo 6 caracteres)
   - **Marque "Auto Confirm User"**
3. Clique em **Add User**
4. Copie o email do usuário criado
5. Vá em **SQL Editor** novamente
6. Copie o conteúdo de `supabase/seed-admin.sql`
7. Substitua `admin@dosecerta.com` pelo email que você criou
8. Execute o script
9. O usuário agora tem privilégios de Administrador total

### 4. Configurar Variáveis de Ambiente

1. No Supabase, vá em **Settings > API**
2. Copie:
   - **Project URL** (ex: `https://abc123.supabase.co`)
   - **anon public key** (chave longa que começa com `eyJ...`)
3. No projeto, copie `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
4. Edite `.env` e preencha:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### 5. Instalar e Executar

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build
```

### 6. Primeiro Acesso

1. Abra o app no navegador
2. Faça login com o email e senha do usuário Admin criado
3. Você terá acesso total ao sistema, incluindo:
   - Todas as funcionalidades do sistema
   - **Gestão de Usuários** (criar/editar/excluir usuários)
   - **Auditoria** (logs de todas as ações críticas)

### 7. Criar Usuários Operadores

1. No menu lateral, clique em **Gestão de Usuários** (visível apenas para Admin)
2. Clique em **Novo Usuário**
3. Preencha:
   - Nome completo
   - Email corporativo
   - Senha temporária
   - Nível de permissão: **Operador** (acesso restrito)
4. Clique em **Criar Usuário**
5. O operador agora pode fazer login, mas com restrições:
   - ✅ Pode visualizar todos os dados
   - ✅ Pode criar/editar pacientes, produtos, transações
   - ❌ NÃO pode excluir transações financeiras
   - ❌ NÃO pode acessar Gestão de Usuários
   - ❌ NÃO pode acessar Auditoria

## 🔐 Níveis de Acesso

### Administrador (Admin)
- Acesso total ao sistema
- Pode criar, editar e excluir qualquer registro
- Pode gerenciar usuários (criar, editar, desativar, excluir)
- Pode acessar logs de auditoria
- Pode ver dados de todos os usuários

### Operador
- Acesso restrito ao sistema
- Pode criar e editar seus próprios registros
- Pode visualizar dados de todos os usuários
- **NÃO pode excluir transações financeiras** (proteção de segurança)
- **NÃO pode acessar Gestão de Usuários**
- **NÃO pode acessar Auditoria**

## 📊 Funcionalidades do Sistema

### Módulos Principais
- **Hoje**: Fila de aplicações do dia com ações rápidas
- **Dinheiro**: Controle financeiro com DRE, meta e teto MEI
- **Estoque**: Controle de produtos com PMP e alertas
- **Compras & Lotes**: Registro de aquisições com rastreabilidade
- **Relatórios**: Kardex, CMV, Curva ABC, Valoração
- **RH & Custos**: Custo de equipe MOD × MOI
- **Orçamentos**: Precificação e aprovação de serviços
- **Pacientes**: Prontuário completo com anamnese, TCLE e histórico

### Módulos Administrativos (Admin Only)
- **Gestão de Usuários**: Cadastro e controle de acessos
- **Auditoria**: Log completo de todas as ações críticas

## 🔒 Segurança

### Autenticação
- Supabase Auth com JWT tokens
- Sessões persistentes com refresh automático
- Proteção contra brute force (nativa do Supabase)

### Autorização
- Row Level Security (RLS) em todas as tabelas
- Policies granulares por role (admin/operator)
- Isolamento de dados por usuário

### Auditoria
- Logs automáticos de todas as ações críticas (CREATE, UPDATE, DELETE)
- Logs de LOGIN e LOGOUT
- Registro de quem fez o quê e quando
- Dados antigos e novos preservados em JSON

### Proteção de Dados
- Senhas hasheadas com bcrypt (Supabase Auth)
- Tokens JWT com expiração
- HTTPS obrigatório em produção
- Conformidade com LGPD

## 📁 Estrutura do Projeto

```
dosecerta/
├── src/
│   ├── components/       # Componentes reutilizáveis
│   ├── lib/
│   │   ├── domain/      # Lógica de negócio (engines)
│   │   ├── supabase.ts  # Cliente Supabase + API de auth
│   │   ├── store.tsx    # Estado global
│   │   └── utils.ts     # Utilitários
│   ├── views/
│   │   ├── admin/       # Módulos administrativos
│   │   ├── clients/     # Prontuário de pacientes
│   │   ├── stock/       # Módulos de estoque
│   │   └── ...          # Outras views
│   └── App.tsx          # Componente raiz
├── supabase/
│   ├── schema.sql       # Schema completo do banco
│   └── seed-admin.sql   # Script para criar primeiro admin
├── .env.example         # Template de variáveis de ambiente
└── README.md            # Este arquivo
```

## 🛠️ Troubleshooting

### "Variáveis de ambiente não configuradas"
- Verifique se o arquivo `.env` existe na raiz do projeto
- Confirme que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão preenchidos
- Reinicie o servidor de desenvolvimento após alterar `.env`

### "Usuário não encontrado no sistema"
- O usuário deve existir tanto no Supabase Auth quanto na tabela `public.users`
- Execute o `seed-admin.sql` para criar o perfil do primeiro admin
- Para novos usuários, use o painel "Gestão de Usuários"

### "Acesso negado" ou "Usuário desativado"
- Verifique se o usuário está ativo na tabela `public.users`
- O Admin pode reativar usuários em "Gestão de Usuários"

### "Permissão negada" ao tentar excluir transação
- Operadores não podem excluir transações financeiras (restrição de segurança)
- Apenas Administradores podem excluir transações

## 📝 Próximos Passos

Após a configuração inicial:

1. **Crie usuários operadores** para sua equipe
2. **Configure backups automáticos** do banco de dados Supabase
3. **Personalize as categorias** de produtos e transações conforme sua necessidade
4. **Treine sua equipe** sobre os níveis de acesso e boas práticas de segurança
5. **Monitore os logs de auditoria** regularmente

## 📞 Suporte

Para dúvidas sobre:
- **Supabase**: [Documentação oficial](https://supabase.com/docs)
- **DoseCerta**: Consulte a documentação interna ou entre em contato com o desenvolvedor

## 📄 Licença

Sistema proprietário - Todos os direitos reservados

---

**Desenvolvido com foco em segurança, conformidade e facilidade de uso para profissionais de saúde.**
