import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { fetchPublicAnamnesis, submitPublicAnamnesis } from '../services/repository';
import { ANAMNESIS_AREAS, ANAMNESIS_QUESTIONS } from '../types/domain';

export default function PublicAnamnesisPage() {
  const { token = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [studioName, setStudioName] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPublicAnamnesis(token)
      .then((res) => {
        setClientName(res.clientName);
        setStudioName(res.studioName);
        setAreas(res.link.areas);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ficha indisponível'))
      .finally(() => setLoading(false));
  }, [token]);

  const visibleQuestions = ANAMNESIS_QUESTIONS.filter(
    (q) => !q.area || areas.length === 0 || areas.includes(q.area)
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await submitPublicAnamnesis(token, areas, answers);
      setSaved(true);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Erro ao enviar ficha');
    }
  };

  if (loading) return <div className="p-10 text-center text-sm text-zinc-600">Carregando ficha...</div>;
  if (error && !studioName) {
    return <div className="mx-auto mt-16 max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-red-700">{error}</div>;
  }

  if (saved) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 text-xl font-bold text-zinc-950">Ficha enviada com sucesso!</h1>
        <p className="mt-2 text-sm text-zinc-600">Obrigada, {clientName}. {studioName} já recebeu suas respostas.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/70 px-4 py-8">
      <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5 rounded-2xl border border-zinc-200 bg-white p-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-red-700">{studioName}</span>
          <h1 className="mt-1 text-xl font-bold text-zinc-950">Ficha de Anamnese · {clientName}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {areas.map((a) => (
              <span key={a} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                {ANAMNESIS_AREAS.find((item) => item.id === a)?.label ?? a}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {visibleQuestions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-800">{q.question}</label>
              {q.type === 'radio' ? (
                <div className="flex gap-3">
                  {['Sim', 'Não'].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        required
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswers((p) => ({ ...p, [q.id]: opt }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                  placeholder="Responda aqui (ou deixe em branco se não houver)"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-xl bg-red-700 py-3 text-sm font-semibold text-white hover:bg-red-800">
          Enviar ficha de anamnese
        </button>
      </form>
    </div>
  );
}
