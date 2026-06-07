'use client';

import React, { useState, useEffect } from 'react';
import { Send, Search, Building2, Clock, CheckCircle2, Truck } from 'lucide-react';
import { format } from 'date-fns';

export default function OutsourcedPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/outsourced');
      const data = await res.json();
      if (data.success) setOrders(data.data);
    } catch (error) {
      console.error('Failed to fetch outsourced orders', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(`/api/outsourced/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchOrders();
    } catch (error) {
      console.error('Failed to update order', error);
    }
  };

  const statusMap = {
    'pending_dispatch': { label: 'Pending Dispatch', color: 'bg-orange-100 text-orange-700' },
    'dispatched': { label: 'In Transit', color: 'bg-blue-100 text-blue-700' },
    'received_by_ref': { label: 'At Reference Lab', color: 'bg-purple-100 text-purple-700' },
    'result_ready': { label: 'Result Ready', color: 'bg-emerald-100 text-emerald-700' },
    'completed': { label: 'Completed', color: 'bg-neutral-100 text-neutral-700' }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Outsourced Tests (B2B)</h1>
          <p className="text-sm text-neutral-500">Track samples sent to reference laboratories</p>
        </div>
        <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
          <Send className="w-4 h-4" /> New Outsourced Order
        </button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-neutral-50 flex gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Search by patient name, tracking ID or test..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <select className="border rounded-lg px-4 py-2 text-sm text-neutral-700 outline-none">
            <option value="">All Statuses</option>
            <option value="pending_dispatch">Pending Dispatch</option>
            <option value="dispatched">In Transit</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        
        <table className="w-full text-left">
          <thead className="bg-neutral-50/50 text-neutral-500 text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Patient & Test</th>
              <th className="px-6 py-4 font-medium">Reference Lab</th>
              <th className="px-6 py-4 font-medium">Logistics</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {loading ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-neutral-500">Loading orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-neutral-500">No outsourced tests found.</td></tr>
            ) : (
              orders.map(order => (
                <tr key={order._id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-neutral-900">{order.patientId?.firstName} {order.patientId?.lastName}</p>
                    <p className="text-xs text-emerald-600 font-medium mt-0.5">{order.testId?.name || 'Unknown Test'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm font-medium text-neutral-700">
                      <Building2 className="w-4 h-4 mr-2 text-neutral-400" />
                      {order.referenceLabName}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {order.trackingId ? (
                        <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded text-neutral-600 self-start">
                          <Truck className="w-3 h-3 inline mr-1" /> {order.trackingId}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">No Tracking ID</span>
                      )}
                      <span className="text-[10px] text-neutral-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" /> ETA: {order.expectedReturnDate ? format(new Date(order.expectedReturnDate), 'dd MMM') : 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={order.status}
                      onChange={(e) => updateStatus(order._id, e.target.value)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full outline-none cursor-pointer border-r-8 border-transparent ${statusMap[order.status]?.color || 'bg-neutral-100'}`}
                    >
                      {Object.entries(statusMap).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View</button>
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
