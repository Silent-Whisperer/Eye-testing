import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase, handleSupabaseError, OperationType } from '../../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Upload, X, Eye, ArrowLeft, Mail, MessageSquare, Check, Loader2, Sparkles, Send } from 'lucide-react';
import { Patient, EyeFile } from '../../types';

const patientSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  patientId: z.string().min(1, "Patient ID is required"),
  age: z.number().min(0).max(150),
  gender: z.enum(['male', 'female', 'other']),
  phoneNumber: z.string().min(8, "Valid phone number required"),
  whatsappNumber: z.string().min(8, "Valid WhatsApp number required"),
  email: z.string().email("Invalid email address"),
  doctorName: z.string().min(2, "Doctor name is required"),
  notes: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export default function PatientForm({ onSuccess, onCancel, initialData }: { onSuccess?: () => void, onCancel?: () => void, initialData?: Patient }) {
  const [testType, setTestType] = useState<'acuity' | 'contrast' | 'field' | 'other'>('acuity');
  const [rightEyeFiles, setRightEyeFiles] = useState<File[]>([]);
  const [leftEyeFiles, setLeftEyeFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sameAsPrimary, setSameAsPrimary] = useState(false);
  
  // Post-Registration Notification State
  const [registeredPatient, setRegisteredPatient] = useState<{
    id: string;
    fullName: string;
    patientId: string;
    email: string;
    whatsappNumber: string;
    hasFiles: boolean;
    pdfBase64?: string;
    pdfUrl?: string;
  } | null>(null);

  const [statusMessage, setStatusMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [resultsEmailStatus, setResultsEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [whatsappStatus, setWhatsappStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const rightEyeRef = useRef<HTMLInputElement>(null);
  const leftEyeRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: initialData ? {
      fullName: initialData.fullName,
      patientId: initialData.patientId,
      age: initialData.age,
      gender: initialData.gender,
      phoneNumber: initialData.phoneNumber,
      whatsappNumber: initialData.whatsappNumber,
      email: initialData.email,
      doctorName: initialData.doctorName,
      notes: initialData.notes || '',
    } : {
      gender: 'male',
    }
  });

  const phoneNumber = watch('phoneNumber');

  useEffect(() => {
    if (sameAsPrimary && phoneNumber) {
      setValue('whatsappNumber', phoneNumber);
    }
  }, [phoneNumber, sameAsPrimary, setValue]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, side: 'right' | 'left') => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (side === 'right') {
        setRightEyeFiles(prev => [...prev, ...newFiles]);
      } else {
        setLeftEyeFiles(prev => [...prev, ...newFiles]);
      }
    }
  };

  const removeFile = (index: number, side: 'right' | 'left') => {
    if (side === 'right') {
      setRightEyeFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setLeftEyeFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const uploadFiles = async (files: File[], side: 'right' | 'left', patientId: string) => {
    const urls = [];
    for (const file of files) {
      const filePath = `reports/${patientId}/${side}_${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('reports')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('reports')
        .getPublicUrl(filePath);

      urls.push({
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
        createdAt: Date.now()
      });
    }
    return urls;
  };

  const onSubmit = async (data: PatientFormValues) => {
    setUploading(true);
    setStatusMessage('Saving patient clinical records...');
    try {
      let patientId = initialData?.id;
      let hasFiles = rightEyeFiles.length > 0 || leftEyeFiles.length > 0;

      if (initialData) {
        try {
          const { error } = await supabase
            .from('patients')
            .update({
              ...data,
              lastExamDate: hasFiles ? new Date().toISOString() : (initialData.lastExamDate ? new Date(initialData.lastExamDate).toISOString() : null),
            })
            .eq('id', initialData.id);

          if (error) throw error;
        } catch (err) {
          handleSupabaseError(err, OperationType.UPDATE, `patients/${initialData.id}`);
          return;
        }
      } else {
        try {
          const { data: newPatient, error } = await supabase
            .from('patients')
            .insert({
              ...data,
              createdAt: new Date().toISOString(),
              lastExamDate: hasFiles ? new Date().toISOString() : null,
            })
            .select('id')
            .single();

          if (error) throw error;
          patientId = newPatient.id;
        } catch (err) {
          handleSupabaseError(err, OperationType.CREATE, 'patients');
          return;
        }
      }

      let pdfBase64 = undefined;
      let pdfUrl = undefined;

      // Upload and process diagnostic files if they exist
      if (hasFiles && patientId) {
        setStatusMessage('Uploading eye exam assets...');
        const rightUrls = await uploadFiles(rightEyeFiles, 'right', patientId);
        const leftUrls = await uploadFiles(leftEyeFiles, 'left', patientId);

        setStatusMessage('Gemini AI extracting etdrs acuity scoring...');
        
        // Prepare base64 encoded contents for Gemini endpoint
        const rightFilesWithContent = await Promise.all(
          rightEyeFiles.map(async (file, idx) => {
            const content = await fileToBase64(file);
            return { ...rightUrls[idx], content };
          })
        );
        const leftFilesWithContent = await Promise.all(
          leftEyeFiles.map(async (file, idx) => {
            const content = await fileToBase64(file);
            return { ...leftUrls[idx], content };
          })
        );

        const analysisResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientInfo: { ...data, patientId },
            files: [...rightFilesWithContent, ...leftFilesWithContent]
          })
        });

        const { data: extractedData } = await analysisResponse.json();

        setStatusMessage('Storing report ledger and building clinical PDF...');
        const { data: newReport, error: reportErr } = await supabase
          .from('reports')
          .insert({
            patientId: patientId,
            testType,
            examDate: new Date().toISOString(),
            rightEyeFiles: rightUrls,
            leftEyeFiles: leftUrls,
            extractedData,
            whatsappStatus: 'pending',
            createdAt: new Date().toISOString()
          })
          .select('id')
          .single();

        if (reportErr) throw reportErr;
        const reportId = newReport.id;

        const pdfResponse = await fetch('/api/generate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report: { id: reportId, extractedData }, patient: { ...data, id: patientId } })
        });
        
        const pdfData = await pdfResponse.json();
        pdfBase64 = pdfData.pdfBase64;

        setStatusMessage('Archiving generated report PDF...');
        const pdfBlob = await (await fetch(`data:application/pdf;base64,${pdfBase64}`)).blob();
        const pdfPath = `reports/${patientId}/${reportId}.pdf`;
        const { error: pdfUploadErr } = await supabase.storage
          .from('reports')
          .upload(pdfPath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (pdfUploadErr) throw pdfUploadErr;

        const { data: { publicUrl } } = supabase.storage
          .from('reports')
          .getPublicUrl(pdfPath);

        pdfUrl = publicUrl;

        const { error: reportUpdateErr } = await supabase
          .from('reports')
          .update({ pdfUrl })
          .eq('id', reportId);

        if (reportUpdateErr) throw reportUpdateErr;
      }

      toast.success(initialData ? 'Patient record updated' : 'Patient registry stabilized');
      
      setRegisteredPatient({
        id: patientId!,
        fullName: data.fullName,
        patientId: data.patientId,
        email: data.email,
        whatsappNumber: data.whatsappNumber,
        hasFiles,
        pdfBase64,
        pdfUrl
      });

    } catch (error: any) {
      toast.error('Clinical Registry Failure: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSendConfirmation = async () => {
    if (!registeredPatient) return;
    setEmailStatus('sending');
    try {
      const response = await fetch('/api/email/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient: registeredPatient })
      });
      if (response.ok) {
        setEmailStatus('sent');
        toast.success('Confirmation email sent successfully');
      } else {
        throw new Error('Failed to send confirmation email');
      }
    } catch (e) {
      setEmailStatus('failed');
      toast.error('Failed to send confirmation email');
    }
  };

  const handleSendResults = async () => {
    if (!registeredPatient || !registeredPatient.pdfBase64) return;
    setResultsEmailStatus('sending');
    try {
      const response = await fetch('/api/email/send-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          patient: registeredPatient,
          pdfBase64: registeredPatient.pdfBase64,
          testType
        })
      });
      if (response.ok) {
        setResultsEmailStatus('sent');
        toast.success('Diagnostic results email sent');
      } else {
        throw new Error('Failed to send results email');
      }
    } catch (e) {
      setResultsEmailStatus('failed');
      toast.error('Failed to send results email');
    }
  };

  const handleSendWhatsapp = async () => {
    if (!registeredPatient) return;
    setWhatsappStatus('sending');
    try {
      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          patient: registeredPatient,
          pdfUrl: registeredPatient.pdfUrl || "",
          testType
        })
      });
      if (response.ok) {
        setWhatsappStatus('sent');
        toast.success('WhatsApp notification sent');
      } else {
        throw new Error('Automated sending skipped');
      }
    } catch (e) {
      setWhatsappStatus('failed');
      toast.info('Auto-send skipped. Standard chat link copyable in Patient ledger.');
    }
  };

  const handleFinish = () => {
    reset();
    setRightEyeFiles([]);
    setLeftEyeFiles([]);
    setRegisteredPatient(null);
    setEmailStatus('idle');
    setResultsEmailStatus('idle');
    setWhatsappStatus('idle');
    if (onSuccess) onSuccess();
  };

  // If successfully registered, show notification options screen
  if (registeredPatient) {
    return (
      <Card className="shadow-[12px_12px_0px_#1A1A1A] rounded-none border-2 border-editorial-text overflow-hidden animate-in fade-in duration-500 max-w-full">
        <CardHeader className="bg-editorial-sidebar border-b border-editorial-border p-4 sm:p-8 pb-6 sm:pb-8">
          <h2 className="font-serif text-2xl sm:text-3xl italic text-editorial-text">Patient Enrollment Stabilized</h2>
          <CardDescription className="text-secondary-foreground uppercase text-[9px] sm:text-[10px] tracking-widest font-bold">
            Choose notification methods to dispatch enrollment and diagnostic results.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 space-y-6 sm:space-y-8">
          <div className="bg-editorial-bg p-4 sm:p-6 border border-editorial-border">
            <h3 className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted mb-3">Enrolled Identity Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="min-w-0">
                <span className="text-editorial-muted block uppercase text-[8px] sm:text-[9px] tracking-widest">Full Name</span>
                <span className="font-bold uppercase block truncate">{registeredPatient.fullName}</span>
              </div>
              <div className="min-w-0">
                <span className="text-editorial-muted block uppercase text-[8px] sm:text-[9px] tracking-widest">Patient ID</span>
                <span className="font-mono block truncate">{registeredPatient.patientId}</span>
              </div>
              <div className="min-w-0">
                <span className="text-editorial-muted block uppercase text-[8px] sm:text-[9px] tracking-widest">Email</span>
                <span className="block break-all">{registeredPatient.email}</span>
              </div>
              <div className="min-w-0">
                <span className="text-editorial-muted block uppercase text-[8px] sm:text-[9px] tracking-widest">WhatsApp</span>
                <span className="block truncate">{registeredPatient.whatsappNumber}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-text border-b border-editorial-text pb-2">Notify Users</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Option 1: Confirmation Email */}
              <Card className="rounded-none border border-editorial-border p-4 sm:p-6 flex flex-col justify-between h-48 hover:border-editorial-text transition-all bg-white">
                <div>
                  <Mail className="text-editorial-text mb-3" size={24} />
                  <h4 className="font-bold text-sm uppercase tracking-tight">Confirmation Email</h4>
                  <p className="text-[10px] text-editorial-muted uppercase mt-1">Send registration details & welcome protocol.</p>
                </div>
                <Button 
                  onClick={handleSendConfirmation}
                  disabled={emailStatus === 'sending' || emailStatus === 'sent'}
                  className={`w-full rounded-none text-[9px] font-bold uppercase tracking-widest bg-editorial-text text-white hover:bg-editorial-text/90 disabled:pointer-events-auto disabled:cursor-not-allowed ${emailStatus === 'sending' ? 'cursor-wait' : 'cursor-pointer'}`}
                >
                  {emailStatus === 'sending' && <Loader2 size={12} className="animate-spin mr-1" />}
                  {emailStatus === 'sent' ? 'Sent ✓' : 'Send Confirmation'}
                </Button>
              </Card>

              {/* Option 2: Results Email */}
              <Card className={`rounded-none border p-4 sm:p-6 flex flex-col justify-between h-48 hover:border-editorial-text transition-all bg-white ${!registeredPatient.hasFiles ? 'opacity-40 border-dashed border-gray-200' : 'border-editorial-border'}`}>
                <div>
                  <Sparkles className="text-blue-600 mb-3" size={24} />
                  <h4 className="font-bold text-sm uppercase tracking-tight">Send Results Email</h4>
                  <p className="text-[10px] text-editorial-muted uppercase mt-1">Dispatch diagnostic evaluation with PDF report attached.</p>
                </div>
                <Button 
                  onClick={handleSendResults}
                  disabled={!registeredPatient.hasFiles || resultsEmailStatus === 'sending' || resultsEmailStatus === 'sent'}
                  className={`w-full rounded-none text-[9px] font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 disabled:pointer-events-auto disabled:cursor-not-allowed ${resultsEmailStatus === 'sending' ? 'cursor-wait' : 'cursor-pointer'}`}
                >
                  {resultsEmailStatus === 'sending' && <Loader2 size={12} className="animate-spin mr-1" />}
                  {resultsEmailStatus === 'sent' ? 'Sent ✓' : 'Send Results'}
                </Button>
              </Card>

              {/* Option 3: WhatsApp Alert */}
              <Card className="rounded-none border border-editorial-border p-4 sm:p-6 flex flex-col justify-between h-48 hover:border-editorial-text transition-all bg-white">
                <div>
                  <MessageSquare className="text-green-600 mb-3" size={24} />
                  <h4 className="font-bold text-sm uppercase tracking-tight">WhatsApp Notification</h4>
                  <p className="text-[10px] text-editorial-muted uppercase mt-1">Send instant WhatsApp notification link.</p>
                </div>
                <Button 
                  onClick={handleSendWhatsapp}
                  disabled={whatsappStatus === 'sending' || whatsappStatus === 'sent'}
                  className={`w-full rounded-none text-[9px] font-bold uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 disabled:pointer-events-auto disabled:cursor-not-allowed ${whatsappStatus === 'sending' ? 'cursor-wait' : 'cursor-pointer'}`}
                >
                  {whatsappStatus === 'sending' && <Loader2 size={12} className="animate-spin mr-1" />}
                  {whatsappStatus === 'sent' ? 'Sent ✓' : 'Send WhatsApp'}
                </Button>
              </Card>
            </div>
          </div>

          <div className="pt-6 border-t border-editorial-border flex justify-end">
            <Button 
              onClick={handleFinish}
              className="w-full sm:w-auto px-8 h-12 bg-editorial-text text-white hover:bg-editorial-text/90 rounded-none text-[10px] uppercase tracking-[0.2em] font-bold cursor-pointer"
            >
              Complete & View Ledger
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      {uploading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white border-2 border-editorial-text shadow-[20px_20px_0px_#000] p-10 max-w-md w-full text-center">
            <Loader2 className="w-12 h-12 text-editorial-text animate-spin mx-auto mb-4" />
            <h3 className="font-serif text-2xl italic mb-2">Clinical Pipeline Active</h3>
            <p className="text-[10px] uppercase tracking-widest text-editorial-muted font-bold animate-pulse">{statusMessage}</p>
          </div>
        </div>
      )}

      <Card className="shadow-[12px_12px_0px_#1A1A1A] rounded-none border-2 border-editorial-text overflow-hidden">
        <CardHeader className="bg-editorial-sidebar border-b border-editorial-border pb-8 relative">
          {onCancel && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel}
              className="absolute top-4 right-4 text-[10px] uppercase font-bold tracking-widest rounded-none border border-editorial-border hover:bg-editorial-text hover:text-white"
            >
              <ArrowLeft size={14} className="mr-1" /> Back
            </Button>
          )}
          <h2 className="font-serif text-3xl italic">{initialData ? 'Modify Enrollment' : 'Administrative Enrollment'}</h2>
          <CardDescription className="text-secondary-foreground uppercase text-[10px] tracking-widest font-bold">Consolidate patient identity and clinical diagnostic routing.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {/* Left Column: Biometrics */}
              <div className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-text border-b border-editorial-text pb-2">Bio-Graphic Data</h3>
                
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text" htmlFor="fullName">Legal Full Name</Label>
                  <Input id="fullName" {...register('fullName')} placeholder="JOHN DOE" className="rounded-none border-editorial-border focus-visible:ring-editorial-text uppercase font-bold" />
                  {errors.fullName && <p className="text-[10px] text-red-500 font-mono">{errors.fullName.message}</p>}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text" htmlFor="patientId">National ID</Label>
                    <Input id="patientId" {...register('patientId')} placeholder="ID-0000" className="rounded-none border-editorial-border focus-visible:ring-editorial-text font-mono" />
                    {errors.patientId && <p className="text-[10px] text-red-500 font-mono">{errors.patientId.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text" htmlFor="age">Age</Label>
                    <Input id="age" type="number" {...register('age', { valueAsNumber: true })} className="rounded-none border-editorial-border focus-visible:ring-editorial-text font-mono" />
                    {errors.age && <p className="text-[10px] text-red-500 font-mono">{errors.age.message}</p>}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text" htmlFor="gender">Gender Identity</Label>
                  <Select onValueChange={(v) => setValue('gender', v as any)} defaultValue={initialData?.gender || 'male'}>
                    <SelectTrigger className="rounded-none border-editorial-border text-[10px] font-bold uppercase">
                      <SelectValue placeholder="GENDER" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="male">MALE</SelectItem>
                      <SelectItem value="female">FEMALE</SelectItem>
                      <SelectItem value="other">OTHER</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 pt-4">
                  <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-text border-b border-editorial-text pb-2">Reachability</h3>
                  
                  <div className="space-y-2 mt-4">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text" htmlFor="phoneNumber">Primary Contact</Label>
                    <Input id="phoneNumber" {...register('phoneNumber')} placeholder="+00 000 000" className="rounded-none border-editorial-border focus-visible:ring-editorial-text font-mono" />
                    {errors.phoneNumber && <p className="text-[10px] text-red-500 font-mono">{errors.phoneNumber.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text" htmlFor="email">Portal Access Email</Label>
                    <Input id="email" {...register('email')} placeholder="EMAIL@EXAMPLE.COM" className="rounded-none border-editorial-border focus-visible:ring-editorial-text uppercase text-xs" />
                    {errors.email && <p className="text-[10px] text-red-500 font-mono">{errors.email.message}</p>}
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text" htmlFor="whatsappNumber">WhatsApp Gateway</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="sameAsPrimary" 
                          checked={sameAsPrimary}
                          onCheckedChange={(checked) => setSameAsPrimary(checked as boolean)}
                          className="w-3 h-3 border-editorial-text data-[state=checked]:bg-editorial-text data-[state=checked]:border-editorial-text"
                        />
                        <Label htmlFor="sameAsPrimary" className="text-[9px] uppercase tracking-widest font-bold text-editorial-text cursor-pointer">
                          Same as primary contact
                        </Label>
                      </div>
                    </div>
                    <Input id="whatsappNumber" {...register('whatsappNumber')} placeholder="+00 000 000" className="rounded-none border-editorial-border focus-visible:ring-editorial-text font-mono" readOnly={sameAsPrimary} />
                    {errors.whatsappNumber && <p className="text-[10px] text-red-500 font-mono">{errors.whatsappNumber.message}</p>}
                  </div>
                </div>
              </div>

              {/* Right Column: Diagnostic */}
              <div className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-text border-b border-editorial-text pb-2">Diagnostic VR Intake</h3>
                
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text">Intake Test Type</Label>
                  <Select value={testType} onValueChange={(v) => setTestType(v as any)}>
                    <SelectTrigger className="rounded-none border-editorial-border text-[10px] font-bold uppercase">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="acuity">VISUAL ACUITY</SelectItem>
                      <SelectItem value="contrast">CONTRAST SENSITIVITY</SelectItem>
                      <SelectItem value="field">VISUAL FIELD</SelectItem>
                      <SelectItem value="other">OTHER VR ASSET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-6 pt-2">
                  {/* Right Eye Upload */}
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text">Right Eye Diagnostic (OD)</Label>
                    <div 
                      onClick={() => rightEyeRef.current?.click()}
                      className="border-2 border-dashed border-editorial-border p-6 flex flex-col items-center justify-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer group bg-gray-50/50"
                    >
                      <Upload className="text-editorial-muted group-hover:text-editorial-text transition-colors" size={24} />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-editorial-muted group-hover:text-editorial-text underline decoration-editorial-border group-hover:decoration-editorial-text">Drop or Select</span>
                      <input type="file" multiple className="hidden" ref={rightEyeRef} onChange={(e) => handleFileChange(e, 'right')} />
                    </div>
                    {rightEyeFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {rightEyeFiles.map((f, i) => (
                          <div key={i} className="bg-editorial-text text-white px-3 py-1 text-[9px] uppercase font-bold flex items-center gap-2">
                            <span className="truncate max-w-[120px]">{f.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); removeFile(i, 'right'); }} className="text-white hover:text-red-300">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Left Eye Upload */}
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text">Left Eye Diagnostic (OS)</Label>
                    <div 
                      onClick={() => leftEyeRef.current?.click()}
                      className="border-2 border-dashed border-editorial-border p-6 flex flex-col items-center justify-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer group bg-gray-50/50"
                    >
                      <Upload className="text-editorial-muted group-hover:text-editorial-text transition-colors" size={24} />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-editorial-muted group-hover:text-editorial-text underline decoration-editorial-border group-hover:decoration-editorial-text">Drop or Select</span>
                      <input type="file" multiple className="hidden" ref={leftEyeRef} onChange={(e) => handleFileChange(e, 'left')} />
                    </div>
                    {leftEyeFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {leftEyeFiles.map((f, i) => (
                          <div key={i} className="bg-editorial-text text-white px-3 py-1 text-[9px] uppercase font-bold flex items-center gap-2">
                            <span className="truncate max-w-[120px]">{f.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); removeFile(i, 'left'); }} className="text-white hover:text-red-300">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text" htmlFor="doctorName">Medical Examiner</Label>
                  <Input id="doctorName" {...register('doctorName')} placeholder="DR. NAME..." className="rounded-none border-editorial-border focus-visible:ring-editorial-text uppercase font-bold text-xs" />
                  {errors.doctorName && <p className="text-[10px] text-red-500 font-mono">{errors.doctorName.message}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t-2 border-editorial-text pt-8">
              <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-text" htmlFor="notes">Clinical Observations</Label>
              <Textarea 
                id="notes" 
                {...register('notes')} 
                placeholder="NOTES..."
                className="min-h-[120px] rounded-none border-editorial-border focus-visible:ring-editorial-text italic text-sm"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 bg-editorial-text text-white hover:bg-editorial-text/90 rounded-none text-xs uppercase tracking-[0.3em] font-bold transition-all shadow-[6px_6px_0px_#A0A0A0]" 
              disabled={uploading}
            >
              {uploading ? 'Archiving Diagnostic Record...' : initialData ? 'Update & Finalize Registry' : 'Finalize & Stabilize Enrollment'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
