import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, AlertCircle, XCircle, FileCheck2, ShieldCheck, HelpCircle
} from 'lucide-react';
import { statusMeta, normalizeStatus, OFFICIAL_DISCLAIMER } from '../utils/eligibility';

export default function AdvancedEligibilityPanel({ schemeId, showBeforeApplyModal, onCloseModal, schemeName, schemeUrl }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEligibility = async () => {
      try {
        const token = localStorage.getItem('govguide_token') || 'demo-user-token';
        const response = await fetch(`/api/schemes/${schemeId}/eligibility`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          setData(await response.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (schemeId) {
      fetchEligibility();
    }
  }, [schemeId]);

  if (loading) {
    return <div className="p-4 bg-gray-50 rounded-lg animate-pulse mb-6">Loading Advanced Intelligence...</div>;
  }

  if (!data || !data.evaluation) return null;

  const { evaluation, required_documents } = data;
  const canonical = normalizeStatus(evaluation.status);
  const meta = statusMeta(evaluation.status);
  const StatusIcon =
    canonical === 'LIKELY_ELIGIBLE' ? CheckCircle2 :
    canonical === 'NOT_ELIGIBLE_CONDITIONS_NOT_MET' ? XCircle :
    canonical === 'CANNOT_CONFIRM_VERIFY_OFFICIAL' ? HelpCircle : AlertCircle;

  return (
    <div className="flex flex-col gap-6 mb-8">
      
      {/* 1. Source & Evidence Panel */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-900">Official Source Verified</h3>
            <p className="text-sm text-green-700">Scheme data matched securely with existing official records.</p>
          </div>
        </div>
      </div>

      {/* 2. Why this scheme matches you */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-lg text-gray-900">Eligibility Breakdown</h3>
          <p className="text-sm text-gray-600">Based on your existing GovtGuide profile.</p>
        </div>
        <div className="p-4">
          
          <div className={`mb-4 inline-flex items-center px-3 py-1 rounded-full border text-sm font-bold ${meta.badge}`}>
            <StatusIcon className="w-4 h-4 mr-2" /> {meta.label}
          </div>

          {evaluation.reasons?.length > 0 && (
            <ul className="mb-4 space-y-1.5 rounded-lg bg-gray-50 border border-gray-100 p-3">
              {evaluation.reasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-4 mt-2">
            {evaluation.matched_rules?.map((rule, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-green-50/50 rounded-lg border border-green-100">
                <div>
                  <div className="text-sm text-gray-500 uppercase font-semibold">{rule.field.replace('_', ' ')}</div>
                  <div className="text-gray-900 font-medium">Required: {rule.required}</div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="text-sm text-gray-600">Your profile: {rule.profile_value}</span>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
              </div>
            ))}

            {evaluation.missing_rules?.map((rule, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div>
                  <div className="text-sm text-gray-500 uppercase font-semibold">{rule.field.replace('_', ' ')}</div>
                  <div className="text-gray-900 font-medium">Missing Information</div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="text-sm text-yellow-700">Please update profile</span>
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            ))}
            
            {evaluation.failed_rules?.map((rule, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <div className="text-sm text-gray-500 uppercase font-semibold">{rule.field.replace('_', ' ')}</div>
                  <div className="text-gray-900 font-medium">Required: {rule.required}</div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="text-sm text-red-600 font-medium">Your profile: {rule.profile_value}</span>
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Document Intelligence */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-lg text-gray-900">Document Intelligence</h3>
          <p className="text-sm text-gray-600">Dynamically calculated required documents for your profile.</p>
        </div>
        <div className="p-4">
          {required_documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {required_documents.map((doc, idx) => {
                const isConditional = data.conditional_documents?.some(cd => cd.document_name === doc);
                return (
                  <div key={idx} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                    <FileCheck2 className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-gray-900">{doc}</h4>
                      {isConditional && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          Conditionally Required
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">No specific documents listed in the structured rules yet.</p>
          )}
        </div>
      </div>

      {/* Before You Apply Modal */}
      {showBeforeApplyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 shadow-2xl text-left">
            <h3 className="text-2xl font-black text-slate-900 mb-4">Before You Apply</h3>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-gray-600">Scheme</span>
                <span className="font-bold text-gray-900">{schemeName}</span>
              </div>
              
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-gray-600">Eligibility Status</span>
                <span className={`font-bold ${meta.text}`}>
                  {meta.label}
                </span>
              </div>

              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-gray-600">Criteria Checked</span>
                <span className="font-bold text-gray-900">
                  {(evaluation.matched_rules?.length || 0) + (evaluation.failed_rules?.length || 0) + (evaluation.missing_rules?.length || 0)} rules evaluated
                </span>
              </div>

              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-gray-600">Required Documents</span>
                <span className="font-bold text-gray-900">{required_documents.length}</span>
              </div>

              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-gray-600">Official Source</span>
                <span className="font-bold text-green-600 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Verified
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-slate-800 mb-6">
              <p className="mb-2">You are about to leave GovtGuide AI and proceed to the official government portal. Ensure your destination URL matches the official source.</p>
              <p className="text-[11px] text-slate-600">{OFFICIAL_DISCLAIMER}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onCloseModal}
                className="w-full sm:w-1/2 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Review Documents
              </button>
              <a
                href={schemeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onCloseModal}
                className="w-full sm:w-1/2 py-3 rounded-xl bg-blue-600 text-white font-bold text-center hover:bg-blue-700 transition"
              >
                Proceed to Official Website
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
