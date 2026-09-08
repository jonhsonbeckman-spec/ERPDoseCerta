import { useEffect, useState } from "react";
import { auth, type SystemUser, type UserRole } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import { Badge, Field, useToast } from "../../components/ui";
import { useUi } from "../../components/modals";
import { IcAlert, IcCheck, IcPencil, IcPlus, IcTrash, IcUsers } from "../../components/icons";
import { fmtMed } from "../../lib/utils";

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const { push } = useToast();
  const ui = useUi();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Verifica se é admin
  if (currentUser?.role !== "admin") {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <IcAlert size={48} className="mx-auto mb-4 text-coral-600" />
          <h2 className="text-xl font-bold text-ink">Acesso Negado</h2>
          <p className="mt-2 text-sm text-ink-soft">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  const loadUsers = async () => {
    setLoading(true);
    const { users, error } = await auth.listUsers();
    if (error) {
      push("error", `Erro ao carregar usuários: ${error}`);
    } else {
      setUsers(users);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (email: string, password: string, name: string, role: UserRole) => {
    const { user, error } = await auth.createUser(email, password, name, role);
    if (error) {
      push("error", `Erro ao criar usuário: ${error}`);
      return false;
    }
    push("success", `Usuário ${name} criado com sucesso!`);
    setShowCreateModal(false);
    loadUsers();
    return true;
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    const action = isActive ? auth.deactivateUser : auth.activateUser;
    const { success, error } = await action(userId);
    if (error) {
      push("error", `Erro: ${error}`);
      return;
    }
    push("success", isActive ? "Usuário desativado." : "Usuário reativado.");
    loadUsers();
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      push("error", "Você não pode excluir sua própria conta.");
      return;
    }

    ui.confirm({
      title: "Excluir Usuário",
      message: `Tem certeza que deseja excluir permanentemente o usuário "${userName}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
      action: async () => {
        const { success, error } = await auth.deleteUser(userId);
        if (error) {
          push("error", `Erro ao excluir: ${error}`);
          return;
        }
        push("success", "Usuário excluído permanentemente.");
        loadUsers();
      },
    });
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    const { success, error } = await auth.updateUser(userId, { role: newRole });
    if (error) {
      push("error", `Erro: ${error}`);
      return;
    }
    push("success", "Permissão alterada com sucesso.");
    loadUsers();
  };

  return (
    <div className="space-y-5">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Exclusivo para Administradores</p>
          <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight sm:text-3xl">Gestão de Usuários</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-press inline-flex items-center gap-2 rounded-lg bg-pine-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-pine-800"
        >
          <IcPlus size={15} /> Novo Usuário
        </button>
      </header>

      {/* Lista de usuários */}
      <div className="anim-rise card overflow-hidden" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
          <div className="flex items-center gap-2">
            <IcUsers size={18} className="text-leaf-700" />
            <h3 className="font-display text-[15px] font-bold tracking-tight">Usuários do Sistema</h3>
          </div>
          <Badge tone="neutral">{users.length}</Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-ink-faint">Carregando usuários...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-ink-faint">Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <ul>
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 border-b border-line-soft px-5 py-4 transition-colors last:border-0 hover:bg-leaf-50/40">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-bold">{u.name}</p>
                    <Badge tone={u.role === "admin" ? "pine" : "neutral"}>
                      {u.role === "admin" ? "Administrador" : "Operador"}
                    </Badge>
                    {!u.isActive && <Badge tone="coral">Desativado</Badge>}
                    {u.id === currentUser?.id && <Badge tone="leaf">Você</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-faint">{u.email}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    Criado em {fmtMed(u.createdAt)}
                    {u.lastLogin && ` · Último acesso: ${fmtMed(u.lastLogin)}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Alterar permissão */}
                  <select
                    value={u.role}
                    onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                    disabled={u.id === currentUser?.id}
                    className="field-input w-auto px-3 py-1.5 text-[12px] disabled:opacity-50"
                  >
                    <option value="operator">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>

                  {/* Ativar/Desativar */}
                  <button
                    onClick={() => handleToggleActive(u.id, u.isActive)}
                    disabled={u.id === currentUser?.id}
                    className={`btn-press rounded-lg border px-3 py-1.5 text-[12px] font-bold disabled:opacity-50 ${
                      u.isActive
                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "border-leaf-200 bg-leaf-50 text-leaf-700 hover:bg-leaf-100"
                    }`}
                  >
                    {u.isActive ? "Desativar" : "Ativar"}
                  </button>

                  {/* Excluir */}
                  <button
                    onClick={() => handleDeleteUser(u.id, u.name)}
                    disabled={u.id === currentUser?.id}
                    className="btn-press rounded-lg border border-coral-100 bg-coral-50 p-1.5 text-coral-600 hover:bg-coral-100 disabled:opacity-50"
                    aria-label="Excluir usuário"
                  >
                    <IcTrash size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal de criação de usuário */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateUser}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (email: string, password: string, name: string, role: UserRole) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("operator");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      setLoading(false);
      return;
    }

    const success = await onCreate(email, password, name, role);
    if (success) {
      onClose();
    } else {
      setError("Não foi possível criar o usuário. Verifique se o email já está em uso.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div className="anim-pop card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-display text-xl font-bold tracking-tight">Criar Novo Usuário</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nome Completo">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
              placeholder="João Silva"
              required
            />
          </Field>

          <Field label="E-mail Corporativo">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
              placeholder="joao.silva@empresa.com"
              required
            />
          </Field>

          <Field label="Senha Temporária">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              O usuário deverá alterar a senha no primeiro acesso.
            </p>
          </Field>

          <Field label="Nível de Permissão">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="field-input"
            >
              <option value="operator">Operador (acesso restrito)</option>
              <option value="admin">Administrador (acesso total)</option>
            </select>
          </Field>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-coral-100 bg-coral-50 px-3 py-2.5">
              <IcAlert size={16} className="mt-0.5 shrink-0 text-coral-600" />
              <p className="text-[12.5px] font-semibold text-coral-700">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-press flex-1 rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink-soft hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-big flex-1 disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" fill="currentColor" className="opacity-90" />
                  </svg>
                  Criando...
                </span>
              ) : (
                <>
                  <IcCheck size={18} />
                  Criar Usuário
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
