export interface FileUploadRequest {
  fileName: string;
  content: Buffer;
  mimeType: string;
  tenantId: string;
}

export interface FileUploadResult {
  fileKey: string;
  fileSizeBytes: number;
}

export interface IStorageService {
  upload(request: FileUploadRequest): Promise<FileUploadResult>;
  getDownloadUrl(fileKey: string, tenantId: string): Promise<string>;
}
