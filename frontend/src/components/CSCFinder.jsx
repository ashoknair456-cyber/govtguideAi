import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { MapPin, Search, Phone, Mail, Clock, Filter, AlertCircle } from 'lucide-react';

const CSCFinder = () => {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ state: '', district: '', type: '' });
  const [filterOptions, setFilterOptions] = useState({ states: [], districts: [], types: [] });

  useEffect(() => {
    fetchCenters();
  }, [filters]);

  const fetchCenters = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.state) query.append('state', filters.state);
      if (filters.district) query.append('district', filters.district);
      if (filters.type) query.append('type', filters.type);

      const res = await apiFetch(`/csc/find?${query.toString()}`);
      setCenters(res.centers || []);
      setFilterOptions(res.filters || { states: [], districts: [], types: [] });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, ...(key === 'state' ? { district: '' } : {}) }));
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 max-w-6xl mx-auto mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center text-gray-800">
            <MapPin className="mr-3 text-indigo-600" /> CSC & Help Centre Locator
          </h2>
          <p className="text-gray-500 mt-1 text-sm">Find your nearest Common Service Centre or Government Office for application assistance.</p>
        </div>
        <div className="mt-4 md:mt-0 bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex items-center">
          <Phone className="text-indigo-600 mr-2" size={20} />
          <div>
            <div className="text-xs text-indigo-800 font-bold uppercase tracking-wider">CSC Toll Free Helpline</div>
            <div className="text-lg font-bold text-indigo-900">1800-3000-3468</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">State</label>
          <select 
            value={filters.state} 
            onChange={e => handleFilterChange('state', e.target.value)}
            className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">All States</option>
            {filterOptions.states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">District</label>
          <select 
            value={filters.district} 
            onChange={e => handleFilterChange('district', e.target.value)}
            disabled={!filters.state}
            className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
          >
            <option value="">All Districts</option>
            {filterOptions.districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Center Type</label>
          <select 
            value={filters.type} 
            onChange={e => handleFilterChange('type', e.target.value)}
            className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">All Types</option>
            {filterOptions.types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button 
          onClick={() => setFilters({ state: '', district: '', type: '' })}
          className="p-2.5 text-gray-500 hover:text-indigo-600 font-semibold text-sm transition"
        >
          Clear Filters
        </button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-gray-100 rounded-xl"></div>)}
        </div>
      ) : centers.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <AlertCircle className="mx-auto text-gray-400 mb-3" size={48} />
          <h3 className="text-lg font-bold text-gray-700">No centers found</h3>
          <p className="text-gray-500">Try adjusting your filters to see more results.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {centers.map(center => (
            <div key={center.id} className="border rounded-xl p-5 hover:shadow-lg transition bg-white flex flex-col h-full">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-800 text-lg leading-tight">{center.name}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${center.type === 'CSC' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                  {center.type}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 flex-1 space-y-2 mb-4">
                <p className="flex items-start"><MapPin size={16} className="mr-2 text-gray-400 flex-shrink-0 mt-0.5"/> {center.address}</p>
                <p className="flex items-center"><Phone size={16} className="mr-2 text-gray-400"/> {center.phone}</p>
                <p className="flex items-center"><Mail size={16} className="mr-2 text-gray-400"/> {center.email}</p>
                <p className="flex items-center"><Clock size={16} className="mr-2 text-gray-400"/> {center.timing}</p>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Services Offered</p>
                <div className="flex flex-wrap gap-1.5">
                  {center.services.slice(0, 4).map((srv, i) => (
                    <span key={i} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-1 rounded">{srv}</span>
                  ))}
                  {center.services.length > 4 && (
                     <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-1 rounded">+{center.services.length - 4} more</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CSCFinder;
