import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import twilio from "twilio";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured in environment variables");
  }
  const resend = new Resend(apiKey);

  app.use(express.json({ limit: '50mb' }));

  // Gemini AI Setup following skill guidelines
  const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in Secrets");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // API Routes
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Admin Login Authentication
  app.post("/api/auth/login", (req, res) => {
    try {
      const { username, password } = req.body;
      const adminUser = process.env.CLINIC_ADMIN_USERNAME;
      const adminPass = process.env.CLINIC_ADMIN_PASSWORD;

      if (!adminUser || !adminPass) {
        return res.status(500).json({ success: false, error: "Clinical administration credentials are not configured on the server" });
      }

      if (username === adminUser && password === adminPass) {
        res.json({ success: true });
      } else {
        res.status(401).json({ success: false, error: "Invalid clinical credentials" });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Email: Confirmation
  app.post("/api/email/send-confirmation", async (req, res) => {
    try {
      const { patient } = req.body;
      if (!patient || !patient.email) {
        return res.status(400).json({ error: "Patient email is required" });
      }

      await resend.emails.send({
        from: "Vision Clinic <onboarding@resend.dev>",
        to: patient.email,
        subject: "Vision Clinic - Enrollment Confirmation",
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a1a; padding: 0; box-shadow: 8px 8px 0px #1a1a1a; background-color: #ffffff;">
            <div style="background-color: #1a1a1a; color: #ffffff; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-family: serif; font-style: italic; font-size: 24px; letter-spacing: -0.5px;">VisionClinic AI</h1>
              <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #a0a0a0;">Clinical Diagnostic Ledger</span>
            </div>
            <div style="padding: 32px 24px; color: #1a1a1a;">
              <h2 style="font-size: 20px; font-weight: normal; margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; font-family: serif; font-style: italic;">Enrollment Confirmed</h2>
              <p style="font-size: 13px; line-height: 1.6; color: #444; margin-bottom: 24px;">
                Hello <strong>${patient.fullName}</strong>, <br/><br/>
                This email verifies that your patient profile has been successfully enrolled in the Vision Clinic diagnostic portal database.
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; background-color: #f9f9f9; border: 1px solid #eee;">
                <tr>
                  <td style="padding: 12px; font-weight: bold; text-transform: uppercase; color: #666; width: 40%; border-bottom: 1px solid #eee;">Patient Identifier</td>
                  <td style="padding: 12px; font-family: monospace; border-bottom: 1px solid #eee;"><strong>${patient.patientId}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 12px; font-weight: bold; text-transform: uppercase; color: #666; width: 40%; border-bottom: 1px solid #eee;">Primary Clinician</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee; text-transform: uppercase;">Dr. ${patient.doctorName || 'Staff Physician'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; font-weight: bold; text-transform: uppercase; color: #666; width: 40%;">Enrollment Date</td>
                  <td style="padding: 12px;">${new Date().toLocaleDateString()}</td>
                </tr>
              </table>
              
              <p style="font-size: 12px; line-height: 1.6; color: #666;">
                Your diagnostics will be uploaded and evaluated using our clinical-grade AI core. You will receive further notifications as reports are finalized.
              </p>
            </div>
            <div style="background-color: #f9f9f9; border-top: 1px solid #eee; padding: 16px 24px; text-align: center; font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px;">
              VisionClinic AI &bull; Secure Encrypted Communication &bull; AES-256
            </div>
          </div>
        `
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Email Confirmation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Email: Results Report
  app.post("/api/email/send-results", async (req, res) => {
    try {
      const { patient, pdfBase64, testType } = req.body;
      if (!patient || !patient.email) {
        return res.status(400).json({ error: "Patient email is required" });
      }
      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF content (base64) is required" });
      }

      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const testName = testType === 'acuity' ? 'Visual Acuity' :
                       testType === 'contrast' ? 'Contrast Sensitivity' :
                       testType === 'field' ? 'Visual Field' : 'Diagnostic Report';

      await resend.emails.send({
        from: "Vision Clinic <onboarding@resend.dev>",
        to: patient.email,
        subject: `Vision Clinic Report: ${testName}`,
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a1a; padding: 0; box-shadow: 8px 8px 0px #1a1a1a; background-color: #ffffff;">
            <div style="background-color: #1a1a1a; color: #ffffff; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-family: serif; font-style: italic; font-size: 24px; letter-spacing: -0.5px;">VisionClinic AI</h1>
              <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #a0a0a0;">Clinical Diagnostic Ledger</span>
            </div>
            <div style="padding: 32px 24px; color: #1a1a1a;">
              <h2 style="font-size: 20px; font-weight: normal; margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; font-family: serif; font-style: italic;">Diagnostic Results Ready</h2>
              <p style="font-size: 13px; line-height: 1.6; color: #444; margin-bottom: 24px;">
                Hello <strong>${patient.fullName}</strong>, <br/><br/>
                Your recent <strong>${testName}</strong> diagnostic assets have been analyzed. The generated official clinical report is attached as a PDF file to this email.
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; background-color: #f9f9f9; border: 1px solid #eee;">
                <tr>
                  <td style="padding: 12px; font-weight: bold; text-transform: uppercase; color: #666; width: 40%; border-bottom: 1px solid #eee;">Patient Identifier</td>
                  <td style="padding: 12px; font-family: monospace; border-bottom: 1px solid #eee;"><strong>${patient.patientId}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 12px; font-weight: bold; text-transform: uppercase; color: #666; width: 40%; border-bottom: 1px solid #eee;">Evaluation Type</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${testName.toUpperCase()}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 12px; font-weight: bold; text-transform: uppercase; color: #666; width: 40%;">Release Timestamp</td>
                  <td style="padding: 12px;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
              
              <p style="font-size: 12px; line-height: 1.6; color: #666;">
                Please download the attachment to view detailed visual acuity metrics, ETDRS scores, and clinical observations.
              </p>
            </div>
            <div style="background-color: #f9f9f9; border-top: 1px solid #eee; padding: 16px 24px; text-align: center; font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px;">
              VisionClinic AI &bull; Secure Encrypted Communication &bull; AES-256
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `VisionClinic_Report_${patient.patientId}.pdf`,
            content: pdfBuffer
          }
        ]
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Email Results Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Extraction
  app.post("/api/analyze", async (req, res) => {
    try {
      const { files, patientInfo } = req.body;
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      // Prepare prompt for Gemini
      const prompt = `
        You are a medical data extraction assistant for an ophthalmology clinic.
        Below are details from eye exam files (images, PDFs, or data snippets).
        Extract the following information for ETDRS visual acuity test results:
        - ETDRS Score (Letter count)
        - Visual Acuity (e.g., 20/20, 6/6, LogMAR)
        - Specific observations or anomalies
        
        Structure the response as JSON:
        {
          "rightEye": { "etdrsScore": "string", "visualAcuity": "string", "observations": ["string"] },
          "leftEye": { "etdrsScore": "string", "visualAcuity": "string", "observations": ["string"] },
          "summary": "string"
        }
        
        Patient Name: ${patientInfo.fullName}
        Patient ID: ${patientInfo.patientId}
      `;

      // Use correct SDK pattern from skill
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          { text: prompt }, 
          ...files.map((f: any) => ({
            inlineData: {
              data: f.content.split(',')[1] || f.content,
              mimeType: f.mimeType || "image/jpeg"
            }
          }))
        ]
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      // Try to parse JSON from text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text };

      res.json({ success: true, data: extractedData });
    } catch (error: any) {
      console.error("Analysis Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PDF Generation
  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const { report, patient } = req.body;
      
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 800]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const { width, height } = page.getSize();
      
      // Header
      page.drawText("VISION CLINIC REPORT", { x: 50, y: height - 50, size: 20, font: boldFont, color: rgb(0, 0, 0.5) });
      page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 450, y: height - 50, size: 10, font });
      
      // Patient Info
      page.drawText("PATIENT INFORMATION", { x: 50, y: height - 100, size: 14, font: boldFont });
      page.drawText(`Name: ${patient.fullName}`, { x: 50, y: height - 120, size: 12, font });
      page.drawText(`ID: ${patient.patientId}`, { x: 50, y: height - 135, size: 12, font });
      page.drawText(`Age: ${patient.age} | Gender: ${patient.gender}`, { x: 50, y: height - 150, size: 12, font });
      
      // Results
      page.drawText("EXAMINATION RESULTS (ETDRS)", { x: 50, y: height - 200, size: 14, font: boldFont });
      
      // Right Eye
      page.drawText("RIGHT EYE (OD)", { x: 50, y: height - 230, size: 12, font: boldFont });
      page.drawText(`ETDRS Score: ${report.extractedData.rightEye?.etdrsScore || 'N/A'}`, { x: 70, y: height - 250, size: 11, font });
      page.drawText(`Visual Acuity: ${report.extractedData.rightEye?.visualAcuity || 'N/A'}`, { x: 70, y: height - 265, size: 11, font });
      
      // Left Eye
      page.drawText("LEFT EYE (OS)", { x: 300, y: height - 230, size: 12, font: boldFont });
      page.drawText(`ETDRS Score: ${report.extractedData.leftEye?.etdrsScore || 'N/A'}`, { x: 320, y: height - 250, size: 11, font });
      page.drawText(`Visual Acuity: ${report.extractedData.leftEye?.visualAcuity || 'N/A'}`, { x: 320, y: height - 265, size: 11, font });
      
      // Summary
      page.drawText("SUMMARY & NOTES", { x: 50, y: height - 320, size: 14, font: boldFont });
      const summaryLines = report.extractedData.summary ? report.extractedData.summary.match(/.{1,80}/g) || [] : ["No summary available"];
      summaryLines.slice(0, 5).forEach((line: string, i: number) => {
        page.drawText(line, { x: 50, y: height - 340 - (i * 15), size: 10, font });
      });

      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

      res.json({ success: true, pdfBase64 });
    } catch (error: any) {
      console.error("PDF Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // WhatsApp Sending
  app.post("/api/send-whatsapp", async (req, res) => {
    try {
      const { patient, pdfUrl, testType, to, patientName } = req.body;
      
      const whatsappTo = to || (patient ? patient.whatsappNumber : "");
      const fullName = patientName || (patient ? patient.fullName : "Patient");
      const examName = testType || "Report";

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_WHATSAPP_NUMBER;

      if (!accountSid || !authToken || !from || accountSid === "" || authToken === "") {
        return res.status(400).json({ error: "WhatsApp automated service not configured. Use manual share." });
      }

      const client = twilio(accountSid, authToken);

      const message = await client.messages.create({
        body: `Hello ${fullName}, your Vision Clinic examination report (${examName}) is ready. View it here: ${pdfUrl}`,
        from,
        to: `whatsapp:${whatsappTo}`
      });

      res.json({ success: true, messageId: message.sid });
    } catch (error: any) {
      console.error("WhatsApp Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
