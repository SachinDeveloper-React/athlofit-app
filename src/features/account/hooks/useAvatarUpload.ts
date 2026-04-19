// src/features/account/hooks/useAvatarUpload.ts
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../auth/store/authStore';
import { BASE_URL } from '../../../utils/api';
import { tokenService } from '../../auth/service/tokenService';

export interface UploadAvatarResult {
  avatarUrl: string;
}

async function uploadAvatarToServer(uri: string): Promise<UploadAvatarResult> {
  const token = await tokenService.getAccessToken();

  const formData = new FormData();
  formData.append('avatar', {
    uri,
    type: 'image/jpeg',
    name: 'avatar.jpg',
  } as any);

  const response = await fetch(`${BASE_URL}user/upload-avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Do NOT set Content-Type — fetch sets it automatically with boundary for multipart
    },
    body: formData,
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json?.message ?? 'Upload failed');
  return { avatarUrl: json.data?.avatarUrl };
}

export function useAvatarUpload() {
  const updateUser = useAuthStore(s => s.updateUser);

  return useMutation({
    mutationFn: (uri: string) => uploadAvatarToServer(uri),
    onSuccess: ({ avatarUrl }) => {
      // Instantly reflect new avatar in the auth store / all screens
      updateUser({ avatarUrl });
    },
  });
}
