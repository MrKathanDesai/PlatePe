import { useEffect, useState, type FormEvent } from 'react';
import { deactivateUser, getUsers, reactivateUser, registerUser } from '../api';
import type { User, UserRole } from '../types';

function mapApiUserToUser(apiUser: { id: string; name: string; email: string; role: string; isActive: boolean }): User {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role as UserRole,
    active: apiUser.isActive,
  };
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Terminal');
  const [staffMembers, setStaffMembers] = useState<User[]>([]);
  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    role: 'Cashier' as User['role'],
  });

  useEffect(() => {
    const fetchStaffMembers = async () => {
      const token = localStorage.getItem('platepe_token');

      if (!token) {
        setStaffMembers([]);
        return;
      }

      try {
        const users = await getUsers(token);
        setStaffMembers(users.map(mapApiUserToUser));
      } catch (_error) {
        setStaffMembers([]);
      }
    };

    fetchStaffMembers();
  }, []);

  const tabs = ['Terminal', 'Staff', 'Notifications', 'Integrations', 'System'];

  const handleAddStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = newStaff.name.trim();
    const trimmedEmail = newStaff.email.trim();

    if (!trimmedName || !trimmedEmail) {
      return;
    }

    const token = localStorage.getItem('platepe_token');

    if (!token) {
      return;
    }

    try {
      const createdUser = await registerUser(
        {
          name: trimmedName,
          email: trimmedEmail,
          password: 'platepe123',
          role: newStaff.role,
        },
        token,
      );

      setStaffMembers((previousStaff) => [mapApiUserToUser(createdUser), ...previousStaff]);
      setNewStaff({ name: '', email: '', role: 'Cashier' });
      setShowAddStaffForm(false);
    } catch (_error) {
      return;
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    const token = localStorage.getItem('platepe_token');

    if (!token) {
      return;
    }

    try {
      await deactivateUser(staffId, token);
      setStaffMembers((previousStaff) => previousStaff.filter((staff) => staff.id !== staffId));
      setDeleteConfirmId(null);
    } catch (_error) {
      return;
    }
  };

  const handleReactivateStaff = async (staffId: string) => {
    const token = localStorage.getItem('platepe_token');

    if (!token) {
      return;
    }

    try {
      await reactivateUser(staffId, token);
      setStaffMembers((previousStaff) =>
        previousStaff.map((staff) => (staff.id === staffId ? { ...staff, active: true } : staff)),
      );
    } catch (_error) {
      return;
    }
  };

  return (
    <div className="flex h-full bg-[#fafaf8] text-zinc-900">
      <aside className="w-48 shrink-0 border-r border-zinc-100 bg-white py-6 px-3">
        <nav className="space-y-1.5">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setDeleteConfirmId(null);
              }}
              className={`w-full text-left transition-colors ${
                activeTab === tab
                  ? 'bg-zinc-900 text-white text-sm font-medium px-3 py-2 rounded-xl'
                  : 'text-zinc-500 text-sm px-3 py-2 rounded-xl hover:bg-zinc-50 hover:text-zinc-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl">
          {activeTab === 'Terminal' && (
            <section>
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-zinc-900">Terminal Settings</h2>
                <button
                  type="button"
                  className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
                >
                  Save Changes
                </button>
              </div>

              <div className="space-y-5 rounded-2xl border border-zinc-100 bg-white p-6">
                <div>
                  <label htmlFor="terminalName" className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Terminal Name
                  </label>
                  <input
                    id="terminalName"
                    type="text"
                    defaultValue="Odoo Cafe — Main Counter"
                    className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="defaultFloor" className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Default Floor
                  </label>
                  <select
                    id="defaultFloor"
                    className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                    defaultValue="Ground Floor"
                  >
                    <option>Ground Floor</option>
                    <option>Terrace</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="receiptHeader" className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Receipt Header
                  </label>
                  <input
                    id="receiptHeader"
                    type="text"
                    defaultValue="Thank you for visiting"
                    className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="supportPhone" className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Support Phone
                  </label>
                  <input
                    id="supportPhone"
                    type="text"
                    defaultValue="+1 (312) 847-1928"
                    className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === 'Staff' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-zinc-900">Team Members</h2>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
                    {staffMembers.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddStaffForm((previousValue) => !previousValue);
                    setDeleteConfirmId(null);
                  }}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  Add Member
                </button>
              </div>

              {showAddStaffForm && (
                <form onSubmit={handleAddStaff} className="space-y-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="staffName" className="mb-1.5 block text-xs font-medium text-zinc-500">
                        Name
                      </label>
                      <input
                        id="staffName"
                        type="text"
                        value={newStaff.name}
                        onChange={(event) => setNewStaff((previous) => ({ ...previous, name: event.target.value }))}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                        placeholder="Enter full name"
                      />
                    </div>

                    <div>
                      <label htmlFor="staffEmail" className="mb-1.5 block text-xs font-medium text-zinc-500">
                        Email
                      </label>
                      <input
                        id="staffEmail"
                        type="email"
                        value={newStaff.email}
                        onChange={(event) => setNewStaff((previous) => ({ ...previous, email: event.target.value }))}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                        placeholder="name@platepe.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="staffPassword" className="mb-1.5 block text-xs font-medium text-zinc-500">
                        Password
                      </label>
                      <input
                        id="staffPassword"
                        type="text"
                        value="platepe123"
                        readOnly
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="staffRole" className="mb-1.5 block text-xs font-medium text-zinc-500">
                        Role
                      </label>
                      <select
                        id="staffRole"
                        value={newStaff.role}
                        onChange={(event) =>
                          setNewStaff((previous) => ({ ...previous, role: event.target.value as User['role'] }))
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Cashier">Cashier</option>
                        <option value="Server">Server</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
                    >
                      Add Member
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddStaffForm(false);
                        setNewStaff({ name: '', email: '', role: 'Cashier' });
                      }}
                      className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-white hover:text-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {staffMembers.map((staff) => (
                  <div
                    key={staff.id}
                    className="group rounded-xl border border-zinc-100 bg-white px-5 py-4 transition-colors hover:border-zinc-200"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(staff.name)}&backgroundColor=e4e4e7&fontFamily=Arial&fontSize=40&fontColor=52525b`}
                        alt={staff.name}
                        className={`h-9 w-9 rounded-full ${staff.active ? '' : 'grayscale opacity-50'}`}
                      />

                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${staff.active ? 'text-zinc-900' : 'text-zinc-400'}`}>
                          {staff.name}
                        </p>
                        <p className="truncate text-xs text-zinc-400">{staff.email}</p>
                      </div>

                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          staff.role === 'Admin'
                            ? 'bg-zinc-900 text-white'
                            : staff.role === 'Server'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {staff.role}
                      </span>

                      <div className="ml-auto flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${staff.active ? 'bg-emerald-500' : 'bg-zinc-400'}`}
                        />
                        <span className={`text-xs ${staff.active ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {staff.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="w-20 text-right">
                        {staff.active ? (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(staff.id)}
                            className="text-xs text-zinc-400 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-500"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              handleReactivateStaff(staff.id);
                              setDeleteConfirmId(null);
                            }}
                            className="text-xs text-zinc-400 opacity-0 transition-colors group-hover:opacity-100 hover:text-green-600"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>

                    {deleteConfirmId === staff.id && (
                      <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
                        <span className="text-xs text-red-500">Confirm?</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(staff.id)}
                          className="text-xs font-medium text-red-500 transition-colors hover:text-red-600"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-600"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab !== 'Terminal' && activeTab !== 'Staff' && (
            <section className="rounded-2xl border border-zinc-100 bg-white p-8">
              <h2 className="text-lg font-semibold text-zinc-900">{activeTab}</h2>
              <p className="mt-2 text-sm text-zinc-500">Configuration for this section will appear here.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
