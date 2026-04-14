import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { supabase } from "../../lib/supabase";
import { Search, ShieldAlert, ShieldCheck } from "lucide-react";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (!error && data) setUsers(data);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.username?.toLowerCase().includes(search.toLowerCase()) || 
    user.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="User Management">
      <div className="bg-[#0D0B24] border border-[#1C1A38] rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        <div className="p-4 border-b border-[#1C1A38] flex justify-between items-center bg-[#07061A]/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A0D8]" />
            <input 
              type="text" 
              placeholder="Search by username..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1C1A38]/50 border border-[#1C1A38] text-sm text-white rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-[#6C3EF4] transition-colors"
            />
          </div>
          <div className="text-sm font-bold text-[#A8A0D8]">
            Total: <span className="text-[#6C3EF4]">{filteredUsers.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#0D0B24] border-b border-[#1C1A38] shadow-sm z-10">
              <tr>
                <th className="p-4 text-xs font-bold text-[#A8A0D8] uppercase tracking-wider">User Profile</th>
                <th className="p-4 text-xs font-bold text-[#A8A0D8] uppercase tracking-wider">Role</th>
                <th className="p-4 text-xs font-bold text-[#A8A0D8] uppercase tracking-wider">Joined Date</th>
                <th className="p-4 text-xs font-bold text-[#A8A0D8] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1A38]">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-[#A8A0D8]">Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-[#A8A0D8]">No users found.</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#6C3EF4] to-[#00D4AA] flex items-center justify-center text-white font-bold text-lg shrink-0">
                        {user.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">@{user.username || 'unknown'}</span>
                        <span className="text-[10px] text-[#A8A0D8]">ID: {user.id.substring(0, 12)}...</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {user.is_founder ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00D4AA] bg-[#00D4AA]/10 px-2 py-1 rounded">
                          <ShieldCheck className="w-3 h-3" /> Founder
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[#A8A0D8] bg-[#1C1A38] px-2 py-1 rounded">User</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-[#A8A0D8]">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-[#00D4AA]">Active</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
