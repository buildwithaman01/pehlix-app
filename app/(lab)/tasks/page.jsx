'use client';

import React, { useState, useEffect } from 'react';
import { Plus, CheckSquare, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    title: '', description: '', priority: 'medium', status: 'todo'
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.success) setTasks(data.data);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsAdding(false);
        setFormData({ title: '', description: '', priority: 'medium', status: 'todo' });
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to create task', error);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(`/api/tasks/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchTasks();
    } catch (error) {
      console.error('Failed to update task', error);
    }
  };

  const priorityColors = {
    low: 'bg-neutral-100 text-neutral-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Task Management</h1>
          <p className="text-sm text-neutral-500">Internal to-do lists and staff assignments</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          {isAdding ? 'Cancel' : <><Plus className="w-4 h-4" /> New Task</>}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Task Title</label>
              <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-2 border rounded-md" placeholder="e.g., Calibrate Sysmex Machine" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
              <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full p-2 border rounded-md capitalize">
                {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full p-2 border rounded-md capitalize">
                {['todo', 'in_progress', 'done'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Description (Optional)</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 border rounded-md" rows="2" />
            </div>
            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-md hover:bg-emerald-700">Save Task</button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban Board Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['todo', 'in_progress', 'done'].map(statusGroup => (
          <div key={statusGroup} className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
            <h3 className="font-semibold text-neutral-700 mb-4 flex items-center justify-between capitalize">
              {statusGroup.replace('_', ' ')}
              <span className="bg-white text-neutral-500 text-xs px-2 py-1 rounded-full border">
                {tasks.filter(t => t.status === statusGroup).length}
              </span>
            </h3>
            <div className="space-y-3">
              {tasks.filter(t => t.status === statusGroup).map(task => (
                <div key={task._id} className="bg-white p-4 rounded-lg border shadow-sm hover:shadow transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {format(new Date(task.createdAt), 'MMM dd')}
                    </span>
                  </div>
                  <h4 className="font-medium text-neutral-900 mb-1 leading-snug">{task.title}</h4>
                  {task.description && <p className="text-xs text-neutral-500 line-clamp-2 mb-3">{task.description}</p>}
                  
                  <div className="pt-3 border-t flex justify-between items-center">
                    <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      {task.createdBy?.firstName || 'Staff'}
                    </div>
                    <select 
                      value={task.status} 
                      onChange={(e) => updateStatus(task._id, e.target.value)}
                      className="text-xs border-0 bg-transparent text-neutral-500 cursor-pointer focus:ring-0"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.status === statusGroup).length === 0 && !loading && (
                <div className="text-center py-6 text-sm text-neutral-400 border-2 border-dashed rounded-lg">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
