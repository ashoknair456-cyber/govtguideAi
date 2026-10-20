import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { normalizeStatus, LIKELY_ELIGIBLE, POTENTIALLY_ELIGIBLE_INFO_REQUIRED, NOT_ELIGIBLE_CONDITIONS_NOT_MET } from '../utils/eligibility';
import { Check, X, ArrowLeft, ArrowRight, Minus } from 'lucide-react';

const SchemeComparison = ({ schemeIds = [] }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scrollIndex, setScrollIndex] = useState(0);

  useEffect(() => {
    if (schemeIds.length > 0) {
      fetchComparison();
    }
  }, [schemeIds]);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/comparison/compare-with-eligibility', {
        method: 'POST',
        body: JSON.stringify({ scheme_ids: schemeIds })
      });
      setData(res);
    } catch (err) {
      setError('Failed to fetch comparison data');
    }
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center animate-pulse text-gray-500">Loading comparison...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!data || !data.comparison) return <div className="p-8 text-center text-gray-500">No data available for comparison. Select up to 4 schemes to compare.</div>;

  const comparison = data.comparison;
  const metrics = Object.keys(comparison);
  
  // Mobile horizontal scrolling logic
  const schemesCount = comparison["Scheme Name"]?.length || 0;
  
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
        <h2 className="text-xl font-bold">Scheme Comparison</h2>
        <span className="text-indigo-100 text-sm">Comparing {schemesCount} schemes</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-4 text-left border-b border-r bg-gray-50 font-bold text-gray-700 w-1/4 sticky left-0 z-10">Metric</th>
              {comparison["Scheme Name"]?.map((name, i) => (
                <th key={i} className="p-4 text-left border-b bg-gray-50 font-bold text-indigo-700 w-1/4 min-w-[250px]">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.filter(m => m !== "Scheme Name" && m !== "scheme_id").map((metric, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="p-4 border-b border-r bg-white font-semibold text-gray-700 sticky left-0 z-10 text-sm">
                  {metric}
                </td>
                {comparison[metric]?.map((val, i) => (
                  <td key={i} className="p-4 border-b text-sm text-gray-600 align-top">
                    {formatValue(val, metric)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Helper to format different types of comparison values
const formatValue = (val, metric) => {
  if (val === null || val === undefined || val === '') return <Minus className="text-gray-300 mx-auto" />;
  
  if (metric === "My Eligibility") {
    const s = normalizeStatus(val);
    if (s === LIKELY_ELIGIBLE) return <span className="text-green-600 font-bold flex items-center"><Check size={16} className="mr-1"/> Likely Eligible</span>;
    if (s === POTENTIALLY_ELIGIBLE_INFO_REQUIRED) return <span className="text-yellow-600 font-bold">Needs Info</span>;
    if (s === NOT_ELIGIBLE_CONDITIONS_NOT_MET) return <span className="text-red-600 font-bold flex items-center"><X size={16} className="mr-1"/> Conditions Not Met</span>;
    if (s === "CANNOT_CONFIRM_VERIFY_OFFICIAL") return <span className="text-slate-600 font-bold">Verify Official</span>;
  }
  
  if (Array.isArray(val)) {
    if (val.length === 0) return <Minus className="text-gray-300" />;
    return (
      <ul className="list-disc list-inside space-y-1">
        {val.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }
  
  if (typeof val === 'boolean') {
    return val ? <Check className="text-green-500" /> : <X className="text-red-500" />;
  }
  
  return val.toString();
};

export default SchemeComparison;
