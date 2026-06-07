'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Wallet, Trash2, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    title: '', amount: '', category: 'Miscellaneous', description: ''
  });

  const categories = ['Reagents', 'Salary', 'Rent', 'Electricity', 'Marketing', 'Maintenance', 'Miscellaneous'];

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();
      if (data.success) setExpenses(data.data);
    } catch (error) {
      console.error('Failed to fetch expenses', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, amount: Number(formData.amount) })
      });
      if (res.ok) {
        setIsAdding(false);
        setFormData({ title: '', amount: '', category: 'Miscellaneous', description: '' });
        fetchExpenses();
      }
    } catch (error) {
      console.error('Failed to create expense', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      fetchExpenses();
    } catch (error) {
      console.error('Failed to delete expense', error);
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Expense Management</h1>
          <p className="text-sm text-neutral-500">Track lab expenditures and operational costs</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          {isAdding ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Expense</>}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Total Expenses</p>
            <h3 className="text-2xl font-bold text-neutral-900 flex items-center">
              <IndianRupee className="w-5 h-5 mr-1" />
              {totalExpenses.toLocaleString('en-IN')}
            </h3>
          </div>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4">Record New Expense</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
              <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-2 border rounded-md" placeholder="e.g., Monthly Rent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Amount (₹)</label>
              <input required type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-2 border rounded-md" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2 border rounded-md">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Description (Optional)</label>
              <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 border rounded-md" />
            </div>
            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-md hover:bg-emerald-700">Save Expense</button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-neutral-50 text-neutral-500 text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Date</th>
              <th className="px-6 py-4 font-medium">Title</th>
              <th className="px-6 py-4 font-medium">Category</th>
              <th className="px-6 py-4 font-medium">Amount</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {loading ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-neutral-500">Loading expenses...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-neutral-500">No expenses recorded yet.</td></tr>
            ) : (
              expenses.map(exp => (
                <tr key={exp._id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm text-neutral-500">{format(new Date(exp.date), 'dd MMM yyyy')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-900">{exp.title}</td>
                  <td className="px-6 py-4 text-sm text-neutral-500">
                    <span className="px-2.5 py-1 bg-neutral-100 text-neutral-600 rounded-full text-xs font-medium">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-red-600 flex items-center">
                    <IndianRupee className="w-3 h-3 mr-0.5" />{exp.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(exp._id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
