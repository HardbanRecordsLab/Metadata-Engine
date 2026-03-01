
import { CloudFile } from '../types';

// --- GOOGLE DRIVE ---

export const listGoogleDriveFiles = async (accessToken: string): Promise<CloudFile[]> => {
    try {
        // MimeType query: audio files
        const q = "mimeType contains 'audio/' and trashed = false";
        const fields = "files(id, name, size, mimeType, modifiedTime)";
        
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=20`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            if(response.status === 401) throw new Error("Unauthorized. Token expired.");
            throw new Error("Failed to fetch Drive files.");
        }

        const data = await response.json();
        
        return (data.files || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            size: f.size ? (parseInt(f.size) / (1024*1024)).toFixed(1) + ' MB' : 'Unknown',
            type: f.mimeType,
            modified: f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ''
        }));
    } catch (e) {
        console.error("GDrive List Error", e);
        throw e;
    }
};

export const downloadGoogleDriveFile = async (fileId: string, accessToken: string, fileName: string, mimeType: string): Promise<File> => {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) throw new Error("Download failed");

    const blob = await response.blob();
    return new File([blob], fileName, { type: mimeType });
};

// --- DROPBOX ---

export const listDropboxFiles = async (accessToken: string): Promise<CloudFile[]> => {
    try {
        const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: "", // Root
                recursive: false,
                include_media_info: true
            })
        });

        if (!response.ok) throw new Error("Failed to fetch Dropbox files.");

        const data = await response.json();
        
        // Filter for audio (simple extension check as DBX doesn't strictly enforce mime on list)
        const audioExtensions = ['.mp3', '.wav', '.flac', '.aiff', '.m4a'];
        
        return data.entries
            .filter((f: any) => f['.tag'] === 'file' && audioExtensions.some(ext => f.name.toLowerCase().endsWith(ext)))
            .map((f: any) => ({
                id: f.path_lower, // Use path as ID for download
                name: f.name,
                size: f.size ? (f.size / (1024*1024)).toFixed(1) + ' MB' : 'Unknown',
                type: 'audio/*', // Generic
                modified: f.client_modified ? new Date(f.client_modified).toLocaleDateString() : ''
            }));

    } catch (e) {
        console.error("Dropbox List Error", e);
        throw e;
    }
};

export const downloadDropboxFile = async (path: string, accessToken: string, fileName: string): Promise<File> => {
    // Dropbox download uses a different domain and header structure (Dropbox-API-Arg)
    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({ path: path })
        }
    });

    if (!response.ok) throw new Error("Download failed");

    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || 'audio/mpeg' });
};
