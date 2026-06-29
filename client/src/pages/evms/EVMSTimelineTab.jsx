/**
 * EVMS Timeline Tab - Day-wise Timeline with Drag & Drop and Edit
 * Professional executive itinerary view grouped by days
 */
import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Trash2, Edit2, Save, X, GripVertical, Clock, Plus } from 'lucide-react';
import { evms } from '../../api/client';

const ACTIVITY_ICONS = {
  'Airport Pickup': '🚗', 'Airport Drop': '🚕', 'Hotel Check-in': '🏨', 'Hotel Check-out': '🏨',
  'Breakfast': '☕', 'Lunch': '🍽️', 'Dinner': '🍷', 'Tea Break': '☕', 'Coffee Break': '☕',
  'Office Transfer': '🚗', 'Travel': '✈️', 'Factory Visit': '🏭', 'Site Visit': '🏗️',
  'Plant Visit': '🏭', 'Campus Visit': '🏫', 'Customer Visit': '🤝', 'Vendor Visit': '🤝',
  'Registration': '📝', 'Networking': '👥', 'Training': '📚', 'Workshop': '🛠️',
  'Project Briefing': '📊', 'Photo Session': '📸', 'Media Interaction': '📰',
  'Evening Walk': '🚶', 'Shopping': '🛍️', 'CEO Discussion': '💼', 'Security Check': '🔒',
  'Executive Welcome': '🎉', 'Board Review': '📋', 'Rest at Hotel': '🛏️', 'Free Time': '🎯',
};

const inp = 'w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';

