import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { supabase } from "../../lib/supabase";
import { Search, ExternalLink, Image as ImageIcon, Trash2 } from "lucide-react";

export default function AdminCertificates() {
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchCerts = async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (!error && data) setCerts(data);
      setLoading(false);
    };
    fetchCerts();
  }, []);

  const filteredCerts = certs.filter(cert => 
    cert.file_name?.toLowerCase().includes(search.toLowerCase()) || 
    cert.sha256?.toLowerCase().includes(search.toLowerCase()) ||
    cert.file_hash?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Certificates Management">
      <div className="bg-[#0D0B24] border border-[#1C1A38] rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        {/* Toolbar */}
        <div className="p-4 border-b border-[#1C1A38] flex justify-between items-center bg-[#07061A]/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A0D8]" />
            <input 
              type="text" 
              placeholder="Search by name or hash..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1C1A38]/50 border border-[#1C1A38] text-sm text-white rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-[#6C3EF4] transition-colors"
            />
          </div>
          <div className="text-sm font-bold text-[#A8A0D8]">
            Total: <span className="text-[#00D4AA]">{filteredCerts.length}</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#0D0B24] border-b border-[#1C1A38] shadow-sm z-10">
              <tr>
                <th className="p-4 text-xs font-bold text-[#A8A0D8] uppercase tracking-wider">Artwork</th>
                <th className="p-4 text-xs font-bold text-[#A8A0D8] uppercase tracking-wider">Hash (SHA-256)</th>
                <th className="p-4 text-xs font-bold text-[#A8A0D8] uppercase tracking-wider">Date</th>
                <th className="p-4 text-xs font-bold text-[#A8A0D8] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1A38]">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-[#A8A0D8]">Loading certificates...</td></tr>
              ) : filteredCerts.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-[#A8A0D8]">No certificates found.</td></tr>
              ) : (
                filteredCerts.map(cert => (
                  <tr key={cert.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#1C1A38] flex items-center justify-center overflow-hidden shrink-0 border border-[#1C1A38]">
                        {cert.public_image_url ? (
                          <img src={cert.public_image_url} alt="thumb" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-[#A8A0D8]" />
                        )}
                      </div>
                      <div className="flex flex-col max-w-[200px]">
                        <span className="text-sm font-bold text-white truncate">{cert.file_name || cert.original_filename || 'Untitled'}</span>
                        <span className="text-[10px] text-[#A8A0D8] truncate">ID: {cert.id.split('-')[0]}...</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <code className="text-xs text-[#00D4AA] bg-[#00D4AA]/10 px-2 py-1 rounded">
                        {(cert.sha256 || cert.file_hash)?.substring(0, 16)}...
                      </code>
                    </td>
                    <td className="p-4 text-sm text-[#A8A0D8]">
                      {new Date(cert.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                        <a href={`/cert/${cert.id}`} target="_blank" rel="noreferrer" className="p-2 bg-[#6C3EF4]/10 text-[#6C3EF4] hover:bg-[#6C3EF4]/20 rounded-lg transition-colors" title="View Public Page">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button className="p-2 bg-[#FF4D4D]/10 text-[#FF4D4D] hover:bg-[#FF4D4D]/20 rounded-lg transition-colors" title="Delete Certificate (Admin Override)">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
