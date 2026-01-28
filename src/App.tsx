import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useReactToPrint } from 'react-to-print';
import {
  Upload,
  Printer,
  Plus,
  Trash2,
  Download,
  GripVertical,
  Layout,
  Save,
  FolderOpen,
  ChevronDown,
  Type,
  X,
  Check,
  FileType
} from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';

// --- Types & Constants ---
interface CardData {
  id: string;
  chineseName: string;
  englishName: string;
  chineseCompany: string;
  englishCompany: string;
}

interface Preset {
  id: string;
  name: string;
  settings: {
    fontSize: any;
    offsets: any;
    fontFamilies: any;
    letterSpacings: any;
    enableTwoCharWidening: boolean; // New field
    globalSpacing: number;
    previewScale: number;
    // Layout Toggles
    showCropMarks?: boolean;
    showFoldLine?: boolean;
    cropOffset?: { x: number, y: number };
  }
}

interface CustomFont {
  name: string;
  fileName: string;
  url: string;
}

const DEFAULT_FONTS = [
  { label: '思源宋体 (中)', value: 'TableCardCN' },
  { label: 'Traditional Arabic (英)', value: 'TableCardEN' },
  { label: '系统默认', value: 'inherit' }
];

// --- API Helpers ---
const API_BASE = ''; // Relative path, handled by proxy or same-origin

