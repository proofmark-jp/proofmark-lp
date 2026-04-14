import AdminLayout from "../../components/admin/AdminLayout";

export default function AdminPlaceholder({ title }: { title: string }) {
    return (
        <AdminLayout title={title}>
            <div className="flex flex-col items-center justify-center h-[60vh] bg-[#0D0B24] border border-[#1C1A38] rounded-2xl p-8 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 mb-6 rounded-2xl bg-[#6C3EF4]/10 border border-[#6C3EF4]/30 flex items-center justify-center">
                    <span className="text-2xl">🚧</span>
                </div>
                <h2 className="text-2xl font-black text-[#F0EFF8] mb-2">{title}</h2>
                <p className="text-[#A8A0D8] max-w-md">
                    このモジュールは現在開発中（Pending）です。今後のアップデートで、詳細なデータ管理や設定機能がここに実装されます。
                </p>
            </div>
        </AdminLayout>
    );
}