import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { Activity, Plus, Edit2, Trash2, ExternalLink } from 'lucide-react';

const ApplicationTracker = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [appsRes, statusRes] = await Promise.all([
        apiFetch('/applications'),
        apiFetch('/applications/statuses')
      ]);
      setApplications(appsRes);
      setStatuses(statusRes.statuses || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const updateStatus = async (appId, newStatus) => {
    try {
      await apiFetch(`/applications/${appId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Approved' || status === 'Benefit Received') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'Rejected') return 'bg-red-100 text-red-800 border-red-200';
    if (status === 'Not Started') return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Loading tracker...</div>;

  return (
    <div className="bg-white rounded-xl shadow p-6 max-w-5xl mx-auto mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center text-gray-800">
          <Activity className="mr-3 text-indigo-600" /> My Applications
        </h2>
      </div>

      {applications.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500 mb-4">You aren't tracking any applications yet.</p>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center mx-auto">
            <Plus size={18} className="mr-2"/> Explore Schemes
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map(app => (
            <div key={app._id} className="border rounded-xl p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{app.scheme_name}</h3>
                  <p className="text-xs text-gray-500 mt-1">Started on {new Date(app.created_at).toLocaleDateString()}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(app.status)}`}>
                  {app.status}
                </div>
              </div>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                   <label className="text-xs font-semibold text-gray-500 mb-1 block">Update Status</label>
                   <select 
                      value={app.status} 
                      onChange={(e) => updateStatus(app._id, e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                   >
                      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                </div>
                <div className="flex-1">
                   <label className="text-xs font-semibold text-gray-500 mb-1 block">Reference No.</label>
                   <input type="text" placeholder="e.g. APP12345" defaultValue={app.reference_number || ''} className="w-full p-2 border rounded-lg text-sm" />
                </div>
              </div>

              {app.scheme && (
                <div className="border-t pt-3 flex justify-between items-center text-sm">
                  <a href={app.scheme.official_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold hover:underline flex items-center">
                    Official Portal <ExternalLink size={14} className="ml-1"/>
                  </a>
                  <button className="text-red-500 hover:text-red-700 flex items-center text-xs">
                    <Trash2 size={14} className="mr-1"/> Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApplicationTracker;
