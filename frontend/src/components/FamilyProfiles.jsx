import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { Users, UserPlus, Shield, Info, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

const FamilyProfiles = () => {
  const [members, setMembers] = useState([]);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '', relationship: 'Spouse', age: '', gender: 'Male', occupation: ''
  });
  const [relationships, setRelationships] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersRes, relsRes, eligRes] = await Promise.all([
        apiFetch('/family/members'),
        apiFetch('/family/relationships'),
        apiFetch('/family/eligibility')
      ]);
      setMembers(membersRes);
      if (relsRes.relationships) setRelationships(relsRes.relationships);
      setEligibilityData(eligRes);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/family/members', {
        method: 'POST',
        body: JSON.stringify({ ...newMember, age: parseInt(newMember.age) })
      });
      setShowAddForm(false);
      setNewMember({ name: '', relationship: 'Spouse', age: '', gender: 'Male', occupation: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this family member?")) return;
    try {
      await apiFetch(`/family/members/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Loading family data...</div>;

  return (
    <div className="bg-white rounded-xl shadow p-6 max-w-6xl mx-auto mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center text-gray-800">
            <Users className="mr-3 text-indigo-600" /> Family Eligibility Mode
          </h2>
          <p className="text-gray-500 mt-1">Manage family members to instantly check scheme eligibility for your entire household.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center"
        >
          <UserPlus size={18} className="mr-2" /> Add Member
        </button>
      </div>

      {showAddForm && (
        <div className="bg-indigo-50 p-6 rounded-xl mb-8 border border-indigo-100">
          <h3 className="font-bold text-indigo-900 mb-4">Add New Family Member</h3>
          <form onSubmit={handleAddSubmit} className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
              <input required type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Relationship</label>
              <select value={newMember.relationship} onChange={e => setNewMember({...newMember, relationship: e.target.value})} className="w-full p-2 border rounded-lg bg-white">
                {relationships.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Age</label>
              <input required type="number" value={newMember.age} onChange={e => setNewMember({...newMember, age: e.target.value})} className="w-full p-2 border rounded-lg" min="0" max="120" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Gender</label>
              <select value={newMember.gender} onChange={e => setNewMember({...newMember, gender: e.target.value})} className="w-full p-2 border rounded-lg bg-white">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Occupation</label>
              <input type="text" value={newMember.occupation} onChange={e => setNewMember({...newMember, occupation: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g. Student, Farmer" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full bg-green-600 text-white p-2 rounded-lg font-bold hover:bg-green-700">Save Member</button>
            </div>
          </form>
        </div>
      )}

      {eligibilityData && eligibilityData.family_results.length > 0 ? (
        <div className="space-y-6">
          {eligibilityData.family_results.map(res => (
            <div key={res.member.id} className="border rounded-xl p-5 hover:shadow-md transition">
              <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xl mr-4">
                    {res.member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{res.member.name}</h3>
                    <p className="text-sm text-gray-500">{res.member.relationship} • {res.member.age} yrs • {res.member.gender}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="text-center px-4 border-r">
                    <span className="block text-2xl font-bold text-green-600">{res.eligible_count}</span>
                    <span className="text-xs text-gray-500 uppercase font-bold">Eligible</span>
                  </div>
                  <div className="text-center px-4">
                    <span className="block text-2xl font-bold text-yellow-500">{res.possibly_eligible_count}</span>
                    <span className="text-xs text-gray-500 uppercase font-bold">Maybe</span>
                  </div>
                  <button onClick={() => handleDelete(res.member.id)} className="ml-4 text-red-500 hover:text-red-700 p-2"><Trash2 size={18}/></button>
                </div>
              </div>

              {res.eligible_schemes.length > 0 ? (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                    <CheckCircle size={16} className="text-green-500 mr-2"/> Recommended Schemes
                  </h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {res.eligible_schemes.slice(0, 4).map(scheme => (
                      <div key={scheme.scheme_id} className="bg-gray-50 p-3 rounded border text-sm flex justify-between items-center">
                        <span className="font-semibold text-gray-800 truncate pr-2">{scheme.scheme_name}</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold whitespace-nowrap">Apply Now</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No exact matches found based on current profile data.</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showAddForm && (
          <div className="text-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <Users className="mx-auto text-gray-400 mb-3" size={48} />
            <h3 className="text-lg font-bold text-gray-700">No Family Members Added</h3>
            <p className="text-gray-500 mb-4">Add your family members to discover schemes they are eligible for.</p>
            <button onClick={() => setShowAddForm(true)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold">
              Add First Member
            </button>
          </div>
        )
      )}
    </div>
  );
};

export default FamilyProfiles;
