/**
 * OrgChart.jsx — Manual Org Chart (Free-form drag & draw canvas)
 *
 * This page is PURELY manual:
 *   - No employee auto-loading
 *   - No hierarchy layout tabs
 *   - No Traditional Org Chart data
 *
 * Users create nodes, draw lines, and save manually.
 * Traditional Org Chart layouts (Hierarchy, Chain, Matrix, Network, Drill Down)
 * live exclusively in TraditionalOrgChart.jsx (/traditional-org-chart).
 */

import { useEffect, useState, useRef } from 'react';
import { Image, FileText, Loader2 } from 'lucide-react';
import api from '../api/client';
import { BackButton, PageHeader } from '../components/common';
import LineStylePanel from '../components/LineStylePanel';
import FreeformOrgChart from '../components/FreeformOrgChart';
import { DEFAULT_LINE_SETTINGS } from '../utils/chartLineStyles';
import { exportChartAsImage, exportChartAsPdf } from '../utils/orgChartExport';

export default function OrgChart() {
  const chartRef = useRef(null);
  const [lineSettings, setLineSettings] = useState(DEFAULT_LINE_SETTINGS);
  const [exporting, setExporting] = useState(null);
  const [chartTitle, setChartTitle] = useState('Manual Org Chart');
  const [chartTheme, setChartTheme] = useState('professional');
  const [orthogonalLines, setOrthogonalLines] = useState(true);

  // Load saved chart settings (title, theme, line style) — no employee data
  useEffect(() => {
    api.chartLayout.getSettings().then((s) => {
      if (s.title) setChartTitle(s.title);
      if (s.theme) setChartTheme(s.theme);
      if (s.orthogonalLines !== undefined) setOrthogonalLines(s.orthogonalLines);
      if (s.routingType) setLineSettings((prev) => ({ ...prev, routingType: s.routingType }));
    }).catch(console.error);
  }, []);

  const saveChartSettings = (overrides = {}) => {
    api.chartLayout.saveSettings({
      title: chartTitle,
      theme: chartTheme,
      orthogonalLines,
      routingType: lineSettings.routingType,
      ...overrides,
    }).catch(console.error);
  };

  const handleExport = async (format) => {
    if (!chartRef.current) {
      alert('Chart area not ready. Please try again.');
      return;
    }
    setExporting(format);
    try {
      await new Promise((r) => setTimeout(r, 150));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const base = `manual-org-chart`;
      if (format === 'png') {
        await exportChartAsImage(chartRef.current, `${base}.png`);
      } else {
        await exportChartAsPdf(chartRef.current, `${base}.pdf`);
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <BackButton to="/dashboard" label="Back to Dashboard" />

      <PageHeader
        title="Manual Org Chart"
        subtitle="Free-form canvas — create nodes, draw connections, arrange manually"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!exporting}
              onClick={() => handleExport('png')}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {exporting === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
              Export PNG
            </button>
            <button
              type="button"
              disabled={!!exporting}
              onClick={() => handleExport('pdf')}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Export PDF
            </button>
          </div>
        }
      />

      {/* Chart settings bar */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Chart title</label>
            <input
              type="text"
              value={chartTitle}
              onChange={(e) => setChartTitle(e.target.value)}
              onBlur={saveChartSettings}
              className="input-field text-lg font-bold text-primary-900"
              placeholder="Manual Org Chart"
            />
          </div>
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={chartTheme === 'professional'}
                onChange={(e) => {
                  setChartTheme(e.target.checked ? 'professional' : 'standard');
                  setTimeout(saveChartSettings, 0);
                }}
              />
              Professional dark boxes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={orthogonalLines}
                onChange={(e) => {
                  setOrthogonalLines(e.target.checked);
                  setTimeout(saveChartSettings, 0);
                }}
              />
              Orthogonal connectors
            </label>
          </div>
        </div>

        <LineStylePanel
          settings={lineSettings}
          onChange={(next) => {
            setLineSettings(next);
            if (next.routingType !== lineSettings.routingType) {
              saveChartSettings({ routingType: next.routingType });
            }
          }}
        />
      </div>

      {/* Canvas — always freeform, no layout switching */}
      <div className="card overflow-hidden">
        <div id="org-chart-export-area" ref={chartRef} className="p-4 bg-white">
          <h2 className="text-2xl font-bold text-primary-900 border-b-2 border-primary-600 pb-2 mb-6 inline-block">
            {chartTitle}
          </h2>
          <FreeformOrgChart
            globalLineSettings={lineSettings}
            theme={chartTheme}
            orthogonalLines={orthogonalLines}
            routingType={lineSettings.routingType}
          />
        </div>
      </div>
    </div>
  );
}
