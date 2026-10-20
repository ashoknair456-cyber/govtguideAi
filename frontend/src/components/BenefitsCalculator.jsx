import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { IndianRupee, TrendingUp, PieChart, Info } from 'lucide-react';

const BenefitsCalculator = ({ schemeId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (schemeId) {
      apiFetch(`/benefits/${schemeId}`)
        .then(res => {
          setData(res);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [schemeId]);

  if (loading) return <div className="p-4 animate-pulse">Calculating benefits...</div>;
  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl shadow-sm border border-green-200 p-6">
      <h2 className="text-xl font-bold text-green-900 flex items-center mb-6">
        <IndianRupee className="mr-2 text-green-600" /> Estimated Benefits Calculator
      </h2>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100 text-center">
          <div className="text-sm text-gray-500 mb-1">Monthly Benefit</div>
          <div className="text-2xl font-bold text-green-600">
            {data.estimated_monthly_benefit > 0 ? `₹${data.estimated_monthly_benefit.toLocaleString()}` : '-'}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100 text-center">
          <div className="text-sm text-gray-500 mb-1">Annual Benefit</div>
          <div className="text-2xl font-bold text-green-700">
            {data.estimated_annual_benefit > 0 ? `₹${data.estimated_annual_benefit.toLocaleString()}` : '-'}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100 text-center">
          <div className="text-sm text-gray-500 mb-1">One-Time/Subsidy</div>
          <div className="text-2xl font-bold text-indigo-600">
            {data.estimated_one_time_benefit > 0 ? `₹${data.estimated_one_time_benefit.toLocaleString()}` : '-'}
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-lg shadow-sm mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center mb-2">
          <TrendingUp size={18} className="mr-2 text-blue-500"/> 5-Year Projection
        </h3>
        <p className="text-gray-600 text-sm mb-4">Total estimated value over 5 years (assuming continuous eligibility):</p>
        <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
          ₹{data.estimated_5_year_benefit.toLocaleString()}
        </div>
      </div>

      {data.personalized_notes && data.personalized_notes.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
          <h4 className="font-semibold text-blue-800 text-sm mb-2">Personalized Insights</h4>
          <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
            {data.personalized_notes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs text-gray-500 flex items-start bg-gray-50 p-3 rounded">
        <Info size={14} className="mr-2 flex-shrink-0 mt-0.5" />
        <p>{data.disclaimer}</p>
      </div>
    </div>
  );
};

export default BenefitsCalculator;
