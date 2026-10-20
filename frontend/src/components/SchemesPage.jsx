import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, Search, Tag, Filter, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { apiFetch } from '../utils/api';

const SORTS = [
  { value: 'relevance', label: 'Best match' },
  { value: 'recently_verified', label: 'Recently verified' },
  { value: 'deadline', label: 'Application deadline' },
  { value: 'benefit_type', label: 'Benefit type' },
  { value: 'government_level', label: 'Government level' },
  { value: 'category', label: 'Category' },
];

const LEVELS = ['All', 'Central', 'State', 'Union Territory', 'District'];

export default function SchemesPage({ setCurrentTab, setSelectedSchemeId, isHighContrast }) {
  const [schemes, setSchemes] = useState([]);
  const [states, setStates] = useState([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedState, setSelectedState] = useState('All');
  const [level, setLevel] = useState('All');
  const [sort, setSort] = useState('relevance');
  const [age, setAge] = useState('');
  const [income, setIncome] = useState('');
  const [gender, setGender] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce the free-text query so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Load the state / UT reference list once (spec section 3).
  useEffect(() => {
    apiFetch('/schemes/reference/states')
      .then((data) => setStates(data.states || []))
      .catch(() => setStates([]));
  }, []);

  // Server-side search across all filters (spec section 9).
  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('status', 'Active');
    params.set('sort', sort);
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (selectedCategory && selectedCategory !== 'All') params.set('category', selectedCategory);
    if (selectedState && selectedState !== 'All') params.set('state', selectedState);
    if (level && level !== 'All') params.set('government_level', level);
    if (age) params.set('age', age);
    if (income) params.set('income', income);
    if (gender) params.set('gender', gender);

    apiFetch(`/schemes?${params.toString()}`)
      .then((data) => {
        setSchemes(data);
        // Build the category list once from the unfiltered first load.
        setCategories((prev) => (prev.length ? prev : ['All', ...new Set(data.map((s) => s.category).filter(Boolean))]));
      })
      .catch(() => setError('Schemes are temporarily unavailable. Please make sure the backend is running.'))
      .finally(() => setLoading(false));
  }, [debouncedQuery, selectedCategory, selectedState, level, sort, age, income, gender]);

  const activeFilters = useMemo(() => {
    const list = [];
    if (selectedCategory && selectedCategory !== 'All') list.push({ label: `Category: ${selectedCategory}`, clear: () => setSelectedCategory('All') });
    if (selectedState && selectedState !== 'All') list.push({ label: `State/UT: ${selectedState}`, clear: () => setSelectedState('All') });
    if (level && level !== 'All') list.push({ label: `Level: ${level}`, clear: () => setLevel('All') });
    if (age) list.push({ label: `Age: ${age}`, clear: () => setAge('') });
    if (income) list.push({ label: `Income: ₹${income}`, clear: () => setIncome('') });
    if (gender) list.push({ label: `Gender: ${gender}`, clear: () => setGender('') });
    return list;
  }, [selectedCategory, selectedState, level, age, income, gender]);

  const clearAll = () => {
    setSelectedCategory('All'); setSelectedState('All'); setLevel('All');
    setAge(''); setIncome(''); setGender(''); setQuery('');
  };

  const controlClass = `rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition`;

  return (
    <section className={`min-h-[80vh] px-4 py-12 sm:px-6 lg:px-8 ${isHighContrast ? 'bg-black text-yellow-300' : 'bg-slate-50/50 text-slate-900'}`}>
      <div className="mx-auto max-w-7xl">

        {/* Header Title and Search Bar */}
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-3">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Public Welfare Repository</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Explore Government Schemes
            </h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-600">
              Search across national and state welfare initiatives, discover criteria, and verify application steps.
            </p>
          </div>

          <div className="flex w-full items-center gap-2 md:w-auto">
            {/* Search Box */}
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, category, or benefit..."
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-3 text-sm font-bold transition ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </div>

        {/* Filter controls (spec section 9) */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {/* State / UT selector */}
          <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className={controlClass} aria-label="State or Union Territory">
            <option value="All">All States / UTs</option>
            {states.length > 0 && (
              <>
                <optgroup label="States">
                  {states.filter((s) => s.type === 'State').map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                </optgroup>
                <optgroup label="Union Territories">
                  {states.filter((s) => s.type === 'Union Territory').map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                </optgroup>
              </>
            )}
          </select>

          {/* Government level */}
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={controlClass} aria-label="Government level">
            {LEVELS.map((l) => <option key={l} value={l}>{l === 'All' ? 'All Levels' : l}</option>)}
          </select>

          {/* Sort */}
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={controlClass} aria-label="Sort results">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Expanded demographic filters */}
        {showFilters && (
          <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              Age
              <input type="number" min="0" max="130" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 25" className={controlClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              Annual income (₹)
              <input type="number" min="0" step="1000" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 250000" className={controlClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              Gender
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={controlClass}>
                <option value="">Any</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <div className="flex items-end">
              <button onClick={clearAll} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                <X className="h-4 w-4" /> Reset
              </button>
            </div>
          </div>
        )}

        {/* Category Filter Pills */}
        {categories.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2 items-center">
            {activeFilters.map((f) => (
              <button key={f.label} onClick={f.clear} className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100">
                {f.label} <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        {/* Loading / Error States */}
        {loading && (
          <div className="py-20 text-center text-slate-500">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mb-3" />
            <p className="text-sm font-medium">Loading verified welfare schemes...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 max-w-xl mx-auto text-center">
            {error}
          </div>
        )}

        {!loading && !error && schemes.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center max-w-lg mx-auto shadow-sm">
            <p className="text-base font-bold text-slate-700">No schemes found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your keywords or filters.</p>
          </div>
        )}

        {/* Schemes Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {schemes.map((scheme) => (
            <article
              key={scheme._id}
              className="scheme-card flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm hover:border-blue-300"
            >
              <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-100 flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-blue-500" />
                    {scheme.category || "General"}
                  </span>
                  {scheme.government_level && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {scheme.government_level}{scheme.state ? ` · ${scheme.state}` : ''}
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-slate-900 leading-snug mb-2">
                  {scheme.name}
                </h2>

                <p className="line-clamp-3 text-xs sm:text-sm text-slate-600 leading-relaxed mb-4 text-left">
                  {scheme.description}
                </p>
              </div>

              <div>
                {scheme.benefits && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-800 mb-5 text-left flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{scheme.benefits}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => { setSelectedSchemeId(scheme._id); setCurrentTab('scheme'); }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
                  >
                    <span>View Details</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>

                  {(scheme.official_scheme_url || scheme.official_url) && (
                    <a
                      href={scheme.official_scheme_url || scheme.official_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      title="Open official portal"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
