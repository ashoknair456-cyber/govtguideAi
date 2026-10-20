import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FileText, CheckCircle, XCircle, AlertTriangle, AlertCircle } from 'lucide-react';

const DocumentReadiness = ({ schemeId }) => {
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableDocs, setAvailableDocs] = useState([]);
  const [inputDoc, setInputDoc] = useState('');
  const [commonDocs, setCommonDocs] = useState([]);

  useEffect(() => {
    // Fetch common docs
    apiFetch('/documents/common-list').then(data => {
      if (data && data.documents) setCommonDocs(data.documents);
    });
  }, []);

  const checkReadiness = async (docs) => {
    setLoading(true);
    try {
      const res = await apiFetch('/documents/check-readiness', {
        method: 'POST',
        body: JSON.stringify({
          scheme_id: schemeId || null,
          available_documents: docs
        })
      });
      if (res && res.results) {
        setReadiness(schemeId ? res.results[0] : res);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAddDoc = (doc) => {
    const newDoc = doc || inputDoc.trim();
    if (newDoc && !availableDocs.includes(newDoc)) {
      const newDocs = [...availableDocs, newDoc];
      setAvailableDocs(newDocs);
      setInputDoc('');
      checkReadiness(newDocs);
    }
  };

  const handleRemoveDoc = (doc) => {
    const newDocs = availableDocs.filter(d => d !== doc);
    setAvailableDocs(newDocs);
    checkReadiness(newDocs);
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <FileText className="mr-2 text-indigo-600" /> Document Readiness Checker
      </h2>

      <div className="mb-6">
        <h3 className="font-semibold text-gray-700 mb-2">My Available Documents</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {availableDocs.map(doc => (
            <span key={doc} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm flex items-center">
              {doc}
              <button onClick={() => handleRemoveDoc(doc)} className="ml-2 text-indigo-600 hover:text-indigo-900">
                &times;
              </button>
            </span>
          ))}
          {availableDocs.length === 0 && <span className="text-sm text-gray-500">No documents added yet.</span>}
        </div>

        <div className="flex gap-2 mb-2">
          <input 
            type="text" 
            value={inputDoc}
            onChange={(e) => setInputDoc(e.target.value)}
            placeholder="E.g., Aadhaar Card, Income Certificate..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddDoc()}
          />
          <button 
            onClick={() => handleAddDoc()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Add
          </button>
        </div>
        
        {commonDocs.length > 0 && (
          <div className="mt-2 text-sm text-gray-500">
            Common: 
            <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
              {commonDocs.map(doc => (
                <button 
                  key={doc}
                  onClick={() => handleAddDoc(doc)}
                  disabled={availableDocs.includes(doc)}
                  className="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200 disabled:opacity-50"
                >
                  + {doc}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-500">Analyzing documents...</div>
      ) : readiness ? (
        <div className="border-t pt-4">
          {schemeId ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">Readiness: {readiness.readiness_percentage}%</h3>
                <div className="w-1/2 bg-gray-200 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full ${readiness.readiness_percentage === 100 ? 'bg-green-600' : readiness.readiness_percentage > 50 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${readiness.readiness_percentage}%` }}></div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 flex items-center text-sm mb-2"><CheckCircle size={16} className="mr-1"/> Ready ({readiness.ready_count})</h4>
                  <ul className="text-sm space-y-1">
                    {readiness.ready_documents.map(d => <li key={d} className="flex items-center"><CheckCircle size={14} className="text-green-500 mr-2"/> {d}</li>)}
                    {readiness.ready_documents.length === 0 && <li className="text-gray-400">None</li>}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-red-700 flex items-center text-sm mb-2"><AlertCircle size={16} className="mr-1"/> Missing ({readiness.missing_count})</h4>
                  <ul className="text-sm space-y-1">
                    {readiness.missing_documents.map(d => <li key={d} className="flex items-center"><XCircle size={14} className="text-red-500 mr-2"/> {d}</li>)}
                    {readiness.missing_documents.length === 0 && <li className="text-gray-400">None</li>}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
             <div>
                <h3 className="font-bold text-gray-800 mb-4">Overall Readiness: {readiness.overall_readiness_percentage}%</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {readiness.results.slice(0, 10).map(res => (
                    <div key={res.scheme_id} className="border p-3 rounded bg-gray-50">
                      <div className="flex justify-between">
                         <span className="font-semibold text-sm truncate">{res.scheme_name}</span>
                         <span className={`text-xs font-bold px-2 py-1 rounded ${res.readiness_percentage === 100 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{res.readiness_percentage}%</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Missing {res.missing_count} / {res.total_required} docs
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default DocumentReadiness;
