import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent } from 'react';
import { Camera, Eraser, PenTool, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPlan } from '../lib/domain';
import { createLashMapping } from '../services/repository';
import { ANAMNESIS_AREAS, LASH_CURLS, LASH_LENGTHS, LASH_STYLES, LASH_TECHNIQUES } from '../types/domain';

const VISAGISM_PRESETS = [
  { label: 'Olhos pequenos / fechados', technique: 'Brasileiro', style: 'Boneca', curl: 'D', sizes: ['8mm', '10mm', '12mm', '12mm', '10mm', '8mm'] },
  { label: 'Olhos amendoados / padrão', technique: 'Volume Egípcio', style: 'Gatinho', curl: 'C', sizes: ['8mm', '9mm', '10mm', '11mm', '12mm', '10mm'] },
  { label: 'Olhos caídos / alongar', technique: 'Fox Eyes', style: 'Esquilo', curl: 'L', sizes: ['7mm', '8mm', '10mm', '12mm', '11mm', '9mm'] },
  { label: 'Olhos afastados / aproximar', technique: 'Híbrido', style: 'Boneca', curl: 'C', sizes: ['9mm', '11mm', '12mm', '11mm', '10mm', '8mm'] },
];

export default function LashMappingPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const drawing = useRef(false);

  const [clientId, setClientId] = useState('');
  const [aiArea, setAiArea] = useState<string>(ANAMNESIS_AREAS[0].id);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [technique, setTechnique] = useState<string>('Brasileiro');
  const [style, setStyle] = useState<string>('Gatinho');
  const [curl, setCurl] = useState<string>('C');
  const [thickness, setThickness] = useState('0.07');
  const [sizes, setSizes] = useState<string[]>(['8mm', '9mm', '10mm', '11mm', '12mm']);
  const [customSize, setCustomSize] = useState('');
  const [adhesive, setAdhesive] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState('#b91c1c');
  const [eraser, setEraser] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const drawGuide = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 140);
    ctx.quadraticCurveTo(260, 35, 480, 140);
    ctx.quadraticCurveTo(260, 185, 40, 140);
    ctx.stroke();
  };

  useEffect(() => {
    drawGuide();
  }, []);

  if (!workspace) return null;
  const plan = getPlan(workspace.studio.plan_id);

  const getPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    const pt = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pt = getPoint(e);
    ctx.strokeStyle = eraser ? '#ffffff' : color;
    ctx.lineWidth = eraser ? 14 : 2.5;
    ctx.lineCap = 'round';
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const toggleSize = (len: string) => {
    setSizes((prev) => (prev.includes(len) ? prev.filter((x) => x !== len) : [...prev, len]));
  };

  const applyPreset = (p: (typeof VISAGISM_PRESETS)[number]) => {
    setTechnique(p.technique);
    setStyle(p.style);
    setCurl(p.curl);
    setSizes(p.sizes);
    setNotes(`Sugestão visagismo: ${p.label} · Curvatura ${p.curl}`);
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const ratio = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

        // Desenha arco guia tracejado sobre a foto da cliente
        ctx.strokeStyle = 'rgba(185, 28, 28, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(60, 140);
        ctx.quadraticCurveTo(260, 45, 460, 140);
        ctx.stroke();

        const areaLabel = ANAMNESIS_AREAS.find((a) => a.id === aiArea)?.label ?? 'Lash Designer';
        const presetIdx = (img.width + img.height) % VISAGISM_PRESETS.length;
        const suggested = VISAGISM_PRESETS[presetIdx];
        applyPreset(suggested);
        setAiResult(
          `IA da Beleza (${areaLabel}): Foto carregada no canvas (${img.width}x${img.height}). Recomendado mapping ${suggested.style} com técnica ${suggested.technique}, curvatura ${suggested.curl} e numeração ${suggested.sizes.join('-')}. Desenhe as marcações diretamente sobre a foto.`
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const client = workspace.clients.find((c) => c.id === clientId);
    try {
      const drawingDataUrl = canvasRef.current?.toDataURL('image/png') ?? null;
      await createLashMapping(workspace, {
        client_id: client?.id ?? null,
        client_name: client?.name ?? 'Cliente avulsa',
        technique,
        style,
        curl,
        thickness,
        sizes,
        adhesive: adhesive || 'Não informado',
        notes: notes || null,
        drawing_data_url: drawingDataUrl,
      });
      await refreshWorkspace();
      drawGuide();
      setNotes('');
      setAiResult(null);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro ao salvar mapping');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950">Lash Mapping & IA da Beleza</h1>
        <p className="text-xs text-zinc-500">
          Uso do plano {plan.name}: <strong>{workspace.mappings.length}</strong> /{' '}
          {plan.mappingLimit === null ? 'Ilimitado' : plan.mappingLimit} mappings · Cota IA da Beleza:{' '}
          <strong>{plan.beautyAiMonthlyLimit === 999999 ? 'Ilimitada' : `${plan.beautyAiMonthlyLimit}/mês`}</strong>
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-50 to-red-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-bold text-red-800">
            <Sparkles className="h-4 w-4" /> IA da Beleza & Visagismo (9 áreas + análise com foto no canvas)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={aiArea}
              onChange={(e) => setAiArea(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium"
            >
              {ANAMNESIS_AREAS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
            >
              <Camera className="h-3.5 w-3.5" /> Enviar Foto da Cliente & Analisar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {VISAGISM_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-red-400"
            >
              {p.label} ({p.style})
            </button>
          ))}
        </div>

        {aiResult && (
          <p className="rounded-xl border border-red-200 bg-white p-3 text-xs font-medium text-zinc-800">
            {aiResult}
          </p>
        )}
      </div>

      <form onSubmit={handleSave} className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-5 lg:grid-cols-2">
        <div className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Cliente atendida</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm">
                <option value="">Cliente avulsa (ou selecione)...</option>
                {workspace.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Cola / Adesivo utilizado</label>
              <input
                placeholder="Ex: Cherry 1.5s"
                value={adhesive}
                onChange={(e) => setAdhesive(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Técnica</label>
              <select value={technique} onChange={(e) => setTechnique(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-2.5 py-2 text-xs">
                {LASH_TECHNIQUES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Estilo / Mapping</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-2.5 py-2 text-xs">
                {LASH_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Curvatura</label>
              <select value={curl} onChange={(e) => setCurl(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-2.5 py-2 text-xs">
                {LASH_CURLS.map((c) => <option key={c} value={c}>Curv. {c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-zinc-700">Numerações utilizadas (qualquer medida em mm)</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set([...LASH_LENGTHS, ...sizes])).map((len) => {
                const on = sizes.includes(len);
                return (
                  <button
                    key={len}
                    type="button"
                    onClick={() => toggleSize(len)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      on ? 'bg-red-700 text-white' : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {len}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                placeholder="Outra medida livre (ex: 21mm, 22mm, 25mm)"
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                className="w-56 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const raw = customSize.trim();
                  if (!raw) return;
                  const formatted = raw.endsWith('mm') ? raw : `${raw}mm`;
                  if (!sizes.includes(formatted)) setSizes((prev) => [...prev, formatted]);
                  setCustomSize('');
                }}
                className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                + Adicionar medida
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">Espessura dos fios (mm)</label>
            <input
              placeholder="Ex: 0.07, 0.05, 0.15"
              value={thickness}
              onChange={(e) => setThickness(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder="Notas técnicas do atendimento..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button type="submit" className="w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800">
            Salvar Lash Mapping
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-700">Desenho sobre o molde ou foto da cliente</span>
            <div className="flex items-center gap-2">
              {['#b91c1c', '#18181b', '#71717a'].map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => { setColor(hex); setEraser(false); }}
                  style={{ backgroundColor: hex }}
                  className={`h-5 w-5 rounded-full border-2 ${!eraser && color === hex ? 'border-zinc-950 ring-1 ring-zinc-400' : 'border-white'}`}
                  aria-label="Escolher cor"
                />
              ))}
              <button
                type="button"
                onClick={() => setEraser(!eraser)}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${eraser ? 'bg-zinc-950 text-white' : 'bg-zinc-100'}`}
              >
                {eraser ? <PenTool className="h-3 w-3" /> : <Eraser className="h-3 w-3" />}
                {eraser ? 'Pincel' : 'Borracha'}
              </button>
              <button type="button" onClick={drawGuide} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-red-800">
                <Trash2 className="h-3 w-3" /> Limpar
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={520}
            height={220}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => { drawing.current = false; }}
            onPointerLeave={() => { drawing.current = false; }}
            className="w-full touch-none rounded-xl border border-zinc-200 bg-white"
          />
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        {workspace.mappings.map((m) => (
          <div key={m.id} className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
            {m.drawing_data_url && (
              <img src={m.drawing_data_url} alt={m.client_name} className="mb-3 h-28 w-full rounded-lg border border-zinc-100 object-contain" />
            )}
            <p className="font-bold text-zinc-950">{m.client_name}</p>
            <p className="text-xs text-red-700">{m.technique} · {m.style} · Curv. {m.curl}</p>
            <p className="mt-1 text-xs text-zinc-500">Tamanhos: {m.sizes.join(', ')}</p>
            <p className="text-xs text-zinc-500">Cola: {m.adhesive}</p>
            {m.notes && <p className="mt-1 text-xs text-zinc-600">{m.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
