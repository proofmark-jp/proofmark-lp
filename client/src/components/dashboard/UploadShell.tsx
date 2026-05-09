import React from 'react';

interface UploadShellProps {
    hint?: string;
    maxSizeMB?: number;
    children: React.ReactNode;
}

export function UploadShell({ children }: UploadShellProps) {
    return (
        <div className="w-full flex justify-center items-center relative z-10">
            {/* The Obsidian Deskのドロップゾーンラッパー。
        実際のアップロードUIとロジックは子コンポーネント(CertificateUpload)が完全に担うため、
        ここではレイアウトの保持のみを行う。
      */}
            {children}
        </div>
    );
}