const api = {
  getPresets: async (): Promise<Preset[]> => {
    const res = await fetch(`${API_BASE}/api/presets`);
    if (!res.ok) throw new Error('Failed to fetch presets');
    return res.json();
  },
  savePreset: async (preset: Preset) => {
    const res = await fetch(`${API_BASE}/api/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preset)
    });
    if (!res.ok) throw new Error('Failed to save preset');
    return res.json();
  },
  deletePreset: async (id: string) => {
    const res = await fetch(`${API_BASE}/api/presets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete preset');
    return res.json();
  },
  getFonts: async (): Promise<CustomFont[]> => {
    const res = await fetch(`${API_BASE}/api/fonts`);
    if (!res.ok) throw new Error('Failed to fetch fonts');
    return res.json();
  },
  uploadFont: async (file: File) => {
    const formData = new FormData();
    formData.append('fontFile', file);
    const res = await fetch(`${API_BASE}/api/fonts`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Failed to upload font');
    return res.json();
  },
  deleteFont: async (fileName: string) => {
    const res = await fetch(`${API_BASE}/api/fonts/${fileName}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete font');
    return res.json();
  }
};

// --- Helper Components ---
const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder = "请选择"
}: {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full bg-white border rounded-lg px-3 py-2 cursor-pointer transition-all active:scale-[0.98]",
          isOpen ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200 hover:border-slate-300"
        )}
      >
        <span className="text-sm font-bold text-slate-700 truncate mr-2">{selectedLabel}</span>
        <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden"
          >
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
              {options.map((option) => (
                <div
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors flex items-center justify-between",
                    value === option.value ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                  )}
                  style={{ fontFamily: option.value !== 'inherit' ? option.value : undefined }}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && <Check size={14} />}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


// --- Main Component ---
const App: React.FC = () => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [fontSize, setFontSize] = useState({
    chineseName: 120,
    englishName: 90,
    chineseCompany: 48,
    englishCompany: 36,
  });

  const [offsets, setOffsets] = useState({
    chineseName: 0,
    englishName: 0,
    chineseCompany: 0,
    englishCompany: 0,
  });

  const [fontFamilies, setFontFamilies] = useState({
    chineseName: 'TableCardCN',
    englishName: 'TableCardEN',
    chineseCompany: 'TableCardCN',
    englishCompany: 'TableCardEN',
  });

  const [letterSpacings, setLetterSpacings] = useState({
    chineseName: 0.1,
    englishName: 0.05,
    chineseCompany: 0,
    englishCompany: 0,
  });

  const [globalSpacing, setGlobalSpacing] = useState(21);
  const [printRotate, setPrintRotate] = useState(true);
  const [previewScale, setPreviewScale] = useState(0.75);
  const printRef = useRef<HTMLDivElement>(null);

  // Preset Management
  const [presets, setPresets] = useState<Preset[]>([]);
  const [currentPresetId, setCurrentPresetId] = useState<string>('');
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);

  // Font Management
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [isFontMgrOpen, setIsFontMgrOpen] = useState(false);
  const [isDragon, setIsDragon] = useState(false);
  const [enableTwoCharWidening, setEnableTwoCharWidening] = useState(true);
  const [showCropMarks, setShowCropMarks] = useState(true);
  const [showFoldLine, setShowFoldLine] = useState(false);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(event.target as Node)) {
        setIsPresetMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Load Presets from API
    api.getPresets()
      .then(data => setPresets(data))
      .catch(err => console.error("Failed to load presets:", err));

    // Load Fonts from API
    const loadFonts = async () => {
      try {
        const fontList = await api.getFonts();
        setCustomFonts(fontList);

        // Load fonts into the browser
        for (const fontData of fontList) {
          try {
            // Using URL construction for font loading
            const font = new FontFace(fontData.name, `url(${fontData.url})`);
            await font.load();
            document.fonts.add(font);
          } catch (err) {
            console.error(`Failed to load font ${fontData.name}:`, err);
          }
        }
      } catch (e) {
        console.error("Failed to initialize fonts", e);
      }
    };
    loadFonts();

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const savePreset = async () => {
    const name = window.prompt("请输入预设名称：", `预设 ${presets.length + 1}`);
    if (!name) return;

    const newPreset: Preset = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      settings: {
        fontSize,
        offsets,
        fontFamilies,
        letterSpacings,
        enableTwoCharWidening,
        globalSpacing,
        showCropMarks,
        showFoldLine,
        cropOffset,
        previewScale
      }
    };

    const existingIndex = presets.findIndex(p => p.name === name);
    if (existingIndex >= 0) {
      if (!window.confirm(`预设 "${name}" 已存在，要覆盖吗？`)) return;
      // We keep the ID of the existing one normally, but simpler to just overwrite
      newPreset.id = presets[existingIndex].id;
    }

    try {
      await api.savePreset(newPreset);
      setPresets(prev => {
        const idx = prev.findIndex(p => p.id === newPreset.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = newPreset;
          return updated;
        }
        return [...prev, newPreset];
      });
      setCurrentPresetId(newPreset.id);
      alert('预设保存成功！(已保存到服务器)');
    } catch (err) {
      alert('保存失败，请检查服务器连接。');
      console.error(err);
    }
  };

  const loadPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    setFontSize(preset.settings.fontSize);
    setOffsets(preset.settings.offsets);
    setFontFamilies(preset.settings.fontFamilies);
    setLetterSpacings(preset.settings.letterSpacings || {
      chineseName: 0.1,
      englishName: 0.05,
      chineseCompany: 0,
      englishCompany: 0,
    });
    setEnableTwoCharWidening(preset.settings.enableTwoCharWidening ?? true);
    setShowCropMarks(preset.settings.showCropMarks ?? true);
    setShowFoldLine(preset.settings.showFoldLine ?? false);
    setCropOffset(preset.settings.cropOffset || { x: 0, y: 0 });
    setGlobalSpacing(preset.settings.globalSpacing);
    setPreviewScale(preset.settings.previewScale || 0.75);
    setCurrentPresetId(presetId);
    setIsPresetMenuOpen(false);
  };

  const resetToDefault = () => {
    setFontSize({
      chineseName: 120,
      englishName: 90,
      chineseCompany: 48,
      englishCompany: 36,
    });
    setOffsets({
      chineseName: 0,
      englishName: 0,
      chineseCompany: 0,
      englishCompany: 0,
    });
    setFontFamilies({
      chineseName: 'TableCardCN',
      englishName: 'TableCardEN',
      chineseCompany: 'TableCardCN',
      englishCompany: 'TableCardEN',
    });
    setLetterSpacings({
      chineseName: 0.1,
      englishName: 0.05,
      chineseCompany: 0,
      englishCompany: 0,
    });
    setEnableTwoCharWidening(true);
    setShowCropMarks(true);
    setShowFoldLine(false);
    setCropOffset({ x: 0, y: 0 });
    setGlobalSpacing(21);
    setPreviewScale(0.75);
    setCurrentPresetId('');
    setIsPresetMenuOpen(false);
  };

  const deletePreset = async (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这个预设吗？')) return;

    try {
      await api.deletePreset(presetId);
      const updated = presets.filter(p => p.id !== presetId);
      setPresets(updated);
      if (currentPresetId === presetId) setCurrentPresetId('');
    } catch (err) {
      alert('删除失败');
      console.error(err);
    }
  };

  // Font Handlers
  const processFontFiles = async (files: File[]) => {
    for (const file of files) {
      try {
        const res = await api.uploadFont(file);
        if (res.success && res.font) {
          const fontData = res.font;

          // Helper to register font
          const font = new FontFace(fontData.name, `url(${fontData.url})`);
          await font.load();
          document.fonts.add(font);

          setCustomFonts(prev => {
            const existing = prev.filter(f => f.name !== fontData.name);
            return [...existing, fontData];
          });
        }
      } catch (err) {
        console.error(err);
        alert(`字体 ${file.name} 上传失败。`);
      }
    }
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await processFontFiles(Array.from(e.target.files));
    e.target.value = ''; // reset
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragon(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFontFiles(Array.from(e.dataTransfer.files));
    }
  };

  const deleteCustomFont = async (fileName: string, fontName: string) => {
    if (!window.confirm(`确定要删除字体 "${fontName}" 吗？`)) return;
    try {
      await api.deleteFont(fileName);
      setCustomFonts(prev => prev.filter(f => f.fileName !== fileName));
    } catch (err) {
      console.error(err);
      alert('删除字体失败');
    }
  };

  const downloadCustomFont = (font: CustomFont) => {
    const a = document.createElement('a');
    a.href = font.url;
    a.download = font.fileName;
    a.click();
  };

  const currentFontOptions = [
    ...DEFAULT_FONTS,
    ...customFonts.map(f => ({ label: f.name, value: f.name }))
  ];

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Zhuoka_${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}_${new Date().getHours().toString().padStart(2, '0')}${new Date().getMinutes().toString().padStart(2, '0')}`,
  });

  const downloadTemplate = () => {
    const templateData = [
      { '中文名': '示例姓名', '英文名': 'SAMPLE NAME', '中文公司': '示例单位名称', '英文公司': 'Sample Organization Name' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板");
    XLSX.writeFile(wb, "桌卡导入模板.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const mappedData: CardData[] = data.map((item) => ({
        id: Math.random().toString(36).substr(2, 9),
        chineseName: String(item['中文名'] || item['Name'] || item['姓名'] || ''),
        englishName: String(item['英文名'] || item['English Name'] || item['拼音'] || ''),
        chineseCompany: String(item['中文公司'] || item['Company'] || item['单位'] || ''),
        englishCompany: String(item['英文公司'] || item['English Company'] || ''),
      }));

      setCards([...cards, ...mappedData]);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const addEmptyCard = () => {
    const newCard = {
      id: Math.random().toString(36).substr(2, 9),
      chineseName: '姓名',
      englishName: 'Name',
      chineseCompany: '所在单位/部门',
      englishCompany: 'Organization Name',
    };
    setCards([newCard, ...cards]);
  };

  const updateCard = (id: string, field: keyof CardData, value: string) => {
    setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCard = (id: string) => {
    setCards(cards.filter(c => c.id !== id));
  };

  const clearAll = () => {
    if (window.confirm('确定要清除所有桌卡吗？')) {
      setCards([]);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* CSS Override for Perfect Print Alignment */}
      <style>{`
        @media print {
            @page {
                size: A3 portrait;
                margin: 0;
            }
            html, body {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                overflow: visible; /* Allow content to spill if needed */
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .print-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                /* Removed transform: none to allow rotation */
            }

            /* 
               AUTO-SCALE FIX: 
               If NOT rotated, the card (357mm) exceeds A3 width (297mm).
               We must scale it down to ~83% (297/357) so crop marks are visible.
            */
            .print-container:not(.print-rotate-mode) .card-container {
                transform: scale(0.83) !important;
                transform-origin: center center !important;
            }

            .preview-card-wrapper {
                position: relative;
                width: 100% !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                page-break-after: always;
                page-break-inside: avoid;
                
                /* Center content */
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                /* Removed transform: none to allow rotation */
            }

            /* The actual content box */
            .print-page {
                width: 297mm !important; /* Exact A3 width */
                height: 420mm !important; /* Exact A3 height */
                box-shadow: none !important;
                border-radius: 0 !important;
                margin: 0 !important;
                overflow: visible !important; /* Don't clip crop marks */
                flex-shrink: 0;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .no-print { display: none !important; }
        }
        `}</style>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shrink-0 px-6 py-3 flex items-center justify-between shadow-sm z-50 no-print">
        <div className="flex items-center gap-3">
          <div className="bg-brand-600 p-2 rounded-xl text-white shadow-lg shadow-brand-200">
            <Layout size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">桌卡生成器</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">v3.3 • Server Edition</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Font Manager Button */}
          <button
            onClick={() => setIsFontMgrOpen(true)}
            className="flex items-center gap-2 text-slate-500 hover:text-brand-600 hover:bg-slate-50 px-3 py-2 rounded-xl text-sm font-bold transition-all border border-transparent hover:border-slate-100 mr-2"
          >
            <Type size={16} />
            <span>字体管理</span>
          </button>

          {/* Font Manager Modal */}
          <AnimatePresence>
            {isFontMgrOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
                >
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Type size={18} className="text-brand-500" />
                      字体库管理
                    </h3>
                    <button onClick={() => setIsFontMgrOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {customFonts.length === 0 ? (
                      <div
                        className={cn(
                          "text-center py-10 text-slate-400 border-2 border-dashed rounded-xl transition-all cursor-pointer",
                          isDragon ? "border-brand-500 bg-brand-50 text-brand-600 scale-[0.99]" : "border-slate-100 hover:border-brand-200 hover:bg-slate-50"
                        )}
                        onDragOver={(e) => { e.preventDefault(); setIsDragon(true); }}
                        onDragLeave={() => setIsDragon(false)}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('font-upload-input')?.click()}
                      >
                        <FileType size={48} className={cn("mx-auto mb-3 transition-opacity", isDragon ? "opacity-100" : "opacity-20")} />
                        <p className="text-sm font-bold">{isDragon ? '松开鼠标以上传' : '点击或拖拽字体文件到这里'}</p>
                        <p className="text-xs mt-1 opacity-70">支持 TTF / OTF / WOFF</p>
                        <input
                          id="font-upload-input"
                          type="file"
                          multiple
                          accept=".ttf,.otf,.woff,.woff2"
                          className="hidden"
                          onChange={handleFontUpload}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customFonts.map(font => (
                          <div key={font.fileName} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-lg font-bold text-slate-700 select-none">
                                Aa
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 text-sm">{font.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{font.fileName}</div>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => downloadCustomFont(font)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 ml-auto" title="下载">
                                <Download size={14} />
                              </button>
                              <button onClick={() => deleteCustomFont(font.fileName, font.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200" title="删除">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <label className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-brand-200 shadow-lg cursor-pointer flex items-center gap-2 active:scale-95 transition-all">
                      <Upload size={16} />
                      上传字体 (支持批量)
                      <input type="file" multiple accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} />
                    </label>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Preset Controls */}
          <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-4 relative" ref={presetMenuRef}>
            <button
              onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
              className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-2 border border-slate-200 transition-all font-bold text-sm text-slate-700 active:scale-95"
            >
              <FolderOpen size={16} className="text-brand-600" />
              <span className="max-w-[100px] truncate">
                {presets.find(p => p.id === currentPresetId)?.name || '选择预设'}
              </span>
              <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isPresetMenuOpen && "rotate-180")} />
            </button>

            <button
              onClick={savePreset}
              className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all border border-transparent hover:border-brand-100"
              title="保存当前配置为预设"
            >
              <Save size={18} />
            </button>

            {/* Preset Dropdown Menu */}
            <AnimatePresence>
              {isPresetMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-[60] overflow-hidden"
                >
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-1">
                    {/* Default Option */}
                    <div
                      onClick={resetToDefault}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all hover:bg-slate-50 text-slate-700 mb-1 border-b border-slate-50",
                        currentPresetId === '' && "bg-slate-50 font-bold"
                      )}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                      <span className="text-sm">恢复默认配置</span>
                    </div>

                    {presets.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-sm font-medium">
                        暂无保存的预设
                      </div>
                    ) : (
                      presets.map(p => (
                        <div
                          key={p.id}
                          onClick={() => loadPreset(p.id)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all group",
                            currentPresetId === p.id ? "bg-brand-50 text-brand-700" : "hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <span className="font-bold text-sm truncate flex-1">{p.name}</span>
                          <button
                            onClick={(e) => deletePreset(p.id, e)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="删除预设"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>


          {/* Portrait Mode Toggle - Moved to Top Nav */}
          <div className="flex items-center gap-2 border-r border-slate-200 pr-4 mr-2">
            <span className="text-xs font-bold text-slate-500">纵向</span>
            <button
              onClick={() => setPrintRotate(!printRotate)}
              className={cn("w-8 h-4 rounded-full transition-all relative shrink-0", printRotate ? "bg-brand-600" : "bg-slate-200")}
            >
              <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm", printRotate ? "left-4.5" : "left-0.5")} />
            </button>
          </div>

          {/* Preview Scale Control - Moved to Top Nav */}
          <div className="flex items-center gap-2 border-r border-slate-200 pr-4 mr-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">缩放 {Math.round(previewScale * 100)}%</span>
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              value={previewScale * 100}
              onChange={(e) => setPreviewScale(parseInt(e.target.value) / 100)}
              className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
            />
          </div>

          <button onClick={clearAll} className="text-slate-400 hover:text-red-500 px-3 py-2.5 rounded-xl text-sm font-bold transition-all">清空</button>
          <div className="h-6 w-px bg-slate-100 mx-2"></div>
          <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-bold transition-all border border-slate-200">
            <Download size={16} />
            模板下载
          </button>
          <label className="bg-white hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 transition-all font-bold text-sm border border-slate-200 active:scale-95 shadow-sm">
            <Upload size={16} />
            导入数据
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
          </label>
          <button onClick={addEmptyCard} className="bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all font-bold text-sm shadow-sm active:scale-95">
            <Plus size={18} />
            添加记录
          </button>
          <button onClick={() => handlePrint()} disabled={cards.length === 0} className="ml-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-brand-100 font-bold text-sm active:scale-95">
            <Printer size={16} />
            预览打印 (A3)
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Controls - Fixed */}
        <aside className="w-80 bg-white border-r border-slate-200 overflow-y-auto p-6 flex flex-col gap-8 no-print shrink-0 z-40">
          <section className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-brand-500 rounded-full"></div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">排版参数 (PT)</h3>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl space-y-4">
                  {/* 1. 2-Char Widening */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-700">二字名自动加宽</span>
                      <span className="text-[10px] text-slate-400">两字名对齐三字宽度</span>
                    </div>
                    <button
                      onClick={() => setEnableTwoCharWidening(!enableTwoCharWidening)}
                      className={cn("w-10 h-5 rounded-full transition-all relative shrink-0", enableTwoCharWidening ? "bg-brand-600" : "bg-slate-200")}
                    >
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm", enableTwoCharWidening ? "left-5.5" : "left-0.5")} />
                    </button>
                  </div>

                  {/* 2. Fold Line */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-2">
                    <span className="text-xs font-black text-slate-700">显示中折线</span>
                    <button
                      onClick={() => setShowFoldLine(!showFoldLine)}
                      className={cn("w-10 h-5 rounded-full transition-all relative shrink-0", showFoldLine ? "bg-brand-600" : "bg-slate-200")}
                    >
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm", showFoldLine ? "left-5.5" : "left-0.5")} />
                    </button>
                  </div>

                  {/* 3. Crop Marks */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-2">
                    <span className="text-xs font-black text-slate-700">显示裁剪标记</span>
                    <button
                      onClick={() => setShowCropMarks(!showCropMarks)}
                      className={cn("w-10 h-5 rounded-full transition-all relative shrink-0", showCropMarks ? "bg-brand-600" : "bg-slate-200")}
                    >
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm", showCropMarks ? "left-5.5" : "left-0.5")} />
                    </button>
                  </div>
                  {showCropMarks && (
                    <div className="bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200 mt-2 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                        <span>裁剪线偏移 (mm)</span>
                        <span className="text-brand-600 font-mono">
                          {cropOffset.x} / {cropOffset.y}
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="宽"
                          value={cropOffset.x}
                          onChange={(e) => setCropOffset(prev => ({ ...prev, x: parseInt(e.target.value) || 0 }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold"
                        />
                        <input
                          type="number"
                          placeholder="高"
                          value={cropOffset.y}
                          onChange={(e) => setCropOffset(prev => ({ ...prev, y: parseInt(e.target.value) || 0 }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Font Selection */}
                <div className="bg-slate-50 p-4 rounded-2xl space-y-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">列字体指定</h4>
                  {[
                    { key: 'chineseName', label: '主姓名列' },
                    { key: 'englishName', label: '次姓名列' },
                    { key: 'chineseCompany', label: '机构列' },
                    { key: 'englishCompany', label: '描述列' }
                  ].map((item) => (
                    <div key={item.key} className="space-y-1">
                      <span className="text-xs text-slate-400 font-bold">{item.label}</span>
                      <CustomSelect
                        value={fontFamilies[item.key as keyof typeof fontFamilies]}
                        onChange={(val) => setFontFamilies({ ...fontFamilies, [item.key]: val })}
                        options={currentFontOptions}
                      />
                    </div>
                  ))}
                </div>

                {/* 5. Size fine-tuning (Size & Position) */}
                <div className="bg-slate-50 p-4 rounded-2xl space-y-6">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                    位置精调 (Offset) <span className="text-slate-300">/</span> 文字大小
                  </h4>

                  {/* Font Sizes */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-400">文字大小 (PT)</p>
                    {[
                      { label: '主姓名 / 次姓名', keys: ['chineseName', 'englishName'] },
                      { label: '机构名称 / 次要描述', keys: ['chineseCompany', 'englishCompany'] }
                    ].map((group, idx) => (
                      <div key={idx} className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase flex justify-between">
                          <span>{group.label}</span>
                          <span className="text-brand-600 font-mono">
                            {fontSize[group.keys[0] as keyof typeof fontSize]} / {fontSize[group.keys[1] as keyof typeof fontSize]}
                          </span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" value={fontSize[group.keys[0] as keyof typeof fontSize]} onChange={(e) => setFontSize({ ...fontSize, [group.keys[0]]: parseInt(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold" />
                          <input type="number" value={fontSize[group.keys[1] as keyof typeof fontSize]} onChange={(e) => setFontSize({ ...fontSize, [group.keys[1]]: parseInt(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="h-px bg-slate-200" />

                  {/* Offsets */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-400">位置偏移 (PT)</p>
                    {[
                      { label: '主姓名 / 次姓名', keys: ['chineseName', 'englishName'] },
                      { label: '机构名称 / 次要描述', keys: ['chineseCompany', 'englishCompany'] }
                    ].map((group, idx) => (
                      <div key={idx} className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase flex justify-between">
                          <span>{group.label}</span>
                          <span className="text-brand-600 font-mono">
                            {offsets[group.keys[0] as keyof typeof offsets]} / {offsets[group.keys[1] as keyof typeof offsets]}
                          </span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={offsets[group.keys[0] as keyof typeof offsets]}
                            onChange={(e) => setOffsets({ ...offsets, [group.keys[0]]: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold"
                          />
                          <input
                            type="number"
                            value={offsets[group.keys[1] as keyof typeof offsets]}
                            onChange={(e) => setOffsets({ ...offsets, [group.keys[1]]: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Basic Line Spacing */}
                <div className="bg-slate-50 p-4 rounded-2xl space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-black text-slate-400 uppercase">
                      <span>基础行间距</span>
                      <span className="text-brand-600 font-mono">{globalSpacing}pt</span>
                    </div>
                    <input
                      type="number"
                      value={globalSpacing}
                      onChange={(e) => setGlobalSpacing(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold"
                    />
                  </div>
                </div>

                {/* 7. Tracking */}
                <div className="bg-slate-50 p-4 rounded-2xl space-y-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">字宽 / 字间距 (Tracking)</h4>
                  {[
                    { label: '主姓名 / 次姓名', keys: ['chineseName', 'englishName'] },
                    { label: '机构名称 / 次要描述', keys: ['chineseCompany', 'englishCompany'] }
                  ].map((group, idx) => (
                    <div key={idx} className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase flex justify-between">
                        <span>{group.label}</span>
                        <span className="text-brand-600 font-mono">
                          {letterSpacings[group.keys[0] as keyof typeof letterSpacings].toFixed(2)} / {letterSpacings[group.keys[1] as keyof typeof letterSpacings].toFixed(2)}
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={letterSpacings[group.keys[0] as keyof typeof letterSpacings]}
                          onChange={(e) => setLetterSpacings({ ...letterSpacings, [group.keys[0]]: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={letterSpacings[group.keys[1] as keyof typeof letterSpacings]}
                          onChange={(e) => setLetterSpacings({ ...letterSpacings, [group.keys[1]]: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold"
                        />
                      </div>
                    </div>
                  ))}
                </div>




              </div>
            </div>
          </section>
        </aside>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 scroll-smooth custom-scrollbar relative">

          {/* List Editor */}
          {cards.length > 0 && (
            <section className="no-print w-full bg-white border-b border-slate-200 shadow-sm shrink-0">
              <div className="max-w-6xl mx-auto px-6 py-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-3 bg-brand-500 rounded-full"></div>
                  <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                    编辑名单 ({cards.length})
                  </h2>
                </div>

                <div className="max-h-[260px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  <Reorder.Group axis="y" values={cards} onReorder={setCards} className="space-y-2">
                    {cards.map((card) => (
                      <Reorder.Item key={card.id} value={card} className="bg-slate-50 rounded-xl border border-slate-100 p-1 flex items-center group">
                        <div className="px-2 cursor-grab text-slate-300"><GripVertical size={14} /></div>
                        <div className="flex-1 grid grid-cols-4 gap-2">
                          <input value={card.chineseName} onChange={(e) => updateCard(card.id, 'chineseName', e.target.value)} className="bg-transparent px-3 py-1.5 text-sm font-bold outline-none focus:bg-white rounded-lg transition-colors" placeholder="姓名" />
                          <input value={card.englishName} onChange={(e) => updateCard(card.id, 'englishName', e.target.value)} className="bg-transparent px-3 py-1.5 text-sm outline-none focus:bg-white rounded-lg transition-colors" placeholder="NAME" />
                          <input value={card.chineseCompany} onChange={(e) => updateCard(card.id, 'chineseCompany', e.target.value)} className="bg-transparent px-3 py-1.5 text-xs outline-none focus:bg-white rounded-lg transition-colors" placeholder="机构" />
                          <input value={card.englishCompany} onChange={(e) => updateCard(card.id, 'englishCompany', e.target.value)} className="bg-transparent px-3 py-1.5 text-xs outline-none focus:bg-white rounded-lg transition-colors" placeholder="描述" />
                        </div>
                        <button onClick={() => removeCard(card.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>
              </div>
            </section>
          )}

          {/* A3 Preview Section */}
          <section className="flex-1 py-12 px-12 flex flex-col items-center">
            {cards.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                <div className="bg-white p-10 rounded-[32px] shadow-2xl shadow-slate-200 border border-slate-100 max-w-3xl w-full">
                  <div className="flex flex-col items-center mb-8">
                    <div className="bg-brand-50 p-4 rounded-full mb-4 ring-8 ring-brand-50/50">
                      <Layout size={40} className="text-brand-600" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">准备开始制作</h3>
                    <p className="text-slate-500 font-medium mt-2">请从顶部导入 Excel 名单，或手动添加记录</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left bg-slate-50 p-8 rounded-2xl mb-8 border border-slate-100/50">
                    <div className="space-y-4">
                      <h4 className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-md flex items-center justify-center text-[10px]">1</span>
                        打印设置建议
                      </h4>
                      <ul className="space-y-3 text-xs text-slate-600 leading-6 font-medium">
                        <li className="relative pl-3.5">
                          <div className="absolute left-0 top-[0.6rem] w-1.5 h-1.5 bg-brand-500 rounded-full"></div>
                          <span>目标打印机：<span className="inline-block text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 align-baseline leading-none">Adobe PDF</span> 或实体打印机</span>
                        </li>
                        <li className="relative pl-3.5">
                          <div className="absolute left-0 top-[0.6rem] w-1.5 h-1.5 bg-brand-500 rounded-full"></div>
                          <span>纸张尺寸：务必设为 <span className="inline-block text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 align-baseline leading-none">A3</span></span>
                        </li>
                        <li className="relative pl-3.5">
                          <div className="absolute left-0 top-[0.6rem] w-1.5 h-1.5 bg-brand-500 rounded-full"></div>
                          <span>缩放比例：务必设为 <span className="inline-block text-red-500 font-bold bg-white px-1.5 py-0.5 rounded border border-red-100 align-baseline leading-none">100% (默认)</span></span>
                        </li>
                        <li className="relative pl-3.5">
                          <div className="absolute left-0 top-[0.6rem] w-1.5 h-1.5 bg-brand-500 rounded-full"></div>
                          <span>边距选项：选择 <span className="inline-block text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 align-baseline leading-none">无 / 最小值</span></span>
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <h4 className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                        <span className="w-5 h-5 bg-orange-500 text-white rounded-md flex items-center justify-center text-[10px]">2</span>
                        用纸与排版
                      </h4>
                      <ul className="space-y-3 text-xs text-slate-600 leading-6 font-medium">
                        <li className="relative pl-3.5">
                          <div className="absolute left-0 top-[0.6rem] w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                          <span>推荐纸张：200g-250g 铜版纸效果最佳</span>
                        </li>
                        <li className="relative pl-3.5">
                          <div className="absolute left-0 top-[0.6rem] w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                          <span>旋转模式：左侧侧边栏已默认开启 <span className="inline-block text-slate-900 font-bold border-b-2 border-slate-200 px-0.5/ leading-none">纵向模式</span> 以适配大多数打印机驱动</span>
                        </li>
                        <li className="relative pl-3.5">
                          <div className="absolute left-0 top-[0.6rem] w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                          <span>双面打印：如需双面，请设为 <span className="inline-block text-slate-900 font-bold border-b-2 border-slate-200 px-0.5 leading-none">短边翻转</span></span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3">
                    <button onClick={downloadTemplate} className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center gap-2 active:scale-95">
                      <Download size={16} />
                      下载导入模板
                    </button>
                    <button onClick={addEmptyCard} className="px-8 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs transition-all shadow-lg flex items-center gap-2 active:scale-95 hover:shadow-xl">
                      <Plus size={16} />
                      手动添加一条
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={printRef as any} className={cn("print-container", printRotate && "print-rotate-mode")}>
                {cards.map((card, index) => (
                  <div
                    key={card.id}
                    className="preview-card-wrapper transition-all duration-300 origin-top"
                    style={{
                      transform: `scale(${previewScale})`,
                      /* Compensate for height loss due to scaling to avoid huge gaps or overlaps */
                      marginBottom: `calc(-420mm * (1 - ${previewScale}) + 0px)`,
                      height: '420mm'
                    }}
                  >
                    <div className="print-page shadow-2xl">
                      <div className="card-container">
                        {showCropMarks && (
                          <>
                            <div className="crop-mark crop-top-left" style={{ top: `${-cropOffset.y}mm`, left: `${-cropOffset.x}mm` }}></div>
                            <div className="crop-mark crop-top-right" style={{ top: `${-cropOffset.y}mm`, right: `${-cropOffset.x}mm` }}></div>
                            <div className="crop-mark crop-bottom-left" style={{ bottom: `${-cropOffset.y}mm`, left: `${-cropOffset.x}mm` }}></div>
                            <div className="crop-mark crop-bottom-right" style={{ bottom: `${-cropOffset.y}mm`, right: `${-cropOffset.x}mm` }}></div>
                          </>
                        )}
                        {showFoldLine && <div className="fold-line"></div>}

                        <div className="print-area">
                          {[
                            { side: 'top', className: 'card-side card-side-top' },
                            { side: 'bottom', className: 'card-side' }
                          ].map((view) => (
                            <div key={view.side} className={view.className} style={{ gap: `${globalSpacing}pt` }}>
                              <div style={{
                                fontSize: `${fontSize.chineseName}pt`,
                                fontFamily: fontFamilies.chineseName,
                                letterSpacing: `${(enableTwoCharWidening && /^[\u4e00-\u9fa5]{2}$/.test(card.chineseName.trim()))
                                  ? (1 + 2 * letterSpacings.chineseName)
                                  : letterSpacings.chineseName}em`,
                                lineHeight: 1.1,
                                color: '#000',
                                transform: `translateY(${offsets.chineseName + 25}pt)`,
                                marginRight: `-${(enableTwoCharWidening && /^[\u4e00-\u9fa5]{2}$/.test(card.chineseName.trim()))
                                  ? (1 + 2 * letterSpacings.chineseName)
                                  : letterSpacings.chineseName}em`
                              }} className="">{card.chineseName}</div>

                              <div style={{
                                fontSize: `${fontSize.englishName}pt`,
                                fontFamily: fontFamilies.englishName,
                                letterSpacing: `${letterSpacings.englishName}em`,
                                lineHeight: 1.1,
                                color: '#000',
                                transform: `translateY(${offsets.englishName + 12}pt)`,
                                marginRight: `-${letterSpacings.englishName}em`
                              }} className="">{card.englishName}</div>

                              <div style={{
                                fontSize: `${fontSize.chineseCompany}pt`,
                                fontFamily: fontFamilies.chineseCompany,
                                letterSpacing: `${letterSpacings.chineseCompany}em`,
                                lineHeight: 1.1,
                                color: '#000',
                                transform: `translateY(${offsets.chineseCompany - 5}pt)`,
                                marginRight: `-${letterSpacings.chineseCompany}em`
                              }} className="max-w-[80%] whitespace-normal">{card.chineseCompany}</div>

                              <div style={{
                                fontSize: `${fontSize.englishCompany}pt`,
                                fontFamily: fontFamilies.englishCompany,
                                letterSpacing: `${letterSpacings.englishCompany}em`,
                                lineHeight: 1.1,
                                color: '#000',
                                transform: `translateY(${offsets.englishCompany - 10}pt)`,
                                marginRight: `-${letterSpacings.englishCompany}em`
                              }} className="max-w-[80%] whitespace-normal">{card.englishCompany}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {index < cards.length - 1 && (
                      <div className="card-ui-divider no-print my-1">
                        <div className="h-px bg-slate-300 w-full relative">
                          <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-100 text-[11px] font-bold text-slate-500 px-4 py-1 rounded-full uppercase tracking-widest border border-slate-300 shadow-sm">
                            下一张桌卡
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');

export default App;
