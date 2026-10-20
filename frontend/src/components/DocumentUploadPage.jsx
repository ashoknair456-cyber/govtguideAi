import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, ArrowRight, X, Trash2 } from 'lucide-react';

export default function DocumentUploadPage({ isHighContrast, onComplete }) {
  const [files, setFiles] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = (docType, file) => {
    if (file) {
      setFiles(prev => ({ ...prev, [docType]: file }));
    }
  };

  const removeFile = (docType) => {
    const newFiles = { ...files };
    delete newFiles[docType];
    setFiles(newFiles);
  };

  const handleAnalyzeAndVanish = () => {
    if (Object.keys(files).length === 0) {
      // Just skip if no files
      onComplete();
      return;
    }

    setAnalyzing(true);
    // Simulate AI extraction taking important things
    setTimeout(() => {
      setExtractedData({
        message: "Key eligibility details extracted. Sensitive documents deleted from memory.",
        documentsProcessed: Object.keys(files).length
      });
      // Vanish the files immediately
      setFiles({});
      setAnalyzing(false);
      setUploadSuccess(true);
      
      // Auto redirect after a short delay
      setTimeout(() => {
        onComplete();
      }, 2500);
    }, 2000);
  };

  return (
    <div className={`min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 ${isHighContrast ? 'bg-black text-yellow-300' : 'bg-slate-50'}`}>
      <div className={`w-full max-w-2xl rounded-2xl border p-6 sm:p-10 shadow-xl ${isHighContrast ? 'bg-black border-yellow-300' : 'bg-white border-slate-200'}`}>
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 mb-3 text-xs font-bold">
            <UploadCloud className="h-4 w-4" />
            <span>Eligibility Document Check</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-2">
            Upload Documents (Optional)
          </h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Upload your documents for a faster eligibility check. We automatically extract key details and then <strong className="text-rose-600">permanently delete the documents</strong> from our memory. We never store your sensitive files.
          </p>
        </div>

        {!uploadSuccess ? (
          <div className="space-y-6">
            {/* Document Upload List */}
            {[
              { id: 'aadhaar', title: 'Aadhaar / Identity Proof', desc: 'For identity and location verification' },
              { id: 'birth', title: 'Birth / Age Proof', desc: 'For age verification' },
              { id: 'residence', title: 'Residence / Domicile Certificate', desc: 'For state/district eligibility' },
              { id: 'income', title: 'Income Certificate', desc: 'For financial threshold verification' },
              { id: 'caste', title: 'Caste / Community Certificate', desc: 'For reservation and social category checks' },
              { id: 'marksheet10', title: '10th Mark Sheet', desc: 'For basic education verification' },
              { id: 'marksheet12', title: '12th Mark Sheet', desc: 'For higher secondary verification' },
              { id: 'highest_edu', title: 'Highest Education Certificate', desc: 'For advanced scholarship checks' }
            ].map(doc => (
              <div key={doc.id} className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="font-bold text-slate-800">{doc.title}</h4>
                    <span className="text-xs text-slate-500">{doc.desc}</span>
                  </div>
                  {files[doc.id] ? (
                    <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 text-sm font-bold">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Selected</span>
                      <button onClick={() => removeFile(doc.id)} className="ml-2 hover:text-emerald-900"><Trash2 className="h-4 w-4"/></button>
                    </div>
                  ) : (
                    <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition whitespace-nowrap">
                      Choose File
                      <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleFileChange(doc.id, e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>
            ))}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
              <button 
                type="button"
                onClick={() => onComplete()}
                className="w-full sm:w-1/3 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
              >
                Skip Upload
              </button>
              
              <button
                type="button"
                onClick={handleAnalyzeAndVanish}
                disabled={analyzing}
                className="w-full sm:w-2/3 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-70"
              >
                {analyzing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                    Extracting & Deleting...
                  </span>
                ) : (
                  <>
                    <span>{Object.keys(files).length > 0 ? 'Analyze & Continue' : 'Continue'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

          </div>
        ) : (
          <div className="py-12 text-center animate-fadeIn flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Analysis Complete!</h3>
            <p className="text-sm text-slate-600 mb-6 max-w-sm">
              {extractedData?.message}
            </p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">
              Redirecting to Dashboard...
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
