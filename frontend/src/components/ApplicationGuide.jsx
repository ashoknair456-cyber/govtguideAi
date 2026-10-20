import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { ArrowRight, FileText, CheckCircle, Clock, AlertTriangle, HelpCircle } from 'lucide-react';

const ApplicationGuide = ({ schemeId }) => {
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (schemeId) {
      apiFetch(`/guide/${schemeId}`)
        .then(data => {
          setGuide(data);
          setLoading(false);
        })
        .catch(err => {
          setError('Failed to load application guide.');
          setLoading(false);
        });
    }
  }, [schemeId]);

  if (loading) return <div className="p-4 text-center text-gray-500 animate-pulse">Generating guide...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!guide || !guide.guide) return null;

  const g = guide.guide;

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center">
          <ArrowRight className="mr-2 text-indigo-600" /> Step-by-Step Application Guide
        </h2>
        {guide.source === 'ai_generated' && (
           <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-semibold border border-indigo-200 shadow-sm flex items-center">
             ✨ AI Generated
           </span>
        )}
      </div>

      <div className="flex gap-4 mb-6 text-sm">
        <div className="bg-gray-50 p-3 rounded flex-1">
          <span className="text-gray-500 block text-xs">Estimated Time</span>
          <span className="font-semibold text-gray-800 flex items-center"><Clock size={14} className="mr-1"/> {g.estimated_time}</span>
        </div>
        <div className="bg-gray-50 p-3 rounded flex-1">
          <span className="text-gray-500 block text-xs">Difficulty</span>
          <span className="font-semibold text-gray-800">{g.difficulty_level}</span>
        </div>
        <div className="bg-gray-50 p-3 rounded flex-1">
           <span className="text-gray-500 block text-xs">Application Mode</span>
           <span className="font-semibold text-gray-800">{guide.application_mode}</span>
        </div>
      </div>

      <div className="space-y-6">
        {g.steps && g.steps.map((step, idx) => (
          <div key={idx} className="flex">
            <div className="flex flex-col items-center mr-4">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                {step.step_number}
              </div>
              {idx < g.steps.length - 1 && <div className="w-0.5 h-full bg-indigo-200 mt-2"></div>}
            </div>
            <div className="pb-6">
              <h3 className="text-lg font-semibold text-gray-800">{step.title}</h3>
              <p className="text-gray-600 mt-1">{step.description}</p>
              {step.tips && (
                <div className="mt-2 bg-yellow-50 text-yellow-800 text-sm p-2 rounded flex items-start">
                  <HelpCircle size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                  <span>{step.tips}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {g.important_notes && g.important_notes.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h4 className="font-bold text-red-600 flex items-center mb-2"><AlertTriangle size={18} className="mr-1"/> Important Notes</h4>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            {g.important_notes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {g.helpline && (
        <div className="mt-4 bg-indigo-50 p-3 rounded text-sm text-indigo-900 text-center font-semibold border border-indigo-100">
           Helpline: {g.helpline}
        </div>
      )}
      
      {guide.official_url && (
         <div className="mt-6 text-center">
            <a href={guide.official_url} target="_blank" rel="noopener noreferrer" className="inline-block bg-green-600 text-white font-bold py-3 px-8 rounded-lg shadow hover:bg-green-700 transition">
               Proceed to Official Website
            </a>
         </div>
      )}
    </div>
  );
};

export default ApplicationGuide;
