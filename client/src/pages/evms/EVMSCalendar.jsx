import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, ArrowLeft } from 'lucide-react';
import { evms } from '../../api/client';

const STATUS_COLORS = {
  Planning:'bg-amber-400', Approved:'bg-blue-500',
  'In Progress':'bg-green-500', Completed:'bg-gray-400', Cancelled:'bg-red-400',
};
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Activity/Meeting colors for calendar
const TYPE_COLORS = {
  visit: STATUS_COLORS,
  meeting: 'bg-cyan-500',
  activity: 'bg-violet-500',
};

export default function EVMSCalendar() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [visits, setVisits] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [activities, setActivities] = useState([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Fetch all visits to determine earliest visit date
    evms.visits.list().then(async (allVisits) => {
      if (!initialized && allVisits.length > 0) {
        // Find earliest upcoming or current visit
        const sorted = allVisits.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
        const upcoming = sorted.find(v => v.start_date >= today.toISOString().slice(0, 10));
        const targetVisit = upcoming || sorted[sorted.length - 1]; // Use most recent if none upcoming
        
        if (targetVisit?.start_date) {
          const visitDate = new Date(targetVisit.start_date + 'T00:00:00');
          setYear(visitDate.getFullYear());
          setMonth(visitDate.getMonth() + 1);
        }
        setInitialized(true);
      }

      // Fetch visits for the month
      evms.calendar(year, month).then(setVisits).catch(console.error);
      
      const allMeetings = [];
      const allActivities = [];
      
      for (const visit of allVisits) {
        try {
          const fullVisit = await evms.visits.get(visit.id);
          if (fullVisit.meetings) {
            fullVisit.meetings.forEach(m => {
              allMeetings.push({ ...m, visit_id: visit.id, visit_name: visit.visit_name });
            });
          }
          if (fullVisit.activities) {
            fullVisit.activities.forEach(a => {
              allActivities.push({ ...a, visit_id: visit.id, visit_name: visit.visit_name });
            });
          }
        } catch (err) {
          console.error(`Failed to fetch visit ${visit.id}:`, err);
        }
      }
      
      setMeetings(allMeetings);
      setActivities(allActivities);
    }).catch(console.error);
  }, [year, month, initialized]);

  const prev = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); };
  const next = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); };

  const firstDay = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const getItemsForDay = (day) => {
    const d = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayVisits = visits.filter(v => v.start_date <= d && v.end_date >= d).map(v => ({ ...v, type: 'visit' }));
    const dayMeetings = meetings.filter(m => m.meeting_date === d).map(m => ({ ...m, type: 'meeting' }));
    const dayActivities = activities.filter(a => a.activity_date === d).map(a => ({ ...a, type: 'activity' }));
    return [...dayVisits, ...dayMeetings, ...dayActivities];
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth()+1 && d === today.getDate();

  const getItemColor = (item) => {
    if (item.type === 'visit') return STATUS_COLORS[item.status] || 'bg-gray-400';
    if (item.type === 'meeting') return 'bg-cyan-500';
    if (item.type === 'activity') return 'bg-violet-500';
    return 'bg-gray-400';
  };

  const getItemName = (item) => {
    if (item.type === 'visit') return item.visit_name;
    if (item.type === 'meeting') return `🤝 ${item.meeting_title}`;
    if (item.type === 'activity') return `📌 ${item.activity_type}`;
    return '';
  };

  const handleItemClick = (item) => {
    if (item.type === 'visit') {
      navigate(`/evms/visits/${item.id}`);
    } else if (item.type === 'meeting' || item.type === 'activity') {
      navigate(`/evms/visits/${item.visit_id}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Return to EVMS Dashboard Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/evms')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to EVMS Dashboard
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronLeft className="w-4 h-4"/></button>
          <span className="text-sm font-semibold text-gray-700 w-36 text-center">{MONTHS[month-1]} {year}</span>
          <button onClick={next} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronRight className="w-4 h-4"/></button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {DAYS.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayItems = day ? getItemsForDay(day) : [];
            return (
              <div key={i} className={`min-h-24 p-1.5 border-b border-r border-gray-100 ${!day?'bg-gray-50':''} ${isToday(day)?'bg-blue-50':''}`}>
                {day && (
                  <>
                    <span className={`text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full ${isToday(day)?'bg-primary-600 text-white':'text-gray-600'}`}>{day}</span>
                    <div className="mt-1 space-y-0.5">
                      {dayItems.slice(0,3).map((item, idx) => (
                        <button 
                          key={`${item.type}-${item.id}-${idx}`} 
                          onClick={() => handleItemClick(item)}
                          className={`w-full text-left text-[10px] font-medium text-white rounded px-1.5 py-0.5 truncate ${getItemColor(item)}`}
                        >
                          {getItemName(item)}
                        </button>
                      ))}
                      {dayItems.length > 3 && <span className="text-[10px] text-gray-400">+{dayItems.length-3} more</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-cyan-500"/>
          <span className="text-xs text-gray-500">Meeting</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-violet-500"/>
          <span className="text-xs text-gray-500">Activity</span>
        </div>
        {Object.entries(STATUS_COLORS).map(([s,c]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${c}`}/>
            <span className="text-xs text-gray-500">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
