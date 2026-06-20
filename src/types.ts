export interface Patient {
  id: string;
  fullName: string;
  patientId: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  phoneNumber: string;
  whatsappNumber: string;
  email: string;
  doctorName: string;
  notes: string;
  createdAt: number;
  lastExamDate?: number;
}

export interface EyeFile {
  url: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
}

export interface ExtractedData {
  rightEye?: {
    etdrsScore?: string;
    visualAcuity?: string;
    observations?: string[];
  };
  leftEye?: {
    etdrsScore?: string;
    visualAcuity?: string;
    observations?: string[];
  };
  summary?: string;
  metadata?: Record<string, any>;
}

export interface Report {
  id: string;
  patientId: string;
  testType: 'acuity' | 'contrast' | 'field' | 'other';
  examDate: number;
  rightEyeFiles: EyeFile[];
  leftEyeFiles: EyeFile[];
  extractedData: ExtractedData;
  pdfUrl?: string;
  whatsappStatus: 'pending' | 'sent' | 'failed' | 'not_configured';
  createdAt: number;
}