function formatTime(time) {
  if (!time) return '';
  try {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  } catch {
    return time;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function TimelineItem({ item, index, visitors, hosts, onEdit, onDelete, provided, isDragging }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(item);

  const getNames = (ids, list, nameKey) => {
    const parsed = typeof ids === 'string' ? JSON.parse(ids || '[]') : ids || [];
    return list.filter(x => parsed.includes(x.id)).map(x => x.short_name || x[nameKey]).join(', ') || '—';
  };

  const handleSave = async () => {
    try {
      if (item.type === 'meeting') {
        await evms.meetings.update(item.id, {
          meeting_title: form.meeting_title || form.notes || 'Meeting',
          meeting_date: form.meeting_date,
          start_time: form.start_time,
          end_time: form.end_time || '',
          location: '',
          notes: form.notes || '',
          visitor_ids: form.visitor_ids || [],
          host_ids: form.host_ids || [],
        });
      } else {
        await evms.activities.update(item.id, {
          activity_type: form.activity_type,
          activity_date: form.activity_date,
          start_time: form.start_time,
          end_time: form.end_time || '',
          location: '',
          description: form.description || '',
          visitor_ids: form.visitor_ids || [],
          host_ids: form.host_ids || [],
        });
      }
      onEdit();
      setEditing(false);
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    }
  };

  if (editing) {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
            <input
              type="time"
              className={inp}
              value={form.start_time || ''}
              onChange={e => setForm({ ...form, start_time: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
            <input
              type="time"
              className={inp}
              value={form.end_time || ''}
              onChange={e => setForm({ ...form, end_time: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              className={inp}
              value={item.type === 'meeting' ? form.meeting_date : form.activity_date}
              onChange={e => setForm({ 
                ...form, 
                [item.type === 'meeting' ? 'meeting_date' : 'activity_date']: e.target.value 
              })}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea
            className={`${inp} h-16 resize-none`}
            value={item.type === 'meeting' ? form.notes : form.description}
            onChange={e => setForm({ 
              ...form, 
              [item.type === 'meeting' ? 'notes' : 'description']: e.target.value 
            })}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-white flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-1"
          >
            <Save className="w-3 h-3" /> Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={`flex gap-3 items-start p-3 rounded-xl border transition-all ${
        isDragging 
          ? 'border-primary-400 bg-primary-50 shadow-lg' 
          : 'border-gray-100 bg-white hover:bg-gray-50'
      }`}
    >
      {/* Drag Handle */}
      <div {...provided.dragHandleProps} className="shrink-0 cursor-move text-gray-300 hover:text-gray-500 pt-1">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Time badge */}
      <div className="shrink-0 text-center bg-gray-50 rounded-lg px-2.5 py-1.5 min-w-[65px] border border-gray-100">
        <p className="text-[10px] font-bold text-primary-600 uppercase">
          {item.type === 'meeting' ? '🤝' : ACTIVITY_ICONS[item.activity_type] || '📌'}
        </p>
        <p className="text-xs font-semibold text-gray-700 tabular-nums">
          {formatTime(item.start_time)}
        </p>
        {item.end_time && (
          <p className="text-[10px] text-gray-400 tabular-nums">
            {formatTime(item.end_time)}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">
          {item.type === 'meeting' 
            ? (item.notes || item.meeting_title || 'Meeting')
            : item.activity_type
          }
        </p>
        {item.type === 'meeting' && item.meeting_title && item.notes && item.meeting_title !== item.notes && (
          <p className="text-xs text-gray-600 mt-0.5">{item.meeting_title}</p>
        )}
        {item.type === 'activity' && item.description && (
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{item.description}</p>
        )}
        <div className="flex gap-3 mt-1.5 text-[10px] text-gray-400">
          {getNames(item.visitor_ids, visitors, 'visitor_name') !== '—' && (
            <span>👤 {getNames(item.visitor_ids, visitors, 'visitor_name')}</span>
          )}
          {getNames(item.host_ids, hosts, 'host_name') !== '—' && (
            <span>🏢 {getNames(item.host_ids, hosts, 'host_name')}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition-colors"
          title="Edit"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(item)}
          className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function TimelineTab({ visitId, meetings, activities, visitors, hosts, visitStart, visitEnd, onRefresh }) {
  const [fixing, setFixing] = useState(false);

  // Merge and prepare timeline with original indices
  const allItems = [
    ...meetings.map(m => ({ 
      ...m, 
      type: 'meeting', 
      date: m.meeting_date,
      datetime: `${m.meeting_date} ${m.start_time || '00:00'}` 
    })),
    ...activities.map(a => ({ 
      ...a, 
      type: 'activity', 
      date: a.activity_date,
      datetime: `${a.activity_date || '9999-12-31'} ${a.start_time || '00:00'}` 
    })),
  ].sort((a, b) => a.datetime.localeCompare(b.datetime));

  // Group by date
  const groupedByDay = {};
  allItems.forEach(item => {
    const date = item.date || 'No Date';
    if (!groupedByDay[date]) groupedByDay[date] = [];
    groupedByDay[date].push(item);
  });

  // Convert to array and sort by date
  const days = Object.entries(groupedByDay).sort(([a], [b]) => a.localeCompare(b));

  // Check if date is outside the visit range
  const isOutOfRange = (date) => {
    if (!visitStart || !visitEnd || !date || date === 'No Date') return false;
    return date < visitStart || date > visitEnd;
  };

  // Move all items on a wrong date to the visit start date
  const fixDate = async (wrongDate) => {
    if (!visitStart) return alert('Visit start date not available');
    const targetDate = visitStart;
    const itemsToFix = groupedByDay[wrongDate] || [];
    if (!confirm(`Move all ${itemsToFix.length} item(s) from "${wrongDate}" to "${targetDate}"?`)) return;
    setFixing(true);
    try {
      for (const item of itemsToFix) {
        if (item.type === 'meeting') {
          await evms.meetings.update(item.id, { ...item, meeting_date: targetDate });
        } else {
          await evms.activities.update(item.id, { ...item, activity_date: targetDate });
        }
      }
      onRefresh();
    } catch (err) {
      alert(`Fix failed: ${err.message}`);
    } finally {
      setFixing(false);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete this ${item.type}?`)) return;
    try {
      if (item.type === 'meeting') {
        await evms.meetings.delete(item.id);
      } else {
        await evms.activities.delete(item.id);
      }
      onRefresh();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const sourceDate = result.source.droppableId;
    const destDate = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    // If same position, do nothing
    if (sourceDate === destDate && sourceIndex === destIndex) return;

    // Get the item being moved
    const movedItem = groupedByDay[sourceDate][sourceIndex];

    // Update backend with new time/date
    try {
      // If moving to different day, update the date
      if (sourceDate !== destDate && destDate !== 'No Date') {
        if (movedItem.type === 'meeting') {
          await evms.meetings.update(movedItem.id, {
            ...movedItem,
            meeting_date: destDate,
          });
        } else {
          await evms.activities.update(movedItem.id, {
            ...movedItem,
            activity_date: destDate,
          });
        }
      }
      
      // Refresh to show new order
      onRefresh();
    } catch (err) {
      alert(`Reorder failed: ${err.message}`);
    }
  };

  if (allItems.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400 mb-4">No timeline items yet</p>
        <button
          onClick={() => window.location.href = `/evms/timeline/new?visitId=${visitId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700"
        >
          <Plus className="w-3.5 h-3.5" /> Create Timeline
        </button>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {days.map(([date, items], dayIndex) => (
          <div key={date} className="space-y-3">
            {/* Day Header */}
            <div className={`sticky top-0 z-10 text-white px-4 py-2.5 rounded-xl shadow-sm ${
              isOutOfRange(date)
                ? 'bg-gradient-to-r from-orange-500 to-red-500'
                : 'bg-gradient-to-r from-primary-600 to-primary-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Day {dayIndex + 1}
                  </span>
                  <span className="text-sm font-semibold">
                    {date !== 'No Date' ? formatDate(date) : 'No Date'}
                  </span>
                  {isOutOfRange(date) && (
                    <>
                      <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-semibold">
                        ⚠️ Wrong date — outside visit range
                      </span>
                      <button
                        onClick={() => fixDate(date)}
                        disabled={fixing}
                        className="text-xs bg-white text-orange-600 font-bold px-3 py-0.5 rounded-full hover:bg-orange-50 transition-colors disabled:opacity-60"
                      >
                        {fixing ? 'Moving…' : `🔧 Move to ${visitStart}`}
                      </button>
                    </>
                  )}
                </div>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full shrink-0">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Timeline Items for this day */}
            <Droppable droppableId={date}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-2 min-h-[60px] rounded-xl p-2 transition-colors ${
                    snapshot.isDraggingOver ? 'bg-primary-50/50 border-2 border-dashed border-primary-300' : ''
                  }`}
                >
                  {items.map((item, index) => (
                    <Draggable 
                      key={`${item.type}-${item.id}`} 
                      draggableId={`${item.type}-${item.id}`} 
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <TimelineItem
                          item={item}
                          index={index}
                          visitors={visitors}
                          hosts={hosts}
                          onEdit={onRefresh}
                          onDelete={handleDelete}
                          provided={provided}
                          isDragging={snapshot.isDragging}
                        />
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
