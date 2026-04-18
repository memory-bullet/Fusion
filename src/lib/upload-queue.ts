export type UploadQueueItem = {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  xhr?: XMLHttpRequest;
};

export function uploadFileWithProgress(
  file: File,
  url: string,
  onProgress: (progress: number) => void,
  onSuccess: (response: unknown) => void,
  onError: (error: string) => void
): XMLHttpRequest {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append("file", file);

  xhr.upload.addEventListener("progress", (e) => {
    if (e.lengthComputable) {
      const progress = Math.round((e.loaded / e.total) * 100);
      onProgress(progress);
    }
  });

  xhr.addEventListener("load", () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const response = JSON.parse(xhr.responseText);
        onSuccess(response);
      } catch (e) {
        onError("响应解析失败");
      }
    } else {
      try {
        const errorResponse = JSON.parse(xhr.responseText);
        onError(errorResponse.error || "上传失败");
      } catch (e) {
        onError(`上传失败 (${xhr.status})`);
      }
    }
  });

  xhr.addEventListener("error", () => {
    onError("网络错误");
  });

  xhr.addEventListener("abort", () => {
    onError("上传已取消");
  });

  xhr.open("POST", url);
  xhr.send(formData);

  return xhr;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
